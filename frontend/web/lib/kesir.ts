/**
 * Kesir aritmetiği — arayüzde canlı toplam gösterimi için.
 *
 * KAYNAK OTORİTE `shared/apartman-domain/src/kesir.ts`. Web paketi domain
 * paketine bağımlı değildir (ADR v1.1 §40); bu dosya aynı kuralı aynalar ve
 * yalnızca GÖSTERİM içindir. Yazma kararını her zaman sunucu verir.
 *
 * NEDEN ONDALIK KULLANILMIYOR — arsa payları KMK md. 3 uyarınca toplamı tamı
 * etmek zorundadır. Üç eşit paylı bir binada 1/3 ondalığa çevrilirse
 * 0,333333 × 3 = 0,999999 eder; ekran "tam değil" der ve kullanıcı hatayı
 * kendi verisinde arar. Hata verisinde değil, aritmetiktedir.
 *
 * `Number` de yetmez: 0.1 + 0.2 !== 0.3. Bu yüzden pay ve payda `bigint`
 * tutulur ve toplama çapraz çarpımla yapılır.
 */

export interface Kesir {
  readonly pay: bigint;
  readonly payda: bigint;
}

function ebob(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) { const t = x % y; x = y; y = t; }
  return x === 0n ? 1n : x;
}

export function kesirSadelestir(k: Kesir): Kesir {
  if (k.payda === 0n) return k;
  const b = ebob(k.pay, k.payda);
  return { pay: k.pay / b, payda: k.payda / b };
}

/** Kayıpsız toplama. Payda çarpımı büyür; `bigint` taşmaz. */
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

/** Toplam tamı ediyor mu — KMK md. 3. */
export function tamiEdiyorMu(k: Kesir): boolean {
  return k.payda !== 0n && k.pay === k.payda;
}

/** "45/1000" → Kesir. Geçersizse `null`. Ondalık KABUL EDİLMEZ. */
export function kesirCoz(ham: string): Kesir | null {
  const parcalar = ham.trim().split('/');
  if (parcalar.length !== 2) return null;
  const pay = (parcalar[0] ?? '').trim();
  const payda = (parcalar[1] ?? '').trim();
  if (!/^\d+$/u.test(pay) || !/^\d+$/u.test(payda)) return null;
  if (/^0+$/u.test(payda)) return null;
  return { pay: BigInt(pay), payda: BigInt(payda) };
}

export function kesirYaz(k: Kesir): string {
  return `${k.pay}/${k.payda}`;
}

/**
 * Yalnızca GÖSTERİM için yüzde. Karara esas alınmaz; `tamiEdiyorMu`
 * kesir üzerinden çalışır.
 */
export function kesirYuzde(k: Kesir, basamak = 4): string {
  if (k.payda === 0n) return '—';
  const olcek = 10n ** BigInt(basamak);
  const tam = (k.pay * 100n * olcek) / k.payda;
  const tamKisim = tam / olcek;
  const ondalik = (tam % olcek).toString().padStart(basamak, '0');
  return `${tamKisim},${ondalik}`;
}
