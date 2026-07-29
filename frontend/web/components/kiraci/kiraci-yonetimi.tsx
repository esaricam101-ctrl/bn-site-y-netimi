'use client';

/**
 * Kiracı yönetimi — sözleşme ekleme ve tahliye.
 *
 * TEKİLLİK: bir bölümde aynı anda EN FAZLA BİR geçerli kira sözleşmesi
 * bulunur. İki geçerli sözleşme olursa kullanana ait gider yanlış kişiye
 * yazılır ve hata sessizdir. Kural sunucuda (`iliskiyiDogrula`) zorlanır;
 * arayüz geçerli sözleşme varken "yeni sözleşme" düğmesini GİZLEMEZ, devre
 * dışı bırakır ve nedenini yazar — gizlenen düğme kullanıcıya neden
 * yapamadığını anlatmaz.
 *
 * DÜZELTME UCU YOK: kişi ve başlangıç sözleşmenin kimliğidir; yanlış kişiye
 * açılmış sözleşme düzeltilmez, tahliye edilip yenisi açılır.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBildirim } from '@/components/bildirim';
import { servis, type Kiraci } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;
const PARA_BICIMI = /^\d+([.,]\d{1,2})?$/;

const girdiSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

export function KiraciEkleFormu({
  bolumId, onEklendi, onIptal,
}: {
  readonly bolumId: string;
  readonly onEklendi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('kiraci');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [kisiAdi, setKisiAdi] = useState('');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [sozlesmeNo, setSozlesmeNo] = useState('');
  const [depozito, setDepozito] = useState('');
  const [hatalar, setHatalar] = useState<Readonly<Record<string, string>>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    const h: Record<string, string> = {};
    if (kisiAdi.trim().length < 3) h['kisiAdi'] = t('hataAd');
    if (!TARIH_BICIMI.test(baslangic)) h['baslangic'] = t('hataTarih');
    if (bitis !== '' && bitis < baslangic) h['bitis'] = t('hataBitisOnce');
    if (depozito !== '' && !PARA_BICIMI.test(depozito)) h['depozito'] = t('hataDepozito');
    setHatalar(h);
    if (Object.keys(h).length > 0) return;

    setGonderiliyor(true);
    try {
      await servis.kiraciEkle(bolumId, {
        kisiAdi: kisiAdi.trim(), baslangic,
        ...(bitis === '' ? {} : { bitis }),
        ...(sozlesmeNo.trim() === '' ? {} : { sozlesmeNo: sozlesmeNo.trim() }),
        // Para METIN olarak gonderilir; virgul noktaya cevrilir.
        ...(depozito === '' ? {} : { depozito: depozito.replace(',', '.') }),
      });
      bildirim.basari(t('eklendi'));
      onEklendi();
    } catch (hata) {
      bildirim.hata(hata instanceof ApiHatasi ? hata.problem.detail
        : hata instanceof Error ? hata.message : t('eklenemedi'));
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
      <h3 className="font-semibold">{t('yeniSozlesme')}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('kisiAdi')}</span>
          <input className={girdiSinifi} value={kisiAdi} required
                 aria-invalid={hatalar['kisiAdi'] !== undefined}
                 onChange={(e) => setKisiAdi(e.target.value)} />
          <Hata ad="kisiAdi" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('sozlesmeNo')}</span>
          <input className={girdiSinifi} value={sozlesmeNo}
                 onChange={(e) => setSozlesmeNo(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('baslangic')}</span>
          <input type="date" className={girdiSinifi} value={baslangic} required
                 aria-invalid={hatalar['baslangic'] !== undefined}
                 onChange={(e) => setBaslangic(e.target.value)} />
          <Hata ad="baslangic" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('bitisIsteğe')}</span>
          <input type="date" className={girdiSinifi} value={bitis}
                 aria-invalid={hatalar['bitis'] !== undefined}
                 onChange={(e) => setBitis(e.target.value)} />
          <Hata ad="bitis" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('depozito')}</span>
          <input className={`${girdiSinifi} num`} value={depozito} inputMode="decimal"
                 aria-invalid={hatalar['depozito'] !== undefined}
                 onChange={(e) => setDepozito(e.target.value)} />
          <Hata ad="depozito" />
        </label>
      </div>

      <p className="text-xs text-[color:var(--muted)]">{t('bitisIpucu')}</p>

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
 * Sözleşme bilgisi düzeltme.
 *
 * KİŞİ ve BAŞLANGIÇ alanları YOKTUR — ikisi de sözleşmenin kimliğidir.
 * Yanlış kişiye açılmış sözleşme düzeltilmez; tahliye edilip yenisi açılır.
 * Bu, malikteki "hisse düzeltilemez" kuralıyla aynı mantıktır: kimliği
 * değiştirmek geçmiş tahakkukun dayanağını sessizce bozar.
 */
export function KiraciDuzeltFormu({
  bolumId, kiraci, kapat, onDegisti,
}: {
  readonly bolumId: string;
  readonly kiraci: Kiraci;
  readonly kapat: () => void;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('kiraci');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [sozlesmeNo, setSozlesmeNo] = useState(kiraci.sozlesmeNo ?? '');
  const [depozito, setDepozito] = useState(kiraci.depozito ?? '');
  const [bitis, setBitis] = useState(kiraci.bitis ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const tahliyeEdilmis = kiraci.tahliyeTarihi !== null;

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depozito !== '' && !PARA_BICIMI.test(depozito)) { setHata(t('hataDepozito')); return; }
    if (bitis !== '' && bitis < kiraci.baslangic) { setHata(t('hataBitisOnce')); return; }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.kiraciDuzelt(bolumId, kiraci.id, {
        sozlesmeNo: sozlesmeNo.trim(),
        ...(depozito === '' ? {} : { depozito: depozito.replace(',', '.') }),
        // Tahliye edilmis sozlesmede bitis GONDERILMEZ; sunucu da reddeder.
        ...(bitis === '' || tahliyeEdilmis ? {} : { bitis }),
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
        {t('kimlikDegistirilemez')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('sozlesmeNo')}</span>
          <input className={girdiSinifi} value={sozlesmeNo}
                 onChange={(e) => setSozlesmeNo(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('depozito')}</span>
          <input className={`${girdiSinifi} num`} value={depozito} inputMode="decimal"
                 onChange={(e) => setDepozito(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('bitisIsteğe')}</span>
          <input type="date" className={`${girdiSinifi} disabled:opacity-50`} value={bitis}
                 disabled={tahliyeEdilmis}
                 onChange={(e) => setBitis(e.target.value)} />
          {tahliyeEdilmis && (
            <span className="text-xs text-[color:var(--muted-2)]">{t('bitisKilitli')}</span>
          )}
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

export function KiraciTahliyeEylemi({
  bolumId, kiraci, onDegisti,
}: {
  readonly bolumId: string;
  readonly kiraci: Kiraci;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('kiraci');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [acik, setAcik] = useState(false);
  const [duzeltAcik, setDuzeltAcik] = useState(false);
  const [tarih, setTarih] = useState('');
  const [gerekce, setGerekce] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  if (!kiraci.gecerliMi) return null;

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!TARIH_BICIMI.test(tarih)) { setHata(t('hataTarih')); return; }
    if (tarih < kiraci.baslangic) {
      setHata(t('hataTahliyeOnce', { baslangic: kiraci.baslangic }));
      return;
    }
    if (gerekce.trim().length < 5) { setHata(t('hataGerekce')); return; }
    setHata(null);
    setGonderiliyor(true);
    try {
      await servis.kiraciTahliye(bolumId, kiraci.id, tarih, gerekce.trim());
      bildirim.basari(t('tahliyeEdildi'));
      setAcik(false);
      onDegisti();
    } catch (h) {
      bildirim.hata(h instanceof ApiHatasi ? h.problem.detail : t('tahliyeEdilemedi'));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[color:var(--line)]">
      {duzeltAcik && (
        <>
          <KiraciDuzeltFormu bolumId={bolumId} kiraci={kiraci}
                             kapat={() => setDuzeltAcik(false)} onDegisti={onDegisti} />
          <button type="button" onClick={() => setDuzeltAcik(false)}
                  className="mt-2 text-sm underline text-[color:var(--muted)]">
            {tg('iptal')}
          </button>
        </>
      )}

      {!acik && !duzeltAcik ? (
        <div className="flex flex-wrap gap-2">
          {/* Duzelt ve tahliye AYRI eylemler — malikteki desenle ayni. */}
          <button type="button" onClick={() => setDuzeltAcik(true)}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('duzelt')}
          </button>
          <button type="button" onClick={() => setAcik(true)}
                  className="px-3 py-1.5 text-sm rounded-[var(--rs)] border"
                  style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
            {t('tahliyeEt')}
          </button>
        </div>
      ) : acik ? (
        <form onSubmit={(e) => { void gonder(e); }} className="flex flex-col gap-3">
          <p className="text-xs p-2 rounded-[var(--rs)]"
             style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
            {t('tahliyeAciklama')}
          </p>

          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-xs text-[color:var(--muted-2)]">{t('tahliyeTarihi')}</span>
            <input type="date" className={girdiSinifi} value={tarih} required
                   onChange={(e) => setTarih(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('tahliyeGerekcesi')}</span>
            <input className={girdiSinifi} value={gerekce} required
                   onChange={(e) => setGerekce(e.target.value)} />
          </label>

          {hata !== null && (
            <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{hata}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-4 h-[var(--rowh)] rounded-[var(--rs)] font-semibold text-white disabled:opacity-60"
                    style={{ background: 'var(--warn)' }}>
              {gonderiliyor ? tg('yukleniyor') : t('tahliyeEt')}
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
