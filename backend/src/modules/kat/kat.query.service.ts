import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface KatSatiri {
  readonly id: string;
  /**
   * BLOK ADRESLEMESİ İÇİN GEREKLİ (3 Ağustos 2026).
   *
   * *"A Blok 23"* bir kişinin ADRESİDİR; kat kaydında bloğun hangisi olduğunu
   * bilmek adres gösteriminde ve daire seçiminde işe yarar. Kat listesi tek
   * blok için çağrılsa bile satırın kendisi bağlamını taşımalıdır — çağıran
   * bağlamı ayrıca taşımak zorunda kalmasın.
   *
   * ⚠️  MUHASEBEDE BLOK AYRIMI YOKTUR ve bu alan onu değiştirmez:
   *     muhasebeleştirme proje genelidir, blok blok yapılmaz
   *     (docs/APARTMAN-SITE-AYRIMI.md). İkisi farklı katmandır.
   *
   * ⚠️  Alan `frontend/web/lib/mock/veri.ts` içindeki tipte ZATEN vardı ama
   *     API döndürmüyordu; CT-22 bunu yakaladı. Tip yalan söylüyordu:
   *     `kat.blokId` yazan biri derleme hatası almadan `undefined` alırdı.
   */
  readonly blokId: string;
  readonly no: number;
  readonly ad: string | null;
  readonly bolumSayisi: number;
}

@Injectable()
export class KatQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir bloktaki kat sayısı küçüktür; sayfalama gereksizdir. */
  async listele(blokId: string, principal: Principal): Promise<readonly KatSatiri[]> {
    const blok = await this.prisma.tenantIslemi((tx) => tx.blok.findFirst({
      where: { id: blokId, tenantId: principal.tenantId },
      select: { id: true },
    }), principal.tenantId);
    if (!blok) throw new KayitBulunamadi(`Blok bulunamadı: ${blokId}`);

    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.kat.findMany({
      where: { tenantId: principal.tenantId, blokId },
      select: {
        id: true, blokId: true, no: true, ad: true,
        _count: { select: { bolumler: true } },
      },
      orderBy: { no: 'asc' },
    }), principal.tenantId);

    return kayitlar.map((k) => ({
      id: k.id,
      blokId: k.blokId,
      no: k.no,
      ad: k.ad,
      bolumSayisi: k._count.bolumler,
    }));
  }
}
