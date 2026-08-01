/**
 * Veritabani kisit ihlallerinin HTTP hatasina cevrilmesi.
 *
 * NEDEN ONEMLI: bu katman yokken semadaki HER koruma (kismi unique index'ler,
 * CHECK kisitlari, yabanci anahtarlar) istemciye 500 "beklenmeyen bir sorun
 * olustu" olarak donuyordu. Kullanici "ayni IBAN zaten kayitli" yerine "sistem
 * bozuldu" goruyordu.
 *
 * Test derlenmis backend cikisini okur: cevirici `@prisma/client` tiplerine
 * bagimlidir ve kaynaktan dogrudan import edilemez.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/*
 * `require` BACKEND DIST'INDEN kurulur, bu dosyadan degil: cevirici
 * `@prisma/client` ve `@bnos/core-domain` paketlerini cozmek zorundadir ve
 * pnpm workspace'inde bu bagimliliklar backend'in node_modules'unda durur.
 * Cozum tabani tests/ olsaydi modul bulunamazdi.
 */
const CEVIRICI = new URL(
  '../../backend/dist/common/errors/prisma-hata-cevirisi.js',
  import.meta.url,
);
const require = createRequire(CEVIRICI);
/*
 * ⚠️  `fileURLToPath` KULLANILIR, `.pathname.slice(1)` DEGIL.
 *
 *     Eski hali Windows'a ozel bir yamaydi: orada `pathname` `/C:/...`
 *     verir ve bastaki egik cizgi atilmaliydi. LINUX'TA ise `pathname`
 *     zaten `/home/...`; ayni dilim MUTLAK YOLU BOZAR ve
 *     `Cannot find module 'home/runner/...'` hatasi verir.
 *
 *     Hata yerelde HIC gorunmezdi; yalnizca CI'da (Linux) ortaya cikti.
 *     Platform ayrimi elle yapilmaz, Node'a birakilir.
 */
const { prismaHatasiniCevir } = require(fileURLToPath(CEVIRICI));
const { Prisma } = require('@prisma/client');

function bilinen(kod, mesaj, meta) {
  return new Prisma.PrismaClientKnownRequestError(mesaj, {
    code: kod, clientVersion: '5.22.0', ...(meta === undefined ? {} : { meta }),
  });
}

/* ------------------------------- Tekillik -------------------------------- */

test('P2002: taninan kisit adi kullanici diline cevrilir', () => {
  const h = prismaHatasiniCevir(bilinen(
    'P2002',
    'duplicate key value violates unique constraint "banka_eft_kodu_uq"',
  ));
  assert.notEqual(h, null);
  assert.equal(h.httpDurum, 409);
  assert.match(h.message, /EFT kodu/u);
  assert.match(h.sonrakiEylem, /iki kez tanımlanamaz/u);
});

/*
 * ⚠️  ISIN OZU: kismi unique index'te Prisma `meta.target` yerine
 *     "(not available)" yazar. O metin ALAN ADI DEGILDIR; kullaniciya
 *     gosterilseydi var olmayan bir alan uydurulmus olurdu.
 */
test('P2002: "(not available)" alan adi olarak KULLANILMAZ', () => {
  const h = prismaHatasiniCevir(bilinen(
    'P2002', 'Unique constraint failed on the (not available)',
    { target: '(not available)' },
  ));
  assert.equal(h.httpDurum, 409);
  assert.doesNotMatch(h.message, /not available/u);
});

test('P2002: bilinmeyen kisit yine de 409 doner (500 DEGIL)', () => {
  const h = prismaHatasiniCevir(bilinen(
    'P2002',
    'duplicate key value violates unique constraint "yeni_tablo_bir_seyi_uq"',
  ));
  assert.equal(h.httpDurum, 409);
  // Kisit adi mesaja girer: teknik ama SESSIZ DEGIL.
  assert.match(h.message, /yeni_tablo_bir_seyi_uq/u);
});

test('P2002: meta.target dizi ise alan adlari kullanilir', () => {
  const h = prismaHatasiniCevir(bilinen(
    'P2002', 'Unique constraint failed', { target: ['tenant_id', 'kod'] },
  ));
  assert.equal(h.httpDurum, 409);
  assert.match(h.message, /tenant_id, kod/u);
});

/* ----------------------------- Oteki kodlar ------------------------------ */

test('P2003: yabanci anahtar -> 422', () => {
  const h = prismaHatasiniCevir(bilinen('P2003', 'Foreign key constraint failed'));
  assert.equal(h.httpDurum, 422);
});

test('P2025: kayit yok -> 404', () => {
  const h = prismaHatasiniCevir(bilinen('P2025', 'Record to update not found'));
  assert.equal(h.httpDurum, 404);
});

test('P2000: deger cok uzun -> 422', () => {
  const h = prismaHatasiniCevir(bilinen('P2000', 'Value too long'));
  assert.equal(h.httpDurum, 422);
});

/*
 * ⚠️  BICIMI BOZUK KIMLIK. Adres cubugundaki kimligi kirpilmis her baglanti ve
 *     eksik degisken tasiyan her istemci cagrisi ("/kiracilar/undefined/...")
 *     bu koda duser. Cevrilmeseydi butun uygulamada 500 "sistem bozuldu"
 *     gorunurdu; oysa sunucu saglamdir, ARANAN KAYIT YOKTUR.
 */
test('P2023: bozuk UUID -> 404 (500 DEGIL)', () => {
  const h = prismaHatasiniCevir(bilinen(
    'P2023',
    'Inconsistent column data: Error creating UUID, invalid character: ' +
      'expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], ' +
      'found `u` at 1',
  ));
  assert.notEqual(h, null);
  assert.equal(h.httpDurum, 404);
  // Kimligin BICIMI hakkinda bilgi sizdirilmez — var olan bir kimligin
  // bicimini de dogrulamis olurduk.
  assert.doesNotMatch(h.message, /UUID/u);
});

/*
 * ⚠️  Taninmayan Prisma kodu `null` DONER ve cagiran 500'e duser. Bilinmeyen
 *     bir hata icin 4xx uydurulsaydi gercek bir sistem arizasi "kullanici
 *     hatasi" gibi gorunur ve kimse bakmazdi.
 */
test('taninmayan kod null doner — 4xx UYDURULMAZ', () => {
  assert.equal(prismaHatasiniCevir(bilinen('P2034', 'Transaction conflict')), null);
  assert.equal(prismaHatasiniCevir(new Error('herhangi bir hata')), null);
  assert.equal(prismaHatasiniCevir(null), null);
  assert.equal(prismaHatasiniCevir('metin'), null);
});

/* ------------------------------ CHECK kisiti ----------------------------- */

/*
 * ⚠️  CHECK kisitlari Prisma'da TIPLI HATA DEGILDIR: surucu ham PostgreSQL
 *     mesajini `PrismaClientUnknownRequestError` icinde tasir. Yalnizca tipli
 *     hatalar cevrilseydi semadaki butun CHECK korumalari (banka hareketi
 *     tutari, virman bacaklari, arac sahipligi, ekstre tutarliligi…) 500
 *     donmeye devam ederdi.
 */
test('CHECK ihlali tipli hata olmasa da cevrilir -> 422', () => {
  const ham = new Error(
    'new row for relation "banka_hareketi" violates check constraint ' +
      '"banka_hareketi_tutar_pozitif"',
  );
  const h = prismaHatasiniCevir(ham);
  assert.notEqual(h, null);
  assert.equal(h.httpDurum, 422);
  assert.match(h.message, /sıfırdan büyük/u);
});

test('taninmayan CHECK kisiti da 422 doner ve adini soyler', () => {
  const h = prismaHatasiniCevir(new Error(
    'new row for relation "x" violates check constraint "x_bir_kural"',
  ));
  assert.equal(h.httpDurum, 422);
  assert.match(h.message, /x_bir_kural/u);
});

test('ham unique ihlali (tipsiz) 409 doner', () => {
  const h = prismaHatasiniCevir(new Error(
    'duplicate key value violates unique constraint "banka_hesabi_iban_uq"',
  ));
  assert.equal(h.httpDurum, 409);
  assert.match(h.message, /IBAN/u);
});

/* --------------------------- Kisit adi cikarma --------------------------- */

test('kisit adi mesajdan dogru okunur', () => {
  const durumlar = [
    ['banka_subesi_kodu_uq', 'şube kodu'],
    ['kiymetli_evrak_no_uq', 'evrak numarası'],
    ['ekstre_satiri_eslesen_hareket_uq', 'başka bir ekstre'],
    ['hesap_kod_uq', 'hesap kodu'],
    ['kisi_eposta_uq', 'e-posta'],
  ];
  for (const [ad] of durumlar) {
    const h = prismaHatasiniCevir(new Error(
      `duplicate key value violates unique constraint "${ad}"`,
    ));
    assert.equal(h.httpDurum, 409, ad);
    // Ceviri tablosunda karsiligi olan her kisit KISIT ADINI DEGIL insan
    // diline cevrilmis mesaji gosterir.
    assert.doesNotMatch(h.message, new RegExp(ad, 'u'), ad);
  }
});
