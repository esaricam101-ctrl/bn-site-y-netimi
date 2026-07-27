/**
 * Bagimsiz bolum — 634 sayili Kat Mulkiyeti Kanunu.
 *
 * Borc bagimsiz bolume baglanir, kisiye degil (ADR v1.1 §5).
 * Kiraci degisimi hicbir kosulda borcu ortadan kaldirmaz veya sahipsiz birakmaz.
 */
import type { TenantId } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';
import { kesirleriTopla, kesirOrani, tamiEdiyorMu } from '../kesir.js';

export type BolumNiteligi = 'MESKEN' | 'ISYERI' | 'DEPO' | 'OTOPARK' | 'ORTAK_ALAN';

/**
 * Bolumun fiili kullanim durumu. `nitelik` tapudaki hukuki vasiftir ve
 * degismez; `durum` gunluk isletmedir ve degisir. Ikisi karistirilmamalidir:
 * mesken nitelikli bir bolum BOS olabilir.
 */
export type BolumDurumu = 'AKTIF' | 'BOS' | 'TADILATTA' | 'KULLANIM_DISI';

/**
 * Daire tipi. Serbest metin degil, raporlanabilir olsun diye sayilabilir.
 *
 * Degerler tanimlayici olmak zorundadir ('1+1' bir enum adi olamaz); kullaniciya
 * gosterilen bicim `DAIRE_TIPI_ETIKETLERI` uzerinden cozulur — i18n katmani da
 * bu haritayi kullanir (BFS v1 §40 · CT-05).
 */
export type DaireTipi =
  | 'STUDYO' | 'BIR_SIFIR' | 'BIR_BIR' | 'IKI_BIR' | 'UC_BIR'
  | 'DORT_BIR' | 'BES_BIR' | 'DUBLEKS' | 'DIGER';

export const DAIRE_TIPI_ETIKETLERI: Readonly<Record<DaireTipi, string>> = {
  STUDYO: 'Stüdyo',
  BIR_SIFIR: '1+0',
  BIR_BIR: '1+1',
  IKI_BIR: '2+1',
  UC_BIR: '3+1',
  DORT_BIR: '4+1',
  BES_BIR: '5+1',
  DUBLEKS: 'Dubleks',
  DIGER: 'Diğer',
};

/** Tapu kaydi — bolumun hukuki kimligi. */
export interface TapuBilgisi {
  readonly ada: string | null;
  readonly parsel: string | null;
  readonly pafta: string | null;
  /** Tapudaki bagimsiz bolum numarasi; kapi numarasindan FARKLI olabilir. */
  readonly bagimsizBolumNo: string | null;
  readonly cilt: string | null;
  readonly sahife: string | null;
}

export interface BagimsizBolumOzellikleri {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly blokId: string | null;
  readonly katId: string | null;
  readonly kapiNo: string;
  /** Bina disindan gorunen kapi no ile daire ici numara farkli olabilir. */
  readonly icKapiNo: string | null;
  readonly kat: number;
  readonly nitelik: BolumNiteligi;
  readonly daireTipi: DaireTipi | null;
  /** Serbest metin: 'konut', 'muayenehane', 'depo' gibi fiili kullanim amaci. */
  readonly kullanimAmaci: string | null;
  readonly durum: BolumDurumu;
  readonly brutM2: number;
  readonly netM2: number;
  /** Arsa payi pay/payda olarak tutulur — ondalik yuvarlama hatasi olmasin. */
  readonly arsaPayiPay: bigint;
  readonly arsaPayiPayda: bigint;
  readonly aidatMuafiyeti: boolean;
  readonly tapu: TapuBilgisi;
}

/** Arsa payi agirliklarinin normalize edildigi olcek. */
export const ARSA_PAYI_OLCEGI = 1_000_000n;

export class BagimsizBolum {
  private constructor(private readonly o: BagimsizBolumOzellikleri) {}

  static olustur(o: BagimsizBolumOzellikleri): BagimsizBolum {
    if (!o.kapiNo.trim()) throw new DogrulamaHatasi('Kapi no zorunludur.');
    if (o.brutM2 <= 0) throw new DogrulamaHatasi('Brut m2 sifirdan buyuk olmalidir.');
    if (o.netM2 <= 0) throw new DogrulamaHatasi('Net m2 sifirdan buyuk olmalidir.');
    if (o.netM2 > o.brutM2) {
      throw new DogrulamaHatasi(
        `Net m2 (${o.netM2}) brut m2'den (${o.brutM2}) buyuk olamaz.`,
        'Olculeri kontrol edin.',
      );
    }
    if (o.arsaPayiPayda <= 0n) throw new DogrulamaHatasi('Arsa payi paydasi sifirdan buyuk olmalidir.');
    if (o.arsaPayiPay < 0n) throw new DogrulamaHatasi('Arsa payi negatif olamaz.');
    if (o.arsaPayiPay > o.arsaPayiPayda) {
      throw new DogrulamaHatasi('Arsa payi paydadan buyuk olamaz.');
    }
    return new BagimsizBolum(o);
  }

  get id(): string { return this.o.id; }
  get tenantId(): TenantId { return this.o.tenantId; }
  get kapiNo(): string { return this.o.kapiNo; }
  get nitelik(): BolumNiteligi { return this.o.nitelik; }
  get durum(): BolumDurumu { return this.o.durum; }
  get brutM2(): number { return this.o.brutM2; }
  get netM2(): number { return this.o.netM2; }
  get tapu(): TapuBilgisi { return this.o.tapu; }

  /**
   * Aidat disi kalir mi.
   *
   * Muafiyet ile KULLANIM_DISI ayri gerekcelerdir ama sonucu aynidir: bolum
   * dagitima girmez. Bunu tek yerde toplamak, paylastirma tarafinin iki ayri
   * bayragi kontrol etmeyi unutmasini engeller.
   */
  get aidatMuafiyeti(): boolean {
    return this.o.aidatMuafiyeti || this.o.durum === 'KULLANIM_DISI';
  }

  /** Paylasim agirligi — payda ARSA_PAYI_OLCEGI'ne normalize edilir. */
  arsaPayiAgirligi(): bigint {
    return (this.o.arsaPayiPay * ARSA_PAYI_OLCEGI) / this.o.arsaPayiPayda;
  }

  /** Brut m2 agirligi. `METREKARE` ve `BRUT_M2` kurallarinin ikisi de bunu kullanir. */
  metrekareAgirligi(): bigint {
    return BigInt(Math.round(this.o.brutM2 * 100));
  }

  netMetrekareAgirligi(): bigint {
    return BigInt(Math.round(this.o.netM2 * 100));
  }

  anlik(): BagimsizBolumOzellikleri { return this.o; }
}

/**
 * KMK md. 3: arsa paylarinin toplami tami eder.
 * Toplam 1'den sapiyorsa yonetim plani hatalidir ve tahakkuk calistirilamaz.
 */
export interface ArsaPayiDogrulamasi {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
}

export function arsaPaylariniDogrula(
  bolumler: readonly BagimsizBolum[],
): ArsaPayiDogrulamasi {
  // Olcekli tam sayilari toplamak 1/3 gibi paylarda daima eksik verir
  // (333333 x 3 = 999999) ve KMK md. 3 kurali hicbir zaman saglanmaz.
  // Kesirli toplam kayipsizdir — ayni gerekce hisse dogrulamasinda da gecerli.
  const toplamKesir = kesirleriTopla(
    bolumler.map((b) => {
      const o = b.anlik();
      return { pay: o.arsaPayiPay, payda: o.arsaPayiPayda };
    }),
  );
  const gecerli = tamiEdiyorMu(toplamKesir);
  const oran = kesirOrani(toplamKesir);
  return {
    gecerli,
    toplam: oran.toFixed(6),
    mesaj: gecerli
      ? 'Arsa paylari toplami tami ediyor.'
      : `Arsa paylari toplami 1 degil (${oran.toFixed(6)}). KMK md. 3 uyarinca toplam ` +
        `tami etmelidir; yonetim plani kontrol edilmelidir.`,
  };
}
