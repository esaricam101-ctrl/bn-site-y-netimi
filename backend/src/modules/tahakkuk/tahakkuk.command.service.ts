/**
 * Tahakkuk servisi — bir gideri bölümlere paylaştırıp borç yazar.
 *
 * ZİNCİR (her adım ayrı bir domain kuralıdır):
 *   1. Gider türü okunur — kural VERİDİR, koda gömülü değildir (KMK md. 20).
 *   2. `gideriPaylastir` gideri BÖLÜMLERE dağıtır (Eksen 1).
 *   3. `borcSorumlulariniCoz` her bölüm için borcun KİME yazılacağını
 *      çözer (Eksen 2) — malik / kiracı / sakin zinciri.
 *   4. `malikBorcunuBol` bölüme düşen payı MALİKLER ARASINDA böler (Eksen 4).
 *
 * İKİ KRİTİK KURAL:
 *
 * SNAPSHOT — sorumlu kişiler borç oluşturulduğu ANDA çözülür ve kayda
 * yazılır; sorgu anında yeniden hesaplanmaz. Kiracı Mart'ta taşınırsa Şubat
 * borcu eski kiracıda kalır. Yeniden hesaplasaydık, geçmiş borçlar taşınma
 * anında sessizce el değiştirirdi.
 *
 * TEK İŞLEM — bütün bölümlerin borcu tek transaction'da yazılır. Yarım kalan
 * bir tahakkuk, bazı dairelerin borçlandığı bazılarının borçlanmadığı bir
 * dönem bırakır; hangisinin eksik olduğu aylar sonra fark edilir.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  apiBicimi, money, moneyKurustan, takvimTarihi,
  type Principal, type TakvimTarihi,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  BagimsizBolum, borcSorumlulariniCoz, gideriPaylastir, malikBorcunuBol,
  type BolumIliskisi, type GiderTuru, type MalikHissesi, type PaylasimGirdisi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { NumaraServisi } from '../../common/numbering/numara.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { BolumGirdisiDto, TahakkukCalistirDto } from './dto/tahakkuk.dto';

export interface TahakkukSatiri {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly tutar: string;
  readonly tahakkukNo: string | null;
  readonly sorumlular: readonly {
    readonly kisiId: string;
    readonly kisiAdi: string;
    readonly rol: string;
    readonly sira: string;
    readonly pay: string;
  }[];
}

export interface TahakkukSonucu {
  readonly onizlemeMi: boolean;
  readonly giderTuruKodu: string;
  readonly donem: string;
  readonly toplamTutar: string;
  /** Dağıtılan toplam. `toplamTutar` ile EŞİT olmak zorundadır. */
  readonly dagitilanToplam: string;
  readonly bolumSayisi: number;
  readonly satirlar: readonly TahakkukSatiri[];
}

@Injectable()
export class TahakkukCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
    private readonly numara: NumaraServisi,
  ) {}

  async calistir(dto: TahakkukCalistirDto, principal: Principal): Promise<TahakkukSonucu> {
    const baglam = mevcutBaglamiZorunluKil('tahakkuk.calistir');
    const donem = takvimTarihi(dto.donem);
    const vade = takvimTarihi(dto.vadeTarihi);
    const toplam = money(dto.toplamTutar);
    const onizleme = dto.onizleme === true;

    if (vade < donem) {
      throw new IsKuraliIhlali(
        'Vade tarihi tahakkuk döneminden önce olamaz.',
        'Vade tarihini dönem başlangıcından sonraya alın.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      // --- 1) Kural okunur --------------------------------------------------
      const turKaydi = await tx.giderTuru.findFirst({
        where: {
          tenantId: principal.tenantId,
          kod: dto.giderTuruKodu.trim().toLocaleUpperCase('tr'),
          aktifMi: true,
        },
      });
      if (!turKaydi) {
        throw new KayitBulunamadi(
          `Aktif gider türü bulunamadı: ${dto.giderTuruKodu}. ` +
            'Tahakkuk, tanımlı bir kural olmadan çalıştırılamaz.',
        );
      }

      const gider: GiderTuru = {
        kod: turKaydi.kod,
        ad: turKaydi.ad,
        paylasimKurali: turKaydi.paylasimKurali,
        sorumlulukTipi: turKaydi.sorumlulukTipi,
        kuralKaynagi: turKaydi.kuralKaynagi,
        kaynakReferansi: turKaydi.kaynakReferansi,
        // JSON sütunu `unknown` şeklindedir; alanlar AÇIKÇA seçilir. Doğrudan
        // cast, sütuna elle yazılmış bozuk bir yapının dağıtıma sızmasına
        // izin verirdi.
        ...(Array.isArray(turKaydi.karmaBilesenler)
          ? {
              karmaBilesenler: (turKaydi.karmaBilesenler as unknown[]).map((b) => {
                const o = b as { kural: string; yuzde: number };
                return { kural: o.kural, yuzde: o.yuzde };
              }) as GiderTuru['karmaBilesenler'],
            }
          : {}),
        malikPaylasimi: turKaydi.malikPaylasimi as GiderTuru['malikPaylasimi'],
      };

      // --- 2) Mükerrer tahakkuk denetimi -----------------------------------
      //
      // Aynı gider türü aynı dönemde iki kez çalıştırılırsa her daire iki kez
      // borçlanır. Veritabanı kısıtı bunu yakalayamaz: `borc` üzerindeki
      // unique index (tenant, tahakkuk_no, bolum_id) tahakkuk NUMARASINA
      // bakar ve ikinci çalıştırma yeni numara alır.
      const mevcutSayisi = await tx.borc.count({
        where: {
          tenantId: principal.tenantId,
          giderTuruKodu: gider.kod,
          tahakkukDonemi: new Date(donem),
        },
      });
      if (mevcutSayisi > 0 && !onizleme) {
        throw new IsKuraliIhlali(
          `'${gider.kod}' için ${donem} dönemi zaten tahakkuk edilmiş ` +
            `(${mevcutSayisi} borç kaydı).`,
          'Önce mevcut tahakkuku iptal edin ya da farklı bir dönem seçin.',
        );
      }

      // --- 3) Bölümler ve ilişkiler ----------------------------------------
      const bolumKayitlari = await tx.bagimsizBolum.findMany({
        where: {
          tenantId: principal.tenantId,
          ...(dto.hedefBlokId ? { blokId: dto.hedefBlokId } : {}),
        },
        select: {
          id: true, kapiNo: true, kat: true, nitelik: true, durum: true,
          brutM2: true, netM2: true, arsaPayiPay: true, arsaPayiPayda: true,
          aidatMuafiyeti: true, blokId: true,
        },
        orderBy: { kapiNo: 'asc' },
      });

      if (bolumKayitlari.length === 0) {
        throw new IsKuraliIhlali(
          'Tahakkuk edilecek bağımsız bölüm yok.',
          'Bölüm kayıtlarını tamamlayıp tekrar deneyin.',
        );
      }

      const girdiHaritasi = new Map<string, BolumGirdisiDto>(
        (dto.bolumGirdileri ?? []).map((g) => [g.bolumId, g]),
      );

      const bolumler = new Map<string, BagimsizBolum>();
      const girdiler: PaylasimGirdisi[] = [];

      for (const k of bolumKayitlari) {
        const bolum = BagimsizBolum.olustur({
          id: k.id, tenantId: principal.tenantId,
          blokId: k.blokId, katId: null,
          kapiNo: k.kapiNo, icKapiNo: null, kat: k.kat,
          nitelik: k.nitelik, daireTipi: null, kullanimAmaci: null,
          durum: k.durum,
          brutM2: k.brutM2.toNumber(), netM2: k.netM2.toNumber(),
          arsaPayiPay: k.arsaPayiPay, arsaPayiPayda: k.arsaPayiPayda,
          aidatMuafiyeti: k.aidatMuafiyeti,
          tapu: {
            ada: null, parsel: null, pafta: null,
            bagimsizBolumNo: null, cilt: null, sahife: null,
          },
        });
        bolumler.set(k.id, bolum);

        const g = girdiHaritasi.get(k.id);
        girdiler.push({
          bolum,
          ...(g?.tuketim === undefined ? {} : { tuketim: BigInt(g.tuketim) }),
          ...(g?.sabitAgirlik === undefined ? {} : { sabitAgirlik: BigInt(g.sabitAgirlik) }),
          ...(g?.kullaniyorMu === undefined ? {} : { kullaniyorMu: g.kullaniyorMu }),
          ...(g?.manuelTutar === undefined ? {} : { manuelTutar: money(g.manuelTutar) }),
          blokId: k.blokId,
        });
      }

      // --- 4) Dağıtım (Eksen 1) --------------------------------------------
      const paylar = gideriPaylastir(
        gider, toplam, girdiler,
        dto.hedefBlokId ? { hedefBlokId: dto.hedefBlokId } : {},
      );

      // --- 5) Sorumluluk ve malik bölüşümü (Eksen 2 + 4) -------------------
      const ilgiliBolumIdler = paylar.map((p) => p.bolumId);

      const [malikKayitlari, kiraciKayitlari, sakinKayitlari, kisiler] = await Promise.all([
        tx.malik.findMany({
          where: { tenantId: principal.tenantId, bolumId: { in: ilgiliBolumIdler } },
          select: {
            bolumId: true, kisiId: true, hissePay: true, hissePayda: true,
            tapuBaslangic: true, tapuBitis: true,
          },
        }),
        tx.kiraci.findMany({
          where: { tenantId: principal.tenantId, bolumId: { in: ilgiliBolumIdler } },
          select: { bolumId: true, kisiId: true, baslangic: true, bitis: true, tahliyeTarihi: true },
        }),
        tx.sakin.findMany({
          where: { tenantId: principal.tenantId, bolumId: { in: ilgiliBolumIdler } },
          select: { bolumId: true, kisiId: true, girisTarihi: true, cikisTarihi: true },
        }),
        tx.kisi.findMany({
          where: { tenantId: principal.tenantId },
          select: { id: true, ad: true, soyad: true },
        }),
      ]);

      const kisiAdi = new Map(kisiler.map((k) => [k.id, `${k.ad} ${k.soyad}`]));
      const gun = (d: Date): TakvimTarihi =>
        takvimTarihi(d.toISOString().slice(0, 10));

      const iliskiHaritasi = new Map<string, BolumIliskisi[]>();
      const hisseHaritasi = new Map<string, MalikHissesi[]>();

      for (const m of malikKayitlari) {
        const liste = iliskiHaritasi.get(m.bolumId) ?? [];
        liste.push({
          kisiId: m.kisiId, rol: 'MALIK',
          baslangic: gun(m.tapuBaslangic),
          bitis: m.tapuBitis === null ? null : gun(m.tapuBitis),
        });
        iliskiHaritasi.set(m.bolumId, liste);
      }
      for (const k of kiraciKayitlari) {
        // Tahliye edilmiş sözleşme, bitiş tarihi ne olursa olsun TAHLİYE
        // gününde kapanır; aksi halde tahliye sonrası aylarda kiracı hâlâ
        // sorumlu görünür.
        const bitis = k.tahliyeTarihi ?? k.bitis;
        const liste = iliskiHaritasi.get(k.bolumId) ?? [];
        liste.push({
          kisiId: k.kisiId, rol: 'KIRACI',
          baslangic: gun(k.baslangic),
          bitis: bitis === null ? null : gun(bitis),
        });
        iliskiHaritasi.set(k.bolumId, liste);
      }
      for (const s of sakinKayitlari) {
        const liste = iliskiHaritasi.get(s.bolumId) ?? [];
        liste.push({
          kisiId: s.kisiId, rol: 'SAKIN',
          baslangic: gun(s.girisTarihi),
          bitis: s.cikisTarihi === null ? null : gun(s.cikisTarihi),
        });
        iliskiHaritasi.set(s.bolumId, liste);
      }
      for (const m of malikKayitlari) {
        const liste = hisseHaritasi.get(m.bolumId) ?? [];
        liste.push({
          kisiId: m.kisiId,
          hissePay: m.hissePay,
          hissePayda: m.hissePayda,
          baslangic: gun(m.tapuBaslangic),
          bitis: m.tapuBitis === null ? null : gun(m.tapuBitis),
        });
        hisseHaritasi.set(m.bolumId, liste);
      }

      const satirlar: TahakkukSatiri[] = [];
      let dagitilanKurus = 0n;

      for (const pay of paylar) {
        dagitilanKurus += pay.tutar.kurus;
        const iliskiler = iliskiHaritasi.get(pay.bolumId) ?? [];
        const zincir = borcSorumlulariniCoz(gider, iliskiler, donem);

        // Bölüme düşen pay MALİKLER ARASINDA bölünür. Zincirde birden çok
        // ASIL varsa (hisseli mülkiyet) her malik yalnızca kendi payından
        // sorumludur; biri ödediğinde diğerlerinin borcu AÇIK kalır.
        const asillar = zincir.filter((s) => s.sira === 'ASIL');
        const hisseler = hisseHaritasi.get(pay.bolumId) ?? [];
        // Tahakkuk dönemindeki GEÇERLİ hisseler. Devredilmiş bir tapu payı
        // dönem dışındaysa bölüşüme girmez; aksi halde eski malik bugünkü
        // borcun bir kısmından sorumlu görünür.
        const donemHisseleri = hisseler.filter(
          (h) => h.baslangic <= donem && (h.bitis === null || h.bitis >= donem),
        );

        const asilPaylari =
          asillar.length > 1 && donemHisseleri.length === asillar.length
            ? malikBorcunuBol(
                pay.tutar, donemHisseleri, gider.malikPaylasimi ?? 'HISSE_ORANI',
              )
            : null;

        const sorumlular = zincir.map((s, i) => {
          const asilIndeksi = asillar.findIndex((a) => a.kisiId === s.kisiId);
          const kendiPayi =
            s.sira === 'ASIL' && asilPaylari !== null && asilIndeksi >= 0
              ? asilPaylari[asilIndeksi]?.tutar ?? pay.tutar
              : pay.tutar;
          return {
            kisiId: s.kisiId,
            kisiAdi: kisiAdi.get(s.kisiId) ?? '—',
            rol: s.rol,
            sira: s.sira,
            pay: apiBicimi(kendiPayi),
            agirlik:
              s.sira === 'ASIL' && asilPaylari !== null && asilIndeksi >= 0
                ? (asilPaylari[asilIndeksi]?.agirlik ?? 1n)
                : 1n,
            sirano: i,
          };
        });

        satirlar.push({
          bolumId: pay.bolumId,
          kapiNo: pay.kapiNo,
          tutar: apiBicimi(pay.tutar),
          tahakkukNo: null,
          sorumlular: sorumlular.map((s) => ({
            kisiId: s.kisiId, kisiAdi: s.kisiAdi, rol: s.rol,
            sira: s.sira, pay: s.pay,
          })),
        });

        if (onizleme) continue;

        // --- 6) Yazma ------------------------------------------------------
        const tahakkukNo = await this.numara.tahsisEt(tx, {
          tenantId: principal.tenantId,
          seriKodu: 'TAHAKKUK',
          yil: Number(donem.slice(0, 4)),
        });
        const borcId = randomUUID();

        await tx.borc.create({
          data: {
            id: borcId, tenantId: principal.tenantId, bolumId: pay.bolumId,
            giderTuruKodu: gider.kod, tahakkukNo,
            tutar: new Prisma.Decimal(apiBicimi(pay.tutar)),
            vadeTarihi: new Date(vade),
            tahakkukDonemi: new Date(donem),
          },
        });

        for (const s of sorumlular) {
          await tx.borcSorumlusu.create({
            data: {
              id: randomUUID(), tenantId: principal.tenantId,
              borcId, kisiId: s.kisiId,
              // Tipler domain'den gelir ve Prisma enum'larıyla birebir örtüşür;
              // dönüşüm gerekmez (`IliskiRolu` SAKIN'i migration 0003'te aldı).
              sira: s.sira,
              rol: s.rol,
              cozumlemeTarihi: new Date(donem),
              pay: new Prisma.Decimal(s.pay),
              agirlik: s.agirlik,
            },
          });
        }

        satirlar[satirlar.length - 1] = {
          ...(satirlar[satirlar.length - 1] as TahakkukSatiri),
          tahakkukNo,
        };
      }

      // Dağıtılan toplam giderin TAMAMINA eşit olmalıdır. `dagit()` yuvarlama
      // farkını kaybetmez ama KARMA/MANUEL yollarında bir hata olursa fark
      // burada yakalanır — sessizce eksik tahsilat yapılmaz.
      if (dagitilanKurus !== toplam.kurus) {
        throw new IsKuraliIhlali(
          `Dağıtılan toplam (${dagitilanKurus}) gider toplamına (${toplam.kurus}) eşit değil.`,
          'Gider türü tanımını ve bölüm girdilerini kontrol edin.',
        );
      }

      if (!onizleme) {
        // Tahakkuk ÇALIŞTIRMASI bir varlıktır ve kendi kimliğini taşır.
        // `${kod}:${donem}` gibi bileşik bir anahtar kullanılamaz: audit
        // `varlik_id` sütunu `uuid` tipindedir ve yazma anında patlar.
        // Kod ve dönem denetim gövdesinde zaten yazılıdır.
        const calistirmaId = randomUUID();

        await this.audit.yaz(tx, {
          tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
          varlik: 'Tahakkuk', varlikId: calistirmaId,
          sonrakiDeger: {
            giderTuruKodu: gider.kod, donem, vade,
            toplamTutar: apiBicimi(toplam), bolumSayisi: paylar.length,
            paylasimKurali: gider.paylasimKurali,
            sorumlulukTipi: gider.sorumlulukTipi,
          },
          correlationId: baglam.correlationId,
          ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
        });

        await this.outbox.yayinla(tx, {
          eventType: 'apartman.tahakkuk.calistirildi', eventVersion: 1,
          tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
          aggregate: { tip: 'Tahakkuk', id: calistirmaId, version: 1 },
          payload: {
            giderTuruKodu: gider.kod, donem,
            toplamTutar: apiBicimi(toplam), bolumSayisi: paylar.length,
          },
        });
      }

      return {
        onizlemeMi: onizleme,
        giderTuruKodu: gider.kod,
        donem,
        toplamTutar: apiBicimi(toplam),
        // `moneyKurustan` — Number'a çevirip bölmek FLOAT yuvarlaması yapar
        // ve doğrulama için hesaplanan toplamın kendisi bozulur (ADR-0007).
        dagitilanToplam: apiBicimi(moneyKurustan(dagitilanKurus)),
        bolumSayisi: paylar.length,
        satirlar,
      };
    });
  }
}
