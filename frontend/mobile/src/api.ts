/**
 * Mobil API istemcisi.
 *
 * Web ve mobil AYNI Backend API'sini kullanir. Platforma ozgu is mantigi
 * GELISTIRILMEZ — tek veri modeli, tek servis katmani, tek is kurallari.
 *
 * Fark yalnizca token deposundadir: web sessionStorage, mobil SecureStore.
 */
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly correlationId: string;
  readonly sonrakiEylem?: string;
}

export class ApiHatasi extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiHatasi';
  }
}

export interface ApiYapilandirmasi {
  readonly tabanUrl: string;
  readonly tokenGetir: () => Promise<string | null>;
}

export function apiOlustur(cfg: ApiYapilandirmasi) {
  return async function api<T>(
    yol: string,
    secenek: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      govde?: unknown;
      idempotencyKey?: string;
    } = {},
  ): Promise<T> {
    const token = await cfg.tokenGetir();
    const basliklar: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) basliklar['Authorization'] = `Bearer ${token}`;
    if (secenek.idempotencyKey) basliklar['Idempotency-Key'] = secenek.idempotencyKey;

    const yanit = await fetch(`${cfg.tabanUrl}${yol}`, {
      method: secenek.method ?? 'GET',
      headers: basliklar,
      ...(secenek.govde !== undefined ? { body: JSON.stringify(secenek.govde) } : {}),
    });

    if (!yanit.ok) {
      const problem = (await yanit.json().catch(() => null)) as ProblemDetails | null;
      throw new ApiHatasi(
        problem ?? {
          type: 'about:blank', title: 'AG_HATASI', status: yanit.status,
          detail: 'Sunucuya ulaşılamadı.', correlationId: 'yok',
        },
      );
    }
    return (await yanit.json()) as T;
  };
}
