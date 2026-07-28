'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';

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
  const tn = useTranslations('navigasyon');

  const [ozet, setOzet] = useState<TenantOzeti | null>(null);
  // Hata NESNESI tutulur, metni degil: HataDurumu korelasyon kimligini ve
  // "sonraki eylem" alanini gosterir (BFS v1 §12).
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('bnos.token') ?? undefined;
    const tenantId = sessionStorage.getItem('bnos.tenantId') ?? '';

    api<TenantOzeti>(`/tenants/${tenantId}`, { ...(token ? { token } : {}) })
      .then(setOzet)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  const kirintilar = [{ etiket: tn('genelBakis') }];

  return (
    <UygulamaKabugu baslik={t('baslik')} kirintilar={kirintilar}>
      {yukleniyor && <Yukleniyor />}

      {!yukleniyor && hata !== null && <HataDurumu hata={hata} />}

      {!yukleniyor && hata === null && ozet === null && <BosDurum />}

      {!yukleniyor && hata === null && ozet !== null && (
        <div className="max-w-5xl">
          <p className="mb-4 text-[color:var(--muted-2)]">{ozet.ad}</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kart baslik={t('bolumSayisi')} deger={String(ozet.bolumSayisi)} />
            <Kart baslik={t('kisiSayisi')} deger={String(ozet.kisiSayisi)} />
            <Kart baslik={t('durum')} deger={t(`durum${ozet.durum}`)} />
          </div>

          {/* Finansal veri tazeligi kullaniciya ACIKCA soylenir (ADR-0005). */}
          <p className="mt-6 text-xs text-[color:var(--muted-2)]">
            {t('finansalVeriTaze')}
          </p>
        </div>
      )}
    </UygulamaKabugu>
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
