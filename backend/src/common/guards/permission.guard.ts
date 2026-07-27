/**
 * KAPI 3 — İZİN (ADR-0006 · BFS v1 §3)
 *
 * Endpoint'in gerektirdiği izin, principal'ın etkin izin setinde aranır.
 * Devralınmış yetki (AGENT, PLUGIN, CIHAZ) devraldığı kapsamın ALT KÜMESİDİR —
 * bu kural tek yerde uygulanır, her çağrı yerinde tekrarlanmaz.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { izniVarMi, type Principal, type TenantBaglami } from '@bnos/kernel';
import type { Izin } from '@bnos/core-domain';
import { IZIN_ANAHTARI, PUBLIC_ANAHTARI } from '../decorators';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<string | undefined>(PUBLIC_ANAHTARI, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }

    const gerekli = this.reflector.getAllAndOverride<Izin[] | undefined>(IZIN_ANAHTARI, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!gerekli || gerekli.length === 0) return true;

    const istek = ctx.switchToHttp().getRequest<Request & { principal?: Principal; tenant?: TenantBaglami }>();
    const principal = istek.principal;

    if (!principal) throw new ForbiddenException({ mesaj: 'Kimlik çözülmedi.' });
    if (!istek.tenant) {
      throw new ForbiddenException({
        mesaj: 'Tenant bağlamı kurulmadan izin değerlendirilemez — izinler tenant a görelidir.',
      });
    }

    const eksik = gerekli.filter((izin) => !izniVarMi(principal, izin));
    if (eksik.length > 0) {
      // Gereken izni ADIYLA söyler; genel hata mesajı vermez (BFS v1 §12).
      throw new ForbiddenException({
        mesaj: `Bu işlem için yetkiniz yok. Gereken izin: ${eksik.join(', ')}`,
        sonrakiEylem: 'Yöneticinizden bu izni talep edin.',
        gerekenIzinler: eksik,
      });
    }
    return true;
  }
}
