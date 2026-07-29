import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ApartmanSatiri {
  readonly id: string;
  readonly ad: string;
  readonly adres: string | null;
  readonly siteIciKod: string | null;
  readonly blokSayisi: number;
}

export interface HiyerarsiBolumu {
  readonly id: string;
  readonly kapiNo: string;
  readonly nitelik: string;
  readonly durum: string;
}

export interface HiyerarsiKati {
  readonly id: string;
  readonly no: number;
  readonly ad: string | null;
  readonly bolumler: readonly HiyerarsiBolumu[];
}

export interface HiyerarsiBloku {
  readonly id: string;
  readonly ad: string;
  readonly katlar: readonly HiyerarsiKati[];
  /** Kata bağlanmamış bölümler — hiyerarşi yarım kalmış olanlar. */
  readonly katsizBolumler: readonly HiyerarsiBolumu[];
}

export interface HiyerarsiAgaci {
  readonly apartmanId: string;
  readonly apartmanAdi: string;
  readonly bloklar: readonly HiyerarsiBloku[];
  readonly toplamBolum: number;
}

@Injectable()
export class ApartmanQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bir yerleşkedeki apartman sayısı doğası gereği küçüktür (tek apartmanda 1,
   * büyük sitede onlarca); cursor sayfalama gereksiz karmaşıklık olurdu.
   *
   * Soft delete filtresi Prisma uzantısı tarafından MERKEZÎ uygulanır.
   */
  async listele(principal: Principal): Promise<readonly ApartmanSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.apartman.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, ad: true, adres: true, siteIciKod: true,
        _count: { select: { bloklar: true } },
      },
      orderBy: { ad: 'asc' },
    }), principal.tenantId);

    return kayitlar.map((k) => ({
      id: k.id,
      ad: k.ad,
      adres: k.adres,
      siteIciKod: k.siteIciKod,
      blokSayisi: k._count.bloklar,
    }));
  }

  async detay(id: string, principal: Principal): Promise<ApartmanSatiri> {
    const k = await this.prisma.tenantIslemi((tx) => tx.apartman.findFirst({
      where: { id, tenantId: principal.tenantId },
      select: {
        id: true, ad: true, adres: true, siteIciKod: true,
        _count: { select: { bloklar: true } },
      },
    }), principal.tenantId);
    if (!k) throw new KayitBulunamadi(`Apartman bulunamadı: ${id}`);

    return {
      id: k.id,
      ad: k.ad,
      adres: k.adres,
      siteIciKod: k.siteIciKod,
      blokSayisi: k._count.bloklar,
    };
  }

  /**
   * Apartmanın tüm hiyerarşisi tek çağrıda: Blok → Kat → Bölüm.
   *
   * Yönetim ekranı bu ağacı gezinme için kullanır; parça parça çağırmak
   * her seviye için ayrı istek demektir (blok sayısı × kat sayısı).
   *
   * Kata bağlanmamış bölümler `katsizBolumler` altında AYRI döner — sessizce
   * gizlenirse hiyerarşi tam görünür ama bölüm sayısı tutmaz ve eksik veri
   * fark edilmez. `hiyerarsi-denetimi` ucu bunları sorun olarak raporlar.
   */
  async hiyerarsi(apartmanId: string, principal: Principal): Promise<HiyerarsiAgaci> {
    const apartman = await this.prisma.tenantIslemi((tx) => tx.apartman.findFirst({
      where: { id: apartmanId, tenantId: principal.tenantId },
      select: { id: true, ad: true },
    }), principal.tenantId);
    if (!apartman) throw new KayitBulunamadi(`Apartman bulunamadı: ${apartmanId}`);

    const bloklar = await this.prisma.tenantIslemi((tx) => tx.blok.findMany({
      where: { tenantId: principal.tenantId, apartmanId },
      select: {
        id: true, ad: true,
        katlar: {
          select: { id: true, no: true, ad: true },
          orderBy: { no: 'asc' },
        },
      },
      orderBy: { ad: 'asc' },
    }), principal.tenantId);

    // Bolumler tek sorguda cekilir; blok x kat kadar sorgu atmak N+1 olurdu.
    const bolumler = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId, blok: { apartmanId } },
      select: { id: true, kapiNo: true, nitelik: true, durum: true, blokId: true, katId: true },
      orderBy: { kapiNo: 'asc' },
    }), principal.tenantId);

    const kataGore = new Map<string, HiyerarsiBolumu[]>();
    const blogaGoreKatsiz = new Map<string, HiyerarsiBolumu[]>();

    for (const b of bolumler) {
      const satir: HiyerarsiBolumu = {
        id: b.id, kapiNo: b.kapiNo, nitelik: b.nitelik, durum: b.durum,
      };
      if (b.katId !== null) {
        const liste = kataGore.get(b.katId) ?? [];
        liste.push(satir);
        kataGore.set(b.katId, liste);
      } else if (b.blokId !== null) {
        const liste = blogaGoreKatsiz.get(b.blokId) ?? [];
        liste.push(satir);
        blogaGoreKatsiz.set(b.blokId, liste);
      }
    }

    return {
      apartmanId: apartman.id,
      apartmanAdi: apartman.ad,
      bloklar: bloklar.map((blok) => ({
        id: blok.id,
        ad: blok.ad,
        katlar: blok.katlar.map((kat) => ({
          id: kat.id,
          no: kat.no,
          ad: kat.ad,
          bolumler: kataGore.get(kat.id) ?? [],
        })),
        katsizBolumler: blogaGoreKatsiz.get(blok.id) ?? [],
      })),
      toplamBolum: bolumler.length,
    };
  }
}
