'use client';

/**
 * Tema ve yoğunluk anahtarları.
 *
 * İkisi de `role="group"` içinde `aria-pressed` taşıyan düğmelerdir; ekran
 * okuyucu hangi seçeneğin etkin olduğunu bildirir. Yalnızca renkle belirtmek
 * WCAG 1.4.1'i (renge bağımlılık) ihlal ederdi.
 */
import { useTranslations } from 'next-intl';
import { useGorunum, type TemaModu, type YogunlukModu } from './gorunum-saglayici';

function AnahtarDugmesi({
  etkin, etiket, onClick, children,
}: {
  readonly etkin: boolean;
  readonly etiket: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={etkin}
      title={etiket}
      aria-label={etiket}
      className={[
        'px-2 py-1 text-xs rounded-[var(--rs)] transition-colors',
        etkin ? 'bg-[var(--grad)] text-white font-semibold' : 'text-[color:var(--muted)]',
      ].join(' ')}
      style={etkin ? { backgroundImage: 'var(--grad)' } : undefined}
    >
      {children}
    </button>
  );
}

export function TemaAnahtari() {
  const t = useTranslations('gorunum');
  const { tema, temaAyarla } = useGorunum();

  const secenekler: readonly { readonly deger: TemaModu; readonly simge: string }[] = [
    { deger: 'koyu', simge: '🌙' },
    { deger: 'acik', simge: '☀️' },
  ];

  return (
    <div role="group" aria-label={t('tema')} className="flex gap-1 p-1 rounded-[var(--rs)] border border-[color:var(--line)]">
      {secenekler.map((s) => (
        <AnahtarDugmesi
          key={s.deger}
          etkin={tema === s.deger}
          etiket={t(s.deger)}
          onClick={() => temaAyarla(s.deger)}
        >
          <span aria-hidden="true">{s.simge}</span>
        </AnahtarDugmesi>
      ))}
    </div>
  );
}

export function YogunlukAnahtari() {
  const t = useTranslations('gorunum');
  const { yogunluk, yogunlukAyarla } = useGorunum();

  const secenekler: readonly YogunlukModu[] = ['rahat', 'sikisik'];

  return (
    <div role="group" aria-label={t('yogunluk')} className="flex gap-1 p-1 rounded-[var(--rs)] border border-[color:var(--line)]">
      {secenekler.map((s) => (
        <AnahtarDugmesi
          key={s}
          etkin={yogunluk === s}
          etiket={t(s)}
          onClick={() => yogunlukAyarla(s)}
        >
          {t(s)}
        </AnahtarDugmesi>
      ))}
    </div>
  );
}
