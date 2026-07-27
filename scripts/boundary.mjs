#!/usr/bin/env node
/**
 * Paket sınırı doğrulayıcı — bağımlılıksız.
 *
 * Kaynak: ADR v1.1 §40 · BFS v1 §1.2
 *
 * dependency-cruiser'ın CI'daki karşılığıdır ancak HİÇBİR bağımlılık
 * gerektirmez; paket kayıt sunucusuna erişimi olmayan ortamda da çalışır.
 * dependency-cruiser AST tabanlıdır ve asıl kaynaktır; bu betik en kritik
 * kuralın her koşulda doğrulanabilmesini garanti eder.
 *
 * BOŞ EŞLEŞME KORUMASI: bir kural hiçbir kaynak dosyayla eşleşmiyorsa bu
 * BAŞARI değil YAPILANDIRMA HATASIDIR. Klasör yeniden adlandırıldığında
 * sessizce devre dışı kalan denetleyici, hiç olmayan denetleyiciden kötüdür.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// .pathname Windows'ta '/C:/...' verir ve birlestirince 'C:\C:\...' olusur.
const KOK = fileURLToPath(new URL('..', import.meta.url));

/** kaynak deseni → yasak hedef desenleri */
const KURALLAR = [
  {
    ad: 'core-domain-apartman-domaine-bagimli-olamaz',
    kaynak: /^shared\/core-domain\//,
    yasak: [/@bnos\/apartman-domain/, /apartman-domain/],
    aciklama:
      'ADR v1.1 §40 — core-domain dikeyden bagimsizdir. Apartmana ozgu bir kavrama ' +
      'ihtiyac duyuyorsa ya kavram core-domaine ait degildir ya da bir port arkasina alinmalidir.',
  },
  {
    ad: 'kernel-yaprak-pakettir',
    kaynak: /^shared\/kernel\//,
    yasak: [/@bnos\/(core-domain|apartman-domain|bnos-client|module-sdk|ui-tokens)/],
    aciklama: 'BFS v1 §1.2 — kernel hicbir domain paketine bagimli olamaz.',
  },
  {
    ad: 'domain-katmani-framework-bilmez',
    kaynak: /^shared\/(core-domain|apartman-domain)\//,
    yasak: [/@prisma\/client/, /^prisma$/, /@nestjs\//, /^next(\/|$)/, /^react(\/|$)/],
    aciklama:
      'BFS v1 §1.3 — domain katmani framework ve kalicilik bagimsizdir. ' +
      'Kalicilik ihtiyaci bir repository portu arkasina alinir.',
  },
  {
    ad: 'bnos-client-domain-bilmez',
    kaynak: /^shared\/bnos-client\//,
    yasak: [/@bnos\/(core-domain|apartman-domain)/],
    aciklama:
      'AIS v1 §2 — bnos-client BNOS cekirdegini tuketir; is kurallarini tasimaz. ' +
      'Domain bilgisi cagiran tarafta kalir.',
  },
  {
    ad: 'ui-tokens-yaprak-pakettir',
    kaynak: /^shared\/ui-tokens\//,
    yasak: [/@bnos\//, /^react(\/|$)/, /^next(\/|$)/],
    aciklama:
      'Backlog O-2 — ui-tokens tek tasarim kaynagidir ve hicbir seye bagimli olamaz; ' +
      'aksi halde web ve mobil paylasamaz.',
  },
];

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s+['"]([^'"]+)['"]/g;
const REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

function* tsDosyalari(dizin) {
  for (const ad of readdirSync(dizin)) {
    if (ad === 'node_modules' || ad === 'dist' || ad === '.next' || ad.startsWith('.')) continue;
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) yield* tsDosyalari(tam);
    else if (/\.(ts|tsx|mts|cts)$/.test(ad)) yield tam;
  }
}

const ihlaller = [];
const eslesenDosyaSayisi = new Map(KURALLAR.map((k) => [k.ad, 0]));
let taranan = 0;

for (const kok of ['shared', 'backend', 'frontend', 'database']) {
  const tam = join(KOK, kok);
  try { statSync(tam); } catch { continue; }

  for (const dosya of tsDosyalari(tam)) {
    taranan++;
    const goreli = relative(KOK, dosya).replaceAll('\\', '/');
    const icerik = readFileSync(dosya, 'utf8');
    const hedefler = [
      ...[...icerik.matchAll(IMPORT)].map((m) => m[1]),
      ...[...icerik.matchAll(REQUIRE)].map((m) => m[1]),
    ];

    for (const kural of KURALLAR) {
      if (!kural.kaynak.test(goreli)) continue;
      eslesenDosyaSayisi.set(kural.ad, (eslesenDosyaSayisi.get(kural.ad) ?? 0) + 1);

      for (const hedef of hedefler) {
        if (kural.yasak.some((y) => y.test(hedef))) {
          ihlaller.push({ kural: kural.ad, dosya: goreli, hedef, aciklama: kural.aciklama });
        }
      }
    }
  }
}

console.log(`Paket siniri: ${taranan} dosya tarandi, ${KURALLAR.length} kural uygulandi.`);
for (const k of KURALLAR) {
  console.log(`  ${String(eslesenDosyaSayisi.get(k.ad)).padStart(3)} dosya  ${k.ad}`);
}

// --- Bos esleme korumasi ---
const bosKurallar = KURALLAR.filter((k) => (eslesenDosyaSayisi.get(k.ad) ?? 0) === 0);
if (bosKurallar.length > 0) {
  console.error('\nYAPILANDIRMA HATASI — kural hicbir dosyayla eslesmiyor\n');
  for (const k of bosKurallar) {
    console.error(`  [${k.ad}]`);
    console.error(`    kaynak deseni: ${k.kaynak}`);
    console.error(`    Klasor yeniden adlandirilmis olabilir. Sessizce devre disi kalan`);
    console.error(`    denetleyici, hic olmayan denetleyiciden kotudur.\n`);
  }
  process.exit(1);
}

if (ihlaller.length > 0) {
  console.error('\nPAKET SINIRI IHLALI\n');
  for (const i of ihlaller) {
    console.error(`  [${i.kural}]`);
    console.error(`    ${i.dosya}  ->  ${i.hedef}`);
    console.error(`    ${i.aciklama}\n`);
  }
  console.error('Ayrinti: docs/bfs/BFS-v1.md §1.2');
  process.exit(1);
}

console.log('\nIhlal yok.');
