#!/usr/bin/env node
/**
 * RLS bağlam tarayıcısı — bağımlılıksız.
 *
 * NEDEN VAR: RLS taşıyan bir tabloyu tenant bağlamı KURMADAN sorgulamak
 * derleme hatası vermez, lint hatası vermez, tip hatası vermez. Yalnızca
 * çalışma zamanında ve YALNIZCA veritabanı ayaktayken patlar:
 *
 *     ERROR: Tenant baglami kurulmadan sorgu calistirilamaz
 *
 * Bu hata 30 çağrı yerinde birden vardı ve aylarca fark edilmedi; çünkü
 * PostgreSQL kurulu olmadan hiçbir okuma ucu hiç çalıştırılmamıştı. Her okuma
 * ucu 500 dönüyordu ve bunu gösteren tek şey ayakta bir veritabanıydı.
 *
 * KURAL: RLS taşıyan modele yapılan her Prisma çağrısı ya `tenantIslemi`
 * içinden (`tx.<model>`) yapılır ya da hiç yapılmaz. `sistemIslemi` RLS'i
 * ATLAMAZ — yalnızca bağlam kurmaz; bu yüzden orada yalnızca RLS TAŞIMAYAN
 * katalog tabloları kullanılabilir.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const TARANAN = join(KOK, 'backend', 'src');

/**
 * RLS TAŞIMAYAN modeller — migration 0001'de `tenant`, 0002'de `oturum_dizini`
 * bilinçli olarak muaf tutulmuştur (BFS v1 §2.4). Bu liste migration'daki
 * gerekçeyle BİREBİR eşleşmelidir.
 */
const RLS_SIZ_MODELLER = new Set(['tenant', 'oturumDizini']);

function dosyalar(dizin) {
  const sonuc = [];
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) sonuc.push(...dosyalar(yol));
    else if (ad.endsWith('.ts')) sonuc.push(yol);
  }
  return sonuc;
}

const bulgular = [];

for (const yol of dosyalar(TARANAN)) {
  const metin = readFileSync(yol, 'utf8');
  const satirlar = metin.split(/\r?\n/u);

  satirlar.forEach((satir, i) => {
    // `this.prisma.<model>.<op>` — tenantIslemi/sistemIslemi DIŞINDA doğrudan
    // model erişimi. `tx.<model>` biçimi zaten bağlam içindedir.
    const m = /this\.prisma\.([a-zA-Z]+)\.(find|count|create|update|delete|aggregate|groupBy|upsert)/u.exec(satir);
    if (m === null) return;
    const model = m[1];
    if (RLS_SIZ_MODELLER.has(model)) return;

    bulgular.push({
      yol: relative(KOK, yol).replace(/\\/gu, '/'),
      satir: i + 1,
      model,
      metin: satir.trim(),
    });
  });

  // `sistemIslemi` icinde RLS'li modele dokunmak — daha sinsi bir bicim.
  const sistemBloklari = [...metin.matchAll(/sistemIslemi\s*\(/gu)];
  for (const blok of sistemBloklari) {
    // Kaba ama yeterli: cagriyi izleyen 400 karakteri tarar.
    const parca = metin.slice(blok.index, blok.index + 400);
    const modeller = [...parca.matchAll(/\btx\.([a-zA-Z]+)\./gu)].map((x) => x[1]);
    for (const model of modeller) {
      if (RLS_SIZ_MODELLER.has(model)) continue;
      if (model === '$executeRaw' || model === '$queryRaw') continue;
      const satirNo = metin.slice(0, blok.index).split(/\r?\n/u).length;
      bulgular.push({
        yol: relative(KOK, yol).replace(/\\/gu, '/'),
        satir: satirNo,
        model,
        metin: `sistemIslemi icinde RLS'li model: tx.${model}`,
      });
    }
  }
}

if (bulgular.length === 0) {
  console.log('RLS baglam taramasi: temiz.');
  process.exit(0);
}

console.error('RLS BAGLAM IHLALI\n');
console.error(
  'RLS tasiyan bir tabloya tenant baglami kurulmadan erisiliyor. Bu kod\n' +
    'derlenir ve lint gecer ama CALISMA ZAMANINDA her istekte 500 doner:\n' +
    '  ERROR: Tenant baglami kurulmadan sorgu calistirilamaz\n',
);
for (const b of bulgular) {
  console.error(`  ${b.yol}:${b.satir}  [${b.model}]`);
  console.error(`      ${b.metin}`);
}
console.error(
  `\n${bulgular.length} ihlal. Cozum: cagriyi ` +
    '`this.prisma.tenantIslemi((tx) => tx.<model>.<op>(...), <tenantId>)` icine alin.',
);
process.exit(1);
