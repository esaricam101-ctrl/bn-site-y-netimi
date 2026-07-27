/**
 * Tenant Query servisi — CQRS (ADR v1.1 §32 · BFS v1 §6)
 *
 * Kurallar:
 *   1. Query HİÇBİR KOŞULDA yazmaz
 *   3. Query domain katmanını atlayabilir — optimize SQL/view kullanabilir
 *   4. RLS Query'e de uygulanır: domain'i atlamak izolasyonu atlamak DEĞİLDİR
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
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

  async ozet(id: string, _principal: Principal): Promise<TenantOzeti> {
    const kayit = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true, kod: true, ad: true, durum: true, saatDilimi: true,
      },
    });
    if (!kayit) throw new KayitBulunamadi(`Apartman bulunamadı: ${id}`);

    const bolumSayisi = await this.prisma.bagimsizBolum.count({ where: { tenantId: id } });
    const kisiSayisi = await this.prisma.kisi.count({ where: { tenantId: id } });

    return {
      id: kayit.id, kod: kayit.kod, ad: kayit.ad,
      durum: kayit.durum, saatDilimi: kayit.saatDilimi,
      bolumSayisi,
      kisiSayisi,
    };
  }
}
