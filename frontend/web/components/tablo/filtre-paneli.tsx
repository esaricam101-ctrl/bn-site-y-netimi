'use client';

/**
 * Gelişmiş filtre paneli — koşul kurma ve kaydedilebilir filtreler.
 *
 * Hızlı arama tüm kolonlarda metin arar; bu panel KOLON BAZINDA ve işleçli
 * süzme yapar. İkisi birlikte çalışır (önce filtre, sonra arama).
 *
 * Kaydedilebilir filtre `localStorage`'da tutulur. Sunucuda saklanmamasının
 * nedeni kalıcılık tablosunun henüz olmaması değil, tercihte bulunması:
 * filtre kişisel bir çalışma alışkanlığıdır; kiracılar arası paylaşılırsa
 * bir yöneticinin görünümü diğerininkini değiştirir. Paylaşılan görünüm
 * gerekirse ayrı bir varlık olarak tasarlanmalıdır (TODO).
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DEGERSIZ_ISLECLER, TIP_ISLECLERI, kolonTipi, kosulEtkinMi,
} from './filtre';
import type {
  FiltreBaglaci, FiltreKosulu, FiltreOperatoru, Kolon, KayitliFiltre,
} from './tablo-tipleri';

const alanSinifi =
  'px-2 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent';

function kayitliOku(anahtar: string): readonly KayitliFiltre[] {
  if (typeof window === 'undefined') return [];
  try {
    const ham = localStorage.getItem(`bnos.filtre.${anahtar}`);
    if (ham === null) return [];
    const cozulen: unknown = JSON.parse(ham);
    return Array.isArray(cozulen) ? (cozulen as KayitliFiltre[]) : [];
  } catch {
    // Bozuk kayit arayuzu kilitlememeli.
    return [];
  }
}

export interface FiltrePaneliOzellikleri<T> {
  readonly kolonlar: readonly Kolon<T>[];
  readonly kosullar: readonly FiltreKosulu[];
  readonly baglac: FiltreBaglaci;
  readonly profilAnahtari: string;
  readonly onDegisti: (kosullar: readonly FiltreKosulu[], baglac: FiltreBaglaci) => void;
}

export function FiltrePaneli<T>({
  kolonlar, kosullar, baglac, profilAnahtari, onDegisti,
}: FiltrePaneliOzellikleri<T>) {
  const t = useTranslations('filtre');
  const tg = useTranslations('genel');

  const suzulebilir = kolonlar.filter((k) => k.filtrelenebilir !== false);
  const [kayitlilar, setKayitlilar] = useState<readonly KayitliFiltre[]>([]);
  const [ad, setAd] = useState('');
  const [uyari, setUyari] = useState<string | null>(null);

  // localStorage okumasi effect'te: sunucu ve ilk istemci render'i ayni kalir.
  useEffect(() => { setKayitlilar(kayitliOku(profilAnahtari)); }, [profilAnahtari]);

  const kayitliYaz = (yeni: readonly KayitliFiltre[]) => {
    setKayitlilar(yeni);
    localStorage.setItem(`bnos.filtre.${profilAnahtari}`, JSON.stringify(yeni));
  };

  const kosulEkle = () => {
    const ilk = suzulebilir[0];
    if (ilk === undefined) return;
    const tip = kolonTipi(ilk);
    const islec = TIP_ISLECLERI[tip][0] ?? 'icerir';
    onDegisti([...kosullar, { anahtar: ilk.anahtar, operator: islec, deger: '' }], baglac);
  };

  const kosulDegistir = (indeks: number, yama: Partial<FiltreKosulu>) => {
    onDegisti(
      kosullar.map((k, i) => (i === indeks ? { ...k, ...yama } : k)),
      baglac,
    );
  };

  /**
   * Kolon değişince işleç de sıfırlanır: "borç > 500" koşulunda kolon "ad"a
   * çevrilirse `buyuk` işleci metinde anlamsızdır ve sessizce hiçbir şey
   * eşleşmez.
   */
  const kolonDegistir = (indeks: number, anahtar: string) => {
    const kolon = suzulebilir.find((k) => k.anahtar === anahtar);
    if (kolon === undefined) return;
    const tip = kolonTipi(kolon);
    const mevcut = kosullar[indeks];
    const islecler = TIP_ISLECLERI[tip];
    const islec =
      mevcut !== undefined && islecler.includes(mevcut.operator)
        ? mevcut.operator
        : (islecler[0] ?? 'icerir');
    kosulDegistir(indeks, { anahtar, operator: islec, deger: '', deger2: undefined });
  };

  const kosulSil = (indeks: number) => {
    onDegisti(kosullar.filter((_, i) => i !== indeks), baglac);
  };

  const kaydet = () => {
    const temizAd = ad.trim();
    if (temizAd === '') { setUyari(t('adGerekli')); return; }
    if (kosullar.filter(kosulEtkinMi).length === 0) { setUyari(t('kosulGerekli')); return; }
    setUyari(null);
    // Ayni ad UZERINE yazilir; iki "borclular" arasindaki farki kimse bilemez.
    const digerleri = kayitlilar.filter((f) => f.ad !== temizAd);
    kayitliYaz([...digerleri, { ad: temizAd, baglac, kosullar }]);
    setAd('');
  };

  const yukle = (f: KayitliFiltre) => {
    onDegisti(f.kosullar, f.baglac);
    setAd(f.ad);
  };

  return (
    <div className="glass p-[var(--cardpad)] flex flex-col gap-4">
      {/* Kayitli filtreler */}
      {kayitlilar.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kayitlilar')}</span>
          {kayitlilar.map((f) => (
            <span key={f.ad}
                  className="inline-flex items-center rounded-[var(--rs)] border border-[color:var(--line)] overflow-hidden">
              <button type="button" onClick={() => yukle(f)}
                      className="px-3 py-1 text-sm hover:bg-[color:var(--glass-bg)]">
                {f.ad}
              </button>
              <button type="button"
                      onClick={() => kayitliYaz(kayitlilar.filter((x) => x.ad !== f.ad))}
                      aria-label={t('filtreyiSil', { ad: f.ad })}
                      className="px-2 py-1 text-sm border-l border-[color:var(--line)]"
                      style={{ color: 'var(--crit)' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Kosullar */}
      {kosullar.length === 0 && (
        <p className="text-sm text-[color:var(--muted)]">{t('kosulYok')}</p>
      )}

      <div className="flex flex-col gap-2">
        {kosullar.map((kosul, i) => {
          const kolon = suzulebilir.find((k) => k.anahtar === kosul.anahtar);
          const tip = kolon === undefined ? 'metin' : kolonTipi(kolon);
          const degersiz = DEGERSIZ_ISLECLER.includes(kosul.operator);
          const aralik = kosul.operator === 'aralik';
          const girdiTipi = tip === 'sayi' ? 'number' : tip === 'tarih' ? 'date' : 'text';

          return (
            <div key={`${kosul.anahtar}-${i}`} className="flex flex-wrap items-center gap-2">
              {/* Baglac YALNIZCA ilk kosuldan sonra gorunur ve degistirilebilir;
                  karisik oncelik (a VE b VEYA c) desteklenmez. */}
              <span className="w-16 text-xs text-[color:var(--muted-2)]">
                {i === 0 ? t('nerede') : null}
              </span>
              {i === 1 && (
                <select className={`${alanSinifi} text-sm`} value={baglac}
                        aria-label={t('baglac')}
                        onChange={(e) => onDegisti(kosullar, e.target.value as FiltreBaglaci)}>
                  <option value="VE">{t('ve')}</option>
                  <option value="VEYA">{t('veya')}</option>
                </select>
              )}
              {i > 1 && (
                <span className="px-2 text-sm text-[color:var(--muted-2)]">
                  {baglac === 'VE' ? t('ve') : t('veya')}
                </span>
              )}

              <select className={`${alanSinifi} text-sm`} value={kosul.anahtar}
                      aria-label={t('kolon')}
                      onChange={(e) => kolonDegistir(i, e.target.value)}>
                {suzulebilir.map((k) => (
                  <option key={k.anahtar} value={k.anahtar}>{k.baslik}</option>
                ))}
              </select>

              <select className={`${alanSinifi} text-sm`} value={kosul.operator}
                      aria-label={t('islec')}
                      onChange={(e) =>
                        kosulDegistir(i, {
                          operator: e.target.value as FiltreOperatoru,
                          ...(DEGERSIZ_ISLECLER.includes(e.target.value as FiltreOperatoru)
                            ? { deger: '' } : {}),
                        })}>
                {TIP_ISLECLERI[tip].map((o) => (
                  <option key={o} value={o}>{t(`islec_${o}`)}</option>
                ))}
              </select>

              {!degersiz && tip === 'secim' && (
                <select className={`${alanSinifi} text-sm`} value={kosul.deger}
                        aria-label={t('deger')}
                        onChange={(e) => kosulDegistir(i, { deger: e.target.value })}>
                  <option value="">{t('seciniz')}</option>
                  {(kolon?.secenekler ?? []).map((s) => (
                    <option key={s.deger} value={s.deger}>{s.etiket}</option>
                  ))}
                </select>
              )}

              {!degersiz && tip === 'mantik' && (
                <select className={`${alanSinifi} text-sm`} value={kosul.deger}
                        aria-label={t('deger')}
                        onChange={(e) => kosulDegistir(i, { deger: e.target.value })}>
                  <option value="evet">{t('evet')}</option>
                  <option value="hayir">{t('hayir')}</option>
                </select>
              )}

              {!degersiz && tip !== 'secim' && tip !== 'mantik' && (
                <input className={`${alanSinifi} text-sm w-40`} type={girdiTipi}
                       value={kosul.deger} aria-label={t('deger')}
                       onChange={(e) => kosulDegistir(i, { deger: e.target.value })} />
              )}

              {aralik && (
                <>
                  <span className="text-xs text-[color:var(--muted-2)]">{t('ile')}</span>
                  <input className={`${alanSinifi} text-sm w-40`} type={girdiTipi}
                         value={kosul.deger2 ?? ''} aria-label={t('ustSinir')}
                         onChange={(e) => kosulDegistir(i, { deger2: e.target.value })} />
                </>
              )}

              <button type="button" onClick={() => kosulSil(i)}
                      aria-label={t('kosuluSil')}
                      className="px-2 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]"
                      style={{ color: 'var(--crit)' }}>
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={kosulEkle}
                className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('kosulEkle')}
        </button>

        {kosullar.length > 0 && (
          <button type="button" onClick={() => onDegisti([], baglac)}
                  className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('temizle')}
          </button>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr" htmlFor={`filtre-ad-${profilAnahtari}`}>{t('filtreAdi')}</label>
          <input id={`filtre-ad-${profilAnahtari}`} className={`${alanSinifi} text-sm w-44`}
                 value={ad} placeholder={t('filtreAdi')}
                 onChange={(e) => setAd(e.target.value)} />
          <button type="button" onClick={kaydet}
                  className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {tg('kaydet')}
          </button>
        </span>
      </div>

      {uyari !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{uyari}</p>
      )}
    </div>
  );
}
