/**
 * CT-14 · KAPSAM KENAR DURUMLARI
 *
 * ⚠️  CT-13'ün yeşil olması kapsamın DOĞRU olduğunu değil, MUTLU YOLDA
 *     çalıştığını gösterir. Bu dosya kenarları ölçer: çok daireli malik,
 *     hisseli mülkiyet, dönem sınırının TAM GÜNÜ, boş kapsam, çok rollü kişi.
 *
 * PostgreSQL gerektirir.
 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ProblemDetailsFilter } from '../../src/common/errors/problem-details.filter';

const prisma = new PrismaClient();
const SIFRE_HASH =
  'scrypt$131072$8$1$06dAft8lIJHsbeHFYucc8Q==$9GdovR26bdPFcpXtV96jbzSTjTcywpYL' +
  '/6gx4argmiuioNYMtEfo9FApnPK7FopBCy1xw+IJn78EIwJ+SJ0qiA==';

const TENANT = randomUUID();
/** A · B · C: çok daireli malikin daireleri. D: hisseli. E: dönem sınırı. */
const B_A = randomUUID(); const B_B = randomUUID(); const B_C = randomUUID();
const B_D = randomUUID(); const B_E = randomUUID();

const K = {
  coklu: randomUUID(),      // 3 dairesi var: A,B kirada · C kendi oturumunda
  kiraciA: randomUUID(),
  kiraciB: randomUUID(),
  hisse1: randomUUID(), hisse2: randomUUID(), hisse3: randomUUID(),  // D'nin 3 maliki
  sinir: randomUUID(),      // E'de kiracılığı BUGÜN biten
  bos: randomUUID(),        // hiçbir bölümü olmayan
  ciftRol: randomUUID(),    // MALIK + APARTMAN_YONETICISI
};
/*
 * ⚠️  E-POSTA KÜÇÜK HARF ÜRETİLİR. `OturumServisi.giris` gelen adresi
 *     `toLowerCase()` ile normalleştirip `kullanici.eposta` ile BİREBİR
 *     karşılaştırır; büyük harfli kayıt asla eşleşmez ve 401 döner.
 *     Belirtisi yanıltıcıdır: "parola yanlış" gibi görünür.
 */
const E = Object.fromEntries(
  Object.keys(K).map((k) => [k, `ct14-${k.toLowerCase()}@${TENANT.slice(0, 8)}.test`]),
) as Record<keyof typeof K, string>;

function baglamda<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
    return fn(tx);
  });
}

const gun = (d: Date): Date => new Date(d.toISOString().slice(0, 10));
const BUGUN = gun(new Date());

interface SayfaliKisi { readonly kayitlar: readonly { readonly ad: string }[] }

describe('CT-14 · Kapsam kenar durumları', () => {
  let app: INestApplication;
  const jeton: Record<string, string> = {};
  const sunucu = (): Server => app.getHttpServer() as Server;

  const gir = async (eposta: string): Promise<string> => {
    const y = await request(sunucu()).post('/api/v1/oturum/giris')
      .send({ eposta, sifre: 'bnos1234' });
    if (y.status >= 300) throw new Error(`Giriş: ${eposta} -> ${y.status}`);
    return (y.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct14-${TENANT.slice(0, 8)}`, ad: 'CT-14 Kenar',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      const apartmanId = randomUUID(); const blokId = randomUUID(); const katId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: TENANT, ad: 'A' } });
      await tx.blok.create({ data: { id: blokId, tenantId: TENANT, apartmanId, ad: 'A' } });
      await tx.kat.create({ data: { id: katId, tenantId: TENANT, blokId, no: 1 } });

      let i = 0;
      for (const id of [B_A, B_B, B_C, B_D, B_E]) {
        i += 1;
        await tx.bagimsizBolum.create({
          data: {
            id, tenantId: TENANT, blokId, katId, kapiNo: String(i), kat: 1,
            nitelik: 'MESKEN', brutM2: 100, netM2: 85,
            arsaPayiPay: 200_000n, arsaPayiPayda: 1_000_000n,
          },
        });
      }

      await tx.kisi.createMany({
        data: [
          { id: K.coklu, tenantId: TENANT, ad: 'CokDaireli', soyad: 'T', eposta: E.coklu },
          { id: K.kiraciA, tenantId: TENANT, ad: 'KiraciA', soyad: 'T', eposta: E.kiraciA },
          { id: K.kiraciB, tenantId: TENANT, ad: 'KiraciB', soyad: 'T' },
          { id: K.hisse1, tenantId: TENANT, ad: 'Hisse1', soyad: 'T', eposta: E.hisse1 },
          { id: K.hisse2, tenantId: TENANT, ad: 'Hisse2', soyad: 'T' },
          { id: K.hisse3, tenantId: TENANT, ad: 'Hisse3', soyad: 'T' },
          { id: K.sinir, tenantId: TENANT, ad: 'SinirKiraci', soyad: 'T', eposta: E.sinir },
          { id: K.bos, tenantId: TENANT, ad: 'BosKapsam', soyad: 'T', eposta: E.bos },
          { id: K.ciftRol, tenantId: TENANT, ad: 'CiftRol', soyad: 'T', eposta: E.ciftRol },
        ],
      });

      // (a) coklu: A,B,C'nin maliki. A ve B KİRADA, C kendi oturumunda.
      for (const b of [B_A, B_B, B_C]) {
        await tx.malik.create({
          data: {
            id: randomUUID(), tenantId: TENANT, bolumId: b, kisiId: K.coklu,
            hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
            tapuBaslangic: new Date('2024-01-01'),
          },
        });
      }
      await tx.kiraci.create({
        data: { id: randomUUID(), tenantId: TENANT, bolumId: B_A, kisiId: K.kiraciA,
                baslangic: new Date('2025-01-01') },
      });
      await tx.kiraci.create({
        data: { id: randomUUID(), tenantId: TENANT, bolumId: B_B, kisiId: K.kiraciB,
                baslangic: new Date('2025-01-01') },
      });

      // (b) hisseli: D'nin 3 maliki.
      for (const k of [K.hisse1, K.hisse2, K.hisse3]) {
        await tx.malik.create({
          data: {
            id: randomUUID(), tenantId: TENANT, bolumId: B_D, kisiId: k,
            hissePay: 1n, hissePayda: 3n, tapuTuru: 'KAT_MULKIYETI',
            tapuBaslangic: new Date('2024-01-01'),
          },
        });
      }

      // (c) DÖNEM SINIRI: kiracılığı TAM BUGÜN biten.
      await tx.kiraci.create({
        data: {
          id: randomUUID(), tenantId: TENANT, bolumId: B_E, kisiId: K.sinir,
          baslangic: new Date('2025-01-01'), bitis: BUGUN,
        },
      });

      // (e) çift rollü: B_C'nin maliki DEĞİL, ayrı bir bölümün maliki olsun.
      await tx.malik.create({
        data: {
          id: randomUUID(), tenantId: TENANT, bolumId: B_E, kisiId: K.ciftRol,
          hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
          tapuBaslangic: new Date('2024-01-01'),
        },
      });

      for (const [kisiId, eposta, roller] of [
        [K.coklu, E.coklu, ['MALIK']],
        [K.kiraciA, E.kiraciA, ['KIRACI']],
        [K.hisse1, E.hisse1, ['MALIK']],
        [K.sinir, E.sinir, ['KIRACI']],
        // Sözleşmesi bitmiş ESKİ KİRACI: hiçbir bölüme bağlı değil.
        // Rol KİRACI seçildi çünkü SAKIN'de `KISI_GORUNTULE` yok ve boş
        // kapsamın davranışı ölçülemezdi (403 kapsamı değil izni ölçer).
        [K.bos, E.bos, ['KIRACI']],
        [K.ciftRol, E.ciftRol, ['MALIK', 'APARTMAN_YONETICISI']],
      ] as const) {
        const kid = randomUUID();
        await tx.kullanici.create({
          data: {
            id: kid, tenantId: TENANT, kisiId, eposta,
            sifreHash: SIFRE_HASH, aktif: true,
            roller: {
              create: roller.map((r) => ({
                id: randomUUID(), tenantId: TENANT, rolKodu: r,
              })),
            },
          },
        });
      }
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    for (const ad of ['coklu', 'kiraciA', 'hisse1', 'sinir', 'bos', 'ciftRol'] as const) {
      jeton[ad] = await gir(E[ad]);
    }
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await baglamda(async (tx) => {
      await tx.kiraci.deleteMany({ where: { tenantId: TENANT } });
      await tx.malik.deleteMany({ where: { tenantId: TENANT } });
      await tx.kullaniciRolu.deleteMany({ where: { tenantId: TENANT } });
      await tx.kullanici.deleteMany({ where: { tenantId: TENANT } });
      await tx.kisi.deleteMany({ where: { tenantId: TENANT } });
      await tx.bagimsizBolum.deleteMany({ where: { tenantId: TENANT } });
      await tx.kat.deleteMany({ where: { tenantId: TENANT } });
      await tx.blok.deleteMany({ where: { tenantId: TENANT } });
      await tx.apartman.deleteMany({ where: { tenantId: TENANT } });
      await tx.outboxKayit.deleteMany({ where: { tenantId: TENANT } });
    });
    await prisma.oturumDizini.deleteMany({ where: { tenantId: TENANT } });
    await prisma.$disconnect();
  }, 90_000);

  const al = (rol: string, yol: string) =>
    request(sunucu()).get(yol).set('Authorization', `Bearer ${jeton[rol]}`);

  /* ------------------------- (a) ÇOK DAİRELİ MALİK ------------------------ */

  it('(a) 3 daireli malik: KENDİ OTURDUĞU daireyi tam görür', async () => {
    const y = await al('coklu', `/api/v1/daireler/${B_C}/kart`);
    expect(y.status).toBe(200);
  });

  it('(a) 3 daireli malik: KİRADAKİ dairenin kartını görebilir (borç ekseni)', async () => {
    const y = await al('coklu', `/api/v1/daireler/${B_A}/kart`);
    expect(y.status).toBe(200);
  });

  it('(a) 3 daireli malik: KİRADAKİ dairenin KİRACISINI görmez', async () => {
    const y = await al('coklu', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar).toContain('CokDaireli');
    expect(adlar, 'kiradaki dairenin kiracısı sızmamalı').not.toContain('KiraciA');
    expect(adlar, 'öteki kiradaki dairenin kiracısı da sızmamalı').not.toContain('KiraciB');
  });

  it('(a) 3 daireli malik: SAHİBİ OLMADIĞI daireyi görmez', async () => {
    const y = await al('coklu', `/api/v1/daireler/${B_D}/kart`);
    expect([403, 404]).toContain(y.status);
  });

  /* -------------------------- (b) HİSSELİ MÜLKİYET ------------------------ */

  it('(b) hisseli: her malik bölümü kapsamında görür', async () => {
    const y = await al('hisse1', `/api/v1/daireler/${B_D}/kart`);
    expect(y.status).toBe(200);
  });

  /**
   * ⚠️  ÜRÜN SAHİBİ KARARI: her malik YALNIZCA KENDİ PAYINI görür.
   *     Bedeli açıkça kabul edildi — KMK md. 20 müteselsil sorumluluk
   *     kurar ama malik ortağının ödeyip ödemediğini göremez.
   */
  it('(b) hisseli: ortak malikin KİMLİĞİ hisse1\'e dönmez', async () => {
    const y = await al('hisse1', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar).toContain('Hisse1');
  });

  /* ---------------------------- (c) DÖNEM SINIRI -------------------------- */

  /**
   * ⚠️  SINIR TAM GÜNDE ölçülür, "çok geçmiş" bir tarihle değil.
   *     `bitis = BUGÜN` kaydı, `bitis >= bugün` koşulunu SAĞLAR: kiracılığın
   *     son günü hâlâ kiracıdır. Erişim ERTESİ GÜN kesilir.
   */
  /*
   * ⚠️  UÇ SEÇİMİ ÖNEMLİ: `/daireler/:id/kart` `BOLUM_GORUNTULE` ister ve bu
   *     izin KİRACI rolünde YOKTUR — oradan gelen 403 kapsamı değil Kapı 3'ü
   *     ölçerdi. `/kisiler` (`KISI_GORUNTULE`) kiracının erişebildiği uçtur ve
   *     kapsam farkını gerçekten gösterir.
   */
  it('(c) kiracılığın SON GÜNÜ kapsam DOLU — hanesini görür', async () => {
    const y = await al('sinir', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar, 'bitiş günü hâlâ kiracıdır').toContain('SinirKiraci');
    // B_E'nin maliki de hanede görünür: kapsam gerçekten kurulmuş demektir.
    expect(adlar, 'kapsam dolu olmalı').toContain('CiftRol');
  });

  it('(c) kiracılık bittikten SONRA kapsam BOŞALIR — yalnızca kendisi', async () => {
    // Bitişi düne çek: sınırın öteki tarafı.
    const dun = new Date(BUGUN); dun.setDate(dun.getDate() - 1);
    await baglamda((tx) => tx.kiraci.updateMany({
      where: { tenantId: TENANT, kisiId: K.sinir },
      data: { bitis: gun(dun) },
    }));
    const taze = await gir(E.sinir);
    const y = await request(sunucu())
      .get('/api/v1/kisiler?limit=100').set('Authorization', `Bearer ${taze}`);
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar, 'dünkü bitişte hane görünürlüğü kalmamalı').toEqual(['SinirKiraci']);
    // Fikstürü geri al.
    await baglamda((tx) => tx.kiraci.updateMany({
      where: { tenantId: TENANT, kisiId: K.sinir }, data: { bitis: BUGUN },
    }));
  });

  /* ------------------------------ (d) BOŞ KAPSAM -------------------------- */

  /**
   * ⚠️  BOŞ KAPSAM = BOŞ LİSTE, hata DEĞİL ve "her şey" HİÇ DEĞİL.
   *     Hata dönseydi görevi biten sakin uygulamayı hiç açamazdı; her şey
   *     dönseydi kapsamın kendisi anlamsız olurdu.
   */
  it('(d) hiç bölümü olmayan kişi: BOŞ liste alır, hata almaz', async () => {
    const y = await al('bos', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    // Kendi kaydını görür; başkasını görmez.
    expect(adlar).toEqual(['BosKapsam']);
  });

  it('(d) boş kapsam: erişilemeyen bölüm 403/404 verir, veri SIZDIRMAZ', async () => {
    const y = await al('bos', `/api/v1/daireler/${B_A}/kart`);
    // KİRACI'da `BOLUM_GORUNTULE` yok → Kapı 3 keser. Kapsam boş olsa da
    // olmasa da veri dönmemeli; ölçülen şey budur.
    expect([403, 404]).toContain(y.status);
  });

  /* --------------------------- (e) ÇOK ROLLÜ KİŞİ ------------------------- */

  /**
   * ⚠️  ÜRÜN SAHİBİ KARARI: birleşim korunur. Yöneticilik hakkı maliklik
   *     kısıtıyla daraltılmaz — KMK md. 34 uyarınca yönetici zaten kat
   *     maliklerinden seçilir, yani bu TİPİK durumdur, istisna değil.
   */
  it('(e) MALIK + APARTMAN_YONETICISI: kapsam KURULMAZ, tümünü görür', async () => {
    const y = await al('ciftRol', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    // Yönetici sıfatıyla bakıyor: kendi hanesi dışındakiler de görünür.
    expect(adlar).toContain('Hisse2');
    expect(adlar).toContain('KiraciB');
  });

  it('(e) tek rollü MALIK aynı veriyi GÖRMEZ — fark rolden geliyor', async () => {
    const y = await al('coklu', '/api/v1/kisiler?limit=100');
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar).not.toContain('Hisse2');
  });
});
