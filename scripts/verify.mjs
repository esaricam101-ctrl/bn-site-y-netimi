#!/usr/bin/env node
/**
 * Faz 0 Build Verification — cevrimdisi calisabilen tam dogrulama zinciri.
 *
 * Bu betik HICBIR harici bagimlilik gerektirmez. Amaci, paket kayit
 * sunucusuna erisim olmayan ortamlarda da mimari kurallarin dogrulanabilmesidir.
 *
 * CI'da bu betik + tam zincir (pnpm install / eslint / vitest) birlikte calisir;
 * ikisi ayni kurallari uygular, biri digerinin yerine gecmez.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BURASI = dirname(fileURLToPath(import.meta.url));
const KOK = join(BURASI, '..');

/** node --test bir dizini kabul etmez; dosyalar acikca sayilir. */
function testDosyalari() {
  const dizin = join(KOK, 'tests', 'unit');
  try {
    return readdirSync(dizin)
      .filter((a) => /\.(mjs|js|test\.ts)$/.test(a))
      .map((a) => join('tests', 'unit', a));
  } catch {
    return [];
  }
}

/**
 * Yerel tsc dogrudan node ile calistirilir. Windows'ta `npx` bir .cmd
 * dosyasidir ve execFileSync onu kabuk olmadan calistiramaz; kabuk kullanmak
 * ise argumanlari kacislamadan birlestirir. Yerel yol ikisinden de kacinir.
 */
const yerelTsc = join(KOK, 'node_modules', 'typescript', 'bin', 'tsc');
const tsc = existsSync(yerelTsc)
  ? { komut: 'node', on: [yerelTsc] }
  : { komut: process.platform === 'win32' ? 'npx.cmd' : 'npx', on: ['tsc'] };

const ADIMLAR = [
  { ad: 'Workspace baglantilari', komut: 'node', argv: [join(BURASI, 'link-workspace.mjs')] },
  { ad: 'TypeScript derleme (tsc -b)', komut: tsc.komut, argv: [...tsc.on, '-b', '--pretty', 'false'] },
  { ad: 'Test derlemesi (framework bagimsiz moduller)', komut: tsc.komut, argv: [...tsc.on, '-p', 'tests/tsconfig.json'] },
  { ad: 'Paket siniri (ADR v1.1 §40)', komut: 'node', argv: [join(BURASI, 'boundary.mjs')] },
  { ad: 'Onbellek anahtari (ADR-0005 · §37)', komut: 'node', argv: [join(BURASI, 'cache-key-scan.mjs')] },
  { ad: 'RLS tenant baglami (ADR-0002)', komut: 'node', argv: [join(BURASI, 'rls-scan.mjs')] },
  // Ustteki adim UYGULAMA tarafini denetler (sorgu baglam icinden mi calisiyor).
  // Bu adim VERITABANI tarafini denetler (tablo politika almis mi). Ikisi ayri
  // sessiz kusur sinifidir: politikasiz bir tablo derlenir, lint gecer, testler
  // yesil kalir ve tenant izolasyonu sessizce kalkar.
  { ad: 'RLS politika kapsami (ADR-0002 · ADR-0008)', komut: 'node', argv: [join(BURASI, 'rls-politika-scan.mjs')] },
  { ad: 'Yapilandirma tutarliligi', komut: 'node', argv: [join(BURASI, 'config-check.mjs')] },
  { ad: 'Birim testleri (node:test)', komut: 'node', argv: ['--test', ...testDosyalari()] },
];

let basarisiz = 0;
const sonuclar = [];

for (const adim of ADIMLAR) {
  process.stdout.write(`\n=== ${adim.ad}\n`);
  try {
    const cikti = execFileSync(adim.komut, adim.argv, {
      cwd: KOK, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const ozet = cikti.trim().split('\n').slice(-3).join('\n');
    if (ozet) console.log(ozet);
    sonuclar.push({ ad: adim.ad, durum: 'GECTI' });
  } catch (e) {
    console.error(String(e.stdout ?? '').trim());
    console.error(String(e.stderr ?? '').trim());
    sonuclar.push({ ad: adim.ad, durum: 'BASARISIZ' });
    basarisiz++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('FAZ 0 BUILD VERIFICATION');
console.log('='.repeat(60));
for (const s of sonuclar) {
  console.log(`  ${s.durum === 'GECTI' ? 'GECTI     ' : 'BASARISIZ '} ${s.ad}`);
}
console.log('='.repeat(60));

if (basarisiz > 0) {
  console.error(`\n${basarisiz} adim basarisiz. Faz 0 kapatilamaz.`);
  process.exit(1);
}
console.log('\nTum kontroller yesil.');
