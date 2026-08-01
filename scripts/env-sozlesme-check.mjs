#!/usr/bin/env node
/**
 * ORTAM SÖZLEŞMESİ — şema ile `.env.example` senkron mu?
 *
 * ⚠️  NEDEN VAR: sözleşme testleri `AppModule`'ü ayağa kaldırır, yani TÜM env
 *     şemasını doğrular. Şemaya zorunlu bir anahtar eklenip `.env.example`'a
 *     eklenmezse, hata AYAĞA KALKMA anında ve testin sınadığı davranışla
 *     İLGİSİZ bir yerde çıkar:
 *
 *       Error: Ortam yapılandırması geçersiz:
 *         - JWT_SECRET: Required
 *
 *     Bu, "testin kırıldığı yer kırılma sebebiyle ilgisiz" tuzağıdır.
 *
 * ⚠️  BURASI ELLE TUTULAN BİR LİSTE DEĞİLDİR. Anahtarlar `env.schema.ts`'ten
 *     OKUNUR. Elle liste tutulsaydı, şemaya eklenen yeni bir anahtar burada
 *     unutulur ve denetim sessizce delinirdi — bu depoda tekrar tekrar
 *     kapatılan hata sınıfı.
 *
 * Zorunluluk ölçütü: `.optional()` DE `.default()` DE taşımayan anahtar.
 * `.default()` taşıyan anahtar eksikse şema değeri kendisi üretir.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const SEMA = `${KOK}backend/src/config/env.schema.ts`;
const ORNEK = `${KOK}.env.example`;

const hatalar = [];

if (!existsSync(SEMA)) hatalar.push(`Eksik dosya: backend/src/config/env.schema.ts`);
if (!existsSync(ORNEK)) hatalar.push('Eksik dosya: .env.example');
if (hatalar.length > 0) {
  for (const h of hatalar) console.error(`  - ${h}`);
  process.exit(1);
}

/*
 * Şema gövdesi satır satır okunur. Bir anahtarın tanımı birden çok satıra
 * yayılabilir (yorumlar araya girer), bu yüzden `ANAHTAR: z.` gördüğümüz
 * yerden bir sonraki anahtara kadar olan metin o anahtarın tanımıdır.
 */
const semaMetni = readFileSync(SEMA, 'utf8');
const govde = /z\.object\(\{([\s\S]*?)\n\}\);/u.exec(semaMetni)?.[1];
if (govde === undefined) {
  console.error('  - env.schema.ts icinde z.object({...}) bulunamadi');
  process.exit(1);
}

const anahtarDeseni = /^\s{2}([A-Z][A-Z0-9_]*)\s*:\s*z\./gmu;
const konumlar = [...govde.matchAll(anahtarDeseni)].map((m) => ({
  ad: m[1], bas: m.index ?? 0,
}));

const anahtarlar = konumlar.map((k, i) => {
  const son = i + 1 < konumlar.length ? konumlar[i + 1].bas : govde.length;
  const tanim = govde.slice(k.bas, son);
  return {
    ad: k.ad,
    zorunlu: !/\.optional\(\)/u.test(tanim) && !/\.default\(/u.test(tanim),
    varsayilanVar: /\.default\(/u.test(tanim),
  };
});

/** `.env.example` anahtarlari — yorum ve bos satirlar atlanir. */
const ornekAnahtarlar = new Set(
  readFileSync(ORNEK, 'utf8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '' && !s.startsWith('#'))
    .map((s) => s.slice(0, s.indexOf('=')).trim())
    .filter(Boolean),
);

const zorunlular = anahtarlar.filter((a) => a.zorunlu);
const eksikler = zorunlular.filter((a) => !ornekAnahtarlar.has(a.ad));

console.log(`  ${anahtarlar.length} anahtar okundu · ${zorunlular.length} zorunlu`);
console.log(`  zorunlu: ${zorunlular.map((a) => a.ad).join(', ')}`);

if (eksikler.length > 0) {
  console.error('\nORTAM SOZLESMESI BOZUK\n');
  for (const e of eksikler) {
    console.error(
      `  - ${e.ad}: env.schema.ts ZORUNLU kiliyor ama .env.example'da YOK.`,
    );
  }
  console.error(
    '\n.env.example sozlesmenin beyanidir; CI ve gelistirici kurulumu onu' +
      '\ntemel alir. Eksik anahtar, uygulamayi AYAGA KALKMA aninda dusurur.\n',
  );
  process.exit(1);
}

console.log('  Ortam sozlesmesi tutarli: her zorunlu anahtar .env.example icinde.');
