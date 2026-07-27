import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface KisiSatiri {
  readonly id: string;
  readonly ad: string;
  readonly soyad: string;
  readonly eposta: string | null;
}

export interface SayfaliSonuc<T> {
  readonly kayitlar: readonly T[];
  readonly sonrakiImlec: string | null;
}

@Injectable()
export class KisiQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor tabanlı sayfalama (BFS v1 §12).
   * Soft delete filtresi Prisma uzantısı tarafından MERKEZÎ uygulanır —
   * burada elle `silinmeTarihi: null` yazılmaz.
   */
  async listele(
    principal: Principal,
    imlec: string | undefined,
    limit: number,
  ): Promise<SayfaliSonuc<KisiSatiri>> {
    const kayitlar = await this.prisma.kisi.findMany({
      where: { tenantId: principal.tenantId },
      select: { id: true, ad: true, soyad: true, eposta: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(imlec ? { cursor: { id: imlec }, skip: 1 } : {}),
    });

    const fazlaVar = kayitlar.length > limit;
    const sayfa = fazlaVar ? kayitlar.slice(0, limit) : kayitlar;
    return {
      kayitlar: sayfa,
      sonrakiImlec: fazlaVar ? (sayfa[sayfa.length - 1]?.id ?? null) : null,
    };
  }
}
