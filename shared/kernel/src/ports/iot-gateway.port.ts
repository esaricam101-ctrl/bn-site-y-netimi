/**
 * IIoTGateway — ADR v1.1 §39 · AIS v1 §7
 *
 * v1 KAPSAMI: YALNIZCA PORT VE SINIR TANIMI. UYGULAMA YOK.
 *
 * Üç tasarım kısıtı şimdiden bağlayıcıdır:
 *  1. Telemetri ana ilişkisel tablolara YAZILMAZ. Yüksek hacimli zaman
 *     serisidir; ayrı bölümlenmiş depo veya TimescaleDB gerektirir.
 *     Sınır şimdi çizilir ki ileride "sayaç okumalarını Daire tablosuna
 *     ekleyelim" denmesin.
 *  2. Telemetri domain event üretir. Alarm ve kural tepkileri BRE üzerinden
 *     çalışır, IoT katmanına bağlanmaz.
 *  3. Cihaz kimliği kullanıcı kimliği DEĞİLDİR — kendi principal tipi: CIHAZ.
 */
import type { TenantId } from '../tenant/tenant-context.js';

export type CihazTipi = 'SAYAC' | 'ASANSOR' | 'KAMERA' | 'SENSOR';

export interface CihazTanimi {
  readonly tenantId: TenantId;
  readonly tip: CihazTipi;
  readonly seriNo: string;
  readonly konum: string;
  readonly ustveri: Readonly<Record<string, unknown>>;
}

export interface CihazDurumu {
  readonly cihazId: string;
  readonly cevrimici: boolean;
  readonly sonGorulme: Date | null;
}

export interface Olcum {
  readonly olculenAn: Date;
  readonly birim: string;
  readonly deger: number;
}

export interface Komut {
  readonly ad: string;
  readonly parametreler: Readonly<Record<string, unknown>>;
}

export interface Alarm {
  readonly cihazId: string;
  readonly tenantId: TenantId;
  readonly siddet: 1 | 2 | 3;
  readonly kod: string;
  readonly olusmaAni: Date;
}

export interface AlarmFiltresi {
  readonly tenantId: TenantId;
  readonly cihazTipleri?: readonly CihazTipi[];
  readonly enAzSiddet?: 1 | 2 | 3;
}

export interface IIoTGateway {
  cihazKaydet(cihaz: CihazTanimi): Promise<string>;
  cihazDurumu(tenantId: TenantId, cihazId: string): Promise<CihazDurumu>;
  cihazSil(tenantId: TenantId, cihazId: string): Promise<void>;
  telemetriAl(cihazId: string, olcumler: readonly Olcum[]): Promise<void>;
  komutGonder(cihazId: string, komut: Komut): Promise<void>;
  alarmAboneligi(filtre: AlarmFiltresi): AsyncIterable<Alarm>;
}
