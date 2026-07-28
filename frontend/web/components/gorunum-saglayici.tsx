'use client';

/**
 * Görünüm tercihleri — tema (koyu/açık) ve yoğunluk (rahat/sıkışık).
 *
 * İki eksen BAĞIMSIZDIR: sıkışık açık tema da, rahat koyu tema da geçerlidir.
 * Tek bir "görünüm" değerine bağlanırsa kullanıcı birini değiştirmek için
 * diğerinden vazgeçmek zorunda kalır.
 *
 * Tercih `localStorage`'da tutulur; ilk açılışta işletim sistemi tercihi
 * (`prefers-color-scheme`) okunur — kullanıcı sistemini açık temaya almışsa
 * uygulamanın koyu açılması sürpriz olur.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type TemaModu = 'koyu' | 'acik';
export type YogunlukModu = 'rahat' | 'sikisik';

const TEMA_ANAHTARI = 'bnos.tema';
const YOGUNLUK_ANAHTARI = 'bnos.yogunluk';

interface GorunumDegeri {
  readonly tema: TemaModu;
  readonly yogunluk: YogunlukModu;
  readonly temaAyarla: (t: TemaModu) => void;
  readonly yogunlukAyarla: (y: YogunlukModu) => void;
}

const Baglam = createContext<GorunumDegeri | null>(null);

export function useGorunum(): GorunumDegeri {
  const deger = useContext(Baglam);
  if (deger === null) {
    throw new Error('useGorunum, GorunumSaglayici içinde çağrılmalıdır.');
  }
  return deger;
}

function sistemTemasi(): TemaModu {
  if (typeof window === 'undefined') return 'koyu';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'acik' : 'koyu';
}

export function GorunumSaglayici({ children }: { readonly children: ReactNode }) {
  // Sunucu ve ilk istemci render'i AYNI olmalidir; tercih okumasi effect'te
  // yapilir. Aksi halde hydration uyusmazligi olusur.
  const [tema, setTema] = useState<TemaModu>('koyu');
  const [yogunluk, setYogunluk] = useState<YogunlukModu>('rahat');

  useEffect(() => {
    const kayitliTema = localStorage.getItem(TEMA_ANAHTARI) as TemaModu | null;
    const kayitliYogunluk = localStorage.getItem(YOGUNLUK_ANAHTARI) as YogunlukModu | null;
    setTema(kayitliTema ?? sistemTemasi());
    if (kayitliYogunluk !== null) setYogunluk(kayitliYogunluk);
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = tema;
    // Tarayici form denetimlerini de temaya uydurur (scrollbar, select vb.).
    document.documentElement.style.colorScheme = tema === 'acik' ? 'light' : 'dark';
  }, [tema]);

  useEffect(() => {
    document.body.dataset['density'] = yogunluk;
  }, [yogunluk]);

  const temaAyarla = (t: TemaModu) => {
    setTema(t);
    localStorage.setItem(TEMA_ANAHTARI, t);
  };
  const yogunlukAyarla = (y: YogunlukModu) => {
    setYogunluk(y);
    localStorage.setItem(YOGUNLUK_ANAHTARI, y);
  };

  return (
    <Baglam.Provider value={{ tema, yogunluk, temaAyarla, yogunlukAyarla }}>
      {children}
    </Baglam.Provider>
  );
}
