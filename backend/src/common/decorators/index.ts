import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Izin } from '@bnos/core-domain';
import type { Principal } from '@bnos/kernel';

/** Üç kapıyı atlar. AÇIK ve GEREKÇELİ olmalıdır (BFS v1 §3). */
export const PUBLIC_ANAHTARI = 'bnos:public';
export const Public = (gerekce: string): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ANAHTARI, gerekce);

/** Kapı 2'yi atlar — yalnızca tenant seçimi öncesi uçlar için. */
export const TENANTSIZ_ANAHTARI = 'bnos:tenantsiz';
export const Tenantsiz = (gerekce: string): MethodDecorator =>
  SetMetadata(TENANTSIZ_ANAHTARI, gerekce);

/** Kapı 3 — gerekli izin. */
export const IZIN_ANAHTARI = 'bnos:izin';
export const RequirePermission = (...izinler: Izin[]): MethodDecorator =>
  SetMetadata(IZIN_ANAHTARI, izinler);

/** Çözülmüş principal. */
export const AktifPrincipal = createParamDecorator(
  (_veri: unknown, ctx: ExecutionContext): Principal => {
    const principal = ctx.switchToHttp().getRequest<{ principal?: Principal }>().principal;
    if (!principal) {
      throw new Error('Principal çözülmedi. AuthGuard önce çalışmalıdır.');
    }
    return principal;
  },
);

export { CurrentUser } from './current-user.decorator';
