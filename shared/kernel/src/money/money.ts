/**
 * Para — ADR-0003 · ADR-0007 · BFS v1 §11
 *
 * Ölçeklenmiş bigint ile sabit noktalı aritmetik. Ölçek 4 basamak,
 * PostgreSQL `numeric(18,4)` ile birebir örtüşür.
 *
 * Neden float değil: kayan noktalı para, sonradan tam migration olmadan
 * düzeltilemeyecek iki kusurdan biridir. Neden harici kütüphane değil:
 * shared-kernel en temel pakettir; para tipini üçüncü taraf bir sınıfa
 * bağlamak, o tipi tüm tüketicilerin genel API'sine sızdırır (ADR-0007).
 *
 * Bu bir genel amaçlı ondalık kütüphanesi DEĞİLDİR. Sabit ölçekli toplama,
 * çıkarma, oran çarpımı ve pay dağıtımı için tasarlanmıştır.
 */

export type ParaBirimi = 'TRY' | 'USD' | 'EUR';

/** Ondalık basamak sayısı. numeric(18,4) ile örtüşür. */
export const OLCEK = 4;
const CARPAN = 10n ** BigInt(OLCEK);

export class ParaHatasi extends Error {
  override readonly name = 'ParaHatasi';
}

export interface Money {
  /** Ölçeklenmiş tam sayı. 12,3456 TRY -> 123456n */
  readonly kurus: bigint;
  readonly paraBirimi: ParaBirimi;
  /** Fonksiyonel para birimine çevrim kuru, ölçeklenmiş (1,0 -> 10000n). */
  readonly kur: bigint;
}

/* ------------------------------------------------------------------ */
/* Oluşturma                                                           */
/* ------------------------------------------------------------------ */

const ONDALIK = /^-?\d+(\.\d+)?$/;

function olcekle(deger: string): bigint {
  const s = deger.trim();
  if (!ONDALIK.test(s)) {
    throw new ParaHatasi(
      `Geçersiz para değeri: '${deger}'. Ondalık string bekleniyor (örn. '1234.5600').`,
    );
  }
  const negatifMi = s.startsWith('-');
  const parcalar = s.replace('-', '').split('.');
  const tam = parcalar[0] ?? '0';
  const ondalik = parcalar[1] ?? '';
  if (ondalik.length > OLCEK) {
    throw new ParaHatasi(
      `Para değeri en fazla ${OLCEK} ondalık basamak taşıyabilir: '${deger}'. ` +
        `Yuvarlama çağıran tarafın açık kararıdır, sessizce yapılmaz.`,
    );
  }
  const dolgulu = ondalik.padEnd(OLCEK, '0');
  const sonuc = BigInt(tam) * CARPAN + BigInt(dolgulu);
  return negatifMi ? -sonuc : sonuc;
}

/**
 * Ondalık string'den para üretir. `number` KABUL EDİLMEZ —
 * çağıran tarafta zaten kayıp yaşanmış olur.
 */
export function money(tutar: string, paraBirimi: ParaBirimi = 'TRY', kur = '1'): Money {
  return { kurus: olcekle(tutar), paraBirimi, kur: olcekle(kur) };
}

/** Ölçeklenmiş tam sayıdan doğrudan üretir (veritabanı okuması için). */
export function moneyKurustan(
  kurus: bigint,
  paraBirimi: ParaBirimi = 'TRY',
  kur: bigint = CARPAN,
): Money {
  return { kurus, paraBirimi, kur };
}

export const sifir = (paraBirimi: ParaBirimi = 'TRY'): Money => moneyKurustan(0n, paraBirimi);

/* ------------------------------------------------------------------ */
/* Aritmetik                                                           */
/* ------------------------------------------------------------------ */

function ayniBirim(a: Money, b: Money, islem: string): void {
  if (a.paraBirimi !== b.paraBirimi) {
    throw new ParaHatasi(
      `Farklı para birimleri ${islem} işlemine giremez: ${a.paraBirimi} / ${b.paraBirimi}. ` +
        `Önce fonksiyonel para birimine çevirin.`,
    );
  }
}

/** Bankacı yuvarlaması (ROUND_HALF_EVEN) ile tam sayı bölme. */
function bolYuvarla(pay: bigint, payda: bigint): bigint {
  const isaretNegatif = pay < 0n !== payda < 0n;
  const p = pay < 0n ? -pay : pay;
  const d = payda < 0n ? -payda : payda;

  const bolum = p / d;
  const kalan = p % d;
  const iki = kalan * 2n;

  let sonuc = bolum;
  if (iki > d) sonuc = bolum + 1n;
  else if (iki === d) sonuc = bolum % 2n === 0n ? bolum : bolum + 1n; // yarıda çifte

  return isaretNegatif ? -sonuc : sonuc;
}

export function topla(a: Money, b: Money): Money {
  ayniBirim(a, b, 'toplama');
  return { kurus: a.kurus + b.kurus, paraBirimi: a.paraBirimi, kur: a.kur };
}

export function cikar(a: Money, b: Money): Money {
  ayniBirim(a, b, 'çıkarma');
  return { kurus: a.kurus - b.kurus, paraBirimi: a.paraBirimi, kur: a.kur };
}

export function negatifle(a: Money): Money {
  return { kurus: -a.kurus, paraBirimi: a.paraBirimi, kur: a.kur };
}

export function karsilastir(a: Money, b: Money): -1 | 0 | 1 {
  ayniBirim(a, b, 'karşılaştırma');
  if (a.kurus < b.kurus) return -1;
  if (a.kurus > b.kurus) return 1;
  return 0;
}

export const esitMi = (a: Money, b: Money): boolean => karsilastir(a, b) === 0;
export const sifirMi = (a: Money): boolean => a.kurus === 0n;
export const negatifMi = (a: Money): boolean => a.kurus < 0n;

/**
 * Oranla çarpar (faiz, pay, yüzde). Sonuç bankacı yuvarlamasıyla ölçeğe döner.
 *
 * Oran tam sayı pay/payda olarak geçer; float olarak geçmez.
 * Örnek: aylık %1,5 gecikme faizi -> carpOran(m, 15n, 1000n)
 */
export function carpOran(a: Money, pay: bigint, payda: bigint): Money {
  if (payda === 0n) throw new ParaHatasi('Payda sıfır olamaz.');
  return { kurus: bolYuvarla(a.kurus * pay, payda), paraBirimi: a.paraBirimi, kur: a.kur };
}

/** Fonksiyonel para birimindeki karşılık (ölçeklenmiş). */
export function fonksiyonelTutar(a: Money): bigint {
  return bolYuvarla(a.kurus * a.kur, CARPAN);
}

/* ------------------------------------------------------------------ */
/* Dağıtım — ADR v1.1 §4                                               */
/* ------------------------------------------------------------------ */

/**
 * Bir tutarı ağırlıklara göre dağıtır ve yuvarlama farkını KAYBETMEZ.
 *
 * Gider paylaşımının (eşit · arsa payı · metrekare · tüketim) tek meşru
 * yoludur. Fark, en büyük ağırlıklı paya eklenir; toplam daima korunur:
 *   toplam(paylar) === toplam
 *
 * "Dağıtım farkı açıkça bir kaleme atanır, kaybolmaz" (BFS v1 §11).
 */
export function dagit(toplam: Money, agirliklar: readonly bigint[]): readonly Money[] {
  if (agirliklar.length === 0) return [];

  const agirlikToplami = agirliklar.reduce((t, a) => t + a, 0n);
  if (agirlikToplami <= 0n) {
    throw new ParaHatasi('Ağırlık toplamı sıfır veya negatif olamaz.');
  }

  const paylar: bigint[] = [];
  let dagitilan = 0n;
  for (const agirlik of agirliklar) {
    const pay = (toplam.kurus * agirlik) / agirlikToplami; // sıfıra doğru kırp
    paylar.push(pay);
    dagitilan += pay;
  }

  // En büyük ağırlıklı payı bul
  let hedef = 0;
  for (let i = 1; i < agirliklar.length; i++) {
    if ((agirliklar[i] ?? 0n) > (agirliklar[hedef] ?? 0n)) hedef = i;
  }

  // Kalanı ona ekle — toplam korunur
  const fark = toplam.kurus - dagitilan;
  paylar[hedef] = (paylar[hedef] ?? 0n) + fark;

  return paylar.map((p) => moneyKurustan(p, toplam.paraBirimi, toplam.kur));
}

/* ------------------------------------------------------------------ */
/* Biçimlendirme                                                       */
/* ------------------------------------------------------------------ */

/** API çıktısı: decimal string, asla `number` (BFS v1 §11). */
export function apiBicimi(m: Money): string {
  const isaretNegatif = m.kurus < 0n;
  const mutlak = isaretNegatif ? -m.kurus : m.kurus;
  const tam = mutlak / CARPAN;
  const ondalik = (mutlak % CARPAN).toString().padStart(OLCEK, '0');
  return `${isaretNegatif ? '-' : ''}${tam.toString()}.${ondalik}`;
}

/** Kuruşa (2 basamak) yuvarlar. Bankacı yuvarlaması. */
export function kurusaYuvarla(m: Money): Money {
  const bolen = 10n ** BigInt(OLCEK - 2);
  return moneyKurustan(bolYuvarla(m.kurus, bolen) * bolen, m.paraBirimi, m.kur);
}
