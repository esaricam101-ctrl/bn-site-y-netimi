'use client';

/**
 * Sekme çubuğu — WAI-ARIA Tabs desenine uyar.
 *
 * Klavye: ← → sekmeler arasında gezer, Home/End uçlara gider. Yalnızca ETKİN
 * sekme `tabIndex=0` alır (roving tabindex); aksi halde Tab tuşu her sekmeye
 * ayrı ayrı uğrar ve on sekmeli bir kartta gezinme işkenceye döner.
 */
import { useRef, type ReactNode } from 'react';

export interface Sekme {
  readonly anahtar: string;
  readonly baslik: string;
  /** Sağda gösterilen sayı — 0 ise gösterilmez. */
  readonly rozet?: number;
  /** Backend'i olmayan sekmeler işaretlenir. */
  readonly hazirDegil?: boolean;
}

export function SekmeCubugu({
  sekmeler, etkin, onDegisti,
}: {
  readonly sekmeler: readonly Sekme[];
  readonly etkin: string;
  readonly onDegisti: (anahtar: string) => void;
}) {
  const kapsayici = useRef<HTMLDivElement>(null);

  const klavye = (e: React.KeyboardEvent) => {
    const yonler: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const i = sekmeler.findIndex((s) => s.anahtar === etkin);

    let hedef: number | null = null;
    if (e.key in yonler) {
      hedef = (i + (yonler[e.key] as number) + sekmeler.length) % sekmeler.length;
    } else if (e.key === 'Home') hedef = 0;
    else if (e.key === 'End') hedef = sekmeler.length - 1;

    if (hedef === null) return;
    e.preventDefault();
    const yeni = sekmeler[hedef];
    if (yeni === undefined) return;
    onDegisti(yeni.anahtar);
    // Odak da tasinmali; aksi halde ok tusu sekmeyi degistirir ama odak
    // eski dugmede kalir ve ekran okuyucu yanlis sekmeyi okur.
    kapsayici.current?.querySelector<HTMLButtonElement>(`#sekme-${yeni.anahtar}`)?.focus();
  };

  return (
    <div
      ref={kapsayici}
      role="tablist"
      onKeyDown={klavye}
      className="flex gap-1 overflow-x-auto border-b border-[color:var(--line)]"
    >
      {sekmeler.map((s) => {
        const secili = s.anahtar === etkin;
        return (
          <button
            key={s.anahtar}
            id={`sekme-${s.anahtar}`}
            role="tab"
            type="button"
            aria-selected={secili}
            aria-controls={`panel-${s.anahtar}`}
            tabIndex={secili ? 0 : -1}
            onClick={() => onDegisti(s.anahtar)}
            className={[
              'px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              secili
                ? 'border-[color:var(--primary)] font-semibold text-[color:var(--text)]'
                : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]',
            ].join(' ')}
          >
            {s.baslik}
            {s.rozet !== undefined && s.rozet > 0 && (
              <span className="ml-1.5 text-xs num text-[color:var(--muted-2)]">{s.rozet}</span>
            )}
            {s.hazirDegil === true && (
              <span className="ml-1.5" aria-hidden="true" title="Hazır değil">🔒</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SekmePaneli({
  anahtar, etkin, children,
}: {
  readonly anahtar: string;
  readonly etkin: string;
  readonly children: ReactNode;
}) {
  if (anahtar !== etkin) return null;
  return (
    <div
      id={`panel-${anahtar}`}
      role="tabpanel"
      aria-labelledby={`sekme-${anahtar}`}
      tabIndex={0}
      className="pt-4"
    >
      {children}
    </div>
  );
}
