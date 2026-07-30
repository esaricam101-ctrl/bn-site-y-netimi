/**
 * Banka cekirdegi birim testleri.
 *
 * Ikisi ozellikle onemli:
 *   · IBAN mod-97 — uzunluk denetimi tek hane hatasini YAKALAMAZ ve hata
 *     ancak para baska hesaba gittiginde anlasilir.
 *   · Cek durum makinesi — PORTFOYDE'den dogrudan TAHSIL_EDILDI'ye atlamak,
 *     bankaya verilmemis bir cekin tahsil edilmis gorunmesi demektir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const AD = await import('../../shared/apartman-domain/dist/index.js');
const K = await import('../../shared/kernel/dist/index.js');

const tl = (s) => K.money(s);
const gun = (s) => K.takvimTarihi(s);

/* --------------------------------- IBAN ---------------------------------- */

// Gecerli TR IBAN ornekleri (mod-97 = 1).
test('IBAN: gecerli TR IBAN kabul edilir', () => {
  assert.equal(AD.ibaniDogrula('TR330006100519786457841326'), 'TR330006100519786457841326');
  // Bosluklu ve kucuk harfli giris normallenir.
  assert.equal(
    AD.ibaniDogrula('tr33 0006 1005 1978 6457 8413 26'),
    'TR330006100519786457841326',
  );
});

/*
 * ⚠️  BU TEST ISIN OZU: asagidaki IBAN uzunluk ve onek olarak KUSURSUZDUR,
 *     yalnizca bir hanesi degistirilmistir. Mod-97 olmasaydi kabul edilir ve
 *     para baska bir hesaba giderdi.
 */
test('IBAN: tek hane hatasi mod-97 ile yakalanir', () => {
  assert.throws(
    () => AD.ibaniDogrula('TR330006100519786457841327'),
    /saglama toplami gecersiz/,
  );
});

test('IBAN: komsu hane yer degistirmesi yakalanir', () => {
  // 13|26 -> 13|62 (son iki hane yer degistirdi)
  assert.throws(
    () => AD.ibaniDogrula('TR330006100519786457841362'),
    /saglama toplami gecersiz/,
  );
});

test('IBAN: TR IBAN 26 karakter olmalidir', () => {
  assert.throws(() => AD.ibaniDogrula('TR33000610051978645784'), /26 karakter/);
});

test('IBAN: bicimsiz giris reddedilir', () => {
  assert.throws(() => AD.ibaniDogrula('33-0006-1005'), /Gecersiz IBAN bicimi/);
  assert.throws(() => AD.ibaniDogrula(''), /Gecersiz IBAN bicimi/);
});

test('IBAN: banka kodu 5-8. hanelerden okunur', () => {
  assert.equal(AD.ibandanBankaKodu('TR330006100519786457841326'), '00061');
  // TR olmayan IBAN'da EFT kodu kavrami yoktur.
  assert.equal(AD.ibandanBankaKodu('DE89370400440532013000'), null);
});

/* ------------------------------- Hareket --------------------------------- */

const BUGUN = gun('2026-07-30');

test('hareket: negatif/sifir tutar reddedilir', () => {
  for (const t of ['0', '0.0000']) {
    assert.throws(
      () => AD.hareketiDogrula(
        { islemTipi: 'HAVALE', yon: 'CIKIS', tutar: tl(t), islemTarihi: BUGUN, valorTarihi: null },
        BUGUN,
      ),
      /sifirdan buyuk/,
    );
  }
});

test('hareket: gelecek tarih reddedilir', () => {
  assert.throws(
    () => AD.hareketiDogrula(
      { islemTipi: 'HAVALE', yon: 'GIRIS', tutar: tl('100'), islemTarihi: gun('2026-08-01'), valorTarihi: null },
      BUGUN,
    ),
    /gelecekte olamaz/,
  );
});

test('hareket: valor islem tarihinden once olamaz', () => {
  assert.throws(
    () => AD.hareketiDogrula(
      {
        islemTipi: 'POS_TAHSILAT', yon: 'GIRIS', tutar: tl('100'),
        islemTarihi: gun('2026-07-20'), valorTarihi: gun('2026-07-19'),
      },
      BUGUN,
    ),
    /once olamaz/,
  );
});

// VIRMAN tek hareket olarak yazilamaz: iki bacagi vardir.
test('hareket: VIRMAN tek hareket olarak yazilamaz', () => {
  assert.throws(
    () => AD.hareketiDogrula(
      { islemTipi: 'VIRMAN', yon: 'CIKIS', tutar: tl('100'), islemTarihi: BUGUN, valorTarihi: null },
      BUGUN,
    ),
    /tek hareket olarak yazilamaz/,
  );
});

test('hareket: muhasebelesmis hareket degistirilemez', () => {
  assert.throws(
    () => AD.hareketDegistirilebilirMi({ yevmiyeFisiId: 'fis-1' }),
    /degistirilemez/,
  );
  assert.doesNotThrow(() => AD.hareketDegistirilebilirMi({ yevmiyeFisiId: null }));
});

test('virman: ayni hesaba yapilamaz', () => {
  assert.throws(
    () => AD.virmaniDogrula(
      { kaynakHesapId: 'h1', hedefHesapId: 'h1', tutar: tl('100'), islemTarihi: BUGUN },
      BUGUN,
    ),
    /ayni olamaz/,
  );
  assert.doesNotThrow(
    () => AD.virmaniDogrula(
      { kaynakHesapId: 'h1', hedefHesapId: 'h2', tutar: tl('100'), islemTarihi: BUGUN },
      BUGUN,
    ),
  );
});

test('bakiye: giris ekler, cikis cikarir', () => {
  const b = AD.hesapBakiyesi(tl('1000'), [
    { yon: 'GIRIS', tutar: tl('500') },
    { yon: 'CIKIS', tutar: tl('200') },
    { yon: 'GIRIS', tutar: tl('50.25') },
  ]);
  assert.equal(K.apiBicimi(b), '1350.2500');
});

/* ------------------------------ Komisyon --------------------------------- */

test('komisyon: binde oran BigInt ile hesaplanir', () => {
  // %2,5 = BINDE 25. 1000 TL uzerinden 25 TL.
  assert.equal(K.apiBicimi(AD.posKomisyonu(tl('1000'), 25)), '25.0000');
  // Binde 250 = %25 -> 250 TL. Birim karisikligi kurusu 10 kat sasirtir.
  assert.equal(K.apiBicimi(AD.posKomisyonu(tl('1000'), 250)), '250.0000');
  assert.equal(K.apiBicimi(AD.posKomisyonu(tl('1000'), 0)), '0.0000');
  // Kesirli gercek oran: %1,79 temsil edilemez -> binde 18'e yuvarlanir.
  assert.equal(K.apiBicimi(AD.posKomisyonu(tl('1000'), 18)), '18.0000');
});

test('komisyon: gecersiz oran reddedilir', () => {
  assert.throws(() => AD.posKomisyonu(tl('100'), -1), /Gecersiz komisyon/);
  assert.throws(() => AD.posKomisyonu(tl('100'), 1001), /Gecersiz komisyon/);
});

/* ------------------------------ Mutabakat -------------------------------- */

const AYAR = { toleransKurus: 0, gunPenceresi: 3 };

function satir(yama = {}) {
  return {
    id: 's1', islemTarihi: gun('2026-07-15'), yon: 'GIRIS', tutar: tl('1500'),
    referansNo: null, mutabakatDurumu: 'ESLESMEDI', eslesenHareketId: null, ...yama,
  };
}
function aday(yama = {}) {
  return {
    hareketId: 'h1', yon: 'GIRIS', tutar: tl('1500'),
    islemTarihi: gun('2026-07-15'), referansNo: null, esleshmisMi: false, ...yama,
  };
}

test('mutabakat: referans no tam eslesmesi once denenir', () => {
  const s = satir({ referansNo: 'REF-99' });
  const sonuc = AD.eslestirmeAdayiBul(s, [
    aday({ hareketId: 'h1', referansNo: 'REF-99', tutar: tl('9999') }),
    aday({ hareketId: 'h2', referansNo: null }),
  ], AYAR);
  // Tutar tutmasa bile REFERANS kazanir: dekont numarasi tekildir.
  assert.deepEqual(sonuc, { hareketId: 'h1', yontem: 'REFERANS' });
});

test('mutabakat: tutar+tarih ile eslesir', () => {
  const sonuc = AD.eslestirmeAdayiBul(satir(), [aday()], AYAR);
  assert.deepEqual(sonuc, { hareketId: 'h1', yontem: 'TUTAR_TARIH' });
});

/*
 * ⚠️  BIRDEN COK ADAY -> null. Makine tahmin ederse yanlis eslesme sessizce
 *     mutabakati tamamlanmis gosterir; belirsizligi kullanici cozer.
 */
test('mutabakat: birden cok aday varsa otomatik secim YAPILMAZ', () => {
  const sonuc = AD.eslestirmeAdayiBul(satir(), [
    aday({ hareketId: 'h1' }),
    aday({ hareketId: 'h2' }),
  ], AYAR);
  assert.equal(sonuc, null);
});

test('mutabakat: zaten eslesmis hareket aday DEGILDIR', () => {
  const sonuc = AD.eslestirmeAdayiBul(satir(), [aday({ esleshmisMi: true })], AYAR);
  assert.equal(sonuc, null);
});

test('mutabakat: ters yonlu hareket aday DEGILDIR', () => {
  const sonuc = AD.eslestirmeAdayiBul(satir({ yon: 'GIRIS' }), [aday({ yon: 'CIKIS' })], AYAR);
  assert.equal(sonuc, null);
});

test('mutabakat: tarih penceresi disi aday DEGILDIR', () => {
  const sonuc = AD.eslestirmeAdayiBul(
    satir({ islemTarihi: gun('2026-07-15') }),
    [aday({ islemTarihi: gun('2026-07-25') })],
    AYAR,
  );
  assert.equal(sonuc, null);
});

test('mutabakat: tolerans tutar farkini kabul eder', () => {
  const tol = { toleransKurus: 10000, gunPenceresi: 3 }; // 1 TL (olcek 4)
  const sonuc = AD.eslestirmeAdayiBul(satir(), [aday({ tutar: tl('1500.50') })], tol);
  assert.deepEqual(sonuc, { hareketId: 'h1', yontem: 'TUTAR_TARIH' });
});

test('eslestirme dogrulama: ters yon reddedilir', () => {
  assert.throws(
    () => AD.eslestirmeyiDogrula(satir({ yon: 'GIRIS' }), aday({ yon: 'CIKIS' }), AYAR),
    /Yonler uyusmuyor/,
  );
});

test('eslestirme dogrulama: eslesmis hareket ikinci kez kullanilamaz', () => {
  assert.throws(
    () => AD.eslestirmeyiDogrula(satir(), aday({ esleshmisMi: true }), AYAR),
    /baska bir ekstre satiriyla zaten eslesmis/,
  );
});

test('eslestirme dogrulama: mutabik satir tekrar eslestirilemez', () => {
  assert.throws(
    () => AD.eslestirmeyiDogrula(satir({ mutabakatDurumu: 'ESLESTI' }), aday(), AYAR),
    /zaten mutabik edilmis/,
  );
});

/*
 * ⚠️  `mutabikMi` SADECE satir sayisina bakmaz. Bakiye farki varsa mutabakat
 *     tamamlanmamistir: ekstrede hic gorunmeyen bir sistem hareketi (bizde
 *     var, bankada yok) butun satirlar eslesse de fark uretir.
 */
test('mutabakat ozeti: bakiye farki varsa mutabik DEGIL', () => {
  const o = AD.mutabakatOzeti(
    [satir({ mutabakatDurumu: 'ESLESTI' })],
    tl('5000'), tl('4900'),
  );
  assert.equal(o.eslesmeyenSayisi, 0);
  assert.equal(K.apiBicimi(o.bakiyeFarki), '100.0000');
  assert.equal(o.mutabikMi, false);
});

test('mutabakat ozeti: hepsi eslesti ve bakiye tuttu -> mutabik', () => {
  const o = AD.mutabakatOzeti(
    [satir({ mutabakatDurumu: 'ESLESTI' })],
    tl('5000'), tl('5000'),
  );
  assert.equal(o.mutabikMi, true);
});

/* --------------------------- Kiymetli evrak ------------------------------ */

function gecis(yama = {}) {
  return {
    mevcut: 'PORTFOYDE', hedef: 'TAHSILDE', gerekce: null,
    tahsilHesabiVarMi: false, tahsilTarihiVarMi: false, ...yama,
  };
}

/*
 * ⚠️  ISIN OZU: PORTFOYDE -> TAHSIL_EDILDI ATLAMASI YASAK. Izin verilseydi
 *     "tahsilde bekleyen cekler" listesi hicbir zaman dogru olmazdi.
 */
test('cek: PORTFOYDE -> TAHSIL_EDILDI atlanamaz', () => {
  assert.throws(
    () => AD.durumGecisiniDogrula(gecis({
      hedef: 'TAHSIL_EDILDI', tahsilHesabiVarMi: true, tahsilTarihiVarMi: true,
    })),
    /gecilemez/,
  );
});

test('cek: PORTFOYDE -> TAHSILDE gecerli', () => {
  assert.doesNotThrow(() => AD.durumGecisiniDogrula(gecis()));
});

test('cek: TAHSILDE -> TAHSIL_EDILDI hesap ve tarih ister', () => {
  assert.throws(
    () => AD.durumGecisiniDogrula(gecis({ mevcut: 'TAHSILDE', hedef: 'TAHSIL_EDILDI' })),
    /hesap ve tahsil tarihi zorunludur/,
  );
  assert.doesNotThrow(
    () => AD.durumGecisiniDogrula(gecis({
      mevcut: 'TAHSILDE', hedef: 'TAHSIL_EDILDI',
      tahsilHesabiVarMi: true, tahsilTarihiVarMi: true,
    })),
  );
});

test('cek: KARSILIKSIZ ve IADE gerekce ister', () => {
  assert.throws(
    () => AD.durumGecisiniDogrula(gecis({ mevcut: 'TAHSILDE', hedef: 'KARSILIKSIZ' })),
    /gerekce zorunludur/,
  );
  assert.doesNotThrow(
    () => AD.durumGecisiniDogrula(gecis({
      mevcut: 'TAHSILDE', hedef: 'KARSILIKSIZ', gerekce: 'Banka karsiliksiz dondu',
    })),
  );
});

// Tahsil edilmis cek geri donmez — kapali durum.
test('cek: TAHSIL_EDILDI kapali durumdur', () => {
  assert.throws(
    () => AD.durumGecisiniDogrula(gecis({ mevcut: 'TAHSIL_EDILDI', hedef: 'PORTFOYDE' })),
    /kapali durum/,
  );
});

// Karsiliksiz cek YENIDEN tahsile verilebilir (yeniden ibraz / yasal takip).
test('cek: KARSILIKSIZ -> TAHSILDE gecerli', () => {
  assert.doesNotThrow(
    () => AD.durumGecisiniDogrula(gecis({ mevcut: 'KARSILIKSIZ', hedef: 'TAHSILDE' })),
  );
});

test('cek: ayni duruma gecis reddedilir', () => {
  assert.throws(
    () => AD.durumGecisiniDogrula(gecis({ mevcut: 'TAHSILDE', hedef: 'TAHSILDE' })),
    /zaten TAHSILDE/,
  );
});

test('kiymetli evrak: vade alis tarihinden once olamaz', () => {
  assert.throws(
    () => AD.kiymetliEvrakiDogrula({
      tip: 'CEK', tutar: tl('1000'),
      vadeTarihi: gun('2026-07-01'), alisTarihi: gun('2026-07-15'),
      borcluAdi: 'Ahmet Yilmaz', evrakNo: '0012345',
    }),
    /once olamaz/,
  );
});

test('kiymetli evrak: borclu adi zorunlu', () => {
  assert.throws(
    () => AD.kiymetliEvrakiDogrula({
      tip: 'SENET', tutar: tl('1000'),
      vadeTarihi: gun('2026-09-01'), alisTarihi: gun('2026-07-15'),
      borcluAdi: 'AB', evrakNo: '1',
    }),
    /Borclu adi zorunludur/,
  );
});

test('vadesi gelenler: kapali durumlar DISLANIR', () => {
  const liste = [
    { vadeTarihi: gun('2026-07-01'), durum: 'PORTFOYDE' },
    { vadeTarihi: gun('2026-07-01'), durum: 'TAHSIL_EDILDI' },
    { vadeTarihi: gun('2026-07-01'), durum: 'CIRO_EDILDI' },
    { vadeTarihi: gun('2026-07-01'), durum: 'KARSILIKSIZ' },
    { vadeTarihi: gun('2026-12-01'), durum: 'PORTFOYDE' },
  ];
  const sonuc = AD.vadesiGelenler(liste, BUGUN);
  // PORTFOYDE + KARSILIKSIZ = 2; tahsil/ciro edilmisler ve ileri vadeli haric.
  assert.equal(sonuc.length, 2);
});

test('gunFarki: isaretsiz ve simetrik', () => {
  assert.equal(AD.gunFarki(gun('2026-07-15'), gun('2026-07-18')), 3);
  assert.equal(AD.gunFarki(gun('2026-07-18'), gun('2026-07-15')), 3);
});
