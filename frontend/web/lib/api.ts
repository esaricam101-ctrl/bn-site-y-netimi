/**
 * API istemcisi.
 *
 * Web ve mobil AYNI Backend API'sini kullanir; platforma ozgu is mantigi yoktur.
 */
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly correlationId: string;
  readonly sonrakiEylem?: string;
  readonly gerekenIzinler?: readonly string[];
}

export class ApiHatasi extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiHatasi';
  }
}

const TABAN = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export interface IstekSecenekleri {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly govde?: unknown;
  readonly token?: string;
  /** Kayit olusturan her POST icin zorunlu (BFS v1 §12). */
  readonly idempotencyKey?: string;
}

export async function api<T>(yol: string, secenek: IstekSecenekleri = {}): Promise<T> {
  const basliklar: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secenek.token) basliklar['Authorization'] = `Bearer ${secenek.token}`;
  if (secenek.idempotencyKey) basliklar['Idempotency-Key'] = secenek.idempotencyKey;

  const yanit = await fetch(`${TABAN}${yol}`, {
    method: secenek.method ?? 'GET',
    headers: basliklar,
    ...(secenek.govde !== undefined ? { body: JSON.stringify(secenek.govde) } : {}),
    cache: 'no-store',
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
}
