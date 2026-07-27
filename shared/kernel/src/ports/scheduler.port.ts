/**
 * IScheduler — ADR v1.1 §36 · BFS v1 §9 · AIS v1 §6
 *
 * v1 uygulaması: BullMQ üzerinde Redis.
 *
 * Altı kural:
 *  1. Dönem başına en fazla bir kez — UNIQUE (is, tenant, donem_anahtari)
 *  2. Çok örnekli çalışmaya güvenli — dağıtık kilit zorunlu
 *  3. Tenant saat dilimine duyarlı
 *  4. Finansal işler geç çalıştırılır, ASLA atlanmaz
 *  5. Başarısız çalıştırma sessiz kalamaz
 *  6. Her finansal iş için manuel tetikleme ve KURU ÇALIŞTIRMA bulunur
 */
import type { TenantId } from '../tenant/tenant-context.js';

export type KacirilanCalistirmaPolitikasi = 'GEC_CALISTIR' | 'ATLA';
export type IsCalistirmaDurumu = 'BEKLIYOR' | 'CALISIYOR' | 'BASARILI' | 'BASARISIZ';

export interface ZamanlanmisIsTanimi {
  readonly kod: string;
  readonly cron: string;
  readonly tenantKapsami: 'TUM_TENANTLAR' | readonly TenantId[];
  /** Finansal işler için daima GEC_CALISTIR (§36 kural 4). */
  readonly kacirilanCalistirmaPolitikasi: KacirilanCalistirmaPolitikasi;
  readonly yenidenDeneme: { readonly deneme: number; readonly geriCekilmeMs: number };
  readonly sahip: string;
  readonly finansalMi: boolean;
}

export interface IsCalistirma {
  readonly id: string;
  readonly isKodu: string;
  readonly tenantId: TenantId;
  /** UNIQUE (isKodu, tenantId, donemAnahtari) — veritabanı düzeyinde zorlanır. */
  readonly donemAnahtari: string;
  readonly durum: IsCalistirmaDurumu;
  readonly baslangic: Date | null;
  readonly bitis: Date | null;
  readonly sonuc: Readonly<Record<string, unknown>> | null;
  readonly hata: string | null;
}

export interface IsCalistirmaSonucu {
  readonly calistirma: IsCalistirma;
  /** Kuru çalıştırmada hiçbir kayıt yazılmaz; yalnızca sonuç önizlenir. */
  readonly kuruCalistirma: boolean;
  readonly onizleme?: Readonly<Record<string, unknown>>;
}

export interface IScheduler {
  kaydet(is: ZamanlanmisIsTanimi): Promise<void>;
  tetikle(
    kod: string,
    tenantId: TenantId,
    donemAnahtari: string,
    kuruCalistirma: boolean,
  ): Promise<IsCalistirmaSonucu>;
  durdur(kod: string): Promise<void>;
  calistirmalar(kod: string, tenantId: TenantId): Promise<readonly IsCalistirma[]>;
}
