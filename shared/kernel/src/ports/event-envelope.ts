/**
 * Event zarfı ve Outbox — AIS v1 §4 · ADR v1.1 §31
 *
 * EVENT SOURCING KULLANILMAZ. PostgreSQL ilişkisel model tek ve nihai
 * kayıt kaynağıdır. Event kaybı veri kaybı değildir — kaybolan event
 * bozulmuş entegrasyondur; kayıt bozulmaz.
 *
 * Bilgi yalnızca event'te yaşayamaz. "Neden değişti" bilgisi audit tablosunda
 * tutulur, event'e bırakılmaz.
 */
import type { TenantId } from '../tenant/tenant-context.js';
import type { PrincipalTipi } from '../principal/principal.js';

export interface EventZarfi<TYuk = unknown> {
  /** Idempotency anahtarı. Tüketiciler yinelenen teslimatı sessizce yutar. */
  readonly eventId: string;
  /** <dikey>.<aggregate>.<geçmiş zaman fiil> — örn. apartman.borc.olusturuldu */
  readonly eventType: string;
  readonly eventVersion: number;
  /** timestamptz UTC */
  readonly occurredAt: Date;
  readonly tenantId: TenantId;
  readonly principal: { readonly id: string; readonly tip: PrincipalTipi };
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly aggregate: {
    readonly tip: string;
    readonly id: string;
    readonly version: number;
  };
  readonly payload: TYuk;
}

/**
 * Event kataloğu kaydı. Kayıtsız event yayınlanamaz —
 * sözleşme testi bunu doğrular (BFS v1 §14.1).
 */
export interface EventKatalogKaydi {
  readonly eventType: string;
  readonly eventVersion: number;
  readonly sahipModul: string;
  readonly aciklama: string;
  readonly yukSemasi: Record<string, unknown>;
}

/**
 * Outbox — teslimat garantisi için zorunludur (§31),
 * kayıt kaynağı olduğu için değil.
 *
 * Event, domain yazmasıyla AYNI TRANSACTION İÇİNDE yazılır.
 */
export interface OutboxYazici {
  yaz<T>(zarf: EventZarfi<T>): Promise<void>;
}

export class EventKatalogHatasi extends Error {
  override readonly name = 'EventKatalogHatasi';
}
