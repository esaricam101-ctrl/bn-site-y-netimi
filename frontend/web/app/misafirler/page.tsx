'use client';

/**
 * Misafirler — bağımsız bölümü ziyaret eden kişiler.
 *
 * ⚠️  MİSAFİR HAK SAHİBİ DEĞİLDİR: borç sorumlusu olmaz, tahakkuka girmez,
 *     arsa payı taşımaz, genel kurulda oy kullanmaz. Bu yüzden kalıcı bir
 *     `Kisi` kaydı AÇILMAZ; bilgiler misafir kaydının içinde tutulur.
 *
 * ⚠️  KVKK — misafir verisi kısa ömürlüdür. Kalıcı kimlik kaydı açmak,
 *     ziyaretten aylar sonra silinmesi gereken veriyi malik/kiracı
 *     kayıtlarıyla aynı ömre bağlardı.
 *
 * ÇIKIŞ TARİHİ BOŞSA MİSAFİR HÂLEN İÇERİDEDİR — güvenlik ve tahliye listesi
 * bu ayrıma dayanır; süzgeçte ilk sırada durur.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import {
  KisiBilgileriBolumu, bosKisiFormu, kisiFormunuDogrula, kisiGirdisineCevir,
  type KisiFormDurumu,
} from '@/components/kisi/kisi-bilgileri-bolumu';
import { servis, type Bolum, type Misafir } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const ALAN =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function MisafirlerSayfasi() {
  const t = useTranslations('misafir');
  const tn = useTranslations('navigasyon');

  const [satirlar, setSatirlar] = useState<readonly Misafir[]>([]);
  const [bolumler, setBolumler] = useState<readonly Bolum[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);

  const [sBolum, setSBolum] = useState('');
  // Varsayılan HÂLEN İÇERİDE: güvenlik ekranının ilk ihtiyacı bu listedir.
  const [sIceride, setSIceride] = useState('true');
  const [arama, setArama] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis
      .misafirler({
        ...(sBolum === '' ? {} : { bolumId: sBolum }),
        ...(sIceride === '' ? {} : { icerideMi: sIceride === 'true' }),
        ...(arama.trim() === '' ? {} : { arama: arama.trim() }),
      })
      .then(setSatirlar)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [sBolum, sIceride, arama]);

  useEffect(yukle, [yukle]);

  useEffect(() => {
    servis.bolumler().then((s) => setBolumler(s.kayitlar)).catch(() => setBolumler([]));
  }, []);

  const icerideSayisi = useMemo(
    () => satirlar.filter((m) => m.icerideMi).length,
    [satirlar],
  );

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('misafirler') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>
        <p className="text-xs px-3 py-2 rounded-[var(--rs)] border"
           style={{ borderColor: 'var(--line)', color: 'var(--muted-2)' }}>
          {t('kvkkIpucu')}
        </p>

        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('bolum')}
            <select className={ALAN} value={sBolum} onChange={(e) => setSBolum(e.target.value)}>
              <option value="">{t('tumBolumler')}</option>
              {bolumler.map((b) => (
                <option key={b.id} value={b.id}>{b.kapiNo}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('iceride')}
            <select className={ALAN} value={sIceride}
                    onChange={(e) => setSIceride(e.target.value)}>
              <option value="true">{t('icerideOlanlar')}</option>
              <option value="false">{t('cikti')}</option>
              <option value="">{t('tumu')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)] flex-1 min-w-[180px]">
            {t('ara')}
            <input className={ALAN} value={arama} placeholder={t('aramaIpucu')}
                   onChange={(e) => setArama(e.target.value)} />
          </label>

          <button type="button" onClick={() => setFormAcik((a) => !a)}
                  className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
                  style={{ backgroundImage: 'var(--grad)' }}>
            {t('yeniMisafirEkle')}
          </button>
        </div>

        {formAcik && (
          <MisafirFormu
            bolumler={bolumler}
            onEklendi={() => { setFormAcik(false); yukle(); }}
            onIptal={() => setFormAcik(false)}
          />
        )}

        {icerideSayisi > 0 && (
          <p className="text-xs" aria-live="polite" style={{ color: 'var(--warn)' }}>
            {t('icerideOlanlar')}: {icerideSayisi}
          </p>
        )}

        {yukleniyor ? <Yukleniyor />
          : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
            : satirlar.length === 0 ? <BosDurum aciklama={t('bosAciklama')} />
              : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {satirlar.map((m) => (
                    <MisafirKarti key={m.id} misafir={m} onDegisti={yukle} />
                  ))}
                </div>
              )}
      </div>
    </UygulamaKabugu>
  );
}

function MisafirKarti({
  misafir, onDegisti,
}: {
  readonly misafir: Misafir;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('misafir');
  const tk = useTranslations('kisiBilgileri');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [cikisAcik, setCikisAcik] = useState(false);
  const [cikis, setCikis] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const cikisYap = async () => {
    setGonderiliyor(true);
    try {
      await servis.misafirCikis(misafir.id, cikis);
      bildirim.basari(t('cikisYapildi'));
      setCikisAcik(false);
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('cikisYapilamadi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <article className="glass p-[var(--cardpad)] flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{misafir.adSoyad}</h3>
          <p className="text-xs text-[color:var(--muted-2)]">{misafir.kapiNo}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-[var(--rs)] border"
              style={{
                borderColor: misafir.icerideMi ? 'var(--warn)' : 'var(--line)',
                color: misafir.icerideMi ? 'var(--warn)' : 'var(--muted-2)',
              }}>
          {misafir.icerideMi ? t('iceride') : t('cikti')}
        </span>
      </div>

      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[color:var(--muted-2)]">{t('girisTarihi')}</dt>
        <dd className="num">{misafir.girisTarihi}</dd>

        {misafir.cikisTarihi !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('cikisTarihi')}</dt>
            <dd className="num">{misafir.cikisTarihi}</dd>
          </>
        )}

        {misafir.ziyaretNedeni !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('ziyaretNedeni')}</dt>
            <dd>{misafir.ziyaretNedeni}</dd>
          </>
        )}

        {misafir.telefon !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{tk('telefon')}</dt>
            <dd className="num">{misafir.telefon}</dd>
          </>
        )}

        {misafir.araclari.length > 0 && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('araclari')}</dt>
            <dd className="num">{misafir.araclari.map((a) => a.plaka).join(', ')}</dd>
          </>
        )}
      </dl>

      {misafir.icerideMi && (
        cikisAcik ? (
          <div className="flex flex-col gap-2 border-t border-[color:var(--line)] pt-2">
            <p className="text-xs" style={{ color: 'var(--warn)' }}>
              {t('cikisAracUyarisi')}
            </p>
            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('cikisTarihi')}
              <input type="date" className={ALAN} value={cikis}
                     onChange={(e) => setCikis(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={gonderiliyor || cikis === ''}
                      onClick={() => { void cikisYap(); }}
                      className="px-3 h-9 text-sm rounded-[var(--rs)] text-white disabled:opacity-60"
                      style={{ backgroundImage: 'var(--grad)' }}>
                {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
              </button>
              <button type="button" onClick={() => setCikisAcik(false)}
                      className="px-3 h-9 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
                {tg('iptal')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setCikisAcik(true)}
                  className="self-start px-3 h-9 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('cikisKaydet')}
          </button>
        )
      )}
    </article>
  );
}

/**
 * Tek ekran hızlı kayıt. Kişi seçimi SUNULMAZ: misafir `Kisi` kaydı kullanmaz.
 */
function MisafirFormu({
  bolumler, onEklendi, onIptal,
}: {
  readonly bolumler: readonly Bolum[];
  readonly onEklendi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('misafir');
  const tk = useTranslations('kisiBilgileri');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [kisi, setKisi] = useState<KisiFormDurumu>(bosKisiFormu());
  const [bolumId, setBolumId] = useState('');
  const [giris, setGiris] = useState('');
  const [cikis, setCikis] = useState('');
  const [neden, setNeden] = useState('');

  const [hatalar, setHatalar] = useState<Readonly<Record<string, string>>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();

    const h: Record<string, string> = { ...kisiFormunuDogrula(kisi, tk) };
    if (bolumId === '') h['bolumId'] = t('hataBolum');
    if (giris === '') h['giris'] = t('hataGiris');
    if (cikis !== '' && giris !== '' && cikis < giris) h['cikis'] = t('hataCikis');
    setHatalar(h);
    if (Object.keys(h).length > 0) return;

    const cevrilmis = kisiGirdisineCevir(kisi).kisi;
    if (cevrilmis === undefined) {
      setHatalar({ ad: tk('hataAd') });
      return;
    }

    setGonderiliyor(true);
    try {
      await servis.misafirEkle({
        bolumId,
        girisTarihi: giris,
        ...(cikis === '' ? {} : { cikisTarihi: cikis }),
        ...(neden.trim() === '' ? {} : { ziyaretNedeni: neden.trim() }),
        ad: cevrilmis.ad,
        soyad: cevrilmis.soyad,
        ...(cevrilmis.tcKimlikNo === undefined ? {} : { tcKimlikNo: cevrilmis.tcKimlikNo }),
        ...(cevrilmis.telefon === undefined ? {} : { telefon: cevrilmis.telefon }),
        ...(cevrilmis.eposta === undefined ? {} : { eposta: cevrilmis.eposta }),
        ...(cevrilmis.dogumTarihi === undefined ? {} : { dogumTarihi: cevrilmis.dogumTarihi }),
        ...(cevrilmis.cinsiyet === undefined ? {} : { cinsiyet: cevrilmis.cinsiyet }),
        ...(cevrilmis.adres === undefined ? {} : { adres: cevrilmis.adres }),
        ...(cevrilmis.notlar === undefined ? {} : { notlar: cevrilmis.notlar }),
        ...(cevrilmis.plakalar === undefined ? {} : { plakalar: cevrilmis.plakalar }),
      });
      bildirim.basari(t('eklendi'));
      const plakaSayisi = cevrilmis.plakalar?.length ?? 0;
      if (plakaSayisi > 0) bildirim.basari(tk('plakaEklendi', { sayi: plakaSayisi }));
      onEklendi();
    } catch (hata) {
      bildirim.hata(hataMetni(hata, t('eklenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">{t('yeniMisafirEkle')}</h2>

      <KisiBilgileriBolumu durum={kisi} setDurum={setKisi} hatalar={hatalar} />

      <fieldset className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-3">
        <legend className="text-sm font-semibold px-1">{t('baslik')}</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('bolum')}
            <select className={ALAN} value={bolumId}
                    onChange={(e) => setBolumId(e.target.value)}
                    aria-invalid={hatalar['bolumId'] !== undefined} required>
              <option value="">—</option>
              {bolumler.map((b) => (
                <option key={b.id} value={b.id}>{b.kapiNo}</option>
              ))}
            </select>
            {hatalar['bolumId'] !== undefined && (
              <span role="alert" style={{ color: 'var(--crit)' }}>{hatalar['bolumId']}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('ziyaretNedeni')}
            <input className={ALAN} value={neden} onChange={(e) => setNeden(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('girisTarihi')}
            <input type="date" className={ALAN} value={giris}
                   onChange={(e) => setGiris(e.target.value)}
                   aria-invalid={hatalar['giris'] !== undefined} required />
            {hatalar['giris'] !== undefined && (
              <span role="alert" style={{ color: 'var(--crit)' }}>{hatalar['giris']}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('cikisTarihi')}
            <input type="date" className={ALAN} value={cikis}
                   onChange={(e) => setCikis(e.target.value)}
                   aria-invalid={hatalar['cikis'] !== undefined} />
            {hatalar['cikis'] !== undefined && (
              <span role="alert" style={{ color: 'var(--crit)' }}>{hatalar['cikis']}</span>
            )}
          </label>
        </div>

        <p className="text-xs text-[color:var(--muted)]">{t('cikisIpucu')}</p>
      </fieldset>

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
