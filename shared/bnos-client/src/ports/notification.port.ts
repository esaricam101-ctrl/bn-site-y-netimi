import type { TenantId } from '@bnos/kernel';

export type BildirimKanali = 'PUSH' | 'EPOSTA' | 'SMS' | 'UYGULAMA_ICI';

export interface BildirimIstegi {
  readonly tenantId: TenantId;
  readonly aliciKisiIds: readonly string[];
  readonly sablonKodu: string;
  readonly degiskenler: Readonly<Record<string, string>>;
  readonly kanallar: readonly BildirimKanali[];
  /** Sessiz saat ve ozet tercihinden MUAF olan bildirimler. */
  readonly acilMi: boolean;
}

export interface INotificationService {
  gonder(istek: BildirimIstegi): Promise<void>;
}
