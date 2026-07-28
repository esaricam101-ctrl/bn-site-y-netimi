'use client';

/**
 * Apartman listesi — hiyerarşinin tenant altındaki ilk katmanı (ADR-0008).
 *
 * Bir yerleşkedeki apartman sayısı küçüktür (tek apartmanda 1, büyük sitede
 * onlarca); tablo yerine kart ızgarası kullanılır. Kart, adres ve blok
 * sayısını birlikte gösterir — tabloda adres satırı taşar.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { servis, type Apartman } from '@/lib/servis';

export default function ApartmanlarSayfasi() {
  const t = useTranslations('apartman');
  const tn = useTranslations('navigasyon');

  const [satirlar, setSatirlar] = useState<readonly Apartman[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.apartmanlar().then(setSatirlar).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[{ etiket: tn('genelBakis'), yol: '/yonetim' }, { etiket: tn('apartmanlar') }]}
    >
      {yukleniyor && <Yukleniyor satir={3} />}
      {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
      {!yukleniyor && hata === null && satirlar.length === 0 && (
        <BosDurum aciklama={t('bosAciklama')} />
      )}

      {!yukleniyor && hata === null && satirlar.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {satirlar.map((a) => (
            <Link
              key={a.id}
              href={`/bloklar?apartmanId=${a.id}`}
              className="glass p-[var(--cardpad)] hover:border-[color:var(--primary)] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{a.ad}</h2>
                {a.siteIciKod !== null && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-[color:var(--line)]">
                    {a.siteIciKod}
                  </span>
                )}
              </div>

              {/* Adres harita entegrasyonuna hazir; koordinat alani henuz yok. */}
              {a.adres !== null && (
                <p className="text-sm mt-2 text-[color:var(--muted)]">{a.adres}</p>
              )}

              <p className="text-sm mt-3 num">
                <span className="text-[color:var(--muted-2)]">{t('blokSayisi')}: </span>
                {a.blokSayisi}
              </p>
            </Link>
          ))}
        </div>
      )}
    </UygulamaKabugu>
  );
}
