/**
 * Audit Log — değiştirilemez, hash zincirli (ADR v1.1 §31).
 *
 * Her mutasyon buraya yazar (sözleşme testi CT-02).
 * Hash zinciri, kaydın sonradan değiştirilmediğini kanıtlar.
 * KVKK: ham kişisel veri yazılmaz, maskelenir.
 */
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { auditHashGirdisi, auditIcinMaskele, type AuditEylemi } from '@bnos/core-domain';
import type { Principal, TenantId } from '@bnos/kernel';

export interface AuditYazmaIstegi {
  readonly tenantId: TenantId;
  readonly principal: Principal;
  readonly eylem: AuditEylemi;
  readonly varlik: string;
  readonly varlikId: string;
  readonly oncekiDeger?: Record<string, unknown> | null;
  readonly sonrakiDeger?: Record<string, unknown> | null;
  readonly gerekce?: string | null;
  readonly correlationId: string;
  readonly ip?: string | null;
  readonly kullaniciAjani?: string | null;
}

@Injectable()
export class AuditServisi {
  /**
   * Audit kaydını domain yazmasıyla AYNI TRANSACTION içinde yazar.
   * Ayrı transaction kullanılsaydı, kayıt başarılı olup audit düşebilirdi.
   */
  async yaz(tx: Prisma.TransactionClient, istek: AuditYazmaIstegi): Promise<string> {
    const son = await tx.auditKaydi.findFirst({
      where: { tenantId: istek.tenantId },
      orderBy: { olusmaAni: 'desc' },
      select: { hash: true },
    });

    const id = randomUUID();
    const olusmaAni = new Date();
    const oncekiHash = son?.hash ?? null;

    const govde = {
      id,
      tenantId: istek.tenantId,
      principalId: istek.principal.id,
      principalTipi: istek.principal.tip,
      eylem: istek.eylem,
      varlik: istek.varlik,
      varlikId: istek.varlikId,
      oncekiDeger: auditIcinMaskele(istek.oncekiDeger ?? null),
      sonrakiDeger: auditIcinMaskele(istek.sonrakiDeger ?? null),
      gerekce: istek.gerekce ?? null,
      correlationId: istek.correlationId,
      ip: istek.ip ?? null,
      kullaniciAjani: istek.kullaniciAjani ?? null,
      olusmaAni,
      oncekiHash,
    };

    const hash = createHash('sha256').update(auditHashGirdisi(govde)).digest('hex');

    await tx.auditKaydi.create({
      data: {
        ...govde,
        oncekiDeger: govde.oncekiDeger as Prisma.InputJsonValue,
        sonrakiDeger: govde.sonrakiDeger as Prisma.InputJsonValue,
        hash,
      },
    });
    return id;
  }

  /** Zincir bütünlüğü doğrulaması — denetçi raporu için. */
  async zinciriDogrula(
    tx: Prisma.TransactionClient,
    tenantId: TenantId,
  ): Promise<{ gecerli: boolean; bozukKayitId: string | null; incelenen: number; ilkHata?: string | null }> {
    const kayitlar = await tx.auditKaydi.findMany({
      where: { tenantId },
      orderBy: { olusmaAni: 'asc' },
    });

    let oncekiHash: string | null = null;
    for (const k of kayitlar) {
      if (k.oncekiHash !== oncekiHash) {
        return {
          gecerli: false,
          bozukKayitId: k.id,
          incelenen: kayitlar.length,
          ilkHata: 'onceki hash uyusmazligi',
        };
      }
      const beklenen = createHash('sha256')
        .update(auditHashGirdisi({
          ...k,
          oncekiDeger: k.oncekiDeger as Record<string, unknown> | null,
          sonrakiDeger: k.sonrakiDeger as Record<string, unknown> | null,
        } as never))
        .digest('hex');
      if (beklenen !== k.hash) {
        return {
          gecerli: false,
          bozukKayitId: k.id,
          incelenen: kayitlar.length,
          ilkHata: 'hash uyusmazligi',
        };
      }
      oncekiHash = k.hash;
    }
    return { gecerli: true, bozukKayitId: null, incelenen: kayitlar.length, ilkHata: null };
  }
}
