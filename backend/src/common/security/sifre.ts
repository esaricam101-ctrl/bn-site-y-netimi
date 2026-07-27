/**
 * Şifre özetleme — saf fonksiyonlar, framework bağımsız.
 *
 * NestJS dekoratörü taşımaz; bu yüzden düğüm çalıştırıcısıyla doğrudan
 * test edilebilir. `sifre.service.ts` bunun ince bir enjekte edilebilir
 * sarmalayıcısıdır (BFS v1 §1.3 — mantık framework'ten ayrı durur).
 *
 * Algoritma: scrypt (`node:crypto`).
 * Neden: bellek-zor bir KDF'dir ve GPU ile paralel denemeyi pahalı kılar.
 * Node çekirdeğinde olduğu için native derleme gerektiren bir bağımlılık
 * (bcrypt/argon2) eklemez — ADR-0007 ile aynı gerekçe.
 *
 * Biçim: scrypt$N$r$p$<tuz-b64>$<özet-b64>
 * Parametreler özete GÖMÜLÜR; maliyet ileride artırıldığında eski özetler
 * doğrulanmaya devam eder ve giriş anında sessizce yükseltilebilir.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  parola: string | Buffer,
  tuz: string | Buffer,
  uzunluk: number,
  secenekler: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** OWASP 2024 asgarisi. */
export const SCRYPT_PARAMETRELERI = { N: 131_072, r: 8, p: 1 } as const;

const OZET_UZUNLUGU = 64;
const TUZ_UZUNLUGU = 16;

/** Node varsayılanı 32 MB; N=2^17 için yetmez. */
const maxmem = (N: number, r: number): number => 128 * N * r * 2;

export async function sifreOzetle(parola: string): Promise<string> {
  const { N, r, p } = SCRYPT_PARAMETRELERI;
  const tuz = randomBytes(TUZ_UZUNLUGU);
  const ozet = await scryptAsync(parola.normalize('NFKC'), tuz, OZET_UZUNLUGU, {
    N, r, p, maxmem: maxmem(N, r),
  });
  return `scrypt$${N}$${r}$${p}$${tuz.toString('base64')}$${ozet.toString('base64')}`;
}

/**
 * Sabit zamanlı doğrulama.
 *
 * Biçim bozuksa `false` döner — bu kullanıcı hatası değil veri bozulmasıdır
 * ve çağıran tarafta hatalı kimlikten ayırt edilmez.
 */
export async function sifreDogrula(parola: string, kayitliOzet: string): Promise<boolean> {
  const parcalar = kayitliOzet.split('$');
  if (parcalar.length !== 6 || parcalar[0] !== 'scrypt') return false;

  const N = Number(parcalar[1]);
  const r = Number(parcalar[2]);
  const p = Number(parcalar[3]);
  const tuz = Buffer.from(parcalar[4] ?? '', 'base64');
  const beklenen = Buffer.from(parcalar[5] ?? '', 'base64');

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || r < 1 || p < 1) return false;
  if (tuz.length === 0 || beklenen.length === 0) return false;

  const hesaplanan = await scryptAsync(parola.normalize('NFKC'), tuz, beklenen.length, {
    N, r, p, maxmem: maxmem(N, r),
  });
  return timingSafeEqual(hesaplanan, beklenen);
}

/** Özet güncel maliyet parametreleriyle mi üretilmiş? */
export function yukseltmeGerekliMi(kayitliOzet: string): boolean {
  const p = kayitliOzet.split('$');
  return p[0] !== 'scrypt' || Number(p[1]) < SCRYPT_PARAMETRELERI.N;
}
