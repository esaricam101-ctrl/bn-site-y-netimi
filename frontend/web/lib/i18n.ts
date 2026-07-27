import { getRequestConfig } from 'next-intl/server';

/**
 * TUM kullaniciya gorunen metin i18n anahtaridir (ADR v1.1 §40 · sozlesme testi CT-05).
 */
export const DESTEKLENEN_DILLER = ['tr'] as const;
export const VARSAYILAN_DIL = 'tr';

export default getRequestConfig(async () => ({
  locale: VARSAYILAN_DIL,
  messages: (await import(`../messages/${VARSAYILAN_DIL}.json`)).default,
  timeZone: 'Europe/Istanbul',
}));
