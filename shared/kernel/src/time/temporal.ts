/**
 * Zaman standardı — ADR v1.1 §34 · BFS v1 §4
 *
 * AN (instant) ile TAKVİM TARİHİ birbirine karıştırılmaz.
 * Vade tarihi timestamptz olarak saklanırsa saat dilimi sınırında bir gün kayar.
 * Gecikme faizi "kaç gün geçti" sorusunun cevabıdır — bir günlük kayma her
 * borçlunun faizini yanlış hesaplar ve HATA SESSİZDİR.
 *
 * Bu dosya, ayrımı tip düzeyinde zorlar: TakvimTarihi bir Date değildir,
 * dolayısıyla yanlışlıkla bir instant alanına atanamaz.
 */

/** Zaman içinde bir an. Veritabanında `timestamptz`, daima UTC. */
export type An = Date & { readonly __marka: 'An' };

/** Saat dilimsiz takvim tarihi. Veritabanında `DATE`. Biçim: YYYY-MM-DD. */
export type TakvimTarihi = string & { readonly __marka: 'TakvimTarihi' };

const ISO_TARIH = /^\d{4}-\d{2}-\d{2}$/;

export class ZamanStandardiHatasi extends Error {
  override readonly name = 'ZamanStandardiHatasi';
}

export const an = (deger: Date | string): An => new Date(deger) as An;

export const takvimTarihi = (deger: string): TakvimTarihi => {
  if (!ISO_TARIH.test(deger)) {
    throw new ZamanStandardiHatasi(
      `Takvim tarihi YYYY-MM-DD biçiminde olmalıdır: ${deger}. ` +
        `Saat bilgisi taşıyan bir değer takvim tarihi değildir (BFS v1 §4.1).`,
    );
  }
  return deger as TakvimTarihi;
};

/**
 * Bir anı, tenant takviminde hangi güne düştüğüne çevirir.
 * Gecikme günü hesabı UTC'de değil, TENANT TAKVİMİNDE yapılır.
 */
export function tenantTakvimGunu(nokta: An, saatDilimi: string): TakvimTarihi {
  const bicimlendirici = new Intl.DateTimeFormat('en-CA', {
    timeZone: saatDilimi,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return bicimlendirici.format(nokta) as TakvimTarihi;
}

/**
 * İki takvim tarihi arasındaki tam gün farkı.
 * Saat dilimi içermediği için kayma üretmez — §8 gecikme faizinin temelidir.
 */
export function gunFarki(baslangic: TakvimTarihi, bitis: TakvimTarihi): number {
  const GUN_MS = 86_400_000;
  return Math.round((Date.parse(`${bitis}T00:00:00Z`) - Date.parse(`${baslangic}T00:00:00Z`)) / GUN_MS);
}

/** Vade geçmiş mi — tenant takviminde değerlendirilir. */
export function gecikmeGunu(
  vade: TakvimTarihi,
  simdi: An,
  saatDilimi: string,
): number {
  const bugun = tenantTakvimGunu(simdi, saatDilimi);
  return Math.max(0, gunFarki(vade, bugun));
}

/** API çıktısı: ISO 8601, UTC, offset açık (BFS v1 §4.3). */
export const anApiBicimi = (nokta: An): string => nokta.toISOString();
