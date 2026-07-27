/**
 * Enterprise Memory — AI yurutme sirasinin ILK adimi (ADR-0004).
 * Anlamsal/vektor arama BURANIN sorumlulugudur; ayri sistem kurulmaz (§38).
 */
import type { TenantId } from '@bnos/kernel';

export interface BellekKaydi {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly tur: string;
  readonly icerik: string;
  readonly ustveri: Readonly<Record<string, unknown>>;
  readonly olusmaAni: Date;
}

export interface BellekSorgusu {
  readonly tenantId: TenantId;
  readonly metin: string;
  /** Cagiran principal'in izin seti — sorgunun PARCASIDIR, sonradan filtrelenmez. */
  readonly izinler: readonly string[];
  readonly limit: number;
}

export interface IMemoryQueryService {
  ara(sorgu: BellekSorgusu): Promise<readonly BellekKaydi[]>;
  baglamGetir(tenantId: TenantId, anahtar: string): Promise<BellekKaydi | null>;
}

export interface IMemoryCommandService {
  yaz(kayit: Omit<BellekKaydi, 'id'>): Promise<string>;
  sil(tenantId: TenantId, id: string): Promise<void>;
}
