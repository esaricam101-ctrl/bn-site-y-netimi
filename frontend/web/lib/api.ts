/**
 * API istemcisi.
 *
 * Web ve mobil AYNI Backend API'sini kullanir; platforma ozgu is mantigi yoktur.
 */
import { oturumYonlendirmesiGerekliMi } from './oturum-yolu';

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

/** Oturum verisi — 401'de temizlenir. Görünüm tercihleri BURADA DEĞİL. */
const OTURUM_ANAHTARLARI = [
  'bnos.token', 'bnos.portfoyToken', 'bnos.tenantId',
  'bnos.tenantAdi', 'bnos.tenantTipi', 'bnos.projeAdi',
] as const;

/**
 * OTURUM DÜŞTÜ — giriş sayfasına dön, dönüş yolunu koruyarak.
 *
 * ⚠️  NEDEN VAR: 401 alan her ekran ham hata metni gösteriyordu — "Kimlik
 *     doğrulaması gerekli" + destek numarası + İŞE YARAMAYAN bir "Tekrar
 *     dene" düğmesi. Eksik olan istek değil OTURUMDUR; tekrar denemek
 *     aynı 401'i verir. Jeton `sessionStorage`'dadır ve TARAYICI KAPANINCA
 *     SİLİNİR, yani bu kenar durum değil olağan akıştır.
 *
 * ⚠️  GİRİŞ UCU MUAF. `POST /oturum/giris` yanlış şifrede 401 döner;
 *     yönlendirme yapılsaydı kullanıcı hata mesajını hiç göremez, sayfa
 *     kendini yeniler ve şifrenin yanlış olduğunu asla öğrenemezdi.
 *
 * ⚠️  ZATEN /giris'TEYSEK YÖNLENDİRME YOK — sonsuz döngü olurdu.
 *
 * ⚠️  YALNIZCA TARAYICIDA. Bu dosya sunucu tarafında da çalıştırılabilir
 *     (Next.js) ve `window` orada yoktur.
 */
function oturumDustu(yol: string): void {
  if (typeof window === 'undefined') return;
  if (!oturumYonlendirmesiGerekliMi(yol, window.location.pathname)) return;

  const suan = `${window.location.pathname}${window.location.search}`;

  // Ölü jetonla çalışmaya devam etmemek için oturum verisi silinir; tema ve
  // yoğunluk tercihleri BAŞKA yerde tutulur ve dokunulmaz.
  for (const a of OTURUM_ANAHTARLARI) sessionStorage.removeItem(a);

  window.location.assign(`/giris?donus=${encodeURIComponent(suan)}`);
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
    if (yanit.status === 401) oturumDustu(yol);
    const problem = (await yanit.json().catch(() => null)) as ProblemDetails | null;
    /*
     * HATA YİNE FIRLATILIR. Yönlendirme anında gerçekleşmez (tarayıcı
     * gezinmeyi kuyruğa alır); çağıran taraf `finally` bloklarını
     * çalıştırabilmeli ve ekran "yükleniyor" durumunda asılı kalmamalıdır.
     */
    throw new ApiHatasi(
      problem ?? {
        type: 'about:blank', title: 'AG_HATASI', status: yanit.status,
        detail: 'Sunucuya ulaşılamadı.', correlationId: 'yok',
      },
    );
  }
  return (await yanit.json()) as T;
}
