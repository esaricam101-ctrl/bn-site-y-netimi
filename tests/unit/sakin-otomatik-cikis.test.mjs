/**
 * Dayanagi sona eren sakinlere otomatik cikis.
 *
 * NEDEN ONEMLI: kiraci tahliye edilir, esi ve cocuklari listede "halen
 * oturuyor" kalirdi. Hata SESSIZ olurdu — kayit gecerli gorunur, kimse fark
 * etmez; daire karti, acil durum listesi ve doluluk raporu aylarca yanlis
 * calisirdi.
 *
 * Test derlenmis backend cikisini okur (bkz. prisma-hata-cevirisi testi).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const MODUL = new URL(
  '../../backend/dist/src/common/kayit/sakin-otomatik-cikis.js',
  import.meta.url,
);
const require = createRequire(MODUL);
const { dayanakSakinleriniCikar } = require(MODUL.pathname.slice(1));

const PRINCIPAL = { tenantId: 't1', kullaniciId: 'k1', roller: [] };
const BAGLAM = { correlationId: 'c1', ip: '127.0.0.1', kullaniciAjani: 'test' };

/** Sahte islem istemcisi — `findMany` sabit doner, `update` kaydedilir. */
function sahteIslem(sakinler) {
  const guncellemeler = [];
  return {
    guncellemeler,
    sorgular: [],
    sakin: {
      findMany(arg) {
        this._sorgu = arg;
        return Promise.resolve(sakinler);
      },
      update(arg) {
        guncellemeler.push(arg);
        return Promise.resolve({});
      },
    },
  };
}

function sahteYazici() {
  const kayitlar = [];
  return { kayitlar, yaz: (_tx, k) => { kayitlar.push(k); return Promise.resolve(); } };
}
function sahteOutbox() {
  const olaylar = [];
  return { olaylar, yayinla: (_tx, o) => { olaylar.push(o); return Promise.resolve(); } };
}

/*
 * `girisTarihi` DATE kolonundan `Date` olarak gelir — sahte de oyle verir.
 * Duz metin verilseydi test gecerdi ama gercek surucuyle `takvimTarihiniOku`
 * patlardi; sahte, gercegin sekline uymak zorunda.
 */
function sakin(id, giris, ad = 'Ayse') {
  return {
    id, kisiId: `kisi-${id}`,
    girisTarihi: new Date(`${giris}T00:00:00.000Z`),
    kisi: { ad, soyad: 'Yilmaz' },
  };
}

/** DATE kolonuna yazilan `Date`i karsilastirilabilir metne cevirir. */
function gun(deger) {
  return deger.toISOString().slice(0, 10);
}

async function calistir(sakinler, girdi) {
  const tx = sahteIslem(sakinler);
  const audit = sahteYazici();
  const outbox = sahteOutbox();
  const sonuc = await dayanakSakinleriniCikar(tx, audit, outbox, PRINCIPAL, BAGLAM, girdi);
  return { sonuc, tx, audit, outbox };
}

const KIRACI_GIRDI = {
  bolumId: 'b1', kiraciId: 'kr1', cikisTarihi: '2026-06-30',
  sebep: 'kiraci tahliyesi',
};

/* ------------------------------ Temel akis ------------------------------- */

test('dayanaga bagli acik sakinlerin hepsine cikis verilir', async () => {
  const { sonuc, tx } = await calistir(
    [sakin('s1', '2025-01-01'), sakin('s2', '2025-03-15'), sakin('s3', '2026-01-10')],
    KIRACI_GIRDI,
  );
  assert.equal(sonuc.cikarilan, 3);
  assert.equal(sonuc.cikarilamayan.length, 0);
  assert.equal(tx.guncellemeler.length, 3);
});

test('ISIN OZU: cikis tarihi DAYANAGIN bitisidir, bugun degil', async () => {
  // Bugun yazilsaydi tahliye ile bugun arasindaki gunler boyunca kisi
  // oturuyor gorunurdu.
  const { tx } = await calistir([sakin('s1', '2025-01-01')], KIRACI_GIRDI);
  assert.equal(gun(tx.guncellemeler[0].data.cikisTarihi), '2026-06-30');
  assert.equal(tx.guncellemeler[0].where.id, 's1');
});

test('yalnizca ACIK kayitlar sorgulanir — kapali kayitlar tekrar yazilmaz', async () => {
  const { tx } = await calistir([sakin('s1', '2025-01-01')], KIRACI_GIRDI);
  assert.equal(tx.sakin._sorgu.where.cikisTarihi, null);
});

test('sorgu tenant · bolum · dayanak ile daraltilir', async () => {
  const { tx } = await calistir([], KIRACI_GIRDI);
  const w = tx.sakin._sorgu.where;
  assert.equal(w.tenantId, 't1');
  assert.equal(w.bolumId, 'b1');
  assert.equal(w.kiraciId, 'kr1');
  // Malik dayanagi verilmediginde sorguya HIC eklenmez: `malikId: undefined`
  // yazilsaydi Prisma alani yok sayar ve kiraci ile ilgisi olmayan sakinler de
  // kapatilirdi.
  assert.equal('malikId' in w, false);
});

test('malik dayanaginda kiraci suzgeci sorguya girmez', async () => {
  const { tx } = await calistir([], {
    bolumId: 'b1', malikId: 'm1', cikisTarihi: '2026-06-30', sebep: 'malik devri',
  });
  assert.equal(tx.sakin._sorgu.where.malikId, 'm1');
  assert.equal('kiraciId' in tx.sakin._sorgu.where, false);
});

test('dayanaga bagli sakin yoksa hicbir sey yazilmaz', async () => {
  const { sonuc, tx, audit, outbox } = await calistir([], KIRACI_GIRDI);
  assert.equal(sonuc.cikarilan, 0);
  assert.equal(tx.guncellemeler.length, 0);
  assert.equal(audit.kayitlar.length, 0);
  assert.equal(outbox.olaylar.length, 0);
});

/* -------------------- Giris > cikis: SESSIZCE ATLANMAZ -------------------- */

test('ISIN OZU: girisi dayanagin bitisinden SONRA olan kayit cikarilmaz', async () => {
  const { sonuc, tx } = await calistir(
    [sakin('s1', '2026-08-01', 'Yeni')],
    KIRACI_GIRDI,
  );
  assert.equal(sonuc.cikarilan, 0);
  assert.equal(tx.guncellemeler.length, 0, 'cikis girisin oncesine yazilamaz');
});

test('cikarilamayan kayit GEREKCESIYLE raporlanir', async () => {
  const { sonuc } = await calistir([sakin('s1', '2026-08-01', 'Yeni')], KIRACI_GIRDI);
  assert.equal(sonuc.cikarilamayan.length, 1);
  const k = sonuc.cikarilamayan[0];
  assert.equal(k.sakinId, 's1');
  assert.equal(k.kisiAdi, 'Yeni Yilmaz');
  assert.equal(k.girisTarihi, '2026-08-01');
  assert.match(k.gerekce, /elle/);
  // Tarihler gerekcede GORUNMELI: kullanici neyi duzeltecegini bilmeli.
  assert.match(k.gerekce, /2026-08-01/);
  assert.match(k.gerekce, /2026-06-30/);
});

test('bir kayit atlansa bile otekiler cikarilir', async () => {
  const { sonuc } = await calistir(
    [sakin('s1', '2025-01-01'), sakin('s2', '2026-12-01'), sakin('s3', '2026-02-02')],
    KIRACI_GIRDI,
  );
  assert.equal(sonuc.cikarilan, 2);
  assert.equal(sonuc.cikarilamayan.length, 1);
  assert.equal(sonuc.cikarilamayan[0].sakinId, 's2');
});

test('girisi cikis tarihinin AYNISI olan kayit cikarilir (sinir)', async () => {
  const { sonuc } = await calistir([sakin('s1', '2026-06-30')], KIRACI_GIRDI);
  assert.equal(sonuc.cikarilan, 1, 'ayni gun giren ve cikan gecerlidir');
  assert.equal(sonuc.cikarilamayan.length, 0);
});

/* -------------------------------- Denetim -------------------------------- */

test('HER sakin icin AYRI denetim kaydi yazilir', async () => {
  const { audit } = await calistir(
    [sakin('s1', '2025-01-01'), sakin('s2', '2025-02-01')],
    KIRACI_GIRDI,
  );
  assert.equal(audit.kayitlar.length, 2);
  assert.deepEqual(audit.kayitlar.map((k) => k.varlikId), ['s1', 's2']);
});

test('denetim kaydi otomatik oldugunu ve SEBEBINI tasir', async () => {
  const { audit } = await calistir([sakin('s1', '2025-01-01')], KIRACI_GIRDI);
  const k = audit.kayitlar[0];
  assert.equal(k.varlik, 'Sakin');
  assert.equal(k.eylem, 'GUNCELLE');
  assert.equal(k.sonrakiDeger.otomatikMi, true);
  assert.equal(k.sonrakiDeger.sebep, 'kiraci tahliyesi');
  assert.equal(k.oncekiDeger.cikisTarihi, null);
  assert.match(k.gerekce, /kiraci tahliyesi/);
});

test('denetim kaydi istek baglamini tasir', async () => {
  const { audit } = await calistir([sakin('s1', '2025-01-01')], KIRACI_GIRDI);
  assert.equal(audit.kayitlar[0].correlationId, 'c1');
  assert.equal(audit.kayitlar[0].tenantId, 't1');
});

test('atlanan kayit icin denetim yazilmaz — degismeyen sey denetlenmez', async () => {
  const { audit } = await calistir([sakin('s1', '2026-12-01')], KIRACI_GIRDI);
  assert.equal(audit.kayitlar.length, 0);
});

/* --------------------------------- Outbox -------------------------------- */

test('elle cikisla AYNI olay yayinlanir', async () => {
  const { outbox } = await calistir([sakin('s1', '2025-01-01')], KIRACI_GIRDI);
  assert.equal(outbox.olaylar.length, 1);
  const o = outbox.olaylar[0];
  assert.equal(o.eventType, 'apartman.sakin.cikti');
  assert.equal(o.eventVersion, 1);
  assert.equal(o.aggregate.tip, 'Sakin');
  assert.equal(o.aggregate.id, 's1');
});

test('olay yuku otomatik/elle ayrimini tasir', async () => {
  const { outbox } = await calistir([sakin('s1', '2025-01-01')], KIRACI_GIRDI);
  const p = outbox.olaylar[0].payload;
  assert.equal(p.otomatikMi, true);
  assert.equal(p.sebep, 'kiraci tahliyesi');
  assert.equal(p.cikisTarihi, '2026-06-30');
  assert.equal(p.bolumId, 'b1');
  assert.equal(p.kisiId, 'kisi-s1');
});

test('atlanan kayit icin olay yayinlanmaz', async () => {
  const { outbox } = await calistir([sakin('s1', '2026-12-01')], KIRACI_GIRDI);
  assert.equal(outbox.olaylar.length, 0);
});

/* ------------------------------ Malik devri ------------------------------ */

test('malik devrinde sebep malik devridir', async () => {
  const { audit, outbox, sonuc } = await calistir([sakin('s1', '2020-01-01')], {
    bolumId: 'b1', malikId: 'm1', cikisTarihi: '2026-03-15', sebep: 'malik devri',
  });
  assert.equal(sonuc.cikarilan, 1);
  assert.equal(audit.kayitlar[0].sonrakiDeger.sebep, 'malik devri');
  assert.equal(outbox.olaylar[0].payload.sebep, 'malik devri');
  assert.equal(outbox.olaylar[0].payload.cikisTarihi, '2026-03-15');
});
