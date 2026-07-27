/**
 * Business Rules Engine — AI yurutme sirasinin UCUNCU adimi (ADR-0004).
 *
 * BRE URETIMDEN ONCE calisir. Bir kurali ihlal eden oneri HIC URETILMEZ;
 * uretildikten sonra bastirilmaz. Kurallar prompt icinde yeniden yazilmaz.
 */
import type { TenantId } from '@bnos/kernel';

export interface KuralDegerlendirmesi {
  readonly izinliMi: boolean;
  readonly engelleyenKurallar: readonly { readonly kod: string; readonly mesaj: string }[];
  /** Ajan'in secebilecegi eylem uzayi — kurallarla daraltilmis hali. */
  readonly izinliEylemler: readonly string[];
}

export interface KuralBaglami {
  readonly tenantId: TenantId;
  readonly istenenEylemler: readonly string[];
  readonly olgular: Readonly<Record<string, unknown>>;
}

export interface IBusinessRulesEngine {
  degerlendir(baglam: KuralBaglami): Promise<KuralDegerlendirmesi>;
}
