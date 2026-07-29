/**
 * CSV ayrıştırma — içe aktarmanın temeli.
 *
 * `disa-aktar.ts` ile aynı sözleşmeyi okur: Excel'in Türkçe yerel ayarında
 * ayırıcı NOKTALI VİRGÜLDÜR ve dosya BOM ile başlar. Ancak kullanıcı dosyayı
 * başka bir yerden de alabilir; bu yüzden ayırıcı SEZİLİR, varsayılmaz.
 *
 * Neden elde yazıldı: RFC 4180'in gerçekten gereken kısmı (tırnaklı alan,
 * içteki ikilenmiş tırnak, alan içi satır sonu) yüz satırdan kısadır. Bir
 * ayrıştırma kütüphanesi eklemek, kullanıcının makinesinde çalışan kodun
 * denetim yüzeyini genişletir; kazanç yok.
 *
 * `split(';')` YETMEZ: `"Kirac; A.Ş.";120` satırında tırnak içindeki ayırıcı
 * alanı bölmemelidir. Bölerse kolonlar kayar ve YANLIŞ VERİ sessizce yazılır —
 * hata vermez, sadece m² sütununa unvan yazılır.
 */

const BOM = '﻿';

/** Sezilen ayırıcı ve ayrıştırılmış satırlar. */
export interface CsvSonucu {
  readonly ayirici: string;
  /** İlk satır başlık kabul EDİLMEZ; çağıran karar verir. */
  readonly satirlar: readonly (readonly string[])[];
}

/**
 * Ayırıcı sezimi: ilk satırda (tırnak dışında) hangi aday daha çok geçiyorsa
 * odur. Eşitlikte `;` seçilir — hedef kitle Excel/Türkçe'dir.
 */
function ayiriciSez(ilkSatir: string): string {
  const adaylar = [';', ',', '\t'];
  let enIyi = ';';
  let enCok = 0;
  for (const aday of adaylar) {
    let sayi = 0;
    let tirnakta = false;
    for (const ch of ilkSatir) {
      if (ch === '"') tirnakta = !tirnakta;
      else if (ch === aday && !tirnakta) sayi += 1;
    }
    if (sayi > enCok) { enCok = sayi; enIyi = aday; }
  }
  return enIyi;
}

/**
 * Metni satır ve alanlara böler.
 *
 * Boş satırlar atılır: Excel dosya sonuna sık sık boş satır bırakır ve her
 * biri "geçersiz kayıt" olarak raporlanırsa kullanıcı asıl hatayı göremez.
 */
export function csvAyristir(ham: string): CsvSonucu {
  const metin = ham.startsWith(BOM) ? ham.slice(BOM.length) : ham;
  const ilkSatirSonu = metin.search(/\r?\n/u);
  const ayirici = ayiriciSez(ilkSatirSonu < 0 ? metin : metin.slice(0, ilkSatirSonu));

  const satirlar: string[][] = [];
  let alanlar: string[] = [];
  let alan = '';
  let tirnakta = false;

  const alaniKapat = () => { alanlar.push(alan); alan = ''; };
  const satiriKapat = () => {
    alaniKapat();
    // Tamami bos satir atilir (tek bos alan da dahil).
    if (alanlar.some((a) => a.trim() !== '')) satirlar.push(alanlar);
    alanlar = [];
  };

  for (let i = 0; i < metin.length; i += 1) {
    const ch = metin[i] as string;

    if (tirnakta) {
      if (ch === '"') {
        // Ikilenmis tirnak ("") tek tirnak demektir; tek tirnak alani kapatir.
        if (metin[i + 1] === '"') { alan += '"'; i += 1; }
        else tirnakta = false;
      } else {
        alan += ch;
      }
      continue;
    }

    if (ch === '"' && alan === '') { tirnakta = true; continue; }
    if (ch === ayirici) { alaniKapat(); continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { satiriKapat(); continue; }
    alan += ch;
  }

  // Dosya satir sonuyla bitmiyorsa son satir yazilmadan kalir.
  if (alan !== '' || alanlar.length > 0) satiriKapat();

  return { ayirici, satirlar };
}

/**
 * Türkçe sayı okuma: "1.234,50" → 1234.5.
 *
 * Excel Türkçe yerel ayarında ondalık ayracı VİRGÜLDÜR. `Number('98,25')`
 * `NaN` verir; bunu "geçersiz" diye reddetmek kullanıcının doğru yazdığı
 * dosyayı geri çevirir. Nokta yalnızca binlik ayracıysa atılır — "98.25"
 * gibi tek noktalı ve ondalık görünümlü değer ondalık kabul edilir.
 */
export function sayiOku(ham: string): number | null {
  const s = ham.trim();
  if (s === '') return null;

  const virgul = s.lastIndexOf(',');
  const nokta = s.lastIndexOf('.');

  let duz: string;
  if (virgul >= 0 && nokta >= 0) {
    // Hangisi sondaysa ondalık ayracıdır; diğeri binliktir.
    duz = virgul > nokta
      ? s.replaceAll('.', '').replace(',', '.')
      : s.replaceAll(',', '');
  } else if (virgul >= 0) {
    duz = s.replaceAll('.', '').replace(',', '.');
  } else if (nokta >= 0) {
    // Tek nokta ve ardindan tam 3 basamak varsa binlik ayraci olma ihtimali
    // yuksektir ("1.234"); aksi halde ondalik ("98.25").
    duz = /^\d{1,3}(\.\d{3})+$/u.test(s) ? s.replaceAll('.', '') : s;
  } else {
    duz = s;
  }

  const n = Number(duz);
  return Number.isFinite(n) ? n : null;
}

/**
 * "45/1000" ya da ayrı iki sütun halinde gelen arsa payını pay/payda olarak
 * çözer. Ondalık ("0,045") KABUL EDİLMEZ: arsa payı kesirdir ve ondalığa
 * çevrilirse 1/3 gibi paylar toplamı tamı etmez (KMK md. 3 · ADR-0007).
 */
export function kesirOku(ham: string): { pay: string; payda: string } | null {
  const s = ham.trim();
  if (s === '') return null;
  const parcalar = s.split('/');
  if (parcalar.length !== 2) return null;
  const pay = (parcalar[0] ?? '').trim();
  const payda = (parcalar[1] ?? '').trim();
  if (!/^\d+$/u.test(pay) || !/^\d+$/u.test(payda)) return null;
  if (payda === '0' || /^0+$/u.test(payda)) return null;
  return { pay, payda };
}

/** "evet/hayir", "true/false", "1/0", "x" — hepsi kabul edilir. */
export function mantikOku(ham: string): boolean {
  const s = ham.trim().toLocaleLowerCase('tr');
  return ['evet', 'e', 'true', '1', 'x', 'var'].includes(s);
}
