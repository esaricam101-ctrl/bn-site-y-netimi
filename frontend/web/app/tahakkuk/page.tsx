'use client';

/**
 * TAHAKKUK ÇALIŞTIRMA — gideri bölümlere paylaştırıp borç yazma.
 *
 * ★ EKRANIN OMURGASI ÖNİZLEMEDİR, form değil.
 *
 *   Mali kayıt geri alınamaz; düzeltmesi ters kayıttır. Yöneticinin yanlış
 *   tutarı ya da yanlış dağıtımı fark edebileceği TEK AN önizlemedir. Bu
 *   yüzden "Tahakkuku yaz" düğmesi form doldurulunca DEĞİL, yalnızca
 *   geçerli bir önizlemeden sonra etkinleşir.
 *
 *   Önizleme gerçek çalıştırmayla AYNI doğrulamalardan geçer (mükerrer
 *   dahil); yalnızca yazma atlanır. Bu bir vaat değil, ölçülmüş davranıştır:
 *   CT-16 (2b) aynı isteğin önizlemede de 409 döndüğünü sınar. Önce böyle
 *   DEĞİLDİ — önizleme 201, gerçek çalıştırma 409 dönüyordu ve yönetici
 *   temiz bir önizleme görüp onaylıyordu.
 *
 * ⚠️  BAYAT ÖNİZLEME KABUL EDİLMEZ. Önizlemeden sonra formda herhangi bir
 *     alan değişirse önizleme DÜŞER ve yazma düğmesi yeniden kilitlenir.
 *     Aksi hâlde kullanıcı 12.000 TL'yi önizleyip tutarı 21.000 yapar ve
 *     gördüğünden başka bir şeyi yazar.
 *
 * ⚠️  MOCK YOKTUR (muhasebe modülüyle aynı gerekçe): uydurma bir dağıtım
 *     tablosu gerçek sanılır ve mali karar dayanağı olarak kullanılabilir.
 *
 * ⚠️  PARA METİN OLARAK TAŞINIR ve gösterilir. `Number`'a çevirmek kuruş
 *     toplamını sessizce kaydırır (ADR-0007).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import {
  servis, tahakkuk as tahakkukServisi,
  type Blok, type GiderTuru, type TahakkukDonemOzeti, type TahakkukSonucu,
} from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const ALAN =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

/**
 * EZİLEBİLİR KURALLAR — ek veri gerektirmeyenler (ADR-0017 · K7b).
 *
 * ⚠️  Ölçüt "ek veri var mı" DEĞİL, "ek veri BÖLÜM BAŞINA mı". `BLOK_BAZLI`
 *     listede olmasının sebebi budur: gerektirdiği veri tek bir alandır
 *     (hedef blok) ve bu ekranda sorulur.
 *
 * ⚠️  BU LİSTE BİR KOLAYLIKTIR, KORUMA DEĞİL. Asıl kapı sunucudadır ve
 *     veri gerektiren bir kurala ezme denenirse 422 ile EKSİK BÖLÜMLERİ
 *     SAYARAK reddeder. Listeyi burada tutmak, kullanıcıya baştan
 *     seçilemeyecek bir seçenek göstermemek içindir.
 */
const EZILEBILIR_KURALLAR = [
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'BLOK_BAZLI',
] as const;

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

/** Hata gövdesindeki çıkış yolu — varsa gösterilir, uydurulmaz. */
function sonrakiEylem(h: unknown): string | null {
  if (h instanceof ApiHatasi) {
    const p = h.problem as { sonrakiEylem?: string };
    return p.sonrakiEylem ?? null;
  }
  return null;
}

/** Ayın ilk günü — tahakkuk dönemi ayın başına sabitlenir. */
function ayinIlkGunu(ay: string): string {
  return `${ay}-01`;
}

/** Ayın son günü — vade için makul varsayılan. Kullanıcı değiştirebilir. */
function ayinSonGunu(ay: string): string {
  const [y, a] = ay.split('-').map(Number);
  // Ay 1-tabanlı verilir; `0` gün bir önceki ayın sonudur.
  return new Date(Date.UTC(y ?? 2026, a ?? 1, 0)).toISOString().slice(0, 10);
}

/**
 * Dört ondalıklı sunucu tutarını iki ondalığa indirir — GÖSTERİM İÇİN.
 *
 * ⚠️  METİN İŞLEMİ, aritmetik değil. `Number()` ile yuvarlamak kuruş
 *     toplamını kaydırır; burada yalnızca son iki hane kırpılır.
 */
function tutarGoster(ham: string): string {
  const [tam, kesir = ''] = ham.split('.');
  return `${tam}.${(kesir + '00').slice(0, 2)}`;
}

export default function TahakkukSayfasi() {
  const t = useTranslations('tahakkuk');
  const tn = useTranslations('navigasyon');
  const bildirim = useBildirim();

  const [turler, setTurler] = useState<readonly GiderTuru[]>([]);
  const [bloklar, setBloklar] = useState<readonly Blok[]>([]);
  const [gecmis, setGecmis] = useState<readonly TahakkukDonemOzeti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yuklemeHatasi, setYuklemeHatasi] = useState<unknown>(null);

  // --- Form ---
  const [giderTuruKodu, setGiderTuruKodu] = useState('');
  const [ay, setAy] = useState('');
  const [vadeTarihi, setVadeTarihi] = useState('');
  const [toplamTutar, setToplamTutar] = useState('');
  const [kuralEzme, setKuralEzme] = useState('');
  const [hedefBlokId, setHedefBlokId] = useState('');
  const [referans, setReferans] = useState('');
  const [ekTahakkuk, setEkTahakkuk] = useState(false);

  // --- Önizleme / sonuç ---
  const [onizleme, setOnizleme] = useState<TahakkukSonucu | null>(null);
  const [onizlemeHatasi, setOnizlemeHatasi] = useState<unknown>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<TahakkukSonucu | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setYuklemeHatasi(null);
    Promise.all([
      servis.giderTurleri(true),
      servis.bloklar(),
      tahakkukServisi.donemler(),
    ])
      .then(([gt, bl, dn]) => {
        setTurler(gt);
        setBloklar(bl);
        setGecmis(dn);
      })
      .catch(setYuklemeHatasi)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  const secilenTur = turler.find((g) => g.kod === giderTuruKodu) ?? null;
  const olayBazli = secilenTur?.tahakkukSikligi === 'OLAY_BAZLI';
  const etkinKural = kuralEzme === '' ? (secilenTur?.paylasimKurali ?? '') : kuralEzme;
  const blokGerekli = etkinKural === 'BLOK_BAZLI';

  /**
   * İSTEK GÖVDESİ — önizleme ile yazma AYNI gövdeyi kullanır.
   *
   * ★ İkisinin ayrı kurulması, önizlenen ile yazılanın ayrışmasına açık
   *   kapı bırakırdı. Tek kaynak: aşağıdaki `imza` da bundan türetilir.
   */
  const govde = useMemo(() => ({
    giderTuruKodu,
    toplamTutar,
    donem: ay === '' ? '' : ayinIlkGunu(ay),
    vadeTarihi,
    ...(kuralEzme === '' ? {} : { paylasimKurali: kuralEzme }),
    ...(blokGerekli && hedefBlokId !== '' ? { hedefBlokId } : {}),
    ...(olayBazli && referans.trim() !== '' ? { referans: referans.trim() } : {}),
    ...(ekTahakkuk ? { ekTahakkuk: true } : {}),
  }), [giderTuruKodu, toplamTutar, ay, vadeTarihi, kuralEzme, blokGerekli,
    hedefBlokId, olayBazli, referans, ekTahakkuk]);

  /*
   * BAYAT ÖNİZLEME KORUMASI. Önizleme alındığı andaki gövdenin imzası
   * saklanır; form değişirse imza tutmaz ve yazma düğmesi kilitlenir.
   */
  const imza = JSON.stringify(govde);
  const [onizlemeImzasi, setOnizlemeImzasi] = useState('');
  const onizlemeGecerli = onizleme !== null && onizlemeImzasi === imza;

  /*
   * MÜKERRER UYARISI — İSTEMCİ TARAFI, KORUMA DEĞİL.
   *
   * ⚠️  Asıl kapı sunucudadır (409) ve önizlemede de çalışır. Buradaki
   *     uyarı yalnızca kullanıcının isteği göndermeden önce görmesi
   *     içindir. Bu satır kaldırılsa hiçbir mükerrer kayıt oluşmaz.
   */
  const mukerrerUyarisi = giderTuruKodu !== '' && ay !== ''
    && gecmis.some((d) => d.giderTuruKodu === giderTuruKodu
      && d.donem.slice(0, 7) === ay);

  const formTamam = giderTuruKodu !== '' && ay !== '' && vadeTarihi !== ''
    && /^\d+(\.\d{1,2})?$/u.test(toplamTutar)
    && (!blokGerekli || hedefBlokId !== '');

  const turDegisti = (kod: string) => {
    setGiderTuruKodu(kod);
    // Ezme SIFIRLANIR: önceki türün kuralı yeni türde anlamsız olabilir.
    setKuralEzme('');
    setHedefBlokId('');
    setReferans('');
    setOnizleme(null);
    setSonuc(null);
  };

  const ayDegisti = (yeni: string) => {
    setAy(yeni);
    // Vade YALNIZCA boşsa doldurulur: kullanıcının girdiği vade ezilmez.
    if (yeni !== '' && vadeTarihi === '') setVadeTarihi(ayinSonGunu(yeni));
  };

  const onizlemeAl = async () => {
    setCalisiyor(true);
    setOnizlemeHatasi(null);
    setSonuc(null);
    try {
      const s = await tahakkukServisi.onizle(govde);
      setOnizleme(s);
      setOnizlemeImzasi(imza);
    } catch (h) {
      setOnizleme(null);
      setOnizlemeImzasi('');
      setOnizlemeHatasi(h);
    } finally {
      setCalisiyor(false);
    }
  };

  const yaz = async () => {
    setCalisiyor(true);
    try {
      const s = await tahakkukServisi.calistir(govde);
      setSonuc(s);
      setOnizleme(null);
      setOnizlemeImzasi('');
      bildirim.basari(t('tahakkukYazildi', { adet: s.bolumSayisi }));
      // Geçmiş yenilenir: mükerrer uyarısı bir sonraki denemede doğru olsun.
      tahakkukServisi.donemler().then(setGecmis).catch(() => { /* uyarı bilgisi */ });
    } catch (h) {
      bildirim.hata(hataMetni(h, t('tahakkukYazilamadi')));
      setOnizlemeHatasi(h);
    } finally {
      setCalisiyor(false);
    }
  };

  if (yukleniyor) return <Yukleniyor />;
  if (yuklemeHatasi !== null) {
    return <HataDurumu hata={yuklemeHatasi} tekrarDene={yukle} />;
  }

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: t('baslik') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {/*
          GİDER TÜRÜ HİÇ YOKSA form gösterilmez: boş bir açılır kutu
          kullanıcıya "seçim yapmadın" der, oysa seçecek bir şey yoktur.
        */}
        {turler.length === 0 ? (
          <div role="status" className="rounded-[var(--rs)] border p-4 flex flex-col gap-2"
               style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
            <strong className="text-sm">{t('giderTuruYokBaslik')}</strong>
            <p className="text-xs">{t('giderTuruYokAciklama')}</p>
          </div>
        ) : (
          <>
            {/* ---------------- 1-3 · FORM ---------------- */}
            <section className="rounded-[var(--rs)] border border-[color:var(--line)] p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold">{t('adimGirdi')}</h2>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--muted-2)]">{t('giderTuru')}</span>
                  <select className={ALAN} value={giderTuruKodu}
                          onChange={(e) => turDegisti(e.target.value)}>
                    <option value="">{t('seciniz')}</option>
                    {/*
                      ⚠️  KURAL ADI ETİKETE YAZILMAZ. Bir zamanlar
                          "Kapıcı gideri · Eşit" yazıyordu; kural HEMEN
                          YANDAKİ seçim kutusunda zaten duruyor ve orada
                          DEĞİŞTİRİLEBİLİR. İki yerde göstermek, ezme
                          yapıldığında ikisinin çelişmesine yol açardı:
                          etiket "Eşit" derken kural "Arsa payı" olurdu.
                    */}
                    {turler.map((g) => (
                      <option key={g.id} value={g.kod}>{g.ad}</option>
                    ))}
                  </select>
                  {secilenTur !== null && (
                    <span className="text-xs text-[color:var(--muted-2)]">
                      {t(`siklik_${secilenTur.tahakkukSikligi}`)}
                    </span>
                  )}
                </label>

                {/*
                  ★ DAĞITIM KURALI GİDER TÜRÜNÜN HEMEN YANINDA.
                    İkisi tek bir karardır: "hangi gider, nasıl paylaşılacak".
                    Kural formun altında dururken yönetici türü seçip geçiyor
                    ve ezme seçeneğini hiç görmüyordu — oysa KMK m.20 uyarınca
                    o seçim onun hakkı.
                */}
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--muted-2)]">{t('dagitimKurali')}</span>
                  <select className={ALAN} value={kuralEzme} disabled={secilenTur === null}
                          onChange={(e) => { setKuralEzme(e.target.value); setOnizleme(null); }}>
                    <option value="">
                      {secilenTur === null
                        ? t('onceTurSecin')
                        : t('varsayilanKural', { kural: t(`kural_${secilenTur.paylasimKurali}`) })}
                    </option>
                    {EZILEBILIR_KURALLAR
                      .filter((k) => k !== secilenTur?.paylasimKurali)
                      .map((k) => <option key={k} value={k}>{t(`kural_${k}`)}</option>)}
                  </select>
                  <span className="text-xs text-[color:var(--muted-2)]">{t('ezmeIpucu')}</span>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--muted-2)]">{t('donem')}</span>
                  <input type="month" className={ALAN} value={ay}
                         onChange={(e) => ayDegisti(e.target.value)} />
                  <span className="text-xs text-[color:var(--muted-2)]">{t('donemIpucu')}</span>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--muted-2)]">{t('toplamTutar')}</span>
                  <input
                    className={`${ALAN} num`} inputMode="decimal" placeholder="18500.00"
                    value={toplamTutar}
                    onChange={(e) => setToplamTutar(e.target.value.replace(',', '.'))}
                  />
                  <span className="text-xs text-[color:var(--muted-2)]">{t('tutarIpucu')}</span>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--muted-2)]">{t('vadeTarihi')}</span>
                  <input type="date" className={ALAN} value={vadeTarihi}
                         onChange={(e) => setVadeTarihi(e.target.value)} />
                </label>

                {blokGerekli && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[color:var(--muted-2)]">{t('hedefBlok')}</span>
                    <select className={ALAN} value={hedefBlokId}
                            onChange={(e) => { setHedefBlokId(e.target.value); setOnizleme(null); }}>
                      <option value="">{t('seciniz')}</option>
                      {bloklar.map((b) => <option key={b.id} value={b.id}>{b.ad}</option>)}
                    </select>
                    <span className="text-xs text-[color:var(--muted-2)]">{t('hedefBlokIpucu')}</span>
                  </label>
                )}

                {/*
                  REFERANS yalnızca OLAY BAZLI türde sorulur. Dönemsel türde
                  sunucu bu alanı KABUL ETMEZ; her zaman göstermek kullanıcıyı
                  reddedilecek bir alanı doldurmaya davet ederdi.
                */}
                {olayBazli && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[color:var(--muted-2)]">{t('referans')}</span>
                    <input className={ALAN} placeholder="FTR-2026-0001" value={referans}
                           onChange={(e) => setReferans(e.target.value)} />
                    <span className="text-xs text-[color:var(--muted-2)]">{t('referansIpucu')}</span>
                  </label>
                )}
              </div>

              {/* MÜKERRER — engellemez, uyarır. Asıl kapı sunucuda. */}
              {mukerrerUyarisi && (
                <div role="alert" className="rounded-[var(--rs)] border p-3 flex flex-col gap-2 text-xs"
                     style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
                  <strong>{t('mukerrerBaslik')}</strong>
                  <span>{t('mukerrerAciklama')}</span>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={ekTahakkuk}
                           onChange={(e) => { setEkTahakkuk(e.target.checked); setOnizleme(null); }} />
                    {t('ekTahakkukEtiketi')}
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button" disabled={!formTamam || calisiyor}
                  onClick={() => { void onizlemeAl(); }}
                  className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white disabled:opacity-60"
                  style={{ backgroundImage: 'var(--grad)' }}
                >
                  {calisiyor ? t('hesaplaniyor') : t('onizle')}
                </button>
                <span className="text-xs text-[color:var(--muted-2)]">{t('onizlemeZorunlu')}</span>
              </div>
            </section>

            {/* ---------------- HATA ---------------- */}
            {onizlemeHatasi !== null && (
              <div role="alert" className="rounded-[var(--rs)] border p-4 flex flex-col gap-2"
                   style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                <strong className="text-sm">{t('onizlemeReddedildi')}</strong>
                <p className="text-sm">{hataMetni(onizlemeHatasi, t('bilinmeyenHata'))}</p>
                {/*
                  ÇIKIŞ YOLU sunucudan gelir, UYDURULMAZ. Eksik veriyi
                  hangi bölümlerde aramak gerektiğini sunucu sayarak söyler.
                */}
                {sonrakiEylem(onizlemeHatasi) !== null && (
                  <p className="text-xs">{sonrakiEylem(onizlemeHatasi)}</p>
                )}
              </div>
            )}

            {/* ---------------- 4 · ÖNİZLEME ---------------- */}
            {onizleme !== null && (
              <OnizlemePaneli
                sonuc={onizleme} gecerli={onizlemeGecerli} calisiyor={calisiyor}
                onYaz={() => { void yaz(); }}
              />
            )}

            {/* ---------------- 6 · SONUÇ ---------------- */}
            {sonuc !== null && <SonucPaneli sonuc={sonuc} />}
          </>
        )}
      </div>
    </UygulamaKabugu>
  );
}

/* ------------------------------ Önizleme ---------------------------------- */

function OnizlemePaneli({
  sonuc, gecerli, calisiyor, onYaz,
}: {
  readonly sonuc: TahakkukSonucu;
  readonly gecerli: boolean;
  readonly calisiyor: boolean;
  readonly onYaz: () => void;
}) {
  const t = useTranslations('tahakkuk');

  /*
   * DENGE — metin karşılaştırması, aritmetik DEĞİL. Sunucu ikisini de
   * dört ondalıklı metin döndürür; eşitlik doğrudan sınanır.
   */
  const denk = sonuc.toplamTutar === sonuc.dagitilanToplam;

  return (
    <section className="rounded-[var(--rs)] border p-4 flex flex-col gap-3"
             style={{ borderColor: 'var(--accent, var(--line))' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold">{t('adimOnizleme')}</h2>
        <span className="text-xs px-2 py-1 rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('yazilmadi')}
        </span>
      </div>

      <p className="text-xs text-[color:var(--muted)]">{t('onizlemeAciklama')}</p>

      {/* DENGE GÖSTERGESİ — kaydetmeden ÖNCE görünür. */}
      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <Kutu etiket={t('girilenTutar')} deger={tutarGoster(sonuc.toplamTutar)} />
        <Kutu etiket={t('dagitilanToplam')} deger={tutarGoster(sonuc.dagitilanToplam)} />
        <Kutu
          etiket={t('bolumSayisi')} deger={String(sonuc.bolumSayisi)}
        />
      </div>

      {!denk && (
        <div role="alert" className="rounded-[var(--rs)] border p-3 text-sm"
             style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          {t('dengesiz')}
        </div>
      )}

      {/* UYARILAR — işlem engellenmez, görünürlük sağlanır. */}
      {sonuc.uyarilar.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sonuc.uyarilar.map((u) => (
            <li key={u.kod} role="status"
                className="rounded-[var(--rs)] border p-2 text-xs"
                style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
              <strong>{u.kod}</strong> — {u.mesaj}
            </li>
          ))}
        </ul>
      )}

      {/* DAİRE DAİRE DAĞITIM */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[color:var(--muted-2)]">
              <th className="py-1 pr-3">{t('kapiNo')}</th>
              <th className="py-1 pr-3">{t('tutar')}</th>
              <th className="py-1">{t('sorumlular')}</th>
            </tr>
          </thead>
          <tbody>
            {sonuc.satirlar.map((s) => (
              <tr key={s.bolumId} className="border-t border-[color:var(--line)]">
                <td className="py-1 pr-3 num">{s.kapiNo}</td>
                <td className="py-1 pr-3 num">{tutarGoster(s.tutar)}</td>
                <td className="py-1 text-xs">
                  {s.sorumlular.map((k) => (
                    <span key={`${k.kisiId}-${k.sira}`} className="mr-2">
                      {k.kisiAdi}
                      <span className="text-[color:var(--muted-2)]">
                        {' '}({t(`rol_${k.rol}`)} · {t(`sira_${k.sira}`)} · {tutarGoster(k.pay)})
                      </span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------- 5 · ONAY ---------------- */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button" disabled={!gecerli || !denk || calisiyor} onClick={onYaz}
          className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white disabled:opacity-60"
          style={{ backgroundImage: 'var(--grad)' }}
        >
          {calisiyor ? t('yaziliyor') : t('tahakkukuYaz')}
        </button>
        {/*
          BAYAT ÖNİZLEME — düğme neden kapalı, AÇIKÇA yazar. Gri bir düğme
          kullanıcıya sebebini anlatmaz.
        */}
        {!gecerli && (
          <span className="text-xs" style={{ color: 'var(--warn)' }}>{t('onizlemeBayat')}</span>
        )}
        <span className="text-xs text-[color:var(--muted-2)]">{t('geriAlinamaz')}</span>
      </div>
    </section>
  );
}

function Kutu({ etiket, deger }: { readonly etiket: string; readonly deger: string }) {
  return (
    <div className="rounded-[var(--rs)] border border-[color:var(--line)] p-2 flex flex-col">
      <span className="text-xs text-[color:var(--muted-2)]">{etiket}</span>
      <span className="num font-semibold">{deger}</span>
    </div>
  );
}

/* -------------------------------- Sonuç ----------------------------------- */

function SonucPaneli({ sonuc }: { readonly sonuc: TahakkukSonucu }) {
  const t = useTranslations('tahakkuk');
  return (
    <section role="status" className="rounded-[var(--rs)] border p-4 flex flex-col gap-3"
             style={{ borderColor: 'var(--ok, var(--line))' }}>
      <h2 className="text-sm font-semibold">{t('adimSonuc')}</h2>
      <p className="text-sm">
        {t('sonucOzeti', {
          adet: sonuc.bolumSayisi,
          tutar: tutarGoster(sonuc.dagitilanToplam),
          donem: sonuc.donem,
        })}
      </p>
      {/*
        TAHAKKUK NUMARALARI GÖSTERİLİR: yazma anında tahsis edilirler ve
        makbuz/ekstre eşleştirmesinde aranacak olan anahtar budur.
      */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[color:var(--muted-2)]">
              <th className="py-1 pr-3">{t('kapiNo')}</th>
              <th className="py-1 pr-3">{t('tahakkukNo')}</th>
              <th className="py-1">{t('tutar')}</th>
            </tr>
          </thead>
          <tbody>
            {sonuc.satirlar.map((s) => (
              <tr key={s.bolumId} className="border-t border-[color:var(--line)]">
                <td className="py-1 pr-3 num">{s.kapiNo}</td>
                <td className="py-1 pr-3 num">{s.tahakkukNo ?? '—'}</td>
                <td className="py-1 num">{tutarGoster(s.tutar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
