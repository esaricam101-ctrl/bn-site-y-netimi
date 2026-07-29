/**
 * Gider Türü Query servisi — CQRS (ADR v1.1 §32).
 *
 * Gider türü sayısı tenant başına onlarla ifade edilir; sayfalama gereksiz
 * karmaşıklık olurdu.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface KarmaBilesenSatiri {
  readonly kural: string;
  readonly yuzde: number;
}

export interface GiderTuruSatiri {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly paylasimKurali: string;
  readonly sorumlulukTipi: string;
  readonly kuralKaynagi: string;
  readonly kaynakReferansi: string | null;
  readonly karmaBilesenler: readonly KarmaBilesenSatiri[] | null;
  readonly malikPaylasimi: string;
  readonly aktifMi: boolean;
  /**
   * Kural KMK varsayılanından SAPIYOR mu.
   *
   * Arayüzde ayrı gösterilir: bir yöneticinin devraldığı binada hangi
   * kuralların değiştirilmiş olduğunu görmesi, itiraz geldiğinde hangi
   * belgeye bakacağını bilmesi demektir.
   */
  readonly ozelKuralMi: boolean;
}

function bilesenleriCoz(ham: unknown): readonly KarmaBilesenSatiri[] | null {
  if (!Array.isArray(ham)) return null;
  return ham.filter(
    (b): b is KarmaBilesenSatiri =>
      typeof b === 'object' && b !== null && 'kural' in b && 'yuzde' in b,
  );
}

@Injectable()
export class GiderTuruQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listele(
    principal: Principal,
    yalnizcaAktif = false,
  ): Promise<readonly GiderTuruSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.giderTuru.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(yalnizcaAktif ? { aktifMi: true } : {}),
          },
          orderBy: [{ aktifMi: 'desc' }, { kod: 'asc' }],
        }),
      principal.tenantId,
    );

    return kayitlar.map((k) => ({
      id: k.id,
      kod: k.kod,
      ad: k.ad,
      paylasimKurali: k.paylasimKurali,
      sorumlulukTipi: k.sorumlulukTipi,
      kuralKaynagi: k.kuralKaynagi,
      kaynakReferansi: k.kaynakReferansi,
      karmaBilesenler: bilesenleriCoz(k.karmaBilesenler),
      malikPaylasimi: k.malikPaylasimi,
      aktifMi: k.aktifMi,
      ozelKuralMi: k.kuralKaynagi !== 'KMK_VARSAYILAN',
    }));
  }

  async detay(id: string, principal: Principal): Promise<GiderTuruSatiri> {
    const k = await this.prisma.tenantIslemi(
      (tx) => tx.giderTuru.findFirst({ where: { id, tenantId: principal.tenantId } }),
      principal.tenantId,
    );
    if (!k) throw new KayitBulunamadi(`Gider türü bulunamadı: ${id}`);

    return {
      id: k.id,
      kod: k.kod,
      ad: k.ad,
      paylasimKurali: k.paylasimKurali,
      sorumlulukTipi: k.sorumlulukTipi,
      kuralKaynagi: k.kuralKaynagi,
      kaynakReferansi: k.kaynakReferansi,
      karmaBilesenler: bilesenleriCoz(k.karmaBilesenler),
      malikPaylasimi: k.malikPaylasimi,
      aktifMi: k.aktifMi,
      ozelKuralMi: k.kuralKaynagi !== 'KMK_VARSAYILAN',
    };
  }
}
