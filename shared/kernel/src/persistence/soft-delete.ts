/**
 * Silme standardı — ADR v1.1 §33 · BFS v1 §5
 *
 * Üç sınıf, üç davranış:
 *   FINANSAL   → asla silinmez, düzeltme ters kayıtla (storno)
 *   ANA_VERI   → soft delete
 *   BELGE      → versiyon + arşiv, üzerine yazılmaz
 *
 * ⚠️ Soft delete, KVKK silme hakkını KARŞILAMAZ.
 * Üç işlem birbirinden ayrıdır: soft delete ≠ hard delete ≠ anonimleştirme.
 */

export type SilmeSinifi = 'FINANSAL' | 'ANA_VERI' | 'BELGE';

/** Soft delete taşıyan her tablonun standart alanları (BFS v1 §5.2). */
export interface SoftDeleteAlanlari {
  readonly silindiMi: boolean;
  readonly silinmeTarihi: Date | null;
  readonly silenKullanici: string | null;
  readonly silmeGerekcesi: string | null;
}

export class SilmePolitikaHatasi extends Error {
  override readonly name = 'SilmePolitikaHatasi';
}

/**
 * Silinebilirlik politikası VERİ olarak tanımlanır, koda gömülmez (§33 kural 3).
 * Örnek: açık borcu olan bağımsız bölüm soft-delete edilemez.
 */
export interface SilinebilirlikPolitikasi {
  readonly varlik: string;
  readonly sinif: SilmeSinifi;
  /** Silmeyi engelleyen bağımlılıklar. Boş dizi = kısıtsız. */
  readonly engelleyenBagimliliklar: readonly {
    readonly aciklama: string;
    readonly kontrol: string; // BRE kural kimliği
  }[];
}

export function silmeyiDogrula(
  politika: SilinebilirlikPolitikasi,
  gerekce: string | null,
): void {
  if (politika.sinif === 'FINANSAL') {
    throw new SilmePolitikaHatasi(
      `'${politika.varlik}' finansal kayıttır ve silinemez (ADR v1.1 §33). ` +
        `Düzeltme ters kayıtla (storno) yapılır.`,
    );
  }
  if (politika.sinif === 'BELGE') {
    throw new SilmePolitikaHatasi(
      `'${politika.varlik}' belgedir; silinmez, yeni sürüm oluşturulur (ADR v1.1 §33).`,
    );
  }
  if (!gerekce || gerekce.trim().length < 10) {
    throw new SilmePolitikaHatasi(
      `Silme gerekçesi zorunludur ve en az 10 karakter olmalıdır.`,
    );
  }

  /*
   * ENGELLEYEN BAĞIMLILIKLAR ZORLANIR.
   *
   * ⚠️  Bu blok BAŞTA YOKTU: `engelleyenBagimliliklar` arayüzde tanımlıydı,
   *     çağıranlar dolduruyordu ama fonksiyon HİÇ OKUMUYORDU. Sonuç: dört
   *     ayrı modülde (`Belge`, `DaireGorevlisi`, `Misafir`, `Hesap`) yazılmış
   *     "şu varsa silinemez" koruması SESSİZCE ETKİSİZDİ — hareket görmüş bir
   *     hesap arşivlenebiliyordu ve ona yazılmış yevmiye satırları sahipsiz
   *     kalıyordu.
   *
   *     Kusur canlı testte yakalandı ("hareket gormus hesap arsivlenemez"
   *     beklenen 422 yerine 200 döndü). Arayüzde duran ama okunmayan bir alan,
   *     çağıranı korunduğuna inandırdığı için yokluğundan daha tehlikelidir.
   */
  if (politika.engelleyenBagimliliklar.length > 0) {
    const liste = politika.engelleyenBagimliliklar
      .map((b) => `${b.aciklama} (${b.kontrol})`)
      .join(' · ');
    throw new SilmePolitikaHatasi(
      `'${politika.varlik}' silinemez — engelleyen bağımlılıklar: ${liste}`,
    );
  }
}

/**
 * Kısmi unique index SQL'i (§33 kural 1).
 *
 * Bu kural atlanırsa silinen "A-3 dairesi", yeni "A-3" oluşturulmasını KALICI
 * olarak engeller. Migration şablonunda zorunludur.
 */
export function kismiUniqueIndex(tablo: string, alanlar: readonly string[]): string {
  const kolonlar = ['tenant_id', ...alanlar].join(', ');
  return (
    `CREATE UNIQUE INDEX ${tablo}_${alanlar.join('_')}_uq ` +
    `ON ${tablo} (${kolonlar}) WHERE silinme_tarihi IS NULL;`
  );
}
