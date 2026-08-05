/**
 * SORUMLULUK ZINCIRINE PAY DAGITIMI (ADR-0018 · K1 · K5).
 *
 * ⚠️  NEDEN AYRI MODUL: bu mantik `tahakkuk.command.service.ts` icinde bir
 *     servis metodunun ortasinda, `tx` bagimli bir dongude duruyordu. Orada
 *     kaldigi surece HER KANIT VERITABANI GEREKTIRIYORDU: `750` iddiasini
 *     kuran bir test yazmak icin tenant, bolum, malik, kiraci ve gider turu
 *     fiksturu kurmak gerekiyordu.
 *
 *     `borcSorumlulariniCoz` bu isi YAPMIYOR — `pay` uretmez, yalnizca
 *     `{ kisiId, sira, rol, cozumlemeTarihi }` doner. Yani zincir
 *     fonksiyonunu cagiran bir test, pay dagitimini SINAMIS OLMAZ.
 *
 * ⚠️  BU MODUL `tx` GORMEZ. Sinir bilinclidir:
 *       serviste kalir  → sorgu, donem suzgeci, kayitlarin toplanmasi
 *       buraya gelir    → zincir + hisse kayitlari + tutar → pay'li zincir
 *
 * ⛔ TARIH SUZGECI BURADA TEKRARLANMAZ. `donemHisseleri` SUZULMUS gelir.
 *    Suzgeci burada da yazmak, ADR-0018 §2.5'te curutulen "iki nufus"
 *    kusurunun ikinci bir kopyasini uretirdi: ayni olcut iki yerde durur,
 *    biri degisince oteki sessizce ayrisir.
 */
import { IsKuraliIhlali } from '@bnos/core-domain';
import type { Money } from '@bnos/kernel';
import { malikBorcunuBol, type MalikHissesi, type MalikPaylasimi } from '../malik/malik.js';
import type { BorcSorumlusu } from './borc-sorumlusu.js';

/** Zincir satiri + o satira dusen tutar. */
export interface PayliSorumlu extends BorcSorumlusu {
  readonly pay: Money;
  /** Dagitimda kullanilan agirlik — hisse orani ya da 1. */
  readonly agirlik: bigint;
}

/** Hata mesajlarinin insan tarafini besleyen VERI — davranisin parcasi degil. */
export interface PayEtiketleri {
  readonly kapiNo: string;
  readonly kisiAdi: ReadonlyMap<string, string>;
}

/**
 * Zincirdeki her satira dusen tutari hesaplar.
 *
 * ★ SEMANTIK: `PAYINA_GORE` (ADR-0018 · K1 varsayilani). Malik satirlari
 *   hisselerine gore boluser; kiraci ve sakin hisse tasimaz, borcun
 *   TAMAMINI yuklenir.
 *
 * ★ SEMANTIK HER MALIK KATMANINDA AYNIDIR (K5) — `ASIL` ya da `IKINCIL`
 *   fark etmez. Bir malik bir katmanda payina gore, otekinde muteselsil
 *   olamaz; ayni hukuki soru, iki yer.
 *
 *   ⚠️  ESKIDEN DEGILDI: bolusum yalnizca `sira === 'ASIL'` satirlarina
 *       uygulaniyor, IKINCIL malikler HER DURUMDA tam tutar aliyordu.
 */
export function zincireDagit(
  tutar: Money,
  zincir: readonly BorcSorumlusu[],
  donemHisseleri: readonly MalikHissesi[],
  malikPaylasimi: MalikPaylasimi,
  etiket: PayEtiketleri,
): readonly PayliSorumlu[] {
  const zincirMalikleri = zincir.filter((s) => s.rol === 'MALIK');

  /*
   * ⚠️  BU BIR KORUMA DEGIL, YAPISAL DEGISMEZ IDDIASIDIR (ADR-0018 §2.5).
   *
   *     Cagiran taraf iki kumeyi de AYNI `malik` kayitlarindan ve AYNI
   *     tarih yuklemiyle turetiyor; yani bu dal BUGUN tetiklenemez.
   *
   *     ⛔ YESIL TEST LISTESINDE GORUNMEDIGI ICIN "kanitlanmis" SAYILMAZ.
   *        Testi yoktur cunku ulasilamaz; uydurma bir test yazmak onu
   *        kanitlanmis gosterirdi.
   *
   *     Duruyor cunku hisse kaynagi ayristiginda (tapu entegrasyonu)
   *     esitlik garantisi kalkar ve o gun sessiz YANLIS HESAP dogar.
   *
   *     ⚠️  ESKI KOSUL BUNU KARSILASTIRMIYORDU: `donemHisseleri.length ===
   *         asillar.length` IKI FARKLI NUFUSU olcuyordu (`asillar`
   *         KULLANANA_AIT'te KIRACIYI sayar). Kiracili bolumde 1 != 2
   *         oldugu icin bolusum HIC calismiyordu.
   */
  const malikKimlikleri = new Set(zincirMalikleri.map((s) => s.kisiId));
  const hisseKimlikleri = new Set(donemHisseleri.map((h) => h.kisiId));
  const eksik = [...malikKimlikleri].filter((k) => !hisseKimlikleri.has(k));
  const fazla = [...hisseKimlikleri].filter((k) => !malikKimlikleri.has(k));

  if (eksik.length > 0 || fazla.length > 0) {
    const ad = (k: string): string => etiket.kisiAdi.get(k) ?? k;
    throw new IsKuraliIhlali(
      `${etiket.kapiNo} nolu bölümde malik kayıtları ile tapu hisseleri `
        + 'örtüşmüyor; borç kime ne kadar yazılacağı belirsiz.',
      [
        eksik.length > 0
          ? `Hisse kaydı OLMAYAN malik: ${eksik.map(ad).join(', ')}.`
          : '',
        fazla.length > 0
          ? `Malik kaydı OLMAYAN hisse: ${fazla.map(ad).join(', ')}.`
          : '',
        'Tapu ve malik kayıtlarını eşitleyip tahakkuku tekrar çalıştırın.',
      ].filter((x) => x !== '').join(' '),
    );
  }

  // Kimlik → pay. Tek malikte de calisir: `malikBorcunuBol` tutarin
  // tamamini o malike verir.
  const malikPaylari = new Map<string, { tutar: Money; agirlik: bigint }>();
  if (donemHisseleri.length > 0) {
    for (const b of malikBorcunuBol(tutar, donemHisseleri, malikPaylasimi)) {
      malikPaylari.set(b.kisiId, { tutar: b.tutar, agirlik: b.agirlik });
    }
  }

  return zincir.map((s) => {
    // Malik satiri payini alir — SIRASI FARK ETMEZ (K5). Kiraci/sakin
    // hisse tasimaz; borcun tamamindan sorumludur.
    const malikPayi = s.rol === 'MALIK' ? malikPaylari.get(s.kisiId) : undefined;
    return {
      ...s,
      pay: malikPayi?.tutar ?? tutar,
      agirlik: malikPayi?.agirlik ?? 1n,
    };
  });
}
