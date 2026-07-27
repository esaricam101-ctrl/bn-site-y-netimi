/**
 * ISearchProvider — ADR v1.1 §38 · AIS v1 §5
 *
 * SÖZCÜK TABANLI aramadır. Anlamsal/vektör arama Enterprise Memory'nin
 * sorumluluğudur (IMemoryQueryService). İkisi karıştırılmaz, ikisi ayrı
 * sistem olarak da kurulmaz (ADR-0004).
 *
 * v1 adaptörü: PostgreSQL Full-Text Search (tsvector + GIN) — Sprint 9.
 * ⚠️ PostgreSQL varsayılan olarak Türkçe sözlük yapılandırması GETİRMEZ.
 *    unaccent + uygun yapılandırma Sprint 9'da kurulur ve DOĞRULANIR.
 */
import type { TenantId } from '../tenant/tenant-context.js';

export type AranabilirTip =
  | 'BELGE'
  | 'KARAR'
  | 'YONETIM_PLANI_MADDESI'
  | 'TALEP'
  | 'DUYURU';

export interface AranabilirDokuman {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly tip: AranabilirTip;
  readonly baslik: string;
  readonly icerik: string;
  /** Sorgu ANINDA filtrelenir, sonuç kümesi sonradan filtrelenmez. */
  readonly gerekliIzin: string;
  readonly ustveri: Readonly<Record<string, unknown>>;
  readonly guncellemeTarihi: Date;
}

export interface AramaSorgusu {
  readonly tenantId: TenantId;
  readonly metin: string;
  /**
   * Çağıran principal'ın etkin izin seti. Sorgunun PARÇASIDIR.
   *
   * ⚠️ Sonradan filtreleme sayfalamayı bozar ve toplam sonuç sayısı üzerinden
   * bilgi sızdırır: "42 sonuç bulundu" → 3 tanesini görebiliyorsun → 39 gizli
   * belgenin varlığını öğrendin.
   */
  readonly izinler: readonly string[];
  readonly tipler?: readonly AranabilirTip[];
  readonly filtreler?: Readonly<Record<string, unknown>>;
  readonly sayfalama: { readonly imlec?: string; readonly limit: number };
}

export interface AramaSonucu {
  readonly kayitlar: readonly {
    readonly id: string;
    readonly tip: AranabilirTip;
    readonly baslik: string;
    readonly parca: string;
    readonly skor: number;
  }[];
  readonly sonrakiImlec: string | null;
  /** Yalnızca izinli sonuçları sayar — sızıntı üretmez. */
  readonly toplam: number;
}

export interface ISearchProvider {
  indexle(dokuman: AranabilirDokuman): Promise<void>;
  topluIndexle(dokumanlar: readonly AranabilirDokuman[]): Promise<void>;
  sil(tenantId: TenantId, id: string): Promise<void>;
  ara(sorgu: AramaSorgusu): Promise<AramaSonucu>;
}
