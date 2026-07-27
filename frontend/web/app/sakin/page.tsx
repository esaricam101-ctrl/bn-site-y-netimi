'use client';

import { useTranslations } from 'next-intl';

/**
 * Sakin paneli — Malik, Kiraci ve Sakin rolleri buraya yonlendirilir.
 *
 * KVKK (ADR v1.1 §10): Sakinler birbirinin borc, iletisim ve kisisel
 * bilgisine ERISEMEZ. Bu kisit sunucu tarafinda zorlanir; buradaki
 * gizleme yalnizca kullanilabilirlik icindir, guvenlik siniri DEGILDIR.
 */
export default function SakinPaneli() {
  const t = useTranslations('navigasyon');
  const tg = useTranslations('genel');

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-6">{t('genelBakis')}</h1>
      <div className="glass p-5">
        <p style={{ color: 'var(--muted)' }}>{tg('veriYok')}</p>
      </div>
    </main>
  );
}
