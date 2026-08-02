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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

/**
 * Kok `tsconfig.json`un `references` listesi YALNIZCA `shared/*` icerir; bu
 * bilinclidir (offline derleme zinciri). Sonucu: `tsc -b` uygulama kodunu
 * HIC gormez.
 *
 * ⚠️  LISTE ELLE YAZILMAZ, TURETILIR. Her paketin kendi `typecheck` betigi
 *     vardir; `tsc -b` kullananlar zaten yukarıdaki adimda kapsaniyor, geri
 *     kalanlar (`tsc --noEmit`) burada taranir. Elle yazilsaydi yeni bir
 *     paket eklendiginde sessizce disarida kalirdi.
 *
 * `pnpm -r typecheck` CAGRILMAZ: `pnpm` Windows'ta bir `.cmd` shim'idir ve
 * `execFileSync` onu kabuk olmadan calistiramaz — olculdu, adim bos ciktiyla
 * basarisiz oluyordu.
 */
function tipDenetimiGerekenler() {
  const kokPaket = JSON.parse(
    readFileSync(join(KOK, 'package.json'), 'utf8'),
  );
  const desenler = kokPaket.workspaces ?? [];
  const adaylar = new Set();

  // pnpm-workspace.yaml varsa oradan; yoksa package.json workspaces'ten.
  const wsYol = join(KOK, 'pnpm-workspace.yaml');
  if (existsSync(wsYol)) {
    for (const satir of readFileSync(wsYol, 'utf8').split(/\r?\n/)) {
      const m = /^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/.exec(satir);
      if (m?.[1]) adaylar.add(m[1]);
    }
  }
  for (const d of desenler) adaylar.add(d);

  const dizinler = [];
  for (const desen of adaylar) {
    const kok = desen.replace(/\/\*+$/, '');
    const tam = join(KOK, kok);
    if (!existsSync(tam)) continue;
    if (desen.includes('*')) {
      for (const alt of readdirSync(tam, { withFileTypes: true })) {
        if (alt.isDirectory()) dizinler.push(join(kok, alt.name));
      }
    } else {
      dizinler.push(kok);
    }
  }

  return dizinler.filter((d) => {
    const pj = join(KOK, d, 'package.json');
    if (!existsSync(pj)) return false;
    const betik = JSON.parse(readFileSync(pj, 'utf8')).scripts?.typecheck;
    // `tsc -b` kullananlar kok proje grafiginde zaten derleniyor.
    return typeof betik === 'string' && betik.includes('--noEmit');
  });
}

const ADIMLAR = [
  { ad: 'Workspace baglantilari', komut: 'node', argv: [join(BURASI, 'link-workspace.mjs')] },
  /*
   * ⚠️  BU ADIM YALNIZCA `shared/*` KAPSAR. Kok tsconfig.json'un `references`
   *     listesi sadece shared paketlerini icerir (bilincli: offline derleme
   *     zinciri). Adin "TypeScript derleme" olmasi butun depoyu tarandigi
   *     izlenimi veriyordu — VERMIYOR.
   */
  { ad: 'TypeScript derleme — shared/* (tsc -b)', komut: tsc.komut, argv: [...tsc.on, '-b', '--pretty', 'false'] },
  { ad: 'Test derlemesi (framework bagimsiz moduller)', komut: tsc.komut, argv: [...tsc.on, '-p', 'tests/tsconfig.json'] },
  /*
   * UYGULAMA TIP DENETIMI — backend · database · frontend.
   *
   * ⚠️  BU ADIM SONRADAN EKLENDI VE SEBEBI OLCULDU. Uc gercek hata yerelde
   *     `pnpm verify` YESILKEN gecti ve ancak sunucu yeniden baslatilinca
   *     ortaya cikti:
   *       · FIS_TURLERI ve domain FisTuru 'TAHAKKUK' tasimiyordu
   *       · gider turu olusturma ucu zorunlu muhasebeHesapId'yi vermiyordu
   *     Sebep: ustteki adim backend'i HIC gormuyor, vitest de tip denetimi
   *     yapmiyor. CI `pnpm typecheck` ile yakalardi ama yerel kapi yakalamadi
   *     — yani yerel ile CI ayni seyi olcmuyordu.
   *
   *     "Guvence mekanizmasinin kendisi dogrulanmamis" sinifi.
   */
  ...tipDenetimiGerekenler().map((d) => ({
    ad: `Tip denetimi — ${d.replace(/\\/g, '/')}`,
    komut: tsc.komut,
    argv: [...tsc.on, '--noEmit', '-p', d, '--pretty', 'false'],
  })),
  { ad: 'Paket siniri (ADR v1.1 §40)', komut: 'node', argv: [join(BURASI, 'boundary.mjs')] },
  { ad: 'Onbellek anahtari (ADR-0005 · §37)', komut: 'node', argv: [join(BURASI, 'cache-key-scan.mjs')] },
  { ad: 'RLS tenant baglami (ADR-0002)', komut: 'node', argv: [join(BURASI, 'rls-scan.mjs')] },
  // Ustteki adim UYGULAMA tarafini denetler (sorgu baglam icinden mi calisiyor).
  // Bu adim VERITABANI tarafini denetler (tablo politika almis mi). Ikisi ayri
  // sessiz kusur sinifidir: politikasiz bir tablo derlenir, lint gecer, testler
  // yesil kalir ve tenant izolasyonu sessizce kalkar.
  { ad: 'RLS politika kapsami (ADR-0002 · ADR-0008)', komut: 'node', argv: [join(BURASI, 'rls-politika-scan.mjs')] },
  { ad: 'Yapilandirma tutarliligi', komut: 'node', argv: [join(BURASI, 'config-check.mjs')] },
  { ad: 'Ortam sozlesmesi (sema <-> .env.example)', komut: 'node',
    argv: [join(BURASI, 'env-sozlesme-check.mjs')] },
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
