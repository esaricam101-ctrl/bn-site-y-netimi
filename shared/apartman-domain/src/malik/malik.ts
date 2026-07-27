/**
 * Malik hissesi ve hisseli borc bolusumu — 634 sayili KMK · ADR v1.1 §5
 *
 * Bir bagimsiz bolumun BIRDEN COK maliki olabilir (miras, ortak alim, esler
 * arasi paylasim). Hisse oranlari pay/payda olarak tutulur; yuzde bir ondalik
 * sayi olarak saklansaydi uc esit hisse (1/3) toplandiginda 99,99 ederdi ve
 * "toplam %100" kurali hicbir zaman saglanmazdi (ADR-0007 ile ayni gerekce).
 */
import { dagit, type Money, type TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';
import { kesirleriTopla, kesirOrani, tamiEdiyorMu } from '../kesir.js';

/** Tapu kaydinin dayandigi hukuki bicim. */
export type TapuTuru =
  | 'KAT_MULKIYETI'
  | 'KAT_IRTIFAKI'
  | 'ARSA_PAYLI'
  | 'MIRAS_ISTIRAK'
  | 'DIGER';

/** Bir bolumun borcunun malikler arasinda nasil bolunecegi. */
export type MalikPaylasimi = 'ESIT' | 'HISSE_ORANI' | 'MANUEL';

/** Hisse agirliklarinin normalize edildigi olcek — arsa payi ile ayni desen. */
export const HISSE_OLCEGI = 1_000_000n;

export interface MalikHissesi {
  readonly kisiId: string;
  readonly hissePay: bigint;
  readonly hissePayda: bigint;
  readonly baslangic: TakvimTarihi;
  readonly bitis: TakvimTarihi | null;
}

/**
 * Hisse agirligi — payda HISSE_OLCEGI'ne normalize edilir.
 *
 * Bu deger DAGITIM icindir, dogrulama icin degil: tam sayi bolmesi kirpar
 * (1/3 -> 333333) ve uc esit hissenin toplami 999999 eder. Dagitimda sorun
 * degildir cunku `dagit()` kalani en buyuk paya ekleyerek toplami korur.
 * Toplamin tami ettigini denetlemek icin `hisseleriDogrula` kesirli aritmetik
 * kullanir — bkz. asagisi.
 */
export function hisseAgirligi(m: MalikHissesi): bigint {
  return (m.hissePay * HISSE_OLCEGI) / m.hissePayda;
}


/** Verilen tarihte gecerli malik kayitlari. */
export function tarihtekiMalikler(
  malikler: readonly MalikHissesi[],
  tarih: TakvimTarihi,
): readonly MalikHissesi[] {
  return malikler.filter(
    (m) => m.baslangic <= tarih && (m.bitis === null || m.bitis >= tarih),
  );
}

export interface HisseDogrulamasi {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
}

/**
 * Hisse oranlarinin toplami tami etmelidir.
 *
 * Toplam 1'den kucukse bolumun bir kismi sahipsizdir ve o pay hicbir kisiye
 * tahakkuk etmez — borc sessizce eksik yazilir. Buyukse ayni tutar birden
 * fazla kisiden istenir. Iki durum da tahsilat tablosunu bozar.
 */
export function hisseleriDogrula(
  malikler: readonly MalikHissesi[],
  tarih: TakvimTarihi,
): HisseDogrulamasi {
  const gecerliler = tarihtekiMalikler(malikler, tarih);

  if (gecerliler.length === 0) {
    return {
      gecerli: false,
      toplam: '0.000000',
      mesaj: `${tarih} tarihinde gecerli malik kaydi yok. Bolum sahipsiz gorunuyor.`,
    };
  }

  const toplam = kesirleriTopla(
    gecerliler.map((m) => ({ pay: m.hissePay, payda: m.hissePayda })),
  );
  const gecerli = tamiEdiyorMu(toplam);
  const oran = kesirOrani(toplam);

  return {
    gecerli,
    toplam: oran.toFixed(6),
    mesaj: gecerli
      ? 'Hisse oranlari toplami tami ediyor.'
      : `${tarih} tarihinde hisse oranlari toplami 1 degil (${oran.toFixed(6)}). ` +
        (toplam.pay < toplam.payda
          ? 'Bolumun bir kismi sahipsiz; eksik pay hicbir kisiye tahakkuk etmez.'
          : 'Ayni pay birden fazla kisiye yazilmis; tahsilat fazla cikar.'),
  };
}

/** Hisse toplami tam degilse islemi durdurur. */
export function hisseleriZorunluKil(
  malikler: readonly MalikHissesi[],
  tarih: TakvimTarihi,
): readonly MalikHissesi[] {
  const sonuc = hisseleriDogrula(malikler, tarih);
  if (!sonuc.gecerli) {
    throw new DogrulamaHatasi(sonuc.mesaj, 'Tapu ve hisse kayitlarini duzeltin.');
  }
  return tarihtekiMalikler(malikler, tarih);
}

export interface MalikPayi {
  readonly kisiId: string;
  readonly tutar: Money;
  readonly agirlik: bigint;
}

/**
 * Bir bolumun borcunu malikler arasinda boler.
 *
 *   ESIT        -> her malik esit oder, hissesi ne olursa olsun
 *   HISSE_ORANI -> tapu hissesine gore
 *   MANUEL      -> yonetici agirliklari verir (genel kurul karari vb.)
 *
 * Yuvarlama farki `dagit()` tarafindan korunur: paylarin toplami daima
 * borcun tamamina esittir. Bir malik kendi payini oderse digerlerinin borcu
 * acik kalir — bu yuzden paylar kisi bazinda ayri ayri dondurulur.
 */
export function malikBorcunuBol(
  tutar: Money,
  malikler: readonly MalikHissesi[],
  yontem: MalikPaylasimi,
  manuelAgirliklar?: readonly bigint[],
): readonly MalikPayi[] {
  if (malikler.length === 0) {
    throw new DogrulamaHatasi(
      'Borc bolusturulecek malik yok.',
      'Bolumun malik kaydini tamamlayin.',
    );
  }

  let agirliklar: readonly bigint[];
  switch (yontem) {
    case 'ESIT':
      agirliklar = malikler.map(() => 1n);
      break;
    case 'HISSE_ORANI':
      agirliklar = malikler.map(hisseAgirligi);
      break;
    case 'MANUEL':
      if (manuelAgirliklar === undefined || manuelAgirliklar.length !== malikler.length) {
        throw new DogrulamaHatasi(
          `MANUEL bolusum icin ${malikler.length} malikin her birine agirlik verilmelidir.`,
          'Dagitim tablosunu eksiksiz doldurun.',
        );
      }
      if (manuelAgirliklar.some((a) => a < 0n)) {
        throw new DogrulamaHatasi('Manuel dagitim agirligi negatif olamaz.');
      }
      agirliklar = manuelAgirliklar;
      break;
  }

  if (agirliklar.every((a) => a === 0n)) {
    throw new DogrulamaHatasi(
      `Tum malik agirliklari sifir; ${yontem} bolusumu uygulanamaz.`,
      'Hisse oranlarini veya manuel dagitimi gozden gecirin.',
    );
  }

  const paylar = dagit(tutar, agirliklar);
  return malikler.map((m, i) => ({
    kisiId: m.kisiId,
    tutar: paylar[i] as Money,
    agirlik: agirliklar[i] as bigint,
  }));
}
