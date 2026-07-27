/**
 * Gider paylastirma — ADR v1.1 §4 · Eksen 1
 *
 * Dagitim @bnos/kernel'in dagit() fonksiyonu uzerinden yapilir; yuvarlama
 * farki kaybolmaz ve paylarin toplami daima giderin tamamina esittir.
 */
import { dagit, type Money } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';
import type { BagimsizBolum } from '../bolum/bagimsiz-bolum.js';
import type { GiderTuru, PaylasimKurali } from './gider-turu.js';

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
  readonly agirlik: bigint;
}

function agirlikCoz(kural: PaylasimKurali, g: PaylasimGirdisi): bigint {
  switch (kural) {
    case 'ESIT':
      return 1n;
    case 'ARSA_PAYI':
      return g.bolum.arsaPayiAgirligi();
    case 'METREKARE':
      return g.bolum.metrekareAgirligi();
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
  const dahil = girdiler.filter((g) => !g.bolum.aidatMuafiyeti);
  if (dahil.length === 0) {
    throw new DogrulamaHatasi(
      'Paylastirilacak bolum yok — tum bolumler aidat muafiyetli.',
      'Muafiyet tanimlarini kontrol edin.',
    );
  }

  const agirliklar = dahil.map((g) => agirlikCoz(gider.paylasimKurali, g));
  if (agirliklar.every((a) => a === 0n)) {
    throw new DogrulamaHatasi(
      `'${gider.kod}' icin tum agirliklar sifir. ${gider.paylasimKurali} kurali uygulanamaz.`,
      gider.paylasimKurali === 'TUKETIM'
        ? 'Sayac okumalarinin girildiginden emin olun.'
        : 'Paylasim kuralini gozden gecirin.',
    );
  }

  const paylar = dagit(toplam, agirliklar);

  return dahil.map((g, i) => ({
    bolumId: g.bolum.id,
    kapiNo: g.bolum.kapiNo,
    tutar: paylar[i] as Money,
    agirlik: agirliklar[i] as bigint,
  }));
}
