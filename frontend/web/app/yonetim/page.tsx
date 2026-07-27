'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiHatasi } from '@/lib/api';

interface TenantOzeti {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly durum: string;
  readonly saatDilimi: string;
  readonly bolumSayisi: number;
  readonly kisiSayisi: number;
}

/**
 * Yonetim paneli — Faz 0 dikey diliminin gorunur ucu.
 *
 * ONEMLI (ADR-0005): Bu ekrandaki finansal rakamlar onbeklenmez.
 * Ozet ucu KPI tanimi ve yerlesim gibi onbekleklenebilir kismi ile
 * bakiye gibi onbeklenmeyen kismi AYRI tasir.
 */
export default function YonetimPaneli() {
  const t = useTranslations('panel');
  const tg = useTranslations('genel');
  const th = useTranslations('hatalar');

  const [ozet, setOzet] = useState<TenantOzeti | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('bnos.token') ?? undefined;
    const tenantId = sessionStorage.getItem('bnos.tenantId') ?? '';

    api<TenantOzeti>(`/tenants/${tenantId}`, { ...(token ? { token } : {}) })
      .then(setOzet)
      .catch((h: unknown) => {
        setHata(h instanceof ApiHatasi ? h.problem.detail : th('ag'));
      })
      .finally(() => setYukleniyor(false));
  }, [th]);

  if (yukleniyor) return <main className="p-6">{tg('yukleniyor')}</main>;

  if (hata) {
    return (
      <main className="p-6">
        <div role="alert" className="glass p-4" style={{ color: 'var(--crit)' }}>
          {hata}
        </div>
      </main>
    );
  }

  if (!ozet) return <main className="p-6">{tg('veriYok')}</main>;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">{t('baslik')}</h1>
        <p style={{ color: 'var(--muted-2)' }}>{ozet.ad}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kart baslik={t('bolumSayisi')} deger={String(ozet.bolumSayisi)} />
        <Kart baslik={t('kisiSayisi')} deger={String(ozet.kisiSayisi)} />
        <Kart baslik={t('durum')} deger={t(`durum${ozet.durum}`)} />
      </div>

      {/* Finansal veri tazeligi kullaniciya ACIKCA soylenir (ADR-0005). */}
      <p className="mt-6 text-xs" style={{ color: 'var(--muted-2)' }}>
        {t('finansalVeriTaze')}
      </p>
    </main>
  );
}

function Kart({ baslik, deger }: { readonly baslik: string; readonly deger: string }) {
  return (
    <div className="glass p-5">
      <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{baslik}</p>
      <p className="text-3xl font-bold num">{deger}</p>
    </div>
  );
}
