/**
 * Test ortamı hazırlığı.
 *
 * Ortam dosyası depo KÖKÜNDEDİR; vitest ise `backend/` dizininden koşar ve
 * `.env`'i kendiliğinden yüklemez. Yüklenmezse her sözleşme testi
 * "DATABASE_URL: Required" ile düşer — testin kendisi hiç çalışmaz ve
 * başarısızlık, sınanan davranışla ilgisiz bir yapılandırma hatası olur.
 *
 * ⚠️  KÖK BULMA BURADA KOPYALANMAZ: `src/config/kok.ts` içindedir ve
 *     uygulamanın kendisi de (ConfigModule) onu kullanır. Bu mantık bir
 *     zamanlar YALNIZCA burada vardı; dev sunucusu aynı kusurdan ölüyordu ve
 *     testler yeşil olduğu için kimse görmüyordu. Tek kaynak, ikinci kez
 *     ıraksamayı önler.
 */
import { join } from 'node:path';
import { beforeAll } from 'vitest';
import { depoKokunuBul } from '../src/config/kok';

const kok = depoKokunuBul(process.cwd());
if (kok !== null) {
  process.loadEnvFile(join(kok, '.env'));
}

// Testler uygulama rolüyle koşar: RLS politikaları BU testlerin sınadığı
// şeydir. Migrator rolüyle koşulsaydı izolasyon testi her koşulda geçerdi.
delete process.env['MIGRATE_DATABASE_URL'];

/*
 * İSTEK SINIRI SAYAÇLARI HER TEST DOSYASINDAN ÖNCE SIFIRLANIR.
 *
 * ⚠️  `global-setup.ts` bunu KOŞUM BAŞINDA BİR KEZ yapıyordu ve YETMEDİ.
 *     Ölçüldü: tam süit tek koşumda 21 giriş üretiyor, IP sınırı ise
 *     20 giriş / 5 dk. Sayaç:
 *
 *       21 <- sinir:POST:OturumController.giris:ip:::ffff:127.0.0.1
 *
 *     21'inci giriş 429 alıyordu ve belirtisi YANILTICIYDI: CT-04
 *     `expected undefined to be '/yonetim'` ile düşüyordu — yani hata,
 *     sınadığı davranışla ilgisiz bir yerde çıkıyordu. Kimlik sayaçlarının
 *     en yükseği 2'ydi (sınır 5); yani sebep kimlik değil IP'ydi.
 *
 * ⚠️  SINIR KAPATILMAZ, YALNIZCA SAYAÇ SIFIRLANIR. Guard testlerde de tam
 *     olarak üretimdeki kod yolunu koşar. "Test modunda sınır yok" bayrağı
 *     hem üretimde yanlışlıkla açılabilir hem de guard'ı testlerde hiç
 *     çalıştırmazdı.
 *
 * ⚠️  Dosyalar paralel koşarken biri ötekinin sayacını sıfırlayabilir. Bu
 *     yalnızca sınırı GEVŞETİR, sıkılaştırmaz; testin ölçtüğü şey istek
 *     sınırı değildir (onu ölçen ayrı bir test varsa kendi sayacını kurar).
 */
beforeAll(async () => {
  const { Redis } = await import('ioredis');
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  try {
    const anahtarlar = await redis.keys('sinir:*');
    // Bunlar ÖNBELLEK anahtarı değil İSTEK SINIRI sayaçlarıdır ve doğaları
    // gereği TENANT ÖNCESİDİR: giriş ucu tenant seçiminden önce çalışır.
    // eslint-disable-next-line bnos/require-tenant-cache-key
    if (anahtarlar.length > 0) await redis.del(...anahtarlar);
  } catch {
    // Redis yoksa sınır fail-open çalışır; koşu engellenmez.
  } finally {
    redis.disconnect();
  }
});
