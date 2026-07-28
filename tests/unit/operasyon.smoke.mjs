#!/usr/bin/env node
/**
 * Operasyonel varlik duman testi — sayac · arac · evcil hayvan · belge.
 *
 * Bu dort modulun KALICILIGI henuz yoktur (migration bekler); kurallari
 * burada calisma zamaninda dogrulanir. Sayac tuketimi ozellikle onemlidir:
 * yanlis hesaplanmis bir tuketim TUKETIM dagitiminda SESSIZ hataya yol acar —
 * toplam gider korunur, yalnizca kisiler arasindaki paylar bozulur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../../shared/kernel/dist/index.js');
const AD = await import('../../shared/apartman-domain/dist/index.js');

const tarih = (s) => K.takvimTarihi(s);

/* ---------------- Sayac ---------------- */

const sayac = (o = {}) => ({
  id: 's1', bolumId: 'b1', tur: 'SU', seriNo: 'SU-001',
  basamak: 5, olcekBasamak: 3,
  takilmaTarihi: tarih('2026-01-01'), sokulmeTarihi: null,
  ilkDeger: 0n, ...o,
});

const okuma = (deger, o = {}) => ({
  sayacId: 's1', tarih: tarih('2026-02-01'), deger, ...o,
});

test('sayac: normal tuketim iki okuma farkidir', () => {
  assert.equal(AD.tuketimHesapla(sayac(), 12_000n, okuma(12_345n)), 345n);
});

test('sayac: GERIYE GIDEN okuma reddedilir', () => {
  // Sessizce kabul edilse negatif tuketim olusur ve TUKETIM dagitiminda
  // negatif agirlik demektir — dagitim ya patlar ya baska daireye fazla yazar.
  assert.throws(
    () => AD.tuketimHesapla(sayac(), 12_345n, okuma(12_000n)),
    /geriye gitmez/,
  );
});

test('sayac: devir ACIK ONAYLA hesaplanir', () => {
  // 5 basamakli sayac: 99_900 -> devir -> 100. Tuketim 100_000-99_900+100 = 200.
  assert.equal(
    AD.tuketimHesapla(sayac(), 99_900n, okuma(100n, { devirMi: true })),
    200n,
  );
});

test('sayac: devir TAHMIN EDILMEZ — onay yoksa hata', () => {
  // Veri girisi hatasini devir sanip olmayan bir tuketim yazmamak icin.
  assert.throws(
    () => AD.tuketimHesapla(sayac(), 99_900n, okuma(100n)),
    /geriye gitmez/,
  );
});

test('sayac: basamagi asan deger reddedilir', () => {
  assert.throws(
    () => AD.tuketimHesapla(sayac({ basamak: 4 }), 100n, okuma(10_000n)),
    /basamagi asiyor/,
  );
});

test('sayac: negatif deger reddedilir', () => {
  assert.throws(() => AD.tuketimHesapla(sayac(), -1n, okuma(100n)), /negatif olamaz/);
});

test('sayac: gecersiz basamak sayisi reddedilir', () => {
  assert.throws(() => AD.tuketimHesapla(sayac({ basamak: 0 }), 0n, okuma(1n)), /1-12 arasinda/);
});

test('sayac: aktiflik takilma ve sokulme tarihine baglidir', () => {
  const s = sayac({ takilmaTarihi: tarih('2026-01-01'), sokulmeTarihi: tarih('2026-06-30') });
  assert.equal(AD.sayacAktifMi(s, tarih('2026-03-01')), true);
  assert.equal(AD.sayacAktifMi(s, tarih('2025-12-31')), false);
  assert.equal(AD.sayacAktifMi(s, tarih('2026-07-01')), false);
});

test('sayac: DEGISIM doneminde eski sayacin son gunleri KAYBOLMAZ', () => {
  // Yalnizca yeni sayaca bakmak, eski sayacin son gunlerini sessizce dusurur.
  const eski = sayac({ id: 'eski', seriNo: 'SU-001' });
  const yeni = sayac({ id: 'yeni', seriNo: 'SU-002', ilkDeger: 0n });
  const toplam = AD.degisimDonemiTuketimi(
    eski, 10_000n, okuma(10_400n),   // eski sayacta 400
    yeni, okuma(150n),                // yeni sayacta 150
  );
  assert.equal(toplam, 550n);
});

test('sayac: degisimde tur ve olcek AYNI olmali', () => {
  const eski = sayac({ id: 'eski' });
  assert.throws(
    () => AD.degisimDonemiTuketimi(eski, 0n, okuma(10n), sayac({ tur: 'ELEKTRIK' }), okuma(5n)),
    /turleri ayni olmalidir/,
  );
  assert.throws(
    () => AD.degisimDonemiTuketimi(eski, 0n, okuma(10n), sayac({ olcekBasamak: 2 }), okuma(5n)),
    /olcek basamaklari ayni/,
  );
  assert.throws(
    () => AD.degisimDonemiTuketimi(eski, 0n, okuma(10n), sayac({ bolumId: 'b2' }), okuma(5n)),
    /ayni bagimsiz boluma/,
  );
});

test('sayac: tuketim metni olcege gore bicimlenir', () => {
  assert.equal(AD.tuketimMetni(sayac({ olcekBasamak: 3 }), 12_345n), '12,345');
  assert.equal(AD.tuketimMetni(sayac({ olcekBasamak: 0 }), 345n), '345');
  assert.equal(AD.tuketimMetni(sayac({ olcekBasamak: 3 }), 5n), '0,005');
});

test('sayac: tuketim TUKETIM dagitimini besler', () => {
  // Zincirin butunu: iki daire, iki sayac, tuketime gore dagitim.
  const bolumYap = (id, pay) => AD.BagimsizBolum.olustur({
    id, tenantId: K.tenantId('11111111-2222-3333-4444-555555555555'),
    blokId: null, katId: null, kapiNo: id, icKapiNo: null, kat: 1,
    nitelik: 'MESKEN', daireTipi: null, kullanimAmaci: null, durum: 'AKTIF',
    brutM2: 100, netM2: 85, arsaPayiPay: pay, arsaPayiPayda: 1_000_000n,
    aidatMuafiyeti: false,
    tapu: { ada: null, parsel: null, pafta: null, bagimsizBolumNo: null, cilt: null, sahife: null },
  });

  const t1 = AD.tuketimHesapla(sayac({ bolumId: '1' }), 1_000n, okuma(1_300n)); // 300
  const t2 = AD.tuketimHesapla(sayac({ bolumId: '2' }), 5_000n, okuma(5_100n)); // 100

  const su = {
    kod: 'ORTAK_SU', ad: 'Su', paylasimKurali: 'TUKETIM',
    sorumlulukTipi: 'SAKINE_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: null,
  };
  const satirlar = AD.gideriPaylastir(su, K.money('400.00'), [
    { bolum: bolumYap('1', 500_000n), tuketim: t1 },
    { bolum: bolumYap('2', 500_000n), tuketim: t2 },
  ]);

  assert.equal(K.apiBicimi(satirlar[0].tutar), '300.0000');
  assert.equal(K.apiBicimi(satirlar[1].tutar), '100.0000');
});

/* ---------------- Arac ---------------- */

test('arac: gecerli Turkiye plakalari kabul edilir', () => {
  // Harf sayisi rakam sayisini belirler; toplam daima 5 ya da 6.
  assert.equal(AD.plakayiDogrula('34 A 1234'), '34A1234');    // 1+4
  assert.equal(AD.plakayiDogrula('34 A 12345'), '34A12345');  // 1+5
  assert.equal(AD.plakayiDogrula('06-ab-123'), '06AB123');    // 2+3
  assert.equal(AD.plakayiDogrula('81 AB 1234'), '81AB1234');  // 2+4
  assert.equal(AD.plakayiDogrula('34 ABC 12'), '34ABC12');    // 3+2
  assert.equal(AD.plakayiDogrula('34 ABC 123'), '34ABC123');  // 3+3
});

test('arac: gecersiz plakalar reddedilir', () => {
  assert.throws(() => AD.plakayiDogrula('00ABC123'), /Gecersiz plaka/);  // il kodu 00
  assert.throws(() => AD.plakayiDogrula('82ABC123'), /Gecersiz plaka/);  // il kodu 82
  assert.throws(() => AD.plakayiDogrula('34ABCD12'), /Gecersiz plaka/);  // 4 harf
  assert.throws(() => AD.plakayiDogrula('34123'), /Gecersiz plaka/);     // harf yok
  // Toplam 5-6 disinda kalanlar: 2+2=4 kisa, 3+4=7 uzun.
  assert.throws(() => AD.plakayiDogrula('81XY99'), /olmalidir/);
  assert.throws(() => AD.plakayiDogrula('34ABC1234'), /olmalidir/);
});

const arac = (o = {}) => ({
  id: 'a1', bolumId: 'b1', kisiId: 'k1', plaka: '34ABC123', tur: 'OTOMOBIL',
  marka: null, model: null, renk: null, otoparkYeri: 'A-1',
  baslangic: tarih('2026-01-01'), bitis: null, ...o,
});

test('arac: ayni plaka ayni tarihte iki kez kayitli olamaz', () => {
  // Mukerrer plaka, bir aracin iki daireye sayilmasi ve otopark giderinin
  // fazla dagitilmasi demektir.
  assert.throws(
    () => AD.aracKaydiniDogrula([arac()], arac({ id: 'a2', bolumId: 'b2' })),
    /zaten kayitli/,
  );
});

test('arac: cakismayan donemler kabul edilir', () => {
  const eski = arac({ bitis: tarih('2026-06-30') });
  assert.doesNotThrow(
    () => AD.aracKaydiniDogrula([eski], arac({ id: 'a2', baslangic: tarih('2026-07-01') })),
  );
});

test('arac: bitis baslangictan once olamaz', () => {
  assert.throws(
    () => AD.aracKaydiniDogrula([], arac({ baslangic: tarih('2026-06-01'), bitis: tarih('2026-01-01') })),
    /once olamaz/,
  );
});

test('arac: otopark asimi ENGELLENMEZ, GORUNUR kilinir', () => {
  // Misafir araci ya da gecici durumlar mesrudur; karar yoneticinindir.
  const araclar = [
    arac({ id: 'a1', otoparkYeri: 'A-1' }),
    arac({ id: 'a2', plaka: '34ABC124', otoparkYeri: 'A-2' }),
  ];
  const durum = AD.otoparkDurumu({ bolumId: 'b1', hakSayisi: 1 }, araclar, tarih('2026-03-01'));
  assert.equal(durum.asimVarMi, true);
  assert.equal(durum.kullanilan, 2);
  assert.match(durum.mesaj, /gozden gecirin/);
});

test('arac: otopark yeri olmayan arac sayilmaz', () => {
  const durum = AD.otoparkDurumu(
    { bolumId: 'b1', hakSayisi: 1 },
    [arac({ otoparkYeri: null })],
    tarih('2026-03-01'),
  );
  assert.equal(durum.kullanilan, 0);
  assert.equal(durum.asimVarMi, false);
});

/* ---------------- Evcil hayvan (KMK md. 18) ---------------- */

const hayvan = (o = {}) => ({
  id: 'h1', bolumId: 'b1', kisiId: 'k1', tur: 'KEDI', ad: 'Tekir',
  cins: null, dogumYili: null, asiGecerlilikTarihi: null, kimlikNo: null,
  baslangic: tarih('2026-01-01'), bitis: null,
  onaylandiMi: false, onayReferansi: null, ...o,
});

test('evcil: politika yoksa SERBEST varsayilir', () => {
  const sonuc = AD.kaydiDegerlendir([], hayvan());
  assert.equal(sonuc.kabul, true);
  assert.equal(sonuc.onayGerekiyorMu, false);
});

test('evcil: YASAK tur kabul edilmez ama karar yoneticide kalir', () => {
  const politika = [{ tur: 'KOPEK', durum: 'YASAK', kaynakReferansi: 'YP md. 12', kosul: null }];
  const sonuc = AD.kaydiDegerlendir(politika, hayvan({ tur: 'KOPEK' }));
  assert.equal(sonuc.kabul, false);
  assert.match(sonuc.mesaj, /genel kurul karariyla/);
});

test('evcil: IZINLE tur onay bekler, onayla kabul edilir', () => {
  const politika = [{ tur: 'KOPEK', durum: 'IZINLE', kaynakReferansi: 'GK 2026/3', kosul: '15 kg alti' }];
  const onaysiz = AD.kaydiDegerlendir(politika, hayvan({ tur: 'KOPEK' }));
  assert.equal(onaysiz.kabul, false);
  assert.equal(onaysiz.onayGerekiyorMu, true);
  assert.match(onaysiz.mesaj, /15 kg alti/);

  const onayli = AD.kaydiDegerlendir(
    politika,
    hayvan({ tur: 'KOPEK', onaylandiMi: true, onayReferansi: 'Yonetim 2026/8' }),
  );
  assert.equal(onayli.kabul, true);
  assert.equal(onayli.onayGerekiyorMu, false);
});

test('evcil: sinirlama KAYNAK REFERANSI tasimak zorunda (KMK md. 18)', () => {
  const hatalar = AD.politikayiDogrula({
    tur: 'KOPEK', durum: 'YASAK', kaynakReferansi: null, kosul: null,
  });
  assert.equal(hatalar.length, 1);
  assert.match(hatalar[0], /belgeye dayanmalidir/);
  // SERBEST icin referans gerekmez.
  assert.equal(
    AD.politikayiDogrula({ tur: 'KEDI', durum: 'SERBEST', kaynakReferansi: null, kosul: null }).length,
    0,
  );
});

test('evcil: asi gecerliligi tarihe gore degerlendirilir', () => {
  const asili = hayvan({ asiGecerlilikTarihi: tarih('2026-12-31') });
  assert.equal(AD.asiGecerliMi(asili, tarih('2026-06-01')), true);
  assert.equal(AD.asiGecerliMi(asili, tarih('2027-01-01')), false);
  assert.equal(AD.asiGecerliMi(hayvan(), tarih('2026-06-01')), false);
});

/* ---------------- Belge ---------------- */

const belge = (o = {}) => ({
  id: 'd1', tip: 'YAZISMA', kapsam: 'BOLUM', hedefId: 'b1', ad: 'Yazi',
  surum: 1, oncekiSurumId: null,
  belgeTarihi: tarih('2020-01-15'), gecerlilikBitisi: null,
  dosyaAnahtari: 'k/1', dosyaBoyutu: 1024, icerikTipi: 'application/pdf',
  arsivMi: false, ...o,
});

test('belge: FINANSAL belge ASLA silinemez', () => {
  const politika = [{ tip: 'FATURA', saklamaYili: 10, finansalMi: true, kaynakReferansi: 'VUK' }];
  const sonuc = AD.silinebilirMi(politika, belge({ tip: 'FATURA', arsivMi: true }), tarih('2040-01-01'));
  assert.equal(sonuc.silinebilir, false);
  assert.match(sonuc.mesaj, /finansal siniftadir/);
});

test('belge: GUNCEL surum silinemez', () => {
  const politika = [{ tip: 'YAZISMA', saklamaYili: 2, finansalMi: false, kaynakReferansi: null }];
  const sonuc = AD.silinebilirMi(politika, belge({ arsivMi: false }), tarih('2030-01-01'));
  assert.equal(sonuc.silinebilir, false);
  assert.match(sonuc.mesaj, /Guncel surum silinemez/);
});

test('belge: saklama suresi dolmadan silinemez, dolunca silinebilir', () => {
  const politika = [{ tip: 'YAZISMA', saklamaYili: 5, finansalMi: false, kaynakReferansi: null }];
  const arsiv = belge({ arsivMi: true, belgeTarihi: tarih('2020-01-15') });
  assert.equal(AD.silinebilirMi(politika, arsiv, tarih('2023-01-01')).silinebilir, false);
  assert.equal(AD.silinebilirMi(politika, arsiv, tarih('2026-01-01')).silinebilir, true);
});

test('belge: suresiz saklanan tip silinemez', () => {
  const politika = [{ tip: 'YONETIM_PLANI', saklamaYili: null, finansalMi: false, kaynakReferansi: 'KMK' }];
  const sonuc = AD.silinebilirMi(
    politika, belge({ tip: 'YONETIM_PLANI', arsivMi: true }), tarih('2099-01-01'),
  );
  assert.equal(sonuc.silinebilir, false);
  assert.match(sonuc.mesaj, /suresiz saklanir/);
});

test('belge: surum zinciri kopamaz', () => {
  const v1 = belge({ id: 'v1', surum: 1 });
  // Dogru zincir
  assert.doesNotThrow(() =>
    AD.yeniSurumuDogrula(v1, belge({ id: 'v2', surum: 2, oncekiSurumId: 'v1' })));
  // Atlanan surum
  assert.throws(
    () => AD.yeniSurumuDogrula(v1, belge({ id: 'v3', surum: 3, oncekiSurumId: 'v1' })),
    /bir artmalidir/,
  );
  // Referans eksik
  assert.throws(
    () => AD.yeniSurumuDogrula(v1, belge({ id: 'v2', surum: 2, oncekiSurumId: null })),
    /referans vermelidir/,
  );
  // Tip degismis
  assert.throws(
    () => AD.yeniSurumuDogrula(v1, belge({ id: 'v2', surum: 2, oncekiSurumId: 'v1', tip: 'TAPU' })),
    /ayni belge tipinde/,
  );
  // Hedef degismis
  assert.throws(
    () => AD.yeniSurumuDogrula(v1, belge({ id: 'v2', surum: 2, oncekiSurumId: 'v1', hedefId: 'b9' })),
    /ayni kapsam ve hedefe/,
  );
});

test('belge: gecerliligi dolanlar listelenir, arsiv haric', () => {
  const dolan = belge({ id: 'p1', tip: 'SIGORTA_POLICESI', gecerlilikBitisi: tarih('2026-01-01') });
  const gecerli = belge({ id: 'p2', tip: 'SIGORTA_POLICESI', gecerlilikBitisi: tarih('2027-01-01') });
  const arsiv = belge({ id: 'p3', gecerlilikBitisi: tarih('2020-01-01'), arsivMi: true });

  const sonuc = AD.gecerliligiDolanlar([dolan, gecerli, arsiv], tarih('2026-06-01'));
  assert.deepEqual(sonuc.map((b) => b.id), ['p1']);
});
