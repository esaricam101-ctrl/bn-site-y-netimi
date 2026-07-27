#!/usr/bin/env node
/**
 * Belge baglanti denetleyicisi — bagimliliksiz.
 *
 * Markdown belgelerindeki goreli baglantilarin gercekten var olan bir dosyayi
 * isaret ettigini dogrular. markdownlint bicimi denetler, HEDEFI denetlemez:
 * `[0003](docs/adr/log/olmayan-dosya.md)` bicimsel olarak kusursuzdur.
 *
 * Bu sinif hata bu depoda iki kez gerceklesti (DEVLOG TODO-6): README'de iki
 * ADR baglantisi yeniden adlandirilmis dosyalari isaret ediyordu ve
 * VALIDATION_REPORT'un byte-es kopyasi, goreli bir ADR baglantisinin iki farkli
 * dizin derinliginde ayni anda dogru olamamasi yuzunden bozuktu.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// .pathname Windows'ta '/C:/...' verir ve birlestirince 'C:\C:\...' olusur.
const KOK = fileURLToPath(new URL('..', import.meta.url));

const ATLA = new Set(['node_modules', '.git', 'dist', '.next', '.derleme']);

// [metin](hedef) — hedefteki #parca ve baslik metni ayiklanir
const BAGLANTI = /\[[^\]]*\]\(\s*([^)\s#]+)(?:#[^)\s]*)?(?:\s+"[^"]*")?\s*\)/g;

function* markdownDosyalari(dizin) {
  for (const ad of readdirSync(dizin)) {
    if (ATLA.has(ad)) continue;
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) yield* markdownDosyalari(tam);
    else if (ad.endsWith('.md')) yield tam;
  }
}

const kirik = [];
let taranan = 0;
let baglanti = 0;

for (const dosya of markdownDosyalari(KOK)) {
  taranan++;
  const goreli = relative(KOK, dosya).replaceAll('\\', '/');
  const icerik = readFileSync(dosya, 'utf8');

  for (const eslesme of icerik.matchAll(BAGLANTI)) {
    const hedef = eslesme[1] ?? '';
    // Mutlak URL ve sayfa ici capalar bu betigin kapsaminda degildir.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(hedef)) continue;

    baglanti++;
    let cozulmus;
    try {
      cozulmus = resolve(dirname(dosya), decodeURIComponent(hedef));
    } catch {
      cozulmus = resolve(dirname(dosya), hedef);
    }
    if (!existsSync(cozulmus)) {
      kirik.push({ dosya: goreli, hedef });
    }
  }
}

console.log(`Belge baglantisi: ${taranan} belge, ${baglanti} goreli baglanti tarandi.`);

// Bos tarama = yapilandirma hatasi (bkz. boundary.mjs ayni koruma).
if (taranan === 0 || baglanti === 0) {
  console.error('\nYAPILANDIRMA HATASI: hicbir belge veya baglanti taranmadi. Klasor yollari degismis olabilir.');
  process.exit(1);
}

if (kirik.length > 0) {
  console.error('\nKIRIK BELGE BAGLANTISI\n');
  for (const k of kirik) {
    console.error(`  ${k.dosya}`);
    console.error(`    -> ${k.hedef}`);
    console.error('    Hedef dosya yok. Yeniden adlandirilmis ya da tasinmis olabilir.\n');
  }
  process.exit(1);
}

console.log('Kirik baglanti yok.');
