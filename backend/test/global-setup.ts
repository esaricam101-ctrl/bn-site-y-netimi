/**
 * Test koşusu öncesi TEK SEFERLİK hazırlık.
 *
 * ⚠️  İSTEK SINIRI SAYAÇLARI SIFIRLANIR. Sözleşme testleri aynı hesapla
 *     defalarca giriş yapar; beşinci denemede `/oturum/giris` 429 döner ve
 *     belirtisi YANILTICIDIR: hata `expected undefined to be '/yonetim'`
 *     biçiminde, testin sınadığı davranışla ilgisiz bir yerde çıkar. Bu tam
 *     olarak "testin kırıldığı yer, kırılma sebebiyle ilgisiz" tuzağıdır ve
 *     "testler bozuk" diye atlanmaya açıktır.
 *
 * ⚠️  SINIR KAPATILMAZ, YALNIZCA SAYAÇ SIFIRLANIR. "Test modunda sınır yok"
 *     bayrağı iki şeyi birden bozardı: üretimde yanlışlıkla açılırsa korumayı
 *     tümüyle kaldırır, ve guard'ın gerçek kod yolu testlerde hiç koşmaz.
 *     Bu yolla guard testlerde de tam olarak üretimdeki gibi çalışır.
 *
 * `setup.ts` DEĞİL burası kullanılır: o dosya CommonJS'e derlenir ve üst
 * düzey `await` kabul etmez.
 */
import { Redis } from 'ioredis';

export default async function hazirla(): Promise<void> {
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  try {
    /*
     * `bnos/require-tenant-cache-key` gerekçeli olarak devre dışı: bunlar
     * ÖNBELLEK anahtarı değil İSTEK SINIRI sayaçlarıdır ve doğaları gereği
     * TENANT ÖNCESİDİR — giriş ucu tenant seçiminden önce çalışır, o noktada
     * tenant kimliği henüz yoktur. Kural gevşetilmedi.
     */
    const anahtarlar = await redis.keys('sinir:*');
    // Silinen anahtarlar `keys()` çıktısıdır, burada üretilmiş bir anahtar
    // değil — desen zaten tenant öncesi olduğu için muafiyet gerekçelidir.
    // eslint-disable-next-line bnos/require-tenant-cache-key
    if (anahtarlar.length > 0) await redis.del(...anahtarlar);
  } catch {
    // Redis yoksa sınır zaten fail-open çalışır; test koşusu engellenmez.
  } finally {
    redis.disconnect();
  }
}
