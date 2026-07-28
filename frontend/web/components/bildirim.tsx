'use client';

/**
 * Bildirim (toast) merkezi — işlem sonucu geri bildirimi.
 *
 * Bir kayıt eklendiğinde ekranda hiçbir şey değişmezse kullanıcı işlemin
 * yapılıp yapılmadığını bilemez ve genellikle ikinci kez dener.
 *
 * ERİŞİLEBİLİRLİK: kapsayıcı `role="status"` + `aria-live="polite"` taşır.
 * Hata bildirimi `assertive` DEĞİLDİR — ekran okuyucuyu kesmek, kullanıcının
 * o an okuduğu şeyi kaybettirir; hata zaten formun yanında da gösterilir.
 *
 * Bildirim kendiliğinden kaybolur ama kapatma düğmesi de vardır: motor beceri
 * kısıtı olan kullanıcı okumayı bitirmeden kaybolmasını istemeyebilir.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type BildirimTuru = 'basari' | 'hata' | 'bilgi';

interface Bildirim {
  readonly id: number;
  readonly tur: BildirimTuru;
  readonly mesaj: string;
}

interface BildirimDegeri {
  readonly basari: (mesaj: string) => void;
  readonly hata: (mesaj: string) => void;
  readonly bilgi: (mesaj: string) => void;
}

const Baglam = createContext<BildirimDegeri | null>(null);

export function useBildirim(): BildirimDegeri {
  const deger = useContext(Baglam);
  if (deger === null) {
    throw new Error('useBildirim, BildirimSaglayici içinde çağrılmalıdır.');
  }
  return deger;
}

const SURE_MS = 5000;

export function BildirimSaglayici({ children }: { readonly children: ReactNode }) {
  const [liste, setListe] = useState<readonly Bildirim[]>([]);

  const ekle = useCallback((tur: BildirimTuru, mesaj: string) => {
    // Date.now() yerine artan sayac: ayni milisaniyede iki bildirim ayni
    // anahtari alirsa React biri kaybolur.
    setListe((l) => [...l, { id: (l[l.length - 1]?.id ?? 0) + 1, tur, mesaj }]);
  }, []);

  const kaldir = useCallback((id: number) => {
    setListe((l) => l.filter((b) => b.id !== id));
  }, []);

  const deger: BildirimDegeri = {
    basari: useCallback((m: string) => ekle('basari', m), [ekle]),
    hata: useCallback((m: string) => ekle('hata', m), [ekle]),
    bilgi: useCallback((m: string) => ekle('bilgi', m), [ekle]),
  };

  return (
    <Baglam.Provider value={deger}>
      {children}
      <BildirimYigini liste={liste} kaldir={kaldir} />
    </Baglam.Provider>
  );
}

function BildirimYigini({
  liste, kaldir,
}: {
  readonly liste: readonly Bildirim[];
  readonly kaldir: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm print:hidden"
    >
      {liste.map((b) => (
        <BildirimKutusu key={b.id} bildirim={b} kapat={() => kaldir(b.id)} />
      ))}
    </div>
  );
}

function BildirimKutusu({
  bildirim, kapat,
}: {
  readonly bildirim: Bildirim;
  readonly kapat: () => void;
}) {
  const t = useTranslations('genel');

  useEffect(() => {
    const zaman = setTimeout(kapat, SURE_MS);
    return () => clearTimeout(zaman);
  }, [kapat]);

  const renk =
    bildirim.tur === 'basari' ? 'var(--success)'
      : bildirim.tur === 'hata' ? 'var(--crit)'
        : 'var(--info)';

  const simge = bildirim.tur === 'basari' ? '✓' : bildirim.tur === 'hata' ? '✕' : 'ℹ';

  return (
    <div
      className="glass p-3 pr-2 flex items-start gap-2 border-l-4 shadow-lg"
      style={{ borderLeftColor: renk }}
    >
      {/* Simge tek basina anlam tasimaz; renk ve metin birlikte calisir. */}
      <span aria-hidden="true" style={{ color: renk }}>{simge}</span>
      <p className="text-sm flex-1">{bildirim.mesaj}</p>
      <button
        type="button"
        onClick={kapat}
        aria-label={t('kapat')}
        className="text-[color:var(--muted)] hover:text-[color:var(--text)] px-1"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
