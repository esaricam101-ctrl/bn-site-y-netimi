/**
 * KAPI 2 — KİRACI (ADR-0006 · BFS v1 §3)
 *
 * Principal'ın tenant üyeliği doğrulanır ve TenantContext kurulur.
 * Bu kapı geçilmeden Kapı 3 çalışamaz: izinler tenant'a görelidir.
 *
 * ÖNEMLİ: Bu kapı RLS'in yerine geçmez. RLS son savunma hattıdır —
 * bu kapı unutulursa veritabanı bağlamsız sorguyu reddeder.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Principal, TenantBaglami } from '@bnos/kernel';
import { PUBLIC_ANAHTARI, TENANTSIZ_ANAHTARI } from '../decorators';
import { mevcutBaglam } from '../context/request-context';
import { TenantOkuyucu } from '../prisma/tenant.reader';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly okuyucu: TenantOkuyucu,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<string | undefined>(PUBLIC_ANAHTARI, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    if (this.reflector.getAllAndOverride<string | undefined>(TENANTSIZ_ANAHTARI, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }

    const istek = ctx.switchToHttp().getRequest<Request & { principal?: Principal; tenant?: TenantBaglami }>();
    const principal = istek.principal;
    if (!principal) {
      // Kapı 1 çalışmadıysa burası da geçilemez — sıra korunur.
      throw new ForbiddenException({ mesaj: 'Kimlik çözülmeden tenant bağlamı kurulamaz.' });
    }

    // Tenant KİMLİĞİ TOKEN CLAIM'İNDEN gelir, istek parametresinden ASLA (BFS v1 §12).
    const uyelik = await this.okuyucu.uyelikVarMi(principal.tenantId, principal.id);
    if (!uyelik) {
      // Kapsam dışı istek 403 döner, filtrelenmiş 200 DEĞİL.
      throw new ForbiddenException({
        mesaj: 'Bu apartmana erişim yetkiniz yok.',
        sonrakiEylem: 'Yöneticinizden erişim talep edin.',
      });
    }

    const tenant: TenantBaglami = {
      tenantId: principal.tenantId,
      saatDilimi: uyelik.saatDilimi,
    };
    istek.tenant = tenant;
    const baglam = mevcutBaglam();
    if (baglam) Object.assign(baglam, { tenant });
    return true;
  }
}
