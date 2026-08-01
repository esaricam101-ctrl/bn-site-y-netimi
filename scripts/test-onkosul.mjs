#!/usr/bin/env node
/**
 * BİRİM TESTİ ÖN KOŞULU — derlenmiş çıktı var mı.
 *
 * ⚠️  NEDEN VAR: birim testlerinin bir kısmı `backend/dist` ve
 *     `tests/.derleme` altındaki DERLENMİŞ çıktıyı import ediyor. Bu bağımlılık
 *     hiçbir yerde yazılı değildi ve GELİŞTİRME MAKİNESİNDE GÖRÜNMÜYORDU:
 *     çıktılar önceki derlemelerden kalmış oluyor, testler geçiyordu.
 *
 *     Temiz bir çalışma kopyasında ise hata şuydu:
 *
 *       Error [ERR_MODULE_NOT_FOUND]: Cannot find module
 *       '.../tests/.derleme/security/sifre.js'
 *
 *     Bu mesaj sorunu SÖYLEMİYOR. Okuyan kişi eksik bir dosya, bozuk bir
 *     import ya da yanlış bir yol arar; asıl eksik olan bir DERLEME ADIMIDIR.
 *
 * ⚠️  LİSTE ELLE TUTULMAZ. Gereken çıktılar test dosyalarındaki import
 *     yollarından TÜRETİLİR. Elle tutulan bir liste, yeni bir test eklendiğinde
 *     güncellenmeyi unutur ve koruma sessizce delinir — bu depoda tekrar tekrar
 *     kapatılan hata sınıfı.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const TEST_DIZINI = resolve(KOK, 'tests/unit');

/** Hangi derleme çıktısı hangi komutla üretilir. */
const URETEN_KOMUT = [
  { onEk: 'backend/dist', komut: 'pnpm build' },
  { onEk: 'tests/.derleme', komut: 'pnpm build:test' },
];

const eksikler = new Map();

for (const dosya of readdirSync(TEST_DIZINI).filter((d) => d.endsWith('.mjs'))) {
  const tam = resolve(TEST_DIZINI, dosya);
  const icerik = readFileSync(tam, 'utf8');

  /*
   * Dort yazim bicimi de yakalanir. Yol ACIK PARANTEZDEN SONRAKI SATIRDA
   * olabilir (`new URL(\n  '../../backend/dist/...',\n  import.meta.url)`),
   * bu yuzden desenler bosluk ve satir sonuna toleransli.
   */
  const yollar = [
    ...icerik.matchAll(/from\s+'(\.[^']+)'/gu),
    ...icerik.matchAll(/import\(\s*'(\.[^']+)'/gu),
    ...icerik.matchAll(/new URL\(\s*'(\.[^']+)'/gu),
    ...icerik.matchAll(/createRequire\(\s*'(\.[^']+)'/gu),
  ].map((m) => m[1]);

  for (const yol of yollar) {
    const cozulen = resolve(dirname(tam), yol);
    const gorece = relative(KOK, cozulen).replace(/\\/gu, '/');
    const uretici = URETEN_KOMUT.find((u) => gorece.startsWith(u.onEk));
    if (!uretici) continue;             // kaynak dosyaya bakan import; derleme gerekmez
    if (existsSync(cozulen)) continue;

    if (!eksikler.has(uretici.komut)) eksikler.set(uretici.komut, new Set());
    eksikler.get(uretici.komut).add(`${gorece}  (${dosya})`);
  }
}

if (eksikler.size === 0) process.exit(0);

console.error('\nBIRIM TESTLERI DERLENMIS CIKTIYA BAGLI — CIKTI YOK\n');
for (const [komut, yollar] of eksikler) {
  console.error(`  Eksik (${komut} uretir):`);
  for (const y of [...yollar].sort()) console.error(`    - ${y}`);
  console.error('');
}
console.error('Once su komutlari calistirin:\n');
for (const komut of eksikler.keys()) console.error(`    ${komut}`);
console.error('\nSonra `pnpm test:unit` tekrar denenebilir.\n');
process.exit(1);
