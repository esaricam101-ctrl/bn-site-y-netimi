/**
 * DEPO KÖKÜ VE ORTAM DOSYASI — tek kaynak.
 *
 * ⚠️  NEDEN VAR: ortam dosyası depo KÖKÜNDEDİR, ama backend hiçbir zaman
 *     kökten koşmaz — `nest start` ve `vitest` ikisi de `backend/` dizininden
 *     çalışır. `.env` çalışma dizinine göre arandığı için hiç bulunmaz.
 *
 *     Testlerde bu bir kez teşhis edilip `test/setup.ts` içinde çözülmüştü;
 *     DEV SUNUCUSUNDA çözülmemişti. `pnpm dev:backend` şu hatayla ölüyordu:
 *
 *         Ortam yapılandırması geçersiz:
 *           - DATABASE_URL: Required · REDIS_URL: Required · JWT_SECRET: Required
 *
 *     Aynı kusurun iki ayrı kopyası olmasın diye kök bulma buraya alındı;
 *     `test/setup.ts` de bunu kullanır. İki kopya olsaydı biri düzeltilip
 *     öteki unutulurdu — nitekim tam olarak bu olmuştu.
 *
 * ⚠️  DOĞRULAMA GEVŞETİLMEDİ. `env.schema.ts` eksik anahtarda hâlâ ölür ve
 *     ölmelidir: veritabanı adresi olmadan başlayan bir sunucu, ilk isteğe
 *     kadar sağlıklı görünür. Düzeltilen şey dosyanın BULUNAMAMASIDIR.
 *
 * `import.meta` KULLANILMAZ: bu dosya `nest build` (CommonJS hedefi) ile
 * derlenir ve orada meta-özellik hatası verir (TS1343).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Yukarı doğru yürüyerek `.env` barındıran dizini bulur. */
export function depoKokunuBul(baslangic: string = process.cwd()): string | null {
  let dizin = baslangic;
  // Altı seviye: `backend/dist/src` gibi en derin çıkış yolundan bile köke
  // ulaşır. Sınırsız döngü, kök dizinde takılıp kalma riskini taşır.
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dizin, '.env'))) return dizin;
    const ust = dirname(dizin);
    if (ust === dizin) break;
    dizin = ust;
  }
  return null;
}

/**
 * Kökteki `.env` yolunu döndürür; bulunamazsa `undefined`.
 *
 * ⚠️  Bulunamaması HATA DEĞİLDİR: üretimde `.env` dosyası olmaz, değişkenler
 *     ortamdan gelir. Burada hata fırlatmak, doğru yapılandırılmış bir
 *     üretim ortamını başlatılamaz hâle getirirdi. Eksik değişkenin asıl
 *     kontrolü `env.schema.ts` içindedir ve orası affetmez.
 */
export function kokOrtamDosyasi(baslangic?: string): string | undefined {
  const kok = depoKokunuBul(baslangic);
  return kok === null ? undefined : join(kok, '.env');
}
