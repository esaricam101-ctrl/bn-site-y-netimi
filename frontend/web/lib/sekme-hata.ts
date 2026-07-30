/**
 * Sekme hata yönlendirmesi — saf mantık, React'ten AYRI.
 *
 * Bileşen dosyasında (`components/sekmeler.tsx`) durursa test edilemez: JSX
 * taşıyan bir modül `node --test` ile içe alınamaz. Buradaki iki fonksiyon,
 * sekmeli formların ASIL RİSKİNİ taşır — gizli sekmedeki hatanın doğru
 * sekmeye eşlenmesi — ve bu yüzden ayrı tutulur.
 */

/**
 * Bir sekmeye ait hata sayısı.
 *
 * `anahtarlar` bir ÖN EK listesidir: `plaka-0`, `plaka-1` gibi dizinli
 * anahtarlar `plaka` ön ekiyle yakalanır. Tam eşleşme aranırsa çoklu plaka
 * hataları hiçbir sekmeye sayılmaz ve rozet hiç görünmez.
 */
export function sekmeHataSayisi(
  hatalar: Readonly<Record<string, string>>,
  anahtarlar: readonly string[],
): number {
  return Object.keys(hatalar).filter((h) =>
    anahtarlar.some((a) => h === a || h.startsWith(`${a}-`)),
  ).length;
}

/** Sekme kimliği ve hata sayısı — `ilkHataliSekme` yalnızca bunları okur. */
export interface SekmeHataOzeti {
  readonly anahtar: string;
  readonly hataSayisi?: number;
}

/**
 * Hatalı İLK sekmenin anahtarı; hata yoksa `null`.
 *
 * Gönderim başarısız olduğunda çağıran taraf bunu etkin sekme yapar. Aksi
 * hâlde kullanıcı Kaydet'e basar, gizli sekmedeki hatayı göremez ve neden
 * kaydedilmediğini anlamaz.
 *
 * SIRA ÖNEMLİ: listedeki ilk hatalı sekme seçilir, en çok hatalı olan değil.
 * Kullanıcı formu baştan sona doldurur; ilk eksiğe göndermek onun okuma
 * yönünü izler.
 */
export function ilkHataliSekme(sekmeler: readonly SekmeHataOzeti[]): string | null {
  return sekmeler.find((s) => (s.hataSayisi ?? 0) > 0)?.anahtar ?? null;
}
