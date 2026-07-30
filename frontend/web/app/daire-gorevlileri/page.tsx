'use client';

/**
 * Daire görevlileri — malik / kiracı / sakinin ÜCRETLİ çalıştırdığı, bağımsız
 * bölüme hizmet veren kişiler (çocuk bakıcısı, ev yardımcısı, temizlikçi,
 * aşçı, şoför, özel güvenlik, özel öğretmen).
 *
 * ⚠️  SİTE PERSONELİ ekranı ile karıştırılmamalıdır: orada işveren yönetimdir
 *     (site müdürü, güvenlik kadrosu) ve SGK · departman · vardiya · zimmet
 *     alanları vardır. Burada yoktur — bu yükümlülükler yönetimin değildir.
 *
 * MALİK · KİRACI · SAKİN ekranlarına DOKUNMAZ.
 *
 * VARSAYILAN AKIŞ TEK EKRANDAN HIZLI KAYIT: kişi bilgileri, görev bilgileri ve
 * araç plakaları aynı formda girilir ve tek işlemde yazılır.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import {
  KISI_HATA_ANAHTARLARI, KisiBilgileriBolumu, bosKisiFormu,
  kisiFormunuDogrula, kisiGirdisineCevir, type KisiFormDurumu,
} from '@/components/kisi/kisi-bilgileri-bolumu';
import {
  Sekmeler, ilkHataliSekme, sekmeHataSayisi, type SekmeTanimi,
} from '@/components/sekmeler';
import { DAIRE_GOREVLERI, GOREVLI_DURUMLARI, ISVEREN_TIPLERI } from '@/lib/kodlar';
import { servis, type Bolum, type DaireGorevlisi } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const ALAN =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

/** Görev sekmesinin doğrulama anahtarları — rozet bunlardan sayılır. */
const GOREV_HATA_ANAHTARLARI = [
  'bolumId', 'gorev', 'isvereniTipi', 'baslangic', 'bitis', 'aciklama',
] as const;

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function DaireGorevlileriSayfasi() {
  const t = useTranslations('gorevli');
  const tn = useTranslations('navigasyon');

  const [satirlar, setSatirlar] = useState<readonly DaireGorevlisi[]>([]);
  const [bolumler, setBolumler] = useState<readonly Bolum[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);

  const [sBolum, setSBolum] = useState('');
  const [sGorev, setSGorev] = useState('');
  const [sDurum, setSDurum] = useState('AKTIF');
  const [arama, setArama] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis
      .daireGorevlileri({
        ...(sBolum === '' ? {} : { bolumId: sBolum }),
        ...(sGorev === '' ? {} : { gorev: sGorev }),
        ...(sDurum === '' ? {} : { durum: sDurum }),
        ...(arama.trim() === '' ? {} : { arama: arama.trim() }),
      })
      .then(setSatirlar)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [sBolum, sGorev, sDurum, arama]);

  useEffect(yukle, [yukle]);

  useEffect(() => {
    servis.bolumler().then((s) => setBolumler(s.kayitlar)).catch(() => {
      // Bölüm listesi yüklenemezse form açılabilir kalmalı; kullanıcı yine de
      // sayfayı görüp süzgeç kullanabilir. Hata bildirimi form içinde çıkar.
      setBolumler([]);
    });
  }, []);

  const araciOlan = useMemo(
    () => satirlar.filter((g) => g.araclari.length > 0).length,
    [satirlar],
  );

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('daireGorevlileri') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {/*
          AYRIM UYARISI her zaman görünür: iki modül karıştırıldığında yönetim
          kendi kadrosunu buraya yazar ve SGK/zimmet alanlarını bulamaz.
        */}
        <p className="text-xs px-3 py-2 rounded-[var(--rs)] border"
           style={{ borderColor: 'var(--line)', color: 'var(--muted-2)' }}>
          {t('ayrimUyarisi')}
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
            {t('gorev')}
            <select className={ALAN} value={sGorev} onChange={(e) => setSGorev(e.target.value)}>
              <option value="">{t('tumGorevler')}</option>
              {DAIRE_GOREVLERI.map((g) => (
                <option key={g} value={g}>{t(`gorev_${g}`)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('durum')}
            <select className={ALAN} value={sDurum} onChange={(e) => setSDurum(e.target.value)}>
              <option value="">{t('tumDurumlar')}</option>
              {GOREVLI_DURUMLARI.map((d) => (
                <option key={d} value={d}>{t(`durum_${d}`)}</option>
              ))}
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
            {t('yeniGorevliEkle')}
          </button>
        </div>

        {formAcik && (
          <GorevliFormu
            bolumler={bolumler}
            onEklendi={() => { setFormAcik(false); yukle(); }}
            onIptal={() => setFormAcik(false)}
          />
        )}

        {araciOlan > 0 && (
          <p className="text-xs text-[color:var(--muted)]">
            {t('araclari')}: {araciOlan}
          </p>
        )}

        {yukleniyor ? <Yukleniyor />
          : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
            : satirlar.length === 0 ? <BosDurum aciklama={t('bosAciklama')} />
              : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {satirlar.map((g) => (
                    <GorevliKarti key={g.id} gorevli={g} onDegisti={yukle} />
                  ))}
                </div>
              )}
      </div>
    </UygulamaKabugu>
  );
}

function GorevliKarti({
  gorevli, onDegisti,
}: {
  readonly gorevli: DaireGorevlisi;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('gorevli');
  const tk = useTranslations('kisiBilgileri');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [ayrilisAcik, setAyrilisAcik] = useState(false);
  const [bitis, setBitis] = useState('');
  const [gerekce, setGerekce] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const ayril = async () => {
    if (gerekce.trim().length < 5) {
      bildirim.hata(t('hataGerekce'));
      return;
    }
    setGonderiliyor(true);
    try {
      await servis.daireGorevlisiAyril(gorevli.id, bitis, gerekce.trim());
      bildirim.basari(t('ayrildi'));
      setAyrilisAcik(false);
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('ayrilamadi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <article className="glass p-[var(--cardpad)] flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{gorevli.adSoyad}</h3>
          <p className="text-xs text-[color:var(--muted-2)]">
            {t(`gorev_${gorevli.gorev}`)} · {gorevli.kapiNo}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-[var(--rs)] border"
              style={{
                borderColor: gorevli.durum === 'AKTIF' ? 'var(--ok)' : 'var(--line)',
                color: gorevli.durum === 'AKTIF' ? 'var(--ok)' : 'var(--muted-2)',
              }}>
          {t(`durum_${gorevli.durum}`)}
        </span>
      </div>

      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[color:var(--muted-2)]">{t('isveren')}</dt>
        <dd>
          {t(`isveren_${gorevli.isvereniTipi}`)}
          {gorevli.isverenAdSoyad !== null && ` · ${gorevli.isverenAdSoyad}`}
        </dd>

        <dt className="text-[color:var(--muted-2)]">{t('calismaBaslangic')}</dt>
        <dd className="num">{gorevli.calismaBaslangic}</dd>

        {gorevli.calismaBitis !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('calismaBitis')}</dt>
            <dd className="num">{gorevli.calismaBitis}</dd>
          </>
        )}

        {gorevli.telefon !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{tk('telefon')}</dt>
            <dd className="num">{gorevli.telefon}</dd>
          </>
        )}

        {gorevli.araclari.length > 0 && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('araclari')}</dt>
            <dd className="num">{gorevli.araclari.map((a) => a.plaka).join(', ')}</dd>
          </>
        )}
      </dl>

      {gorevli.aciklama !== null && (
        <p className="text-xs text-[color:var(--muted)]">{gorevli.aciklama}</p>
      )}

      {gorevli.calismaBitis === null && (
        ayrilisAcik ? (
          <div className="flex flex-col gap-2 border-t border-[color:var(--line)] pt-2">
            <p className="text-xs" style={{ color: 'var(--warn)' }}>
              {t('ayrilisAracUyarisi')}
            </p>
            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('ayrilisTarihi')}
              <input type="date" className={ALAN} value={bitis}
                     onChange={(e) => setBitis(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('ayrilisGerekce')}
              <input className={ALAN} value={gerekce}
                     onChange={(e) => setGerekce(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={gonderiliyor || bitis === ''}
                      onClick={() => { void ayril(); }}
                      className="px-3 h-9 text-sm rounded-[var(--rs)] text-white disabled:opacity-60"
                      style={{ backgroundImage: 'var(--grad)' }}>
                {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
              </button>
              <button type="button" onClick={() => setAyrilisAcik(false)}
                      className="px-3 h-9 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
                {tg('iptal')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAyrilisAcik(true)}
                  className="self-start px-3 h-9 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
            {t('ayrilisKaydet')}
          </button>
        )
      )}
    </article>
  );
}

/**
 * Tek ekran hızlı kayıt formu.
 *
 * İlk bölüm KİŞİ BİLGİLERİ (paylaşılan bileşen), ardından göreve özel alanlar.
 * Görevli `Kisi` kaydı KULLANMAZ — hak sahibi değildir — bu yüzden mevcut kişi
 * seçimi sunulmaz; bilgiler doğrudan görevli kaydına yazılır.
 */
function GorevliFormu({
  bolumler, onEklendi, onIptal,
}: {
  readonly bolumler: readonly Bolum[];
  readonly onEklendi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('gorevli');
  const tk = useTranslations('kisiBilgileri');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [kisi, setKisi] = useState<KisiFormDurumu>(bosKisiFormu());
  const [bolumId, setBolumId] = useState('');
  const [isvereniTipi, setIsvereniTipi] = useState<string>('MALIK');
  const [gorev, setGorev] = useState<string>('COCUK_BAKICISI');
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [aciklama, setAciklama] = useState('');

  const [hatalar, setHatalar] = useState<Readonly<Record<string, string>>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [etkinSekme, setEtkinSekme] = useState('kisi');

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();

    const h: Record<string, string> = { ...kisiFormunuDogrula(kisi, tk) };
    if (bolumId === '') h['bolumId'] = t('hataBolum');
    if (baslangic === '') h['baslangic'] = t('hataBaslangic');
    setHatalar(h);
    if (Object.keys(h).length > 0) {
      const hedef = ilkHataliSekme([
        { anahtar: 'kisi', hataSayisi: sekmeHataSayisi(h, KISI_HATA_ANAHTARLARI) },
        { anahtar: 'gorev', hataSayisi: sekmeHataSayisi(h, GOREV_HATA_ANAHTARLARI) },
      ]);
      if (hedef !== null) setEtkinSekme(hedef);
      return;
    }

    // Görevli `Kisi` kullanmaz: kişi alanları doğrudan görevli kaydına gider.
    // `kisiGirdisineCevir` yalnızca boş alanları ayıklamak ve plakayı
    // normalleştirmek için kullanılır.
    const cevrilmis = kisiGirdisineCevir(kisi).kisi;
    if (cevrilmis === undefined) {
      setHatalar({ ad: tk('hataAd') });
      return;
    }

    setGonderiliyor(true);
    try {
      await servis.daireGorevlisiEkle({
        bolumId,
        isvereniTipi,
        gorev,
        calismaBaslangic: baslangic,
        ...(bitis === '' ? {} : { calismaBitis: bitis }),
        ...(aciklama.trim() === '' ? {} : { aciklama: aciklama.trim() }),
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
      // Sunucu iş kuralı ihlali döndürmüş olabilir (aynı TC ile aynı bölümde
      // süren kayıt); mesajı AYNEN gösteririz.
      bildirim.hata(hataMetni(hata, t('eklenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  const sekmeler: readonly SekmeTanimi[] = [
    {
      anahtar: 'kisi',
      etiket: tk('baslik'),
      hataSayisi: sekmeHataSayisi(hatalar, KISI_HATA_ANAHTARLARI),
      icerik: (
        <KisiBilgileriBolumu durum={kisi} setDurum={setKisi} hatalar={hatalar}
                             baslikGoster={false} />
      ),
    },
    {
      anahtar: 'gorev',
      etiket: t('gorevSekmesi'),
      hataSayisi: sekmeHataSayisi(hatalar, GOREV_HATA_ANAHTARLARI),
      icerik: (
        <>
          {/*
            `required` KULLANILMAZ: alan gizli bir sekmedeyken tarayici onu
            odaklayamaz ve gonderimi sessizce durdurur.
          */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('bolum')}
              <select className={ALAN} value={bolumId}
                      onChange={(e) => setBolumId(e.target.value)}
                      aria-invalid={hatalar['bolumId'] !== undefined}>
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
              {t('gorev')}
              <select className={ALAN} value={gorev} onChange={(e) => setGorev(e.target.value)}>
                {DAIRE_GOREVLERI.map((g) => (
                  <option key={g} value={g}>{t(`gorev_${g}`)}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('isverenTipi')}
              <select className={ALAN} value={isvereniTipi}
                      onChange={(e) => setIsvereniTipi(e.target.value)}>
                {ISVEREN_TIPLERI.map((i) => (
                  <option key={i} value={i}>{t(`isveren_${i}`)}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('calismaBaslangic')}
              <input type="date" className={ALAN} value={baslangic}
                     onChange={(e) => setBaslangic(e.target.value)}
                     aria-invalid={hatalar['baslangic'] !== undefined} />
              {hatalar['baslangic'] !== undefined && (
                <span role="alert" style={{ color: 'var(--crit)' }}>{hatalar['baslangic']}</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
              {t('calismaBitis')}
              <input type="date" className={ALAN} value={bitis}
                     onChange={(e) => setBitis(e.target.value)} />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
            {t('aciklamaAlani')}
            <textarea rows={2} value={aciklama}
                      className="px-3 py-2 rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full"
                      onChange={(e) => setAciklama(e.target.value)} />
          </label>

          <p className="text-xs text-[color:var(--muted)]">{t('isverenIpucu')}</p>
          <p className="text-xs text-[color:var(--muted)]">{t('bolumIpucu')}</p>
        </>
      ),
    },
  ];

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">{t('yeniGorevliEkle')}</h2>

      {/* TEK FORM, TEK KAYDET — sekmeler yalnizca gorunumu boler. */}
      <Sekmeler sekmeler={sekmeler} etkinAnahtar={etkinSekme}
                onDegisti={setEtkinSekme} etiket={t('yeniGorevliEkle')} />

      <div className="flex gap-2 border-t border-[color:var(--line)] pt-3">
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
