'use client';

/**
 * Backend'i olmayan bölüm için AÇIK durum bildirimi.
 *
 * Bu ekranlar için sahte veri ÜRETİLMEZ. Uydurma araç ya da sayaç satırı
 * göstermek, kullanıcıya sistemin çalıştığını sanmasına yol açar; veri
 * girmeye çalıştığında kaybolur ve güven yıkılır.
 *
 * Bunun yerine neyin eksik olduğu ve neye bağlı olduğu açıkça yazılır.
 */
import { useTranslations } from 'next-intl';

export function HazirDegil({
  baslik, gerekce,
}: {
  readonly baslik: string;
  /** Neyin eksik olduğu — "araç tablosu", "belge deposu" gibi. */
  readonly gerekce: string;
}) {
  const t = useTranslations('daire');

  return (
    <div
      role="note"
      className="glass p-[var(--cardpad)] border-l-4"
      style={{ borderLeftColor: 'var(--warn)' }}
    >
      <p className="font-semibold flex items-center gap-2">
        <span aria-hidden="true">🔒</span>
        {baslik}
      </p>
      <p className="text-sm mt-1 text-[color:var(--muted)]">{t('hazirDegilAciklama')}</p>
      <p className="text-sm mt-2">
        <span className="text-[color:var(--muted-2)]">{t('beklenen')}: </span>
        {gerekce}
      </p>
    </div>
  );
}
