/**
 * Yerel Business Rules Engine adaptoru.
 *
 * Kurallar VERI olarak tanimlanir, koda gomulmez. AI, kurallarin istemcisidir;
 * alternatifi degildir (ADR-0004).
 */
import type { IBusinessRulesEngine, KuralBaglami, KuralDegerlendirmesi } from '../ports/business-rules.port.js';

export interface KuralTanimi {
  readonly kod: string;
  readonly mesaj: string;
  readonly engelledigiEylemler: readonly string[];
  readonly kosul: (olgular: Readonly<Record<string, unknown>>) => boolean;
}

export const VARSAYILAN_KURALLAR: readonly KuralTanimi[] = [
  {
    kod: 'AI-001',
    mesaj: 'AI ajanlari kayit atamaz; oneri uretir ve adi gecen bir insan isler.',
    engelledigiEylemler: ['kayit.yaz', 'odeme.yurut', 'tahakkuk.isle'],
    kosul: (o) => o['principalTipi'] === 'AGENT',
  },
  {
    kod: 'AI-002',
    mesaj: 'Izin seti bos olan principal icin oneri uretilmez.',
    engelledigiEylemler: ['oneri.uret', 'okuma'],
    kosul: (o) => (o['izinSayisi'] as number) === 0,
  },
];

export class YerelBusinessRulesAdaptoru implements IBusinessRulesEngine {
  constructor(private readonly kurallar: readonly KuralTanimi[] = VARSAYILAN_KURALLAR) {}

  degerlendir(baglam: KuralBaglami): Promise<KuralDegerlendirmesi> {
    const engelleyen = this.kurallar.filter(
      (k) => k.kosul(baglam.olgular) &&
             k.engelledigiEylemler.some((e) => baglam.istenenEylemler.includes(e)),
    );
    const engellenen = new Set(engelleyen.flatMap((k) => k.engelledigiEylemler));
    const izinliEylemler = baglam.istenenEylemler.filter((e) => !engellenen.has(e));

    return Promise.resolve({
      izinliMi: engelleyen.length === 0,
      engelleyenKurallar: engelleyen.map((k) => ({ kod: k.kod, mesaj: k.mesaj })),
      izinliEylemler,
    });
  }
}
