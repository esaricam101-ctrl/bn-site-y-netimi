import { z } from 'zod';

/**
 * Ortam değişkeni doğrulaması. Eksik veya hatalı yapılandırma uygulamanın
 * açılışında yakalanır — çalışma sırasında değil.
 */
const sema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default('/api/v1'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  /**
   * Kaç ters vekil katmanına güvenileceği. `0` = hiç (varsayılan).
   *
   * ⚠️  VARSAYILAN KAPALI OLMAK ZORUNDA. Açıkken Express `X-Forwarded-For`
   *     başlığına güvenir; doğrudan erişilebilen bir sunucuda bu başlığı İSTEMCİ
   *     yazar ve istediği adresi uydurabilir. Sonuç: istek sınırı her istekte
   *     farklı bir "IP" görür ve HİÇ tetiklenmez — koruma açık görünürken
   *     tümüyle işlevsizdir.
   *
   * ⚠️  YÜK DENGELEYİCİ ARKASINDA AYARLANMAK ZORUNDA. Kapalı bırakılırsa bütün
   *     istekler dengeleyicinin adresinden geliyor görünür; IP sayacı bir sitenin
   *     TAMAMINI kilitler ve denetim kaydındaki IP de yanlış olur.
   *
   * Yani iki yönde de sessiz bir hata var: yanlış açmak korumayı kaldırır,
   * yanlış kapatmak meşru kullanıcıyı kilitler. Dağıtım topolojisi bilinerek
   * verilir — genelde `1`.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunludur'),
  MIGRATE_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().min(1, 'REDIS_URL zorunludur'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalıdır'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('bnos-apartman'),

  BNOS_MODE: z.enum(['local', 'remote']).default('local'),
  BNOS_BASE_URL: z.string().optional(),
  BNOS_API_KEY: z.string().optional(),
});

export type Ortam = z.infer<typeof sema>;

export function ortamSemasi(ham: Record<string, unknown>): Ortam {
  const sonuc = sema.safeParse(ham);
  if (!sonuc.success) {
    const detay = sonuc.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ortam yapılandırması geçersiz:\n${detay}\n\n.env.example dosyasını temel alın.`);
  }
  return sonuc.data;
}
