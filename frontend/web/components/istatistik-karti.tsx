'use client';

/**
 * İstatistik kartı — Dashboard'un yapı taşı.
 *
 * `uyari` bayrağı sıfırdan büyük bir SORUN sayısını gösterdiğinde kart
 * vurgulanır. Vurgu yalnızca RENKLE yapılmaz; ikon ve metin de eklenir
 * (WCAG 1.4.1 — renge bağımlılık).
 *
 * Rakamlar `num` sınıfıyla tabular hizalanır: farklı basamaklı sayılar alt
 * alta geldiğinde kayma olmaz.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

export function IstatistikKarti({
  baslik, deger, aciklama, uyari = false, yol, ikon,
}: {
  readonly baslik: string;
  readonly deger: string | number;
  readonly aciklama?: string;
  /** Dikkat gerektiren durum — sıfırdan büyük sorun sayısı gibi. */
  readonly uyari?: boolean;
  /** Verilirse kart tıklanabilir olur. */
  readonly yol?: string;
  readonly ikon?: ReactNode;
}) {
  const govde = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[color:var(--muted)]">{baslik}</p>
        {ikon !== undefined && <span aria-hidden="true">{ikon}</span>}
      </div>
      <p
        className="text-3xl font-bold num mt-2"
        style={uyari ? { color: 'var(--crit)' } : undefined}
      >
        {deger}
      </p>
      {aciklama !== undefined && (
        <p className="text-xs mt-1 text-[color:var(--muted-2)]">{aciklama}</p>
      )}
    </>
  );

  const sinif = [
    'glass p-[var(--cardpad)] block',
    uyari ? 'border-l-4' : '',
    yol !== undefined ? 'hover:border-[color:var(--primary)] transition-colors' : '',
  ].join(' ');

  const stil = uyari ? { borderLeftColor: 'var(--crit)' } : undefined;

  if (yol === undefined) {
    return <div className={sinif} style={stil}>{govde}</div>;
  }
  return <Link href={yol} className={sinif} style={stil}>{govde}</Link>;
}

/**
 * Yatay oran çubuğu — basit dağılım görselleştirmesi.
 *
 * Harici grafik kütüphanesi kullanılmaz: tek bir oran göstermek için 40 kB
 * bağımlılık eklemek makul değildir. Karmaşık grafikler (zaman serisi,
 * çoklu eksen) geldiğinde kütüphane değerlendirilir — DEVLOG TODO.
 */
export function OranCubugu({
  etiket, deger, toplam, renk = 'var(--primary)',
}: {
  readonly etiket: string;
  readonly deger: number;
  readonly toplam: number;
  readonly renk?: string;
}) {
  const yuzde = toplam === 0 ? 0 : Math.round((deger / toplam) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{etiket}</span>
        <span className="num text-[color:var(--muted)]">
          {deger} / {toplam}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--line)' }}
        role="meter"
        aria-valuenow={deger}
        aria-valuemin={0}
        aria-valuemax={toplam}
        aria-label={etiket}
      >
        <div className="h-full rounded-full" style={{ width: `${yuzde}%`, background: renk }} />
      </div>
    </div>
  );
}
