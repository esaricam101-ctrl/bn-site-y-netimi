/**
 * Istek siniri guard'i — kaba kuvvet ve bellek tuketimi korumasi.
 *
 * NEDEN ONEMLI: giris ucu HER denemede scrypt calistirir (kullanici
 * bulunamasa bile, zamanlama sizintisini onlemek icin) ve her calisma
 * ~134 MB ayirir. Sinir olmadan tek istemci sureci dusurebilir.
 *
 * Test derlenmis backend ciktisini okur (bkz. prisma-hata-cevirisi testi).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const MODUL = new URL(
  '../../backend/dist/common/guards/istek-siniri.guard.js',
  import.meta.url,
);
const require = createRequire(MODUL);
const { IstekSiniriGuard } = require(MODUL.pathname.slice(1));

/**
 * Sahte Redis — `eval` cagrilarini SAYAC gibi davranarak yanitlar.
 *
 * Gercek betigi calistirmaz; sayimi bellekte tutar. Amac guard'in KARAR
 * mantigini sinamaktir, Redis'i degil.
 */
function sahteRedis({ patlasin = false } = {}) {
  const sayimlar = new Map();
  return {
    sayimlar,
    cagrilar: [],
    on() {},
    quit: () => Promise.resolve(),
    eval(betik, _n, anahtar, pencere) {
      this.cagrilar.push({ anahtar, pencere });
      if (patlasin) return Promise.reject(new Error('Redis kapali'));
      // TTL betigi 'TTL' icerir; sayac betigi 'INCR'.
      if (betik.includes('TTL')) return Promise.resolve(42);
      const yeni = (sayimlar.get(anahtar) ?? 0) + 1;
      sayimlar.set(anahtar, yeni);
      return Promise.resolve(yeni);
    },
  };
}

/** Guard'i sahte Redis ve sahte Reflector ile kurar. */
function guardKur(tanim, secenek) {
  const reflector = { getAllAndOverride: () => tanim };
  const g = new IstekSiniriGuard(reflector);
  const redis = sahteRedis(secenek ?? {});
  // Yapicidaki gercek baglanti yerine sahtesi konur.
  Object.defineProperty(g, 'redis', { value: redis, writable: true });
  return { g, redis };
}

const basliklar = [];
function baglam(istek) {
  return {
    getHandler: () => function h() {},
    getClass: () => class C {},
    switchToHttp: () => ({
      getRequest: () => istek,
      getResponse: () => ({ setHeader: (a, b) => basliklar.push([a, b]) }),
    }),
  };
}

const ISTEK = { ip: '1.2.3.4', method: 'POST', body: { eposta: 'a@b.test' } };
const GIRIS_TANIMI = {
  ipLimiti: 3, kimlikLimiti: 2, pencereSn: 300, kimlikAlani: 'eposta',
};

/* ------------------------------ Temel akis ------------------------------- */

test('isaretsiz uc SINIRLANMAZ', async () => {
  // Genel bir sinir, toplu tahakkuk gibi mesru yogun isleri sessizce keserdi.
  const { g, redis } = guardKur(undefined);
  assert.equal(await g.canActivate(baglam(ISTEK)), true);
  assert.equal(redis.cagrilar.length, 0, 'sayac hic okunmamali');
});

test('limit altindaki istek gecer', async () => {
  const { g } = guardKur(GIRIS_TANIMI);
  assert.equal(await g.canActivate(baglam(ISTEK)), true);
});

test('ISIN OZU: kimlik limiti asilinca 429 atilir', async () => {
  const { g } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam(ISTEK)); // 1
  await g.canActivate(baglam(ISTEK)); // 2 — kimlik limiti
  await assert.rejects(
    () => g.canActivate(baglam(ISTEK)),
    (h) => h.getStatus() === 429,
  );
});

test('429 yaniti hangi sayacin doldugunu SOYLEMEZ', async () => {
  // Soyleseydi "bu e-posta icin sinir doldu" e-postanin kayitli oldugunu
  // dogrulardi — giris ucunun kullanici numaralandirmayi engelleme cabasini
  // bosa cikarirdi.
  const { g } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam(ISTEK));
  await g.canActivate(baglam(ISTEK));
  try {
    await g.canActivate(baglam(ISTEK));
    assert.fail('429 bekleniyordu');
  } catch (h) {
    const govde = h.getResponse();
    assert.doesNotMatch(govde.mesaj, /e-posta|eposta|ip|IP/u);
    assert.match(govde.sonrakiEylem, /saniye/u);
  }
});

test('Retry-After basligi yazilir', async () => {
  basliklar.length = 0;
  const { g } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam(ISTEK));
  await g.canActivate(baglam(ISTEK));
  try { await g.canActivate(baglam(ISTEK)); } catch { /* beklenen */ }
  const r = basliklar.find(([a]) => a === 'Retry-After');
  assert.notEqual(r, undefined, 'Retry-After yazilmali');
  assert.equal(r[1], '42');
});

/* --------------------------- Iki ayri sayac ------------------------------ */

test('ISIN OZU: IP ve KIMLIK icin AYRI anahtarlar sayilir', async () => {
  const { g, redis } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam(ISTEK));
  const anahtarlar = redis.cagrilar.map((c) => c.anahtar);
  assert.equal(anahtarlar.length, 2);
  assert.equal(anahtarlar.filter((a) => a.includes(':ip:')).length, 1);
  assert.equal(anahtarlar.filter((a) => a.includes(':kimlik:')).length, 1);
});

test('farkli e-posta AYRI sayilir — ama ayni IP ortak sayacta birikir', async () => {
  // Yalnizca e-posta sayilsaydi saldirgan her denemede baska e-posta yazip
  // siniri hic gormezdi. IP sayaci tam bunun icin var.
  const { g } = guardKur(GIRIS_TANIMI);
  for (const e of ['a@b.test', 'c@d.test', 'e@f.test']) {
    await g.canActivate(baglam({ ...ISTEK, body: { eposta: e } }));
  }
  // Dorduncu farkli e-posta: kimlik sayaci 1, ama IP sayaci 4 > 3.
  await assert.rejects(
    () => g.canActivate(baglam({ ...ISTEK, body: { eposta: 'g@h.test' } })),
    (h) => h.getStatus() === 429,
  );
});

test('farkli IP birbirini ETKILEMEZ', async () => {
  const { g } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam({ ...ISTEK, ip: '1.1.1.1' }));
  await g.canActivate(baglam({ ...ISTEK, ip: '1.1.1.1' }));
  // Ayni e-posta ama baska IP — kimlik sayaci ortak oldugu icin 3. deneme
  // yine reddedilir. Bu DOGRUDUR: hedefli deneme IP degistirerek asilmamali.
  await assert.rejects(
    () => g.canActivate(baglam({ ...ISTEK, ip: '9.9.9.9' })),
    (h) => h.getStatus() === 429,
  );
});

/* ---------------------------- Gizlilik / KVKK ---------------------------- */

test('ham e-posta anahtara YAZILMAZ — ozetlenir', async () => {
  const { g, redis } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam(ISTEK));
  const kimlik = redis.cagrilar.find((c) => c.anahtar.includes(':kimlik:'));
  assert.doesNotMatch(kimlik.anahtar, /a@b\.test/u, 'sayac kisisel veri deposu degildir');
  assert.match(kimlik.anahtar, /:kimlik:[0-9a-f]{32}$/u);
});

test('kimlik alani yoksa yalnizca IP sayilir', async () => {
  const { g, redis } = guardKur({ ipLimiti: 5, kimlikLimiti: 5, pencereSn: 60 });
  await g.canActivate(baglam(ISTEK));
  assert.equal(redis.cagrilar.length, 1);
  assert.match(redis.cagrilar[0].anahtar, /:ip:/u);
});

test('govdede alan bos ya da metin degilse kimlik sayilmaz', async () => {
  const { g, redis } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam({ ...ISTEK, body: { eposta: '' } }));
  assert.equal(redis.cagrilar.length, 1, 'yalnizca IP');
  const { g: g2, redis: r2 } = guardKur(GIRIS_TANIMI);
  await g2.canActivate(baglam({ ...ISTEK, body: {} }));
  assert.equal(r2.cagrilar.length, 1);
});

/* ------------------------- Redis dustugunde ------------------------------ */

test('ISIN OZU: Redis dustugunde istek GECER (fail-open)', async () => {
  // Fail-closed secilseydi bir Redis kesintisi, hicbir kullanicinin giris
  // yapamadigi TAM BIR KIMLIK KESINTISINE donusurdu.
  const { g } = guardKur(GIRIS_TANIMI, { patlasin: true });
  assert.equal(await g.canActivate(baglam(ISTEK)), true);
});

test('Redis dustugunde SESSIZ KALINMAZ — hata loglanir', async () => {
  const { g } = guardKur(GIRIS_TANIMI, { patlasin: true });
  const kayitlar = [];
  Object.defineProperty(g, 'logger', {
    value: { error: (m) => kayitlar.push(m), warn: () => {} },
    writable: true,
  });
  await g.canActivate(baglam(ISTEK));
  assert.equal(kayitlar.length > 0, true, 'ERROR seviyesinde loglanmali');
  assert.match(kayitlar[0], /SINIRSIZ/u, 'gecen istegin sinirsiz oldugu yazilmali');
});

/* ------------------------------ Pencere ---------------------------------- */

test('pencere suresi sayac betigine gecirilir', async () => {
  const { g, redis } = guardKur(GIRIS_TANIMI);
  await g.canActivate(baglam(ISTEK));
  assert.equal(redis.cagrilar[0].pencere, '300');
});
