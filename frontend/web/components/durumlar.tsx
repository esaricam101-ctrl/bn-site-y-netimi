'use client';

/**
 * Yükleniyor · boş · hata durum ekranları.
 *
 * Üçü de ayrı bileşendir çünkü üçü FARKLI şey söyler: "bekle", "burada kayıt
 * yok", "bir şey bozuldu". Tek bir gri kutuyla üçünü göstermek kullanıcıya
 * hangi durumda olduğunu anlatmaz.
 *
 * Hata ekranı `sonrakiEylem` gösterir — BFS v1 §12: hiçbir hata mesajı
 * yalnızca "bir hata oluştu" değildir, her hata TEK NET SONRAKİ EYLEM taşır.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ApiHatasi } from '@/lib/api';

export function Yukleniyor({ satir = 3 }: { readonly satir?: number }) {
  const t = useTranslations('genel');
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr">{t('yukleniyor')}</span>
      {Array.from({ length: satir }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-[var(--rowh)] rounded-[var(--rs)] animate-pulse"
          style={{ background: 'var(--glass-bg)' }}
        />
      ))}
    </div>
  );
}

export function BosDurum({
  baslik, aciklama, eylem,
}: {
  readonly baslik?: string;
  readonly aciklama?: string;
  readonly eylem?: ReactNode;
}) {
  const t = useTranslations('genel');
  return (
    <div className="glass text-center py-10 px-[var(--cardpad)]">
      <p className="text-3xl mb-2" aria-hidden="true">◌</p>
      <p className="font-semibold">{baslik ?? t('veriYok')}</p>
      {aciklama !== undefined && (
        <p className="text-[color:var(--muted)] text-sm mt-1">{aciklama}</p>
      )}
      {eylem !== undefined && <div className="mt-4">{eylem}</div>}
    </div>
  );
}

export function HataDurumu({
  hata, tekrarDene,
}: {
  readonly hata: unknown;
  readonly tekrarDene?: () => void;
}) {
  const t = useTranslations('genel');
  const th = useTranslations('hatalar');

  const problem = hata instanceof ApiHatasi ? hata.problem : null;
  const mesaj = problem?.detail ?? th('ag');

  return (
    <div role="alert" className="glass p-[var(--cardpad)] border-l-4"
         style={{ borderLeftColor: 'var(--crit)' }}>
      <p className="font-semibold">{t('hata')}</p>
      <p className="text-sm mt-1">{mesaj}</p>

      {/* BFS v1 §12 — tek net sonraki eylem. */}
      {problem?.sonrakiEylem !== undefined && (
        <p className="text-sm mt-2 text-[color:var(--muted)]">{problem.sonrakiEylem}</p>
      )}

      {/* Destek talebinde korelasyon kimligi istenir. */}
      {problem !== null && problem.correlationId !== 'yok' && (
        <p className="text-xs mt-2 text-[color:var(--muted-2)] num">
          {th('korelasyon')}: {problem.correlationId}
        </p>
      )}

      {tekrarDene !== undefined && (
        <button
          type="button"
          onClick={tekrarDene}
          className="mt-3 px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)] hover:bg-[color:var(--glass-bg)]"
        >
          {t('tekrarDene')}
        </button>
      )}
    </div>
  );
}
