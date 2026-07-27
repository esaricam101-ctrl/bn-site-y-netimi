import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface BlokSatiri {
  readonly id: string;
  readonly ad: string;
  readonly bolumSayisi: number;
}

@Injectable()
export class BlokQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bloklar sayfalanmaz: bir apartmanda blok sayısı doğası gereği küçüktür
   * (tipik olarak 1–10). Cursor sayfalama burada gereksiz karmaşıklık olurdu.
   *
   * Soft delete filtresi Prisma uzantısı tarafından MERKEZÎ uygulanır.
   */
  async listele(principal: Principal): Promise<readonly BlokSatiri[]> {
    const kayitlar = await this.prisma.blok.findMany({
      where: { tenantId: principal.tenantId },
      select: { id: true, ad: true, _count: { select: { bolumler: true } } },
      orderBy: { ad: 'asc' },
    });

    return kayitlar.map((k) => ({
      id: k.id,
      ad: k.ad,
      bolumSayisi: k._count.bolumler,
    }));
  }
}
