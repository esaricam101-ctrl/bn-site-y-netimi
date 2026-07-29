'use client';

/**
 * Blok yönetimi. `?apartmanId=` ile süzülür — apartman kartından gelinir.
 *
 * Blok seçilince katları aynı ekranda açılır: iki seviye arasında sayfa
 * değiştirmek, kırk daireli bir binada gezinmeyi yorucu kılar.
 *
 * İKİ KURAL:
 * - **Blok başka apartmana taşınmaz.** Düzeltme formunda apartman alanı yok;
 *   bir bloğun taşınması altındaki tüm kat/bölüm/tahakkuk zincirini kırar.
 *   Yanlış apartmana açılmışsa doğru kayıt silinip yenisi açılır.
 * - **Bağımsız bölümü olan blok silinemez.**
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { servis, type Apartman, type Blok, type Kat } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const girdiSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

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
  const tg = useTranslations('genel');
  const tn = useTranslations('navigasyon');
  const parametreler = useSearchParams();
  const apartmanId = parametreler.get('apartmanId') ?? undefined;

  const [bloklar, setBloklar] = useState<readonly Blok[]>([]);
  const [apartmanlar, setApartmanlar] = useState<readonly Apartman[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [acikBlok, setAcikBlok] = useState<string | null>(null);
  const [katlar, setKatlar] = useState<readonly Kat[]>([]);
  const [katYukleniyor, setKatYukleniyor] = useState(false);
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.bloklar(apartmanId).then(setBloklar).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [apartmanId]);

  useEffect(yukle, [yukle]);

  // Blok bir apartmana bagli acilir; apartman listesi olmadan ekleme yapilamaz.
  useEffect(() => {
    servis.apartmanlar().then(setApartmanlar).catch(() => setApartmanlar([]));
  }, []);

  const katlariYukle = useCallback((blokId: string) => {
    setKatYukleniyor(true);
    servis.katlar(blokId).then(setKatlar).catch(() => setKatlar([]))
      .finally(() => setKatYukleniyor(false));
  }, []);

  const blogaTikla = (blokId: string) => {
    if (acikBlok === blokId) {
      setAcikBlok(null);
      return;
    }
    setAcikBlok(blokId);
    katlariYukle(blokId);
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
      <div className="flex flex-col gap-4">
        {!formAcik && apartmanlar.length > 0 && (
          <button
            type="button"
            onClick={() => setFormAcik(true)}
            className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
            style={{ backgroundImage: 'var(--grad)' }}
          >
            {t('yeniBlok')}
          </button>
        )}

        {/* Apartman yoksa blok da acilamaz — dogru yonlendirme uydurma satirdan iyidir. */}
        {!formAcik && apartmanlar.length === 0 && !yukleniyor && (
          <p className="text-sm text-[color:var(--muted)]">
            {t('apartmanGerekli')}{' '}
            <Link href="/apartmanlar" className="underline underline-offset-2">
              {tn('apartmanlar')}
            </Link>
          </p>
        )}

        {formAcik && (
          <BlokEkleFormu
            apartmanlar={apartmanlar}
            secili={apartmanId}
            onKaydedildi={() => { setFormAcik(false); yukle(); }}
            onIptal={() => setFormAcik(false)}
          />
        )}

        {yukleniyor && <Yukleniyor satir={3} />}
        {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
        {!yukleniyor && hata === null && bloklar.length === 0 && (
          <BosDurum aciklama={t('bosAciklama')} />
        )}

        {!yukleniyor && hata === null && bloklar.length > 0 && (
          <div className="flex flex-col gap-3">
            {bloklar.map((b) => (
              <BlokSatiri
                key={b.id}
                blok={b}
                acik={acikBlok === b.id}
                katlar={katlar}
                katYukleniyor={katYukleniyor}
                onAc={() => blogaTikla(b.id)}
                onDegisti={yukle}
                metinler={{ t, tk, tg }}
              />
            ))}
          </div>
        )}
      </div>
    </UygulamaKabugu>
  );
}

type Ceviri = ReturnType<typeof useTranslations>;

function BlokSatiri({
  blok, acik, katlar, katYukleniyor, onAc, onDegisti, metinler,
}: {
  readonly blok: Blok;
  readonly acik: boolean;
  readonly katlar: readonly Kat[];
  readonly katYukleniyor: boolean;
  readonly onAc: () => void;
  readonly onDegisti: () => void;
  readonly metinler: { readonly t: Ceviri; readonly tk: Ceviri; readonly tg: Ceviri };
}) {
  const { t, tk, tg } = metinler;
  const bildirim = useBildirim();

  const [mod, setMod] = useState<'yok' | 'duzelt' | 'sil'>('yok');
  const [ad, setAd] = useState(blok.ad);
  const [gerekce, setGerekce] = useState('');
  const [formHatasi, setFormHatasi] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Bolumu olan blok silinemez: bolumler ve tahakkukları sahipsiz kalir.
  const silinebilir = blok.bolumSayisi === 0;

  const duzelt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ad.trim().length < 1) { setFormHatasi(t('hataAd')); return; }
    setFormHatasi(null);
    setGonderiliyor(true);
    try {
      await servis.blokGuncelle(blok.id, ad.trim());
      bildirim.basari(t('guncellendi'));
      setMod('yok');
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('guncellenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  const silme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gerekce.trim().length < 10) { setFormHatasi(t('hataGerekce')); return; }
    setFormHatasi(null);
    setGonderiliyor(true);
    try {
      await servis.blokSil(blok.id, gerekce.trim());
      bildirim.basari(t('silindi'));
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('silinemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="glass">
      <div className="flex flex-wrap items-center gap-3 p-[var(--cardpad)]">
        <button
          type="button"
          onClick={onAc}
          aria-expanded={acik}
          className="flex flex-1 items-center gap-3 text-left min-w-0"
        >
          <span aria-hidden="true" className="text-[color:var(--muted-2)]">
            {acik ? '▾' : '▸'}
          </span>
          <span className="font-semibold truncate">{blok.ad}</span>
          <span className="text-xs text-[color:var(--muted-2)] truncate">{blok.apartmanAdi}</span>
          <span className="ml-auto text-sm num text-[color:var(--muted)] whitespace-nowrap">
            {t('katSayisi')}: {blok.katSayisi} · {t('bolumSayisi')}: {blok.bolumSayisi}
          </span>
        </button>

        {mod === 'yok' && (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAd(blok.ad); setMod('duzelt'); }}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
              {t('duzelt')}
            </button>
            {/* Dugme gizlenmez; devre disi kalir ve nedeni title'da yazar. */}
            <button type="button" onClick={() => setMod('sil')} disabled={!silinebilir}
                    title={silinebilir ? undefined : t('silinemezIpucu')}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] border disabled:opacity-40"
                    style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
              {tg('sil')}
            </button>
          </div>
        )}
      </div>

      {mod === 'duzelt' && (
        <form onSubmit={(e) => { void duzelt(e); }}
              className="px-[var(--cardpad)] pb-[var(--cardpad)] flex flex-col gap-3 border-t border-[color:var(--line)] pt-3">
          <label className="flex flex-col gap-1 max-w-sm">
            <span className="text-xs text-[color:var(--muted-2)]">{t('ad')}</span>
            <input className={girdiSinifi} value={ad} required
                   onChange={(e) => setAd(e.target.value)} />
          </label>

          {/* Apartman alani BILEREK yok: blok tasinmaz. */}
          <p className="text-xs text-[color:var(--muted)]">{t('tasinmazIpucu')}</p>

          {formHatasi !== null && (
            <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{formHatasi}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                    style={{ backgroundImage: 'var(--grad)' }}>
              {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
            </button>
            <button type="button" onClick={() => { setMod('yok'); setFormHatasi(null); }}
                    className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
              {tg('iptal')}
            </button>
          </div>
        </form>
      )}

      {mod === 'sil' && (
        <form onSubmit={(e) => { void silme(e); }}
              className="px-[var(--cardpad)] pb-[var(--cardpad)] flex flex-col gap-3 border-t border-[color:var(--line)] pt-3">
          <p className="text-xs">{t('silAciklama')}</p>

          <label className="flex flex-col gap-1 max-w-md">
            <span className="text-xs text-[color:var(--muted-2)]">{t('silGerekce')}</span>
            <input className={girdiSinifi} value={gerekce} required
                   onChange={(e) => setGerekce(e.target.value)} />
          </label>

          {formHatasi !== null && (
            <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{formHatasi}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                    style={{ background: 'var(--crit)' }}>
              {gonderiliyor ? tg('yukleniyor') : tg('sil')}
            </button>
            <button type="button" onClick={() => { setMod('yok'); setFormHatasi(null); }}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
              {tg('iptal')}
            </button>
          </div>
        </form>
      )}

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
}

/** Yalnızca EKLEME formu — düzeltme satır içinde ve yalnızca `ad` alır. */
function BlokEkleFormu({
  apartmanlar, secili, onKaydedildi, onIptal,
}: {
  readonly apartmanlar: readonly Apartman[];
  readonly secili?: string;
  readonly onKaydedildi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('blok');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [apartmanId, setApartmanId] = useState(secili ?? apartmanlar[0]?.id ?? '');
  const [ad, setAd] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apartmanId === '') { setHata(t('hataApartman')); return; }
    if (ad.trim().length < 1) { setHata(t('hataAd')); return; }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.blokEkle(apartmanId, ad.trim());
      bildirim.basari(t('eklendi'));
      onKaydedildi();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('eklenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">{t('yeniBlok')}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('apartmanSec')}</span>
          <select className={girdiSinifi} value={apartmanId} required
                  onChange={(e) => setApartmanId(e.target.value)}>
            {apartmanlar.map((a) => (
              <option key={a.id} value={a.id}>{a.ad}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('ad')}</span>
          <input className={girdiSinifi} value={ad} required
                 onChange={(e) => setAd(e.target.value)} />
        </label>
      </div>

      {/* Ad TEKILLIGI apartman icindedir: sitede iki apartmanin da "A Blok"u olabilir. */}
      <p className="text-xs text-[color:var(--muted)]">{t('adIpucu')}</p>

      {hata !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={gonderiliyor}
                className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
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
