/**
 * HİSSE DOĞRULAMASI — `hisseleriZorunluKil` + iki temsil (ADR-0018 · K5)
 *
 * ⚠️  NEDEN ÖNCE TEST, SONRA BAĞLAMA: `hisseleriZorunluKil`in HİÇBİR
 *     ÇAĞIRANI YOK. Çağrılmayan kod, bugüne kadar hiç KOŞULMAMIŞ olabilir.
 *     Testsiz hâlde tahakkuk yoluna bağlamak `df7def1` dersini tekrarlamak
 *     olurdu — bu commit YALNIZCA TEST, çağıran eklenmiyor.
 *
 * ⚠️  İKİ TEMSİL ÖLÇÜLÜYOR (Bölüm B). Doğrulama KESİRLİ aritmetik yapar
 *     (`kesirleriTopla` — pay/payda tam, ebob ile sadeleşir); dağıtım
 *     ÖLÇEKLİ bigint kullanır (`hisseAgirligi`, 1/3 → 333333). Önceki turda
 *     "ayrışmıyor" denmişti ama bu AKIL YÜRÜTMEYDİ, ölçüm değil. B'nin işi
 *     ölçmek.
 *
 * Veritabanı gerektirmez; fikstür elle kurulmuş hisse dizisi.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../../shared/kernel/dist/index.js');
const AD = await import('../../shared/apartman-domain/dist/index.js');

const { money } = K;
const { hisseleriZorunluKil, hisseleriDogrula, zincireDagit } = AD;

const TARIH = '2026-07-01';
const M = (n) => `kisi-malik-${n}`;

const hisse = (kisiId, pay, payda, baslangic = '2020-01-01', bitis = null) => ({
  kisiId, hissePay: BigInt(pay), hissePayda: BigInt(payda), baslangic, bitis,
});

const yakala = (fn) => {
  try { fn(); return null; } catch (e) { return e; }
};

/* ══ A · hisseleriZorunluKil ══════════════════════════════════════════════ */

test('A1 · toplam TAM (1/2 + 1/2) — gecer ve SUZULMUS liste doner', () => {
  const girdi = [hisse(M(1), 1, 2), hisse(M(2), 1, 2)];
  const sonuc = hisseleriZorunluKil(girdi, TARIH);
  assert.equal(sonuc.length, 2);
  assert.deepEqual(sonuc.map((h) => h.kisiId).sort(), [M(1), M(2)]);
});

test('A2 · toplam EKSIK (1/2 + 1/4) — hata, mesaj BULUNAN TOPLAMI soyluyor', () => {
  /*
   * ⚠️  IDDIA MESAJ ICERIGINI HEDEFLIYOR, `toThrow()` yetmez: mesaj
   *     sonradan genel bir metne donusurse test yine yesil kalirdi.
   *
   * ⛔ K5 mesajin BOLUMU ve KAYITLI HISSELERI de soylemesini istiyor.
   *    Bu fonksiyon BUNLARI BILMEZ (domain katmani; bolum kavrami yok) ve
   *    mesaji yalnizca tarih + toplam + yon tasiyor. Eksik BURADA
   *    kapatilamaz; zenginlestirme BAGLAMA yerinde yapilacak —
   *    `zincireDagit`in `PayEtiketleri` deseninin aynisi. Bulgu devir
   *    notunda.
   */
  const h = yakala(() => hisseleriZorunluKil([hisse(M(1), 1, 2), hisse(M(2), 1, 4)], TARIH));
  assert.ok(h !== null, 'eksik toplam hata firlatmadi');
  assert.match(h.message, /toplami 1 degil/i);
  // Bulunan toplam: 3/4 = 0.750000
  assert.match(h.message, /0\.750000/, 'mesaj bulunan toplami soylemiyor');
  // Yon: eksikte "sahipsiz", fazlada "fazla cikar".
  assert.match(h.message, /sahipsiz/i);
});

test('A3 · toplam FAZLA (1/1 + 1/1 — yarim kalmis devir) — hata', () => {
  const h = yakala(() => hisseleriZorunluKil([hisse(M(1), 1, 1), hisse(M(2), 1, 1)], TARIH));
  assert.ok(h !== null, 'fazla toplam hata firlatmadi');
  assert.match(h.message, /2\.000000/, 'mesaj bulunan toplami soylemiyor');
  // ★ Yon AYIRT EDILIYOR: fazla toplamda "tahsilat fazla cikar" denir.
  assert.match(h.message, /fazla cikar/i);
});

test('A4 · malik kaydi HIC YOK — AYRI mesaj', () => {
  /*
   * Tarama bu ayrimin var oldugunu gostermisti: alti bolumun tamami
   * "malik kaydi yok" sinifindaydi, "toplam 1 degil" sinifinda DEGIL.
   * Ikisi ayni mesaja dusseydi tarama sonucu yanlis okunurdu.
   */
  const h = yakala(() => hisseleriZorunluKil([], TARIH));
  assert.ok(h !== null);
  assert.match(h.message, /malik kaydi yok/i);
  assert.doesNotMatch(h.message, /toplami 1 degil/i, 'iki hata sinifi ayni mesaja dustu');
});

test('A5 · SUZME iceride — tarih disi kayit listeden duser', () => {
  /*
   * ⛔ `tarihtekiMalikler` yuklemi FONKSIYONUN ICINDE. Cagiran tarafta
   *    tekrarlanirsa ADR-0018 §2.5'te curutulen "iki nufus" kusurunun
   *    kopyasi dogar. Bu test suzmenin iceride oldugunu SABITLER.
   */
  const girdi = [
    hisse(M(1), 1, 2),
    hisse(M(2), 1, 2),
    // Tapusu 2025'te biten eski malik — 2026-07-01'de GECERSIZ.
    hisse(M(3), 1, 1, '2019-01-01', '2025-12-31'),
  ];
  const sonuc = hisseleriZorunluKil(girdi, TARIH);
  assert.equal(sonuc.length, 2, 'tarih disi kayit suzulmedi');
  assert.ok(!sonuc.some((h) => h.kisiId === M(3)), 'eski malik listede kaldi');
});

test('A6 · 1/3 + 1/3 + 1/3 — KESIRLI aritmetikte tam eder, GECER', () => {
  /*
   * ★ ASIL SORU: olcekli temsilde 333333 x 3 = 999999 != 1000000.
   *   Dogrulama kesirli calistigi icin (kesirleriTopla + ebob) bu kume
   *   TAM eder ve gecer. B1 ayni kumenin dagitimda da dogru calistigini
   *   olcer — ikisi ayrisirsa bulgu B'nin ciktisidir.
   */
  const girdi = [hisse(M(1), 1, 3), hisse(M(2), 1, 3), hisse(M(3), 1, 3)];
  const sonuc = hisseleriZorunluKil(girdi, TARIH);
  assert.equal(sonuc.length, 3);
  assert.equal(hisseleriDogrula(girdi, TARIH).gecerli, true);
});

/* ══ B · İki temsil: kesirli ↔ ölçekli ════════════════════════════════════ */

/** Doğrulamayı GEÇEN kümeler — B1 hepsini dağıtımda sınar. */
const GECERLI_KUMELER = [
  ['1/2 + 1/2', [hisse(M(1), 1, 2), hisse(M(2), 1, 2)]],
  ['1/3 + 1/3 + 1/3', [hisse(M(1), 1, 3), hisse(M(2), 1, 3), hisse(M(3), 1, 3)]],
  ['1/2 + 1/4 + 1/4', [hisse(M(1), 1, 2), hisse(M(2), 1, 4), hisse(M(3), 1, 4)]],
  ['6 x 1/6', [1, 2, 3, 4, 5, 6].map((n) => hisse(M(n), 1, 6))],
  ['tek malik 1/1', [hisse(M(1), 1, 1)]],
];

const ETIKET = { kapiNo: '7', kisiAdi: new Map() };
const sorumlu = (kisiId) => ({ kisiId, sira: 'ASIL', rol: 'MALIK', cozumlemeTarihi: TARIH });

test('B1 · dogrulamayi GECEN her kume icin Sigma pay = tutar', () => {
  /*
   * ⚠️  TUTAR BOLUNMEYEN SECILDI. `Money.kurus` KURUS DEGIL, dort ondalikli
   *     olcektir (1500.00 -> 15000000); 1000,01 bile dorde tam bolunur.
   *     1000,0001 kullanildi.
   */
  const T = money('1000.0001');

  // (0) GUARD — tutar bolunuyorsa bu test hicbir sey olcmez.
  assert.notEqual(T.kurus % 4n, 0n, 'secilen tutar dorde tam bolunuyor');
  assert.notEqual(T.kurus % 3n, 0n, 'secilen tutar uce tam bolunuyor');
  assert.notEqual(T.kurus % 6n, 0n, 'secilen tutar altiya tam bolunuyor');

  for (const [ad, hisseler] of GECERLI_KUMELER) {
    // Once dogrulamadan gecmeli: B yalnizca GECEN kumeleri sinar.
    const suzulmus = hisseleriZorunluKil(hisseler, TARIH);

    const sonuc = zincireDagit(
      T, suzulmus.map((h) => sorumlu(h.kisiId)), suzulmus, 'HISSE_ORANI', ETIKET,
    );
    const toplam = sonuc.reduce((t, s) => t + s.pay.kurus, 0n);

    assert.equal(
      toplam, T.kurus,
      `${ad}: dagitim toplami tutari tutmuyor (kesirli gecti, olcekli ayristi)`,
    );
    assert.equal(sonuc.length, hisseler.length, `${ad}: sorumlu sayisi degisti`);
  }
});

test('B3 · yuvarlama artigi — ESIT OLMAYAN hisselerde en buyuk paya gider', () => {
  /*
   * ⚠️  Hisseler ESIT OLMAYAN secildi (1/2 + 1/4 + 1/4): uc esit hissede
   *     "en buyuk pay" YOKTUR ve iddia dizi siralamasina baglanirdi.
   */
  const T = money('1000.0001');
  const hisseler = [hisse(M(1), 1, 2), hisse(M(2), 1, 4), hisse(M(3), 1, 4)];
  const suzulmus = hisseleriZorunluKil(hisseler, TARIH);

  const sonuc = zincireDagit(
    T, suzulmus.map((h) => sorumlu(h.kisiId)), suzulmus, 'HISSE_ORANI', ETIKET,
  );
  const p = new Map(sonuc.map((s) => [s.kisiId, s.pay.kurus]));

  assert.equal(sonuc.reduce((t, s) => t + s.pay.kurus, 0n), T.kurus, 'toplam korunmadi');
  assert.equal(p.get(M(2)), p.get(M(3)), 'esit hisseli ikisi ayristi');
  assert.ok(p.get(M(1)) > T.kurus / 2n, 'artik en buyuk paya gitmedi');
});
