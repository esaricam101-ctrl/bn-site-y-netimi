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
    'apartman.bagimsiz_bolum.olusturuldu', 'apartman.bagimsiz_bolum.silindi',
    'apartman.bolum_iliskisi.kuruldu', 'apartman.bolum_iliskisi.sonlandirildi',
    'apartman.blok.olusturuldu', 'apartman.blok.silindi',
  ]) {
    assert.ok(CD.katalogdaVarMi(t, 1), `${t} katalogda yok`);
  }

  // 'apartman' dikeyi core'dan ayridir — bu varliklar core-domain'e ait degil.
  const apartmanKayitlari = CD.EVENT_KATALOGU.filter((k) => k.eventType.startsWith('apartman.'));
  assert.equal(apartmanKayitlari.length, 6);
  assert.deepEqual(
    [...new Set(apartmanKayitlari.map((k) => k.sahipModul))].sort(),
    ['blok', 'bolum', 'iliski'],
  );
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

test('iliski: ayni rolde tarih cakismasi REDDEDILIR', () => {
  const mevcut = [iliski('MALIK', '2026-01-01', '2026-12-31')];
  // Icten kesisme
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('MALIK', '2026-06-01', '2027-01-01', 'k2')), /cakisiyor/);
  // Tam kapsama
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('MALIK', '2025-01-01', '2027-01-01', 'k2')), /cakisiyor/);
  // Tek gunluk temas — bitis ile baslangic ayni gun
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('MALIK', '2026-12-31', null, 'k2')), /cakisiyor/);
});

test('iliski: cakismayan ardisik donemler KABUL EDILIR', () => {
  const mevcut = [iliski('MALIK', '2026-01-01', '2026-12-31')];
  // Bir gun sonra baslar — temas yok.
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('MALIK', '2027-01-01', null, 'k2')));
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('MALIK', '2020-01-01', '2025-12-31', 'k2')));
});

test('iliski: FARKLI roller ortusebilir — kiracili bolumun maliki de vardir', () => {
  const mevcut = [iliski('MALIK', '2026-01-01', null)];
  assert.doesNotThrow(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2026-03-01', null, 'k2')));
});

test('iliski: acik uclu kayit sonraki her donemi bloke eder', () => {
  const mevcut = [iliski('KIRACI', '2026-01-01', null)];
  assert.throws(() => AD.iliskiyiDogrula(mevcut, iliski('KIRACI', '2030-01-01', null, 'k2')), /cakisiyor/);
});

test('iliski: bitis baslangictan once olamaz', () => {
  assert.throws(() => AD.iliskiyiDogrula([], iliski('MALIK', '2026-06-01', '2026-01-01')), /once olamaz/);
});

test('iliski: cakisma engellenmezse borc YANLIS kisiye yazilir', () => {
  // Bu test kuralin NEDEN var oldugunu sabitler: iki gecerli malik varsa
  // borcSorumlulariniCoz dizideki ilkini secer, digerini sessizce yok sayar.
  const demirbas = AD.KMK_VARSAYILAN_GIDERLER.find((g) => g.kod === 'DEMIRBAS');
  const cakisan = [
    iliski('MALIK', '2026-01-01', null, 'gercek-malik'),
    iliski('MALIK', '2026-01-01', null, 'yanlis-malik'),
  ];
  const zincir = AD.borcSorumlulariniCoz(demirbas, cakisan, K.takvimTarihi('2026-06-01'));
  assert.equal(zincir.length, 1);
  assert.equal(zincir[0].kisiId, 'gercek-malik'); // ikincisi kayboldu — hata sessiz
  // Yazma aninda dogrulama bu durumun olusmasini engeller:
  assert.throws(() => AD.iliskiyiDogrula([cakisan[0]], cakisan[1]), /cakisiyor/);
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

function bolum(kapiNo, pay, m2 = 100, muaf = false) {
  return AD.BagimsizBolum.olustur({
    id: `b-${kapiNo}`, tenantId: TID, blokId: null, kapiNo, kat: 1,
    nitelik: 'MESKEN', brutM2: m2, netM2: m2 * 0.85,
    arsaPayiPay: pay, arsaPayiPayda: 1_000_000n, aidatMuafiyeti: muaf,
  });
}

test('bolum: net m2 brut m2yi asamaz', () => {
  assert.throws(() => AD.BagimsizBolum.olustur({
    id: 'x', tenantId: TID, blokId: null, kapiNo: '1', kat: 1, nitelik: 'MESKEN',
    brutM2: 100, netM2: 120, arsaPayiPay: 1n, arsaPayiPayda: 4n, aidatMuafiyeti: false,
  }), /buyuk olamaz/);
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
