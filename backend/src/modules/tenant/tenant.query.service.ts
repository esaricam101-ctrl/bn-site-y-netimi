/**
 * Tenant Query servisi — CQRS (ADR v1.1 §32 · BFS v1 §6)
 *
 * Kurallar:
 *   1. Query HİÇBİR KOŞULDA yazmaz
 *   3. Query domain katmanını atlayabilir — optimize SQL/view kullanabilir
 *   4. RLS Query'e de uygulanır: domain'i atlamak izolasyonu atlamak DEĞİLDİR
 */
import { Injectable } from '@nestjs/common';
import { tenantId, type Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface TenantOzeti {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly durum: string;
  readonly saatDilimi: string;
  readonly bolumSayisi: number;
  readonly kisiSayisi: number;
}

@Injectable()
export class TenantQueryService {
  constructor(private readonly prisma: PrismaService) {}

  // principal imzada tutulur: Query tarafi yetki filtresini ileride buradan
  // uygulayacaktir (ADR v1.1 §38). Simdilik okunmuyor.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async ozet(id: string, _principal: Principal): Promise<TenantOzeti> {
    const kayit = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true, kod: true, ad: true, durum: true, saatDilimi: true,
      },
    });
    if (!kayit) throw new KayitBulunamadi(`Apartman bulunamadı: ${id}`);

    // Sayımlar TENANT BAĞLAMINDA yapılır: `bagimsiz_bolum` ve `kisi` RLS taşır.
    // Tek işlemde toplanır — iki ayrı transaction açmak gereksiz gidiş geliştir.
    const tid = tenantId(id);
    const { bolumSayisi, kisiSayisi } = await this.prisma.tenantIslemi(
      async (tx) => ({
        bolumSayisi: await tx.bagimsizBolum.count({ where: { tenantId: id } }),
        kisiSayisi: await tx.kisi.count({ where: { tenantId: id } }),
      }),
      tid,
    );

    return {
      id: kayit.id, kod: kayit.kod, ad: kayit.ad,
      durum: kayit.durum, saatDilimi: kayit.saatDilimi,
      bolumSayisi,
      kisiSayisi,
    };
  }
}
