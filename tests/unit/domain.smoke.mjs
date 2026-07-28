#!/usr/bin/env node
/**
 * Domain paketleri duman testi — bagimliliksiz (node:test).
 *
 * Amaci: mimari kurallarin YAZILMIS degil CALISIYOR oldugunu kanitlamak.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const K  = await import('../../shared/kernel/dist/index.js');
const CD = await import('../../shared/core-domain/dist/index.js');
const AD = await import('../../shared/apartman-domain/dist/index.js');
const SDK = await import('../../shared/module-sdk/dist/index.js');
const UI = await import('../../shared/ui-tokens/dist/index.js');

const TID = K.tenantId('11111111-2222-3333-4444-555555555555');

/* ---------------- Tenant (ADR-0002) ---------------- */

test('tenant: yalnizca APARTMAN tipi kabul edilir (v1 kapsami)', () => {
  const temel = { id: TID, kod: 'guzel-apartmani', ad: 'Güzel Apartmanı',
                  durum: 'KURULUM', saatDilimi: 'Europe/Istanbul',
                  paraBirimi: 'TRY', lisansKodu: 'X' };
  assert.doesNotThrow(() => CD.Tenant.olustur({ ...temel, tip: 'APARTMAN' }));
  assert.throws(() => CD.Tenant.olustur({ ...temel, tip: 'SITE' }), /yalnizca APARTMAN/);
});

test('tenant: gecersiz kod reddedilir', () => {
  assert.throws(() => CD.Tenant.olustur({
    id: TID, kod: 'AB', ad: 'Test Apartmani', tip: 'APARTMAN', durum: 'KURULUM',
    saatDilimi: 'Europe/Istanbul', paraBirimi: 'TRY', lisansKodu: 'X',
  }), /Gecersiz tenant kodu/);
});

/* ---------------- Event katalogu (AIS v1 §4) ---------------- */

test('event: katalogda olmayan event URETILEMEZ', () => {
  const principal = { id: 'p1', tip: 'INSAN', tenantId: TID, izinler: [] };
  const girdi = {
    eventType: 'core.hayali.olusturuldu', eventVersion: 1,
    tenantId: TID, principal, correlationId: 'c1',
    aggregate: { tip: 'X', id: 'x1', version: 1 }, payload: {},
  };
  assert.throws(() => CD.eventOlustur(girdi, 'e1', new Date()), /katalogda kayitli degil/);
});

test('event: gecersiz tip bicimi reddedilir', () => {
  const principal = { id: 'p1', tip: 'INSAN', tenantId: TID, izinler: [] };
  assert.throws(() => CD.eventOlustur({
    eventType: 'YanlisBicim', eventVersion: 1, tenantId: TID, principal,
    correlationId: 'c1', aggregate: { tip: 'X', id: 'x', version: 1 }, payload: {},
  }, 'e1', new Date()), /Gecersiz event tipi/);
});

test('event: katalogdaki event standart zarf uretir', () => {
  const principal = { id: 'p1', tip: 'INSAN', tenantId: TID, izinler: [] };
  const zarf = CD.eventOlustur({
    eventType: 'core.tenant.olusturuldu', eventVersion: 1, tenantId: TID, principal,
    correlationId: 'c1', aggregate: { tip: 'Tenant', id: 't1', version: 1 },
    payload: { kod: 'x' },
  }, 'e1', new Date('2026-07-26T09:00:00Z'));

  assert.equal(zarf.eventId, 'e1');
  assert.equal(zarf.tenantId, TID);
  assert.equal(zarf.causationId, null);
  assert.equal(zarf.occurredAt.toISOString(), '2026-07-26T09:00:00.000Z');
});

test('event: apartman dikeyi eventleri katalogda kayitli', () => {
  // Bu moduller listelenen eventleri yayinlar; katalogdan dusurulurse outbox
  // yazimi calisma zamaninda patlar, derlemede degil.
  for (const t of [
    'apartman.apartman.olusturuldu', 'apartman.apartman.silindi',
    'apartman.blok.olusturuldu', 'apartman.blok.silindi',
    'apartman.kat.olusturuldu', 'apartman.kat.silindi',
    'apartman.bagimsiz_bolum.olusturuldu', 'apartman.bagimsiz_bolum.silindi',
    'apartman.bolum_iliskisi.kuruldu', 'apartman.bolum_iliskisi.sonlandirildi',
    'apartman.malik.eklendi', 'apartman.malik.devredildi',
    'apartman.kiraci.eklendi', 'apartman.kiraci.tahliye_edildi',
    'apartman.sakin.eklendi', 'apartman.sakin.cikti',
  ]) {
    assert.ok(CD.katalogdaVarMi(t, 1), `${t} katalogda yok`);
  }

  // 'apartman' dikeyi core'dan ayridir — bu varliklar core-domain'e ait degil.
  const apartmanKayitlari = CD.EVENT_KATALOGU.filter((k) => k.eventType.startsWith('apartman.'));
  assert.equal(apartmanKayitlari.length, 16);
  assert.deepEqual(
    [...new Set(apartmanKayitlari.map((k) => k.sahipModul))].sort(),
    ['apartman', 'blok', 'bolum', 'iliski', 'kat', 'kiraci', 'malik', 'sakin'],
  );

  // Malik/Kiraci/Sakin kayitlari SILINMEZ; donem kapanir. Katalogda 'silindi'
  // fiili bulunmamasi bu tasarim kararinin kaniti niteligindedir.
  for (const modul of ['malik', 'kiraci', 'sakin']) {
    const silme = CD.EVENT_KATALOGU.filter(
      (k) => k.sahipModul === modul && k.eventType.endsWith('.silindi'),
    );
    assert.equal(silme.length, 0, `${modul} modulunde silme event'i olmamali`);
  }
});

/* ---------------- Numaralandirma (§35) ---------------- */

test('numara: BOSLUKSUZ seriler gerekce tasir', () => {
  assert.deepEqual(CD.katalogDogrula(), []);
});

test('numara: makbuz BOSLUKSUZ, talep BOSLUKLU', () => {
  assert.equal(CD.seriTanimi('MAKBUZ').tip, 'BOSLUKSUZ');
  assert.equal(CD.seriTanimi('TALEP').tip, 'BOSLUKLU');
});

test('numara: bicimlendirme sablonu dogru calisir', () => {
  const t = CD.seriTanimi('MAKBUZ');
  assert.equal(CD.numaraBicimlendir(t, { yil: 2026, sira: 42 }), 'MKB-2026-000042');
});

test('numara: sayac anahtari kapsama gore degisir', () => {
  assert.equal(CD.sayacAnahtari(CD.seriTanimi('BELGE'), 't1', 2026), 't1:BELGE');
  assert.equal(CD.sayacAnahtari(CD.seriTanimi('MAKBUZ'), 't1', 2026), 't1:MAKBUZ:2026');
});

/* ---------------- Yetki matrisi ---------------- */

test('yetki: malik yalnizca kendi verisini gorur (KVKK)', () => {
  const malik = CD.rolTanimi('MALIK');
  assert.equal(malik.yalnizcaKendiVerisi, true);
  assert.ok(!malik.izinler.includes(CD.IZINLER.FINANS_BORCLU_DETAY),
    'Malik baska sakinlerin borc detayini goremez');
});

test('yetki: denetci salt okunurdur', () => {
  const d = CD.rolTanimi('DENETCI');
  const yazmaIzinleri = [CD.IZINLER.FINANS_TAHSILAT, CD.IZINLER.KISI_YONET, CD.IZINLER.TENANT_YONET];
  for (const izin of yazmaIzinleri) {
    assert.ok(!d.izinler.includes(izin), `Denetci ${izin} iznine sahip olmamali`);
  }
  assert.ok(d.izinler.includes(CD.IZINLER.AUDIT_GORUNTULE));
});

test('yetki: rol bazli yonlendirme en genis yetkiliyi secer', () => {
  assert.equal(CD.varsayilanPanel(['MALIK', 'APARTMAN_YONETICISI']), '/yonetim');
  assert.equal(CD.varsayilanPanel(['KIRACI']), '/sakin');
});

/* ---------------- Gider eksenleri (§4 · Y-11) ---------------- */

test('gider: uc eksen bagimsizdir', () => {
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  // Arsa payina gore dagitilir AMA malike aittir — eksenler bagimsiz.
  assert.equal(demirbas.paylasimKurali, 'ARSA_PAYI');
  assert.equal(demirbas.sorumlulukTipi, 'MALIKE_AIT');

  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  assert.equal(temizlik.paylasimKurali, 'ESIT');
  assert.equal(temizlik.sorumlulukTipi, 'KULLANANA_AIT');
});

test('gider: borc alicisi eksen 2 ile belirlenir', () => {
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');

  // MALIKE_AIT: kiraci olsa bile malik.
  assert.equal(AD.borcAlicisiTipi(demirbas, true), 'MALIK');
  // KULLANANA_AIT: kiraci varsa kiraci, yoksa malik.
  assert.equal(AD.borcAlicisiTipi(temizlik, true), 'KIRACI');
  assert.equal(AD.borcAlicisiTipi(temizlik, false), 'MALIK');
});

/* ---------------- Bolum iliskisi cakismasi (ADR v1.1 §5) ---------------- */

const iliski = (rol, baslangic, bitis = null, kisiId = 'k1') => ({
  kisiId, rol,
  baslangic: K.takvimTarihi(baslangic),
  bitis: bitis === null ? null : K.takvimTarihi(bitis),
});

test('iliski: KIRACI rolunde tarih cakismasi REDDEDILIR', () => {
  const mevcut = [iliski('KIRACI', '2026-01-01', '2026-12-31')];
  // Icten kesisme
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2026-06-01', '2027-01-01', 'k2')), /cakisiyor/);
  // Tam kapsama
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2025-01-01', '2027-01-01', 'k2')), /cakisiyor/);
  // Tek gunluk temas — bitis ile baslangic ayni gun
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2026-12-31', null, 'k2')), /cakisiyor/);
});

test('iliski: MALIK rolunde cakisma SERBESTTIR — hisseli mulkiyet gercektir', () => {
  // Oturum 5'te malik icin de tekillik zorlaniyordu. Coklu malik gereksinimiyle
  // kural KALDIRILMADI, YERI DEGISTI: tekillik yerine hisse butunlugu gelir.
  const mevcut = [iliski('MALIK', '2026-01-01', null, 'es-1')];
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('MALIK', '2026-01-01', null, 'es-2')));
});

test('iliski: cakismayan ardisik kira donemleri KABUL EDILIR', () => {
  const mevcut = [iliski('KIRACI', '2026-01-01', '2026-12-31')];
  // Bir gun sonra baslar — temas yok.
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2027-01-01', null, 'k2')));
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2020-01-01', '2025-12-31', 'k2')));
});

test('iliski: FARKLI roller ortusebilir — kiracili bolumun maliki de vardir', () => {
  const mevcut = [iliski('MALIK', '2026-01-01', null)];
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2026-03-01', null, 'k2')));
});

test('iliski: acik uclu kira kaydi sonraki her donemi bloke eder', () => {
  const mevcut = [iliski('KIRACI', '2026-01-01', null)];
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2030-01-01', null, 'k2')), /cakisiyor/);
});

test('iliski: bitis baslangictan once olamaz', () => {
  assert.throws(() => AD.iliskiyiDogrula([], iliski('MALIK', '2026-06-01', '2026-01-01')), /once olamaz/);
});

test('borc zinciri: TUM malikler zincire girer, hicbiri kaybolmaz', () => {
  // Coklu malik oncesinde borcSorumlulariniCoz `.find()` ile TEK malik
  // seciyordu; ikinci malik sessizce yok sayiliyordu. Artik hepsi doner.
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  const ortaklar = [
    iliski('MALIK', '2026-01-01', null, 'es-1'),
    iliski('MALIK', '2026-01-01', null, 'es-2'),
  ];
  const zincir = AD.borcSorumlulariniCoz(demirbas, ortaklar, K.takvimTarihi('2026-06-01'));
  assert.equal(zincir.length, 2);
  assert.deepEqual(zincir.map((s) => s.kisiId).sort(), ['es-1', 'es-2']);
  assert.ok(zincir.every((s) => s.sira === 'ASIL' && s.rol === 'MALIK'));
});

test('borc zinciri: kiracili bolumde tum malikler IKINCIL kalir', () => {
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  const kayitlar = [
    iliski('MALIK', '2026-01-01', null, 'es-1'),
    iliski('MALIK', '2026-01-01', null, 'es-2'),
    iliski('KIRACI', '2026-01-01', null, 'kiraci'),
  ];
  const zincir = AD.borcSorumlulariniCoz(temizlik, kayitlar, K.takvimTarihi('2026-06-01'));
  assert.equal(zincir.length, 3);
  assert.equal(AD.asilSorumlular(zincir).length, 1);
  assert.equal(AD.asilSorumlular(zincir)[0].kisiId, 'kiraci');
  assert.equal(zincir.filter((s) => s.sira === 'IKINCIL').length, 2);
});

test('borc zinciri: coklu ASIL varken asilSorumlu() SESSIZCE ilkini secmez', () => {
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  const zincir = AD.borcSorumlulariniCoz(
    demirbas,
    [iliski('MALIK', '2026-01-01', null, 'es-1'), iliski('MALIK', '2026-01-01', null, 'es-2')],
    K.takvimTarihi('2026-06-01'),
  );
  assert.throws(() => AD.asilSorumlu(zincir), /tek sorumlu varsayilamaz/);
  assert.equal(AD.asilSorumlular(zincir).length, 2);
});

/* ---------------- Malik hissesi ve hisseli bolusum (KMK · §5) ---------------- */

const malik = (kisiId, pay, payda, baslangic = '2026-01-01', bitis = null) => ({
  kisiId, hissePay: pay, hissePayda: payda,
  baslangic: K.takvimTarihi(baslangic),
  bitis: bitis === null ? null : K.takvimTarihi(bitis),
});

const TARIH = K.takvimTarihi('2026-06-01');

test('hisse: toplam tami ederse gecerli', () => {
  const sonuc = AD.hisseleriDogrula([malik('a', 1n, 2n), malik('b', 1n, 2n)], TARIH);
  assert.equal(sonuc.gecerli, true);
  assert.equal(sonuc.toplam, '1.000000');
});

test('hisse: EKSIK toplam sahipsiz pay demektir', () => {
  const sonuc = AD.hisseleriDogrula([malik('a', 1n, 2n), malik('b', 1n, 4n)], TARIH);
  assert.equal(sonuc.gecerli, false);
  assert.match(sonuc.mesaj, /sahipsiz/);
});

test('hisse: FAZLA toplam ayni payin iki kez yazilmasidir', () => {
  const sonuc = AD.hisseleriDogrula([malik('a', 1n, 1n), malik('b', 1n, 2n)], TARIH);
  assert.equal(sonuc.gecerli, false);
  assert.match(sonuc.mesaj, /fazla cikar/);
});

test('hisse: uc esit hisse (1/3) toplaminda kayip OLMAZ', () => {
  // Ondalik yuzde kullanilsaydi 33,33 x 3 = 99,99 ederdi ve kural hicbir
  // zaman saglanmazdi — pay/payda bu yuzden secildi (ADR-0007 gerekcesi).
  const uclu = [malik('a', 1n, 3n), malik('b', 1n, 3n), malik('c', 1n, 3n)];
  assert.equal(AD.hisseleriDogrula(uclu, TARIH).gecerli, true);
});

test('hisse: gecmis malik bugunku toplama girmez', () => {
  const kayitlar = [
    malik('eski', 1n, 1n, '2020-01-01', '2025-12-31'),
    malik('yeni', 1n, 1n, '2026-01-01'),
  ];
  assert.equal(AD.hisseleriDogrula(kayitlar, TARIH).gecerli, true);
  assert.equal(AD.tarihtekiMalikler(kayitlar, TARIH).length, 1);
  // Gecmis kayit SILINMEZ; kendi doneminde hala gecerlidir.
  assert.equal(AD.hisseleriDogrula(kayitlar, K.takvimTarihi('2021-06-01')).gecerli, true);
});

test('hisse: malik kaydi yoksa bolum sahipsizdir', () => {
  const sonuc = AD.hisseleriDogrula([], TARIH);
  assert.equal(sonuc.gecerli, false);
  assert.match(sonuc.mesaj, /sahipsiz/);
});

test('hisse: zorunlu kilma bozuk toplamda HATA verir', () => {
  assert.throws(() => AD.hisseleriZorunluKil([malik('a', 1n, 2n)], TARIH), /toplami 1 degil/);
  assert.equal(AD.hisseleriZorunluKil([malik('a', 1n, 1n)], TARIH).length, 1);
});

test('bolusum: HISSE_ORANI tapu hissesine gore boler', () => {
  const paylar = AD.malikBorcunuBol(
    K.money('300.00'),
    [malik('a', 2n, 3n), malik('b', 1n, 3n)],
    'HISSE_ORANI',
  );
  assert.equal(K.apiBicimi(paylar[0].tutar), '200.0000');
  assert.equal(K.apiBicimi(paylar[1].tutar), '100.0000');
});

test('bolusum: ESIT hisseyi YOK SAYAR', () => {
  const paylar = AD.malikBorcunuBol(
    K.money('300.00'),
    [malik('a', 9n, 10n), malik('b', 1n, 10n)],
    'ESIT',
  );
  assert.equal(K.apiBicimi(paylar[0].tutar), '150.0000');
  assert.equal(K.apiBicimi(paylar[1].tutar), '150.0000');
});

test('bolusum: MANUEL eksik agirlikta REDDEDILIR', () => {
  const ikili = [malik('a', 1n, 2n), malik('b', 1n, 2n)];
  assert.throws(() => AD.malikBorcunuBol(K.money('100.00'), ikili, 'MANUEL', [1n]), /her birine agirlik/);
  assert.throws(() => AD.malikBorcunuBol(K.money('100.00'), ikili, 'MANUEL', [1n, -1n]), /negatif/);
});

test('bolusum: yuvarlama farki KAYBOLMAZ — paylarin toplami borcun tamami', () => {
  const uclu = [malik('a', 1n, 3n), malik('b', 1n, 3n), malik('c', 1n, 3n)];
  const paylar = AD.malikBorcunuBol(K.money('100.00'), uclu, 'HISSE_ORANI');
  const toplam = paylar.reduce((t, p) => K.topla(t, p.tutar), K.sifir());
  assert.equal(K.apiBicimi(toplam), '100.0000');
});

test('bolusum: bir malik odese digerlerinin payi ACIK kalir', () => {
  // Paylar kisi bazinda ayri dondurulur; tek bir toplam borc degil.
  const paylar = AD.malikBorcunuBol(
    K.money('300.00'),
    [malik('a', 1n, 3n), malik('b', 2n, 3n)],
    'HISSE_ORANI',
  );
  assert.equal(paylar.length, 2);
  const odeyen = paylar.find((p) => p.kisiId === 'a');
  const kalan = paylar.filter((p) => p.kisiId !== 'a');
  assert.equal(K.apiBicimi(odeyen.tutar), '100.0000');
  assert.equal(K.apiBicimi(kalan[0].tutar), '200.0000');
});

test('bolusum: malik yoksa HATA verir', () => {
  assert.throws(() => AD.malikBorcunuBol(K.money('100.00'), [], 'ESIT'), /malik yok/);
});

/* ---------------- Aidat yontemleri (7 model) ---------------- */

const gider = (kural, ek = {}) => ({
  kod: 'TEST', ad: 'Test gideri', paylasimKurali: kural,
  sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN',
  kaynakReferansi: null, ...ek,
});

test('aidat: BRUT_M2 ve NET_M2 FARKLI dagitim uretir', () => {
  // bolum(kapiNo, pay, muaf) yardimcisi 100 m2 brut / 80 m2 net uretir;
  // burada olculeri acikca farklilastirmak icin ozel girdi kurulur.
  const b1 = AD.BagimsizBolum.olustur({
    id: '1', tenantId: K.tenantId('11111111-2222-3333-4444-555555555555'),
    blokId: null, katId: null, kapiNo: '1', icKapiNo: null, kat: 1,
    nitelik: 'MESKEN', daireTipi: null, kullanimAmaci: null, durum: 'AKTIF',
    brutM2: 100, netM2: 90,
    arsaPayiPay: 500_000n, arsaPayiPayda: 1_000_000n, aidatMuafiyeti: false,
    tapu: { ada: null, parsel: null, pafta: null, bagimsizBolumNo: null, cilt: null, sahife: null },
  });
  const b2 = AD.BagimsizBolum.olustur({
    id: '2', tenantId: K.tenantId('11111111-2222-3333-4444-555555555555'),
    blokId: null, katId: null, kapiNo: '2', icKapiNo: null, kat: 2,
    nitelik: 'MESKEN', daireTipi: null, kullanimAmaci: null, durum: 'AKTIF',
    brutM2: 100, netM2: 10,
    arsaPayiPay: 500_000n, arsaPayiPayda: 1_000_000n, aidatMuafiyeti: false,
    tapu: { ada: null, parsel: null, pafta: null, bagimsizBolumNo: null, cilt: null, sahife: null },
  });
  const girdiler = [{ bolum: b1 }, { bolum: b2 }];

  const brut = AD.gideriPaylastir(gider('BRUT_M2'), K.money('200.00'), girdiler);
  assert.equal(K.apiBicimi(brut[0].tutar), '100.0000');
  assert.equal(K.apiBicimi(brut[1].tutar), '100.0000');

  const net = AD.gideriPaylastir(gider('NET_M2'), K.money('200.00'), girdiler);
  assert.equal(K.apiBicimi(net[0].tutar), '180.0000');
  assert.equal(K.apiBicimi(net[1].tutar), '20.0000');
});

test('aidat: METREKARE tarihsel adi BRUT_M2 ile AYNI davranir', () => {
  const girdiler = [{ bolum: bolum('1', 500_000n) }, { bolum: bolum('2', 500_000n) }];
  const eski = AD.gideriPaylastir(gider('METREKARE'), K.money('200.00'), girdiler);
  const yeni = AD.gideriPaylastir(gider('BRUT_M2'), K.money('200.00'), girdiler);
  assert.deepEqual(eski.map((s) => K.apiBicimi(s.tutar)), yeni.map((s) => K.apiBicimi(s.tutar)));
});

test('aidat: KARMA bilesenleri toplami 100 degilse REDDEDILIR', () => {
  const bozuk = gider('KARMA', { karmaBilesenler: [
    { kural: 'ESIT', yuzde: 30 }, { kural: 'ARSA_PAYI', yuzde: 50 },
  ]});
  const hatalar = AD.giderTuruDogrula(bozuk);
  assert.equal(hatalar.length, 1);
  assert.match(hatalar[0], /toplami 100 olmalidir/);
  // Dagitim da reddeder — bozuk tanim sessizce eksik dagitim uretmez.
  assert.throws(
    () => AD.gideriPaylastir(bozuk, K.money('100.00'), [{ bolum: bolum('1', 1_000_000n) }]),
    /gecersiz/,
  );
});

test('aidat: KARMA disinda bilesen tanimlanamaz', () => {
  const hatalar = AD.giderTuruDogrula(gider('ESIT', {
    karmaBilesenler: [{ kural: 'ESIT', yuzde: 100 }],
  }));
  assert.match(hatalar[0], /yalnizca KARMA/);
});

test('aidat: KARMA ayni kurali iki kez kabul etmez', () => {
  const hatalar = AD.giderTuruDogrula(gider('KARMA', { karmaBilesenler: [
    { kural: 'ESIT', yuzde: 50 }, { kural: 'ESIT', yuzde: 50 },
  ]}));
  assert.match(hatalar[0], /birden fazla kez/);
});

test('aidat: KARMA iki kurali yuzdelerine gore birlestirir', () => {
  // %50 esit + %50 arsa payi. Arsa paylari 750k/250k.
  const girdiler = [{ bolum: bolum('1', 750_000n) }, { bolum: bolum('2', 250_000n) }];
  const karma = gider('KARMA', { karmaBilesenler: [
    { kural: 'ESIT', yuzde: 50 }, { kural: 'ARSA_PAYI', yuzde: 50 },
  ]});
  const satirlar = AD.gideriPaylastir(karma, K.money('400.00'), girdiler);
  // Esit parca: 200 -> 100/100. Arsa parcasi: 200 -> 150/50. Toplam 250/150.
  assert.equal(K.apiBicimi(satirlar[0].tutar), '250.0000');
  assert.equal(K.apiBicimi(satirlar[1].tutar), '150.0000');
  // KARMA'da tek agirlik yoktur.
  assert.equal(satirlar[0].agirlik, null);
});

test('aidat: KARMA toplami KORUNUR — yuvarlama iki katmanda da kaybolmaz', () => {
  const girdiler = ['1', '2', '3'].map((k) => ({ bolum: bolum(k, 333_333n) }));
  const karma = gider('KARMA', { karmaBilesenler: [
    { kural: 'ESIT', yuzde: 33 }, { kural: 'ARSA_PAYI', yuzde: 67 },
  ]});
  const satirlar = AD.gideriPaylastir(karma, K.money('100.00'), girdiler);
  const toplam = satirlar.reduce((t, s) => K.topla(t, s.tutar), K.sifir());
  assert.equal(K.apiBicimi(toplam), '100.0000');
});

test('aidat: KULLANIM_DISI bolum dagitima GIRMEZ', () => {
  const disi = AD.BagimsizBolum.olustur({
    id: 'x', tenantId: K.tenantId('11111111-2222-3333-4444-555555555555'),
    blokId: null, katId: null, kapiNo: 'X', icKapiNo: null, kat: 1,
    nitelik: 'MESKEN', daireTipi: null, kullanimAmaci: null, durum: 'KULLANIM_DISI',
    brutM2: 100, netM2: 80,
    arsaPayiPay: 500_000n, arsaPayiPayda: 1_000_000n, aidatMuafiyeti: false,
    tapu: { ada: null, parsel: null, pafta: null, bagimsizBolumNo: null, cilt: null, sahife: null },
  });
  // aidatMuafiyeti bayragi false ama durum KULLANIM_DISI — tek yerde toplanir.
  assert.equal(disi.aidatMuafiyeti, true);
  const satirlar = AD.gideriPaylastir(
    gider('ESIT'), K.money('100.00'),
    [{ bolum: disi }, { bolum: bolum('1', 500_000n) }],
  );
  assert.equal(satirlar.length, 1);
  assert.equal(K.apiBicimi(satirlar[0].tutar), '100.0000');
});

test('gider: yonetim plani kaynakli kural referans zorunlu tutar', () => {
  const hatalar = AD.giderTuruDogrula({
    kod: 'OZEL', ad: 'Özel', paylasimKurali: 'ESIT',
    sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'YONETIM_PLANI',
    kaynakReferansi: null,
  });
  assert.equal(hatalar.length, 1);
  assert.match(hatalar[0], /referans tasimalidir/);
});

/* ---------------- Arsa payi ve paylastirma ---------------- */

/** Bos tapu kaydi — alanlar isteğe baglidir, testlerde gurultu yaratmasin. */
const BOS_TAPU = {
  ada: null, parsel: null, pafta: null,
  bagimsizBolumNo: null, cilt: null, sahife: null,
};

function bolum(kapiNo, pay, m2 = 100, muaf = false) {
  return AD.BagimsizBolum.olustur({
    id: `b-${kapiNo}`, tenantId: TID, blokId: null, katId: null, kapiNo,
    icKapiNo: null, kat: 1, nitelik: 'MESKEN', daireTipi: null,
    kullanimAmaci: null, durum: 'AKTIF',
    brutM2: m2, netM2: m2 * 0.85,
    arsaPayiPay: pay, arsaPayiPayda: 1_000_000n, aidatMuafiyeti: muaf,
    tapu: BOS_TAPU,
  });
}

test('bolum: net m2 brut m2yi asamaz', () => {
  assert.throws(() => AD.BagimsizBolum.olustur({
    id: 'x', tenantId: TID, blokId: null, katId: null, kapiNo: '1', icKapiNo: null,
    kat: 1, nitelik: 'MESKEN', daireTipi: null, kullanimAmaci: null, durum: 'AKTIF',
    brutM2: 100, netM2: 120, arsaPayiPay: 1n, arsaPayiPayda: 4n, aidatMuafiyeti: false,
    tapu: BOS_TAPU,
  }), /buyuk olamaz/);
});

test('arsa payi: UC ESIT pay (1/3) tami eder — olcekli toplamda etmezdi', () => {
  // Regresyon: olcekli tam sayi toplaminda (333333 x 3 = 999999) uc esit
  // arsa payli bir bina, hicbir sey yanlis olmadigi halde surekli "hatali"
  // gorunurdu ve tahakkuk bloke olurdu. Kesirli toplam bunu kesin cozer.
  const ucte = (id) => AD.BagimsizBolum.olustur({
    id, tenantId: TID, blokId: null, katId: null, kapiNo: id, icKapiNo: null,
    kat: 1, nitelik: 'MESKEN', daireTipi: null, kullanimAmaci: null, durum: 'AKTIF',
    brutM2: 100, netM2: 85, arsaPayiPay: 1n, arsaPayiPayda: 3n,
    aidatMuafiyeti: false, tapu: BOS_TAPU,
  });
  const sonuc = AD.arsaPaylariniDogrula([ucte('1'), ucte('2'), ucte('3')]);
  assert.equal(sonuc.gecerli, true, sonuc.mesaj);
  assert.equal(sonuc.toplam, '1.000000');
});

test('arsa payi: toplam 1 degilse KMK md.3 uyarisi verir', () => {
  const tam = AD.arsaPaylariniDogrula([bolum('1', 500_000n), bolum('2', 500_000n)]);
  assert.equal(tam.gecerli, true);

  const eksik = AD.arsaPaylariniDogrula([bolum('1', 400_000n), bolum('2', 500_000n)]);
  assert.equal(eksik.gecerli, false);
  assert.match(eksik.mesaj, /KMK md\. 3/);
});

test('paylastirma: ESIT kuralinda toplam KORUNUR', () => {
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  const toplam = K.money('1000');
  const satirlar = AD.gideriPaylastir(temizlik, toplam, [
    { bolum: bolum('1', 333_333n) }, { bolum: bolum('2', 333_333n) }, { bolum: bolum('3', 333_334n) },
  ]);
  const geri = satirlar.reduce((t, s) => K.topla(t, s.tutar), K.sifir());
  assert.equal(geri.kurus, toplam.kurus, '3e bolunemeyen tutarda bile toplam korunmali');
});

test('paylastirma: ARSA_PAYI agirliklariyla toplam KORUNUR', () => {
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  const toplam = K.money('12345.67');
  const satirlar = AD.gideriPaylastir(demirbas, toplam, [
    { bolum: bolum('1', 70_000n) }, { bolum: bolum('2', 130_000n) },
    { bolum: bolum('3', 290_000n) }, { bolum: bolum('4', 510_000n) },
  ]);
  const geri = satirlar.reduce((t, s) => K.topla(t, s.tutar), K.sifir());
  assert.equal(geri.kurus, toplam.kurus);
  assert.equal(satirlar.length, 4);
});

test('paylastirma: muaf bolum dagitima girmez', () => {
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  const satirlar = AD.gideriPaylastir(temizlik, K.money('300'), [
    { bolum: bolum('1', 500_000n) },
    { bolum: bolum('2', 500_000n, 100, true) },
  ]);
  assert.equal(satirlar.length, 1);
  assert.equal(K.apiBicimi(satirlar[0].tutar), '300.0000');
});

test('paylastirma: TUKETIM olcumu eksikse net hata verir', () => {
  const isitma = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'ISITMA');
  assert.throws(
    () => AD.gideriPaylastir(isitma, K.money('500'), [{ bolum: bolum('1', 1_000_000n) }]),
    /olcum degeri girilmemis/,
  );
});

/* ---------------- Borc sorumluluk zinciri (§5 · Y-12) ---------------- */

const T = (s) => K.takvimTarihi(s);

test('borc: MALIKE_AIT gider yalnizca malige yazilir', () => {
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  const zincir = AD.borcSorumlulariniCoz(demirbas, [
    { kisiId: 'malik', rol: 'MALIK', baslangic: T('2024-01-01'), bitis: null },
    { kisiId: 'kiraci', rol: 'KIRACI', baslangic: T('2025-01-01'), bitis: null },
  ], T('2026-04-01'));

  assert.equal(zincir.length, 1);
  assert.equal(zincir[0].kisiId, 'malik');
  assert.equal(zincir[0].sira, 'ASIL');
});

test('borc: KULLANANA_AIT giderde kiraci ASIL, malik IKINCIL', () => {
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  const zincir = AD.borcSorumlulariniCoz(temizlik, [
    { kisiId: 'malik', rol: 'MALIK', baslangic: T('2024-01-01'), bitis: null },
    { kisiId: 'kiraci', rol: 'KIRACI', baslangic: T('2025-01-01'), bitis: null },
  ], T('2026-04-01'));

  assert.equal(zincir.length, 2);
  assert.equal(AD.asilSorumlu(zincir).kisiId, 'kiraci');
  // Malik HER DURUMDA zincirdedir: kiraci odemezse basvurulacak taraf kaybolmaz.
  assert.equal(zincir[1].kisiId, 'malik');
  assert.equal(zincir[1].sira, 'IKINCIL');
});

test('borc: SNAPSHOT — kiraci tasindiktan sonra ESKI borc eski kiracida kalir', () => {
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  const iliskiler = [
    { kisiId: 'malik', rol: 'MALIK', baslangic: T('2024-01-01'), bitis: null },
    { kisiId: 'eski-kiraci', rol: 'KIRACI', baslangic: T('2025-01-01'), bitis: T('2026-02-28') },
    { kisiId: 'yeni-kiraci', rol: 'KIRACI', baslangic: T('2026-03-01'), bitis: null },
  ];

  // Subat tahakkuku -> eski kiraci
  const subat = AD.borcSorumlulariniCoz(temizlik, iliskiler, T('2026-02-15'));
  assert.equal(AD.asilSorumlu(subat).kisiId, 'eski-kiraci');

  // Mart tahakkuku -> yeni kiraci
  const mart = AD.borcSorumlulariniCoz(temizlik, iliskiler, T('2026-03-15'));
  assert.equal(AD.asilSorumlu(mart).kisiId, 'yeni-kiraci');
});

test('borc: malik kaydi yoksa borc olusturulamaz', () => {
  const temizlik = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'TEMIZLIK');
  assert.throws(
    () => AD.borcSorumlulariniCoz(temizlik, [
      { kisiId: 'kiraci', rol: 'KIRACI', baslangic: T('2025-01-01'), bitis: null },
    ], T('2026-04-01')),
    /malik kaydi yok/,
  );
});

/* ---------------- Module SDK (§40) ---------------- */

test('sdk: apartman manifestosu gecerlidir', () => {
  assert.deepEqual(SDK.manifestDogrula(SDK.APARTMAN_MANIFEST), []);
});

test('sdk: AUDIT cekirdegi zorunludur', () => {
  const eksik = { ...SDK.APARTMAN_MANIFEST, gerektirdigiCekirdek: ['MEMORY'] };
  const hatalar = SDK.manifestDogrula(eksik);
  assert.ok(hatalar.some((h) => h.includes('AUDIT zorunludur')));
});

test('sdk: sozlesme testleri katalogu 14 madde ve 12 kritik icerir', () => {
  assert.equal(SDK.SOZLESME_TESTLERI.length, 14);
  assert.equal(SDK.KRITIK_TESTLER.length, 12);
});

test('sdk: her sozlesme testi kaynak referansi tasir', () => {
  for (const t of SDK.SOZLESME_TESTLERI) {
    assert.ok(t.kaynak && t.kaynak.length > 3, `${t.kod} kaynak referansi tasimali`);
    assert.match(t.kod, /^CT-\d{2}$/);
  }
});

/* ---------------- UI token'lari (O-2) ---------------- */

test('ui: web ve mobil AYNI kaynaktan beslenir', () => {
  assert.equal(UI.tailwindTema.colors.primary, UI.rnTema.colors.primary);
  assert.equal(UI.tailwindTema.colors.primary, UI.renkler.primary);
});

test('ui: css degiskenleri yogunluk moduna gore degisir', () => {
  const rahat = UI.cssDegiskenleri('rahat');
  const sikisik = UI.cssDegiskenleri('sikisik');
  assert.match(rahat, /--rowh: 44px/);
  assert.match(sikisik, /--rowh: 34px/);
  // Renkler yogunluktan BAGIMSIZDIR — yalnizca aralik token'lari degisir.
  assert.match(rahat, /--primary: #0E7490/);
  assert.match(sikisik, /--primary: #0E7490/);
});
