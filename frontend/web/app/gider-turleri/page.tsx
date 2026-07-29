'use client';

/**
 * Gider türü kataloğu — aidat kurallarının tanımlandığı ekran.
 *
 * BU EKRAN BİR AYAR EKRANI DEĞİL, HUKUKİ BİR KAYIT EKRANIDIR. Buradaki her
 * satır bir dairenin aidatını belirler; bir sakin "aidatım neden böyle
 * hesaplandı?" diye sorduğunda cevap bu tablodadır.
 *
 * Bu yüzden:
 *   - KMK varsayılanından SAPAN kurallar açıkça işaretlenir. Devralınan bir
 *     binada neyin değiştirildiğini görmek, itiraz geldiğinde hangi belgeye
 *     bakılacağını bilmek demektir.
 *   - Varsayılan dışı her kural KAYNAK ZORUNLU: yönetim planı maddesi ya da
 *     genel kurul karar numarası. Referanssız bir kural savunulamaz.
 *   - KARMA bileşenlerinin toplamı canlı gösterilir; 100 değilken kaydetme
 *     düğmesi kapalıdır (sunucu da reddeder).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import {
  KARMA_BILESEN_KURALLARI, KURAL_KAYNAKLARI, MALIK_PAYLASIMLARI,
  PAYLASIM_KURALLARI, SORUMLULUK_TIPLERI,
} from '@/lib/kodlar';
import { servis, type GiderTuru } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const alanSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

interface BilesenSatiri {
  kural: string;
  yuzde: number;
}

export default function GiderTurleriSayfasi() {
  const t = useTranslations('giderTuru');
  const tn = useTranslations('navigasyon');
  const tg = useTranslations('genel');

  const [satirlar, setSatirlar] = useState<readonly GiderTuru[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [duzeltilen, setDuzeltilen] = useState<GiderTuru | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.giderTurleri().then(setSatirlar).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  const ozelSayisi = satirlar.filter((g) => g.ozelKuralMi).length;

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[{ etiket: tn('genelBakis'), yol: '/yonetim' }, { etiket: t('baslik') }]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {!formAcik && duzeltilen === null && (
          <button type="button" onClick={() => setFormAcik(true)}
                  className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
                  style={{ backgroundImage: 'var(--grad)' }}>
            {t('yeniTur')}
          </button>
        )}

        {(formAcik || duzeltilen !== null) && (
          <GiderTuruFormu
            mevcut={duzeltilen}
            onKaydedildi={() => { setFormAcik(false); setDuzeltilen(null); yukle(); }}
            onIptal={() => { setFormAcik(false); setDuzeltilen(null); }}
          />
        )}

        {yukleniyor && <Yukleniyor satir={5} />}
        {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
        {!yukleniyor && hata === null && satirlar.length === 0 && (
          <BosDurum aciklama={t('bosAciklama')} />
        )}

        {!yukleniyor && hata === null && satirlar.length > 0 && (
          <>
            {/* Sapan kural sayisi listenin USTUNDE: devralinan binada ilk
                bakilacak sey budur. */}
            <p className="text-sm num" aria-live="polite">
              {ozelSayisi === 0
                ? t('tumuVarsayilan')
                : t('ozelKuralSayisi', { sayi: ozelSayisi })}
            </p>

            <div className="overflow-x-auto glass">
              <table className="w-full text-sm border-collapse">
                <caption className="sr">{t('tabloAciklamasi')}</caption>
                <thead>
                  <tr>
                    {['kod', 'ad', 'paylasim', 'sorumluluk', 'kaynak', 'malikPaylasimi', 'durum']
                      .map((k) => (
                        <th key={k} scope="col"
                            className="p-2 text-left border-b border-[color:var(--line)] whitespace-nowrap">
                          {t(`kolon_${k}`)}
                        </th>
                      ))}
                    <th scope="col" className="p-2 text-left border-b border-[color:var(--line)] baski-gizle">
                      {tg('kapat')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((g) => (
                    <GiderTuruSatiri key={g.id} gider={g}
                                     onDuzelt={() => setDuzeltilen(g)} onDegisti={yukle} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </UygulamaKabugu>
  );
}

function GiderTuruSatiri({
  gider, onDuzelt, onDegisti,
}: {
  readonly gider: GiderTuru;
  readonly onDuzelt: () => void;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('giderTuru');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();
  const [silAcik, setSilAcik] = useState(false);
  const [gerekce, setGerekce] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const arsivle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gerekce.trim().length < 10) { bildirim.hata(t('hataGerekce')); return; }
    setGonderiliyor(true);
    try {
      await servis.giderTuruSil(gider.id, gerekce.trim());
      bildirim.basari(t('arsivlendi'));
      setSilAcik(false);
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('arsivlenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <>
      <tr className="border-b border-[color:var(--line)]"
          style={{ opacity: gider.aktifMi ? 1 : 0.55 }}>
        <td className="p-2 num">{gider.kod}</td>
        <td className="p-2">{gider.ad}</td>
        <td className="p-2 whitespace-nowrap">
          {t(`paylasim_${gider.paylasimKurali}`)}
          {gider.karmaBilesenler !== null && gider.karmaBilesenler.length > 0 && (
            <span className="block text-xs num text-[color:var(--muted)]">
              {gider.karmaBilesenler
                .map((b) => `%${b.yuzde} ${t(`paylasim_${b.kural}`)}`)
                .join(' · ')}
            </span>
          )}
        </td>
        <td className="p-2 whitespace-nowrap">{t(`sorumluluk_${gider.sorumlulukTipi}`)}</td>
        <td className="p-2">
          {/* Sapan kural GORUNUR isaretlenir; kaynak referansi da yazilir. */}
          {gider.ozelKuralMi ? (
            <span className="inline-flex flex-col">
              <span style={{ color: 'var(--warn)' }}>{t(`kaynak_${gider.kuralKaynagi}`)}</span>
              <span className="text-xs text-[color:var(--muted)]">
                {gider.kaynakReferansi ?? '—'}
              </span>
            </span>
          ) : (
            <span className="text-[color:var(--muted)]">{t('kaynak_KMK_VARSAYILAN')}</span>
          )}
        </td>
        <td className="p-2 whitespace-nowrap">{t(`malikPaylasimi_${gider.malikPaylasimi}`)}</td>
        <td className="p-2 whitespace-nowrap">
          {gider.aktifMi ? (
            <span style={{ color: 'var(--success)' }}>{t('aktif')}</span>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{t('arsivli')}</span>
          )}
        </td>
        <td className="p-2 whitespace-nowrap baski-gizle">
          <div className="flex gap-2">
            <button type="button" onClick={onDuzelt}
                    className="px-2 py-1 text-xs rounded-[var(--rs)] border border-[color:var(--line)]">
              {t('duzelt')}
            </button>
            <button type="button" onClick={() => setSilAcik((a) => !a)}
                    disabled={!gider.aktifMi}
                    title={gider.aktifMi ? undefined : t('zatenArsivli')}
                    className="px-2 py-1 text-xs rounded-[var(--rs)] border disabled:opacity-40"
                    style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
              {t('arsivle')}
            </button>
          </div>
        </td>
      </tr>

      {silAcik && (
        <tr className="baski-gizle">
          <td colSpan={8} className="p-3" style={{ background: 'var(--glass-bg)' }}>
            <form onSubmit={(e) => { void arsivle(e); }} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 flex-1 min-w-64">
                <span className="text-xs text-[color:var(--muted-2)]">{t('arsivGerekce')}</span>
                <input className={alanSinifi} value={gerekce} required
                       onChange={(e) => setGerekce(e.target.value)} />
              </label>
              <button type="submit" disabled={gonderiliyor}
                      className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                      style={{ background: 'var(--crit)' }}>
                {gonderiliyor ? tg('yukleniyor') : t('arsivle')}
              </button>
              <button type="button" onClick={() => setSilAcik(false)}
                      className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
                {tg('iptal')}
              </button>
            </form>
            <p className="text-xs mt-2 text-[color:var(--muted)]">{t('arsivAciklama')}</p>
          </td>
        </tr>
      )}
    </>
  );
}

function GiderTuruFormu({
  mevcut, onKaydedildi, onIptal,
}: {
  readonly mevcut: GiderTuru | null;
  readonly onKaydedildi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('giderTuru');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [kod, setKod] = useState(mevcut?.kod ?? '');
  const [ad, setAd] = useState(mevcut?.ad ?? '');
  const [paylasimKurali, setPaylasimKurali] = useState(mevcut?.paylasimKurali ?? 'ESIT');
  const [sorumlulukTipi, setSorumlulukTipi] = useState(mevcut?.sorumlulukTipi ?? 'KULLANANA_AIT');
  const [kuralKaynagi, setKuralKaynagi] = useState(mevcut?.kuralKaynagi ?? 'KMK_VARSAYILAN');
  const [kaynakReferansi, setKaynakReferansi] = useState(mevcut?.kaynakReferansi ?? '');
  const [malikPaylasimi, setMalikPaylasimi] = useState(mevcut?.malikPaylasimi ?? 'HISSE_ORANI');
  const [bilesenler, setBilesenler] = useState<BilesenSatiri[]>(
    mevcut?.karmaBilesenler ? mevcut.karmaBilesenler.map((b) => ({ ...b })) : [],
  );
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const karmaMi = paylasimKurali === 'KARMA';
  const referansGerekli = kuralKaynagi !== 'KMK_VARSAYILAN';
  const bilesenToplami = useMemo(
    () => bilesenler.reduce((s, b) => s + (Number.isFinite(b.yuzde) ? b.yuzde : 0), 0),
    [bilesenler],
  );

  // Gonderim engelleri ACIKCA hesaplanir; dugme neden kapali oldugu yazilir.
  const engel: string | null = (() => {
    if (kod.trim().length < 2) return t('hataKod');
    if (ad.trim().length < 2) return t('hataAd');
    if (referansGerekli && kaynakReferansi.trim().length < 3) return t('hataReferans');
    if (karmaMi && bilesenler.length === 0) return t('hataKarmaBos');
    if (karmaMi && bilesenToplami !== 100) {
      return t('hataKarmaToplam', { toplam: bilesenToplami });
    }
    if (karmaMi && new Set(bilesenler.map((b) => b.kural)).size !== bilesenler.length) {
      return t('hataKarmaTekrar');
    }
    return null;
  })();

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (engel !== null) { bildirim.hata(engel); return; }
    setGonderiliyor(true);

    const govde = {
      kod: kod.trim().toLocaleUpperCase('tr'),
      ad: ad.trim(),
      paylasimKurali,
      sorumlulukTipi,
      kuralKaynagi,
      ...(kaynakReferansi.trim() === '' ? {} : { kaynakReferansi: kaynakReferansi.trim() }),
      ...(karmaMi ? { karmaBilesenler: bilesenler } : {}),
      malikPaylasimi,
    };

    try {
      if (mevcut === null) {
        await servis.giderTuruEkle(govde);
        bildirim.basari(t('eklendi'));
      } else {
        // `kod` GONDERILMEZ: degistirilemez. Alanlar acikca secilir —
        // destructuring ile atmak, ileride eklenen bir alanin sessizce
        // gonderilmesine yol acar.
        await servis.giderTuruGuncelle(mevcut.id, {
          ad: govde.ad,
          paylasimKurali: govde.paylasimKurali,
          sorumlulukTipi: govde.sorumlulukTipi,
          kuralKaynagi: govde.kuralKaynagi,
          ...(govde.kaynakReferansi === undefined
            ? {}
            : { kaynakReferansi: govde.kaynakReferansi }),
          ...(karmaMi ? { karmaBilesenler: bilesenler } : {}),
          malikPaylasimi: govde.malikPaylasimi,
        });
        bildirim.basari(t('guncellendi'));
      }
      onKaydedildi();
    } catch (h) {
      bildirim.hata(hataMetni(h, mevcut === null ? t('eklenemedi') : t('guncellenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">{mevcut === null ? t('yeniTur') : t('duzeltBaslik')}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kolon_kod')}</span>
          <input className={alanSinifi} value={kod} required disabled={mevcut !== null}
                 onChange={(e) => setKod(e.target.value)} />
          {/* Kod DEGISTIRILEMEZ; alan gizlenmez, kilitlenir ve nedeni yazilir. */}
          {mevcut !== null && (
            <span className="text-xs text-[color:var(--muted)]">{t('kodKilitli')}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kolon_ad')}</span>
          <input className={alanSinifi} value={ad} required
                 onChange={(e) => setAd(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kolon_paylasim')}</span>
          <select className={alanSinifi} value={paylasimKurali}
                  onChange={(e) => setPaylasimKurali(e.target.value)}>
            {PAYLASIM_KURALLARI.map((k) => (
              <option key={k} value={k}>{t(`paylasim_${k}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kolon_sorumluluk')}</span>
          <select className={alanSinifi} value={sorumlulukTipi}
                  onChange={(e) => setSorumlulukTipi(e.target.value)}>
            {SORUMLULUK_TIPLERI.map((s) => (
              <option key={s} value={s}>{t(`sorumluluk_${s}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kolon_malikPaylasimi')}</span>
          <select className={alanSinifi} value={malikPaylasimi}
                  onChange={(e) => setMalikPaylasimi(e.target.value)}>
            {MALIK_PAYLASIMLARI.map((m) => (
              <option key={m} value={m}>{t(`malikPaylasimi_${m}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kolon_kaynak')}</span>
          <select className={alanSinifi} value={kuralKaynagi}
                  onChange={(e) => setKuralKaynagi(e.target.value)}>
            {KURAL_KAYNAKLARI.map((k) => (
              <option key={k} value={k}>{t(`kaynak_${k}`)}</option>
            ))}
          </select>
        </label>

        {referansGerekli && (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-[color:var(--muted-2)]">{t('kaynakReferansi')}</span>
            <input className={alanSinifi} value={kaynakReferansi} required
                   placeholder={t('kaynakOrnek')}
                   onChange={(e) => setKaynakReferansi(e.target.value)} />
          </label>
        )}
      </div>

      <p className="text-xs text-[color:var(--muted)]">
        {referansGerekli ? t('referansIpucu') : t('varsayilanIpucu')}
      </p>

      {karmaMi && (
        <div className="flex flex-col gap-2 p-3 rounded-[var(--rs)] border border-[color:var(--line)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">{t('karmaBasligi')}</span>
            {/* Toplam CANLI: 100 olmadan kaydedilemez. */}
            <span className="num text-sm" aria-live="polite"
                  style={{ color: bilesenToplami === 100 ? 'var(--success)' : 'var(--crit)' }}>
              {t('karmaToplam', { toplam: bilesenToplami })}
            </span>
          </div>

          {bilesenler.map((b, i) => (
            <div key={`${b.kural}-${i}`} className="flex flex-wrap items-center gap-2">
              <select className={`${alanSinifi} max-w-56`} value={b.kural}
                      aria-label={t('karmaKural')}
                      onChange={(e) =>
                        setBilesenler((l) =>
                          l.map((x, j) => (j === i ? { ...x, kural: e.target.value } : x)))}>
                {KARMA_BILESEN_KURALLARI.map((k) => (
                  <option key={k} value={k}>{t(`paylasim_${k}`)}</option>
                ))}
              </select>
              <input type="number" min={1} max={100} value={b.yuzde}
                     aria-label={t('karmaYuzde')}
                     className={`${alanSinifi} max-w-28 num`}
                     onChange={(e) =>
                       setBilesenler((l) =>
                         l.map((x, j) =>
                           (j === i ? { ...x, yuzde: Number(e.target.value) } : x)))} />
              <button type="button" aria-label={t('karmaSil')}
                      onClick={() => setBilesenler((l) => l.filter((_, j) => j !== i))}
                      className="px-2 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]"
                      style={{ color: 'var(--crit)' }}>
                ×
              </button>
            </div>
          ))}

          <button type="button"
                  onClick={() =>
                    setBilesenler((l) => [...l, { kural: 'ESIT', yuzde: 0 }])}
                  className="self-start px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('karmaEkle')}
          </button>

          <p className="text-xs text-[color:var(--muted)]">{t('karmaIpucu')}</p>
        </div>
      )}

      {engel !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{engel}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={gonderiliyor || engel !== null}
                className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-50"
                style={{ backgroundImage: 'var(--grad)' }}>
          {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
        </button>
        <button type="button" onClick={onIptal}
                className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
          {tg('iptal')}
        </button>
      </div>
    </form>
  );
}
