/**
 * Kayipsiz kesir toplami.
 *
 * Hem arsa payi (KMK md. 3) hem malik hissesi "toplam tami etmeli" kuralina
 * tabidir. Paylari olcekli tam sayiya cevirip toplamak bu kurali 1/3 gibi
 * degerlerde ASLA saglatmaz: (1x1_000_000)/3 = 333_333 ve ucunun toplami
 * 999_999 eder. Uc esit hisseli bir daire, hicbir sey yanlis olmadigi halde
 * surekli "hatali" gorunur.
 *
 * Bu modul toplamayi kesir olarak yapar; sonuc pay === payda ise tam eder.
 */

export interface Kesir {
  readonly pay: bigint;
  readonly payda: bigint;
}

function ebob(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
}

/**
 * Kesirleri kayipsiz toplar: p1/q1 + p2/q2 = (p1·q2 + p2·q1)/(q1·q2).
 * Her adimda EBOB ile sadelestirilir; aksi halde payda cok sayida malikte
 * gereksiz buyur.
 */
export function kesirleriTopla(kesirler: readonly Kesir[]): Kesir {
  let pay = 0n;
  let payda = 1n;
  for (const k of kesirler) {
    if (k.payda === 0n) continue;
    pay = pay * k.payda + k.pay * payda;
    payda *= k.payda;
    const b = ebob(pay, payda);
    pay /= b;
    payda /= b;
  }
  return { pay, payda };
}

/** Kesir tam olarak 1 mi. */
export const tamiEdiyorMu = (k: Kesir): boolean => k.pay === k.payda;

/** Goruntuleme icin ondalik oran. Karsilastirmada KULLANILMAZ. */
export const kesirOrani = (k: Kesir): number => Number(k.pay) / Number(k.payda);
