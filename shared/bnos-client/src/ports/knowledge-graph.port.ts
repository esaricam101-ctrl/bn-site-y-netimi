/** Knowledge Graph — AI yurutme sirasinin IKINCI adimi (ADR-0004). */
import type { TenantId } from '@bnos/kernel';

export interface Dugum {
  readonly id: string;
  readonly tip: string;
  readonly etiket: string;
  readonly ozellikler: Readonly<Record<string, unknown>>;
}

export interface Iliski {
  readonly kaynak: string;
  readonly hedef: string;
  readonly tip: string;
}

export interface IKnowledgeGraph {
  varlikCozumle(tenantId: TenantId, metin: string): Promise<readonly Dugum[]>;
  iliskiGenislet(tenantId: TenantId, dugumId: string, derinlik: number): Promise<{
    readonly dugumler: readonly Dugum[];
    readonly iliskiler: readonly Iliski[];
  }>;
}
