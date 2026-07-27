/**
 * Domain event uretimi ve katalog — AIS v1 §4 · ADR v1.1 §31
 *
 * EVENT SOURCING KULLANILMAZ. Event kaybi veri kaybi degildir.
 * Outbox teslimat garantisi icindir, kayit kaynagi oldugu icin degil.
 */
import type { EventZarfi, TenantId, Principal } from '@bnos/kernel';
import { DogrulamaHatasi } from '../errors/domain-error.js';

/** <dikey>.<aggregate>.<gecmis zaman fiil> */
const EVENT_TIPI = /^[a-z]+\.[a-z_]+\.[a-z_]+$/;

export interface EventKatalogKaydi {
  readonly eventType: string;
  readonly eventVersion: number;
  readonly sahipModul: string;
  readonly aciklama: string;
}

/** Sprint basina genisler (DoD maddesi). Kayitsiz event yayinlanamaz. */
export const EVENT_KATALOGU: readonly EventKatalogKaydi[] = [
  { eventType: 'core.tenant.olusturuldu', eventVersion: 1, sahipModul: 'tenant', aciklama: 'Yeni apartman tenant kaydi olusturuldu' },
  { eventType: 'core.tenant.aktiflestirildi', eventVersion: 1, sahipModul: 'tenant', aciklama: 'Tenant kurulumdan aktif duruma gecti' },
  { eventType: 'core.kisi.olusturuldu', eventVersion: 1, sahipModul: 'kisi', aciklama: 'Kisi kaydi olusturuldu' },
  { eventType: 'core.kisi.guncellendi', eventVersion: 1, sahipModul: 'kisi', aciklama: 'Kisi kaydi guncellendi' },
  { eventType: 'core.kisi.silindi', eventVersion: 1, sahipModul: 'kisi', aciklama: 'Kisi kaydi soft-delete edildi' },
  // Bagimsiz bolum 'apartman' dikeyindedir; core degildir (BFS v1 §1.3 paket siniri).
  { eventType: 'apartman.bagimsiz_bolum.olusturuldu', eventVersion: 1, sahipModul: 'bolum', aciklama: 'Bagimsiz bolum kaydi olusturuldu' },
  { eventType: 'apartman.bagimsiz_bolum.silindi', eventVersion: 1, sahipModul: 'bolum', aciklama: 'Bagimsiz bolum kaydi soft-delete edildi' },
  { eventType: 'apartman.bolum_iliskisi.kuruldu', eventVersion: 1, sahipModul: 'iliski', aciklama: 'Bolume malik veya kiraci baglandi' },
  { eventType: 'apartman.bolum_iliskisi.sonlandirildi', eventVersion: 1, sahipModul: 'iliski', aciklama: 'Malik veya kiraci iliskisi bitis tarihi aldi' },
  { eventType: 'apartman.blok.olusturuldu', eventVersion: 1, sahipModul: 'blok', aciklama: 'Blok kaydi olusturuldu' },
  { eventType: 'apartman.blok.silindi', eventVersion: 1, sahipModul: 'blok', aciklama: 'Blok kaydi soft-delete edildi' },
];

const KATALOG_INDEKS = new Map(
  EVENT_KATALOGU.map((k) => [`${k.eventType}@${k.eventVersion}`, k]),
);

export function katalogdaVarMi(eventType: string, eventVersion: number): boolean {
  return KATALOG_INDEKS.has(`${eventType}@${eventVersion}`);
}

export interface EventGirdisi<T> {
  readonly eventType: string;
  readonly eventVersion: number;
  readonly tenantId: TenantId;
  readonly principal: Principal;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly aggregate: { readonly tip: string; readonly id: string; readonly version: number };
  readonly payload: T;
}

/**
 * Standart zarfi uretir ve katalog kaydini dogrular.
 * Kayitsiz event uretilemez — sozlesme testinin zorladigi kural (BFS v1 §14.1).
 */
export function eventOlustur<T>(
  girdi: EventGirdisi<T>,
  eventId: string,
  simdi: Date,
): EventZarfi<T> {
  if (!EVENT_TIPI.test(girdi.eventType)) {
    throw new DogrulamaHatasi(
      `Gecersiz event tipi: '${girdi.eventType}'. Bicim: <dikey>.<aggregate>.<gecmis_zaman_fiil>`,
    );
  }
  if (!katalogdaVarMi(girdi.eventType, girdi.eventVersion)) {
    throw new DogrulamaHatasi(
      `Event katalogda kayitli degil: ${girdi.eventType}@v${girdi.eventVersion}. ` +
        `Once EVENT_KATALOGU'na ekleyin (AIS v1 §4.3).`,
      'AIS v1 event katalogunu guncelleyin.',
    );
  }
  return {
    eventId,
    eventType: girdi.eventType,
    eventVersion: girdi.eventVersion,
    occurredAt: simdi,
    tenantId: girdi.tenantId,
    principal: { id: girdi.principal.id, tip: girdi.principal.tip },
    correlationId: girdi.correlationId,
    causationId: girdi.causationId ?? null,
    aggregate: girdi.aggregate,
    payload: girdi.payload,
  };
}
