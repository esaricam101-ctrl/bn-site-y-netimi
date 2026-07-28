'use client';

/**
 * Malik eylemleri — DEVRET ve DÜZELT.
 *
 * İKİSİ AYRI EYLEMDİR VE BİRLEŞTİRİLMEZ. Tek bir "düzenle" formu hisse
 * oranını da düzenlenebilir gösterirdi; oysa hisse değişikliği bir DEVİRDİR:
 * eski oran bir döneme, yeni oran başkasına aittir. Kaydı yerinde güncellemek
 * geçmiş tahakkukun dayanağını sessizce değiştirir — Şubat borcu 1/2 hisseye
 * göre yazılmışken kayıt 1/3'e çevrilirse borç artık hiçbir orana karşılık
 * gelmez.
 *
 * Bu yüzden düzelt formunda hisse alanı YOKTUR ve arayüz devri ayrı bir
 * eylem olarak sunar.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBildirim } from '@/components/bildirim';
import { servis, type Malik } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const TAPU_TURLERI = [
  'KAT_MULKIYETI', 'KAT_IRTIFAKI', 'ARSA_PAYLI', 'MIRAS_ISTIRAK', 'DIGER',
] as const;

const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;

const girdiSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

export function MalikEylemleri({
  bolumId, malik, onDegisti,
}: {
  readonly bolumId: string;
  readonly malik: Malik;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('malik');
  const tg = useTranslations('genel');
  const [acik, setAcik] = useState<'yok' | 'devret' | 'duzelt'>('yok');

  // Devredilmis kayit uzerinde eylem yapilmaz; donemi kapanmistir.
  if (!malik.gecerliMi) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[color:var(--line)]">
      {acik === 'yok' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAcik('duzelt')}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('duzelt')}
          </button>
          <button type="button" onClick={() => setAcik('devret')}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border"
                  style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
            {t('devret')}
          </button>
        </div>
      )}

      {acik === 'duzelt' && (
        <DuzeltFormu bolumId={bolumId} malik={malik}
                     kapat={() => setAcik('yok')} onDegisti={onDegisti} />
      )}
      {acik === 'devret' && (
        <DevretFormu bolumId={bolumId} malik={malik}
                     kapat={() => setAcik('yok')} onDegisti={onDegisti} />
      )}

      {acik !== 'yok' && (
        <button type="button" onClick={() => setAcik('yok')}
                className="mt-2 text-sm underline text-[color:var(--muted)]">
          {tg('iptal')}
        </button>
      )}
    </div>
  );
}

/** Yazım hatası ve vekâlet düzeltmesi. HİSSE ALANI BULUNMAZ. */
function DuzeltFormu({
  bolumId, malik, kapat, onDegisti,
}: {
  readonly bolumId: string;
  readonly malik: Malik;
  readonly kapat: () => void;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('malik');
  const td = useTranslations('daire');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [tapuTuru, setTapuTuru] = useState(malik.tapuTuru);
  const [yevmiyeNo, setYevmiyeNo] = useState(malik.tapuYevmiyeNo ?? '');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      await servis.malikDuzelt(bolumId, malik.id, {
        tapuTuru,
        ...(yevmiyeNo.trim() === '' ? {} : { tapuYevmiyeNo: yevmiyeNo.trim() }),
      });
      bildirim.basari(t('duzeltildi'));
      kapat();
      onDegisti();
    } catch (hata) {
      bildirim.hata(hata instanceof ApiHatasi ? hata.problem.detail : t('duzeltilemedi'));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    // `void`: onSubmit void bekler, `gonder` Promise doner (no-misused-promises).
    <form onSubmit={(e) => { void gonder(e); }} className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{t('duzelt')}</p>

      {/* Hisse degistirilemez — nedeni ACIKCA yazilir. */}
      <p className="text-xs p-2 rounded-[var(--rs)]"
         style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
        {t('hisseDegistirilemez')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{td('tapuTuru')}</span>
          <select className={girdiSinifi} value={tapuTuru}
                  onChange={(e) => setTapuTuru(e.target.value)}>
            {TAPU_TURLERI.map((tt) => (
              <option key={tt} value={tt}>{td(`tapuTuru_${tt}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{td('yevmiyeNo')}</span>
          <input className={girdiSinifi} value={yevmiyeNo}
                 onChange={(e) => setYevmiyeNo(e.target.value)} />
        </label>
      </div>

      <button type="submit" disabled={gonderiliyor}
              className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
              style={{ backgroundImage: 'var(--grad)' }}>
        {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
      </button>
    </form>
  );
}

/** Tapu dönemini kapatır. Kayıt SİLİNMEZ. */
function DevretFormu({
  bolumId, malik, kapat, onDegisti,
}: {
  readonly bolumId: string;
  readonly malik: Malik;
  readonly kapat: () => void;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('malik');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [tapuBitis, setTapuBitis] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TARIH_BICIMI.test(tapuBitis)) {
      setHata(t('hataTarih'));
      return;
    }
    if (tapuBitis < malik.tapuBaslangic) {
      setHata(t('hataBitisOnce', { baslangic: malik.tapuBaslangic }));
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.malikDevret(bolumId, malik.id, tapuBitis);
      bildirim.basari(t('devredildi'));
      kapat();
      onDegisti();
    } catch (h) {
      bildirim.hata(h instanceof ApiHatasi ? h.problem.detail : t('devredilemedi'));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    // `void`: onSubmit void bekler, `gonder` Promise doner (no-misused-promises).
    <form onSubmit={(e) => { void gonder(e); }} className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{t('devret')}</p>
      <p className="text-xs p-2 rounded-[var(--rs)]"
         style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
        {t('devretAciklama')}
      </p>

      <label className="flex flex-col gap-1 max-w-xs">
        <span className="text-xs text-[color:var(--muted-2)]">{t('tapuBitisTarihi')}</span>
        <input type="date" className={girdiSinifi} value={tapuBitis}
               onChange={(e) => setTapuBitis(e.target.value)}
               aria-invalid={hata !== null} required />
      </label>

      {hata !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
      )}

      <button type="submit" disabled={gonderiliyor}
              className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--warn)' }}>
        {gonderiliyor ? tg('yukleniyor') : t('devret')}
      </button>
    </form>
  );
}
