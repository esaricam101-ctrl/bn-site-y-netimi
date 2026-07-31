/**
 * Test ortamı hazırlığı.
 *
 * Ortam dosyası depo KÖKÜNDEDİR; vitest ise `backend/` dizininden koşar ve
 * `.env`'i kendiliğinden yüklemez. Yüklenmezse her sözleşme testi
 * "DATABASE_URL: Required" ile düşer — testin kendisi hiç çalışmaz ve
 * başarısızlık, sınanan davranışla ilgisiz bir yapılandırma hatası olur.
 *
 * `import.meta` KULLANILMAZ: bu dosya `nest build` (CommonJS hedefi) ile de
 * derlenir ve orada meta-özellik hatası verir. Kök, `.env` bulunana kadar
 * yukarı yürünerek bulunur — çalışma dizini nereden koşulursa koşulsun
 * doğru sonucu verir.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function kokuBul(baslangic: string): string | null {
  let dizin = baslangic;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dizin, '.env'))) return dizin;
    const ust = dirname(dizin);
    if (ust === dizin) break;
    dizin = ust;
  }
  return null;
}

const kok = kokuBul(process.cwd());
if (kok !== null) {
  process.loadEnvFile(join(kok, '.env'));
}

// Testler uygulama rolüyle koşar: RLS politikaları BU testlerin sınadığı
// şeydir. Migrator rolüyle koşulsaydı izolasyon testi her koşulda geçerdi.
delete process.env['MIGRATE_DATABASE_URL'];

// İstek sınırı sayaçlarının sıfırlanması `global-setup.ts` içindedir:
// buradaki dosya CommonJS'e derlenir ve üst düzey `await` kabul etmez.
