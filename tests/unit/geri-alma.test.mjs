/**
 * GENEL GERI AL (UNDO) kurallari.
 *
 * En onemli ucu:
 *   · FINANSAL kayit SILINMEZ — yol TERS_KAYIT'tir.
 *   · Bilinmeyen varlik REDDEDILIR ("muhtemelen ana veridir" varsayimi
 *     finansal bir kaydi sildirirdi).
 *   · Sonradan degismis kayitta guncelleme geri alinamaz — alinabilseydi
 *     sonraki degisiklikler SESSIZCE silinirdi.
 *   · Her ret bir GEREKCE tasir; gerekcesiz ret kullaniciyi ayni islemi
 *     tekrar denemeye iter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const D = await import('../../shared/core-domain/dist/index.js');

function girdi(yama = {}) {
  return {
    varlik: 'Kisi', eylem: 'GUNCELLE',
    islemSahibiId: 'u1', talepEdenId: 'u1',
    zatenGeriAlindiMi: false, dahaYeniDegisiklikVarMi: false, ...yama,
  };
}

/* ------------------------------ Yetki sinirlari --------------------------- */

/*
 * ⚠️  KULLANICI BAZLI. Baskasinin islemi geri alinamaz — ayni role sahip bir
 *     kullanici baskasinin islemini geri alabilseydi "kendi son islemim"
 *     kavrami anlamsiz olurdu.
 */
test('baskasinin islemi geri alinamaz', () => {
  const s = D.geriAlinabilirMi(girdi({ islemSahibiId: 'u2' }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /başka bir kullanıcı/iu);
});

test('zaten geri alinmis islem tekrar geri alinamaz', () => {
  const s = D.geriAlinabilirMi(girdi({ zatenGeriAlindiMi: true }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /zaten geri alınmış/iu);
});

/*
 * ⚠️  Yetki gerekcesi ONCE gelir: kendi islemi olmayan bir kayit hakkinda
 *     "zaten geri alinmis" gibi ayrinti vermek gereksiz bilgi sizdirir.
 */
test('yetki gerekcesi oteki gerekcelerden ONCE gelir', () => {
  const s = D.geriAlinabilirMi(girdi({
    islemSahibiId: 'u2', zatenGeriAlindiMi: true,
  }));
  assert.match(s.gerekce, /başka bir kullanıcı/iu);
});

/* --------------------------- Geri alinamaz eylemler ----------------------- */

test('okuma ve oturum kayitlari geri alinamaz', () => {
  for (const eylem of ['OKU', 'DISA_AKTAR', 'GIRIS', 'CIKIS']) {
    const s = D.geriAlinabilirMi(girdi({ eylem }));
    assert.equal(s.geriAlinabilirMi, false, eylem);
    assert.match(s.gerekce, /geri alınacak bir değişiklik yok/iu);
  }
});

/*
 * ⚠️  KVKK: anonimlestirme geri DONDURULEMEZ. "Geri al" sunulsaydi kullanici
 *     verinin hala durdugunu sanirdi.
 */
test('anonimlestirme geri alinamaz (KVKK)', () => {
  const s = D.geriAlinabilirMi(girdi({ eylem: 'ANONIMLESTIR' }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /KVKK/u);
});

test('onay/red is akisi karari geri alinamaz', () => {
  for (const eylem of ['ONAYLA', 'REDDET']) {
    const s = D.geriAlinabilirMi(girdi({ eylem }));
    assert.equal(s.geriAlinabilirMi, false, eylem);
    assert.match(s.gerekce, /karşı kararla/iu);
  }
});

/*
 * ⚠️  ISIN OZU: bilinmeyen varlik REDDEDILIR. "Muhtemelen ana veridir"
 *     varsayimiyla devam edilseydi, listeye eklenmeyi unutmus FINANSAL bir
 *     varlik silinebilirdi.
 */
test('bilinmeyen varlik REDDEDILIR', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'HicBilinmeyenSey' }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /kuralı tanımlı değil/iu);
});

/* -------------------------------- Finansal -------------------------------- */

/*
 * ⚠️  FINANSAL KAYIT SILINMEZ: yontem TERS_KAYIT'tir ve onay metni bunu
 *     kullaniciya ACIKCA soyler.
 */
test('finansal OLUSTUR -> TERS_KAYIT, onay metni silinmeyecegini soyler', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Tahsilat', eylem: 'OLUSTUR' }));
  assert.equal(s.geriAlinabilirMi, true);
  assert.equal(s.yontem, 'TERS_KAYIT');
  assert.match(s.onayMetni, /SİLİNMEYECEK/u);
});

test('finansal GUNCELLE/SOFT_SIL geri alinamaz', () => {
  for (const eylem of ['GUNCELLE', 'SOFT_SIL']) {
    const s = D.geriAlinabilirMi(girdi({ varlik: 'YevmiyeFisi', eylem }));
    assert.equal(s.geriAlinabilirMi, false, eylem);
    assert.match(s.gerekce, /ters kayıtla/iu);
  }
});

test('muhasebelesmis finansal kayit geri alinamaz', () => {
  const s = D.geriAlinabilirMi(girdi({
    varlik: 'Tahsilat', eylem: 'OLUSTUR', muhasebelestiMi: true,
  }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /storno/iu);
});

test('zaten ters kayitli finansal kayit geri alinamaz', () => {
  const s = D.geriAlinabilirMi(girdi({
    varlik: 'Tahsilat', eylem: 'OLUSTUR', zatenTersKayitliMi: true,
  }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /zaten ters kayıtlanmış|iptal edilmiş/iu);
});

/*
 * ⚠️  KAPALI DONEM her seyden once gelir: kapanmis mali yilin kaydi
 *     degistirilemez.
 */
test('kapali donem geri almayi engeller', () => {
  const s = D.geriAlinabilirMi(girdi({
    varlik: 'YevmiyeFisi', eylem: 'OLUSTUR', donemKapaliMi: true,
  }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /KAPALI/u);
});

/* --------------------------------- Belge ---------------------------------- */

test('belge yukleme geri alinirsa ARSIVLENIR, dosya silinmez', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Belge', eylem: 'OLUSTUR' }));
  assert.equal(s.yontem, 'ARSIVLE');
  assert.match(s.onayMetni, /dosya silinmeyecek/iu);
});

test('belge GUNCELLE geri alinamaz — surumlenir', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Belge', eylem: 'GUNCELLE' }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /sürüm/iu);
});

test('arsivlenmis belge geri yuklenebilir', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Belge', eylem: 'SOFT_SIL' }));
  assert.equal(s.yontem, 'GERI_YUKLE');
});

/* -------------------------------- Ana veri -------------------------------- */

test('ana veri OLUSTUR -> ARSIVLE (soft delete)', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Kisi', eylem: 'OLUSTUR' }));
  assert.equal(s.yontem, 'ARSIVLE');
  assert.match(s.onayMetni, /veri silinmeyecek/iu);
});

test('ana veri SOFT_SIL -> GERI_YUKLE', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Arac', eylem: 'SOFT_SIL' }));
  assert.equal(s.yontem, 'GERI_YUKLE');
});

test('ana veri GUNCELLE -> ALAN_GERI_AL', () => {
  const s = D.geriAlinabilirMi(girdi({ varlik: 'Kisi', eylem: 'GUNCELLE' }));
  assert.equal(s.yontem, 'ALAN_GERI_AL');
});

/*
 * ⚠️  ISIN OZU: sonradan degismis kayitta eski bir guncellemeyi geri almak,
 *     SONRAKI degisiklikleri de sessizce siler.
 */
test('sonradan degismis kayitta guncelleme geri ALINAMAZ', () => {
  const s = D.geriAlinabilirMi(girdi({
    varlik: 'Kisi', eylem: 'GUNCELLE', dahaYeniDegisiklikVarMi: true,
  }));
  assert.equal(s.geriAlinabilirMi, false);
  assert.match(s.gerekce, /sonraki değişiklikleri de sessizce siler/iu);
});

/*
 * Sonradan degisiklik OLUSTUR/SOFT_SIL'i engellemez: arsivleme ve geri yukleme
 * alan degeri yazmaz, yalnizca silme bayragini cevirir.
 */
test('sonradan degisiklik OLUSTUR ve SOFT_SIL geri almayi engellemez', () => {
  for (const eylem of ['OLUSTUR', 'SOFT_SIL']) {
    const s = D.geriAlinabilirMi(girdi({
      varlik: 'Kisi', eylem, dahaYeniDegisiklikVarMi: true,
    }));
    assert.equal(s.geriAlinabilirMi, true, eylem);
  }
});

/* --------------------------- Geri alinacak alanlar ------------------------ */

/*
 * ⚠️  YALNIZCA DEGISEN alanlar yazilir. `oncekiDeger`in tamami yazilsaydi,
 *     denetim kaydina girmemis ama sonradan degismis alanlar da eski degere
 *     donerdi — kullanicinin hic dokunmadigi veriyi geri almis olurduk.
 */
test('geri alinacak alanlar: yalnizca DEGISENLER', () => {
  const alanlar = D.geriAlinacakAlanlar(
    { ad: 'Ahmet', soyad: 'Yilmaz', telefon: '555' },
    { ad: 'Mehmet', soyad: 'Yilmaz', telefon: '555' },
  );
  assert.deepEqual(alanlar, { ad: 'Ahmet' });
});

test('geri alinacak alanlar: onceki deger yoksa bos', () => {
  assert.deepEqual(D.geriAlinacakAlanlar(null, { ad: 'X' }), {});
});

test('geri alinacak alanlar: sonraki degerde olmayan alan da geri alinir', () => {
  const alanlar = D.geriAlinacakAlanlar({ notlar: 'eski not' }, {});
  assert.deepEqual(alanlar, { notlar: 'eski not' });
});

/* ------------------------------ Varlik siniflari -------------------------- */

test('varlik siniflari: finansal varliklar dogru isaretli', () => {
  for (const v of ['Tahsilat', 'YevmiyeFisi', 'BankaHareketi', 'Borc']) {
    assert.equal(D.VARLIK_SINIFLARI[v], 'FINANSAL', v);
  }
});

test('varlik siniflari: belge BELGE, kisi ANA_VERI', () => {
  assert.equal(D.VARLIK_SINIFLARI['Belge'], 'BELGE');
  assert.equal(D.VARLIK_SINIFLARI['Kisi'], 'ANA_VERI');
});
