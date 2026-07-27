#!/usr/bin/env node
/**
 * Guvenlik duman testi — sifre ozetleme ve tohum kimlik bilgisi.
 *
 * sifre.ts framework bagimsiz saf bir modul oldugu icin NestJS kurulumu
 * olmadan dogrudan test edilebilir (BFS v1 §1.3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const S = await import('../.derleme/security/sifre.js');

test('sifre: ozet dogru bicimde uretilir', async () => {
  const ozet = await S.sifreOzetle('deneme-parola-123');
  const parcalar = ozet.split('$');
  assert.equal(parcalar.length, 6);
  assert.equal(parcalar[0], 'scrypt');
  assert.equal(Number(parcalar[1]), S.SCRYPT_PARAMETRELERI.N);
});

test('sifre: ayni parola HER SEFERINDE farkli ozet uretir (tuz)', async () => {
  const a = await S.sifreOzetle('ayni-parola');
  const b = await S.sifreOzetle('ayni-parola');
  assert.notEqual(a, b, 'tuz kullanilmiyorsa gokkusagi tablosu saldirisina acik');
  assert.ok(await S.sifreDogrula('ayni-parola', a));
  assert.ok(await S.sifreDogrula('ayni-parola', b));
});

test('sifre: dogru parola dogrulanir, yanlis parola reddedilir', async () => {
  const ozet = await S.sifreOzetle('DogruParola!42');
  assert.equal(await S.sifreDogrula('DogruParola!42', ozet), true);
  assert.equal(await S.sifreDogrula('DogruParola!43', ozet), false);
  assert.equal(await S.sifreDogrula('', ozet), false);
});

test('sifre: unicode normalizasyonu tutarli', async () => {
  // 'é' iki farkli sekilde kodlanabilir; NFKC ikisini de ayni yapar.
  const bilesik = 'par\u00E9la';        // é tek kod noktasi
  const ayrisik = 'pare\u0301la';        // e + birlesik aksan
  const ozet = await S.sifreOzetle(bilesik);
  assert.equal(await S.sifreDogrula(ayrisik, ozet), true,
    'normalizasyon yoksa kullanici klavyesine gore girisi basarisiz olur');
});

test('sifre: bozuk ozet bicimi FIRLATMAZ, false doner', async () => {
  for (const bozuk of ['', 'duz-metin', 'bcrypt$10$abc', 'scrypt$a$b$c$d$e', 'scrypt$1$1$1$$']) {
    assert.equal(await S.sifreDogrula('x', bozuk), false, `bozuk: '${bozuk}'`);
  }
});

test('sifre: eski maliyet parametresi yukseltme gerektirir', () => {
  assert.equal(S.yukseltmeGerekliMi('scrypt$16384$8$1$dGVzdA==$dGVzdA=='), true);
  assert.equal(S.yukseltmeGerekliMi('$2b$10$eskibcryptozeti'), true);
  assert.equal(
    S.yukseltmeGerekliMi(`scrypt$${S.SCRYPT_PARAMETRELERI.N}$8$1$dGVzdA==$dGVzdA==`),
    false,
  );
});

test('tohum: gelistirme kimlik bilgisi GERCEKTEN calisir', async () => {
  const seed = readFileSync(new URL('../../database/seeds/seed.ts', import.meta.url), 'utf8');
  const eslesme = seed.match(/'(scrypt\$[^']+)'/);
  assert.ok(eslesme, 'seed.ts icinde scrypt ozeti bulunamadi');

  const ozet = eslesme[1];
  assert.equal(await S.sifreDogrula('bnos1234', ozet), true,
    "README'de belirtilen gelistirme sifresi tohum ozetiyle eslesmiyor");
  assert.equal(await S.sifreDogrula('bnos12345', ozet), false);
});
