/**
 * Tahsilat ve CARI YARDIMCI DEFTERI birim testleri (ADR-0010).
 *
 * En onemli ucu:
 *   · Tahsis toplami = tahsilat tutari — esit degilse para "kasada duran ama
 *     defterde gorunmeyen" hale gelir.
 *   · Ekstrede AYNI GUN borc once, tahsilat sonra — ters siralanirsa yuruyen
 *     bakiye o satirda negatif cikar ve "fazla odeme" sanilir.
 *   · Kontrol mutabakatinda TOLERANS YOK — bir kurus fark da farktir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const AD = await import('../../shared/apartman-domain/dist/index.js');
const K = await import('../../shared/kernel/dist/index.js');

const tl = (s) => K.money(s);
const gun = (s) => K.takvimTarihi(s);
const BUGUN = gun('2026-07-30');

/* ------------------------------- Tahsilat -------------------------------- */

function tahsilat(yama = {}) {
  return {
    kanal: 'NAKIT', tutar: tl('1000'), tahsilatTarihi: BUGUN,
    bankaHareketiVarMi: false, kiymetliEvrakVarMi: false, ...yama,
  };
}

test('tahsilat: gecerli nakit tahsilat kabul edilir', () => {
  assert.doesNotThrow(() => AD.tahsilatiDogrula(tahsilat(), BUGUN));
});

test('tahsilat: sifir/negatif tutar reddedilir', () => {
  assert.throws(() => AD.tahsilatiDogrula(tahsilat({ tutar: tl('0') }), BUGUN),
    /sifirdan buyuk/u);
});

test('tahsilat: gelecek tarih reddedilir', () => {
  assert.throws(
    () => AD.tahsilatiDogrula(tahsilat({ tahsilatTarihi: gun('2026-08-01') }), BUGUN),
    /gelecekte olamaz/u,
  );
});

/*
 * ⚠️  ISIN OZU: "banka" secilip banka hareketi baglanmazsa tahsilat
 *     mutabakatta GORUNMEZ — para hesaba girer ama hangi borcu kapattigi
 *     kayitsiz kalir.
 */
test('tahsilat: BANKA kanali banka hareketi ISTER', () => {
  assert.throws(
    () => AD.tahsilatiDogrula(tahsilat({ kanal: 'BANKA' }), BUGUN),
    /banka hareketi baglanmalidir/u,
  );
  assert.doesNotThrow(
    () => AD.tahsilatiDogrula(
      tahsilat({ kanal: 'BANKA', bankaHareketiVarMi: true }), BUGUN,
    ),
  );
});

test('tahsilat: NAKIT kanalina banka hareketi baglanamaz', () => {
  assert.throws(
    () => AD.tahsilatiDogrula(tahsilat({ bankaHareketiVarMi: true }), BUGUN),
    /banka hareketi baglanamaz/u,
  );
});

test('tahsilat: CEK/SENET kiymetli evrak ISTER', () => {
  for (const kanal of ['CEK', 'SENET']) {
    assert.throws(
      () => AD.tahsilatiDogrula(tahsilat({ kanal }), BUGUN),
      /kiymetli evrak baglanmalidir/u,
    );
    assert.doesNotThrow(
      () => AD.tahsilatiDogrula(
        tahsilat({ kanal, kiymetliEvrakVarMi: true }), BUGUN,
      ),
    );
  }
});

test('tahsilat: POS ve MAHSUP ek kanit istemez', () => {
  assert.doesNotThrow(() => AD.tahsilatiDogrula(tahsilat({ kanal: 'POS' }), BUGUN));
  assert.doesNotThrow(() => AD.tahsilatiDogrula(tahsilat({ kanal: 'MAHSUP' }), BUGUN));
});

test('iptal: muhasebelesmis tahsilat iptal EDILEMEZ', () => {
  assert.throws(
    () => AD.tahsilatIptalEdilebilirMi({ durum: 'GECERLI', yevmiyeFisiId: 'fis-1' }),
    /Muhasebelesmis tahsilat iptal edilemez/u,
  );
  assert.doesNotThrow(
    () => AD.tahsilatIptalEdilebilirMi({ durum: 'GECERLI', yevmiyeFisiId: null }),
  );
});

test('iptal: zaten iptal edilmis tahsilat tekrar iptal edilemez', () => {
  assert.throws(
    () => AD.tahsilatIptalEdilebilirMi({ durum: 'IPTAL', yevmiyeFisiId: null }),
    /zaten iptal/u,
  );
});

/* -------------------------------- Tahsis --------------------------------- */

function borc(yama = {}) {
  return {
    borcId: 'b1', borcSorumlusuId: null,
    tutar: tl('1000'), odenen: tl('0'),
    vadeTarihi: gun('2026-06-30'), ...yama,
  };
}

test('kalan bakiye: tutar - odenen', () => {
  assert.equal(K.apiBicimi(AD.kalanBakiye(borc({ odenen: tl('400') }))), '600.0000');
});

test('tahsis: tam eslesen tahsis kabul edilir', () => {
  assert.doesNotThrow(() => AD.tahsisleriDogrula(
    tl('1000'),
    [{ borcId: 'b1', borcSorumlusuId: null, tutar: tl('1000') }],
    [borc()],
  ));
});

/*
 * ⚠️  ISIN OZU: eksik tahsiste paranin bir kismi HICBIR BORCA sayilmaz ve
 *     hicbir yerde gorunmez — kasada duran ama defterde olmayan para.
 */
test('tahsis: EKSIK tahsis reddedilir ve avans desteklenmedigi soylenir', () => {
  let yakalanan = null;
  try {
    AD.tahsisleriDogrula(
      tl('1000'),
      [{ borcId: 'b1', borcSorumlusuId: null, tutar: tl('600') }],
      [borc()],
    );
  } catch (h) {
    yakalanan = h;
  }
  assert.notEqual(yakalanan, null, 'eksik tahsis reddedilmeliydi');
  assert.match(yakalanan.message, /esit degil; fark 400/u);
  // SONRAKI EYLEM avansin desteklenmedigini SOYLEMELI: kullanici aksi halde
  // "neden kabul etmiyor" sorusuna cevap bulamaz ve tutari zorlamaya calisir.
  assert.match(yakalanan.sonrakiEylem, /Avans/u);
});

test('tahsis: FAZLA tahsis reddedilir (var olmayan para)', () => {
  assert.throws(
    () => AD.tahsisleriDogrula(
      tl('500'),
      [{ borcId: 'b1', borcSorumlusuId: null, tutar: tl('900') }],
      [borc()],
    ),
    /var olmayan para|esit degil/u,
  );
});

test('tahsis: borcun KALAN bakiyesini asan tahsis reddedilir', () => {
  assert.throws(
    () => AD.tahsisleriDogrula(
      tl('800'),
      [{ borcId: 'b1', borcSorumlusuId: null, tutar: tl('800') }],
      [borc({ odenen: tl('400') })],
    ),
    /kalan bakiyesini/u,
  );
});

test('tahsis: bos tahsis listesi reddedilir', () => {
  assert.throws(() => AD.tahsisleriDogrula(tl('100'), [], [borc()]), /en az bir borca/u);
});

test('tahsis: acik borclar arasinda olmayan borca tahsis reddedilir', () => {
  assert.throws(
    () => AD.tahsisleriDogrula(
      tl('100'),
      [{ borcId: 'yok', borcSorumlusuId: null, tutar: tl('100') }],
      [borc()],
    ),
    /acik borclar arasinda yok/u,
  );
});

test('tahsis: ayni borc/pay icin iki satir reddedilir', () => {
  assert.throws(
    () => AD.tahsisleriDogrula(
      tl('300'),
      [
        { borcId: 'b1', borcSorumlusuId: null, tutar: tl('100') },
        { borcId: 'b1', borcSorumlusuId: null, tutar: tl('200') },
      ],
      [borc()],
    ),
    /iki tahsis satiri verilemez/u,
  );
});

/*
 * ⚠️  HISSELI MULKIYET: borc maliklere BOLUNUR. Bir malikin odemesi otekilerin
 *     borcunu kapatmamalidir; bu yuzden tahsis (borcId + borcSorumlusuId)
 *     ikilisine baglanir.
 */
test('tahsis: hisseli mulkiyette paylar AYRI izlenir', () => {
  const paylar = [
    borc({ borcId: 'b1', borcSorumlusuId: 's1', tutar: tl('500') }),
    borc({ borcId: 'b1', borcSorumlusuId: 's2', tutar: tl('500') }),
  ];
  // s1 kendi payini oder — gecerli.
  assert.doesNotThrow(() => AD.tahsisleriDogrula(
    tl('500'),
    [{ borcId: 'b1', borcSorumlusuId: 's1', tutar: tl('500') }],
    paylar,
  ));
  // s1'in payina 1000 yazilamaz: kendi payi 500.
  assert.throws(() => AD.tahsisleriDogrula(
    tl('1000'),
    [{ borcId: 'b1', borcSorumlusuId: 's1', tutar: tl('1000') }],
    paylar,
  ), /kalan bakiyesini/u);
});

/* ---------------------------- Otomatik tahsis ---------------------------- */

/*
 * ⚠️  EN ESKI VADE ONCE. En yeni borc once kapatilsaydi eski borc surekli acik
 *     kalir, gecikme faizi buyur ve borclu her ay odeme yapmasina ragmen
 *     "temerrutte" gorunurdu.
 */
test('otomatik tahsis: EN ESKI VADE once kapatilir', () => {
  const sonuc = AD.otomatikTahsis(tl('1200'), [
    borc({ borcId: 'yeni', tutar: tl('1000'), vadeTarihi: gun('2026-07-31') }),
    borc({ borcId: 'eski', tutar: tl('1000'), vadeTarihi: gun('2026-05-31') }),
  ]);
  assert.equal(sonuc.tahsisler.length, 2);
  assert.equal(sonuc.tahsisler[0].borcId, 'eski');
  assert.equal(K.apiBicimi(sonuc.tahsisler[0].tutar), '1000.0000');
  assert.equal(sonuc.tahsisler[1].borcId, 'yeni');
  assert.equal(K.apiBicimi(sonuc.tahsisler[1].tutar), '200.0000');
  assert.equal(K.apiBicimi(sonuc.kalan), '0.0000');
});

test('otomatik tahsis: kapanmis borc atlanir', () => {
  const sonuc = AD.otomatikTahsis(tl('500'), [
    borc({ borcId: 'kapali', tutar: tl('1000'), odenen: tl('1000'), vadeTarihi: gun('2026-01-31') }),
    borc({ borcId: 'acik', tutar: tl('600'), vadeTarihi: gun('2026-06-30') }),
  ]);
  assert.equal(sonuc.tahsisler.length, 1);
  assert.equal(sonuc.tahsisler[0].borcId, 'acik');
});

/*
 * ⚠️  ARTAN TUTAR `kalan` OLARAK DONER, sessizce yutulmaz. Yutulsaydi kullanici
 *     odemenin tamaminin dagitildigini sanirdi.
 */
test('otomatik tahsis: artan tutar kalan olarak DONER', () => {
  const sonuc = AD.otomatikTahsis(tl('1500'), [borc({ tutar: tl('1000') })]);
  assert.equal(K.apiBicimi(sonuc.kalan), '500.0000');
});

test('otomatik tahsis: kismi odenmis borcun KALANI kadar tahsis edilir', () => {
  const sonuc = AD.otomatikTahsis(tl('1000'), [
    borc({ tutar: tl('1000'), odenen: tl('700') }),
  ]);
  assert.equal(K.apiBicimi(sonuc.tahsisler[0].tutar), '300.0000');
  assert.equal(K.apiBicimi(sonuc.kalan), '700.0000');
});

/* ------------------------------ Cari ekstre ------------------------------ */

test('ekstre: yuruyen bakiye borcla artar tahsilatla azalir', () => {
  const e = AD.cariEkstre(tl('0'), [
    { tip: 'BORC', tarih: gun('2026-01-31'), aciklama: 'Ocak aidat', belgeNo: 'T-1', tutar: tl('1000') },
    { tip: 'TAHSILAT', tarih: gun('2026-02-05'), aciklama: 'Nakit', belgeNo: 'M-1', tutar: tl('400') },
    { tip: 'BORC', tarih: gun('2026-02-28'), aciklama: 'Subat aidat', belgeNo: 'T-2', tutar: tl('1000') },
  ]);
  assert.deepEqual(e.satirlar.map((s) => K.apiBicimi(s.bakiye)),
    ['1000.0000', '600.0000', '1600.0000']);
  assert.equal(K.apiBicimi(e.borcToplam), '2000.0000');
  assert.equal(K.apiBicimi(e.tahsilatToplam), '400.0000');
  assert.equal(K.apiBicimi(e.kapanisBakiyesi), '1600.0000');
});

/*
 * ⚠️  ISIN OZU: AYNI GUN icinde BORC once gelir. Ters siralanirsa tahsilat
 *     henuz dogmamis bir borcu kapatiyor gibi gorunur ve yuruyen bakiye o
 *     satirda NEGATIF cikar — okuyan "fazla odeme yapilmis" sanir.
 */
test('ekstre: AYNI GUN borc once, tahsilat sonra siralanir', () => {
  const e = AD.cariEkstre(tl('0'), [
    { tip: 'TAHSILAT', tarih: gun('2026-03-31'), aciklama: 'Odeme', belgeNo: 'M-2', tutar: tl('1000') },
    { tip: 'BORC', tarih: gun('2026-03-31'), aciklama: 'Mart aidat', belgeNo: 'T-3', tutar: tl('1000') },
  ]);
  assert.equal(e.satirlar[0].tip, 'BORC');
  assert.deepEqual(e.satirlar.map((s) => K.apiBicimi(s.bakiye)), ['1000.0000', '0.0000']);
});

/*
 * ⚠️  ACILIS BAKIYESI cagirandan gelir. Sifir varsayilsaydi her ekstre
 *     borclunun aralik oncesindeki gecmisini SILERDI.
 */
test('ekstre: acilis bakiyesi devreder', () => {
  const e = AD.cariEkstre(tl('2500'), [
    { tip: 'TAHSILAT', tarih: gun('2026-04-10'), aciklama: 'Odeme', belgeNo: 'M-3', tutar: tl('500') },
  ]);
  assert.equal(K.apiBicimi(e.kapanisBakiyesi), '2000.0000');
});

test('ekstre: bos aralikta acilis = kapanis', () => {
  const e = AD.cariEkstre(tl('750'), []);
  assert.equal(e.satirlar.length, 0);
  assert.equal(K.apiBicimi(e.kapanisBakiyesi), '750.0000');
});

/* --------------------------- Kontrol mutabakati -------------------------- */

/*
 * ⚠️  TOLERANS YOK: cift kayit muhasebesinde bir kurus fark da farktir ve
 *     donem kapanisini bloke eder.
 */
test('kontrol mutabakati: esitlik -> mutabik', () => {
  const m = AD.kontrolMutabakati(tl('15000'), tl('15000'));
  assert.equal(m.mutabikMi, true);
  assert.equal(K.apiBicimi(m.fark), '0.0000');
});

test('kontrol mutabakati: BIR KURUS fark bile mutabik DEGIL', () => {
  const m = AD.kontrolMutabakati(tl('15000.0001'), tl('15000'));
  assert.equal(m.mutabikMi, false);
  assert.equal(K.apiBicimi(m.fark), '0.0001');
});

test('kontrol mutabakati: fark isaretli doner', () => {
  const m = AD.kontrolMutabakati(tl('14000'), tl('15000'));
  assert.equal(K.apiBicimi(m.fark), '-1000.0000');
  assert.equal(m.mutabikMi, false);
});

/* ------------------------ Gecikme ve yaslandirma ------------------------- */

test('gecikmis borclar: kapanmis borc DISLANIR', () => {
  const liste = [
    borc({ borcId: 'a', vadeTarihi: gun('2026-01-31') }),
    borc({ borcId: 'b', vadeTarihi: gun('2026-01-31'), odenen: tl('1000') }),
    borc({ borcId: 'c', vadeTarihi: gun('2026-12-31') }),
  ];
  const sonuc = AD.gecikmisBorclar(liste, BUGUN);
  assert.deepEqual(sonuc.map((b) => b.borcId), ['a']);
});

test('yaslandirma: kovalar vadeye gore doldurulur', () => {
  const liste = [
    // 2026-07-30'a gore: vadesi gelmemis
    borc({ borcId: 'gelmemis', tutar: tl('100'), vadeTarihi: gun('2026-08-15') }),
    // 15 gun gecmis -> 1-30
    borc({ borcId: 'g15', tutar: tl('200'), vadeTarihi: gun('2026-07-15') }),
    // 60 gun gecmis -> 31-60
    borc({ borcId: 'g60', tutar: tl('300'), vadeTarihi: gun('2026-05-31') }),
    // 200 gun gecmis -> 91+
    borc({ borcId: 'g200', tutar: tl('400'), vadeTarihi: gun('2026-01-11') }),
  ];
  const kovalar = AD.alacakYaslandirmasi(liste, BUGUN);
  const bul = (e) => kovalar.find((k) => k.etiket === e);
  assert.equal(K.apiBicimi(bul('Vadesi gelmemis').tutar), '100.0000');
  assert.equal(K.apiBicimi(bul('1-30 gun').tutar), '200.0000');
  assert.equal(K.apiBicimi(bul('31-60 gun').tutar), '300.0000');
  assert.equal(K.apiBicimi(bul('91+ gun').tutar), '400.0000');
  // Toplam korunur: hicbir borc kovalar arasinda kaybolmaz.
  const toplam = kovalar.reduce((a, k) => a + Number(K.apiBicimi(k.tutar)), 0);
  assert.equal(toplam.toFixed(4), '1000.0000');
});

test('yaslandirma: kapanmis borc hicbir kovada YOK', () => {
  const kovalar = AD.alacakYaslandirmasi(
    [borc({ tutar: tl('1000'), odenen: tl('1000'), vadeTarihi: gun('2026-01-01') })],
    BUGUN,
  );
  const toplam = kovalar.reduce((a, k) => a + k.adet, 0);
  assert.equal(toplam, 0);
});
