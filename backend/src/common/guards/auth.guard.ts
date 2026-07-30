/**
 * KAPI 1 — KİMLİK (ADR-0006 · BFS v1 §3)
 *
 * JWT doğrulanır, Principal çözülür. Başarısızlık: 401.
 * Sıra değişmez — izinler tenant'a göreli olduğu için Kapı 3'ten önce gelir.
 */
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { tenantId, type Principal, type PrincipalTipi } from '@bnos/kernel';
import { PUBLIC_ANAHTARI } from '../decorators';
import { mevcutBaglam } from '../context/request-context';

interface JwtYuku {
  readonly sub: string;
  readonly tip: PrincipalTipi;
  readonly tid: string;
  readonly izinler: string[];
  readonly devraldigi?: string;
  /**
   * YÖNETİM DEVRİ (ADR-0009): oturum bir yönetim firmasının, yönettiği bir
   * proje adına açtığı oturumsa firma tenant'ının kimliği. `tid` bu durumda
   * PROJE tenant'ıdır. Kapı 2 devrin geçerliliğini bu iki değerle doğrular.
   */
  readonly dvr?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const gerekce = this.reflector.getAllAndOverride<string | undefined>(PUBLIC_ANAHTARI, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (gerekce) return true;

    const istek = ctx.switchToHttp().getRequest<Request & { principal?: Principal }>();
    const baslik = istek.headers.authorization;
    if (!baslik?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        mesaj: 'Kimlik doğrulaması gerekli.',
        sonrakiEylem: 'Giriş yapıp isteği tekrarlayın.',
      });
    }

    let yuk: JwtYuku;
    try {
      yuk = await this.jwt.verifyAsync<JwtYuku>(baslik.slice(7));
    } catch {
      throw new UnauthorizedException({
        mesaj: 'Oturum geçersiz veya süresi dolmuş.',
        sonrakiEylem: 'Yeniden giriş yapın.',
      });
    }

    const principal: Principal = {
      id: yuk.sub,
      tip: yuk.tip,
      tenantId: tenantId(yuk.tid),
      izinler: yuk.izinler,
      ...(yuk.devraldigi ? { devraldigiPrincipalId: yuk.devraldigi } : {}),
      ...(yuk.dvr ? { devirYonetimTenantId: yuk.dvr } : {}),
    };

    istek.principal = principal;
    const baglam = mevcutBaglam();
    if (baglam) Object.assign(baglam, { principal });
    return true;
  }
}
