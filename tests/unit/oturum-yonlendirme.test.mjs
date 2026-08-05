/**
 * OTURUM DUSTUGUNDE GIRIS SAYFASINA YONLENDIRME — iki karar, iki risk.
 *
 * ⚠️  NEDEN VAR: 401 alan her ekran ham hata metni gosteriyordu ("Kimlik
 *     dogrulamasi gerekli" + destek numarasi + ISE YARAMAYAN bir "Tekrar
 *     dene" dugmesi). Jeton `sessionStorage`tadir ve TARAYICI KAPANINCA
 *     SILINIR — yani bu kenar durum degil, olagan akis. Urun sahibini iki
 *     kez engelledi.
 *
 * BU DOSYA IKI SEYI KORUR:
 *
 *   1) GIRIS UCU MUAFIYETI. Olculdu: `POST /oturum/giris` yanlis sifrede
 *      **401** doner. Muafiyet dusesse her yanlis sifre denemesi sayfayi
 *      yeniler ve kullanici "E-posta veya sifre hatali" mesajini HIC
 *      goremez. Bu, duzeltmenin kendisinden daha kotu bir kusur olurdu.
 *
 *   2) ACIK YONLENDIRME (open redirect) KORUMASI. `?donus=` degeri adres
 *      cubugundan gelir. Dogrudan kullanilsaydi saldirgan, kullaniciyi
 *      giris sonrasi kendi kopya sayfasina atabilirdi. `//baska-site`
 *      tarayicida DIS adrestir ve tek slash kontrolu bunu kacirir.
 *
 * Dosya `.mjs`: klasordeki oteki testlerle ayni kalip. Node 24 ice alinan
 * `.ts` dosyasinin tiplerini yerlesik olarak soyar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  donusYoluGuvenliMi, oturumYonlendirmesiGerekliMi,
} from '../../frontend/web/lib/oturum-yolu.ts';

test('401 alan olagan bir uc icin yonlendirme YAPILIR', () => {
  assert.equal(oturumYonlendirmesiGerekliMi('/gider-turleri', '/tahakkuk'), true);
  assert.equal(oturumYonlendirmesiGerekliMi('/muhasebe/hesaplar', '/muhasebe'), true);
});

test('★ GIRIS UCU MUAF — yanlis sifre sayfayi yenilemez', () => {
  // Muafiyet dususe kullanici hata mesajini hic goremez.
  assert.equal(oturumYonlendirmesiGerekliMi('/oturum/giris', '/giris'), false);
  assert.equal(oturumYonlendirmesiGerekliMi('/oturum/yenile', '/yonetim'), false);
});

test('★ ZATEN /giris SAYFASINDAYSAK yonlendirme YOK — sonsuz dongu', () => {
  assert.equal(oturumYonlendirmesiGerekliMi('/gider-turleri', '/giris'), false);
});

test('donus yolu — uygulama ici mutlak yol KABUL', () => {
  assert.equal(donusYoluGuvenliMi('/tahakkuk'), true);
  assert.equal(donusYoluGuvenliMi('/muhasebe?sekme=mizan'), true);
});

test('★ ACIK YONLENDIRME REDDEDILIR', () => {
  // Protokol-goreli adres: tarayici bunu DIS adres olarak cozer. Yalnizca
  // "/" ile basliyor mu diye bakan bir kontrol bunu KACIRIR.
  assert.equal(donusYoluGuvenliMi('//kotu-site.example'), false);
  assert.equal(donusYoluGuvenliMi('https://kotu-site.example'), false);
  assert.equal(donusYoluGuvenliMi('http://kotu-site.example'), false);
  // Goreli yol da reddedilir: hangi dizine gore cozulecegi belirsizdir.
  assert.equal(donusYoluGuvenliMi('tahakkuk'), false);
});

test('donus yoksa ya da bossa varsayilan panele dusulur', () => {
  assert.equal(donusYoluGuvenliMi(null), false);
  assert.equal(donusYoluGuvenliMi(''), false);
});
