#!/usr/bin/env node
/** Yapilandirma dosyalarinin sozdizimi ve tutarlilik denetimi — bagimliliksiz. */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// .pathname Windows'ta '/C:/...' verir ve birlestirince 'C:\C:\...' olusur.
const KOK = fileURLToPath(new URL('..', import.meta.url));
const hatalar = [];
const bilgi = [];

// 1. JSON dosyalari
const jsonlar = [
  'package.json', 'tsconfig.json', 'tsconfig.base.json',
  ...['kernel','core-domain','apartman-domain','bnos-client','module-sdk','ui-tokens']
    .flatMap((p) => [`shared/${p}/package.json`, `shared/${p}/tsconfig.json`]),
  'backend/package.json', 'backend/tsconfig.json',
  'frontend/web/package.json', 'frontend/web/tsconfig.json',
  'database/package.json',
];
for (const y of jsonlar) {
  const tam = KOK + y;
  if (!existsSync(tam)) { hatalar.push(`Eksik dosya: ${y}`); continue; }
  try { JSON.parse(readFileSync(tam, 'utf8')); }
  catch (e) { hatalar.push(`Gecersiz JSON: ${y} — ${e.message}`); }
}
bilgi.push(`${jsonlar.length} JSON dosyasi dogrulandi`);

// 2. YAML is akislari (python yaml ile)
const yamllar = ['.github/workflows/ci.yml', '.github/workflows/dependency-boundary.yml',
                 'pnpm-workspace.yaml', 'docker-compose.yml'];
for (const y of yamllar) {
  const tam = KOK + y;
  if (!existsSync(tam)) { hatalar.push(`Eksik dosya: ${y}`); continue; }
  try {
    execFileSync('python3', ['-c', 'import sys,yaml; yaml.safe_load(open(sys.argv[1]))', tam],
      { stdio: ['ignore','ignore','pipe'] });
  } catch (e) {
    hatalar.push(`Gecersiz YAML: ${y} — ${String(e.stderr).trim().split('\n').pop()}`);
  }
}
bilgi.push(`${yamllar.length} YAML dosyasi dogrulandi`);

// 3. ESLint kural modulu yuklenebiliyor mu ve dogru sekle sahip mi
try {
  const { createRequire } = await import('node:module');
  const req = createRequire(import.meta.url);
  const eklenti = req(KOK + 'tools/eslint-rules/index.js');
  const kural = eklenti?.rules?.['require-tenant-cache-key'];
  if (!kural) hatalar.push('ESLint kurali disa aktarilmamis: require-tenant-cache-key');
  else if (typeof kural.create !== 'function') hatalar.push('ESLint kuralinda create() yok');
  else if (!kural.meta?.messages?.yasakliAlan) hatalar.push('ESLint kuralinda yasakliAlan mesaji yok');
  else bilgi.push('ESLint kural modulu yuklendi ve sekli dogru');
} catch (e) { hatalar.push(`ESLint kural modulu yuklenemedi: ${e.message}`); }

// 4. RLS on kosulu: uygulama rolu NOBYPASSRLS olmali (ADR-0002 · BFS v1 §2.3)
const rolSql = KOK + 'database/init/01-roles.sql';
if (!existsSync(rolSql)) hatalar.push('Eksik dosya: database/init/01-roles.sql');
else {
  // Yorum satirlari taramaya girmez — aciklama metnindeki 'BYPASSRLS' ihlal degildir
  const sql = readFileSync(rolSql, 'utf8')
    .split('\n')
    .map((s) => s.replace(/--.*$/, ''))
    .join('\n');
  for (const rol of ['bnos_app', 'bnos_migrator']) {
    const satir = sql.split('\n').find((s) => s.includes(`CREATE ROLE ${rol}`));
    if (!satir) hatalar.push(`Rol tanimi yok: ${rol}`);
    else if (!/NOBYPASSRLS/.test(satir))
      hatalar.push(`${rol} rolunde NOBYPASSRLS yok — RLS son savunma hatti olmaz (BFS v1 §2.3)`);
  }
  if (/\bBYPASSRLS\b/.test(sql.replaceAll('NOBYPASSRLS', '')))
    hatalar.push('BYPASSRLS yetkisi veriliyor — ADR-0002 ihlali');
  bilgi.push('Veritabani rolleri NOBYPASSRLS dogrulandi');
}

// 5. Paket adlari ve workspace tutarliligi
for (const p of ['kernel','core-domain','apartman-domain','bnos-client','module-sdk','ui-tokens']) {
  const pkg = JSON.parse(readFileSync(`${KOK}shared/${p}/package.json`, 'utf8'));
  if (pkg.name !== `@bnos/${p}`) hatalar.push(`Paket adi uyusmuyor: ${p} -> ${pkg.name}`);
  if (pkg.type !== 'module') hatalar.push(`${p}: "type": "module" degil`);
}
bilgi.push('6 paket adi ve modul tipi dogrulandi');

// 6. tsconfig paths hedefleri gercekten var mi
const taban = JSON.parse(readFileSync(KOK + 'tsconfig.base.json', 'utf8'));
for (const [ad, hedefler] of Object.entries(taban.compilerOptions?.paths ?? {})) {
  for (const h of hedefler) {
    if (!existsSync(KOK + h.replace(/^\.\//, '')))
      hatalar.push(`tsconfig paths hedefi yok: ${ad} -> ${h}`);
  }
}
bilgi.push('tsconfig paths hedefleri dogrulandi');

for (const b of bilgi) console.log(`  ok  ${b}`);
if (hatalar.length) {
  console.error('\nYAPILANDIRMA HATASI\n');
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}
console.log('Yapilandirma tutarli.');
