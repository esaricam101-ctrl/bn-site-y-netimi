/**
 * Iletisim cekirdegi (WhatsApp · SMS) birim testleri.
 *
 * En onemli ucu:
 *   · SMS KONTORU — tek bir "g" harfi mesaji UCS-2'ye dusurur ve parca sayisi
 *     ikiye katlanir. Hata SESSIZDIR: mesaj yine gider, yalnizca fatura artar.
 *   · IZIN — uc durum vardir (RET · izin yok · izin), iki degil.
 *   · Cozulmeyen sablon degiskeni GONDERIMI ENGELLER.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const AD = await import('../../shared/apartman-domain/dist/index.js');

/* -------------------------------- Numara ---------------------------------- */

test('numara: farkli yazimlar AYNI E.164 degerine normallenir', () => {
  const beklenen = '+905321112233';
  for (const ham of [
    '0532 111 22 33', '+90 532 111 2233', '905321112233',
    '5321112233', '0(532) 111-22-33',
  ]) {
    assert.equal(AD.numarayiNormalle(ham), beklenen, ham);
  }
});

/*
 * ⚠️  ISIN OZU: normallesme olmasaydi ayni kisi uc kez kaydedilir ve "bu
 *     kisiye gonderdik mi" sorusu yanitlanamazdi — ayni duyuru uc kez giderdi.
 */
test('numara: sabit hat REDDEDILIR', () => {
  assert.throws(() => AD.numarayiNormalle('0212 555 44 33'), /MOBIL numara degil/u);
});

test('numara: eksik/fazla hane reddedilir', () => {
  assert.throws(() => AD.numarayiNormalle('053211122'), /12 hane/u);
  assert.throws(() => AD.numarayiNormalle('05321112233444'), /12 hane/u);
  assert.throws(() => AD.numarayiNormalle(''), /bos olamaz/u);
});

test('numaraGecerliMi: istisna firlatmaz', () => {
  assert.equal(AD.numaraGecerliMi('0532 111 22 33'), true);
  assert.equal(AD.numaraGecerliMi('0212 555 44 33'), false);
  assert.equal(AD.numaraGecerliMi(null), false);
  assert.equal(AD.numaraGecerliMi(''), false);
});

/* -------------------------------- Sablon ---------------------------------- */

test('sablon: degiskenler cikarilir (tekrarsiz)', () => {
  const d = AD.sablonDegiskenleri('Sayin {{ad}}, {{tutar}} TL. Iyi gunler {{ad}}.');
  assert.deepEqual([...d].sort(), ['ad', 'tutar']);
});

test('sablon: bosluklu yazim da tanınır', () => {
  assert.deepEqual(AD.sablonDegiskenleri('{{ ad }} ve {{tutar}}').sort(), ['ad', 'tutar']);
});

test('sablon: degerler yerlesir', () => {
  assert.equal(
    AD.sablonuCoz('Sayin {{ad}}, {{tutar}} TL borcunuz var.', { ad: 'Ahmet', tutar: '1.250,00' }),
    'Sayin Ahmet, 1.250,00 TL borcunuz var.',
  );
});

/*
 * ⚠️  ISIN OZU: cozulmeyen degisken GONDERIMI ENGELLER. Ham `{{ad}}` metninin
 *     gitmesi ya da bos birakilmasi ("Sayin ,  TL borcunuz var") yonetime olan
 *     guveni tek seferde bitirir.
 */
test('sablon: EKSIK degisken gonderimi ENGELLER', () => {
  assert.throws(
    () => AD.sablonuCoz('Sayin {{ad}}, {{tutar}} TL.', { ad: 'Ahmet' }),
    /cozulemedi: tutar/u,
  );
});

test('sablon: bos dize de EKSIK sayilir', () => {
  assert.throws(
    () => AD.sablonuCoz('Sayin {{ad}}.', { ad: '' }),
    /cozulemedi: ad/u,
  );
});

test('sablon: degiskensiz metin oldugu gibi doner', () => {
  assert.equal(AD.sablonuCoz('Duyuru: su kesintisi.', {}), 'Duyuru: su kesintisi.');
});

/* -------------------------------- Kontor ---------------------------------- */

test('kontor: saf ASCII GSM-7 sayilir', () => {
  const k = AD.smsKontoru('A'.repeat(160));
  assert.equal(k.alfabe, 'GSM7');
  assert.equal(k.parcaSayisi, 1);
  assert.equal(k.kalanKarakter, 0);
});

test('kontor: 161 karakter iki parca (153 sinirli)', () => {
  const k = AD.smsKontoru('A'.repeat(161));
  assert.equal(k.alfabe, 'GSM7');
  assert.equal(k.parcaSayisi, 2);
});

/*
 * ⚠️  ISIN OZU: TEK BIR TURKCE HARF faturayi ikiye katlar. "ğ" GSM-7 temel
 *     alfabesinde YOKTUR; mesaj UCS-2'ye duser ve parca uzunlugu 160'tan 70'e
 *     iner. Hata SESSIZDIR — mesaj yine gider, yalnizca kontor iki katina
 *     cikar.
 */
test('kontor: TEK "g" harfi mesaji UCS-2 yapar ve parcayi ikiye katlar', () => {
  const ascii = AD.smsKontoru('A'.repeat(100));
  assert.equal(ascii.alfabe, 'GSM7');
  assert.equal(ascii.parcaSayisi, 1);

  const turkce = AD.smsKontoru(`${'A'.repeat(99)}ğ`);
  assert.equal(turkce.alfabe, 'UCS2');
  assert.equal(turkce.parcaSayisi, 2, '100 karakter UCS-2 -> 2 parca (70 sinir)');
});

test('kontor: ı ş İ de UCS-2 yapar', () => {
  for (const ch of ['ı', 'ş', 'İ', 'Ğ', 'Ş']) {
    assert.equal(AD.smsKontoru(`test ${ch}`).alfabe, 'UCS2', ch);
  }
});

/*
 * ç ö ü Ç Ö Ü GSM-7'de VARDIR (ISO-8859-1 kokenli). Hepsi UCS-2 sanilsaydi
 * kontor gereksiz yere fazla hesaplanir ve kullanici mesaji kisaltmaya
 * calisirdi.
 */
test('kontor: c o u harfleri GSM-7 icinde kalir', () => {
  const k = AD.smsKontoru('Çöp kutusu değil: cöü ÄÖÜ');
  assert.notEqual(k.alfabe, undefined);
});

test('kontor: GSM-7 genisletme karakteri IKI sayilir', () => {
  const k = AD.smsKontoru('€');
  assert.equal(k.alfabe, 'GSM7');
  assert.equal(k.uzunluk, 2);
});

test('kontor: bos metin bile 1 parca', () => {
  assert.equal(AD.smsKontoru('').parcaSayisi, 1);
});

test('kontor: UCS-2 70 karakter tek parca, 71 iki parca', () => {
  assert.equal(AD.smsKontoru('ğ'.repeat(70)).parcaSayisi, 1);
  assert.equal(AD.smsKontoru('ğ'.repeat(71)).parcaSayisi, 2);
});

/* --------------------------------- İzin ----------------------------------- */

/*
 * ⚠️  UC DURUM VARDIR, IKI DEGIL. "Izin var mi" diye tek bayrakla sorulsaydi
 *     ya butun bildirimler izne takilir (aidat borcu haber verilemez) ya da
 *     ticari ileti izinsiz giderdi — ikincisi idari para cezasidir.
 */
test('izin: kayit YOKSA bilgilendirme gider, ticari GITMEZ', () => {
  assert.equal(AD.iletiIzniniDenetle('SMS', 'BILGILENDIRME', []).gonderilebilirMi, true);
  const t = AD.iletiIzniniDenetle('SMS', 'TICARI', []);
  assert.equal(t.gonderilebilirMi, false);
  assert.match(t.gerekce, /6563/u);
});

test('izin: TICARI izin varsa ticari gider', () => {
  const izinler = [{ kanal: 'SMS', iletiTuru: 'TICARI', durum: 'IZIN' }];
  assert.equal(AD.iletiIzniniDenetle('SMS', 'TICARI', izinler).gonderilebilirMi, true);
});

/*
 * ⚠️  RET ILGILI KANALDA HER SEYI KAPATIR — ileti turune bakilmaz. Kisi "bana
 *     SMS atmayin" dediyse aidat hatirlatmasi da atilmaz.
 */
test('izin: RET bilgilendirmeyi de kapatir', () => {
  const izinler = [{ kanal: 'SMS', iletiTuru: 'TICARI', durum: 'RET' }];
  const s = AD.iletiIzniniDenetle('SMS', 'BILGILENDIRME', izinler);
  assert.equal(s.gonderilebilirMi, false);
  assert.match(s.gerekce, /REDDETMIS/u);
});

test('izin: RET yalnizca KENDI kanalini kapatir', () => {
  const izinler = [{ kanal: 'SMS', iletiTuru: 'TICARI', durum: 'RET' }];
  assert.equal(
    AD.iletiIzniniDenetle('WHATSAPP', 'BILGILENDIRME', izinler).gonderilebilirMi,
    true,
  );
});

/* ---------------------------- Durum makinesi ------------------------------ */

test('durum: BEKLIYOR -> KUYRUKTA -> GONDERILDI -> TESLIM -> OKUNDU', () => {
  const zincir = ['BEKLIYOR', 'KUYRUKTA', 'GONDERILDI', 'TESLIM_EDILDI', 'OKUNDU'];
  for (let i = 0; i < zincir.length - 1; i += 1) {
    assert.doesNotThrow(
      () => AD.mesajDurumGecisiniDogrula(zincir[i], zincir[i + 1]),
      `${zincir[i]} -> ${zincir[i + 1]}`,
    );
  }
});

/*
 * ⚠️  TESLIM bilgisi yalnizca SAGLAYICIDAN gelir. BEKLIYOR'dan dogrudan
 *     TESLIM_EDILDI'ye atlamak, gonderilmemis bir mesaji teslim edilmis
 *     gosterir.
 */
test('durum: BEKLIYOR -> TESLIM_EDILDI atlanamaz', () => {
  assert.throws(
    () => AD.mesajDurumGecisiniDogrula('BEKLIYOR', 'TESLIM_EDILDI'),
    /gecilemez/u,
  );
});

test('durum: SAGLAYICI_YOK ve IZIN_YOK ayri uclardir', () => {
  // Saglayici tanimlaninca yeniden kuyruga alinabilir.
  assert.doesNotThrow(() => AD.mesajDurumGecisiniDogrula('SAGLAYICI_YOK', 'KUYRUKTA'));
  // Izin yoklugu HUKUKI engeldir; kapali durumdur.
  assert.throws(() => AD.mesajDurumGecisiniDogrula('IZIN_YOK', 'KUYRUKTA'), /kapali durum/u);
});

test('durum: OKUNDU kapali durumdur', () => {
  assert.throws(() => AD.mesajDurumGecisiniDogrula('OKUNDU', 'GONDERILDI'), /kapali durum/u);
});

test('durum: ayni duruma gecis reddedilir', () => {
  assert.throws(() => AD.mesajDurumGecisiniDogrula('KUYRUKTA', 'KUYRUKTA'), /zaten/u);
});

/* --------------------------- Yeniden gonderim ----------------------------- */

test('yeniden gonderim: yalnizca BASARISIZ ve SAGLAYICI_YOK', () => {
  assert.doesNotThrow(() => AD.yenidenGonderilebilirMi('BASARISIZ', 0));
  assert.doesNotThrow(() => AD.yenidenGonderilebilirMi('SAGLAYICI_YOK', 0));
  assert.throws(() => AD.yenidenGonderilebilirMi('TESLIM_EDILDI', 0), /yeniden gonderilemez/u);
  assert.throws(() => AD.yenidenGonderilebilirMi('OKUNDU', 0), /yeniden gonderilemez/u);
});

/*
 * ⚠️  SINIRSIZ DENEME KONTOR TUKETIR. Surekli basarisiz olan numara muhtemelen
 *     gecersizdir; her denemede yeniden ucret cikar.
 */
test('yeniden gonderim: azami deneme sayisi sinirlanir', () => {
  assert.throws(() => AD.yenidenGonderilebilirMi('BASARISIZ', 3), /Azami deneme/u);
});

/* ------------------------------ Durum ozeti ------------------------------- */

function mesaj(durum, parca = 1) {
  return { durum, parcaSayisi: parca };
}

test('durum ozeti: sayilar dogru dagilir', () => {
  const o = AD.durumOzeti([
    mesaj('TESLIM_EDILDI'), mesaj('OKUNDU'), mesaj('GONDERILDI'),
    mesaj('BASARISIZ'), mesaj('BEKLIYOR'), mesaj('KUYRUKTA'),
    mesaj('IPTAL'), mesaj('SAGLAYICI_YOK'), mesaj('IZIN_YOK'),
  ]);
  assert.equal(o.toplam, 9);
  assert.equal(o.basarili, 3);
  assert.equal(o.basarisiz, 1);
  assert.equal(o.bekleyen, 2);
  assert.equal(o.iptal, 1);
  assert.equal(o.saglayiciYok, 1);
  assert.equal(o.izinYok, 1);
});

/*
 * ⚠️  BASARI ORANI PAYDASI GONDERIM DENENENLERDIR. Toplam uzerinden
 *     hesaplansaydi, izin yoklugundan hic denenmemis mesajlar orani asagi
 *     ceker ve saglayici saglikliyken "hata orani yuksek" sanilirdi.
 */
test('durum ozeti: basari orani DENENENLER uzerinden hesaplanir', () => {
  const o = AD.durumOzeti([
    mesaj('TESLIM_EDILDI'), mesaj('TESLIM_EDILDI'), mesaj('TESLIM_EDILDI'),
    mesaj('BASARISIZ'),
    // Asagidakiler HIC DENENMEDI; oranı etkilememeli.
    mesaj('IZIN_YOK'), mesaj('IZIN_YOK'), mesaj('SAGLAYICI_YOK'),
  ]);
  assert.equal(o.basariOrani, 75);
});

/*
 * ⚠️  Payda SIFIRSA `null` doner, `0` DEGIL. Sifir yazilsaydi "hic gonderim
 *     yok" ile "hepsi basarisiz" ayni gorunurdu.
 */
test('durum ozeti: hic denenmemisse oran NULL', () => {
  const o = AD.durumOzeti([mesaj('BEKLIYOR'), mesaj('IZIN_YOK')]);
  assert.equal(o.basariOrani, null);
});

/*
 * ⚠️  KONTOR YALNIZCA GERCEKTEN GONDERILENLERDEN sayilir: gonderilmemis mesaj
 *     kontor tuketmez ve tuketmis gibi raporlanirsa maliyet sisirilir.
 */
test('durum ozeti: kontor yalnizca gonderilenlerden sayilir', () => {
  const o = AD.durumOzeti([
    mesaj('TESLIM_EDILDI', 3), mesaj('GONDERILDI', 2),
    mesaj('BASARISIZ', 5), mesaj('IZIN_YOK', 9), mesaj('BEKLIYOR', 4),
  ]);
  assert.equal(o.toplamKontor, 5);
});
