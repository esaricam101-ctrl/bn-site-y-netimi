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
  /**
   * YÖNETİM DEVRİ (ADR-0009) — bu oturum bir yönetim firmasının, yönettiği bir
   * PROJE tenant'ı adına açtığı oturumsa firma tenant'ının kimliğidir.
   *
   * `tenantId` her zaman İŞLEM YAPILAN tenant'tır (proje); bu alan işlemi
   * KİMİN ADINA yaptığını söyler. Kapı 2 devrin geçerliliğini bununla
   * doğrular, denetim kaydı da bunu yazar — aksi hâlde projede yapılan bir
   * işlem, firmanın kullanıcısını projenin kullanıcısı gibi gösterirdi.
   *
   * Değer YALNIZCA jeton claim'inden gelir, istek parametresinden ASLA:
   * aksi hâlde kullanıcı istediği firmayı yazıp devri kendisi uydurabilirdi.
   */
  readonly devirYonetimTenantId?: string;
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
