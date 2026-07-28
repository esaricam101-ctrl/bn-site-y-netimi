/**
 * Evcil hayvan kaydi — KMK md. 18.
 *
 * KMK md. 18: kat malikleri birbirini rahatsiz etmemek, hakkini kullanirken
 * iyiniyet kurallarina uymakla YUKUMLUDUR. Kanun evcil hayvani yasaklamaz;
 * YONETIM PLANI sinirlama getirebilir ve genel kurul karar alabilir.
 *
 * Bu yuzden izin durumu KODA GOMULMEZ: hangi turun serbest, hangisinin izinli
 * ya da yasak oldugu tenant verisidir (`EvcilHayvanPolitikasi`).
 */
import type { TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type HayvanTuru = 'KEDI' | 'KOPEK' | 'KUS' | 'KEMIRGEN' | 'BALIK' | 'SURUNGEN' | 'DIGER';

/** Yonetim plani ya da genel kurul kararinin bir tur icin ongordugu durum. */
export type IzinDurumu = 'SERBEST' | 'IZINLE' | 'YASAK';

export interface EvcilHayvanPolitikasi {
  readonly tur: HayvanTuru;
  readonly durum: IzinDurumu;
  /** YASAK ve IZINLE icin kaynak zorunludur — kural nereden geliyor. */
  readonly kaynakReferansi: string | null;
  /** Kilo siniri gibi ek kosul. Serbest metin; karar metninden gelir. */
  readonly kosul: string | null;
}

export interface EvcilHayvan {
  readonly id: string;
  readonly bolumId: string;
  /** Sorumlu kisi — malik, kiraci ya da sakin olabilir. */
  readonly kisiId: string;
  readonly tur: HayvanTuru;
  readonly ad: string;
  readonly cins: string | null;
  readonly dogumYili: number | null;
  /** Kuduz asisi son tarihi. Kopek ve kedide mevzuat geregi takip edilir. */
  readonly asiGecerlilikTarihi: TakvimTarihi | null;
  /** Kupe/mikrocip numarasi. */
  readonly kimlikNo: string | null;
  readonly baslangic: TakvimTarihi;
  readonly bitis: TakvimTarihi | null;
  /** IZINLE durumundaki turler icin yonetim onayi. */
  readonly onaylandiMi: boolean;
  readonly onayReferansi: string | null;
}

/** Politika listesinde tur icin kaydi bulur; yoksa SERBEST varsayilir. */
export function turPolitikasi(
  politikalar: readonly EvcilHayvanPolitikasi[],
  tur: HayvanTuru,
): EvcilHayvanPolitikasi {
  return (
    politikalar.find((p) => p.tur === tur) ?? {
      tur, durum: 'SERBEST', kaynakReferansi: null, kosul: null,
    }
  );
}

export function politikayiDogrula(p: EvcilHayvanPolitikasi): readonly string[] {
  const hatalar: string[] = [];
  if (p.durum !== 'SERBEST' && !p.kaynakReferansi) {
    hatalar.push(
      `'${p.tur}' icin ${p.durum} durumu kaynak referansi tasimalidir ` +
        '(yonetim plani maddesi veya genel kurul karar no). KMK md. 18 uyarinca ' +
        'sinirlama belgeye dayanmalidir.',
    );
  }
  return hatalar;
}

export interface KayitDegerlendirmesi {
  readonly kabul: boolean;
  readonly onayGerekiyorMu: boolean;
  readonly mesaj: string;
}

/**
 * Kaydin politikaya uygun olup olmadigini degerlendirir.
 *
 * YASAK turu REDDETMEZ, `kabul: false` ile bildirir: karar yoneticinin ve
 * gerekirse genel kurulundur. Sistemin isi kurali gorunur kilmaktir —
 * sessizce kaydetmek de sessizce silmek kadar yanlistir.
 */
export function kaydiDegerlendir(
  politikalar: readonly EvcilHayvanPolitikasi[],
  hayvan: EvcilHayvan,
): KayitDegerlendirmesi {
  if (hayvan.bitis !== null && hayvan.bitis < hayvan.baslangic) {
    throw new DogrulamaHatasi(
      `Kaydin bitisi (${hayvan.bitis}) baslangictan (${hayvan.baslangic}) once olamaz.`,
    );
  }

  const p = turPolitikasi(politikalar, hayvan.tur);
  const kaynak = p.kaynakReferansi === null ? '' : ` (${p.kaynakReferansi})`;

  switch (p.durum) {
    case 'YASAK':
      return {
        kabul: false, onayGerekiyorMu: false,
        mesaj: `'${hayvan.tur}' turu yonetim planinda yasaklanmis${kaynak}. ` +
          'Kayit yalnizca genel kurul karariyla acilabilir.',
      };
    case 'IZINLE':
      return {
        kabul: hayvan.onaylandiMi,
        onayGerekiyorMu: !hayvan.onaylandiMi,
        mesaj: hayvan.onaylandiMi
          ? `Kayit onayli${hayvan.onayReferansi === null ? '' : ` (${hayvan.onayReferansi})`}.`
          : `'${hayvan.tur}' turu yonetim onayi gerektiriyor${kaynak}.` +
            (p.kosul === null ? '' : ` Kosul: ${p.kosul}`),
      };
    case 'SERBEST':
      return {
        kabul: true, onayGerekiyorMu: false,
        mesaj: p.kosul === null ? 'Kayit serbest.' : `Kayit serbest. Kosul: ${p.kosul}`,
      };
  }
}

/** Asi gecerliligi dolmus mu — kopek ve kedide mevzuat geregi takip edilir. */
export function asiGecerliMi(hayvan: EvcilHayvan, bugun: TakvimTarihi): boolean {
  if (hayvan.asiGecerlilikTarihi === null) return false;
  return hayvan.asiGecerlilikTarihi >= bugun;
}
