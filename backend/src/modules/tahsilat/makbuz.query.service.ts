/**
 * Makbuz ve CARİ EKSTRE — sorgu tarafı (CQRS).
 *
 * "Makbuz Geçmişi", "Tahsilat Makbuzu detayı" ve "Cari Hesap Ekstresi" AYNI
 * VERİNİN üç görünümüdür; üç ayrı servis yazılsaydı bakiye hesabı üç kez
 * tekrar eder ve biri güncellenmediğinde üç ekran üç farklı rakam gösterirdi.
 *
 * ⚠️  PARA DECIMAL/Money İLE TOPLANIR. `Number`'a çevirip toplamak float
 *     yuvarlaması yapar ve cari bakiye kuruş sapar (ADR-0007).
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  apiBicimi, money, takvimTarihi, type Principal, type TakvimTarihi,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import {
  alacakYaslandirmasi, cariEkstre, kontrolMutabakati, otomatikTahsis,
  type AcikBorc, type CariEkstreGirdisi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

/** Makbuz listesi satırı — "Makbuz Geçmişi" ekranının kaynağı. */
export interface MakbuzSatiri {
  readonly id: string;
  readonly makbuzNo: string;
  readonly tarih: string;
  readonly kanal: string;
  readonly durum: string;
  readonly tutar: string;
  readonly odeyenAdi: string | null;
  readonly daireler: readonly string[];
  readonly muhasebelestiMi: boolean;
  readonly fisNo: string | null;
  readonly iptalGerekcesi: string | null;
}

/**
 * Tahsilat makbuzu DETAYI — kullanıcının istediği alanların tamamı.
 *
 * Malik · Kiracı · Sakin AYRI alanlardır ve borcun sorumluluk zincirinden
 * gelir (`borc_sorumlusu.rol`), ödeyenden değil: ödeyen komşusu olabilir.
 */
export interface MakbuzDetayi {
  readonly id: string;
  readonly makbuzNo: string;
  readonly tarih: string;
  readonly tahsilatiAlan: string | null;
  readonly odeyenAdi: string | null;
  readonly kanal: string;
  readonly durum: string;
  readonly aciklama: string | null;
  readonly tahsilEdilenTutar: string;
  /** Bu makbuzun kapattığı borçların ARDINDAN kalan toplam borç. */
  readonly kalanBorc: string;
  readonly iptalGerekcesi: string | null;
  readonly iptalAni: string | null;

  /** İLİŞKİLİ MUHASEBE FİŞİ. */
  readonly yevmiyeFisiId: string | null;
  readonly fisNo: string | null;
  /** İLİŞKİLİ BANKA HAREKETİ. */
  readonly bankaHareketiId: string | null;
  readonly bankaAdi: string | null;
  readonly bankaHesabiAdi: string | null;
  /** İLİŞKİLİ KIYMETLİ EVRAK (çek/senet kanalı). */
  readonly evrakNo: string | null;

  readonly kalemler: readonly MakbuzKalemi[];
}

/** Makbuzun bir satırı: hangi daire · hangi borç kalemi · hangi dönem. */
export interface MakbuzKalemi {
  readonly tahsisId: string;
  readonly borcId: string;
  /** İLİŞKİLİ CARİ HESAP — cari, bölümdür (ADR-0010). */
  readonly bolumId: string;
  readonly daire: string;
  readonly borcKalemi: string;
  readonly donem: string;
  readonly vadeTarihi: string;
  readonly borcTutari: string;
  readonly tahsilEdilen: string;
  readonly kalan: string;
  readonly malik: string | null;
  readonly kiraci: string | null;
  readonly sakin: string | null;
  /** Hisseli mülkiyette payına sayılan kişi. */
  readonly sorumluAdi: string | null;
}

export interface CariEkstreDokumu {
  readonly bolumId: string;
  readonly daire: string;
  readonly baslangic: string;
  readonly bitis: string;
  readonly acilisBakiyesi: string;
  readonly satirlar: readonly {
    readonly tip: string;
    readonly tarih: string;
    readonly belgeNo: string;
    readonly aciklama: string;
    readonly tutar: string;
    readonly bakiye: string;
  }[];
  readonly borcToplam: string;
  readonly tahsilatToplam: string;
  readonly kapanisBakiyesi: string;
}

export interface KontrolMutabakatDokumu {
  readonly yardimciDefterToplami: string;
  readonly kontrolHesabiKodu: string | null;
  readonly kontrolHesabiBakiyesi: string;
  readonly fark: string;
  /** ⚠️ Bu alan GİZLENMEZ: `false` ise dönem kapanışı bloke edilmelidir. */
  readonly mutabikMi: boolean;
  readonly bolumSayisi: number;
}

@Injectable()
export class MakbuzQueryServisi {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------------------- Makbuz geçmişi --------------------------- */

  async makbuzlariListele(
    principal: Principal,
    filtre: {
      readonly baslangic?: string;
      readonly bitis?: string;
      readonly kanal?: string;
      readonly durum?: string;
      readonly bolumId?: string;
      readonly kisiId?: string;
      readonly limit?: number;
    } = {},
  ): Promise<readonly MakbuzSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.tahsilat.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(filtre.baslangic === undefined && filtre.bitis === undefined
              ? {}
              : {
                  tahsilatTarihi: {
                    ...(filtre.baslangic === undefined
                      ? {} : { gte: new Date(filtre.baslangic) }),
                    ...(filtre.bitis === undefined
                      ? {} : { lte: new Date(filtre.bitis) }),
                  },
                }),
            ...(filtre.kanal === undefined
              ? {} : { kanal: filtre.kanal as Prisma.EnumTahsilatKanaliFilter }),
            ...(filtre.durum === 'GECERLI' || filtre.durum === 'IPTAL'
              ? { durum: filtre.durum } : {}),
            ...(filtre.bolumId === undefined
              ? {} : { tahsisler: { some: { borc: { bolumId: filtre.bolumId } } } }),
            ...(filtre.kisiId === undefined
              ? {}
              : {
                  OR: [
                    { odeyenKisiId: filtre.kisiId },
                    { tahsisler: { some: { borcSorumlusu: { kisiId: filtre.kisiId } } } },
                  ],
                }),
          },
          orderBy: [{ tahsilatTarihi: 'desc' }, { olusturulmaTarihi: 'desc' }],
          take: filtre.limit ?? 200,
          select: {
            id: true, makbuzNo: true, tahsilatTarihi: true, kanal: true,
            durum: true, tutar: true, yevmiyeFisiId: true, iptalGerekcesi: true,
            odeyenKisi: { select: { ad: true, soyad: true } },
            yevmiyeFisi: { select: { fisNo: true } },
            tahsisler: {
              select: { borc: { select: { bolum: { select: { kapiNo: true } } } } },
            },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((t) => ({
      id: t.id,
      makbuzNo: t.makbuzNo,
      tarih: gun(t.tahsilatTarihi),
      kanal: t.kanal,
      durum: t.durum,
      tutar: t.tutar.toFixed(4),
      odeyenAdi: t.odeyenKisi === null
        ? null
        : `${t.odeyenKisi.ad} ${t.odeyenKisi.soyad}`,
      daireler: [...new Set(t.tahsisler.map((s) => s.borc.bolum.kapiNo))],
      muhasebelestiMi: t.yevmiyeFisiId !== null,
      fisNo: t.yevmiyeFisi?.fisNo ?? null,
      iptalGerekcesi: t.iptalGerekcesi,
    }));
  }

  /* ----------------------------- Makbuz detayı --------------------------- */

  async makbuzDetayi(id: string, principal: Principal): Promise<MakbuzDetayi> {
    const t = await this.prisma.tenantIslemi(
      (tx) =>
        tx.tahsilat.findFirst({
          where: { id, tenantId: principal.tenantId },
          select: {
            id: true, makbuzNo: true, tahsilatTarihi: true, kanal: true,
            durum: true, tutar: true, aciklama: true, tahsilEden: true,
            yevmiyeFisiId: true, bankaHareketiId: true,
            iptalGerekcesi: true, iptalAni: true,
            odeyenKisi: { select: { ad: true, soyad: true } },
            yevmiyeFisi: { select: { fisNo: true } },
            kiymetliEvrak: { select: { evrakNo: true } },
            bankaHareketi: {
              select: {
                bankaHesabi: { select: { ad: true, banka: { select: { ad: true } } } },
              },
            },
            tahsisler: {
              select: {
                id: true, tutar: true, borcId: true,
                borcSorumlusu: {
                  select: { kisi: { select: { ad: true, soyad: true } } },
                },
                borc: {
                  select: {
                    id: true, tutar: true, odenen: true, giderTuruKodu: true,
                    tahakkukDonemi: true, vadeTarihi: true, bolumId: true,
                    bolum: { select: { kapiNo: true } },
                    sorumlular: {
                      select: {
                        rol: true, sira: true,
                        kisi: { select: { ad: true, soyad: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      principal.tenantId,
    );
    if (!t) throw new KayitBulunamadi(`Makbuz bulunamadı: ${id}`);

    // Tahsilatı alan kullanıcının adı ayrı bir sorgu ister; kullanıcı tablosu
    // kişiye bağlıdır.
    const alan = t.tahsilEden === null
      ? null
      : await this.prisma.tenantIslemi(
          (tx) =>
            tx.kullanici.findFirst({
              where: { id: t.tahsilEden ?? '', tenantId: principal.tenantId },
              select: { kisi: { select: { ad: true, soyad: true } } },
            }),
          principal.tenantId,
        );

    // ROL bazlı ad çözümü: Malik · Kiracı · Sakin AYRI alanlardır ve borcun
    // sorumluluk zincirinden gelir — ödeyenden değil.
    const rolAdi = (
      sorumlular: readonly {
        rol: string; kisi: { ad: string; soyad: string };
      }[],
      rol: string,
    ): string | null => {
      const s = sorumlular.find((x) => x.rol === rol);
      return s === undefined ? null : `${s.kisi.ad} ${s.kisi.soyad}`;
    };

    const kalemler: MakbuzKalemi[] = t.tahsisler.map((s) => ({
      tahsisId: s.id,
      borcId: s.borcId,
      bolumId: s.borc.bolumId,
      daire: s.borc.bolum.kapiNo,
      borcKalemi: s.borc.giderTuruKodu,
      donem: gun(s.borc.tahakkukDonemi).slice(0, 7),
      vadeTarihi: gun(s.borc.vadeTarihi),
      borcTutari: s.borc.tutar.toFixed(4),
      tahsilEdilen: s.tutar.toFixed(4),
      kalan: s.borc.tutar.minus(s.borc.odenen).toFixed(4),
      malik: rolAdi(s.borc.sorumlular, 'MALIK'),
      kiraci: rolAdi(s.borc.sorumlular, 'KIRACI'),
      sakin: rolAdi(s.borc.sorumlular, 'SAKIN'),
      sorumluAdi: s.borcSorumlusu === null
        ? null
        : `${s.borcSorumlusu.kisi.ad} ${s.borcSorumlusu.kisi.soyad}`,
    }));

    const kalanToplam = t.tahsisler.reduce(
      (acc, s) => acc.plus(s.borc.tutar.minus(s.borc.odenen)),
      new Prisma.Decimal(0),
    );

    return {
      id: t.id,
      makbuzNo: t.makbuzNo,
      tarih: gun(t.tahsilatTarihi),
      tahsilatiAlan: alan?.kisi === undefined || alan?.kisi === null
        ? null
        : `${alan.kisi.ad} ${alan.kisi.soyad}`,
      odeyenAdi: t.odeyenKisi === null ? null : `${t.odeyenKisi.ad} ${t.odeyenKisi.soyad}`,
      kanal: t.kanal,
      durum: t.durum,
      aciklama: t.aciklama,
      tahsilEdilenTutar: t.tutar.toFixed(4),
      kalanBorc: kalanToplam.toFixed(4),
      iptalGerekcesi: t.iptalGerekcesi,
      iptalAni: t.iptalAni === null ? null : t.iptalAni.toISOString(),
      yevmiyeFisiId: t.yevmiyeFisiId,
      fisNo: t.yevmiyeFisi?.fisNo ?? null,
      bankaHareketiId: t.bankaHareketiId,
      bankaAdi: t.bankaHareketi?.bankaHesabi.banka.ad ?? null,
      bankaHesabiAdi: t.bankaHareketi?.bankaHesabi.ad ?? null,
      evrakNo: t.kiymetliEvrak?.evrakNo ?? null,
      kalemler,
    };
  }

  /* ------------------------------ Açık borçlar --------------------------- */

  /**
   * Bir bölümün AÇIK borçları — "Detaylı Tahsilat Girişi" ekranının kaynağı.
   *
   * Hem borcun kendisi hem de hisseli mülkiyette PAY satırları döner; tahsis
   * ikisinden birine yapılır.
   */
  async acikBorclar(
    bolumId: string, principal: Principal, kisiId?: string,
  ): Promise<readonly {
    readonly borcId: string;
    readonly borcSorumlusuId: string | null;
    readonly sorumluAdi: string | null;
    readonly borcKalemi: string;
    readonly donem: string;
    readonly vadeTarihi: string;
    readonly tutar: string;
    readonly odenen: string;
    readonly kalan: string;
    readonly gecikmisMi: boolean;
  }[]> {
    const borclar = await this.borclariOku(bolumId, principal, kisiId);
    const simdi = bugun();

    return borclar.map((b) => ({
      borcId: b.borcId,
      borcSorumlusuId: b.borcSorumlusuId,
      sorumluAdi: b.sorumluAdi,
      borcKalemi: b.borcKalemi,
      donem: b.donem,
      vadeTarihi: b.vadeTarihi,
      tutar: apiBicimi(b.tutar),
      odenen: apiBicimi(b.odenen),
      kalan: apiBicimi(money(
        (Number(apiBicimi(b.tutar)) - Number(apiBicimi(b.odenen))).toFixed(4),
      )),
      gecikmisMi: b.vadeTarihi < simdi,
    }));
  }

  /**
   * OTOMATİK TAHSİS ÖNERİSİ — hiçbir şey yazmaz.
   *
   * ⚠️  Önizleme ayrı bir uçtur: hangi borcun kapatıldığı gecikme faizini ve
   *     yasal takip sırasını etkiler; kullanıcı görmeden uygulanmamalıdır.
   */
  async tahsisOnerisi(
    tutarMetni: string, bolumId: string, principal: Principal, kisiId?: string,
  ): Promise<{
    readonly tahsisler: readonly {
      readonly borcId: string;
      readonly borcSorumlusuId: string | null;
      readonly borcKalemi: string;
      readonly donem: string;
      readonly tutar: string;
    }[];
    readonly kalan: string;
    readonly not: string | null;
  }> {
    const borclar = await this.borclariOku(bolumId, principal, kisiId);
    const sonuc = otomatikTahsis(money(tutarMetni), borclar);
    const harita = new Map(
      borclar.map((b) => [`${b.borcId}|${b.borcSorumlusuId ?? ''}`, b]),
    );

    return {
      tahsisler: sonuc.tahsisler.map((t) => {
        const b = harita.get(`${t.borcId}|${t.borcSorumlusuId ?? ''}`);
        return {
          borcId: t.borcId,
          borcSorumlusuId: t.borcSorumlusuId,
          borcKalemi: b?.borcKalemi ?? '',
          donem: b?.donem ?? '',
          tutar: apiBicimi(t.tutar),
        };
      }),
      kalan: apiBicimi(sonuc.kalan),
      // ARTAN TUTAR sessizce yutulmaz: kullanıcı neden tamamının
      // dağıtılmadığını bilmelidir.
      not: sonuc.kalan.kurus > 0n
        ? `Tutarın ${apiBicimi(sonuc.kalan)} kadarı açık borca sığmadı. ` +
          'Avans (borcu aşan ödeme) desteklenmiyor; tahsilat bu hâliyle ' +
          'kaydedilemez.'
        : null,
    };
  }

  private async borclariOku(
    bolumId: string, principal: Principal, kisiId?: string,
  ): Promise<readonly (AcikBorc & {
    readonly borcKalemi: string;
    readonly donem: string;
    readonly sorumluAdi: string | null;
  })[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.borc.findMany({
          where: {
            tenantId: principal.tenantId, bolumId, kapandiMi: false,
            ...(kisiId === undefined
              ? {} : { sorumlular: { some: { kisiId } } }),
          },
          orderBy: [{ vadeTarihi: 'asc' }],
          select: {
            id: true, tutar: true, odenen: true, vadeTarihi: true,
            giderTuruKodu: true, tahakkukDonemi: true,
            sorumlular: {
              ...(kisiId === undefined ? {} : { where: { kisiId } }),
              select: {
                id: true, pay: true, odenen: true, kapandiMi: true,
                kisi: { select: { ad: true, soyad: true } },
              },
            },
          },
        }),
      principal.tenantId,
    );

    const sonuc: (AcikBorc & {
      borcKalemi: string; donem: string; sorumluAdi: string | null;
    })[] = [];

    for (const b of kayitlar) {
      const ortak = {
        borcKalemi: b.giderTuruKodu,
        donem: gun(b.tahakkukDonemi).slice(0, 7),
        vadeTarihi: gun(b.vadeTarihi),
      };
      // Sorumlusu OLMAYAN borç tek parça olarak tahsis edilir; sorumluları
      // varsa PAY satırları verilir. İkisi bir arada verilseydi aynı para iki
      // kez tahsis edilebilirdi.
      if (b.sorumlular.length === 0) {
        sonuc.push({
          ...ortak, borcId: b.id, borcSorumlusuId: null, sorumluAdi: null,
          tutar: money(b.tutar.toFixed(4)),
          odenen: money(b.odenen.toFixed(4)),
        });
        continue;
      }
      for (const s of b.sorumlular) {
        if (s.kapandiMi) continue;
        sonuc.push({
          ...ortak, borcId: b.id, borcSorumlusuId: s.id,
          sorumluAdi: `${s.kisi.ad} ${s.kisi.soyad}`,
          tutar: money(s.pay.toFixed(4)),
          odenen: money(s.odenen.toFixed(4)),
        });
      }
    }
    return sonuc;
  }

  /* ------------------------------ Cari ekstre ---------------------------- */

  /**
   * BÖLÜM CARİ EKSTRESİ (ADR-0010).
   *
   * Kişi ekstresi bu motorun `kisiId` süzgeçli hâlidir; ayrı bir defter
   * DEĞİLDİR.
   */
  async cariEkstreDokumu(
    bolumId: string, baslangicMetni: string, bitisMetni: string,
    principal: Principal, kisiId?: string,
  ): Promise<CariEkstreDokumu> {
    const baslangic = takvimTarihi(baslangicMetni);
    const bitis = takvimTarihi(bitisMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      const kisiSuzgeci = kisiId === undefined
        ? {} : { sorumlular: { some: { kisiId } } };

      // AÇILIŞ BAKİYESİ — aralıktan ÖNCEKİ net borç. Sıfır varsayılsaydı her
      // ekstre borçlunun geçmişini silerdi.
      const oncekiBorc = await tx.borc.aggregate({
        where: {
          tenantId: principal.tenantId, bolumId,
          tahakkukDonemi: { lt: new Date(baslangic) }, ...kisiSuzgeci,
        },
        _sum: { tutar: true },
      });
      const oncekiTahsis = await tx.tahsilatTahsisi.aggregate({
        where: {
          tenantId: principal.tenantId,
          borc: { bolumId, ...kisiSuzgeci },
          tahsilat: { durum: 'GECERLI', tahsilatTarihi: { lt: new Date(baslangic) } },
          ...(kisiId === undefined ? {} : { borcSorumlusu: { kisiId } }),
        },
        _sum: { tutar: true },
      });
      const acilis = (oncekiBorc._sum.tutar ?? new Prisma.Decimal(0))
        .minus(oncekiTahsis._sum.tutar ?? new Prisma.Decimal(0));

      const borclar = await tx.borc.findMany({
        where: {
          tenantId: principal.tenantId, bolumId,
          tahakkukDonemi: { gte: new Date(baslangic), lte: new Date(bitis) },
          ...kisiSuzgeci,
        },
        select: {
          id: true, tutar: true, tahakkukDonemi: true, giderTuruKodu: true,
          tahakkukNo: true,
        },
      });

      const tahsisler = await tx.tahsilatTahsisi.findMany({
        where: {
          tenantId: principal.tenantId,
          borc: { bolumId, ...kisiSuzgeci },
          tahsilat: {
            durum: 'GECERLI',
            tahsilatTarihi: { gte: new Date(baslangic), lte: new Date(bitis) },
          },
          ...(kisiId === undefined ? {} : { borcSorumlusu: { kisiId } }),
        },
        select: {
          tutar: true,
          tahsilat: {
            select: { makbuzNo: true, tahsilatTarihi: true, kanal: true },
          },
        },
      });

      const girdiler: CariEkstreGirdisi[] = [
        ...borclar.map((b) => ({
          tip: 'BORC' as const,
          tarih: gun(b.tahakkukDonemi),
          aciklama: `Tahakkuk — ${b.giderTuruKodu}`,
          belgeNo: b.tahakkukNo,
          tutar: money(b.tutar.toFixed(4)),
        })),
        ...tahsisler.map((t) => ({
          tip: 'TAHSILAT' as const,
          tarih: gun(t.tahsilat.tahsilatTarihi),
          aciklama: `Tahsilat — ${t.tahsilat.kanal}`,
          belgeNo: t.tahsilat.makbuzNo,
          tutar: money(t.tutar.toFixed(4)),
        })),
      ];

      const e = cariEkstre(money(acilis.toFixed(4)), girdiler);

      return {
        bolumId: bolum.id,
        daire: bolum.kapiNo,
        baslangic, bitis,
        acilisBakiyesi: acilis.toFixed(4),
        satirlar: e.satirlar.map((s) => ({
          tip: s.tip, tarih: s.tarih, belgeNo: s.belgeNo,
          aciklama: s.aciklama,
          tutar: apiBicimi(s.tutar),
          bakiye: apiBicimi(s.bakiye),
        })),
        borcToplam: apiBicimi(e.borcToplam),
        tahsilatToplam: apiBicimi(e.tahsilatToplam),
        kapanisBakiyesi: apiBicimi(e.kapanisBakiyesi),
      };
    }, principal.tenantId);
  }

  /* --------------------------- Alacak yaşlandırma ------------------------ */

  async yaslandirma(
    principal: Principal,
  ): Promise<readonly {
    readonly etiket: string;
    readonly adet: number;
    readonly tutar: string;
  }[]> {
    const borclar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.borc.findMany({
          where: { tenantId: principal.tenantId, kapandiMi: false },
          select: { id: true, tutar: true, odenen: true, vadeTarihi: true },
        }),
      principal.tenantId,
    );

    const kovalar = alacakYaslandirmasi(
      borclar.map((b) => ({
        borcId: b.id, borcSorumlusuId: null,
        tutar: money(b.tutar.toFixed(4)),
        odenen: money(b.odenen.toFixed(4)),
        vadeTarihi: gun(b.vadeTarihi),
      })),
      bugun(),
    );

    return kovalar.map((k) => ({
      etiket: k.etiket, adet: k.adet, tutar: apiBicimi(k.tutar),
    }));
  }

  /* --------------------- Yardımcı defter ↔ kontrol hesabı ---------------- */

  /**
   * YARDIMCI DEFTER ile KONTROL HESABI mutabakatı (ADR-0010).
   *
   * ⚠️  `mutabikMi = false` ise dönem kapanışı BLOKE EDİLMELİDİR: yayımlanan
   *     bilançodaki alacak tutarı, borçlu bazında dökümlenen tutarların
   *     toplamıyla tutmazdı ve fark hangi daireden geldiği bilinmeden kalıcı
   *     hâle gelirdi.
   */
  async kontrolMutabakatDokumu(
    principal: Principal,
  ): Promise<KontrolMutabakatDokumu> {
    return this.prisma.tenantIslemi(async (tx) => {
      const borcToplam = await tx.borc.aggregate({
        where: { tenantId: principal.tenantId },
        _sum: { tutar: true, odenen: true },
      });
      const bolumSayisi = await tx.borc.findMany({
        where: { tenantId: principal.tenantId, kapandiMi: false },
        select: { bolumId: true },
        distinct: ['bolumId'],
      });

      const yardimci = (borcToplam._sum.tutar ?? new Prisma.Decimal(0))
        .minus(borcToplam._sum.odenen ?? new Prisma.Decimal(0));

      const kontrolHesabi = await tx.hesap.findFirst({
        where: {
          tenantId: principal.tenantId, ozellik: 'CARI_KONTROL',
          silinmeTarihi: null, aktif: true,
        },
        select: { id: true, kod: true },
      });

      // Kontrol hesabı işaretlenmemişse mutabakat YAPILAMAZ ve bu durum
      // "mutabık" olarak raporlanmaz — sessiz geçilirse eksiklik hiç fark
      // edilmez.
      if (kontrolHesabi === null) {
        return {
          yardimciDefterToplami: yardimci.toFixed(4),
          kontrolHesabiKodu: null,
          kontrolHesabiBakiyesi: '0.0000',
          fark: yardimci.toFixed(4),
          mutabikMi: false,
          bolumSayisi: bolumSayisi.length,
        };
      }

      const satirlar = await tx.yevmiyeSatiri.aggregate({
        where: {
          tenantId: principal.tenantId, hesapId: kontrolHesabi.id,
          fis: { durum: { in: ['ISLENDI', 'TERS_KAYITLI'] } },
        },
        _sum: { borc: true, alacak: true },
      });
      // Alacaklar hesabı VARLIK'tır: doğal bakiye BORÇ yönündedir.
      const kontrolBakiye = (satirlar._sum.borc ?? new Prisma.Decimal(0))
        .minus(satirlar._sum.alacak ?? new Prisma.Decimal(0));

      const m = kontrolMutabakati(
        money(yardimci.toFixed(4)), money(kontrolBakiye.toFixed(4)),
      );

      return {
        yardimciDefterToplami: apiBicimi(m.yardimciDefterToplami),
        kontrolHesabiKodu: kontrolHesabi.kod,
        kontrolHesabiBakiyesi: apiBicimi(m.kontrolHesabiBakiyesi),
        fark: apiBicimi(m.fark),
        mutabikMi: m.mutabikMi,
        bolumSayisi: bolumSayisi.length,
      };
    }, principal.tenantId);
  }
}
