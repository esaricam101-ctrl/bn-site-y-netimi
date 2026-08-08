'use client';

/**
 * TAHSİLAT — parayı alma ve hangi borca sayıldığını YAZMA.
 *
 * ★ EKRANIN OMURGASI TAHSİSTİR, tutar girişi değil.
 *
 *   TBK m.101: hangi borcun kapatılacağını **borçlu belirler**. Bu yüzden
 *   elle dağıtım ASIL YOLDUR; FIFO önerisi yalnızca bir kolaylıktır ve
 *   dayatılmaz — her satır değiştirilebilir, öneri tek tuşla geri alınır.
 *
 * ⚠️  DENGE KAYDETMEDEN ÖNCE GÖRÜNÜR. Tahsis toplamı tahsilat tutarına eşit
 *     değilse kaydetme kapalıdır ve SEBEBİ yazılıdır. Eksik tahsis, paranın
 *     bir kısmının hiçbir borca sayılmaması demektir: kasada duran ama
 *     defterde olmayan para.
 *
 * ⚠️  AVANS YOKTUR. Borcu aşan ödeme sunucuda reddedilir; ekran bunu
 *     baştan engeller ve ÇIKIŞ YOLUNU söyler (ileri dönem tahakkuku).
 *     Sessizce kırpmak, kullanıcının girdiğinden başka bir tutarı
 *     kaydetmek olurdu.
 *
 * ⚠️  PARA METİN TAŞINIR. Toplama/çıkarma **kuruş tamsayısı** üzerinden
 *     yapılır; `Number` ile toplamak kuruş kaydırır (ADR-0007).
 *
 * ⚠️  MOCK YOKTUR — uydurma borç listesi tahsilat kararına dayanak olur.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import {
  servis, tahsilat as tahsilatServisi,
  type AcikBorcSatiri, type Bolum, type MakbuzSonucu,
} from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const ALAN =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

/**
 * KANALLAR — bu ekranda yalnızca ikisi.
 *
 * ⚠️  ÇEK/SENET BİLİNÇLİ OLARAK YOK: `kiymetliEvrakId` ister ve o kayıt
 *     başka bir ekranda açılır. Seçeneği göstermek, seçildiğinde çıkışsız
 *     bir forma sokardı. BANKA da aynı sınıftadır — banka hareketi
 *     eşleştirmesi bu turun dışında (ürün sahibi kararı), bu yüzden şimdilik
 *     yalnızca NAKİT açık.
 */
const KANALLAR = ['NAKIT'] as const;

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

function sonrakiEylem(h: unknown): string | null {
  if (h instanceof ApiHatasi) {
    const p = h.problem as { sonrakiEylem?: string };
    return p.sonrakiEylem ?? null;
  }
  return null;
}

/**
 * Para metnini KURUŞ TAMSAYISINA çevirir. Geçersizse `null`.
 *
 * ⚠️  `Number()` KULLANILMAZ. Bütün toplamlar `bigint` kuruş üzerinden
 *     yapılır; float aritmetiği 0.1 + 0.2 sınıfı sapma üretir ve denge
 *     göstergesi "eşit ama eşit değil" durumuna düşer.
 */
function kurusa(metin: string): bigint | null {
  const t = metin.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/u.test(t)) return null;
  const [tam, kesir = ''] = t.split('.');
  return BigInt(tam ?? '0') * 100n + BigInt((kesir + '00').slice(0, 2));
}

/** Kuruş tamsayısını iki ondalıklı metne çevirir. */
function kurustan(k: bigint): string {
  const eksi = k < 0n;
  const m = eksi ? -k : k;
  return `${eksi ? '-' : ''}${m / 100n}.${String(m % 100n).padStart(2, '0')}`;
}

/** Sunucunun dört ondalıklı tutarını kuruşa çevirir (kırpar, yuvarlamaz). */
function sunucuKurus(ham: string): bigint {
  return kurusa(Number.parseFloat(ham).toFixed(2)) ?? 0n;
}

/**
 * TÜRKÇE PARA BİÇİMİ — `1.950,00 ₺`.
 *
 * ⚠️  BİÇİMLEME KURUŞ TAMSAYISINDAN yapılır, `Number`'a çevrilerek DEĞİL.
 *     `toLocaleString` bir float alsaydı büyük tutarlarda son kuruş
 *     kayabilirdi; burada tam ve kesir kısımları ayrı ayrı basılır.
 */
function paraTr(kurus: bigint): string {
  const eksi = kurus < 0n;
  const m = eksi ? -kurus : kurus;
  const tam = (m / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, '.');
  return `${eksi ? '-' : ''}${tam},${String(m % 100n).padStart(2, '0')} ₺`;
}

/** `2026-07-31` → `31.07.2026`. Geçersizse ham değer döner. */
function tarihTr(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

/** `2026-07` → `Temmuz 2026`. */
function donemTr(donem: string): string {
  const [y, a] = donem.split('-');
  const ay = AYLAR[Number(a) - 1];
  return ay === undefined ? donem : `${ay} ${y}`;
}

/**
 * Vade üzerinden geçen GÜN sayısı.
 *
 * ⚠️  Bu bir GECİKME SÜRESİDİR, tazminat tutarı değil. Ürün gecikme
 *     tazminatı hesaplamıyor (motor yok); burada yalnızca sürenin kendisi
 *     gösterilir ve "faiz işliyor" imasında BULUNULMAZ.
 */
function gecikmeGunu(vadeIso: string): number {
  const gun = 24 * 60 * 60 * 1000;
  const vade = Date.parse(`${vadeIso}T00:00:00Z`);
  const bugun = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(vade) ? 0 : Math.max(0, Math.floor((bugun - vade) / gun));
}

export default function TahsilatSayfasi() {
  const t = useTranslations('tahsilat');
  const tn = useTranslations('navigasyon');
  const bildirim = useBildirim();

  const [bolumler, setBolumler] = useState<readonly Bolum[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yuklemeHatasi, setYuklemeHatasi] = useState<unknown>(null);

  const [bolumId, setBolumId] = useState('');
  const [borclar, setBorclar] = useState<readonly AcikBorcSatiri[]>([]);
  const [borcYukleniyor, setBorcYukleniyor] = useState(false);

  const [kanal, setKanal] = useState<string>('NAKIT');
  const [tutar, setTutar] = useState('');
  const [tarih, setTarih] = useState(() => new Date().toISOString().slice(0, 10));
  const [aciklama, setAciklama] = useState('');

  /** borcId → girilen tutar METNİ. Kuruşa çevrim tek yerde yapılır. */
  const [tahsisler, setTahsisler] = useState<Record<string, string>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<unknown>(null);
  const [sonuc, setSonuc] = useState<MakbuzSonucu | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setYuklemeHatasi(null);
    servis.bolumler()
      .then((b) => setBolumler(b.kayitlar))
      .catch(setYuklemeHatasi)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  // Daire değişince borçlar yeniden okunur ve tahsis SIFIRLANIR: önceki
  // dairenin borç kimlikleri bu dairede anlamsızdır.
  useEffect(() => {
    if (bolumId === '') { setBorclar([]); setTahsisler({}); return; }
    setBorcYukleniyor(true);
    setTahsisler({});
    setSonuc(null);
    tahsilatServisi.acikBorclar(bolumId)
      .then(setBorclar)
      .catch((h: unknown) => { setBorclar([]); setHata(h); })
      .finally(() => setBorcYukleniyor(false));
  }, [bolumId]);

  const tutarKurus = kurusa(tutar);

  const tahsisToplamKurus = useMemo(
    () => Object.values(tahsisler)
      .reduce<bigint>((a, v) => a + (kurusa(v) ?? 0n), 0n),
    [tahsisler],
  );

  const farkKurus = (tutarKurus ?? 0n) - tahsisToplamKurus;
  const denk = tutarKurus !== null && tutarKurus > 0n && farkKurus === 0n;

  /** Sütun toplamları — hepsi kuruş tamsayısı üzerinden. */
  const toplamTahakkuk = borclar.reduce<bigint>((a, b) => a + sunucuKurus(b.tutar), 0n);
  const toplamOdenen = borclar.reduce<bigint>((a, b) => a + sunucuKurus(b.odenen), 0n);
  const toplamKalan = borclar.reduce<bigint>((a, b) => a + sunucuKurus(b.kalan), 0n);

  /*
   * AVANS ÖN KONTROLÜ — satır bazında. Sunucu da reddeder; buradaki amaç
   * kullanıcının reddedilecek bir formu doldurup göndermesini önlemek.
   */
  const asanSatirlar = borclar.filter((b) => {
    const g = kurusa(tahsisler[b.borcId] ?? '');
    return g !== null && g > sunucuKurus(b.kalan);
  });

  const oneriUygula = async () => {
    if (tutarKurus === null || tutarKurus <= 0n) return;
    setHata(null);
    try {
      const o = await tahsilatServisi.tahsisOnerisi(kurustan(tutarKurus), bolumId);
      const yeni: Record<string, string> = {};
      for (const s of o.tahsisler) yeni[s.borcId] = kurustan(sunucuKurus(s.tutar));
      setTahsisler(yeni);
      if (sunucuKurus(o.kalan) > 0n) {
        // Öneri parayı dağıtamadıysa SÖYLENİR; sessizce eksik doldurmak
        // kullanıcıyı dengesiz bir formla baş başa bırakırdı.
        bildirim.hata(t('oneriKalanVar', { kalan: kurustan(sunucuKurus(o.kalan)) }));
      }
    } catch (h) {
      setHata(h);
    }
  };

  const temizle = () => setTahsisler({});

  const kaydet = async () => {
    setKaydediliyor(true);
    setHata(null);
    try {
      const secilen = borclar
        .filter((b) => (kurusa(tahsisler[b.borcId] ?? '') ?? 0n) > 0n)
        .map((b) => ({
          borcId: b.borcId,
          borcSorumlusuId: b.borcSorumlusuId,
          tutar: kurustan(kurusa(tahsisler[b.borcId] ?? '') ?? 0n),
        }));

      const y = await tahsilatServisi.makbuzKes({
        kanal,
        tutar: kurustan(tutarKurus ?? 0n),
        tahsilatTarihi: tarih,
        ...(aciklama.trim() === '' ? {} : { aciklama: aciklama.trim() }),
        tahsisler: secilen,
      });
      setSonuc(y);
      bildirim.basari(t('makbuzKesildi'));
      // Borçlar yeniden okunur: kalan tutarlar ekranda GÜNCEL kalmalı.
      setTahsisler({});
      setTutar('');
      tahsilatServisi.acikBorclar(bolumId).then(setBorclar).catch(() => { /* liste eski kalır */ });
    } catch (h) {
      setHata(h);
      bildirim.hata(hataMetni(h, t('makbuzKesilemedi')));
    } finally {
      setKaydediliyor(false);
    }
  };

  if (yukleniyor) return <Yukleniyor />;
  if (yuklemeHatasi !== null) return <HataDurumu hata={yuklemeHatasi} tekrarDene={yukle} />;

  /*
   * ★ ENGELLER TEK TEK AYIRT EDİLİR — `kaydedilebilir` bir boolean, ama
   *   kullanıcıya gösterilecek SEBEP tek dallı olamaz.
   *
   * ⚠️  Eskiden mesaj yalnızca "aşan satır mı, değil mi" diye bakıyordu;
   *     tarih boşken **yanlış sebep** (denge mesajı) gösteriyordu. O hata
   *     bugün görünmüyordu çünkü 3. kart tarih boşken de açık kalıyor ama
   *     kullanıcı oraya bakmıyordu. ⛔ "Pratikte görünmüyor" bir savunma
   *     DEĞİLDİR: akış değişince görünür hâle gelir ve kimse fark etmez.
   */
  const engel: string | null = asanSatirlar.length > 0
    ? 'avansYok'
    : tarih === ''
      ? 'tarihGerekli'
      : !denk
        ? 'dengeGerekli'
        : null;

  const kaydedilebilir = engel === null && !kaydediliyor && bolumId !== '';

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[{ etiket: tn('genelBakis'), yol: '/yonetim' }, { etiket: t('baslik') }]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {/* ---------------- 1 · DAİRE ---------------- */}
        <section className="rounded-[var(--rs)] border border-[color:var(--line)] p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t('adimDaire')}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[color:var(--muted-2)]">{t('daire')}</span>
              <select className={ALAN} value={bolumId}
                      onChange={(e) => setBolumId(e.target.value)}>
                <option value="">{t('seciniz')}</option>
                {bolumler.map((b) => (
                  <option key={b.id} value={b.id}>
                    {t('kapiEtiketi', { kapiNo: b.kapiNo })}
                  </option>
                ))}
              </select>
              {/*
                ⚠️  KİŞİ SEÇİMİ YOK ve bu bilinçli: açık borç ve öneri uçları
                    BÖLÜM başınadır. Çok daireli malik akışı N çağrı ister ve
                    ölçülmeden yazılmadı — yol haritasında duruyor.
              */}
              <span className="text-xs text-[color:var(--muted-2)]">{t('daireIpucu')}</span>
            </label>
          </div>
        </section>

        {bolumId !== '' && (
          borcYukleniyor ? <Yukleniyor /> : borclar.length === 0 ? (
            <BosDurum aciklama={t('borcYok')} />
          ) : (
            <>
              {/* ---------------- 2 · TUTAR VE KANAL ---------------- */}
              <section className="rounded-[var(--rs)] border border-[color:var(--line)] p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold">{t('adimTutar')}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[color:var(--muted-2)]">{t('tahsilatTutari')}</span>
                    <input className={`${ALAN} num`} inputMode="decimal" placeholder="1500.00"
                           value={tutar}
                           onChange={(e) => setTutar(e.target.value.replace(',', '.'))} />
                    <span className="text-xs text-[color:var(--muted-2)]">{t('tutarIpucu')}</span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[color:var(--muted-2)]">{t('kanal')}</span>
                    <select className={ALAN} value={kanal}
                            onChange={(e) => setKanal(e.target.value)}>
                      {KANALLAR.map((k) => (
                        <option key={k} value={k}>{t(`kanal_${k}`)}</option>
                      ))}
                    </select>
                    <span className="text-xs text-[color:var(--muted-2)]">{t('kanalIpucu')}</span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[color:var(--muted-2)]">{t('tahsilatTarihi')}</span>
                    <input type="date" className={ALAN} value={tarih}
                           onChange={(e) => setTarih(e.target.value)} />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[color:var(--muted-2)]">{t('aciklamaAlani')}</span>
                    <input className={ALAN} value={aciklama}
                           onChange={(e) => setAciklama(e.target.value)} />
                  </label>
                </div>
              </section>

              {/* ---------------- 3 · TAHSİS ---------------- */}
              <section className="rounded-[var(--rs)] border border-[color:var(--line)] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold">{t('adimTahsis')}</h2>
                  <div className="flex gap-2">
                    <button type="button" disabled={tutarKurus === null || tutarKurus <= 0n}
                            onClick={() => { void oneriUygula(); }}
                            className="px-3 h-[var(--rowh)] rounded-[var(--rs)] text-sm
                                       border border-[color:var(--line)] disabled:opacity-60">
                      {t('oneriGetir')}
                    </button>
                    {/* Tahsis boşken temizlenecek bir şey yok — düğme pasif. */}
                    <button type="button" onClick={temizle}
                            disabled={Object.keys(tahsisler).length === 0}
                            className="px-3 h-[var(--rowh)] rounded-[var(--rs)] text-sm
                                       border border-[color:var(--line)] disabled:opacity-60">
                      {t('tahsisiTemizle')}
                    </button>
                  </div>
                </div>

                {/* ★ ÖNERİ BAĞLAYICI DEĞİL — kullanıcı bunu OKUMALI. */}
                <p className="text-xs text-[color:var(--muted)]">{t('oneriBaglayiciDegil')}</p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-[color:var(--muted-2)]">
                        <th scope="col" className="py-1 pr-3 text-left">{t('kalem')}</th>
                        <th scope="col" className="py-1 pr-3 text-left">{t('donem')}</th>
                        <th scope="col" className="py-1 pr-3 text-left">{t('vade')}</th>
                        {/* ★ PARA SÜTUNLARI SAĞA DAYALI — aksi hâlde 1.650,00 ile
                            219,00 gözle karşılaştırılamaz. */}
                        <th scope="col" className="py-1 pr-3 text-right">{t('tahakkukTutari')}</th>
                        <th scope="col" className="py-1 pr-3 text-right">{t('odenen')}</th>
                        <th scope="col" className="py-1 pr-3 text-right">{t('kalan')}</th>
                        <th scope="col" className="py-1 text-right">{t('tahsisEdilen')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borclar.map((b) => {
                        const girilen = kurusa(tahsisler[b.borcId] ?? '');
                        const kalanKurus = sunucuKurus(b.kalan);
                        const odenenKurus = sunucuKurus(b.odenen);
                        // Kısmi = bir kısmı ödenmiş AMA kapanmamış.
                        const kismiMi = odenenKurus > 0n && kalanKurus > 0n;
                        const asiyor = girilen !== null && girilen > kalanKurus;
                        const gun = b.gecikmisMi ? gecikmeGunu(b.vadeTarihi) : 0;
                        return (
                          <tr key={b.borcId} className="border-t border-[color:var(--line)]">
                            <td className="py-1 pr-3">
                              {t(`kalem_${b.borcKalemi}`, { fallback: b.borcKalemi })}
                            </td>
                            <td className="py-1 pr-3">{donemTr(b.donem)}</td>
                            <td className="py-1 pr-3">
                              <span className="num">{tarihTr(b.vadeTarihi)}</span>
                              {/*
                                ⚠️  VADE GEÇMİŞ — TAZMİNAT DEĞİL. Ürün gecikme
                                    tazminatı hesaplamıyor; burada yalnızca
                                    sürenin kendisi yazar.
                              */}
                              {b.gecikmisMi && (
                                <span className="ml-1 text-xs whitespace-nowrap"
                                      style={{ color: 'var(--warn)' }}>
                                  {t('gecikmeGun', { gun })}
                                </span>
                              )}
                            </td>
                            <td className="py-1 pr-3 num text-right">{paraTr(sunucuKurus(b.tutar))}</td>
                            <td className="py-1 pr-3 num text-right">{paraTr(odenenKurus)}</td>
                            <td className="py-1 pr-3 text-right">
                              {/*
                                ★ KISMİ ÖDEME İŞARETİ. Sayıları karşılaştırmak
                                  zorunda bırakmak, listeye bakan kullanıcının
                                  hangi borcun kısmen ödendiğini GÖRMEMESİ
                                  demekti. FIFO önerisi geldiğinde o satıra ne
                                  kadar yazılacağını anlaması buna bağlı.
                              */}
                              {kismiMi && (
                                <span className="block text-[10px] uppercase tracking-wide"
                                      style={{ color: 'var(--warn)' }}>
                                  {t('kismenOdendi')}
                                </span>
                              )}
                              <span className="num font-semibold">{paraTr(kalanKurus)}</span>
                            </td>
                            <td className="py-1">
                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  className={`${ALAN} num text-right max-w-[8rem]`}
                                  inputMode="decimal"
                                  aria-label={t('tahsisAlaniEtiketi', {
                                    kalem: b.borcKalemi, donem: donemTr(b.donem),
                                  })}
                                  aria-invalid={asiyor}
                                  style={asiyor ? { borderColor: 'var(--danger)' } : undefined}
                                  value={tahsisler[b.borcId] ?? ''}
                                  onChange={(e) => setTahsisler((o) => ({
                                    ...o, [b.borcId]: e.target.value.replace(',', '.'),
                                  }))}
                                />
                                {/*
                                  KISAYOL — 3 satırda gereksiz, 20 satırda ekranı
                                  kullanılabilir kılan şey. Kalanı tek tuşla yazar.
                                */}
                                <button
                                  type="button"
                                  title={t('kalaniYaz')} aria-label={t('kalaniYaz')}
                                  onClick={() => setTahsisler((o) => ({
                                    ...o, [b.borcId]: kurustan(kalanKurus),
                                  }))}
                                  className="px-2 h-[var(--rowh)] rounded-[var(--rs)] text-xs
                                             border border-[color:var(--line)]"
                                >
                                  ⤒
                                </button>
                              </div>
                              {/* Satır bazında AÇIK hata — kırmızı çerçeve tek başına sebebi söylemez. */}
                              {asiyor && (
                                <span className="block text-xs text-right mt-1"
                                      style={{ color: 'var(--danger)' }}>
                                  {t('kalaniAsiyor', { kalan: paraTr(kalanKurus) })}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/*
                      ★ TOPLAM SATIRI — kullanıcı toplam açık borcu görmeden
                        "hepsini kapat" kararını veremez.
                    */}
                    <tfoot>
                      <tr className="border-t-2 border-[color:var(--line)] font-semibold">
                        <td className="py-1 pr-3" colSpan={3}>{t('toplam')}</td>
                        <td className="py-1 pr-3 num text-right">{paraTr(toplamTahakkuk)}</td>
                        <td className="py-1 pr-3 num text-right">{paraTr(toplamOdenen)}</td>
                        <td className="py-1 pr-3 num text-right">{paraTr(toplamKalan)}</td>
                        <td className="py-1 num text-right">{paraTr(tahsisToplamKurus)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* ★ DENGE — kaydetmeden ÖNCE görünür. */}
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <Kutu etiket={t('tahsilatTutari')}
                        deger={tutarKurus === null ? '—' : paraTr(tutarKurus)} />
                  <Kutu etiket={t('tahsisToplami')} deger={paraTr(tahsisToplamKurus)} />
                  {/*
                    ⚠️  TUTAR GİRİLMEMİŞSE FARK "—" GÖSTERİLİR, "0,00" DEĞİL.
                        Tanımsız girdiyi sıfıra çevirmek, kullanıcıya "fark yok"
                        derken düğmeyi kapalı tutmak demekti: ekran kendi
                        kendisiyle çelişiyordu.
                  */}
                  <Kutu
                    etiket={t('fark')}
                    deger={tutarKurus === null
                      ? '—'
                      : `${farkKurus > 0n ? t('farkEksikKisa') : farkKurus < 0n ? t('farkFazlaKisa') : ''} ${paraTr(farkKurus < 0n ? -farkKurus : farkKurus)}`.trim()}
                    vurgu={tutarKurus !== null && farkKurus !== 0n}
                  />
                </div>

                {tutarKurus !== null && farkKurus !== 0n && (
                  <div role="alert" className="rounded-[var(--rs)] border p-3 text-sm"
                       style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
                    {farkKurus > 0n ? t('farkEksik') : t('farkFazla')}
                  </div>
                )}

                {asanSatirlar.length > 0 && (
                  <div role="alert" className="rounded-[var(--rs)] border p-3 flex flex-col gap-1 text-sm"
                       style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                    <strong>{t('avansYok')}</strong>
                    <span className="text-xs">{t('avansCikisYolu')}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {/*
                    ⚠️  DÜĞME ADI İŞİ ANLATIR: yapılan iş TAHSİLAT KAYDIDIR.
                        Makbuz o kaydın ÇIKTISIDIR ve numarası kayıttan sonra
                        sunucuda üretilir. "Makbuzu kes" yazsaydı, yazıcı ya da
                        PDF sorunu mali kaydı da engelliyormuş gibi görünürdü.

                    `aria-describedby` — düğmenin NEDEN pasif olduğu ekran
                    okuyucuya da iletilir; görsel uyarı tek başına yetmez.
                  */}
                  <button type="button" disabled={!kaydedilebilir}
                          aria-describedby={kaydedilebilir ? undefined : 'tahsilat-engel'}
                          onClick={() => { void kaydet(); }}
                          className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white disabled:opacity-60"
                          style={{ backgroundImage: 'var(--grad)' }}>
                    {kaydediliyor ? t('kaydediliyor') : t('tahsilatiKaydet')}
                  </button>
                  {engel !== null && (
                    <span id="tahsilat-engel" className="text-xs" style={{ color: 'var(--warn)' }}>
                      {t(engel)}
                    </span>
                  )}
                </div>
              </section>
            </>
          )
        )}

        {hata !== null && (
          <div role="alert" className="rounded-[var(--rs)] border p-4 flex flex-col gap-2"
               style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            <strong className="text-sm">{t('islemReddedildi')}</strong>
            <p className="text-sm">{hataMetni(hata, t('bilinmeyenHata'))}</p>
            {/* ÇIKIŞ YOLU sunucudan gelir, uydurulmaz. */}
            {sonrakiEylem(hata) !== null && (
              <p className="text-xs">{sonrakiEylem(hata)}</p>
            )}
          </div>
        )}

        {sonuc !== null && (
          <section role="status" className="rounded-[var(--rs)] border p-4 flex flex-col gap-2"
                   style={{ borderColor: 'var(--ok, var(--line))' }}>
            <h2 className="text-sm font-semibold">{t('adimSonuc')}</h2>
            <p className="text-sm">{t('makbuzNumarasi', { numara: sonuc.makbuzNo })}</p>
          </section>
        )}
      </div>
    </UygulamaKabugu>
  );
}

function Kutu({
  etiket, deger, vurgu = false,
}: {
  readonly etiket: string; readonly deger: string; readonly vurgu?: boolean;
}) {
  return (
    <div className="rounded-[var(--rs)] border p-2 flex flex-col"
         style={{ borderColor: vurgu ? 'var(--warn)' : 'var(--line)' }}>
      <span className="text-xs text-[color:var(--muted-2)]">{etiket}</span>
      <span className="num font-semibold" style={vurgu ? { color: 'var(--warn)' } : undefined}>
        {deger}
      </span>
    </div>
  );
}
