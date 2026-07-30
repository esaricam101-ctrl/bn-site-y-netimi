/**
 * İletişim — sorgu tarafı (CQRS).
 *
 * "Son Gönderilen SMS'ler", "SMS Geçmişi" ve "WhatsApp Mesaj Geçmişi" AYNI
 * SORGUNUN kanal süzgeçli hâlleridir; üç ayrı servis yazılsaydı üç ekran üç
 * farklı sayı gösterebilirdi.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import {
  durumOzeti, type IletisimKanali, type MesajDurumu,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SablonSatiri {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly kanal: string | null;
  readonly iletiTuru: string;
  readonly govde: string;
  readonly aktif: boolean;
  readonly kullanimSayisi: number;
}

export interface GonderimSatiri {
  readonly id: string;
  readonly kanal: string;
  readonly iletiTuru: string;
  readonly durum: string;
  readonly baslik: string | null;
  readonly hedefTipi: string;
  readonly olusturulmaTarihi: string;
  readonly zamanlanmaAni: string | null;
  readonly toplamMesaj: number;
  readonly basarili: number;
  readonly basarisiz: number;
  readonly iptalGerekcesi: string | null;
}

/** "Son Gönderilen" ve "Geçmiş" ekranlarının satırı. */
export interface MesajSatiri {
  readonly id: string;
  readonly tarih: string;
  readonly gonderenKullaniciId: string;
  readonly aliciAdi: string;
  readonly numara: string;
  readonly ozet: string;
  readonly kanal: string;
  readonly iletiTuru: string;
  readonly durum: string;
  readonly teslimAni: string | null;
  readonly saglayici: string | null;
  readonly hataKodu: string | null;
  readonly hataMesaji: string | null;
  readonly parcaSayisi: number;
  readonly ilgiliVarlik: string | null;
  readonly ilgiliVarlikId: string | null;
  readonly yenidenGonderilebilirMi: boolean;
}

export interface DurumRaporu {
  readonly toplam: number;
  readonly basarili: number;
  readonly basarisiz: number;
  readonly bekleyen: number;
  readonly iptal: number;
  readonly saglayiciYok: number;
  readonly izinYok: number;
  readonly toplamKontor: number;
  /** ⚠️ Payda "denenen" mesajlardır; hiç denenmemişse `null` döner. */
  readonly basariOrani: number | null;
  readonly sonGonderimTarihi: string | null;
  readonly gunlukSayi: number;
  readonly aylikSayi: number;
  /** Grafik için: son 30 günün günlük dağılımı. */
  readonly gunlukSeri: readonly { readonly gun: string; readonly adet: number }[];
  /** Grafik için: durum dağılımı. */
  readonly durumDagilimi: readonly { readonly durum: string; readonly adet: number }[];
  readonly saglayiciEtkinMi: boolean;
}

@Injectable()
export class IletisimQueryServisi {
  constructor(private readonly prisma: PrismaService) {}

  async sablonlar(
    principal: Principal, kanal?: IletisimKanali,
  ): Promise<readonly SablonSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.mesajSablonu.findMany({
          where: {
            tenantId: principal.tenantId, silinmeTarihi: null,
            ...(kanal === undefined ? {} : {
              OR: [{ kanal }, { kanal: null }],
            }),
          },
          orderBy: { kod: 'asc' },
          select: {
            id: true, kod: true, ad: true, kanal: true, iletiTuru: true,
            govde: true, aktif: true,
            _count: { select: { gonderimler: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((s) => ({
      id: s.id, kod: s.kod, ad: s.ad, kanal: s.kanal, iletiTuru: s.iletiTuru,
      govde: s.govde, aktif: s.aktif, kullanimSayisi: s._count.gonderimler,
    }));
  }

  async gonderimler(
    principal: Principal, kanal?: IletisimKanali, limit = 100,
  ): Promise<readonly GonderimSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.mesajGonderimi.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(kanal === undefined
              ? {} : { kanal }),
          },
          orderBy: { olusturulmaTarihi: 'desc' },
          take: limit,
          select: {
            id: true, kanal: true, iletiTuru: true, durum: true, baslik: true,
            hedefTipi: true, olusturulmaTarihi: true, zamanlanmaAni: true,
            iptalGerekcesi: true,
            mesajlar: { select: { durum: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((g) => ({
      id: g.id, kanal: g.kanal, iletiTuru: g.iletiTuru, durum: g.durum,
      baslik: g.baslik, hedefTipi: g.hedefTipi,
      olusturulmaTarihi: g.olusturulmaTarihi.toISOString(),
      zamanlanmaAni: g.zamanlanmaAni === null ? null : g.zamanlanmaAni.toISOString(),
      toplamMesaj: g.mesajlar.length,
      basarili: g.mesajlar.filter(
        (m) => ['GONDERILDI', 'TESLIM_EDILDI', 'OKUNDU'].includes(m.durum),
      ).length,
      basarisiz: g.mesajlar.filter((m) => m.durum === 'BASARISIZ').length,
      iptalGerekcesi: g.iptalGerekcesi,
    }));
  }

  /**
   * Mesaj listesi — "Son Gönderilenler" ve "Geçmiş" aynı uçtur.
   *
   * ⚠️  BAŞARISIZ ve İZİN_YOK mesajlar LİSTEDE KALIR. Süzülselerdi "kime
   *     gitmedi" sorusu yanıtsız kalır ve yönetici herkese ulaştığını sanardı.
   */
  async mesajlar(
    principal: Principal,
    filtre: {
      readonly baslangic?: string; readonly bitis?: string;
      readonly kanal?: IletisimKanali; readonly durum?: MesajDurumu;
      readonly kisiId?: string; readonly arama?: string;
      readonly limit?: number;
    } = {},
  ): Promise<readonly MesajSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.mesaj.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(filtre.kanal === undefined ? {} : { kanal: filtre.kanal }),
            ...(filtre.durum === undefined ? {} : { durum: filtre.durum }),
            ...(filtre.kisiId === undefined ? {} : { kisiId: filtre.kisiId }),
            ...(filtre.baslangic === undefined && filtre.bitis === undefined
              ? {}
              : {
                  olusturulmaTarihi: {
                    ...(filtre.baslangic === undefined
                      ? {} : { gte: new Date(filtre.baslangic) }),
                    ...(filtre.bitis === undefined
                      ? {} : { lte: new Date(`${filtre.bitis}T23:59:59.999Z`) }),
                  },
                }),
            ...(filtre.arama === undefined || filtre.arama.trim() === ''
              ? {}
              : {
                  OR: [
                    { aliciAdi: { contains: filtre.arama.trim(), mode: 'insensitive' } },
                    { numara: { contains: filtre.arama.trim() } },
                    { govde: { contains: filtre.arama.trim(), mode: 'insensitive' } },
                  ],
                }),
          },
          orderBy: { olusturulmaTarihi: 'desc' },
          take: filtre.limit ?? 100,
          select: {
            id: true, olusturulmaTarihi: true, aliciAdi: true, numara: true,
            govde: true, kanal: true, durum: true, teslimAni: true,
            saglayici: true, hataKodu: true, hataMesaji: true, parcaSayisi: true,
            denemeSayisi: true,
            gonderim: {
              select: {
                olusturan: true, iletiTuru: true,
                ilgiliVarlik: true, ilgiliVarlikId: true,
              },
            },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((m) => ({
      id: m.id,
      tarih: m.olusturulmaTarihi.toISOString(),
      gonderenKullaniciId: m.gonderim.olusturan,
      aliciAdi: m.aliciAdi,
      numara: m.numara,
      // Mesaj ÖZETİ — tam metin detayda. Listede tam metin gösterilseydi
      // tablo okunamaz hâle gelirdi.
      ozet: m.govde.length > 80 ? `${m.govde.slice(0, 80)}…` : m.govde,
      kanal: m.kanal,
      iletiTuru: m.gonderim.iletiTuru,
      durum: m.durum,
      teslimAni: m.teslimAni === null ? null : m.teslimAni.toISOString(),
      saglayici: m.saglayici,
      hataKodu: m.hataKodu,
      hataMesaji: m.hataMesaji,
      parcaSayisi: m.parcaSayisi,
      ilgiliVarlik: m.gonderim.ilgiliVarlik,
      ilgiliVarlikId: m.gonderim.ilgiliVarlikId,
      yenidenGonderilebilirMi:
        ['BASARISIZ', 'SAGLAYICI_YOK'].includes(m.durum) && m.denemeSayisi < 3,
    }));
  }

  /** Tek mesajın tam metni ve geçmişi. */
  async mesajDetayi(id: string, principal: Principal): Promise<{
    readonly id: string;
    readonly govde: string;
    readonly aliciAdi: string;
    readonly numara: string;
    readonly durum: string;
    readonly parcaSayisi: number;
    readonly hataMesaji: string | null;
  } | null> {
    return this.prisma.tenantIslemi(
      async (tx) => {
        const m = await tx.mesaj.findFirst({
          where: { id, tenantId: principal.tenantId },
          select: {
            id: true, govde: true, aliciAdi: true, numara: true,
            durum: true, parcaSayisi: true, hataMesaji: true,
          },
        });
        return m;
      },
      principal.tenantId,
    );
  }

  /**
   * DURUM RAPORU — grafiklerle gösterilebilir seriler dahil.
   *
   * ⚠️  `saglayiciEtkinMi` YANITTA DÖNER ve gizlenmez. Sağlayıcı yokken
   *     "0 başarılı" rakamı bir arıza gibi okunur; oysa hiçbir mesaj
   *     gönderilmemiştir çünkü gönderilecek yer yoktur.
   */
  async durumRaporu(
    principal: Principal, kanal: IletisimKanali | undefined, saglayiciEtkinMi: boolean,
  ): Promise<DurumRaporu> {
    return this.prisma.tenantIslemi(async (tx) => {
      const kanalKosulu = kanal === undefined ? {} : { kanal };

      const hepsi = await tx.mesaj.findMany({
        where: { tenantId: principal.tenantId, ...kanalKosulu },
        select: { durum: true, parcaSayisi: true, olusturulmaTarihi: true },
      });

      const ozet = durumOzeti(
        hepsi.map((m) => ({
          durum: m.durum, parcaSayisi: m.parcaSayisi,
        })),
      );

      const simdi = new Date();
      const gunBasi = new Date(Date.UTC(
        simdi.getUTCFullYear(), simdi.getUTCMonth(), simdi.getUTCDate(),
      ));
      const ayBasi = new Date(Date.UTC(simdi.getUTCFullYear(), simdi.getUTCMonth(), 1));
      const otuzGunOnce = new Date(gunBasi.getTime() - 29 * 86_400_000);

      const gunluk = new Map<string, number>();
      for (let i = 0; i < 30; i += 1) {
        const g = new Date(otuzGunOnce.getTime() + i * 86_400_000)
          .toISOString().slice(0, 10);
        gunluk.set(g, 0);
      }
      for (const m of hepsi) {
        const g = m.olusturulmaTarihi.toISOString().slice(0, 10);
        if (gunluk.has(g)) gunluk.set(g, (gunluk.get(g) ?? 0) + 1);
      }

      const durumSayaci = new Map<string, number>();
      for (const m of hepsi) {
        durumSayaci.set(m.durum, (durumSayaci.get(m.durum) ?? 0) + 1);
      }

      const sonGonderim = hepsi.length === 0
        ? null
        : hepsi
            .map((m) => m.olusturulmaTarihi)
            .reduce((a, b) => (a > b ? a : b));

      return {
        ...ozet,
        sonGonderimTarihi: sonGonderim === null ? null : sonGonderim.toISOString(),
        gunlukSayi: hepsi.filter((m) => m.olusturulmaTarihi >= gunBasi).length,
        aylikSayi: hepsi.filter((m) => m.olusturulmaTarihi >= ayBasi).length,
        gunlukSeri: [...gunluk.entries()].map(([gun, adet]) => ({ gun, adet })),
        durumDagilimi: [...durumSayaci.entries()]
          .map(([durum, adet]) => ({ durum, adet }))
          .sort((a, b) => b.adet - a.adet),
        saglayiciEtkinMi,
      };
    }, principal.tenantId);
  }

  /** Kişi kartı için: izinler + son gönderim + mesaj geçmişi. */
  async kisiIletisimi(kisiId: string, principal: Principal): Promise<{
    readonly whatsappNo: string | null;
    readonly telefon: string | null;
    readonly izinler: readonly {
      readonly kanal: string; readonly iletiTuru: string;
      readonly durum: string; readonly kaynak: string;
    }[];
    readonly sonGonderim: string | null;
    readonly mesajGecmisi: readonly MesajSatiri[];
  }> {
    const kisi = await this.prisma.tenantIslemi(
      (tx) =>
        tx.kisi.findFirst({
          where: { id: kisiId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: {
            whatsappNo: true, telefon: true,
            iletisimIzinleri: {
              select: { kanal: true, iletiTuru: true, durum: true, kaynak: true },
            },
          },
        }),
      principal.tenantId,
    );

    const gecmis = await this.mesajlar(principal, { kisiId, limit: 50 });

    return {
      whatsappNo: kisi?.whatsappNo ?? null,
      telefon: kisi?.telefon ?? null,
      izinler: kisi?.iletisimIzinleri ?? [],
      sonGonderim: gecmis[0]?.tarih ?? null,
      mesajGecmisi: gecmis,
    };
  }

  async kurallar(principal: Principal): Promise<readonly {
    readonly id: string; readonly olayKodu: string; readonly kanal: string;
    readonly sablonKodu: string; readonly aktif: boolean;
  }[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.otomatikBildirimKurali.findMany({
          where: { tenantId: principal.tenantId },
          orderBy: [{ olayKodu: 'asc' }],
          select: {
            id: true, olayKodu: true, kanal: true, aktif: true,
            sablon: { select: { kod: true } },
          },
        }),
      principal.tenantId,
    );
    return kayitlar.map((k) => ({
      id: k.id, olayKodu: k.olayKodu, kanal: k.kanal,
      sablonKodu: k.sablon.kod, aktif: k.aktif,
    }));
  }
}
