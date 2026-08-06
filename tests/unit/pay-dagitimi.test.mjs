/**
 * CT-27 / 7a · PAY DAGITIMI — resolver seviyesi (ADR-0018 · K1 · K3 · K5)
 *
 * ⚠️  NEDEN VAR: `df7def1` pay dagitimini duzeltti ama TESTSIZDI. Kusur suydu:
 *     bolusum yalnizca `sira === 'ASIL'` satirlarina uygulaniyor, IKINCIL
 *     malikler HER DURUMDA borcun TAMAMINI aliyordu.
 *
 * ★ 7a YALNIZCA RESOLVER'I KAPSAR. Ekstre gorunumu (ASIL/IKINCIL bolumleri,
 *   yuruyen bakiye yalnizca ASIL) 7b'nin isidir. K3 ANCAK IKISI BIRDEN
 *   YESILKEN kapanir — tek ad altinda yazilsaydi yesil bir CT-27/7, hic
 *   sinanmamis ekran tarafini da kanitlanmis gosterirdi.
 *
 * ★ AYIRT EDICI IDDIA: ayni fikstur KULLANANA_AIT ve MALIKE_AIT ile ayri
 *   ayri kosar. Kusur tam olarak bu ikisinin ayristigi yerde dogdu
 *   (ADR-0018 §2.5 — nufus uyusmazligi): eski kod `asillar.length` ile
 *   `donemHisseleri.length` karsilastiriyordu; KULLANANA_AIT'te birincisi
 *   KIRACIYI sayar, ikincisi MALIKLERI. Kiracili bolumde 1 != 2 oldugu icin
 *   bolusum HIC calismiyordu.
 *
 * ⚠️  VERITABANI GEREKTIRMEZ. `zincireDagit` saf fonksiyondur; girdisi elle
 *     kurulmus zincir + hisse dizisi. Tohuma DOKUNULMAZ -- tohum sorumlulari
 *     kendi kuruyor ve teminat katmanini hic uretmiyor (tohum sadakati
 *     bulgusu, yol haritasi).
 *
 * Dosya `.mjs` ve `dist/` uzerinden ice alir: klasordeki oteki testlerle
 * ayni kalip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../../shared/kernel/dist/index.js');
const AD = await import('../../shared/apartman-domain/dist/index.js');

const { money } = K;
const { zincireDagit } = AD;

const TARIH = '2026-07-01';
const KIRACI = 'kisi-kiraci';
const M1 = 'kisi-malik-1';
const M2 = 'kisi-malik-2';
const M3 = 'kisi-malik-3';

const ETIKET = {
  kapiNo: '7',
  kisiAdi: new Map([[KIRACI, 'Kiraci'], [M1, 'Malik1'], [M2, 'Malik2'], [M3, 'Malik3']]),
};

const sorumlu = (kisiId, sira, rol) => ({ kisiId, sira, rol, cozumlemeTarihi: TARIH });
const hisse = (kisiId, pay, payda) => ({
  kisiId, hissePay: BigInt(pay), hissePayda: BigInt(payda),
  baslangic: '2020-01-01', bitis: null,
});

/**
 * Kimlik → olcekli tamsayi. Karsilastirmalar TAMSAYI uzerinden yapilir.
 *
 * ⚠️  `Money.kurus` adina ragmen KURUS DEGIL, dort ondalikli olcektir
 *     (`1500.00` → `15000000`); semadaki `Decimal(18,4)` ile ayni. Beklenen
 *     degerler bu yuzden SABIT YAZILMAZ, girdi tutarindan TURETILIR —
 *     olcek degisirse test kirilmaz, yanlis yesil de olmaz.
 */
const paylar = (sonuc) => new Map(sonuc.map((s) => [s.kisiId, s.pay.kurus]));
const toplam = (sonuc) => sonuc.reduce((t, s) => t + s.pay.kurus, 0n);

/* ── KULLANANA_AIT: ASIL kiraci, IKINCIL malikler ───────────────────────── */

test('7a · KULLANANA_AIT — IKINCIL malikler hisselerine gore boluser', () => {
  /*
   * ⛔ ESKI KOD BURADA 150000'ER YAZIYORDU (her malige borcun TAMAMI).
   *    Test bu sayiyi hedeflemezse df7def1'i kanitlamaz.
   */
  const T = money('1500.00');
  const sonuc = zincireDagit(
    T,
    [
      sorumlu(KIRACI, 'ASIL', 'KIRACI'),
      sorumlu(M1, 'IKINCIL', 'MALIK'),
      sorumlu(M2, 'IKINCIL', 'MALIK'),
    ],
    [hisse(M1, 1, 2), hisse(M2, 1, 2)],
    'HISSE_ORANI',
    ETIKET,
  );

  const p = paylar(sonuc);
  // Kiraci hisse TASIMAZ; borcun tamamindan sorumludur.
  assert.equal(p.get(KIRACI), T.kurus);
  assert.equal(p.get(M1), T.kurus / 2n, 'IKINCIL malik hissesine gore bolusmedi');
  assert.equal(p.get(M2), T.kurus / 2n);
  // ★ ASIL GERILEME KORUMASI: eski kod buraya TAM TUTAR yaziyordu.
  assert.notEqual(p.get(M1), T.kurus, 'IKINCIL malik yine tam tutar aliyor');
});

test('7a · MALIKE_AIT — ayni hisseler, ayni paylar (ASIL katmani)', () => {
  /*
   * ★ AYIRT EDICI KARSILASTIRMA: bu dal ESKIDEN DE dogru calisiyordu.
   *   Yan yana durmasi, kusurun "bolusum hic yok" degil "yanlis NUFUS
   *   karsilastiriliyor" oldugunu teste yazar.
   */
  const T = money('1500.00');
  const sonuc = zincireDagit(
    T,
    [sorumlu(M1, 'ASIL', 'MALIK'), sorumlu(M2, 'ASIL', 'MALIK')],
    [hisse(M1, 1, 2), hisse(M2, 1, 2)],
    'HISSE_ORANI',
    ETIKET,
  );

  const p = paylar(sonuc);
  assert.equal(p.get(M1), T.kurus / 2n);
  assert.equal(p.get(M2), T.kurus / 2n);
});

test('7a · SEMANTIK KATMANDAN BAGIMSIZ — ayni malik, iki katman, ayni pay', () => {
  /*
   * K5: bir malik bir katmanda payina gore, otekinde muteselsil OLAMAZ.
   * Ayni hukuki soru, iki yer.
   */
  const hisseler = [hisse(M1, 1, 2), hisse(M2, 1, 2)];
  const asilOlarak = zincireDagit(
    money('1500.00'),
    [sorumlu(M1, 'ASIL', 'MALIK'), sorumlu(M2, 'ASIL', 'MALIK')],
    hisseler, 'HISSE_ORANI', ETIKET,
  );
  const ikincilOlarak = zincireDagit(
    money('1500.00'),
    [
      sorumlu(KIRACI, 'ASIL', 'KIRACI'),
      sorumlu(M1, 'IKINCIL', 'MALIK'),
      sorumlu(M2, 'IKINCIL', 'MALIK'),
    ],
    hisseler, 'HISSE_ORANI', ETIKET,
  );

  assert.equal(paylar(asilOlarak).get(M1), paylar(ikincilOlarak).get(M1));
  assert.equal(paylar(asilOlarak).get(M2), paylar(ikincilOlarak).get(M2));
});

/* ── Yuvarlama (K4) ─────────────────────────────────────────────────────── */

test('7a · YUVARLAMA — artik EN BUYUK paya gider, toplam korunur', () => {
  /*
   * ⚠️  BOLUNEN TUTAR HICBIR SEY SINAMAZ. Olcek dort ondalikli oldugu icin
   *     `1500,00` ve `1000,01` bile dorde tam bolunur; artik hic dogmaz.
   *     `1000,0001` secildi — olcekli degeri TEK sayidir.
   *
   * ⚠️  UC ESIT HISSEDE "en buyuk pay" YOKTUR ve iddia siralamaya baglanir.
   *     Bu yuzden hisseler ESIT DEGIL: 1/2 + 1/4 + 1/4.
   */
  const T = money('1000.0001');

  // (0) GUARD — artik gercekten dogmuyorsa bu test hicbir sey olcmez.
  assert.notEqual(T.kurus % 4n, 0n, 'secilen tutar dorde tam bolunuyor');

  const sonuc = zincireDagit(
    T,
    [
      sorumlu(M1, 'ASIL', 'MALIK'),
      sorumlu(M2, 'ASIL', 'MALIK'),
      sorumlu(M3, 'ASIL', 'MALIK'),
    ],
    [hisse(M1, 1, 2), hisse(M2, 1, 4), hisse(M3, 1, 4)],
    'HISSE_ORANI',
    ETIKET,
  );

  const p = paylar(sonuc);
  // ★ Toplamin korunmasi ASIL kuraldir: kurus kaybolursa borc eksik yazilir.
  assert.equal(toplam(sonuc), T.kurus, 'toplam korunmadi');
  // Esit hisseli ikisi ayrismaz; artigi en buyuk pay yuklenir.
  assert.equal(p.get(M2), p.get(M3), 'esit hisseli ikisi ayristi');
  assert.ok(
    p.get(M1) > T.kurus / 2n,
    'artik en buyuk paya gitmedi (tam yarisinda kaldi)',
  );
});

test('7a · ESIT HISSEDE artik ILK sorumluya gider — KASITLI davranis', () => {
  /*
   * `dagit` en buyugu KESIN BUYUKTUR (>) ile arar; esitlikte `hedef` 0'da
   * kalir. Yani artik DIZIDEKI ILK sorumluya gider.
   *
   * ★ Bu iddia BILINCLI olarak yaziliyor: davranis belgelenmezse ileride
   *   biri diziyi yeniden siralar ve artik sessizce baska kisiye kayar.
   *   CT-26'daki determinizm dersinin ayni sinifi.
   */
  const T = money('1000.0001');
  const sonuc = zincireDagit(
    T,
    [
      sorumlu(M1, 'ASIL', 'MALIK'),
      sorumlu(M2, 'ASIL', 'MALIK'),
      sorumlu(M3, 'ASIL', 'MALIK'),
    ],
    [hisse(M1, 1, 3), hisse(M2, 1, 3), hisse(M3, 1, 3)],
    'HISSE_ORANI',
    ETIKET,
  );

  const p = paylar(sonuc);
  assert.equal(toplam(sonuc), T.kurus, 'toplam korunmadi');
  assert.ok(p.get(M1) > p.get(M2), 'artik ilk sorumluya gitmedi');
  assert.equal(p.get(M2), p.get(M3), 'esit hisseli ikisi ayristi');
});

/* ── Gerileme kontrolu ──────────────────────────────────────────────────── */

test('7a · TEK MALIK — borcun tamami, davranis degismedi', () => {
  const T = money('1500.00');
  const sonuc = zincireDagit(
    T,
    [sorumlu(M1, 'ASIL', 'MALIK')],
    [hisse(M1, 1, 1)],
    'HISSE_ORANI',
    ETIKET,
  );
  assert.equal(paylar(sonuc).get(M1), T.kurus);
});

test('7a · KIRACI hisse tasimaz — tek malikli kiracili bolumde de tam tutar', () => {
  const T = money('1500.00');
  const sonuc = zincireDagit(
    T,
    [sorumlu(KIRACI, 'ASIL', 'KIRACI'), sorumlu(M1, 'IKINCIL', 'MALIK')],
    [hisse(M1, 1, 1)],
    'HISSE_ORANI',
    ETIKET,
  );
  const p = paylar(sonuc);
  assert.equal(p.get(KIRACI), T.kurus);
  assert.equal(p.get(M1), T.kurus, 'tek malik ikincil olarak tam tutari almadi');
});
