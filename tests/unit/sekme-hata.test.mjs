/**
 * Sekme hata yonlendirmesi — sekmeli formlarin ASIL RISKI.
 *
 * Gizli sekmedeki dogrulama hatasi gorunmezse kullanici Kaydet'e basar,
 * hicbir sey olmaz ve nedenini goremez. Iki koruma bu iki fonksiyona dayanir:
 * rozet sayisi ve gonderim sonrasi hatali sekmeye gecis.
 *
 * Dosya `.mjs`: klasordeki oteki testlerle ayni. Ice alinan `.ts` dosyasinin
 * tiplerini Node 24 YERLESIK olarak soyutlar, derleme adimi gerekmez.
 *
 * ⚠️  `.test.ts` olarak yazilmasi denendi ve `pnpm verify` onu kosuyor
 *     (`testDosyalari()` kalibi kabul ediyor) AMA ESLint duser: kok
 *     `tsconfig.json` yalnizca `references` tasiyan bir COZUM dosyasidir,
 *     `files: []` oldugu icin `projectService` test dosyasini hicbir projede
 *     bulamaz. `.mjs` bu sorunu tumuyle ortadan kaldirir.
 *
 * Web paketinin baska birim testi yoktur; bu mantik React'ten ayri tutuldugu
 * icin test edilebilir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ilkHataliSekme, sekmeHataSayisi,
} from '../../frontend/web/lib/sekme-hata.ts';

const KISI = ['ad', 'soyad', 'tcKimlikNo', 'plaka'];
const TAPU = ['hissePay', 'hissePayda', 'tapuBaslangic'];

test('sekmeHataSayisi: tam eslesme sayilir', () => {
  assert.equal(sekmeHataSayisi({ ad: 'x', soyad: 'y' }, KISI), 2);
});

test('sekmeHataSayisi: baska sekmenin hatasi sayilmaz', () => {
  assert.equal(sekmeHataSayisi({ hissePay: 'x' }, KISI), 0);
  assert.equal(sekmeHataSayisi({ hissePay: 'x' }, TAPU), 1);
});

/**
 * Dizinli anahtarlar ON EK ile yakalanmali. Tam eslesme aranirsa coklu plaka
 * hatalari hicbir sekmeye sayilmaz ve rozet HIC gorunmez — hatanin gizli
 * kalmasi tam olarak onlemek istedigimiz sey.
 */
test('sekmeHataSayisi: dizinli anahtar on ekle yakalanir', () => {
  assert.equal(sekmeHataSayisi({ 'plaka-0': 'x', 'plaka-3': 'y' }, KISI), 2);
});

/**
 * On ek YANLIS eslesme uretmemeli: 'plakaci' diye bir alan olsaydi 'plaka'
 * on ekine takilmamali. Ayrim `h === a || h.startsWith(a + '-')` ile kurulur;
 * cıplak `startsWith(a)` kullanilsaydi bu test duserdi.
 */
test('sekmeHataSayisi: on ek yalnizca tire ile ayrilmis olani yakalar', () => {
  assert.equal(sekmeHataSayisi({ plakaci: 'x' }, KISI), 0);
  assert.equal(sekmeHataSayisi({ plaka: 'x' }, KISI), 1);
});

test('sekmeHataSayisi: hata yoksa sifir', () => {
  assert.equal(sekmeHataSayisi({}, KISI), 0);
});

test('ilkHataliSekme: hata yoksa null', () => {
  assert.equal(
    ilkHataliSekme([{ anahtar: 'kisi', hataSayisi: 0 }, { anahtar: 'tapu' }]),
    null,
  );
});

// SIRA onemli: listedeki ILK hatali sekme secilir, en cok hatali olan degil.
// Kullanici formu bastan sona doldurur; ilk eksige gondermek okuma yonunu izler.
test('ilkHataliSekme: sirali ilk hatali secilir', () => {
  assert.equal(
    ilkHataliSekme([
      { anahtar: 'kisi', hataSayisi: 1 },
      { anahtar: 'tapu', hataSayisi: 5 },
    ]),
    'kisi',
  );
});

test('ilkHataliSekme: ilk sekme temizse sonraki secilir', () => {
  assert.equal(
    ilkHataliSekme([
      { anahtar: 'kisi', hataSayisi: 0 },
      { anahtar: 'sozlesme', hataSayisi: 2 },
      { anahtar: 'kefil', hataSayisi: 1 },
    ]),
    'sozlesme',
  );
});

// `hataSayisi` verilmemis sekme HATASIZ sayilir; `undefined > 0` yanlis
// olacagi icin sessizce atlanmasi degil, acikca 0 varsayilmasi gerekir.
test('ilkHataliSekme: hataSayisi verilmemis sekme atlanir', () => {
  assert.equal(
    ilkHataliSekme([{ anahtar: 'kisi' }, { anahtar: 'tapu', hataSayisi: 1 }]),
    'tapu',
  );
});
