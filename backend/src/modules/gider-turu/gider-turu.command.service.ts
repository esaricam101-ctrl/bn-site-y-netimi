/**
 * Gider Türü Command servisi — 634 sayılı KMK md. 20.
 *
 * AİDAT KURALLARI VERİDİR, KODA GÖMÜLMEZ. Bir giderin nasıl paylaştırılacağı
 * ve kime yazılacağı kanunun varsayılanıyla başlar; yönetim planı ya da genel
 * kurul kararı bunu değiştirebilir (KMK md. 20/son: "aksine sözleşme yoksa").
 *
 * Bu yüzden her kayıt `kuralKaynagi` taşır ve varsayılan DIŞINDAKİ her kural
 * `kaynakReferansi` taşımak zorundadır: bir daire sakini "aidatım neden böyle
 * hesaplandı?" diye sorduğunda cevabın belgeye dayanması gerekir. Referanssız
 * bir override, itiraz halinde savunulamaz.
 *
 * Doğrulama domain katmanında (`giderTuruDogrula`) yapılır — aynı kural hem
 * API'de hem tahakkukta geçerlidir ve iki yerde ayrı yazılmaz.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { giderTuruDogrula, type GiderTuru } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type {
  GiderTuruGuncelleDto, GiderTuruOlusturDto, KarmaBilesenDto,
} from './dto/gider-turu.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/** Prisma'nın JSON sütunundan okunan bileşenleri domain şekline çevirir. */
function bilesenler(ham: unknown): readonly { kural: string; yuzde: number }[] | undefined {
  if (!Array.isArray(ham)) return undefined;
  return ham as { kural: string; yuzde: number }[];
}

/**
 * DTO örneklerini düz nesneye çevirir.
 *
 * Doğrudan yazmak `class-transformer` örneğini JSON'a serileştirir; sınıf
 * alanları dışında bir şey taşımasa bile tip düzeyinde `InputJsonValue`
 * değildir. Alanları AÇIKÇA seçmek, DTO'ya ileride eklenen bir alanın
 * sessizce veritabanına sızmasını da engeller.
 */
function bilesenleriJson(
  liste: readonly KarmaBilesenDto[],
): Prisma.InputJsonValue {
  return liste.map((b) => ({ kural: b.kural, yuzde: b.yuzde }));
}

@Injectable()
export class GiderTuruCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  /**
   * Domain doğrulaması — API katmanında tekrar YAZILMAZ.
   *
   * `class-validator` yalnızca alan biçimini denetler; "KARMA bileşenlerinin
   * toplamı 100 olmalıdır" gibi kurallar alanlar ARASI ilişkidir ve domain'e
   * aittir. İki yerde yazılsaydı biri güncellenip diğeri unutulurdu.
   */
  private dogrula(aday: GiderTuru): void {
    const hatalar = giderTuruDogrula(aday);
    if (hatalar.length > 0) {
      throw new IsKuraliIhlali(
        hatalar.join(' '),
        'Kural tanımını düzeltip tekrar gönderin.',
      );
    }
  }

  async olustur(dto: GiderTuruOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('gider-turu.olustur');
    const id = randomUUID();
    const kod = dto.kod.trim().toLocaleUpperCase('tr');

    this.dogrula({
      kod, ad: dto.ad.trim(),
      paylasimKurali: dto.paylasimKurali,
      sorumlulukTipi: dto.sorumlulukTipi,
      kuralKaynagi: dto.kuralKaynagi,
      kaynakReferansi: dto.kaynakReferansi?.trim() ?? null,
      ...(dto.karmaBilesenler ? { karmaBilesenler: dto.karmaBilesenler } : {}),
      ...(dto.malikPaylasimi ? { malikPaylasimi: dto.malikPaylasimi } : {}),
    });

    return this.prisma.tenantIslemi(async (tx) => {
      const mevcut = await tx.giderTuru.findFirst({
        where: { tenantId: principal.tenantId, kod },
        select: { id: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `'${kod}' kodlu gider türü zaten tanımlı.`,
          'Var olan türü düzenleyin ya da farklı bir kod kullanın.',
        );
      }

      /*
       * MUHASEBE KARŞILIĞI ZORUNLUDUR (ADR-0017 · K1).
       *
       * ⚠️  HESAP DOĞRULANIR, GÜVENİLMEZ. Yabancı anahtar başka tenant'ın
       *     hesabını engellemez — `hesap.id` genel benzersizdir ve FK tenant
       *     bilmez. Doğrulanmasaydı bir projenin tahakkuku BAŞKA bir projenin
       *     hesabına yazılabilirdi.
       */
      const hesap = await tx.hesap.findFirst({
        where: {
          id: dto.muhasebeHesapId, tenantId: principal.tenantId,
          aktif: true, silinmeTarihi: null,
        },
        select: { id: true },
      });
      if (!hesap) {
        throw new IsKuraliIhlali(
          'Seçilen muhasebe hesabı bulunamadı.',
          'Tahakkuk fişinin alacak tarafı bu hesaba yazılır; hesap planından ' +
            'aktif bir hesap seçin.',
        );
      }

      await tx.giderTuru.create({
        data: {
          id, tenantId: principal.tenantId, kod, ad: dto.ad.trim(),
          muhasebeHesapId: dto.muhasebeHesapId,
          paylasimKurali: dto.paylasimKurali,
          sorumlulukTipi: dto.sorumlulukTipi,
          kuralKaynagi: dto.kuralKaynagi,
          kaynakReferansi: dto.kaynakReferansi?.trim() ?? null,
          // KARMA disinda NULL olmak ZORUNDA (veritabani kisiti
          // `gider_turu_karma_butun`): bos dizi de kisiti ihlal eder.
          karmaBilesenler:
            dto.paylasimKurali === 'KARMA'
              ? bilesenleriJson(dto.karmaBilesenler ?? [])
              : Prisma.DbNull,
          malikPaylasimi: dto.malikPaylasimi ?? 'HISSE_ORANI',
          aktifMi: dto.aktifMi ?? true,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'GiderTuru', varlikId: id,
        sonrakiDeger: {
          kod, ad: dto.ad, paylasimKurali: dto.paylasimKurali,
          sorumlulukTipi: dto.sorumlulukTipi, kuralKaynagi: dto.kuralKaynagi,
          kaynakReferansi: dto.kaynakReferansi ?? null,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.gider_turu.tanimlandi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'GiderTuru', id, version: 1 },
        payload: { kod, paylasimKurali: dto.paylasimKurali, sorumlulukTipi: dto.sorumlulukTipi },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /**
   * Kural değişikliği. `kod` DEĞİŞTİRİLEMEZ — geçmiş tahakkuklar bu kodla
   * ilişkilendirilir.
   *
   * DİKKAT: kural değişikliği GEÇMİŞE ETKİ ETMEZ. Yapılmış tahakkuklar
   * hesaplandıkları andaki kuralla kalır; aksi halde kapanmış bir dönemin
   * borçları kendiliğinden değişir ve tahsil edilmiş tutarlarla tutmaz.
   */
  async guncelle(
    id: string,
    dto: GiderTuruGuncelleDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('gider-turu.guncelle');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.giderTuru.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Gider türü bulunamadı: ${id}`);

      const yeniKural = dto.paylasimKurali ?? kayit.paylasimKurali;
      const yeniKarma =
        dto.karmaBilesenler ?? (bilesenler(kayit.karmaBilesenler) as KarmaBilesenDto[] | undefined);

      this.dogrula({
        kod: kayit.kod,
        ad: dto.ad?.trim() ?? kayit.ad,
        paylasimKurali: yeniKural,
        sorumlulukTipi: dto.sorumlulukTipi ?? kayit.sorumlulukTipi,
        kuralKaynagi: dto.kuralKaynagi ?? kayit.kuralKaynagi,
        kaynakReferansi: dto.kaynakReferansi?.trim() ?? kayit.kaynakReferansi,
        ...(yeniKural === 'KARMA' && yeniKarma ? { karmaBilesenler: yeniKarma } : {}),
        malikPaylasimi:
          (dto.malikPaylasimi ?? kayit.malikPaylasimi) as GiderTuru['malikPaylasimi'],
      });

      await tx.giderTuru.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.paylasimKurali === undefined ? {} : { paylasimKurali: dto.paylasimKurali }),
          ...(dto.sorumlulukTipi === undefined ? {} : { sorumlulukTipi: dto.sorumlulukTipi }),
          ...(dto.kuralKaynagi === undefined ? {} : { kuralKaynagi: dto.kuralKaynagi }),
          ...(dto.kaynakReferansi === undefined
            ? {}
            : { kaynakReferansi: dto.kaynakReferansi.trim() }),
          ...(dto.malikPaylasimi === undefined ? {} : { malikPaylasimi: dto.malikPaylasimi }),
          ...(dto.aktifMi === undefined ? {} : { aktifMi: dto.aktifMi }),
          // KARMA'dan cikildiginda bilesenler VERITABANI NULL'una cekilir.
          // `Prisma.DbNull` gerekir: JSON sutununda `null` degeri, SQL NULL
          // DEGIL "JSON null" olarak yazilir ve `karma_bilesenler IS NULL`
          // kisiti (`gider_turu_karma_butun`) ihlal edilmis sayilir.
          karmaBilesenler:
            yeniKural === 'KARMA'
              ? bilesenleriJson(yeniKarma ?? [])
              : Prisma.DbNull,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'GiderTuru', varlikId: id,
        oncekiDeger: {
          ad: kayit.ad, paylasimKurali: kayit.paylasimKurali,
          sorumlulukTipi: kayit.sorumlulukTipi, kuralKaynagi: kayit.kuralKaynagi,
          kaynakReferansi: kayit.kaynakReferansi, aktifMi: kayit.aktifMi,
        },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad, paylasimKurali: yeniKural,
          sorumlulukTipi: dto.sorumlulukTipi ?? kayit.sorumlulukTipi,
          kuralKaynagi: dto.kuralKaynagi ?? kayit.kuralKaynagi,
          kaynakReferansi: dto.kaynakReferansi ?? kayit.kaynakReferansi,
          aktifMi: dto.aktifMi ?? kayit.aktifMi,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.gider_turu.degistirildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'GiderTuru', id, version: 2 },
        payload: { kod: kayit.kod, paylasimKurali: yeniKural },
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('gider-turu.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.giderTuru.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, kod: true, ad: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Gider türü bulunamadı: ${id}`);

      silmeyiDogrula(
        { varlik: 'GiderTuru', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      await tx.giderTuru.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
          // Silinen tur tahakkuk ekraninda SECILEMEZ olmalidir; yalnizca
          // soft-delete bayragina guvenmek, aktif listelerin baska bir
          // filtreyle olusturuldugu yerde kaydin gorunmeye devam etmesine
          // yol acardi.
          aktifMi: false,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'GiderTuru', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
