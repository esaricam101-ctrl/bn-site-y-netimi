'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiHatasi } from '@/lib/api';

interface GirisYaniti {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly varsayilanPanel: string;
  readonly kullanici: {
    readonly id: string;
    readonly adSoyad: string;
    readonly tenantId: string;
    readonly tenantAdi: string;
    /** `SITE` | `APARTMAN` | `YONETIM_SIRKETI` — kabuk başlığı için. */
    readonly tenantTipi: string;
    readonly roller: readonly string[];
  };
}

/**
 * Tek giris ekrani — rol bazli yonlendirme.
 * Kullanici giris yaptiktan sonra rolune uygun panele yonlendirilir.
 */
export default function GirisSayfasi() {
  const t = useTranslations('giris');
  const tg = useTranslations('genel');
  const th = useTranslations('hatalar');
  const router = useRouter();

  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<{ mesaj: string; eylem?: string; kod?: string } | null>(null);

  async function gonder(): Promise<void> {
    setYukleniyor(true);
    setHata(null);
    try {
      const yanit = await api<GirisYaniti>('/oturum/giris', {
        method: 'POST',
        govde: { eposta, sifre },
      });
      // Belirteç sessionStorage'da tutulur: sekme kapanınca silinir.
      // tenantId yalnızca ARAYÜZ kolaylığı içindir — sunucu tarafında tenant
      // kimliği DAİMA token claim'inden okunur, istemciden ASLA (BFS v1 §12).
      sessionStorage.setItem('bnos.token', yanit.accessToken);
      sessionStorage.setItem('bnos.tenantId', yanit.kullanici.tenantId);
      sessionStorage.setItem('bnos.tenantAdi', yanit.kullanici.tenantAdi);
      // Kabuk başlığı hangi projede olunduğunu yazar; tip rozeti oradan okunur.
      sessionStorage.setItem('bnos.tenantTipi', yanit.kullanici.tenantTipi);
      router.push(yanit.varsayilanPanel);
    } catch (h) {
      // Hicbir hata mesaji yalnizca "Bir hata olustu" degildir (BFS v1 §12).
      if (h instanceof ApiHatasi) {
        setHata({
          mesaj: h.problem.status === 401 ? t('hataliKimlik') : h.problem.detail,
          ...(h.problem.sonrakiEylem ? { eylem: h.problem.sonrakiEylem } : {}),
          kod: h.problem.correlationId,
        });
      } else {
        setHata({ mesaj: th('ag') });
      }
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="glass w-full max-w-sm p-6">
        <h1 className="text-xl font-bold mb-1">{t('baslik')}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted-2)' }}>
          {t('aciklama')}
        </p>

        <label className="block mb-4">
          <span className="block text-sm mb-1">{t('eposta')}</span>
          <input
            type="email"
            autoComplete="email"
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            className="w-full rounded-control bg-black/20 border border-white/10 px-3 py-2"
          />
        </label>

        <label className="block mb-6">
          <span className="block text-sm mb-1">{t('sifre')}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="w-full rounded-control bg-black/20 border border-white/10 px-3 py-2"
          />
        </label>

        {hata && (
          <div role="alert" aria-live="polite" className="mb-4 text-sm" style={{ color: 'var(--crit)' }}>
            <p>{hata.mesaj}</p>
            {hata.eylem && <p style={{ color: 'var(--muted)' }}>{th('sonrakiEylem', { eylem: hata.eylem })}</p>}
            {hata.kod && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted-2)' }}>
                {th('destekNumarasi', { correlationId: hata.kod })}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => void gonder()}
          disabled={yukleniyor || !eposta || !sifre}
          className="w-full py-2.5 rounded-control font-semibold disabled:opacity-50"
          style={{ background: 'var(--grad)', color: '#fff' }}
        >
          {yukleniyor ? tg('yukleniyor') : t('gonder')}
        </button>
      </div>
    </main>
  );
}
