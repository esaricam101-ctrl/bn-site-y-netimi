/**
 * Audit Log — degistirilemez, hash zincirli (ADR v1.1 §31).
 *
 * Bu Event Sourcing DEGILDIR. Degistirilemezlik hukuki gerekliligin sonucudur.
 * "Neden degisti" bilgisi burada tutulur, event'e birakilmaz.
 */
import type { TenantId, PrincipalTipi } from '@bnos/kernel';

export type AuditEylemi =
  | 'OLUSTUR' | 'GUNCELLE' | 'SOFT_SIL' | 'ANONIMLESTIR'
  | 'OKU' | 'DISA_AKTAR' | 'ONAYLA' | 'REDDET' | 'GIRIS' | 'CIKIS';

export interface AuditKaydi {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly principalId: string;
  readonly principalTipi: PrincipalTipi;
  readonly eylem: AuditEylemi;
  readonly varlik: string;
  readonly varlikId: string;
  readonly oncekiDeger: Readonly<Record<string, unknown>> | null;
  readonly sonrakiDeger: Readonly<Record<string, unknown>> | null;
  readonly gerekce: string | null;
  readonly correlationId: string;
  readonly ip: string | null;
  readonly kullaniciAjani: string | null;
  /** timestamptz UTC (BFS v1 §4.1). */
  readonly olusmaAni: Date;
  /** Onceki kaydin hash'i — zincir butunlugu. */
  readonly oncekiHash: string | null;
  readonly hash: string;
}

/** KVKK: audit kaydinda ham kisisel veri tutulmaz. */
const HASSAS_ALANLAR = new Set([
  'tcKimlikNo', 'sifre', 'sifreHash', 'telefon', 'eposta', 'iban', 'adres',
]);

export function auditIcinMaskele(
  deger: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> | null {
  if (deger === null) return null;
  const cikti: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(deger)) {
    cikti[k] = HASSAS_ALANLAR.has(k) ? '***' : v;
  }
  return cikti;
}

/**
 * Zincir hash'i icin kanonik girdi. Hash hesabi altyapi katmanindadir —
 * domain katmani platform bagimsizdir (BFS v1 §1.3).
 */
export function auditHashGirdisi(k: Omit<AuditKaydi, 'hash'>): string {
  return [
    k.id, k.tenantId, k.principalId, k.principalTipi, k.eylem,
    k.varlik, k.varlikId, k.correlationId,
    k.olusmaAni.toISOString(), k.oncekiHash ?? '',
    JSON.stringify(k.oncekiDeger ?? null), JSON.stringify(k.sonrakiDeger ?? null),
  ].join('|');
}
