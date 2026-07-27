/**
 * Önbellek anahtar sözleşmesi — ADR-0005 · ADR v1.1 §37 · BFS v1 §7
 *
 *   t:{tenantId}:{alan}:{kimlik}:{sürüm}
 *
 * tenantId içermeyen önbellek anahtarı, çok kiracılı sistemde VERİ SIZINTISIDIR.
 * RLS önbelleği korumaz.
 *
 * Kural iki katmanda zorlanır:
 *   1. Tip düzeyi — bu modül tenantId olmadan anahtar üretemez
 *   2. Lint kuralı — tools/eslint-rules/require-tenant-cache-key.js
 *      ham string ile redis çağrısını reddeder
 */
import type { TenantId } from '../tenant/tenant-context.js';

export type OnbellekAnahtari = string & { readonly __marka: 'OnbellekAnahtari' };

/** Önbelleklenmesi ADR-0005 ile YASAKLANMIŞ alanlar. */
export const YASAKLI_ALANLAR = [
  'bakiye',
  'cari-hesap',
  'borc-durumu',
  'yaslandirma',
  'nakit',
  'mizan',
  'defter',
] as const;

export type YasakliAlan = (typeof YASAKLI_ALANLAR)[number];

export class OnbellekPolitikaHatasi extends Error {
  override readonly name = 'OnbellekPolitikaHatasi';
}

export interface AnahtarParcalari {
  readonly tenantId: TenantId;
  readonly alan: string;
  readonly kimlik: string;
  readonly surum: number;
}

/**
 * Tek meşru anahtar üreticisi.
 *
 * Yasaklı alan verilirse çalışma zamanında hata verir — "bayat finansal rakam,
 * yavaş finansal rakamdan kötüdür" (ADR-0005). Performans gerekiyorsa çözüm
 * önbellek değil, transaction içinde bakımı yapılan özet tablodur (BFS v1 §7.4).
 */
export function onbellekAnahtari(parcalar: AnahtarParcalari): OnbellekAnahtari {
  const { tenantId, alan, kimlik, surum } = parcalar;

  if ((YASAKLI_ALANLAR as readonly string[]).includes(alan)) {
    throw new OnbellekPolitikaHatasi(
      `'${alan}' önbelleklenemez (ADR-0005 · ADR v1.1 §37). ` +
        `Finansal bakiye, cari hesap ve borç durumu her zaman kaynaktan okunur. ` +
        `Performans için transaction içinde bakımı yapılan özet tablo kullanın — ` +
        `özet tablo önbellek değildir, kayıt kaynağının parçasıdır (BFS v1 §7.4).`,
    );
  }
  if (!alan || alan.includes(':')) {
    throw new OnbellekPolitikaHatasi(`Geçersiz önbellek alanı: '${alan}'`);
  }

  return `t:${tenantId}:${alan}:${kimlik}:v${surum}` as OnbellekAnahtari;
}

/** Bir tenant'ın belirli bir alanındaki tüm anahtarları geçersizleştirme deseni. */
export function gecersizlestirmeDeseni(tenantId: TenantId, alan: string): string {
  return `t:${tenantId}:${alan}:*`;
}
