#!/usr/bin/env node
/**
 * Onbellek anahtari tarayicisi — bagimliliksiz.
 *
 * Kaynak: ADR-0005 · ADR v1.1 §37 · BFS v1 §7.1
 *
 * tools/eslint-rules/require-tenant-cache-key.js kuralinin CI'da ESLint
 * gerektirmeyen karsiligi. ESLint AST tabanli ve daha kesindir; bu betik
 * kuralin ag erisimi olmayan ortamda da uygulanabilmesini garanti eder.
 * Ikisi ayni kurali uygular; ikisi de CI'da calisir.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// .pathname Windows'ta '/C:/...' verir ve birlestirince 'C:\C:\...' olusur.
const KOK = fileURLToPath(new URL('..', import.meta.url));

const YASAKLI_ALANLAR = [
  'bakiye', 'cari-hesap', 'borc-durumu', 'yaslandirma', 'nakit', 'mizan', 'defter',
];

// redis.get('...') / cache.set(`...`) bicimindeki cagrilarda ilk argumani yakalar
const CAGRI =
  /\b(?:redis|cache|onbellek|cacheManager|redisClient)\s*\.\s*(?:get|set|setex|del|mget|mset|incr|expire|hget|hset)\s*\(\s*([`'"])((?:\\.|(?!\1).)*)\1/g;

function* tsDosyalari(dizin) {
  for (const ad of readdirSync(dizin)) {
    if (ad === 'node_modules' || ad === 'dist' || ad.startsWith('.')) continue;
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) yield* tsDosyalari(tam);
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(ad)) yield tam;
  }
}

const ihlaller = [];
let taranan = 0;

for (const kok of ['shared', 'backend', 'frontend', 'database']) {
  const tam = join(KOK, kok);
  try { statSync(tam); } catch { continue; }
  for (const dosya of tsDosyalari(tam)) {
    taranan++;
    const goreli = relative(KOK, dosya).replaceAll('\\', '/');
    const icerik = readFileSync(dosya, 'utf8');
    for (const eslesme of icerik.matchAll(CAGRI)) {
      const anahtar = eslesme[2] ?? '';
      const kucuk = anahtar.toLowerCase();
      const yasakli = YASAKLI_ALANLAR.find((a) => kucuk.includes(a));
      if (yasakli) {
        ihlaller.push({
          dosya: goreli, anahtar,
          neden: `'${yasakli}' onbelleklenemez (ADR-0005). Finansal bakiye her zaman kaynaktan okunur. ` +
                 `Performans icin transaction icinde bakimi yapilan ozet tablo kullanin (BFS v1 §7.4).`,
        });
      } else if (!kucuk.startsWith('t:')) {
        ihlaller.push({
          dosya: goreli, anahtar,
          neden: `Anahtar tenantId tasimiyor. Bicim: t:{tenantId}:{alan}:{kimlik}:{surum}. ` +
                 `onbellekAnahtari() kullanin — RLS onbellegi korumaz (BFS v1 §7.1).`,
        });
      }
    }
  }
}

console.log(`Onbellek anahtari: ${taranan} dosya tarandi.`);

// Bos tarama = yapilandirma hatasi (bkz. boundary.mjs ayni koruma).
if (taranan === 0) {
  console.error('\nYAPILANDIRMA HATASI: hicbir dosya taranmadi. Klasor yollari degismis olabilir.');
  process.exit(1);
}

if (ihlaller.length > 0) {
  console.error('\nONBELLEK ANAHTARI IHLALI\n');
  for (const i of ihlaller) {
    console.error(`  ${i.dosya}`);
    console.error(`    anahtar: ${i.anahtar}`);
    console.error(`    ${i.neden}\n`);
  }
  process.exit(1);
}

console.log('Ihlal yok.');
