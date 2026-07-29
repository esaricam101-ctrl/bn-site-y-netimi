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
import {
  KisiBilgileriBolumu, bosKisiFormu, kisiFormunuDogrula, kisiGirdisineCevir,
  type KisiFormDurumu,
} from '@/components/kisi/kisi-bilgileri-bolumu';
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
  const tk = useTranslations('kisiBilgileri');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [kisi, setKisi] = useState<KisiFormDurumu>(bosKisiFormu());
  const [yakinlik, setYakinlik] = useState<string>('KENDISI');
  const [girisTarihi, setGirisTarihi] = useState('');
  const [acilAd, setAcilAd] = useState('');
  const [acilTel, setAcilTel] = useState('');
  const [hatalar, setHatalar] = useState<Readonly<Record<string, string>>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    const h: Record<string, string> = { ...kisiFormunuDogrula(kisi, tk) };
    if (!TARIH_BICIMI.test(girisTarihi)) h['girisTarihi'] = t('hataTarih');
    setHatalar(h);
    if (Object.keys(h).length > 0) return;

    const kisiGirdisi = kisiGirdisineCevir(kisi);

    setGonderiliyor(true);
    try {
      await servis.sakinEkle(bolumId, {
        ...kisiGirdisi,
        yakinlikDerecesi: yakinlik, girisTarihi,
        ...(acilAd.trim() === '' ? {} : { acilDurumKisiAdi: acilAd.trim() }),
        ...(acilTel.trim() === '' ? {} : { acilDurumTelefon: acilTel.trim() }),
      });
      bildirim.basari(t('eklendi'));
      const plakaSayisi = kisiGirdisi.kisi?.plakalar?.length ?? 0;
      if (plakaSayisi > 0) bildirim.basari(tk('plakaEklendi', { sayi: plakaSayisi }));
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

      {/* Formun İLK bölümü kişi bilgileridir; beş modülde aynı bileşen. */}
      <KisiBilgileriBolumu durum={kisi} setDurum={setKisi} hatalar={hatalar} />

      <div className="grid gap-3 sm:grid-cols-2 border-t border-[color:var(--line)] pt-3">
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

/**
 * Sakin bilgisi düzeltme. KİŞİ alanı YOKTUR — kaydın kimliğidir.
 * Yanlış kişi girildiyse çıkış verilip doğru kişiyle yeni kayıt açılır.
 */
function SakinDuzeltFormu({
  bolumId, sakin, kapat, onDegisti,
}: {
  readonly bolumId: string;
  readonly sakin: Sakin;
  readonly kapat: () => void;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('sakinYonetim');
  const td = useTranslations('daire');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [yakinlik, setYakinlik] = useState(sakin.yakinlikDerecesi);
  const [giris, setGiris] = useState(sakin.girisTarihi);
  const [acilAd, setAcilAd] = useState(sakin.acilDurumKisiAdi ?? '');
  const [acilTel, setAcilTel] = useState(sakin.acilDurumTelefon ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TARIH_BICIMI.test(giris)) { setHata(t('hataTarih')); return; }
    if (sakin.cikisTarihi !== null && sakin.cikisTarihi < giris) {
      setHata(t('hataGirisSonra', { cikis: sakin.cikisTarihi }));
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.sakinDuzelt(bolumId, sakin.id, {
        yakinlikDerecesi: yakinlik,
        girisTarihi: giris,
        acilDurumKisiAdi: acilAd.trim(),
        acilDurumTelefon: acilTel.trim(),
      });
      bildirim.basari(t('duzeltildi'));
      kapat();
      onDegisti();
    } catch (h) {
      bildirim.hata(
        h instanceof ApiHatasi ? h.problem.detail
          : h instanceof Error ? h.message : t('duzeltilemedi'),
      );
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }} className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{t('duzelt')}</p>
      <p className="text-xs p-2 rounded-[var(--rs)]"
         style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
        {t('kisiDegistirilemez')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
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
          <input type="date" className={girdiSinifi} value={giris} required
                 onChange={(e) => setGiris(e.target.value)} />
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

      {hata !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
      )}

      <button type="submit" disabled={gonderiliyor}
              className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
              style={{ backgroundImage: 'var(--grad)' }}>
        {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
      </button>
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
  const [duzeltAcik, setDuzeltAcik] = useState(false);
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
      {duzeltAcik && (
        <>
          <SakinDuzeltFormu bolumId={bolumId} sakin={sakin}
                            kapat={() => setDuzeltAcik(false)} onDegisti={onDegisti} />
          <button type="button" onClick={() => setDuzeltAcik(false)}
                  className="mt-2 text-sm underline text-[color:var(--muted)]">
            {tg('iptal')}
          </button>
        </>
      )}

      {!acik && !duzeltAcik ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDuzeltAcik(true)}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('duzelt')}
          </button>
          <button type="button" onClick={() => setAcik(true)}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('cikisVer')}
          </button>
        </div>
      ) : acik ? (
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
      ) : null}
    </div>
  );
}
