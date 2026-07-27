#!/usr/bin/env node
/**
 * shared-kernel calisma zamani duman testi — bagimliliksiz.
 *
 * node:test ve node:assert ile calisir; vitest kurulumu gerektirmez.
 * Vitest geldiginde bu dosya tests/unit/*.spec.ts olarak devralinir;
 * amaci Faz 0'da standartlarin YAZILMIS degil CALISIYOR oldugunu kanitlamaktir.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../../shared/kernel/dist/index.js');

/* ---------------- Para (BFS v1 §11) ---------------- */

test('para: ondalik string dogru olceklenir', () => {
  assert.equal(K.money('1234.5678').kurus, 12345678n);
  assert.equal(K.money('0.0001').kurus, 1n);
  assert.equal(K.money('-5.25').kurus, -52500n);
  assert.equal(K.apiBicimi(K.money('1234.56')), '1234.5600');
});

test('para: number kabul edilmez, fazla basamak reddedilir', () => {
  assert.throws(() => K.money('1.23456'), /ondalık basamak/i);
  assert.throws(() => K.money('abc'), /Geçersiz para değeri/);
});

test('para: farkli para birimleri toplanamaz', () => {
  assert.throws(
    () => K.topla(K.money('1', 'TRY'), K.money('1', 'USD')),
    /Farklı para birimleri/,
  );
});

test('para: toplama ve cikarma tam', () => {
  const a = K.money('0.1');
  const b = K.money('0.2');
  // float olsaydi 0.30000000000000004 olurdu
  assert.equal(K.apiBicimi(K.topla(a, b)), '0.3000');
  assert.equal(K.apiBicimi(K.cikar(K.money('10'), K.money('3.33'))), '6.6700');
});

test('para: bankaci yuvarlamasi (yarida cifte)', () => {
  // 2.5 -> 2 ; 3.5 -> 4
  assert.equal(K.apiBicimi(K.carpOran(K.money('5'), 1n, 2n)), '2.5000');
  assert.equal(K.apiBicimi(K.kurusaYuvarla(K.money('1.0050'))), '1.0000');
  assert.equal(K.apiBicimi(K.kurusaYuvarla(K.money('1.0150'))), '1.0200');
});

test('para: dagitim yuvarlama farkini KAYBETMEZ (ADR v1.1 §4)', () => {
  const toplam = K.money('100');
  const paylar = K.dagit(toplam, [1n, 1n, 1n]); // 3'e bolunmez
  const geriToplam = paylar.reduce((t, p) => K.topla(t, p), K.sifir());
  assert.equal(geriToplam.kurus, toplam.kurus, 'paylarin toplami toplama esit olmali');
  assert.equal(paylar.length, 3);
});

test('para: arsa payina gore dagitim toplami korur', () => {
  const toplam = K.money('12345.67');
  const agirliklar = [7n, 13n, 29n, 51n];
  const paylar = K.dagit(toplam, agirliklar);
  const geriToplam = paylar.reduce((t, p) => K.topla(t, p), K.sifir());
  assert.equal(geriToplam.kurus, toplam.kurus);
});

/* ---------------- Zaman (BFS v1 §4) ---------------- */

test('zaman: takvim tarihi saat bilgisi kabul etmez', () => {
  assert.throws(() => K.takvimTarihi('2026-07-26T00:00:00Z'), /YYYY-MM-DD/);
  assert.equal(K.takvimTarihi('2026-07-26'), '2026-07-26');
});

test('zaman: gun farki saat dilimi kaymasi uretmez', () => {
  assert.equal(K.gunFarki(K.takvimTarihi('2026-02-28'), K.takvimTarihi('2026-03-01')), 1);
  assert.equal(K.gunFarki(K.takvimTarihi('2026-01-01'), K.takvimTarihi('2026-12-31')), 364);
});

test('zaman: gecikme gunu tenant takviminde hesaplanir', () => {
  // UTC 22:30, Istanbul'da ertesi gun 01:30 -> tenant takviminde gun ilerlemis olmali
  const nokta = K.an('2026-07-26T22:30:00Z');
  assert.equal(K.tenantTakvimGunu(nokta, 'Europe/Istanbul'), '2026-07-27');
  assert.equal(K.tenantTakvimGunu(nokta, 'UTC'), '2026-07-26');

  const vade = K.takvimTarihi('2026-07-26');
  assert.equal(K.gecikmeGunu(vade, nokta, 'Europe/Istanbul'), 1);
  assert.equal(K.gecikmeGunu(vade, nokta, 'UTC'), 0);
});

/* ---------------- Onbellek (ADR-0005 · §37) ---------------- */

const TID = K.tenantId('11111111-2222-3333-4444-555555555555');

test('onbellek: anahtar sozlesmeye uyar', () => {
  const a = K.onbellekAnahtari({ tenantId: TID, alan: 'izin-seti', kimlik: 'u1', surum: 2 });
  assert.equal(a, `t:${TID}:izin-seti:u1:v2`);
});

test('onbellek: finansal alanlar REDDEDILIR', () => {
  for (const alan of ['bakiye', 'cari-hesap', 'borc-durumu', 'yaslandirma', 'nakit', 'mizan']) {
    assert.throws(
      () => K.onbellekAnahtari({ tenantId: TID, alan, kimlik: 'x', surum: 1 }),
      /önbelleklenemez/,
      `${alan} reddedilmeliydi`,
    );
  }
});

/* ---------------- Tenant (ADR-0002) ---------------- */

test('tenant: gecersiz kimlik reddedilir', () => {
  assert.throws(() => K.tenantId('apartman-1'), /Geçersiz tenant kimliği/);
});

test('tenant: baglamsiz islem hata verir, sessizce gecmez', () => {
  assert.throws(() => K.baglamiZorunluKil(undefined, 'borcListele'), /Tenant bağlamı kurulmadan/);
  const b = K.baglamiZorunluKil({ tenantId: TID, saatDilimi: 'Europe/Istanbul' }, 'x');
  assert.equal(b.tenantId, TID);
});

/* ---------------- Principal (§39) ---------------- */

test('principal: devredilmis yetki alt kumedir', () => {
  const insan = { id: 'u1', tip: 'INSAN', tenantId: TID, izinler: ['finance.ar.view', 'talep.olustur'] };
  const istenen = ['finance.ar.view', 'finance.payment.execute'];
  assert.deepEqual(K.devredilmisIzinleriCoz(insan, istenen), ['finance.ar.view']);
});

/* ---------------- Silme (§33) ---------------- */

test('silme: finansal kayit silinemez', () => {
  assert.throws(
    () => K.silmeyiDogrula({ varlik: 'Payment', sinif: 'FINANSAL', engelleyenBagimliliklar: [] }, 'gerekce yeterince uzun'),
    /finansal kayıttır ve silinemez/,
  );
});

test('silme: belge silinmez, versiyonlanir', () => {
  assert.throws(
    () => K.silmeyiDogrula({ varlik: 'Sozlesme', sinif: 'BELGE', engelleyenBagimliliklar: [] }, 'gerekce yeterince uzun'),
    /yeni sürüm oluşturulur/,
  );
});

test('silme: ana veri gerekce ister', () => {
  const politika = { varlik: 'Kisi', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] };
  assert.throws(() => K.silmeyiDogrula(politika, 'kisa'), /en az 10 karakter/);
  assert.doesNotThrow(() => K.silmeyiDogrula(politika, 'Malik tasindi, kayit mukerrer'));
});

test('silme: kismi unique index tenant_id ve silinme_tarihi tasir', () => {
  const sql = K.kismiUniqueIndex('bagimsiz_bolum', ['blok_id', 'kapi_no']);
  assert.match(sql, /tenant_id, blok_id, kapi_no/);
  assert.match(sql, /WHERE silinme_tarihi IS NULL/);
});
