/**
 * Denetim kaydı sorgusu — BFS v1 §13.
 *
 * `AuditServisi` yalnızca YAZAR; okuma ucu yoktu ve "bu kayıtta kim ne yaptı?"
 * sorusu cevapsızdı. Tablo ve indeksler (`tenantId, varlik, varlikId`) zaten
 * mevcut; bu servis migration gerektirmez.
 *
 * KAYITLAR DEĞİŞTİRİLEMEZ. Bu yüzden yalnızca okuma vardır — güncelleme ya da
 * silme ucu bilinçli olarak YOKTUR. Hash zinciri kaydın sonradan
 * değiştirilmediğini kanıtlar; bir düzeltme ucu o kanıtı anlamsız kılardı.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditSatiri {
  readonly id: string;
  readonly eylem: string;
  readonly varlik: string;
  readonly varlikId: string;
  readonly principalId: string;
  readonly principalTipi: string;
  readonly gerekce: string | null;
  readonly correlationId: string;
  /** ISO 8601, UTC (BFS v1 §4.3). */
  readonly olusmaAni: string;
  readonly oncekiDeger: unknown;
  readonly sonrakiDeger: unknown;
}

export interface AuditSayfasi {
  readonly kayitlar: readonly AuditSatiri[];
  readonly sonrakiImlec: string | null;
}

export interface AuditSuzgeci {
  readonly varlik?: string;
  readonly varlikId?: string;
  readonly eylem?: string;
}

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Denetim kayıtları — en yeniden eskiye.
   *
   * `varlik` + `varlikId` birlikte verildiğinde tek bir kaydın tarihçesi döner;
   * daire kartının "geçmiş işlemler" sekmesi bunu kullanır.
   *
   * Cursor sayfalama `olusmaAni` değil `id` üzerinden yapılır: aynı milisaniyede
   * yazılan iki kayıt zaman imlecinde birbirini atlatır.
   */
  async listele(
    principal: Principal,
    suzgec: AuditSuzgeci = {},
    imlec?: string,
    limit = 50,
  ): Promise<AuditSayfasi> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.auditKaydi.findMany({
      where: {
        tenantId: principal.tenantId,
        ...(suzgec.varlik ? { varlik: suzgec.varlik } : {}),
        ...(suzgec.varlikId ? { varlikId: suzgec.varlikId } : {}),
        ...(suzgec.eylem ? { eylem: suzgec.eylem } : {}),
      },
      select: {
        id: true, eylem: true, varlik: true, varlikId: true,
        principalId: true, principalTipi: true, gerekce: true,
        correlationId: true, olusmaAni: true,
        oncekiDeger: true, sonrakiDeger: true,
      },
      orderBy: [{ olusmaAni: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(imlec ? { cursor: { id: imlec }, skip: 1 } : {}),
    }), principal.tenantId);

    const fazlaVar = kayitlar.length > limit;
    const sayfa = fazlaVar ? kayitlar.slice(0, limit) : kayitlar;
    const sonKayit = sayfa[sayfa.length - 1];

    return {
      kayitlar: sayfa.map((k) => ({
        id: k.id,
        eylem: k.eylem,
        varlik: k.varlik,
        varlikId: k.varlikId,
        principalId: k.principalId,
        principalTipi: k.principalTipi,
        gerekce: k.gerekce,
        correlationId: k.correlationId,
        olusmaAni: k.olusmaAni.toISOString(),
        oncekiDeger: k.oncekiDeger,
        sonrakiDeger: k.sonrakiDeger,
      })),
      sonrakiImlec: fazlaVar && sonKayit ? sonKayit.id : null,
    };
  }
}
