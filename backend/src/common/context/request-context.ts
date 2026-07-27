/**
 * İstek bağlamı — AsyncLocalStorage ile taşınır.
 *
 * Tenant bağlamı buradan okunur ve her transaction başında
 * `SET LOCAL app.tenant_id` çalıştırılır (BFS v1 §2.3).
 * Bağlam yoksa sorgu sessizce geçmez — hata verir.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Principal, TenantBaglami } from '@bnos/kernel';

export interface IstekBaglami {
  readonly correlationId: string;
  readonly principal?: Principal;
  readonly tenant?: TenantBaglami;
  readonly ip: string | null;
  readonly kullaniciAjani: string | null;
}

const depo = new AsyncLocalStorage<IstekBaglami>();

export const baglamIcinde = <T>(baglam: IstekBaglami, fn: () => T): T =>
  depo.run(baglam, fn);

export const mevcutBaglam = (): IstekBaglami | undefined => depo.getStore();

export function mevcutBaglamiZorunluKil(islem: string): IstekBaglami {
  const b = depo.getStore();
  if (!b) throw new Error(`İstek bağlamı yok: '${islem}' çalıştırılamaz.`);
  return b;
}
