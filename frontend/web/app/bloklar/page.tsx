'use client';

/**
 * Blok listesi. `?apartmanId=` ile süzülür — apartman kartından gelinir.
 *
 * Blok seçilince katları aynı ekranda açılır: iki seviye arasında sayfa
 * değiştirmek, kırk daireli bir binada gezinmeyi yorucu kılar.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { servis, type Blok, type Kat } from '@/lib/servis';

/**
 * `useSearchParams` statik render sirasinda Suspense siniri ister (Next.js App
 * Router kisiti). Sinir olmadan sayfa prerender asamasinda patlar.
 */
export default function BloklarSayfasi() {
  return (
    <Suspense fallback={<UygulamaKabugu><Yukleniyor satir={3} /></UygulamaKabugu>}>
      <BloklarIcerik />
    </Suspense>
  );
}

function BloklarIcerik() {
  const t = useTranslations('blok');
  const tk = useTranslations('kat');
  const tn = useTranslations('navigasyon');
  const parametreler = useSearchParams();
  const apartmanId = parametreler.get('apartmanId') ?? undefined;

  const [bloklar, setBloklar] = useState<readonly Blok[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [acikBlok, setAcikBlok] = useState<string | null>(null);
  const [katlar, setKatlar] = useState<readonly Kat[]>([]);
  const [katYukleniyor, setKatYukleniyor] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.bloklar(apartmanId).then(setBloklar).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [apartmanId]);

  useEffect(yukle, [yukle]);

  const blogaTikla = (blokId: string) => {
    if (acikBlok === blokId) {
      setAcikBlok(null);
      return;
    }
    setAcikBlok(blokId);
    setKatYukleniyor(true);
    servis.katlar(blokId).then(setKatlar).catch(() => setKatlar([]))
      .finally(() => setKatYukleniyor(false));
  };

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('apartmanlar'), yol: '/apartmanlar' },
        { etiket: tn('bloklar') },
      ]}
    >
      {yukleniyor && <Yukleniyor satir={3} />}
      {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
      {!yukleniyor && hata === null && bloklar.length === 0 && (
        <BosDurum aciklama={t('bosAciklama')} />
      )}

      {!yukleniyor && hata === null && bloklar.length > 0 && (
        <div className="flex flex-col gap-3">
          {bloklar.map((b) => {
            const acik = acikBlok === b.id;
            return (
              <div key={b.id} className="glass">
                <button
                  type="button"
                  onClick={() => blogaTikla(b.id)}
                  aria-expanded={acik}
                  className="w-full text-left p-[var(--cardpad)] flex flex-wrap items-center gap-3"
                >
                  <span aria-hidden="true" className="text-[color:var(--muted-2)]">
                    {acik ? '▾' : '▸'}
                  </span>
                  <span className="font-semibold">{b.ad}</span>
                  <span className="text-xs text-[color:var(--muted-2)]">{b.apartmanAdi}</span>
                  <span className="ml-auto text-sm num text-[color:var(--muted)]">
                    {t('katSayisi')}: {b.katSayisi} · {t('bolumSayisi')}: {b.bolumSayisi}
                  </span>
                </button>

                {acik && (
                  <div className="px-[var(--cardpad)] pb-[var(--cardpad)] border-t border-[color:var(--line)] pt-3">
                    {katYukleniyor && <Yukleniyor satir={2} />}
                    {!katYukleniyor && katlar.length === 0 && (
                      <p className="text-sm text-[color:var(--muted)]">{tk('bosAciklama')}</p>
                    )}
                    {!katYukleniyor && katlar.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {katlar.map((k) => (
                          <li key={k.id}>
                            <Link
                              href={`/bolumler?katId=${k.id}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)] hover:border-[color:var(--primary)]"
                            >
                              {k.ad ?? tk('katNo', { no: k.no })}
                              <span className="text-xs num text-[color:var(--muted-2)]">
                                {k.bolumSayisi}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </UygulamaKabugu>
  );
}
