'use client';

/**
 * Sakin yönetimi — fiilen oturan kişi.
 *
 * TEKİLLİK KURALI YOKTUR: bir dairede aynı anda birden çok sakin geçerlidir.
 * Malik ve kiracıdan farkı budur; zorlansaydı dört kişilik bir ailenin
 * yalnızca biri kaydedilebilirdi. Bu yüzden "yeni sakin" düğmesi mevcut
 * sakinler varken de etkindir.
 *
 * Sakin kaydı BORÇ SORUMLULUĞU DOĞURMAZ — borç malike ya da kiracıya yazılır
 * (ADR v1.1 §5). Sakin listesi acil durum ve fiilî yerleşim bilgisidir.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBildirim } from '@/components/bildirim';
import { servis, type Sakin } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const YAKINLIKLAR = [
  'KENDISI', 'ES', 'COCUK', 'ANNE_BABA', 'KARDES', 'AKRABA',
  'MISAFIR', 'CALISAN', 'DIGER',
] as const;

const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;

const girdiSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

export function SakinEkleFormu({
  bolumId, onEklendi, onIptal,
}: {
  readonly bolumId: string;
  readonly onEklendi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('sakinYonetim');
  const td = useTranslations('daire');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [kisiAdi, setKisiAdi] = useState('');
  const [yakinlik, setYakinlik] = useState<string>('KENDISI');
  const [girisTarihi, setGirisTarihi] = useState('');
  const [telefon, setTelefon] = useState('');
  const [acilAd, setAcilAd] = useState('');
  const [acilTel, setAcilTel] = useState('');
  const [hatalar, setHatalar] = useState<Readonly<Record<string, string>>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    const h: Record<string, string> = {};
    if (kisiAdi.trim().length < 3) h['kisiAdi'] = t('hataAd');
    if (!TARIH_BICIMI.test(girisTarihi)) h['girisTarihi'] = t('hataTarih');
    setHatalar(h);
    if (Object.keys(h).length > 0) return;

    setGonderiliyor(true);
    try {
      await servis.sakinEkle(bolumId, {
        kisiAdi: kisiAdi.trim(), yakinlikDerecesi: yakinlik, girisTarihi,
        ...(telefon.trim() === '' ? {} : { telefon: telefon.trim() }),
        ...(acilAd.trim() === '' ? {} : { acilDurumKisiAdi: acilAd.trim() }),
        ...(acilTel.trim() === '' ? {} : { acilDurumTelefon: acilTel.trim() }),
      });
      bildirim.basari(t('eklendi'));
      onEklendi();
    } catch (hata) {
      bildirim.hata(hata instanceof ApiHatasi ? hata.problem.detail : t('eklenemedi'));
    } finally {
      setGonderiliyor(false);
    }
  };

  const Hata = ({ ad }: { readonly ad: string }) =>
    hatalar[ad] === undefined ? null : (
      <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hatalar[ad]}</p>
    );

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h3 className="font-semibold">{t('yeniSakin')}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kisiAdi')}</span>
          <input className={girdiSinifi} value={kisiAdi} required
                 aria-invalid={hatalar['kisiAdi'] !== undefined}
                 onChange={(e) => setKisiAdi(e.target.value)} />
          <Hata ad="kisiAdi" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('yakinlik')}</span>
          <select className={girdiSinifi} value={yakinlik}
                  onChange={(e) => setYakinlik(e.target.value)}>
            {YAKINLIKLAR.map((y) => (
              <option key={y} value={y}>{td(`yakinlik_${y}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{td('girisTarihi')}</span>
          <input type="date" className={girdiSinifi} value={girisTarihi} required
                 aria-invalid={hatalar['girisTarihi'] !== undefined}
                 onChange={(e) => setGirisTarihi(e.target.value)} />
          <Hata ad="girisTarihi" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{td('telefon')}</span>
          <input className={girdiSinifi} value={telefon} inputMode="tel"
                 onChange={(e) => setTelefon(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('acilKisi')}</span>
          <input className={girdiSinifi} value={acilAd}
                 onChange={(e) => setAcilAd(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('acilTelefon')}</span>
          <input className={girdiSinifi} value={acilTel} inputMode="tel"
                 onChange={(e) => setAcilTel(e.target.value)} />
        </label>
      </div>

      <p className="text-xs text-[color:var(--muted)]">{t('sakinIpucu')}</p>

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

export function SakinCikisEylemi({
  bolumId, sakin, onDegisti,
}: {
  readonly bolumId: string;
  readonly sakin: Sakin;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('sakinYonetim');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [acik, setAcik] = useState(false);
  const [tarih, setTarih] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  if (!sakin.gecerliMi) return null;

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TARIH_BICIMI.test(tarih)) { setHata(t('hataTarih')); return; }
    if (tarih < sakin.girisTarihi) {
      setHata(t('hataCikisOnce', { giris: sakin.girisTarihi }));
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.sakinCikis(bolumId, sakin.id, tarih);
      bildirim.basari(t('cikisVerildi'));
      setAcik(false);
      onDegisti();
    } catch (h) {
      bildirim.hata(h instanceof ApiHatasi ? h.problem.detail : t('cikisVerilemedi'));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[color:var(--line)]">
      {!acik ? (
        <button type="button" onClick={() => setAcik(true)}
                className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('cikisVer')}
        </button>
      ) : (
        <form onSubmit={(e) => { void gonder(e); }} className="flex flex-col gap-3">
          <p className="text-xs p-2 rounded-[var(--rs)]"
             style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
            {t('cikisAciklama')}
          </p>

          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-xs text-[color:var(--muted-2)]">{t('cikisTarihi')}</span>
            <input type="date" className={girdiSinifi} value={tarih} required
                   onChange={(e) => setTarih(e.target.value)} />
          </label>

          {hata !== null && (
            <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                    style={{ backgroundImage: 'var(--grad)' }}>
              {gonderiliyor ? tg('yukleniyor') : t('cikisVer')}
            </button>
            <button type="button" onClick={() => setAcik(false)}
                    className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
              {tg('iptal')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
