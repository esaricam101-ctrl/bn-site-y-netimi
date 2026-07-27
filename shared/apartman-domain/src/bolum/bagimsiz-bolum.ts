/**
 * Bagimsiz bolum — 634 sayili Kat Mulkiyeti Kanunu.
 *
 * Borc bagimsiz bolume baglanir, kisiye degil (ADR v1.1 §5).
 * Kiraci degisimi hicbir kosulda borcu ortadan kaldirmaz veya sahipsiz birakmaz.
 */
import type { TenantId } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type BolumNiteligi = 'MESKEN' | 'ISYERI' | 'DEPO' | 'OTOPARK' | 'ORTAK_ALAN';

export interface BagimsizBolumOzellikleri {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly blokId: string | null;
  readonly kapiNo: string;
  readonly kat: number;
  readonly nitelik: BolumNiteligi;
  readonly brutM2: number;
  readonly netM2: number;
  /** Arsa payi pay/payda olarak tutulur — ondalik yuvarlama hatasi olmasin. */
  readonly arsaPayiPay: bigint;
  readonly arsaPayiPayda: bigint;
  readonly aidatMuafiyeti: boolean;
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
  get brutM2(): number { return this.o.brutM2; }
  get aidatMuafiyeti(): boolean { return this.o.aidatMuafiyeti; }

  /** Paylasim agirligi — payda ARSA_PAYI_OLCEGI'ne normalize edilir. */
  arsaPayiAgirligi(): bigint {
    return (this.o.arsaPayiPay * ARSA_PAYI_OLCEGI) / this.o.arsaPayiPayda;
  }

  metrekareAgirligi(): bigint {
    return BigInt(Math.round(this.o.brutM2 * 100));
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
  const toplam = bolumler.reduce((t, b) => t + b.arsaPayiAgirligi(), 0n);
  const gecerli = toplam === ARSA_PAYI_OLCEGI;
  const oran = Number(toplam) / Number(ARSA_PAYI_OLCEGI);
  return {
    gecerli,
    toplam: oran.toFixed(6),
    mesaj: gecerli
      ? 'Arsa paylari toplami tami ediyor.'
      : `Arsa paylari toplami 1 degil (${oran.toFixed(6)}). KMK md. 3 uyarinca toplam ` +
        `tami etmelidir; yonetim plani kontrol edilmelidir.`,
  };
}
