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
                 '.github/actions/kosu-ve-raporla/action.yml',
                 'pnpm-workspace.yaml', 'docker-compose.yml'];
for (const y of yamllar) {
  const tam = KOK + y;
  if (!existsSync(tam)) { hatalar.push(`Eksik dosya: ${y}`); continue; }
  try {
    // ⚠️  KODLAMA ACIKCA VERILIR. `open(...)` sistem varsayilanini kullanir:
    //     Linux'ta UTF-8, Windows'ta cp1254. ASCII disi bir karakter (orn. bir
    //     yorumdaki uyari isareti) denetimi YALNIZCA WINDOWS'TA dusururdu —
    //     yerel ile CI'in ayristigi, bu turda uc kez carptigimiz sinif.
    execFileSync(
      'python3',
      ['-c', 'import sys,yaml; yaml.safe_load(open(sys.argv[1], encoding="utf-8"))', tam],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
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

/*
 * 7. GIRIS NOKTASI — beyan edilen yol, derlemenin URETTIGI yol mu?
 *
 * NEDEN VAR: `package.json` "start" ve Dockerfile CMD'si `dist/main.js`
 * diyordu, ama `backend/tsconfig.json` testleri de kapsadigi icin tsc rootDir'i
 * `backend/` seciyor ve cikti `dist/src/main.js` altina dusuyordu. Iki yol da
 * MODULE_NOT_FOUND verirdi — yani konteyner ACILISTA duserdi.
 *
 * Hata AYLARCA fark edilmedi cunku hicbir sey imaji bir kez bile calistirmadi:
 * derleme geciyor, lint geciyor, testler geciyor. Yalnizca `docker run`
 * gosterebilirdi ve o hic kosulmadi.
 *
 * Bu kontrol o boslugu kapatir: beyan edilen iki yol birbiriyle VE varsa
 * gercek derleme ciktisiyla karsilastirilir. Tam guvence icin CI'da imaj bir
 * kez ayaga kaldirilmalidir; bu kontrol onun ucuz ve bagimliliksiz ikamesidir.
 */
{
  const arka = JSON.parse(readFileSync(KOK + 'backend/package.json', 'utf8'));
  const baslat = arka.scripts?.start ?? '';
  const pkgYol = /node\s+(\S+\.js)/u.exec(baslat)?.[1] ?? null;

  const dockerfile = KOK + 'infrastructure/docker/Dockerfile.backend';
  const dockerMetni = existsSync(dockerfile) ? readFileSync(dockerfile, 'utf8') : '';
  const dockerYol = /CMD\s*\[\s*"node"\s*,\s*"([^"]+)"/u.exec(dockerMetni)?.[1] ?? null;

  if (pkgYol === null) {
    hatalar.push('backend/package.json "start" betiginden giris noktasi okunamadi');
  }
  if (dockerYol === null) {
    hatalar.push('Dockerfile.backend CMD satirindan giris noktasi okunamadi');
  }

  if (pkgYol !== null && dockerYol !== null) {
    // Dockerfile depo kokunden, package.json backend/ icinden yazar.
    const pkgKokten = 'backend/' + pkgYol.replace(/^\.\//u, '');
    const dockerKokten = dockerYol.replace(/^\.\//u, '');
    if (pkgKokten !== dockerKokten) {
      hatalar.push(
        `Giris noktasi uyusmuyor: package.json -> ${pkgKokten}, ` +
          `Dockerfile -> ${dockerKokten}`,
      );
    }

    // Derleme yapilmissa gercek ciktiyla da karsilastir. `dist` yoksa bu adim
    // ATLANIR ve bu bir basari degildir — atlandigi acikca yazilir.
    if (existsSync(KOK + 'backend/dist')) {
      if (!existsSync(KOK + pkgKokten)) {
        hatalar.push(
          `Giris noktasi derleme ciktisinda YOK: ${pkgKokten}. ` +
            'Konteyner acilista MODULE_NOT_FOUND ile duser.',
        );
      } else {
        bilgi.push(`Giris noktasi dogrulandi: ${pkgKokten} (derleme ciktisinda var)`);
      }
    } else {
      bilgi.push(`Giris noktasi beyanlari tutarli: ${pkgKokten} (dist yok, varlik denetlenmedi)`);
    }
  }
}

/*
 * 8. NODE SURUMU TEK KAYNAKTA MI
 *
 * ⚠️  NEDEN VAR: CI `node-version: '22'` kullaniyordu, gelistirme makinesi
 *     Node 24'tu. Yerelde 331/331 gecen birim testleri CI'da dusuyordu ve
 *     fark AYLARCA gorunmezdi — cunku iki taraf da kendi icinde tutarliydi.
 *
 *     `engines` ">=20.11" idi: her seye izin veren bir alt sinir, ayrismayi
 *     ENGELLEMEZ. Uc yer (.nvmrc · engines · ci.yml) birbirini tutmak
 *     ZORUNDADIR; tutmuyorsa burasi kirmizi yanar.
 */
const nvmrcYol = KOK + '.nvmrc';
if (!existsSync(nvmrcYol)) {
  hatalar.push('.nvmrc yok — yerel ve CI Node surumu sabitlenemez.');
} else {
  const nvmrc = readFileSync(nvmrcYol, 'utf8').trim().replace(/^v/u, '');
  const anaSurum = nvmrc.split('.')[0];

  const kokPaket = JSON.parse(readFileSync(KOK + 'package.json', 'utf8'));
  const engines = kokPaket.engines?.node ?? '';
  // Beklenen bicim: ">=24 <25" — hem alt hem UST sinir tasimali.
  const altSinir = /(?:^|\s)>=\s*(\d+)/u.exec(engines)?.[1];
  const ustSinir = /(?:^|\s)<\s*(\d+)/u.exec(engines)?.[1];

  if (altSinir === undefined || ustSinir === undefined) {
    hatalar.push(
      `package.json engines.node ("${engines}") ust sinir tasimiyor. ` +
        'Yalnizca alt sinir vermek surum ayrismasini engellemez; ' +
        `">=${anaSurum} <${Number(anaSurum) + 1}" bicimi kullanilmali.`,
    );
  } else if (altSinir !== anaSurum || Number(ustSinir) !== Number(anaSurum) + 1) {
    hatalar.push(
      `Node surumu uyusmuyor: .nvmrc=${nvmrc} ama engines.node="${engines}".`,
    );
  }

  const isAkislari = ['.github/workflows/ci.yml', '.github/workflows/dependency-boundary.yml'];
  for (const y of isAkislari) {
    const tam = KOK + y;
    if (!existsSync(tam)) continue;
    const icerik = readFileSync(tam, 'utf8');
    const surumler = [...icerik.matchAll(/node-version:\s*'?(\d+)/gu)].map((m) => m[1]);
    const yanlis = [...new Set(surumler)].filter((s) => s !== anaSurum);
    if (yanlis.length > 0) {
      hatalar.push(
        `${y} icinde node-version ${yanlis.join(', ')} kullaniliyor ` +
          `ama .nvmrc ${anaSurum} diyor. Yerelde gecen test CI'da duser.`,
      );
    }
  }

  if (!hatalar.some((h) => h.includes('.nvmrc') || h.includes('node-version') || h.includes('engines.node'))) {
    bilgi.push(`Node surumu tek kaynakta: ${anaSurum} (.nvmrc · engines · is akislari)`);
  }
}

for (const b of bilgi) console.log(`  ok  ${b}`);
if (hatalar.length) {
  console.error('\nYAPILANDIRMA HATASI\n');
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}
console.log('Yapilandirma tutarli.');
