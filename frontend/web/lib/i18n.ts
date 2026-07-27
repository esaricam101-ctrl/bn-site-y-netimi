import { getRequestConfig } from 'next-intl/server';

/**
 * TUM kullaniciya gorunen metin i18n anahtaridir (ADR v1.1 §40 · sozlesme testi CT-05).
 */
export const DESTEKLENEN_DILLER = ['tr'] as const;
export const VARSAYILAN_DIL = 'tr';

/**
 * Şablon literal ile dinamik import TypeScript'te `any` döner; sınır burada
 * tiplenir. Ağaç, next-intl'in `AbstractIntlMessages` tipiyle yapısal olarak
 * birebirdir — o tip paketten dışa aktarılmadığı için burada tanımlanır.
 */
type MesajAgaci = { [anahtar: string]: MesajAgaci | string };
type MesajModulu = { default: MesajAgaci };

export default getRequestConfig(async () => {
  const modul = (await import(`../messages/${VARSAYILAN_DIL}.json`)) as MesajModulu;
  return {
    locale: VARSAYILAN_DIL,
    messages: modul.default,
    timeZone: 'Europe/Istanbul',
  };
});
