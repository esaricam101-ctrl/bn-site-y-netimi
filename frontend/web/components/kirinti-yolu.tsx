'use client';

/**
 * Breadcrumb — hiyerarşide nerede olduğunu gösterir.
 *
 * Apartman → Blok → Kat → Bağımsız Bölüm zinciri derindir; kullanıcı üç
 * seviye aşağıdayken nereye döneceğini bilemez. Son öğe `aria-current="page"`
 * taşır ve bağlantı DEĞİLDİR — bulunduğu sayfaya bağlantı vermek ekran
 * okuyucuda gereksiz gezinme üretir.
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface KirintiOgesi {
  readonly etiket: string;
  /** Son öğede bulunmaz — bulunduğumuz sayfadır. */
  readonly yol?: string;
}

export function KirintiYolu({ ogeler }: { readonly ogeler: readonly KirintiOgesi[] }) {
  const t = useTranslations('navigasyon');
  if (ogeler.length === 0) return null;

  return (
    <nav aria-label={t('kirintiYolu')} className="text-xs">
      <ol className="flex flex-wrap items-center gap-1">
        {ogeler.map((o, i) => {
          const sonuncu = i === ogeler.length - 1;
          return (
            <li key={`${o.etiket}-${i}`} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden="true" className="text-[color:var(--muted-2)]">
                  /
                </span>
              )}
              {sonuncu || o.yol === undefined ? (
                <span
                  aria-current={sonuncu ? 'page' : undefined}
                  className="text-[color:var(--text)] font-medium"
                >
                  {o.etiket}
                </span>
              ) : (
                <Link
                  href={o.yol}
                  className="text-[color:var(--muted)] hover:text-[color:var(--text)] underline-offset-2 hover:underline"
                >
                  {o.etiket}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
