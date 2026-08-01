#!/usr/bin/env node
/**
 * Veritabanı komut sarmalayıcısı — bağımlılıksız.
 *
 * İKİ SORUNU ÇÖZER:
 *
 * 1. ROL AYRIMI (ADR-0002). Migration şema değiştirir ve `bnos_migrator`
 *    rolüyle koşmalıdır; uygulama `bnos_app` ile bağlanır ve `CREATE`
 *    yetkisi YOKTUR. Prisma tek bir `DATABASE_URL` okur, bu yüzden komuta
 *    göre doğru URL yerleştirilir. Bu sarmalayıcı olmadan `prisma migrate`
 *    uygulama rolüyle koşar ve "permission denied for schema public" ile
 *    düşer — ya da daha kötüsü, biri rolü BYPASSRLS yapıp RLS'i sessizce
 *    devre dışı bırakır.
 *
 * 2. `.env` KONUMU. Ortam dosyası depo KÖKÜNDEDİR; Prisma ise şemanın
 *    yanına bakar (`database/.env`). İki kopya tutmak, birinin güncellenip
 *    diğerinin unutulması demektir.
 *
 * Kullanım:
 *   node scripts/db.mjs migrate     migration uygula   (bnos_migrator)
 *   node scripts/db.mjs seed        tohum verisi       (bnos_app — RLS'i sınar)
 *   node scripts/db.mjs generate    Prisma istemcisi
 *   node scripts/db.mjs reset       sıfırla + migration + tohum (bnos_migrator)
 *   node scripts/db.mjs status      migration durumu
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = dirname(dirname(fileURLToPath(import.meta.url)));
const VERITABANI = join(KOK, 'database');

/** `.env` okuyucu — tırnak soyar, yorum ve boş satır atlar. */
function ortamiOku(yol) {
  if (!existsSync(yol)) return {};
  const sonuc = {};
  for (const ham of readFileSync(yol, 'utf8').split(/\r?\n/u)) {
    const satir = ham.trim();
    if (satir === '' || satir.startsWith('#')) continue;
    const ayrac = satir.indexOf('=');
    if (ayrac < 0) continue;
    const anahtar = satir.slice(0, ayrac).trim();
    let deger = satir.slice(ayrac + 1).trim();
    if (
      (deger.startsWith('"') && deger.endsWith('"')) ||
      (deger.startsWith("'") && deger.endsWith("'"))
    ) {
      deger = deger.slice(1, -1);
    }
    sonuc[anahtar] = deger;
  }
  return sonuc;
}

const ortam = ortamiOku(join(KOK, '.env'));
const komut = process.argv[2] ?? 'status';

const UYGULAMA_URL = process.env['DATABASE_URL'] ?? ortam['DATABASE_URL'];
const MIGRATE_URL =
  process.env['MIGRATE_DATABASE_URL'] ?? ortam['MIGRATE_DATABASE_URL'] ?? UYGULAMA_URL;

if (UYGULAMA_URL === undefined) {
  console.error(
    'DATABASE_URL bulunamadi. Depo kokunde .env dosyasi olmali ' +
      '(`cp .env.example .env`).',
  );
  process.exit(1);
}

/**
 * Hangi komut hangi rolle koşar.
 *
 * `seed` KASITLI olarak uygulama rolüyle koşar: tohum verisi yazılırken RLS
 * fiilen sınanır. Migrator rolüyle koşsaydı politikalar yanlış olsa bile
 * tohum yüklenir ve hata üretim gününe kadar görünmezdi.
 */
const MIGRATOR_KOMUTLARI = new Set(['migrate', 'reset', 'status', 'diff']);
const url = MIGRATOR_KOMUTLARI.has(komut) ? MIGRATE_URL : UYGULAMA_URL;

const ARGUMANLAR = {
  migrate: ['prisma', 'migrate', 'deploy'],
  status: ['prisma', 'migrate', 'status'],
  generate: ['prisma', 'generate'],
  /**
   * `--skip-seed` KASITLIDIR. `prisma migrate reset` tohum komutunu kendi
   * alt süreci olarak koşar ve migrator URL'ini miras verir; tohum o zaman
   * RLS'i sınamamış olur. Tohum ayrı adımda, uygulama rolüyle koşulur.
   */
  reset: ['prisma', 'migrate', 'reset', '--force', '--skip-seed'],
  seed: ['tsx', 'seeds/seed.ts'],
};

const argv = ARGUMANLAR[komut];
if (argv === undefined) {
  console.error(`Bilinmeyen komut: ${komut}`);
  console.error(`Gecerli komutlar: ${Object.keys(ARGUMANLAR).join(' · ')}`);
  process.exit(1);
}

function calistir(adim, komutArgv, komutUrl) {
  const rol = komutUrl.replace(/^postgresql:\/\/([^:]+).*$/u, '$1');
  console.log(`db.mjs · ${adim} · rol: ${rol}`);
  return spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    komutArgv,
    {
      cwd: VERITABANI,
      // Migrator URL'i YALNIZCA bu alt surece verilir; kabuk ortamina sizmaz.
      env: { ...process.env, ...ortam, DATABASE_URL: komutUrl },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
}

const sonuc = calistir(komut, argv, url);
if ((sonuc.status ?? 1) !== 0) process.exit(sonuc.status ?? 1);

/**
 * SIFIRLAMA SONRASI YETKI ONARIMI.
 *
 * ⚠️  `prisma migrate reset` semayi DUSURUP YENIDEN YARATIR. Yeniden
 *     yaratilan sema, `database/init/01-roles.sql` icindeki
 *     `GRANT USAGE ON SCHEMA public TO bnos_app` satirini TASIMAZ — o izin
 *     eski sema nesnesine baglidi. Init betigi de yalnizca bos bir veri
 *     dizininde kostugu icin tekrar calismaz.
 *
 *     Sonuc olculdu: sifirlamadan sonra tohum `permission denied for schema
 *     public` ile duser. Izin uygulama rolunun BUTUN sorgularini etkiler,
 *     yani hata tohuma ozgu degildir.
 *
 *     Tablo ve dizi izinleri migration'lardan geri gelir; SEMA izni
 *     gelmez. Burada aciklikla geri verilir.
 *
 *     Rol adi SABIT YAZILMAZ, uygulama URL'inden turetilir.
 */
function semaYetkileriniOnar() {
  const rol = UYGULAMA_URL.replace(/^postgresql:\/\/([^:]+).*$/u, '$1');
  const sql = [
    `GRANT USAGE ON SCHEMA public TO ${rol};`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${rol};`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${rol};`,
  ].join('\n');
  console.log(`db.mjs · sema yetkileri onariliyor · hedef rol: ${rol}`);
  return spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'execute', '--url', MIGRATE_URL, '--stdin'],
    {
      cwd: VERITABANI,
      env: { ...process.env, ...ortam, DATABASE_URL: MIGRATE_URL },
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
    },
  );
}

// Sifirlama sonrasi tohum AYRI adimda ve UYGULAMA rolüyle koşar.
if (komut === 'reset') {
  const onarim = semaYetkileriniOnar();
  if ((onarim.status ?? 1) !== 0) process.exit(onarim.status ?? 1);

  const tohum = calistir('seed', ARGUMANLAR.seed, UYGULAMA_URL);
  process.exit(tohum.status ?? 1);
}

process.exit(0);
