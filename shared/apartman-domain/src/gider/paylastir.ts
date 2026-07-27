/**
 * Gider paylastirma — ADR v1.1 §4 · Eksen 1
 *
 * Dagitim @bnos/kernel'in dagit() fonksiyonu uzerinden yapilir; yuvarlama
 * farki kaybolmaz ve paylarin toplami daima giderin tamamina esittir.
 */
import { dagit, topla, sifir, type Money } from '@bnos/kernel';
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

function agirlikCoz(kural: Exclude<PaylasimKurali, 'KARMA'>, g: PaylasimGirdisi): bigint {
  switch (kural) {
    case 'ESIT':
      return 1n;
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

/** Tek bir kural icin agirliklari cozer ve sifir toplamini reddeder. */
function agirliklariCoz(
  kural: Exclude<PaylasimKurali, 'KARMA'>,
  giderKodu: string,
  dahil: readonly PaylasimGirdisi[],
): readonly bigint[] {
  const agirliklar = dahil.map((g) => agirlikCoz(kural, g));
  if (agirliklar.every((a) => a === 0n)) {
    throw new DogrulamaHatasi(
      `'${giderKodu}' icin tum agirliklar sifir. ${kural} kurali uygulanamaz.`,
      kural === 'TUKETIM'
        ? 'Sayac okumalarinin girildiginden emin olun.'
        : 'Paylasim kuralini gozden gecirin.',
    );
  }
  return agirliklar;
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
): readonly Money[] {
  const parcalar = dagit(toplam, bilesenler.map((b) => BigInt(b.yuzde)));

  const birikim: Money[] = dahil.map(() => sifir(toplam.paraBirimi));
  bilesenler.forEach((bilesen, bi) => {
    const parca = parcalar[bi] as Money;
    const agirliklar = agirliklariCoz(bilesen.kural, gider.kod, dahil);
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
    const paylar = karmaDagit(gider, toplam, dahil, bilesenler);
    return dahil.map((g, i) => ({
      bolumId: g.bolum.id,
      kapiNo: g.bolum.kapiNo,
      tutar: paylar[i] as Money,
      // KARMA'da tek bir agirlik yoktur; pay birden cok kuralin toplamidir.
      agirlik: null,
    }));
  }

  const agirliklar = agirliklariCoz(gider.paylasimKurali, gider.kod, dahil);
  const paylar = dagit(toplam, agirliklar);

  return dahil.map((g, i) => ({
    bolumId: g.bolum.id,
    kapiNo: g.bolum.kapiNo,
    tutar: paylar[i] as Money,
    agirlik: agirliklar[i] as bigint,
  }));
}
