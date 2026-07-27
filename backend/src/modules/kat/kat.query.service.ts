import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface KatSatiri {
  readonly id: string;
  readonly no: number;
  readonly ad: string | null;
  readonly bolumSayisi: number;
}

@Injectable()
export class KatQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir bloktaki kat sayısı küçüktür; sayfalama gereksizdir. */
  async listele(blokId: string, principal: Principal): Promise<readonly KatSatiri[]> {
    const blok = await this.prisma.blok.findFirst({
      where: { id: blokId, tenantId: principal.tenantId },
      select: { id: true },
    });
    if (!blok) throw new KayitBulunamadi(`Blok bulunamadı: ${blokId}`);

    const kayitlar = await this.prisma.kat.findMany({
      where: { tenantId: principal.tenantId, blokId },
      select: {
        id: true, no: true, ad: true,
        _count: { select: { bolumler: true } },
      },
      orderBy: { no: 'asc' },
    });

    return kayitlar.map((k) => ({
      id: k.id,
      no: k.no,
      ad: k.ad,
      bolumSayisi: k._count.bolumler,
    }));
  }
}
