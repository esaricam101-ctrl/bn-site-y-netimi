'use client';

/**
 * Arsa payı toplu düzeltme — KMK md. 3.
 *
 * Arsa payları toplamı TAMI ETMEK zorundadır. Tek bölümün payını değiştirmek
 * binanın toplamını sessizce bozar; bu yüzden `PATCH /bolumler/:id` arsa
 * payına dokunmaz ve düzeltme yalnızca burada, toplu ve tek işlem olarak
 * yapılır.
 *
 * EKRANIN ASIL İŞİ toplamı CANLI göstermektir. Kullanıcı 40 satırı düzeltip
 * gönderdikten sonra "toplam tutmuyor" cevabı alırsa hangi satırın eksik
 * olduğunu bulamaz. Toplam her tuş vuruşunda kesir aritmetiğiyle yeniden
 * hesaplanır — ondalıkla değil: 1/3 üç kez toplanınca ondalıkta asla 1
 * etmez ve ekran doğru veriyi hatalı gösterir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import {
  kesirCoz, kesirleriTopla, kesirYaz, kesirYuzde, tamiEdiyorMu, type Kesir,
} from '@/lib/kesir';
import { servis, type Bolum } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const alanSinifi =
  'px-2 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-28 num';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function ArsaPayiSayfasi() {
  const t = useTranslations('arsaPayi');
  const tb = useTranslations('bolum');
  const tg = useTranslations('genel');
  const tn = useTranslations('navigasyon');
  const bildirim = useBildirim();

  const [satirlar, setSatirlar] = useState<readonly Bolum[]>([]);
  const [degerler, setDegerler] = useState<Record<string, string>>({});
  const [gerekce, setGerekce] = useState('');
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formHatasi, setFormHatasi] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.bolumler()
      .then((s) => {
        setSatirlar(s.kayitlar);
        setDegerler(Object.fromEntries(s.kayitlar.map((b) => [b.id, b.arsaPayi])));
      })
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  /** Her satırın çözümü — geçersiz olan `null` döner ve toplama girmez. */
  const cozumler = useMemo(
    () => satirlar.map((b) => ({
      bolum: b,
      girilen: degerler[b.id] ?? '',
      kesir: kesirCoz(degerler[b.id] ?? ''),
      degisti: (degerler[b.id] ?? '') !== b.arsaPayi,
    })),
    [satirlar, degerler],
  );

  const gecersizler = cozumler.filter((c) => c.kesir === null);
  const toplam = useMemo(
    () => kesirleriTopla(
      cozumler.map((c) => c.kesir).filter((k): k is Kesir => k !== null),
    ),
    [cozumler],
  );
  const tam = gecersizler.length === 0 && tamiEdiyorMu(toplam);
  const degisenler = cozumler.filter((c) => c.degisti && c.kesir !== null);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (degisenler.length === 0) { setFormHatasi(t('hataDegisiklikYok')); return; }
    if (gerekce.trim().length < 10) { setFormHatasi(t('hataGerekce')); return; }
    setFormHatasi(null);
    setGonderiliyor(true);
    try {
      await servis.arsaPayiDuzelt(
        degisenler.map((c) => ({
          bolumId: c.bolum.id,
          arsaPayiPay: String((c.kesir as Kesir).pay),
          arsaPayiPayda: String((c.kesir as Kesir).payda),
        })),
        gerekce.trim(),
      );
      bildirim.basari(t('duzeltildi', { sayi: degisenler.length }));
      setGerekce('');
      yukle();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('duzeltilemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('bolumler'), yol: '/bolumler' },
        { etiket: t('baslik') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {yukleniyor && <Yukleniyor satir={6} />}
        {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
        {!yukleniyor && hata === null && satirlar.length === 0 && (
          <BosDurum aciklama={tb('bosAciklama')} />
        )}

        {!yukleniyor && hata === null && satirlar.length > 0 && (
          <form onSubmit={(e) => { void gonder(e); }} className="flex flex-col gap-4">
            {/* CANLI TOPLAM — ekranin asil isi. `aria-live` ile duyurulur. */}
            <div className="glass p-[var(--cardpad)] flex flex-wrap items-center gap-4"
                 aria-live="polite">
              <span className="text-sm">{t('toplam')}:</span>
              <span className="num font-semibold"
                    style={{ color: tam ? 'var(--success)' : 'var(--crit)' }}>
                {kesirYaz(toplam)}
              </span>
              <span className="num text-sm text-[color:var(--muted)]">
                (%{kesirYuzde(toplam)})
              </span>
              <span className="text-sm" style={{ color: tam ? 'var(--success)' : 'var(--crit)' }}>
                {tam ? t('tamEdiyor') : t('tamEtmiyor')}
              </span>
              {gecersizler.length > 0 && (
                <span className="text-sm" style={{ color: 'var(--crit)' }}>
                  {t('gecersizSayisi', { sayi: gecersizler.length })}
                </span>
              )}
            </div>

            <div className="overflow-x-auto glass">
              <table className="w-full text-sm border-collapse">
                <caption className="sr">{t('tabloAciklamasi')}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-2 text-left border-b border-[color:var(--line)]">
                      {tb('kapiNo')}
                    </th>
                    <th scope="col" className="p-2 text-right border-b border-[color:var(--line)]">
                      {tb('kat')}
                    </th>
                    <th scope="col" className="p-2 text-left border-b border-[color:var(--line)]">
                      {t('mevcut')}
                    </th>
                    <th scope="col" className="p-2 text-left border-b border-[color:var(--line)]">
                      {t('yeni')}
                    </th>
                    <th scope="col" className="p-2 text-right border-b border-[color:var(--line)]">
                      {t('yuzde')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cozumler.map((c) => (
                    <tr key={c.bolum.id}
                        className="border-b border-[color:var(--line)]"
                        style={{ height: 'var(--rowh)' }}>
                      <td className="p-2">{c.bolum.kapiNo}</td>
                      <td className="p-2 text-right num">{c.bolum.kat}</td>
                      <td className="p-2 num text-[color:var(--muted)]">{c.bolum.arsaPayi}</td>
                      <td className="p-2">
                        <input
                          className={alanSinifi}
                          value={c.girilen}
                          aria-invalid={c.kesir === null}
                          aria-label={t('payAlani', { kapiNo: c.bolum.kapiNo })}
                          style={c.kesir === null ? { borderColor: 'var(--crit)' } : undefined}
                          onChange={(e) =>
                            setDegerler((d) => ({ ...d, [c.bolum.id]: e.target.value }))}
                        />
                      </td>
                      <td className="p-2 text-right num text-[color:var(--muted)]">
                        {c.kesir === null ? '—' : `%${kesirYuzde(c.kesir)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[color:var(--muted)]">{t('bicimIpucu')}</p>

            <div className="glass p-[var(--cardpad)] flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--muted-2)]">{t('gerekce')}</span>
                <input
                  className="px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent"
                  value={gerekce} onChange={(e) => setGerekce(e.target.value)} />
              </label>

              {formHatasi !== null && (
                <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>
                  {formHatasi}
                </p>
              )}

              {/* Toplam tam degilken gonderim ENGELLENIR ve nedeni yazilir.
                  Sunucu da reddeder; kullaniciyi bos yere reddedilecek bir
                  istege gondermek zaman kaybidir. */}
              {!tam && (
                <p className="text-xs" style={{ color: 'var(--crit)' }}>{t('gonderimKapali')}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={!tam || gonderiliyor || degisenler.length === 0}
                        className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-50"
                        style={{ backgroundImage: 'var(--grad)' }}>
                  {gonderiliyor
                    ? tg('yukleniyor')
                    : t('kaydet', { sayi: degisenler.length })}
                </button>
                <button type="button" onClick={yukle}
                        className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
                  {t('geriAl')}
                </button>
                <Link href="/bolumler"
                      className="px-4 h-[var(--rowh)] inline-flex items-center rounded-[var(--rs)] border border-[color:var(--line)]">
                  {tg('kapat')}
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </UygulamaKabugu>
  );
}
