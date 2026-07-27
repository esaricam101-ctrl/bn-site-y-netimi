/**
 * Numaralandirma motoru — ADR v1.1 §35 · BFS v1 §8
 *
 * Kritik ayrim: her numara bosluksuz olmak zorunda DEGILDIR.
 *   BOSLUKSUZ -> sayac tablosu + advisory lock, kaydin transaction'i icinde.
 *                PostgreSQL SEQUENCE KULLANILMAZ (rollback'te bosluk birakir).
 *   BOSLUKLU  -> PostgreSQL SEQUENCE. Cok daha hizli, kilitsiz.
 *
 * Bu dosya bicimlendirme ve katalog kurallarini tutar; tahsis altyapi
 * katmanindadir (domain framework ve kalicilik bagimsizdir — BFS v1 §1.3).
 */
import { DogrulamaHatasi } from '../errors/domain-error.js';

export type SeriTipi = 'BOSLUKSUZ' | 'BOSLUKLU';
export type SeriKapsami = 'TENANT' | 'TENANT_YIL' | 'TENANT_TIP';
export type Sifirlama = 'YOK' | 'YILLIK';

export interface NumaraSerisiTanimi {
  readonly kod: string;
  readonly kapsam: SeriKapsami;
  /** Ornek: "{onek}-{yil}-{sira:6}" */
  readonly formatSablonu: string;
  readonly onek: string;
  readonly sifirlama: Sifirlama;
  readonly tip: SeriTipi;
  /** BOSLUKSUZ ise zorunlu — DoD maddesi (BFS v1 §15). */
  readonly bosluksuzGerekce: string | null;
}

/** v1 seri katalogu. Her yeni seri buraya kaydedilir (DoD). */
export const SERI_KATALOGU: readonly NumaraSerisiTanimi[] = [
  { kod: 'MAKBUZ', kapsam: 'TENANT_YIL', formatSablonu: '{onek}-{yil}-{sira:6}', onek: 'MKB', sifirlama: 'YILLIK', tip: 'BOSLUKSUZ', bosluksuzGerekce: 'Yasal zorunluluk — makbuz serisi bosluk kaldirmaz.' },
  { kod: 'KARAR', kapsam: 'TENANT_YIL', formatSablonu: '{onek}-{yil}-{sira:4}', onek: 'KRR', sifirlama: 'YILLIK', tip: 'BOSLUKSUZ', bosluksuzGerekce: 'Karar defteri butunlugu (ADR v1.1 §15).' },
  { kod: 'TAHAKKUK', kapsam: 'TENANT_YIL', formatSablonu: '{onek}-{yil}-{sira:6}', onek: 'THK', sifirlama: 'YILLIK', tip: 'BOSLUKSUZ', bosluksuzGerekce: 'Mali denetim izi.' },
  { kod: 'YEVMIYE', kapsam: 'TENANT_YIL', formatSablonu: '{onek}-{yil}-{sira:6}', onek: 'YEV', sifirlama: 'YILLIK', tip: 'BOSLUKSUZ', bosluksuzGerekce: 'Defter butunlugu (ADR-0003).' },
  { kod: 'TALEP', kapsam: 'TENANT_YIL', formatSablonu: '{onek}-{yil}-{sira:6}', onek: 'TLP', sifirlama: 'YILLIK', tip: 'BOSLUKLU', bosluksuzGerekce: null },
  { kod: 'BELGE', kapsam: 'TENANT', formatSablonu: '{onek}-{sira:8}', onek: 'BLG', sifirlama: 'YOK', tip: 'BOSLUKLU', bosluksuzGerekce: null },
  { kod: 'IS_EMRI', kapsam: 'TENANT_YIL', formatSablonu: '{onek}-{yil}-{sira:6}', onek: 'IEM', sifirlama: 'YILLIK', tip: 'BOSLUKLU', bosluksuzGerekce: null },
];

const KATALOG = new Map(SERI_KATALOGU.map((s) => [s.kod, s]));

export function seriTanimi(kod: string): NumaraSerisiTanimi {
  const t = KATALOG.get(kod);
  if (!t) {
    throw new DogrulamaHatasi(
      `Numara serisi katalogda yok: '${kod}'. SERI_KATALOGU'na ekleyin (BFS v1 §8).`,
    );
  }
  return t;
}

/** BOSLUKSUZ seri gerekce tasimak zorundadir — DoD dogrulamasi. */
export function katalogDogrula(): readonly string[] {
  const hatalar: string[] = [];
  for (const s of SERI_KATALOGU) {
    if (s.tip === 'BOSLUKSUZ' && !s.bosluksuzGerekce) {
      hatalar.push(`${s.kod}: BOSLUKSUZ seri gerekce tasimalidir (ADR v1.1 §35).`);
    }
    if (s.tip === 'BOSLUKLU' && s.bosluksuzGerekce) {
      hatalar.push(`${s.kod}: BOSLUKLU seride bosluksuz gerekcesi olmamalidir.`);
    }
  }
  return hatalar;
}

const YER_TUTUCU = /\{(onek|yil|tip|sira)(?::(\d+))?\}/g;

export interface BicimlendirmeBaglami {
  readonly yil: number;
  readonly sira: number;
  readonly tip?: string;
}

export function numaraBicimlendir(
  tanim: NumaraSerisiTanimi,
  baglam: BicimlendirmeBaglami,
): string {
  return tanim.formatSablonu.replace(YER_TUTUCU, (_t, ad: string, genislik?: string) => {
    switch (ad) {
      case 'onek': return tanim.onek;
      case 'yil': return String(baglam.yil);
      case 'tip': return baglam.tip ?? '';
      case 'sira': {
        const s = String(baglam.sira);
        return genislik ? s.padStart(Number(genislik), '0') : s;
      }
      default: return '';
    }
  });
}

/** Sayac anahtari — kapsama gore. Advisory lock bu anahtar uzerinden alinir. */
export function sayacAnahtari(
  tanim: NumaraSerisiTanimi,
  tenantId: string,
  yil: number,
  tip?: string,
): string {
  switch (tanim.kapsam) {
    case 'TENANT': return `${tenantId}:${tanim.kod}`;
    case 'TENANT_YIL': return `${tenantId}:${tanim.kod}:${yil}`;
    case 'TENANT_TIP': return `${tenantId}:${tanim.kod}:${tip ?? 'GENEL'}`;
  }
}
