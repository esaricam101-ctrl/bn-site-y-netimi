'use client';

/**
 * Dashboard — apartmanın bugünkü durumu tek ekranda.
 *
 * Kaynak: `GET /bolumler/yerlesim-ozeti` — bina geneli malik/kiracı/sakin
 * durumu tek sorguda gelir. Daire kartını bölüm bölüm çağırmak kırk daire
 * için kırk istek demektir.
 *
 * ÖNEMLİ (ADR-0005): Bu ekranda finansal rakam YOKTUR. Bakiye ve borç
 * önbelleklenmez ve özet uçtan okunmaz; finans ekranı ayrıdır.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { IstatistikKarti, OranCubugu } from '@/components/istatistik-karti';
import { servis, type YerlesimOzeti } from '@/lib/servis';

export default function Dashboard() {
  const t = useTranslations('panel');
  const tn = useTranslations('navigasyon');

  const [ozet, setOzet] = useState<YerlesimOzeti | null>(null);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.yerlesimOzeti().then(setOzet).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  return (
    <UygulamaKabugu baslik={t('baslik')} kirintilar={[{ etiket: tn('genelBakis') }]}>
      {yukleniyor && <Yukleniyor satir={5} />}

      {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}

      {!yukleniyor && hata === null && ozet === null && <BosDurum />}

      {!yukleniyor && hata === null && ozet !== null && (
        <div className="flex flex-col gap-6">
          {/* Dikkat gerektirenler ONCE gelir — sayfanin altinda kalirsa gorulmez. */}
          {(ozet.hissesiEksikOlan > 0 || ozet.malikKaydiOlmayan > 0) && (
            <section aria-labelledby="uyarilar">
              <h2 id="uyarilar" className="text-sm font-semibold mb-3">
                {t('dikkatGerekenler')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {ozet.malikKaydiOlmayan > 0 && (
                  <IstatistikKarti
                    baslik={t('malikKaydiOlmayan')}
                    deger={ozet.malikKaydiOlmayan}
                    aciklama={t('malikKaydiOlmayanAciklama')}
                    uyari
                    ikon="⚠"
                    yol="/bolumler"
                  />
                )}
                {ozet.hissesiEksikOlan > 0 && (
                  <IstatistikKarti
                    baslik={t('hissesiEksik')}
                    deger={ozet.hissesiEksikOlan}
                    aciklama={t('hissesiEksikAciklama')}
                    uyari
                    ikon="⚠"
                    yol="/bolumler"
                  />
                )}
              </div>
            </section>
          )}

          <section aria-labelledby="ozet">
            <h2 id="ozet" className="text-sm font-semibold mb-3">{t('genelDurum')}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <IstatistikKarti baslik={t('bolumSayisi')} deger={ozet.bolumSayisi}
                               ikon="▦" yol="/bolumler" />
              <IstatistikKarti baslik={t('kiracili')} deger={ozet.kiracili} ikon="◎" />
              <IstatistikKarti baslik={t('bos')} deger={ozet.bos} ikon="◌" />
              <IstatistikKarti
                baslik={t('dolulukOrani')}
                deger={
                  ozet.bolumSayisi === 0
                    ? '—'
                    : `%${Math.round(((ozet.bolumSayisi - ozet.bos) / ozet.bolumSayisi) * 100)}`
                }
                ikon="▲"
              />
            </div>
          </section>

          <section aria-labelledby="dagilim" className="glass p-[var(--cardpad)] max-w-xl">
            <h2 id="dagilim" className="text-sm font-semibold mb-4">{t('dagilim')}</h2>
            <div className="flex flex-col gap-4">
              <OranCubugu etiket={t('kiracili')} deger={ozet.kiracili}
                          toplam={ozet.bolumSayisi} />
              <OranCubugu etiket={t('bos')} deger={ozet.bos}
                          toplam={ozet.bolumSayisi} renk="var(--warn)" />
              <OranCubugu etiket={t('hissesiEksik')} deger={ozet.hissesiEksikOlan}
                          toplam={ozet.bolumSayisi} renk="var(--crit)" />
            </div>
          </section>

          {/* ADR-0005 — bu ekranda finansal rakam bulunmaz. */}
          <p className="text-xs text-[color:var(--muted-2)]">{t('finansalVeriTaze')}</p>
        </div>
      )}
    </UygulamaKabugu>
  );
}
