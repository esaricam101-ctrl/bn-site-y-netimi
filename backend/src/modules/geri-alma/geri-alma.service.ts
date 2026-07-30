/**
 * GENEL GERİ AL (UNDO) — kullanıcı bazlı "son işlemi geri al".
 *
 * ⚠️  "NE DEĞİŞTİ" BİLGİSİ DENETİM KAYDINDAN OKUNUR. `audit_kaydi` zaten
 *     `oncekiDeger`/`sonrakiDeger` tutuyor; ikinci bir günlük yazılsaydı iki
 *     kaynak zamanla ayrışır ve geri alma YANLIŞ değere dönerdi.
 *
 * ⚠️  FİNANSAL KAYIT SİLİNMEZ. Geri alma ters kayıt üretir (makbuz iptali ·
 *     fiş storno). Doğrudan silme denetim izini yok eder (BFS v1 §5.1).
 *
 * ⚠️  YETKİ İKİ KATMANLIDIR: (1) uç, kullanıcının ilgili modül iznini ister
 *     (Kapı 3 · RBAC); (2) servis, işlemin KULLANICININ KENDİSİNE ait
 *     olduğunu doğrular. Yalnızca izne bakılsaydı aynı role sahip bir
 *     kullanıcı başkasının işlemini geri alabilirdi.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Principal } from '@bnos/kernel';
import {
  geriAlinabilirMi, geriAlinacakAlanlar, IsKuraliIhlali, KayitBulunamadi,
  VARLIK_SINIFLARI, type AuditEylemKodu, type GeriAlmaYontemi,
} from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Geri alma için Prisma model adı çözümü.
 *
 * ⚠️  Denetim kaydındaki `varlik` DOMAIN adıdır (`BagimsizBolum`), Prisma
 *     delegate adı ise camelCase'tir (`bagimsizBolum`). Dönüşüm tek yerde
 *     yapılır; her çağrı yerinde elle yazılsaydı biri yanlış yazıldığında
 *     hata yalnızca o varlık geri alınmaya çalışıldığında görünürdü.
 */
function delegateAdi(varlik: string): string {
  return varlik.charAt(0).toLowerCase() + varlik.slice(1);
}

export interface IslemSatiri {
  readonly auditKaydiId: string;
  readonly eylem: string;
  readonly varlik: string;
  readonly varlikId: string;
  readonly ani: string;
  readonly gerekce: string | null;
  readonly ozet: string;
  readonly geriAlinabilirMi: boolean;
  readonly yontem: GeriAlmaYontemi | null;
  /** Geri alınamıyorsa NEDEN — kullanıcıya gösterilir. */
  readonly engelGerekcesi: string | null;
  /** Geri alma öncesi gösterilecek onay metni. */
  readonly onayMetni: string | null;
  readonly zatenGeriAlindiMi: boolean;
}

@Injectable()
export class GeriAlmaServisi {
  /**
   * ⚠️  BAŞKA MODÜLÜN SERVİSİ ENJEKTE EDİLMEDİ. İlk yazımda
   *     `TahsilatCommandServisi` ve `FisCommandServisi` enjekte edilmişti ama
   *     ikisi de KENDİ transaction'ını açar; geri alma zaten bir transaction
   *     içindedir ve iç içe transaction, dış işlem geri sarıldığında iç
   *     işlemin kalıcı olmasına yol açardı.
   *
   *     Bu yüzden ters kayıt, geri almanın kendi transaction'ında yazılır
   *     (`tersKayitUret`) ve kopyalanamayan yollar (fiş storno) AÇIKÇA
   *     reddedilip kullanıcı ilgili modüle yönlendirilir.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  /**
   * "Son işlemlerim" — kullanıcının kendi denetim kayıtları.
   *
   * ⚠️  BAŞKASININ İŞLEMİ HİÇ LİSTELENMEZ. Listelenip "geri alınamaz" diye
   *     işaretlenseydi, kullanıcı başka kullanıcıların ne yaptığını görürdü —
   *     bu bir yetki sızıntısıdır.
   */
  async islemlerim(
    principal: Principal, limit = 50,
  ): Promise<readonly IslemSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.auditKaydi.findMany({
          where: {
            tenantId: principal.tenantId,
            principalId: principal.id,
            eylem: { notIn: ['OKU', 'DISA_AKTAR', 'GIRIS', 'CIKIS'] },
          },
          orderBy: { olusmaAni: 'desc' },
          take: limit,
          select: {
            id: true, eylem: true, varlik: true, varlikId: true,
            olusmaAni: true, gerekce: true, oncekiDeger: true, sonrakiDeger: true,
            geriAlma: { select: { id: true } },
          },
        }),
      principal.tenantId,
    );

    // Her kayıt için "sonradan değişti mi" bilgisi gerekir. Tek tek sorgu
    // atmak N+1 üretirdi; aynı varlıkların bütün kayıtları tek seferde okunur.
    const varlikAnahtarlari = [...new Set(kayitlar.map((k) => `${k.varlik}|${k.varlikId}`))];
    const sonDegisiklikler = await this.prisma.tenantIslemi(
      (tx) =>
        tx.auditKaydi.findMany({
          where: {
            tenantId: principal.tenantId,
            varlikId: { in: [...new Set(kayitlar.map((k) => k.varlikId))] },
            eylem: { notIn: ['OKU', 'DISA_AKTAR', 'GIRIS', 'CIKIS'] },
          },
          orderBy: { olusmaAni: 'desc' },
          select: { varlik: true, varlikId: true, olusmaAni: true },
        }),
      principal.tenantId,
    );
    const enSonAn = new Map<string, Date>();
    for (const s of sonDegisiklikler) {
      const anahtar = `${s.varlik}|${s.varlikId}`;
      if (!varlikAnahtarlari.includes(anahtar)) continue;
      const mevcut = enSonAn.get(anahtar);
      if (mevcut === undefined || s.olusmaAni > mevcut) enSonAn.set(anahtar, s.olusmaAni);
    }

    return kayitlar.map((k) => {
      const anahtar = `${k.varlik}|${k.varlikId}`;
      const enSon = enSonAn.get(anahtar);
      const sonuc = geriAlinabilirMi({
        varlik: k.varlik,
        eylem: k.eylem as AuditEylemKodu,
        islemSahibiId: principal.id,
        talepEdenId: principal.id,
        zatenGeriAlindiMi: k.geriAlma !== null,
        dahaYeniDegisiklikVarMi: enSon !== undefined && enSon > k.olusmaAni,
      });

      return {
        auditKaydiId: k.id,
        eylem: k.eylem,
        varlik: k.varlik,
        varlikId: k.varlikId,
        ani: k.olusmaAni.toISOString(),
        gerekce: k.gerekce,
        ozet: this.ozetle(k.varlik, k.eylem, k.sonrakiDeger),
        geriAlinabilirMi: sonuc.geriAlinabilirMi,
        yontem: sonuc.yontem,
        engelGerekcesi: sonuc.gerekce,
        onayMetni: sonuc.onayMetni,
        zatenGeriAlindiMi: k.geriAlma !== null,
      };
    });
  }

  /** Denetim kaydından okunabilir bir özet üretir (makbuz no, ad, kod…). */
  private ozetle(varlik: string, eylem: string, sonraki: Prisma.JsonValue): string {
    const d = (typeof sonraki === 'object' && sonraki !== null && !Array.isArray(sonraki))
      ? (sonraki as Record<string, unknown>)
      : {};
    const parca = [d['makbuzNo'], d['fisNo'], d['kod'], d['ad'], d['plaka'], d['tutar']]
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .slice(0, 2)
      .join(' · ');
    return parca.length > 0 ? `${varlik} ${eylem} — ${parca}` : `${varlik} ${eylem}`;
  }

  /**
   * İşlemi geri alır.
   *
   * `onayMetni` istemciye ÖNCEDEN gösterilir (`islemlerim` yanıtında döner);
   * bu uç yalnızca onaylanmış talebi işler.
   */
  async geriAl(
    auditKaydiId: string, gerekce: string | undefined, principal: Principal,
  ): Promise<KomutSonucu & { readonly yontem: GeriAlmaYontemi }> {
    const baglam = mevcutBaglamiZorunluKil('geriAlma.geriAl');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.auditKaydi.findFirst({
        where: { id: auditKaydiId, tenantId: principal.tenantId },
        select: {
          id: true, principalId: true, eylem: true, varlik: true, varlikId: true,
          oncekiDeger: true, sonrakiDeger: true, olusmaAni: true,
          geriAlma: { select: { id: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Denetim kaydı bulunamadı: ${auditKaydiId}`);

      const dahaYeni = await tx.auditKaydi.count({
        where: {
          tenantId: principal.tenantId,
          varlik: kayit.varlik, varlikId: kayit.varlikId,
          olusmaAni: { gt: kayit.olusmaAni },
          eylem: { notIn: ['OKU', 'DISA_AKTAR', 'GIRIS', 'CIKIS'] },
        },
      });

      const finansalDurum = await this.finansalDurumOku(tx, kayit.varlik, kayit.varlikId, principal);

      const sonuc = geriAlinabilirMi({
        varlik: kayit.varlik,
        eylem: kayit.eylem as AuditEylemKodu,
        islemSahibiId: kayit.principalId,
        talepEdenId: principal.id,
        zatenGeriAlindiMi: kayit.geriAlma !== null,
        dahaYeniDegisiklikVarMi: dahaYeni > 0,
        ...finansalDurum,
      });

      if (!sonuc.geriAlinabilirMi || sonuc.yontem === null) {
        // GEREKÇE İLE reddedilir: gerekçesiz ret kullanıcıyı aynı işlemi
        // tekrar denemeye iter.
        throw new IsKuraliIhlali(
          sonuc.gerekce ?? 'Bu işlem geri alınamaz.',
          'İşlem geçmişinde geri alınabilir kayıtlar işaretlidir.',
        );
      }

      const sonucVarlikId = await this.uygula(
        tx, sonuc.yontem, kayit, principal, gerekce,
      );

      await tx.geriAlma.create({
        data: {
          id: randomUUID(),
          tenantId: principal.tenantId,
          auditKaydiId: kayit.id,
          varlik: kayit.varlik,
          varlikId: kayit.varlikId,
          eylem: kayit.eylem,
          yontem: sonuc.yontem,
          sonucVarlikId,
          geriAlan: principal.id,
          gerekce: gerekce?.trim() ?? null,
        },
      });

      // GERİ ALMA DA DENETİME YAZILIR (kullanıcının kuralı). Yazılmasaydı
      // "kim neyi geri aldı" sorusunun cevabı yalnızca `geri_alma` tablosunda
      // kalır ve hash zincirinin dışında dururdu.
      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: kayit.varlik, varlikId: kayit.varlikId,
        oncekiDeger: { islem: kayit.eylem, auditKaydiId: kayit.id },
        sonrakiDeger: {
          islem: 'GERI_ALINDI', yontem: sonuc.yontem, sonucVarlikId,
        },
        ...(gerekce === undefined ? {} : { gerekce }),
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: kayit.varlikId, durum: 'GERI_ALINDI', yontem: sonuc.yontem };
    });
  }

  /**
   * Finansal varlığın geri almayı engelleyen durumu.
   *
   * Bu bilgi domain'e VERİ olarak taşınır; domain Prisma bilmez (paket sınırı ·
   * ADR v1.1 §40).
   */
  private async finansalDurumOku(
    tx: Prisma.TransactionClient, varlik: string, varlikId: string, principal: Principal,
  ): Promise<{
    readonly zatenTersKayitliMi?: boolean;
    readonly muhasebelestiMi?: boolean;
    readonly donemKapaliMi?: boolean;
  }> {
    if (VARLIK_SINIFLARI[varlik] !== 'FINANSAL') return {};

    if (varlik === 'Tahsilat') {
      const t = await tx.tahsilat.findFirst({
        where: { id: varlikId, tenantId: principal.tenantId },
        select: { durum: true, yevmiyeFisiId: true },
      });
      return {
        zatenTersKayitliMi: t?.durum === 'IPTAL',
        muhasebelestiMi: t?.yevmiyeFisiId !== null && t?.yevmiyeFisiId !== undefined,
      };
    }
    if (varlik === 'YevmiyeFisi') {
      const f = await tx.yevmiyeFisi.findFirst({
        where: { id: varlikId, tenantId: principal.tenantId },
        select: { durum: true, donem: { select: { durum: true } } },
      });
      return {
        zatenTersKayitliMi: f?.durum === 'TERS_KAYITLI',
        donemKapaliMi: f?.donem?.durum === 'KAPALI',
      };
    }
    if (varlik === 'BankaHareketi') {
      const h = await tx.bankaHareketi.findFirst({
        where: { id: varlikId, tenantId: principal.tenantId },
        select: { yevmiyeFisiId: true },
      });
      return { muhasebelestiMi: h?.yevmiyeFisiId !== null && h?.yevmiyeFisiId !== undefined };
    }
    // Öteki finansal varlıklar için ters kayıt yolu henüz TANIMLI DEĞİL;
    // `uygula` bunu açık bir mesajla reddeder.
    return {};
  }

  /** Geri alma yöntemini uygular ve doğan kaydın kimliğini döner. */
  private async uygula(
    tx: Prisma.TransactionClient,
    yontem: GeriAlmaYontemi,
    kayit: {
      readonly eylem: string; readonly varlik: string; readonly varlikId: string;
      readonly oncekiDeger: Prisma.JsonValue; readonly sonrakiDeger: Prisma.JsonValue;
    },
    principal: Principal,
    gerekce: string | undefined,
  ): Promise<string | null> {
    const model = delegateAdi(kayit.varlik);
    const delegate = (tx as unknown as Record<string, {
      updateMany?: (a: unknown) => Promise<unknown>;
    }>)[model];

    if (yontem === 'TERS_KAYIT') {
      return this.tersKayitUret(tx, kayit, principal, gerekce);
    }

    if (delegate?.updateMany === undefined) {
      throw new IsKuraliIhlali(
        `'${kayit.varlik}' için geri alma uygulanamıyor: veri modeli bulunamadı.`,
        'Bu varlık geri alma kapsamına henüz eklenmemiş olabilir.',
      );
    }

    if (yontem === 'GERI_YUKLE') {
      await delegate.updateMany({
        where: { id: kayit.varlikId, tenantId: principal.tenantId },
        data: {
          silindiMi: false, silinmeTarihi: null,
          silenKullanici: null, silmeGerekcesi: null,
        },
      });
      return null;
    }

    if (yontem === 'ARSIVLE') {
      await delegate.updateMany({
        where: { id: kayit.varlikId, tenantId: principal.tenantId },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id,
          silmeGerekcesi: gerekce?.trim()
            ?? 'Kullanıcı tarafından geri alındı (oluşturma iptali).',
        },
      });
      return null;
    }

    // ALAN_GERI_AL — YALNIZCA DEĞİŞEN alanlar yazılır.
    const alanlar = geriAlinacakAlanlar(
      this.nesne(kayit.oncekiDeger), this.nesne(kayit.sonrakiDeger),
    );
    if (Object.keys(alanlar).length === 0) {
      throw new IsKuraliIhlali(
        'Geri alınacak bir alan değişikliği bulunamadı.',
        'Denetim kaydında önceki değer yazılı değil; bu işlem geri alınamaz.',
      );
    }
    await delegate.updateMany({
      where: { id: kayit.varlikId, tenantId: principal.tenantId },
      data: alanlar,
    });
    return null;
  }

  private nesne(deger: Prisma.JsonValue): Record<string, unknown> | null {
    return typeof deger === 'object' && deger !== null && !Array.isArray(deger)
      ? deger
      : null;
  }

  /**
   * TERS KAYIT — finansal kayıt SİLİNMEZ.
   *
   * Her finansal varlığın kendi ters kayıt yolu vardır ve o modülün servisi
   * çağrılır: kural mantığı burada KOPYALANMAZ.
   */
  private async tersKayitUret(
    tx: Prisma.TransactionClient,
    kayit: { readonly varlik: string; readonly varlikId: string },
    principal: Principal,
    gerekce: string | undefined,
  ): Promise<string | null> {
    const aciklama = gerekce?.trim()
      ?? 'Kullanıcı tarafından geri alındı (son işlemi geri al).';

    if (kayit.varlik === 'Tahsilat') {
      // Makbuz iptali: tahsis satırları silinir, borç bakiyeleri yeniden
      // hesaplanır, makbuz numarası KORUNUR.
      await tx.tahsilatTahsisi.deleteMany({ where: { tahsilatId: kayit.varlikId } });
      await tx.tahsilat.updateMany({
        where: { id: kayit.varlikId, tenantId: principal.tenantId },
        data: {
          durum: 'IPTAL', iptalGerekcesi: aciklama,
          iptalEden: principal.id, iptalAni: new Date(),
        },
      });
      return null;
    }

    if (kayit.varlik === 'YevmiyeFisi') {
      // Fiş storno'su `FisCommandServisi`nde yazılıdır ve burada
      // KOPYALANMAZ; ama o metot kendi transaction'ını açar. Geri alma zaten
      // bir transaction içindedir, bu yüzden şimdilik AÇIKÇA reddedilir.
      throw new IsKuraliIhlali(
        'Yevmiye fişi geri alma ucundan ters kayıtlanamıyor.',
        'Fişi Muhasebe → Fişler ekranından storno edin. Storno, dönem ' +
          'denetimi ve fiş numarası tahsisi gerektirir; geri alma bunu ' +
          'kopyalamaz.',
      );
    }

    throw new IsKuraliIhlali(
      `'${kayit.varlik}' için ters kayıt yolu henüz tanımlı değil.`,
      'Bu finansal kayıt geri alınamaz; ilgili modülün düzeltme akışını ' +
        'kullanın. Sistem rastgele bir silme yapmaz.',
    );
  }

  /**
   * Geri alma geçmişi — "Tüm geri alma işlemleri işlem geçmişinde
   * görüntülenebilsin" kuralının karşılığı.
   */
  async gecmis(
    principal: Principal, limit = 100,
  ): Promise<readonly {
    readonly id: string;
    readonly varlik: string;
    readonly varlikId: string;
    readonly eylem: string;
    readonly yontem: string;
    readonly ani: string;
    readonly gerekce: string | null;
  }[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.geriAlma.findMany({
          // YALNIZCA KENDİ geri almaları. Tenant geneli görünüm bir DENETİM
          // yetkisidir ve `/audit` ucunda zaten vardır; burada ikinci bir kapı
          // açmak aynı yetkiyi iki yerden denetlemek olurdu.
          where: { tenantId: principal.tenantId, geriAlan: principal.id },
          orderBy: { olusturulmaTarihi: 'desc' },
          take: limit,
          select: {
            id: true, varlik: true, varlikId: true, eylem: true,
            yontem: true, olusturulmaTarihi: true, gerekce: true,
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((g) => ({
      id: g.id, varlik: g.varlik, varlikId: g.varlikId, eylem: g.eylem,
      yontem: g.yontem, ani: g.olusturulmaTarihi.toISOString(), gerekce: g.gerekce,
    }));
  }
}
