/**
 * VİRMAN servisi (ADR-0016).
 *
 * ⚠️  TANIM: virman mevcut borcu İPTAL ETMEK için değil, DOĞRU KİŞİYE
 *     AKTARMAK için yapılan muhasebe işlemidir. Toplam borç DEĞİŞMEZ; değişen
 *     yalnızca borcun muhatabıdır. Bu yüzden `borc.tutar`, `vadeTarihi` ve
 *     `calismaId` bu servis tarafından HİÇ yazılmaz.
 *
 * ⚠️  İKİ TARAF AYNI TRANSACTION'DA. Yevmiye fişi ve `borc_sorumlusu` payları
 *     birlikte yazılır; biri yazılıp öteki yazılmazsa defter ile cari KALICI
 *     olarak ayrışır ve fark hangi virmandan geldiği bilinmeden kalır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { apiBicimi, money, takvimTarihi, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { virmanFisUretirMi, virmanKaydiniDogrula } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { NumaraServisi } from '../../common/numbering/numara.service';
import { FisCommandServisi } from '../muhasebe/fis.command.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { VirmanEkleDto } from './dto/virman.dto';

export interface VirmanSonucu {
  readonly id: string;
  readonly virmanNo: string;
  /** Taşınma virmanında `null` — fiş üretmemesi DOĞRU davranıştır. */
  readonly fisId: string | null;
  readonly etkilenenBorcSayisi: number;
}

/** Kuruş tabanlı tamsayı — float toplamı kuruşu sessizce kaydırır (ADR-0007). */
function kurus(metin: string): bigint {
  return BigInt(new Prisma.Decimal(metin).mul(100).toFixed(0));
}

@Injectable()
export class VirmanCommandServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly numara: NumaraServisi,
    // Fiş üretimi KOPYALANMAZ: denklik, kapalı dönem yasağı ve numaralandırma
    // tek yerde durur.
    private readonly fis: FisCommandServisi,
  ) {}

  async ekle(dto: VirmanEkleDto, principal: Principal): Promise<VirmanSonucu> {
    const baglam = mevcutBaglamiZorunluKil('virman.ekle');
    const tarih = takvimTarihi(dto.tarih);

    const satirlar = (dto.satirlar ?? []).map((s) => ({
      hesapId: s.hesapId,
      bolumId: s.bolumId ?? null,
      borcKurus: kurus(s.borc),
      alacakKurus: kurus(s.alacak),
      aciklama: s.aciklama,
    }));
    const paylar = (dto.paylar ?? []).map((p) => ({
      borcId: p.borcId, kisiId: p.kisiId, sira: p.sira, payKurus: kurus(p.pay),
    }));

    // Alan kuralları ÖNCE: veritabanına gitmeden reddedilebilecek her şey
    // burada reddedilir (denklik · tek yön · sıfır satır · sebep kodu).
    virmanKaydiniDogrula({
      tur: dto.tur, sebepKodu: dto.sebepKodu, aciklama: dto.aciklama,
      satirlar, paylar,
    });

    const virmanId = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      /*
       * --- 1) CARİ TARAFI DOĞRULANIR (yazılmadan önce) --------------------
       *
       * Fişten ÖNCE doğrulanır: cari tarafı reddedilecekse boşuna fiş
       * numarası tüketilmez. Boşluksuz seride tüketilen numara geri gelmez.
       */
      const borcIdler = [...new Set(paylar.map((p) => p.borcId))];
      const borclar = new Map<string, { tutarKurus: bigint }>();

      for (const borcId of borcIdler) {
        const borc = await tx.borc.findFirst({
          where: { id: borcId, tenantId: principal.tenantId },
          select: { id: true, tutar: true },
        });
        if (!borc) throw new KayitBulunamadi(`Borç bulunamadı: ${borcId}`);
        borclar.set(borcId, { tutarKurus: kurus(borc.tutar.toFixed(4)) });

        /*
         * ★ Σ PAY = borc.tutar OLMAK ZORUNDA.
         *
         * Virman borcu iptal etmez, muhatabını değiştirir. Toplam sapsaydı
         * borcun bir kısmı hiç kimseye yazılmamış ya da bölüm olduğundan
         * fazla borçlu gösterilmiş olurdu — ikisi de yardımcı defteri
         * kontrol hesabından ayırır.
         */
        const yeniToplam = paylar
          .filter((p) => p.borcId === borcId)
          .reduce((t, p) => t + p.payKurus, 0n);
        const tutarKurus = borclar.get(borcId)?.tutarKurus ?? 0n;
        if (yeniToplam !== tutarKurus) {
          throw new IsKuraliIhlali(
            `Payların toplamı borç tutarına eşit değil: ` +
              `${apiBicimi(money((Number(yeniToplam) / 100).toFixed(2)))} ≠ ` +
              `${apiBicimi(money((Number(tutarKurus) / 100).toFixed(2)))}.`,
            'Virman borcu İPTAL ETMEZ, muhatabını değiştirir; toplam korunmalıdır.',
          );
        }

        /*
         * ★ ÖDENENİN ALTINA İNİLEMEZ.
         *
         * Veritabanı kısıtı (`odenen <= pay`) bunu zaten yakalar ama ham bir
         * CHECK ihlali kullanıcıya hiçbir şey anlatmaz. Domain katmanı ÖNCE
         * yakalar ve çıkış yolunu gösterir.
         */
        const mevcutlar = await tx.borcSorumlusu.findMany({
          where: { borcId, tenantId: principal.tenantId },
          select: { id: true, kisiId: true, sira: true, odenen: true, cozumlemeTarihi: true },
        });
        for (const m of mevcutlar) {
          const yeni = paylar.find((p) => p.borcId === borcId && p.kisiId === m.kisiId);
          const yeniPay = yeni?.payKurus ?? 0n;
          const odenenKurus = kurus(m.odenen.toFixed(4));
          if (odenenKurus > yeniPay) {
            /*
             * ⚠️  ÇIKIŞ YOLU `detail` İÇİNDE. `sonrakiEylem` alanı bazı
             *     istemcilerde gösterilmiyor; ödenmiş tutarın neden
             *     indirilemediği ve ne yapılacağı ASIL mesajda durmalıdır.
             *     Ham CHECK ihlali ("violates constraint") kullanıcıya
             *     hiçbir şey anlatmaz — bu yüzden domain önce yakalar.
             */
            throw new IsKuraliIhlali(
              `Bu kişi ${m.odenen.toFixed(2)} TL ödemiş; payı ` +
                `${(Number(yeniPay) / 100).toFixed(2)} TL'ye indirilemez. ` +
                // ⚠️ "tahsis" ve "iade" KÜÇÜK HARFLE: Türkçe 'İ' ile
                //    /tahsis/i eşleşmez ('İ'.toLowerCase() birleşik karakter
                //    üretir). Mesajı büyük harfle vurgulamak, arayan tarafın
                //    metni bulamamasına yol açıyordu — ölçüldü.
                'Önce fazla tahsilatın tahsisini düzeltin ya da iade edin.',
              'Ödenmiş tutar virmanla silinemez: virman borcu iptal etmez, ' +
                'muhatabını değiştirir.',
            );
          }
        }
      }

      /*
       * --- 2) FİŞ (varsa) -------------------------------------------------
       *
       * ⚠️  TAŞINMA VİRMANI FİŞ ÜRETMEZ. Kiracı taşındığında borcun toplamı
       *     da hangi hesapta durduğu da değişmez; yalnızca yardımcı defterin
       *     İÇİNDEKİ dağılım değişir. Kontrol hesabı bakiyesi aynı kaldığı
       *     için deftere yazılacak DENK bir kayıt yoktur — zorla üretilseydi
       *     aynı hesaba borç ve alacak yazan, bakiyeyi değiştirmeyen bir
       *     gürültü satırı olurdu.
       */
      let fisId: string | null = null;
      if (virmanFisUretirMi({ satirlar })) {
        const fis = await this.fis.ekleIslemde(
          tx,
          {
            tarih: dto.tarih,
            aciklama: `Virman (${dto.sebepKodu}): ${dto.aciklama.trim()}`,
            fisTuru: 'MAHSUP',
            kaynakTipi: 'VIRMAN',
            kaynakId: virmanId,
            satirlar: satirlar.map((s) => ({
              hesapId: s.hesapId,
              ...(s.bolumId === null ? {} : { bolumId: s.bolumId }),
              borc: (Number(s.borcKurus) / 100).toFixed(2),
              alacak: (Number(s.alacakKurus) / 100).toFixed(2),
              ...(s.aciklama === undefined ? {} : { aciklama: s.aciklama }),
            })),
          },
          principal,
          baglam,
        );
        fisId = fis.id;
      }

      /*
       * --- 3) CARİ PAYLARI YAZILIR ----------------------------------------
       *
       * ⚠️  `cozumlemeTarihi` MEVCUT SATIRLARDA KORUNUR. O tarih orijinal
       *     çözümlemenin tarihidir; virmanın tarihi virman kaydında durur.
       *     Üzerine yazılsaydı borcun ne zaman kime bağlandığı geçmişi
       *     kaybolurdu.
       */
      for (const borcId of borcIdler) {
        const mevcutlar = await tx.borcSorumlusu.findMany({
          where: { borcId, tenantId: principal.tenantId },
          select: { id: true, kisiId: true, sira: true },
        });
        const mevcutAnahtar = new Map(
          mevcutlar.map((m) => [`${m.kisiId}|${m.sira}`, m.id]),
        );

        for (const p of paylar.filter((x) => x.borcId === borcId)) {
          const mevcutId = mevcutAnahtar.get(`${p.kisiId}|${p.sira}`);
          const pay = new Prisma.Decimal((Number(p.payKurus) / 100).toFixed(2));
          if (mevcutId !== undefined) {
            await tx.borcSorumlusu.update({ where: { id: mevcutId }, data: { pay } });
            mevcutAnahtar.delete(`${p.kisiId}|${p.sira}`);
          } else {
            await tx.borcSorumlusu.create({
              data: {
                id: randomUUID(), tenantId: principal.tenantId, borcId,
                kisiId: p.kisiId, sira: p.sira, rol: 'KIRACI',
                // Yeni sorumlunun çözümlemesi VİRMAN GÜNÜNDE yapılmıştır.
                cozumlemeTarihi: new Date(tarih),
                pay, agirlik: 1n,
              },
            });
          }
        }

        /*
         * Payı kalmayan sorumlular SİLİNMEZ, sıfırlanır mı? Hayır — kaydı
         * silmek borcun bir dönem kime bağlı olduğunu yok eder. Ama sıfır
         * paylı satır da yardımcı defteri kirletir. Bu yüzden virman
         * KAPSAMINDA OLMAYAN satırlara DOKUNULMAZ: girdide bir kişi hiç
         * geçmiyorsa onun payı zaten korunmuştur ve Σ kontrolü bunu yakalar.
         */
      }

      // --- 4) VİRMAN KAYDI --------------------------------------------------
      const virmanNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'VIRMAN',
        yil: new Date(tarih).getUTCFullYear(),
      });

      await tx.virman.create({
        data: {
          id: virmanId, tenantId: principal.tenantId, virmanNo,
          tur: dto.tur, sebepKodu: dto.sebepKodu,
          tarih: new Date(tarih), aciklama: dto.aciklama.trim(),
          yevmiyeFisiId: fisId, olusturan: principal.id,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Virman', varlikId: virmanId,
        sonrakiDeger: {
          virmanNo, tur: dto.tur, sebepKodu: dto.sebepKodu, tarih: dto.tarih,
          fisId, satirSayisi: satirlar.length, paySayisi: paylar.length,
          borcIdler,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id: virmanId, virmanNo, fisId, etkilenenBorcSayisi: borcIdler.length,
      };
    });
  }
}
