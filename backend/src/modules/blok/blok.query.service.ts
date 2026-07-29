import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface BlokSatiri {
  readonly id: string;
  readonly ad: string;
  readonly apartmanId: string;
  readonly apartmanAdi: string;
  readonly katSayisi: number;
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
   *
   * OKUMA DA TENANT İŞLEMİDİR: `blok` RLS taşır ve bağlam kurulmadan tek
   * satır bile okunamaz. `where` içindeki `tenantId` koşulu KORUNUR — RLS
   * son savunma hattıdır, tek savunma değil (BFS v1 §2.2).
   */
  async listele(principal: Principal, apartmanId?: string): Promise<readonly BlokSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.blok.findMany({
      where: {
        tenantId: principal.tenantId,
        ...(apartmanId ? { apartmanId } : {}),
      },
      select: {
        id: true, ad: true, apartmanId: true,
        apartman: { select: { ad: true } },
        _count: { select: { bolumler: true, katlar: true } },
      },
      orderBy: [{ apartmanId: 'asc' }, { ad: 'asc' }],
    }), principal.tenantId);

    return kayitlar.map((k) => ({
      id: k.id,
      ad: k.ad,
      apartmanId: k.apartmanId,
      apartmanAdi: k.apartman.ad,
      katSayisi: k._count.katlar,
      bolumSayisi: k._count.bolumler,
    }));
  }

  async detay(id: string, principal: Principal): Promise<BlokSatiri> {
    const k = await this.prisma.tenantIslemi((tx) => tx.blok.findFirst({
      where: { id, tenantId: principal.tenantId },
      select: {
        id: true, ad: true, apartmanId: true,
        apartman: { select: { ad: true } },
        _count: { select: { bolumler: true, katlar: true } },
      },
    }), principal.tenantId);
    if (!k) throw new KayitBulunamadi(`Blok bulunamadı: ${id}`);

    return {
      id: k.id,
      ad: k.ad,
      apartmanId: k.apartmanId,
      apartmanAdi: k.apartman.ad,
      katSayisi: k._count.katlar,
      bolumSayisi: k._count.bolumler,
    };
  }
}
