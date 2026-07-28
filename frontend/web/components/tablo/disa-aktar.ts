/**
 * CSV dışa aktarım.
 *
 * Excel'in Türkçe yerel ayarında ayırıcı NOKTALI VİRGÜLDÜR; virgülle
 * üretilen dosya tek sütuna düşer ve kullanıcı "bozuk" sanar. Bu yüzden
 * ayırıcı `;` ve dosya BOM ile başlar — BOM olmadan Excel UTF-8'i tanımaz ve
 * Türkçe karakterler bozulur.
 *
 * PDF ve XLSX üretimi harici kütüphane gerektirir; bu katman şimdilik CSV ve
 * yazdırma ile sınırlıdır (DEVLOG TODO).
 */
import type { Kolon } from './tablo-tipleri';

const AYIRICI = ';';
const BOM = '﻿';

function hucreyiKacir(deger: string | number | boolean | null): string {
  if (deger === null) return '';
  const metin = String(deger);
  // Ayirici, tirnak ya da satir sonu iceren deger tirnaklanir; icteki tirnak
  // ikilenir (RFC 4180).
  if (metin.includes(AYIRICI) || metin.includes('"') || /[\r\n]/.test(metin)) {
    return `"${metin.replaceAll('"', '""')}"`;
  }
  return metin;
}

export function csvUret<T>(
  kolonlar: readonly Kolon<T>[],
  satirlar: readonly T[],
): string {
  const baslik = kolonlar.map((k) => hucreyiKacir(k.baslik)).join(AYIRICI);
  const govde = satirlar.map((s) =>
    kolonlar.map((k) => hucreyiKacir(k.ham(s))).join(AYIRICI),
  );
  return BOM + [baslik, ...govde].join('\r\n');
}

/** Tarayıcıda dosya indirir. Sunucuya istek atmaz — veri zaten ekrandadır. */
export function csvIndir<T>(
  dosyaAdi: string,
  kolonlar: readonly Kolon<T>[],
  satirlar: readonly T[],
): void {
  const icerik = csvUret(kolonlar, satirlar);
  const blob = new Blob([icerik], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const bag = document.createElement('a');
  bag.href = url;
  bag.download = `${dosyaAdi}.csv`;
  bag.click();
  URL.revokeObjectURL(url);
}
