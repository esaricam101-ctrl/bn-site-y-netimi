'use client';

/**
 * Kat yönetim ekranı — hiyerarşinin Blok ile Bağımsız Bölüm arasındaki katmanı.
 *
 * Blok seçimi zorunludur: kat bir bloğa aittir ve bloksuz kat listesi anlamsız
 * olurdu. Blok `?blokId=` ile gelir ya da ekrandan seçilir.
 *
 * KRİTİK KURAL: bölümü olan katın NUMARASI değiştirilemez — bölümlerin `kat`
 * alanı bu numaraya bağlıdır ve oluşturmada eşitliği zorlanır. Arayüz alanı
 * devre dışı bırakır ve nedenini YAZAR; sessizce reddedip sunucu hatası
 * göstermek kullanıcıya neyi yanlış yaptığını anlatmaz.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { servis, type Blok, type Kat } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const girdiSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent';

export default function KatlarSayfasi() {
  return (
    <Suspense fallback={<UygulamaKabugu><Yukleniyor satir={3} /></UygulamaKabugu>}>
      <KatlarIcerik />
    </Suspense>
  );
}

function KatlarIcerik() {
  const t = useTranslations('kat');
  const tn = useTranslations('navigasyon');
  const parametreler = useSearchParams();

  const [bloklar, setBloklar] = useState<readonly Blok[]>([]);
  const [seciliBlok, setSeciliBlok] = useState<string>(parametreler.get('blokId') ?? '');
  const [katlar, setKatlar] = useState<readonly Kat[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);

  useEffect(() => {
    servis.bloklar()
      .then((b) => {
        setBloklar(b);
        // Blok verilmemisse ilkini sec; bos ekran yerine calisan bir liste.
        if (seciliBlok === '' && b.length > 0) setSeciliBlok(b[0]?.id ?? '');
      })
      .catch(setHata);
  }, [seciliBlok]);

  const katlariYukle = useCallback(() => {
    if (seciliBlok === '') { setYukleniyor(false); return; }
    setYukleniyor(true);
    setHata(null);
    servis.katlar(seciliBlok).then(setKatlar).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [seciliBlok]);

  useEffect(katlariYukle, [katlariYukle]);

  const blokAdi = bloklar.find((b) => b.id === seciliBlok)?.ad ?? '';

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('bloklar'), yol: '/bloklar' },
        { etiket: tn('katlar') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 max-w-xs">
          <span className="text-xs text-[color:var(--muted-2)]">{t('blokSec')}</span>
          <select
            className={girdiSinifi}
            value={seciliBlok}
            onChange={(e) => { setSeciliBlok(e.target.value); setFormAcik(false); }}
          >
            {bloklar.map((b) => (
              <option key={b.id} value={b.id}>{b.apartmanAdi} — {b.ad}</option>
            ))}
          </select>
        </label>

        {!formAcik && seciliBlok !== '' && (
          <button
            type="button"
            onClick={() => setFormAcik(true)}
            className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
            style={{ backgroundImage: 'var(--grad)' }}
          >
            {t('yeniKat')}
          </button>
        )}

        {formAcik && (
          <KatEkleFormu
            blokId={seciliBlok}
            onEklendi={() => { setFormAcik(false); katlariYukle(); }}
            onIptal={() => setFormAcik(false)}
          />
        )}

        {yukleniyor && <Yukleniyor satir={4} />}
        {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={katlariYukle} />}
        {!yukleniyor && hata === null && katlar.length === 0 && (
          <BosDurum aciklama={t('bosAciklama')} />
        )}

        {!yukleniyor && hata === null && katlar.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {katlar.map((k) => (
              <KatKarti key={k.id} blokId={seciliBlok} kat={k}
                        blokAdi={blokAdi} onDegisti={katlariYukle} />
            ))}
          </div>
        )}
      </div>
    </UygulamaKabugu>
  );
}

function KatEkleFormu({
  blokId, onEklendi, onIptal,
}: {
  readonly blokId: string;
  readonly onEklendi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('kat');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [no, setNo] = useState('');
  const [ad, setAd] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    const sayi = Number(no);
    // Bodrum katlar NEGATIFTIR; sifir da gecerlidir (zemin).
    if (!/^-?\d+$/.test(no) || sayi < -10 || sayi > 200) {
      setHata(t('hataNo'));
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.katEkle(blokId, sayi, ad.trim());
      bildirim.basari(t('eklendi'));
      onEklendi();
    } catch (h) {
      bildirim.hata(
        h instanceof ApiHatasi ? h.problem.detail
          : h instanceof Error ? h.message : t('eklenemedi'),
      );
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">{t('yeniKat')}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('katNo2')}</span>
          <input className={`${girdiSinifi} num`} value={no} required inputMode="numeric"
                 aria-invalid={hata !== null}
                 onChange={(e) => setNo(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('katAdi')}</span>
          <input className={girdiSinifi} value={ad}
                 onChange={(e) => setAd(e.target.value)} />
        </label>
      </div>

      <p className="text-xs text-[color:var(--muted)]">{t('noIpucu')}</p>

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

function KatKarti({
  blokId, kat, blokAdi, onDegisti,
}: {
  readonly blokId: string;
  readonly kat: Kat;
  readonly blokAdi: string;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('kat');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [mod, setMod] = useState<'yok' | 'duzelt' | 'sil'>('yok');
  const [no, setNo] = useState(String(kat.no));
  const [ad, setAd] = useState(kat.ad ?? '');
  const [gerekce, setGerekce] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Bolumu olan katin NUMARASI degistirilemez; ad degistirilebilir.
  const noKilitli = kat.bolumSayisi > 0;
  const silinebilir = kat.bolumSayisi === 0;

  const duzelt = async (e: React.FormEvent) => {
    e.preventDefault();
    const sayi = Number(no);
    if (!noKilitli && (!/^-?\d+$/.test(no) || sayi < -10 || sayi > 200)) {
      setHata(t('hataNo'));
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.katGuncelle(blokId, kat.id, {
        ...(noKilitli ? {} : { no: sayi }),
        ad: ad.trim(),
      });
      bildirim.basari(t('guncellendi'));
      setMod('yok');
      onDegisti();
    } catch (h) {
      bildirim.hata(
        h instanceof ApiHatasi ? h.problem.detail
          : h instanceof Error ? h.message : t('guncellenemedi'),
      );
    } finally {
      setGonderiliyor(false);
    }
  };

  const silme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gerekce.trim().length < 10) { setHata(t('hataGerekce')); return; }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.katSil(blokId, kat.id, gerekce.trim());
      bildirim.basari(t('silindi'));
      onDegisti();
    } catch (h) {
      bildirim.hata(
        h instanceof ApiHatasi ? h.problem.detail
          : h instanceof Error ? h.message : t('silinemedi'),
      );
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="glass p-[var(--cardpad)] flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{kat.ad ?? t('katNo', { no: kat.no })}</p>
          <p className="text-xs text-[color:var(--muted-2)]">
            {blokAdi} · {t('katNo', { no: kat.no })}
          </p>
        </div>
        <Link href={`/bolumler?katId=${kat.id}`}
              className="text-sm num text-[color:var(--muted)] hover:text-[color:var(--text)] underline-offset-2 hover:underline">
          {t('bolumSayisi2', { sayi: kat.bolumSayisi })}
        </Link>
      </div>

      {mod === 'yok' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMod('duzelt')}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('duzelt')}
          </button>
          <button type="button" onClick={() => setMod('sil')} disabled={!silinebilir}
                  title={silinebilir ? undefined : t('silinemezIpucu')}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border disabled:opacity-40"
                  style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
            {tg('sil')}
          </button>
        </div>
      )}

      {mod === 'duzelt' && (
        <form onSubmit={(e) => { void duzelt(e); }} className="flex flex-col gap-3">
          {/*
            Kilitli alan SESSIZCE reddedilmez; devre disi birakilir ve nedeni
            yazilir — kullanici neyi neden yapamadigini bilmeli.
          */}
          {noKilitli && (
            <p className="text-xs p-2 rounded-[var(--rs)]"
               style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
              {t('noKilitli', { sayi: kat.bolumSayisi })}
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('katNo2')}</span>
            <input className={`${girdiSinifi} num disabled:opacity-50`} value={no}
                   disabled={noKilitli} inputMode="numeric"
                   onChange={(e) => setNo(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('katAdi')}</span>
            <input className={girdiSinifi} value={ad}
                   onChange={(e) => setAd(e.target.value)} />
          </label>

          {hata !== null && (
            <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                    style={{ backgroundImage: 'var(--grad)' }}>
              {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
            </button>
            <button type="button" onClick={() => setMod('yok')}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
              {tg('iptal')}
            </button>
          </div>
        </form>
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
