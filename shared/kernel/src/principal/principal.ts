/**
 * Birleşik Principal modeli — ADR v1.1 §39 · ADR-0006
 *
 * Aynı kural §24 (AI Agent), §27 (Plugin) ve §39 (Cihaz) için ayrı ayrı
 * tekrarlanıyordu. Tek modelde birleştirildi: her principal kendi kimliğiyle
 * Audit Log'a yazar ve yetkisi devraldığı kapsamın ALT KÜMESİDİR.
 */
import type { TenantId } from '../tenant/tenant-context.js';

export type PrincipalTipi = 'INSAN' | 'AGENT' | 'PLUGIN' | 'CIHAZ' | 'SISTEM';

export interface Principal {
  readonly id: string;
  readonly tip: PrincipalTipi;
  readonly tenantId: TenantId;
  readonly izinler: readonly string[];
  /** Yetkinin devralındığı principal. Devralınan yetki daima alt kümedir. */
  readonly devraldigiPrincipalId?: string;
}

/**
 * Devralınmış yetkinin alt küme kuralı — tek yerde uygulanır (PermissionGuard),
 * her çağrı yerinde tekrarlanmaz.
 */
export function devredilmisIzinleriCoz(
  devreden: Principal,
  istenen: readonly string[],
): readonly string[] {
  const kapsam = new Set(devreden.izinler);
  return istenen.filter((izin) => kapsam.has(izin));
}

export function izniVarMi(principal: Principal, izin: string): boolean {
  return principal.izinler.includes(izin);
}
