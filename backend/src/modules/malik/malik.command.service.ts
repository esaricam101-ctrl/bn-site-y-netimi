/**
 * Malik Command servisi — hisseli mülkiyet (634 sayılı KMK · ADR v1.1 §5).
 *
 * KAYIT SİLİNMEZ. Devir olduğunda `tapuBitis` verilir ve dönem kapanır;
 * geçmiş malik tarihçede kalır. Borç sorumluluğu borcun oluştuğu anda çözülüp
 * yazılır (snapshot) — geçmiş tapu kaydını silmek o borcun dayanağını yok eder.
 *
 * HİSSE İNVARYANTI — iki yönlü değildir:
 *   Toplam > 1  → HER ZAMAN hatadır; aynı pay iki kişiye yazılmış demektir.
 *                 Yazma anında reddedilir.
 *   Toplam < 1  → EKSİK kayıttır, hata değil: malikler tek tek girilirken
 *                 toplam doğal olarak 1'in altındadır. Tahakkuk öncesi
 *                 `hisseleriZorunluKil` ile zorlanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal, type TenantId,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { kesirleriTopla, tarihtekiMalikler, type MalikHissesi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { TenantOkuyucu } from '../../common/prisma/tenant.reader';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import {
  kisiyiCoz, plakalariYaz, type HizliKayitSonucu,
} from '../../common/kayit/hizli-kayit';
import {
  dayanakSakinleriniCikar, type OtomatikCikisSonucu,
} from '../../common/kayit/sakin-otomatik-cikis';
import type { MalikDuzeltDto, MalikEkleDto } from './dto/malik.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Devir sonucu — kaç sakinin otomatik çıkarıldığını TAŞIR.
 *
 * ⚠️  Sayı yanıta konmasaydı kullanıcı üç kişiyi de sessizce listeden düşürmüş
 *     olurdu; "neden daire boş göründü" sorusunun cevabı ekranda olmazdı.
 */
export interface DevirSonucu extends KomutSonucu {
  readonly sakinCikisi: OtomatikCikisSonucu;
}

@Injectable()
export class MalikCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
    /*
     * KAPSAM ONBELLEGI GECERSIZLESTIRME (ADR-0011).
     *
     * Bu servis ILISKI DONEMINI degistirir; kapsam listesi o donemden
     * turetilir. Onbellek silinmezse tahliye edilmis kiraci ya da
     * devretmis malik dairesini TTL suresince (5 dk) gormeye devam eder.
     */
    private readonly okuyucu: TenantOkuyucu,
  ) {}

  async ekle(
    bolumId: string, dto: MalikEkleDto, principal: Principal,
  ): Promise<HizliKayitSonucu> {
    const baglam = mevcutBaglamiZorunluKil('malik.ekle');
    const id = randomUUID();

    const hissePay = BigInt(dto.hissePay);
    const hissePayda = BigInt(dto.hissePayda);
    const baslangic = takvimTarihi(dto.tapuBaslangic);
    const bitis = dto.tapuBitis === undefined ? null : takvimTarihi(dto.tapuBitis);

    if (hissePayda <= 0n) {
      throw new IsKuraliIhlali('Hisse paydası sıfırdan büyük olmalıdır.');
    }
    if (hissePay <= 0n || hissePay > hissePayda) {
      throw new IsKuraliIhlali(
        `Hisse geçerli bir kesir olmalıdır: ${hissePay}/${hissePayda}.`,
        'Payı 0 ile payda arasında verin.',
      );
    }
    if (bitis !== null && bitis < baslangic) {
      throw new IsKuraliIhlali(
        `Tapu bitiş tarihi (${bitis}) başlangıçtan (${baslangic}) önce olamaz.`,
      );
    }
    // Vekalet ya tumuyle vardir ya hic — yarim kayit vekilin yetkisini belirsiz
    // birakir. Ayni kisit veritabaninda da CHECK olarak durur.
    if ((dto.vekilKisiId === undefined) !== (dto.vekaletnameNo === undefined)) {
      throw new IsKuraliIhlali(
        'Vekil bilgisi eksik: vekil kişi ve vekâletname numarası birlikte verilmelidir.',
        'Ya ikisini de girin ya da ikisini de boş bırakın.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      // Kişi ya seçilir ya bu bilgilerden oluşturulur. `kisiyiCoz` tenant
      // aidiyetini de doğrular — FK kontrolü RLS'i baypas eder.
      const cozum = await kisiyiCoz(tx, principal.tenantId, {
        ...(dto.kisi ?? {}),
        ...(dto.kisiId === undefined ? {} : { kisiId: dto.kisiId }),
      });
      const kisiId = cozum.kisiId;

      if (dto.vekilKisiId !== undefined) {
        const vekil = await tx.kisi.findFirst({
          where: { id: dto.vekilKisiId, tenantId: principal.tenantId }, select: { id: true },
        });
        if (!vekil) throw new KayitBulunamadi(`Vekil kişi bulunamadı: ${dto.vekilKisiId}`);
      }

      const mevcutKayitlar = await tx.malik.findMany({
        where: { tenantId: principal.tenantId, bolumId },
        select: { kisiId: true, hissePay: true, hissePayda: true, tapuBaslangic: true, tapuBitis: true },
      });

      const mevcut: MalikHissesi[] = mevcutKayitlar.map((m) => ({
        kisiId: m.kisiId,
        hissePay: m.hissePay,
        hissePayda: m.hissePayda,
        baslangic: takvimTarihiniOku(m.tapuBaslangic),
        bitis: takvimTarihiniOkuVeyaNull(m.tapuBitis),
      }));

      const yeni: MalikHissesi = { kisiId, hissePay, hissePayda, baslangic, bitis };

      // Toplamin 1'i ASMASI her zaman hatadir. Baslangic gununde bakmak yeterli:
      // cakisma varsa o gun zaten gorunur.
      const oGunGecerli = [...tarihtekiMalikler(mevcut, baslangic), yeni];
      const toplam = kesirleriTopla(
        oGunGecerli.map((m) => ({ pay: m.hissePay, payda: m.hissePayda })),
      );
      if (toplam.pay > toplam.payda) {
        const oran = (Number(toplam.pay) / Number(toplam.payda)).toFixed(6);
        throw new IsKuraliIhlali(
          `'${bolum.kapiNo}' bölümünde ${baslangic} tarihli hisse toplamı ${oran} olur; 1'i aşamaz.`,
          'Önce devreden malikin tapu dönemini kapatın, sonra yenisini ekleyin.',
        );
      }

      await tx.malik.create({
        data: {
          id, tenantId: principal.tenantId, bolumId, kisiId,
          hissePay, hissePayda,
          tapuTuru: dto.tapuTuru ?? 'KAT_MULKIYETI',
          tapuBaslangic: takvimTarihiniYaz(baslangic),
          tapuBitis: bitis === null ? null : takvimTarihiniYaz(bitis),
          tapuYevmiyeNo: dto.tapuYevmiyeNo ?? null,
          vekilKisiId: dto.vekilKisiId ?? null,
          vekaletnameNo: dto.vekaletnameNo ?? null,
          vekaletBitisTarihi:
            dto.vekaletBitisTarihi === undefined
              ? null
              : takvimTarihiniYaz(takvimTarihi(dto.vekaletBitisTarihi)),
        },
      });

      // Plakalar AYNI İŞLEMDE yazılır: hata verirse malik kaydı da geri
      // alınır. Yarım kayıt, "plakayı da girdim" sanan kullanıcı için
      // sessiz veri kaybıdır.
      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId,
        sahip: { kisiId },
        baslangic,
        bitis,
        plakalar: dto.kisi?.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Malik', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId,
          kisiOlusturulduMu: cozum.olusturulduMu,
          // BigInt JSON'a serilestirilemez; denetim kaydinda metin tutulur.
          hisse: `${hissePay}/${hissePayda}`,
          tapuBaslangic: baslangic, tapuBitis: bitis,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.malik.eklendi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Malik', id, version: 1 },
        payload: { bolumId, kisiId, hisse: `${hissePay}/${hissePayda}` },
      });

      // Yeni ilişki kapsamı GENİŞLETİR; önbellek eski dar listeyi tutmamalı.
      await this.kapsamiTazele(principal.tenantId, kisiId);
      return {
        id,
        durum: 'AKTIF',
        kisiId,
        kisiOlusturulduMu: cozum.olusturulduMu,
        tcIleEslestiMi: cozum.tcIleEslestiMi,
        plakaSayisi: plakalar.length,
      };
    });
  }

  /**
   * Yazım hatası ve vekâlet düzeltmesi. HİSSE ORANI DEĞİŞTİRİLEMEZ.
   *
   * Hisse değişikliği bir devirdir: eski oran bir döneme, yeni oran başka bir
   * döneme aittir. Kaydı yerinde güncellemek geçmiş tahakkukların dayanağını
   * sessizce değiştirir. Doğru akış: `devret` ile kapat, yeni oranla yeni kayıt.
   */
  async duzelt(
    bolumId: string,
    malikId: string,
    dto: MalikDuzeltDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('malik.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.malik.findFirst({
        where: { id: malikId, bolumId, tenantId: principal.tenantId },
        select: {
          // `kisiId` KAPSAM GEÇERSİZLEŞTİRME için gerekir: hangi kişinin
          // önbelleği silinecek onunla belirlenir.
          id: true, kisiId: true, tapuTuru: true, tapuYevmiyeNo: true,
          vekilKisiId: true, vekaletnameNo: true, vekaletBitisTarihi: true,
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Malik kaydı bulunamadı: ${malikId}`);

      // Vekalet ya tumuyle vardir ya hic. Sonuc durumuna bakilir: mevcut kayit
      // ile gelen degerler birlestirildikten SONRA butun olmali.
      const sonVekil = dto.vekilKisiId ?? kayit.vekilKisiId;
      const sonVekaletname = dto.vekaletnameNo ?? kayit.vekaletnameNo;
      if ((sonVekil === null) !== (sonVekaletname === null)) {
        throw new IsKuraliIhlali(
          'Vekil bilgisi eksik kalıyor: vekil kişi ve vekâletname numarası birlikte bulunmalıdır.',
          'Ya ikisini de doldurun ya da ikisini de boşaltın.',
        );
      }

      if (dto.vekilKisiId !== undefined) {
        const vekil = await tx.kisi.findFirst({
          where: { id: dto.vekilKisiId, tenantId: principal.tenantId }, select: { id: true },
        });
        if (!vekil) throw new KayitBulunamadi(`Vekil kişi bulunamadı: ${dto.vekilKisiId}`);
      }

      await tx.malik.update({
        where: { id: malikId },
        data: {
          ...(dto.tapuTuru === undefined ? {} : { tapuTuru: dto.tapuTuru }),
          ...(dto.tapuYevmiyeNo === undefined ? {} : { tapuYevmiyeNo: dto.tapuYevmiyeNo }),
          ...(dto.vekilKisiId === undefined ? {} : { vekilKisiId: dto.vekilKisiId }),
          ...(dto.vekaletnameNo === undefined ? {} : { vekaletnameNo: dto.vekaletnameNo }),
          ...(dto.vekaletBitisTarihi === undefined
            ? {}
            : { vekaletBitisTarihi: takvimTarihiniYaz(takvimTarihi(dto.vekaletBitisTarihi)) }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Malik', varlikId: malikId,
        oncekiDeger: {
          tapuTuru: kayit.tapuTuru, tapuYevmiyeNo: kayit.tapuYevmiyeNo,
          vekilKisiId: kayit.vekilKisiId, vekaletnameNo: kayit.vekaletnameNo,
        },
        sonrakiDeger: {
          tapuTuru: dto.tapuTuru ?? kayit.tapuTuru,
          tapuYevmiyeNo: dto.tapuYevmiyeNo ?? kayit.tapuYevmiyeNo,
          vekilKisiId: sonVekil, vekaletnameNo: sonVekaletname,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.kapsamiTazele(principal.tenantId, kayit.kisiId);
      return { id: malikId, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Tapu dönemini kapatır. Kayıt silinmez — tarihçe korunur.
   *
   * ⚠️  MALİKE DAYANAN SAKİNLER DE OTOMATİK ÇIKARILIR. Malik devrolduysa
   *     onun yakınlarının o dairede oturma dayanağı da bitmiştir. Elle
   *     yapılması beklenseydi unutulur, daire kartı ve acil durum listesi
   *     aylarca yanlış kalırdı (bkz. `dayanakSakinleriniCikar`).
   */
  async devret(
    bolumId: string,
    malikId: string,
    tapuBitisMetni: string,
    principal: Principal,
  ): Promise<DevirSonucu> {
    const baglam = mevcutBaglamiZorunluKil('malik.devret');
    const tapuBitis = takvimTarihi(tapuBitisMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.malik.findFirst({
        where: { id: malikId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, tapuBaslangic: true, tapuBitis: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Malik kaydı bulunamadı: ${malikId}`);

      const baslangic = takvimTarihiniOku(kayit.tapuBaslangic);
      if (tapuBitis < baslangic) {
        throw new IsKuraliIhlali(
          `Tapu bitiş tarihi (${tapuBitis}) başlangıçtan (${baslangic}) önce olamaz.`,
        );
      }

      const oncekiBitis = takvimTarihiniOkuVeyaNull(kayit.tapuBitis);

      await tx.malik.update({
        where: { id: malikId },
        data: { tapuBitis: takvimTarihiniYaz(tapuBitis) },
      });

      // Bu malike dayanan sakinler AYNI İŞLEMDE çıkarılır: devir ile
      // sakinlerin çıkışı ya birlikte olur ya hiç olmaz.
      const sakinCikisi = await dayanakSakinleriniCikar(
        tx, this.audit, this.outbox, principal, baglam,
        { bolumId, malikId, cikisTarihi: tapuBitis, sebep: 'malik devri' },
      );

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Malik', varlikId: malikId,
        oncekiDeger: { tapuBitis: oncekiBitis },
        sonrakiDeger: {
          tapuBitis,
          otomatikCikarilanSakin: sakinCikisi.cikarilan,
          cikarilamayanSakin: sakinCikisi.cikarilamayan.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.malik.devredildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Malik', id: malikId, version: 2 },
        payload: {
          bolumId, kisiId: kayit.kisiId, tapuBitis,
          otomatikCikarilanSakin: sakinCikisi.cikarilan,
        },
      });

      await this.kapsamiTazele(principal.tenantId, kayit.kisiId);
      return { id: malikId, durum: 'DEVREDILDI', sakinCikisi };
    });
  }

  /**
   * Kapsam önbelleğini tazeler — ilişki dönemi değiştiğinde ZORUNLU.
   *
   * ⚠️  TRANSACTION DIŞINDA çağrılır: silme başarısız olsa bile domain
   *     yazması geri alınmamalıdır. Silme kaçarsa TTL (5 dk) ağdır ve
   *     `OnbellekServisi.sil` bunu ERROR olarak loglar — sessiz kalmaz.
   */
  private async kapsamiTazele(tenantId: TenantId, kisiId: string): Promise<void> {
    await this.okuyucu.kapsamiGecersizKil(tenantId, kisiId);
  }

}
