#!/usr/bin/env node
/**
 * RLS POLİTİKA KAPSAMI tarayıcısı — migration SQL'lerini okur, bağımlılıksız.
 *
 * NEDEN VAR: `scripts/rls-scan.mjs` UYGULAMA tarafını denetler — bir sorgunun
 * tenant bağlamı içinden çalıştığını. Ama hiç kimse VERİTABANI tarafını
 * denetlemiyordu: yeni bir tabloya `ENABLE ROW LEVEL SECURITY` ve `CREATE
 * POLICY` yazmayı unutmak
 *
 *   · derleme hatası vermez,
 *   · lint hatası vermez,
 *   · testleri kırmaz,
 *   · uygulama tarayıcısına da yakalanmaz,
 *
 * ve sonuç TENANT İZOLASYONUNUN SESSİZCE KALKMASIDIR — bir apartmanın
 * yöneticisi başka apartmanın banka hareketlerini görür. Hata mesajı yoktur;
 * yalnızca fazladan satırlar döner.
 *
 * Bu yüzden kural veri olarak burada durur: migration'da `CREATE TABLE x`
 * geçen her tablo, ya politika almış olmalı ya da MUAF LİSTESİNDE gerekçesiyle
 * yazılı olmalıdır.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('..', import.meta.url));
const MIGRATIONS = join(KOK, 'database', 'prisma', 'migrations');

/**
 * RLS TAŞIMAYAN tablolar ve GEREKÇELERİ.
 *
 * Liste kısa olmak zorundadır: her satır "bu tabloyu her tenant görebilir"
 * demektir. Yeni satır eklemek bilinçli bir güvenlik kararıdır.
 */
const MUAF = new Map([
  [
    'tenant',
    'Tenant kataloğu (0001). Tenant\'ın kendisi tenant\'a göre süzülemez: ' +
      'oturum açma, hangi tenant\'a ait olduğunu bilmeden bu tabloyu okumak ' +
      'zorundadır (BFS v1 §2.4).',
  ],
  [
    'oturum_dizini',
    'Oturum dizini (0002). Jeton doğrulaması tenant bağlamı KURULMADAN ÖNCE ' +
      'yapılır; bağlam zaten jetondan gelir (ADR-0006 Kapı 1).',
  ],
  [
    '_prisma_migrations',
    'Prisma\'nın kendi tablosu; uygulama rolü erişmez.',
  ],
]);

const dizinler = readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

/** Tablo adı → onu oluşturan migration. */
const olusturulan = new Map();
/** `tenant_id` sütunu TAŞIYAN tablolar — toplu politika yalnızca bunları kapsar. */
const tenantKapsamli = new Set();
/** Politika/ENABLE almış tablolar. */
const enableAlan = new Set();
const politikaAlan = new Set();

/**
 * TOPLU (dinamik) politika bloğu — 0001'de kullanılan biçim:
 *
 *   DO $$ … FOR t IN SELECT … WHERE a.attname = 'tenant_id' … LOOP
 *     EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
 *     EXECUTE format('CREATE POLICY %I ON %I …', …);
 *   END LOOP; END $$;
 *
 * ⚠️  BU BLOK DİNAMİKTİR ve YALNIZCA O ANDA VAR OLAN tabloları kapsar. Sonradan
 *     eklenen tablo bu döngüden geçmez; kendi migration'ında açıkça politika
 *     almak zorundadır. Tarayıcının varlık nedeni tam olarak budur.
 */
function topluPolitikaVarMi(sql) {
  return (
    /attname\s*=\s*'tenant_id'/iu.test(sql) &&
    /EXECUTE\s+format\(\s*'ALTER TABLE %I ENABLE\s+ROW\s+LEVEL\s+SECURITY'/iu.test(sql) &&
    /EXECUTE\s+format\(\s*\r?\n?\s*'CREATE POLICY %I ON %I/iu.test(sql)
  );
}

for (const dizin of dizinler) {
  let sql;
  try {
    sql = readFileSync(join(MIGRATIONS, dizin, 'migration.sql'), 'utf8');
  } catch {
    continue;
  }

  for (const m of sql.matchAll(
    /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z_0-9]+)"?\s*\(([\s\S]*?)\n\);/giu,
  )) {
    const [, tablo, govde] = m;
    if (!olusturulan.has(tablo)) olusturulan.set(tablo, dizin);
    if (/"?tenant_id"?\s+UUID/iu.test(govde)) tenantKapsamli.add(tablo);
  }
  // Sonradan `tenant_id` eklenen tablo da toplu politika kapsamına girer.
  for (const m of sql.matchAll(
    /ALTER TABLE\s+"?([a-z_0-9]+)"?\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?tenant_id"?/giu,
  )) {
    tenantKapsamli.add(m[1]);
  }
  // DROP edilmiş tablo artık yoktur (0010 yeniden adlandırmaları gibi).
  for (const m of sql.matchAll(/DROP TABLE(?:\s+IF EXISTS)?\s+"?([a-z_0-9]+)"?/giu)) {
    olusturulan.delete(m[1]);
    enableAlan.delete(m[1]);
    politikaAlan.delete(m[1]);
    tenantKapsamli.delete(m[1]);
  }
  // Yeniden adlandırma: politika ve ENABLE eski adla verilmiş olabilir.
  for (const m of sql.matchAll(
    /ALTER TABLE\s+"?([a-z_0-9]+)"?\s+RENAME TO\s+"?([a-z_0-9]+)"?/giu,
  )) {
    const [, eski, yeni] = m;
    if (olusturulan.has(eski)) {
      olusturulan.set(yeni, olusturulan.get(eski));
      olusturulan.delete(eski);
    }
    if (enableAlan.delete(eski)) enableAlan.add(yeni);
    if (politikaAlan.delete(eski)) politikaAlan.add(yeni);
    // `tenant_id` bilgisi de taşınır: 0010'da `daire_gorevlisi` →
    // `site_personeli` yeniden adlandırması bu satır olmadan tabloyu "tenant
    // kapsamlı değil" gösteriyordu.
    if (tenantKapsamli.delete(eski)) tenantKapsamli.add(yeni);
  }

  for (const m of sql.matchAll(
    /ALTER TABLE\s+"?([a-z_0-9]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/giu,
  )) {
    enableAlan.add(m[1]);
  }
  for (const m of sql.matchAll(
    /CREATE POLICY\s+"?[a-z_0-9]+"?\s+ON\s+"?([a-z_0-9]+)"?/giu,
  )) {
    politikaAlan.add(m[1]);
  }

  // Toplu blok EN SONDA değerlendirilir: o migration'da oluşturulan tablolar
  // da döngüye girer (0001 böyle çalışır).
  if (topluPolitikaVarMi(sql)) {
    for (const tablo of tenantKapsamli) {
      enableAlan.add(tablo);
      politikaAlan.add(tablo);
    }
  }
}

const bulgular = [];

for (const [tablo, dizin] of olusturulan) {
  if (MUAF.has(tablo)) continue;
  // `tenant_id` taşımayan tablo tenant kapsamlı değildir; RLS politikası da
  // yazılamaz (politika `tenant_id = app_tenant_id()` üzerine kuruludur).
  // Böyle bir tablo eklenirse MUAF listesine gerekçesiyle girmesi gerekir —
  // aşağıdaki uyarı bunu söyler.
  if (!tenantKapsamli.has(tablo)) {
    bulgular.push({
      tablo, dizin,
      eksikler: [
        '`tenant_id` sutunu YOK — tenant kapsamli degil. Bilincli ise MUAF ' +
        'listesine gerekcesiyle yazilmali',
      ],
    });
    continue;
  }
  const eksikler = [];
  if (!enableAlan.has(tablo)) eksikler.push('ENABLE ROW LEVEL SECURITY');
  if (!politikaAlan.has(tablo)) eksikler.push('CREATE POLICY');
  if (eksikler.length > 0) bulgular.push({ tablo, dizin, eksikler });
}

// Politikası olup ENABLE edilmemiş tablo daha da sinsi: politika VARDIR ama
// PostgreSQL onu hiç uygulamaz.
for (const tablo of politikaAlan) {
  if (enableAlan.has(tablo)) continue;
  if (bulgular.some((b) => b.tablo === tablo)) continue;
  bulgular.push({
    tablo,
    dizin: olusturulan.get(tablo) ?? '?',
    eksikler: ['ENABLE ROW LEVEL SECURITY (politika var ama UYGULANMIYOR)'],
  });
}

if (bulgular.length === 0) {
  console.log(
    `RLS politika taramasi: temiz (${olusturulan.size} tablo, ` +
      `${MUAF.size} muaf).`,
  );
  process.exit(0);
}

console.error('RLS POLITIKA EKSIGI\n');
console.error(
  'Asagidaki tablolar RLS politikasi TASIMIYOR. Bu kod derlenir, lint gecer\n' +
    've testler yesil kalir; sonuc TENANT IZOLASYONUNUN SESSIZCE KALKMASIDIR:\n' +
    'bir apartmanin yoneticisi baska apartmanin verisini gorur ve hicbir hata\n' +
    'mesaji cikmaz — yalnizca fazladan satirlar doner.\n',
);
for (const b of bulgular) {
  console.error(`  ${b.tablo}  (${b.dizin})`);
  console.error(`      eksik: ${b.eksikler.join(' · ')}`);
}
console.error(
  '\nCozum: migration\'a asagidakileri ekleyin (ADR-0002 · ADR-0008):\n' +
    '  ALTER TABLE <tablo> ENABLE ROW LEVEL SECURITY;\n' +
    '  ALTER TABLE <tablo> FORCE  ROW LEVEL SECURITY;\n' +
    '  CREATE POLICY <tablo>_tenant_isolation ON <tablo>\n' +
    '    USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());\n' +
    '\nTablo gercekten muaf olmali ise scripts/rls-politika-scan.mjs icindeki\n' +
    'MUAF listesine GEREKCESIYLE yazin. Gerekcesiz muafiyet kabul edilmez.',
);
process.exit(1);
