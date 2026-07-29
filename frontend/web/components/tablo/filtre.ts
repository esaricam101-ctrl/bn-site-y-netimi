/**
 * Filtre motoru — saf fonksiyonlar, React yok.
 *
 * Motorun ayrı tutulmasının nedeni: süzme kuralı bir GÖRÜNÜM meselesi değil,
 * bir veri meselesidir. Aynı koşullar ileride sunucuya gönderilecekse
 * (`SUNUCU_ESIGI` aşıldığında) burada tanımlı sözleşme olduğu gibi taşınır;
 * bileşen içine gömülmüş bir `if` zinciri taşınamaz.
 *
 * TÜRKÇE KARŞILAŞTIRMA — metin karşılaştırmaları `toLocaleLowerCase('tr')`
 * ile yapılır. Varsayılan İngilizce katlama `I` harfini `i` yapar; Türkçede
 * `I`nın küçüğü `ı`dır. "IŞIK" araması varsayılan katlamada "ışık" kaydını
 * bulamaz — kullanıcı kaydın silindiğini sanır.
 */
import type {
  FiltreBaglaci, FiltreKosulu, FiltreOperatoru, FiltreVeriTipi, Kolon,
} from './tablo-tipleri';

/** Her veri tipinde hangi işleçlerin sunulacağı. Panel bu listeyi okur. */
export const TIP_ISLECLERI: Readonly<Record<FiltreVeriTipi, readonly FiltreOperatoru[]>> = {
  metin: ['icerir', 'icermez', 'esittir', 'esitDegildir', 'baslar', 'bos', 'dolu'],
  sayi: ['esittir', 'esitDegildir', 'buyuk', 'kucuk', 'aralik', 'bos', 'dolu'],
  tarih: ['esittir', 'buyuk', 'kucuk', 'aralik', 'bos', 'dolu'],
  secim: ['esittir', 'esitDegildir', 'bos', 'dolu'],
  mantik: ['esittir'],
};

/** Değer alanı istemeyen işleçler — panel bunlarda girdi kutusu göstermez. */
export const DEGERSIZ_ISLECLER: readonly FiltreOperatoru[] = ['bos', 'dolu'];

export function kolonTipi<T>(kolon: Kolon<T>): FiltreVeriTipi {
  return kolon.filtreTipi ?? 'metin';
}

/**
 * Karşılaştırmaya giren tüm değerler: kolonun ham değeri ya da kullanıcının
 * yazdığı metin. `unknown` DEĞİLDİR — `String(unknown)` nesneyi sessizce
 * `[object Object]` yapar ve her koşul yanlış eşleşir.
 */
type Karsilastirilabilir = string | number | boolean | null | undefined;

function metin(deger: Karsilastirilabilir): string {
  return String(deger ?? '').toLocaleLowerCase('tr').trim();
}

/**
 * Sayısal ayrıştırma. Kolonun ham değeri zaten `number` ise doğrudan
 * kullanılır; kullanıcı girdisi metindir ve Türkçe ondalık ayracı virgüldür.
 */
function sayi(deger: Karsilastirilabilir): number | null {
  if (typeof deger === 'number') return Number.isFinite(deger) ? deger : null;
  const ham = String(deger ?? '').trim();
  if (ham === '') return null;
  // Binlik nokta atilir, ondalik virgul noktaya cevrilir: "1.234,50" -> 1234.5
  const duz = ham.replace(/\./gu, '').replace(',', '.');
  const n = Number(duz);
  return Number.isFinite(n) ? n : null;
}

/** Boş kabul edilen ham değerler. `0` ve `false` BOŞ DEĞİLDİR. */
function bosMu(deger: string | number | boolean | null): boolean {
  return deger === null || (typeof deger === 'string' && deger.trim() === '');
}

/**
 * Koşul "etkin" mi? Değer isteyen bir işleç boş değerle bırakıldıysa koşul
 * yok sayılır.
 *
 * Neden: kullanıcı koşulu ekler eklemez tablo boşalırsa, henüz hiçbir şey
 * yazmamışken sistemin bozulduğunu sanır. Yarım kurulmuş koşul süzmez.
 */
export function kosulEtkinMi(kosul: FiltreKosulu): boolean {
  if (DEGERSIZ_ISLECLER.includes(kosul.operator)) return true;
  if (kosul.operator === 'aralik') {
    // Tek uclu aralik da gecerlidir: yalnizca alt ya da yalnizca ust sinir.
    return kosul.deger.trim() !== '' || (kosul.deger2 ?? '').trim() !== '';
  }
  return kosul.deger.trim() !== '';
}

function karsilastir(
  hamDeger: string | number | boolean | null,
  kosul: FiltreKosulu,
  tip: FiltreVeriTipi,
): boolean {
  if (kosul.operator === 'bos') return bosMu(hamDeger);
  if (kosul.operator === 'dolu') return !bosMu(hamDeger);

  // Bos hucre, bos olmayan bir kosulu ASLA karsilamaz. Aksi halde "borcu
  // 0'dan buyuk olmayanlar" sorgusunda verisi girilmemis daireler de
  // "borcsuz" gorunur — eksik veri, olumlu yanit gibi okunur.
  if (bosMu(hamDeger)) return false;

  if (tip === 'sayi') {
    const a = sayi(hamDeger);
    if (a === null) return false;
    const alt = sayi(kosul.deger);
    const ust = sayi(kosul.deger2);
    switch (kosul.operator) {
      case 'esittir': return alt !== null && a === alt;
      case 'esitDegildir': return alt !== null && a !== alt;
      case 'buyuk': return alt !== null && a > alt;
      case 'kucuk': return alt !== null && a < alt;
      case 'aralik':
        return (alt === null || a >= alt) && (ust === null || a <= ust);
      default: return false;
    }
  }

  if (tip === 'tarih') {
    // YYYY-MM-DD sozluk sirasinda da dogru siralanir; ayristirmaya gerek yok.
    const a = String(hamDeger);
    const alt = kosul.deger.trim();
    const ust = (kosul.deger2 ?? '').trim();
    switch (kosul.operator) {
      case 'esittir': return a === alt;
      case 'buyuk': return a > alt;
      case 'kucuk': return a < alt;
      case 'aralik':
        return (alt === '' || a >= alt) && (ust === '' || a <= ust);
      default: return false;
    }
  }

  if (tip === 'mantik') {
    const beklenen = kosul.deger === 'evet';
    const gercek = typeof hamDeger === 'boolean' ? hamDeger : metin(hamDeger) === 'evet';
    return gercek === beklenen;
  }

  // metin ve secim
  const a = metin(hamDeger);
  const b = metin(kosul.deger);
  switch (kosul.operator) {
    case 'icerir': return a.includes(b);
    case 'icermez': return !a.includes(b);
    case 'esittir': return a === b;
    case 'esitDegildir': return a !== b;
    case 'baslar': return a.startsWith(b);
    default: return false;
  }
}

export function kosuluUygula<T>(
  satir: T, kolonlar: readonly Kolon<T>[], kosul: FiltreKosulu,
): boolean {
  const kolon = kolonlar.find((k) => k.anahtar === kosul.anahtar);
  // Kolon kaldirilmis olabilir (kayitli filtre eski surumden geliyorsa).
  // Bilinmeyen kolon SUZMEZ; sessizce tabloyu bosaltmaktansa yok sayilir.
  if (kolon === undefined) return true;
  return karsilastir(kolon.ham(satir), kosul, kolonTipi(kolon));
}

/**
 * Tüm koşulları uygular. VE'de hepsi, VEYA'da en az biri sağlanmalıdır.
 * Etkin koşul yoksa liste olduğu gibi döner.
 */
export function filtreleriUygula<T>(
  satirlar: readonly T[],
  kolonlar: readonly Kolon<T>[],
  kosullar: readonly FiltreKosulu[],
  baglac: FiltreBaglaci,
): readonly T[] {
  const etkin = kosullar.filter(kosulEtkinMi);
  if (etkin.length === 0) return satirlar;
  return satirlar.filter((s) =>
    baglac === 'VE'
      ? etkin.every((k) => kosuluUygula(s, kolonlar, k))
      : etkin.some((k) => kosuluUygula(s, kolonlar, k)),
  );
}
