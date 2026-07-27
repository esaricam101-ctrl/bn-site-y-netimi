/**
 * Tenant bağlamı — ADR-0002 · BFS v1 §2
 *
 * Her tenant bir apartmandır. portfolio/group/site kapsamı bu modülde uygulanmaz.
 *
 * Bu tip, `SET LOCAL app.tenant_id` çağrısının tek meşru kaynağıdır.
 * Bağlam kurulmadan yapılan sorgu PostgreSQL tarafından reddedilir —
 * izolasyon uygulama katmanındaki `where` koşuluna bırakılmaz.
 */

/** Markalı tip: ham string'in yanlışlıkla tenant kimliği yerine geçmesini önler. */
export type TenantId = string & { readonly __marka: 'TenantId' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantBaglamiHatasi extends Error {
  override readonly name = 'TenantBaglamiHatasi';
}

export const tenantId = (deger: string): TenantId => {
  if (!UUID.test(deger)) {
    throw new TenantBaglamiHatasi(`Geçersiz tenant kimliği: ${deger}`);
  }
  return deger as TenantId;
};

export interface TenantBaglami {
  readonly tenantId: TenantId;
  /** IANA saat dilimi. Türkiye sabit UTC+3'tür ancak bu koda gömülmez (BFS v1 §4.2). */
  readonly saatDilimi: string;
}

/**
 * Bağlamı zorunlu kılar. Bağlam yoksa sessizce devam etmez — hata verir.
 * Sessiz devam, çapraz tenant sızıntısının en yaygın nedenidir.
 */
export function baglamiZorunluKil(
  baglam: TenantBaglami | undefined,
  islem: string,
): TenantBaglami {
  if (!baglam) {
    throw new TenantBaglamiHatasi(
      `Tenant bağlamı kurulmadan '${islem}' çalıştırılamaz. ` +
        `Sistem işleri SISTEM principal'ı ile açık tenant döngüsü kurmalıdır (BFS v1 §2.3).`,
    );
  }
  return baglam;
}
