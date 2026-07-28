/**
 * Gider paylastirma — ADR v1.1 §4 · Eksen 1
 *
 * Dagitim @bnos/kernel'in dagit() fonksiyonu uzerinden yapilir; yuvarlama
 * farki kaybolmaz ve paylarin toplami daima giderin tamamina esittir.
 */
import { dagit, topla, sifir, apiBicimi, type Money } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';
import type { BagimsizBolum } from '../bolum/bagimsiz-bolum.js';
import { giderTuruDogrula } from './gider-turu.js';
import type { GiderTuru, KarmaBilesen, PaylasimKurali } from './gider-turu.js';

export interface PaylasimGirdisi {
  readonly bolum: BagimsizBolum;
  /** TUKETIM kurali icin olcum degeri (m3, kWh, kalori). */
  readonly tuketim?: bigint;
  /** SABIT_TUTAR kurali icin bolume ozel sabit agirlik. */
  readonly sabitAgirlik?: bigint;
  /**
   * KULLANIM_BAZLI kurali icin: bolum bu hizmeti kullaniyor mu?
   * Otopark, havuz, jeneratör gibi giderlerde yalnizca kullananlar oder —
   * yonetim plani boyle ongorduyse (KMK md. 20 istisnasi).
   */
  readonly kullaniyorMu?: boolean;
  /** BLOK_BAZLI kurali icin bolumun blogu. */
  readonly blokId?: string | null;
  /** MANUEL kurali icin yoneticinin bolume yazdigi tutar. */
  readonly manuelTutar?: Money;
}

/** Kural bazli ek parametreler. Tahakkuk aninda verilir, gider turunde degil. */
export interface PaylasimSecenekleri {
  /**
   * BLOK_BAZLI kurali icin hedef blok. Gider bu bloga aittir; diger bloklarin
   * bolumleri odemez. Ayni asansor onarimi ertesi ay baska blokta olabilir,
   * bu yuzden GiderTuru'nde degil tahakkuk aninda verilir.
   */
  readonly hedefBlokId?: string;
}

export interface PaylasimSatiri {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly tutar: Money;
  /**
   * Dagitimda kullanilan agirlik. KARMA modelde `null`'dir: pay birden cok
   * kuralin toplamidir ve tek bir agirlikla ifade edilemez.
   */
  readonly agirlik: bigint | null;
}

function agirlikCoz(
  kural: Exclude<PaylasimKurali, 'KARMA' | 'MANUEL'>,
  g: PaylasimGirdisi,
  secenekler: PaylasimSecenekleri,
): bigint {
  switch (kural) {
    case 'ESIT':
      return 1n;
    // KULLANIM_BAZLI ve BLOK_BAZLI birer KAPSAM kuralidir: kapsam disindaki
    // bolum sifir agirlik alir ve payi sifir olur. Kapsam ici bolumler esit
    // paylasir. `dagit()` sifir agirlikli satira sifir verir.
    case 'KULLANIM_BAZLI':
      if (g.kullaniyorMu === undefined) {
        throw new DogrulamaHatasi(
          `KULLANIM_BAZLI paylasim icin '${g.bolum.kapiNo}' bolumunun kullanim bilgisi girilmemis.`,
          'Hizmeti kullanan bolumleri isaretleyin.',
        );
      }
      return g.kullaniyorMu ? 1n : 0n;
    case 'BLOK_BAZLI':
      if (secenekler.hedefBlokId === undefined) {
        throw new DogrulamaHatasi(
          'BLOK_BAZLI paylasim icin hedef blok belirtilmemis.',
          'Giderin hangi bloga ait oldugunu secin.',
        );
      }
      return g.blokId === secenekler.hedefBlokId ? 1n : 0n;
    case 'ARSA_PAYI':
      return g.bolum.arsaPayiAgirligi();
    // METREKARE tarihsel addir ve BRUT_M2 ile ayni davranir (bkz. gider-turu.ts).
    case 'METREKARE':
    case 'BRUT_M2':
      return g.bolum.metrekareAgirligi();
    case 'NET_M2':
      return g.bolum.netMetrekareAgirligi();
    case 'TUKETIM':
      if (g.tuketim === undefined) {
        throw new DogrulamaHatasi(
          `TUKETIM paylasimi icin '${g.bolum.kapiNo}' bolumunun olcum degeri girilmemis.`,
          'Eksik sayac okumalarini tamamlayin.',
        );
      }
      return g.tuketim;
    case 'SABIT_TUTAR':
      if (g.sabitAgirlik === undefined) {
        throw new DogrulamaHatasi(
          `SABIT_TUTAR paylasimi icin '${g.bolum.kapiNo}' bolumunun tutari girilmemis.`,
        );
      }
      return g.sabitAgirlik;
  }
}

/** Kurala gore sifir toplam durumunda ne yapilmasi gerektigini anlatir. */
function sifirAgirlikOnerisi(kural: Exclude<PaylasimKurali, 'KARMA' | 'MANUEL'>): string {
  switch (kural) {
    case 'TUKETIM':
      return 'Sayac okumalarinin girildiginden emin olun.';
    case 'KULLANIM_BAZLI':
      return 'Hicbir bolum bu hizmeti kullanmiyor olarak isaretli; kullanim listesini kontrol edin.';
    case 'BLOK_BAZLI':
      return 'Secilen blokta bolum yok; hedef blogu kontrol edin.';
    default:
      return 'Paylasim kuralini gozden gecirin.';
  }
}

/** Tek bir kural icin agirliklari cozer ve sifir toplamini reddeder. */
function agirliklariCoz(
  kural: Exclude<PaylasimKurali, 'KARMA' | 'MANUEL'>,
  giderKodu: string,
  dahil: readonly PaylasimGirdisi[],
  secenekler: PaylasimSecenekleri,
): readonly bigint[] {
  const agirliklar = dahil.map((g) => agirlikCoz(kural, g, secenekler));
  if (agirliklar.every((a) => a === 0n)) {
    throw new DogrulamaHatasi(
      `'${giderKodu}' icin tum agirliklar sifir. ${kural} kurali uygulanamaz.`,
      sifirAgirlikOnerisi(kural),
    );
  }
  return agirliklar;
}

/**
 * MANUEL dagitim: yonetici tutarlari bolum bolum belirler.
 *
 * Dagitim YAPILMAZ, dogrulama yapilir: verilen tutarlarin toplami giderin
 * tamamina esit olmalidir. Esit degilse fark sessizce kaybolur ya da fazla
 * tahakkuk edilir — ikisi de mizani bozar.
 */
function manuelDagit(
  giderKodu: string,
  toplam: Money,
  dahil: readonly PaylasimGirdisi[],
): readonly Money[] {
  const eksik = dahil.filter((g) => g.manuelTutar === undefined);
  if (eksik.length > 0) {
    throw new DogrulamaHatasi(
      `MANUEL paylasim icin su bolumlerin tutari girilmemis: ` +
        `${eksik.map((g) => g.bolum.kapiNo).join(', ')}.`,
      'Dagitim tablosunu eksiksiz doldurun.',
    );
  }

  const tutarlar = dahil.map((g) => g.manuelTutar as Money);
  const verilen = tutarlar.reduce((t, m) => topla(t, m), sifir(toplam.paraBirimi));

  if (verilen.kurus !== toplam.kurus) {
    throw new DogrulamaHatasi(
      `'${giderKodu}' icin manuel dagitim toplami gider tutarina esit degil ` +
        `(dagitilan ${apiBicimi(verilen)}, gider ${apiBicimi(toplam)}).`,
      'Tutarlari gideri tam karsilayacak sekilde duzeltin.',
    );
  }

  return tutarlar;
}

/**
 * KARMA dagitim: gider once bilesen yuzdelerine bolunur, her parca kendi
 * kuraliyla dagitilir, sonuclar bolum bazinda toplanir.
 *
 * Yuvarlama iki katmanda da korunur: `dagit` her cagrisinda parcalarin toplami
 * girdiye tam esittir, dolayisiyla toplamlarin toplami da giderin tamamidir.
 */
function karmaDagit(
  gider: GiderTuru,
  toplam: Money,
  dahil: readonly PaylasimGirdisi[],
  bilesenler: readonly KarmaBilesen[],
  secenekler: PaylasimSecenekleri,
): readonly Money[] {
  const parcalar = dagit(toplam, bilesenler.map((b) => BigInt(b.yuzde)));

  const birikim: Money[] = dahil.map(() => sifir(toplam.paraBirimi));
  bilesenler.forEach((bilesen, bi) => {
    const parca = parcalar[bi] as Money;
    const agirliklar = agirliklariCoz(bilesen.kural, gider.kod, dahil, secenekler);
    const paylar = dagit(parca, agirliklar);
    paylar.forEach((pay, i) => {
      birikim[i] = topla(birikim[i] as Money, pay);
    });
  });

  return birikim;
}

/**
 * Gideri bolumlere paylastirir.
 *
 * Aidat muafiyeti olan bolumler dagitima girmez; muaf bolumun payi
 * kalan bolumlere dagilir — bu, yonetim planinin ongordugu davranistir.
 */
export function gideriPaylastir(
  gider: GiderTuru,
  toplam: Money,
  girdiler: readonly PaylasimGirdisi[],
  secenekler: PaylasimSecenekleri = {},
): readonly PaylasimSatiri[] {
  // Bozuk bir kural tanimi (ornegin toplami 100 olmayan KARMA) sessizce
  // eksik dagitim uretir; tanim dagitimdan ONCE reddedilir.
  const tanimHatalari = giderTuruDogrula(gider);
  if (tanimHatalari.length > 0) {
    throw new DogrulamaHatasi(
      `'${gider.kod}' gider turu tanimi gecersiz: ${tanimHatalari.join(' ')}`,
      'Gider turu tanimini duzeltip tahakkuku tekrar calistirin.',
    );
  }

  const dahil = girdiler.filter((g) => !g.bolum.aidatMuafiyeti);
  if (dahil.length === 0) {
    throw new DogrulamaHatasi(
      'Paylastirilacak bolum yok — tum bolumler aidat muafiyetli.',
      'Muafiyet tanimlarini kontrol edin.',
    );
  }

  if (gider.paylasimKurali === 'KARMA') {
    const bilesenler = gider.karmaBilesenler ?? [];
    const paylar = karmaDagit(gider, toplam, dahil, bilesenler, secenekler);
    return dahil.map((g, i) => ({
      bolumId: g.bolum.id,
      kapiNo: g.bolum.kapiNo,
      tutar: paylar[i] as Money,
      // KARMA'da tek bir agirlik yoktur; pay birden cok kuralin toplamidir.
      agirlik: null,
    }));
  }

  if (gider.paylasimKurali === 'MANUEL') {
    const tutarlar = manuelDagit(gider.kod, toplam, dahil);
    return dahil.map((g, i) => ({
      bolumId: g.bolum.id,
      kapiNo: g.bolum.kapiNo,
      tutar: tutarlar[i] as Money,
      // MANUEL'de dagitim yok, dolayisiyla agirlik da yok.
      agirlik: null,
    }));
  }

  const agirliklar = agirliklariCoz(gider.paylasimKurali, gider.kod, dahil, secenekler);
  const paylar = dagit(toplam, agirliklar);

  return dahil.map((g, i) => ({
    bolumId: g.bolum.id,
    kapiNo: g.bolum.kapiNo,
    tutar: paylar[i] as Money,
    agirlik: agirliklar[i] as bigint,
  }));
}
