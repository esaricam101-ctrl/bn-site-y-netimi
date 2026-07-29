'use client';

/**
 * Apartman yönetim ekranı — hiyerarşinin tenant altındaki ilk katmanı
 * (ADR-0008).
 *
 * Bir yerleşkedeki apartman sayısı küçüktür (tek apartmanda 1, büyük sitede
 * onlarca); tablo yerine kart ızgarası kullanılır. Kart adres ve blok sayısını
 * birlikte gösterir — tabloda adres satırı taşar.
 *
 * KURAL: **bloğu olan apartman silinemez** — silinirse bloklar sahipsiz kalır.
 * Silme düğmesi gizlenmez, devre dışı bırakılır ve nedeni yazılır.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { servis, type Apartman } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const girdiSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

/** Sunucu iş kuralı ihlali döndürdüyse mesajı AYNEN gösterilir. */
function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function ApartmanlarSayfasi() {
  const t = useTranslations('apartman');
  const tn = useTranslations('navigasyon');

  const [satirlar, setSatirlar] = useState<readonly Apartman[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.apartmanlar().then(setSatirlar).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[{ etiket: tn('genelBakis'), yol: '/yonetim' }, { etiket: tn('apartmanlar') }]}
    >
      <div className="flex flex-col gap-4">
        {!formAcik && (
          <button
            type="button"
            onClick={() => setFormAcik(true)}
            className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
            style={{ backgroundImage: 'var(--grad)' }}
          >
            {t('yeniApartman')}
          </button>
        )}

        {formAcik && (
          <ApartmanFormu
            onKaydedildi={() => { setFormAcik(false); yukle(); }}
            onIptal={() => setFormAcik(false)}
          />
        )}

        {yukleniyor && <Yukleniyor satir={3} />}
        {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
        {!yukleniyor && hata === null && satirlar.length === 0 && (
          <BosDurum aciklama={t('bosAciklama')} />
        )}

        {!yukleniyor && hata === null && satirlar.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {satirlar.map((a) => (
              <ApartmanKarti key={a.id} apartman={a} onDegisti={yukle} />
            ))}
          </div>
        )}
      </div>
    </UygulamaKabugu>
  );
}

/** Ekleme ve düzeltme AYNI formdur — alanlar birebir aynıdır. */
function ApartmanFormu({
  mevcut, onKaydedildi, onIptal,
}: {
  readonly mevcut?: Apartman;
  readonly onKaydedildi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('apartman');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [ad, setAd] = useState(mevcut?.ad ?? '');
  const [adres, setAdres] = useState(mevcut?.adres ?? '');
  const [siteIciKod, setSiteIciKod] = useState(mevcut?.siteIciKod ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ad.trim().length < 2) { setHata(t('hataAd')); return; }
    setHata(null);
    setGonderiliyor(true);

    const girdi = {
      ad: ad.trim(),
      ...(adres.trim() === '' ? {} : { adres: adres.trim() }),
      ...(siteIciKod.trim() === '' ? {} : { siteIciKod: siteIciKod.trim() }),
    };

    try {
      if (mevcut === undefined) {
        await servis.apartmanEkle(girdi);
        bildirim.basari(t('eklendi'));
      } else {
        await servis.apartmanGuncelle(mevcut.id, girdi);
        bildirim.basari(t('guncellendi'));
      }
      onKaydedildi();
    } catch (h) {
      bildirim.hata(hataMetni(h, mevcut === undefined ? t('eklenemedi') : t('guncellenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">
        {mevcut === undefined ? t('yeniApartman') : t('duzelt')}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('ad')}</span>
          <input className={girdiSinifi} value={ad} required
                 aria-invalid={hata !== null}
                 onChange={(e) => setAd(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('siteIciKod')}</span>
          <input className={girdiSinifi} value={siteIciKod}
                 onChange={(e) => setSiteIciKod(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-[color:var(--muted-2)]">{t('adres')}</span>
          <input className={girdiSinifi} value={adres}
                 onChange={(e) => setAdres(e.target.value)} />
        </label>
      </div>

      {/* Adres harita entegrasyonuna hazir; koordinat alani henuz yok. */}
      <p className="text-xs text-[color:var(--muted)]">{t('adresIpucu')}</p>

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

function ApartmanKarti({
  apartman, onDegisti,
}: {
  readonly apartman: Apartman;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('apartman');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [mod, setMod] = useState<'yok' | 'duzelt' | 'sil'>('yok');
  const [gerekce, setGerekce] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Bloglu apartman silinemez: bloklar sahipsiz kalir.
  const silinebilir = apartman.blokSayisi === 0;

  const silme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gerekce.trim().length < 10) { setHata(t('hataGerekce')); return; }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.apartmanSil(apartman.id, gerekce.trim());
      bildirim.basari(t('silindi'));
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('silinemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  if (mod === 'duzelt') {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <ApartmanFormu
          mevcut={apartman}
          onKaydedildi={() => { setMod('yok'); onDegisti(); }}
          onIptal={() => setMod('yok')}
        />
      </div>
    );
  }

  return (
    <div className="glass p-[var(--cardpad)] flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{apartman.ad}</h2>
        {apartman.siteIciKod !== null && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-[color:var(--line)]">
            {apartman.siteIciKod}
          </span>
        )}
      </div>

      {apartman.adres !== null && (
        <p className="text-sm text-[color:var(--muted)]">{apartman.adres}</p>
      )}

      <Link href={`/bloklar?apartmanId=${apartman.id}`}
            className="text-sm num text-[color:var(--muted)] hover:text-[color:var(--text)] underline-offset-2 hover:underline self-start">
        {t('blokSayisi')}: {apartman.blokSayisi}
      </Link>

      {mod === 'yok' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMod('duzelt')}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('duzelt')}
          </button>
          {/* Dugme GIZLENMEZ, devre disi birakilir ve nedeni title'da yazar. */}
          <button type="button" onClick={() => setMod('sil')} disabled={!silinebilir}
                  title={silinebilir ? undefined : t('silinemezIpucu')}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border disabled:opacity-40"
                  style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
            {tg('sil')}
          </button>
        </div>
      )}

      {mod === 'sil' && (
        <form onSubmit={(e) => { void silme(e); }} className="flex flex-col gap-3">
          <p className="text-xs p-2 rounded-[var(--rs)]"
             style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
            {t('silAciklama')}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('silGerekce')}</span>
            <input className={girdiSinifi} value={gerekce} required
                   onChange={(e) => setGerekce(e.target.value)} />
          </label>

          {hata !== null && (
            <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                    style={{ background: 'var(--crit)' }}>
              {gonderiliyor ? tg('yukleniyor') : tg('sil')}
            </button>
            <button type="button" onClick={() => setMod('yok')}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
              {tg('iptal')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
