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
    const kayitlar = await this.prisma.apartman.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, ad: true, adres: true, siteIciKod: true,
        _count: { select: { bloklar: true } },
      },
      orderBy: { ad: 'asc' },
    });

    return kayitlar.map((k) => ({
      id: k.id,
      ad: k.ad,
      adres: k.adres,
      siteIciKod: k.siteIciKod,
      blokSayisi: k._count.bloklar,
    }));
  }

  async detay(id: string, principal: Principal): Promise<ApartmanSatiri> {
    const k = await this.prisma.apartman.findFirst({
      where: { id, tenantId: principal.tenantId },
      select: {
        id: true, ad: true, adres: true, siteIciKod: true,
        _count: { select: { bloklar: true } },
      },
    });
    if (!k) throw new KayitBulunamadi(`Apartman bulunamadı: ${id}`);

    return {
      id: k.id,
      ad: k.ad,
      adres: k.adres,
      siteIciKod: k.siteIciKod,
      blokSayisi: k._count.bloklar,
    };
  }
}
