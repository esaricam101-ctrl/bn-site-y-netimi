/**
 * CT-16 · MÜKERRER TAHAKKUK KORUMASI
 *
 * ⚠️  NEDEN VAR — ÖLÇÜLMÜŞ MALİ VERİ BOZULMASI:
 *     Uzun bir toplu tahakkuk ters vekil tarafından kesildiğinde iş arka planda
 *     SÜRÜYOR. Kullanıcı hata gördüğü için tekrar deniyor. Tekrar denemesi ilk
 *     işlem HENÜZ COMMIT ETMEDEN varıyor ve `borc.count()` ile çalışan uygulama
 *     denetimi commit edilmemiş satırları GÖREMİYOR.
 *
 *     5.000 bölümlük bir sitede ölçülen sonuç: beklenen 5.000 borç satırı
 *     yerine 10.000. Her daire İKİ KEZ borçlandı.
 *
 *     Uygulama katmanındaki bir sayaç bu yarışı önleyemez — okuma ile yazma
 *     arasında pencere vardır. Koruma VERİTABANI KISITI olmak zorundadır
 *     (ADR-0002'nin "kuralı veritabanı zorlar" gerekçesi burada da geçerlidir).
 *
 * CARİ = BAĞIMSIZ BÖLÜM (ADR-0010). Kişi bazlı cari yoktur; malik/kiracı
 * `borc_sorumlusu` snapshot'ında tutulur. Benzersizlik bu yüzden bölüm
 * üzerindedir, kişi üzerinde değil: 3 daireli bir malik dönemde 3 kez
 * borçlanır, bu doğrudur (KMK md. 20).
 *
 * PostgreSQL gerektirir: `pnpm db:up && pnpm db:migrate`
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

/** Tohum verisiyle aynı parola: `bnos1234`. */
const SIFRE_HASH =
  'scrypt$131072$8$1$06dAft8lIJHsbeHFYucc8Q==$9GdovR26bdPFcpXtV96jbzSTjTcywpYL' +
  '/6gx4argmiuioNYMtEfo9FApnPK7FopBCy1xw+IJn78EIwJ+SJ0qiA==';

interface GirisYaniti { readonly accessToken: string }

const TENANT = randomUUID();
const YONETICI_KISI = randomUUID();
const EPOSTA = `ct16-yonetici@${TENANT.slice(0, 8)}.test`;
const BOLUMLER = [randomUUID(), randomUUID(), randomUUID()];
/** İki daireyi de AYNI kişi taşır — cari bölümdür, kişi değildir. */
const MALIK_TEK = randomUUID();
const MALIK_COK = randomUUID();

const DONEM = '2026-05-01';
const VADE = '2026-05-31';

function baglamda<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
    return fn(tx);
  });
}

const borcSayisi = (): Promise<number> =>
  baglamda((tx) => tx.borc.count({ where: { tenantId: TENANT, tahakkukDonemi: new Date(DONEM) } }));

describe('CT-16 · Mükerrer tahakkuk koruması', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  const tahakkukEt = (anahtar: string, ekstra: Record<string, unknown> = {}) =>
    request(sunucu())
      .post('/api/v1/tahakkuk/calistir')
      .set('Authorization', `Bearer ${jeton}`)
      .set('Idempotency-Key', anahtar)
      .send({
        giderTuruKodu: 'CT16_AIDAT', toplamTutar: '3000.00',
        donem: DONEM, vadeTarihi: VADE, ...ekstra,
      });

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct16-${TENANT.slice(0, 8)}`, ad: 'CT-16 Test Sitesi',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      const apartmanId = randomUUID();
      const blokId = randomUUID();
      const katId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: TENANT, ad: 'A Apartmanı' } });
      await tx.blok.create({ data: { id: blokId, tenantId: TENANT, apartmanId, ad: 'A' } });
      await tx.kat.create({ data: { id: katId, tenantId: TENANT, blokId, no: 1 } });

      for (const [i, id] of BOLUMLER.entries()) {
        await tx.bagimsizBolum.create({
          data: {
            id, tenantId: TENANT, blokId, katId, kapiNo: String(i + 1), kat: 1,
            nitelik: 'MESKEN', brutM2: 100, netM2: 85,
            arsaPayiPay: 333_333n, arsaPayiPayda: 1_000_000n,
          },
        });
      }

      await tx.kisi.createMany({
        data: [
          { id: YONETICI_KISI, tenantId: TENANT, ad: 'Yon', soyad: 'Etici', eposta: EPOSTA },
          { id: MALIK_TEK, tenantId: TENANT, ad: 'TekDaireli', soyad: 'Malik' },
          { id: MALIK_COK, tenantId: TENANT, ad: 'IkiDaireli', soyad: 'Malik' },
        ],
      });

      // 1. daire tek daireli malikte; 2. ve 3. daire AYNI kişide.
      const sahiplik: readonly (readonly [string, string])[] = [
        [BOLUMLER[0] as string, MALIK_TEK],
        [BOLUMLER[1] as string, MALIK_COK],
        [BOLUMLER[2] as string, MALIK_COK],
      ];
      for (const [bolumId, kisiId] of sahiplik) {
        await tx.malik.create({
          data: {
            id: randomUUID(), tenantId: TENANT, bolumId, kisiId,
            hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
            tapuBaslangic: new Date('2024-01-01'),
          },
        });
      }

      await tx.giderTuru.create({
        data: {
          id: randomUUID(), tenantId: TENANT, kod: 'CT16_AIDAT', ad: 'CT-16 Aidat',
          paylasimKurali: 'ESIT', sorumlulukTipi: 'MALIKE_AIT',
          kuralKaynagi: 'KMK_VARSAYILAN', aktifMi: true,
        },
      });

      const kullaniciId = randomUUID();
      await tx.kullanici.create({
        data: {
          id: kullaniciId, tenantId: TENANT, kisiId: YONETICI_KISI, eposta: EPOSTA,
          sifreHash: SIFRE_HASH, aktif: true,
          roller: { create: { id: randomUUID(), tenantId: TENANT, rolKodu: 'APARTMAN_YONETICISI' } },
        },
      });
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const y = await request(sunucu())
      .post('/api/v1/oturum/giris')
      .send({ eposta: EPOSTA, sifre: 'bnos1234' });
    if (y.status >= 300) throw new Error(`Giriş başarısız: ${y.status} ${JSON.stringify(y.body)}`);
    jeton = (y.body as GirisYaniti).accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('(1) ilk tahakkuk her bölüme BİR borç satırı yazar', async () => {
    const y = await tahakkukEt(randomUUID());
    expect(y.status).toBe(201);
    expect(await borcSayisi()).toBe(BOLUMLER.length);
  });

  it('(2) aynı proje + dönem + gider türü için ikinci tahakkuk REDDEDİLİR', async () => {
    const y = await tahakkukEt(randomUUID());
    expect(y.status).toBe(409);
    expect(await borcSayisi()).toBe(BOLUMLER.length);
  });

  it('(3) ★ İLK İŞLEM COMMIT ETMEMİŞKEN gelen ikinci istek REDDEDİLİR', async () => {
    /*
     * ASIL SENARYO BUDUR. Uygulama katmanındaki `borc.count()` denetimi
     * commit edilmemiş satırları göremediği için bugün İKİSİ DE geçiyor.
     *
     * Yarış, veritabanı işlemi açık tutularak birebir üretilir: ilk işlem
     * çalışma kaydını yazar ama COMMIT ETMEZ; bu sırada HTTP üzerinden ikinci
     * tahakkuk gelir. Doğru davranış, ikinci isteğin BLOKLANIP ilk işlem
     * commit ettikten sonra benzersizlik ihlaliyle düşmesidir.
     */
    const DONEM2 = '2026-06-01';
    const sayac = () => baglamda((tx) =>
      tx.borc.count({ where: { tenantId: TENANT, tahakkukDonemi: new Date(DONEM2) } }));

    let acikIslemiBitir: (() => void) | undefined;
    const acikIslem = prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '', true)`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '', true)`);
      await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
      // Devam eden bir tahakkukun ilk yazdığı kayıt: çalışma satırı.
      await tx.$executeRawUnsafe(`
        INSERT INTO tahakkuk_calismasi
          (id, tenant_id, gider_turu_kodu, donem, tip, sira, toplam_tutar,
           bolum_sayisi, olusturulma_tarihi)
        VALUES ('${randomUUID()}', '${TENANT}', 'CT16_AIDAT', DATE '${DONEM2}',
                'ASIL', 1, 3000, 3, now())`);
      await new Promise<void>((c) => { acikIslemiBitir = c; });
    }, { timeout: 60_000 });

    // İşlem açılana kadar bekle.
    for (let i = 0; i < 100 && !acikIslemiBitir; i += 1) {
      await new Promise((c) => setTimeout(c, 50));
    }

    const ikinci = tahakkukEt(randomUUID(), { donem: DONEM2, vadeTarihi: '2026-06-30' });
    await new Promise((c) => setTimeout(c, 1500));   // ikinci istek kısıt üzerinde bloklanır
    acikIslemiBitir?.();                              // ilk işlem COMMIT eder
    await acikIslem;

    const y = await ikinci;
    expect(y.status).toBe(409);
    expect(await sayac()).toBe(0);   // ikinci istek HİÇ satır yazmamalı
  }, 90_000);

  it('(4) aynı Idempotency-Key ile ikinci istek İLKİN SONUCUNU döner, yeni kayıt üretmez', async () => {
    const DONEM3 = '2026-07-01';
    const anahtar = randomUUID();
    const ilk = await tahakkukEt(anahtar, { donem: DONEM3, vadeTarihi: '2026-07-31' });
    expect(ilk.status).toBe(201);

    const tekrar = await tahakkukEt(anahtar, { donem: DONEM3, vadeTarihi: '2026-07-31' });
    expect(tekrar.status).toBe(201);
    expect(tekrar.body).toEqual(ilk.body);

    const sayi = await baglamda((tx) =>
      tx.borc.count({ where: { tenantId: TENANT, tahakkukDonemi: new Date(DONEM3) } }));
    expect(sayi).toBe(BOLUMLER.length);
  }, 60_000);

  it('(5) EK TAHAKKUK açıkça istendiğinde yeni bir çalışma olarak geçer', async () => {
    const y = await tahakkukEt(randomUUID(), { ekTahakkuk: true });
    expect(y.status).toBe(201);
    // Asıl 3 + ek 3
    expect(await borcSayisi()).toBe(BOLUMLER.length * 2);
  }, 60_000);

  it('(6) cari BÖLÜMDÜR: iki daireli malik dönemde İKİ kez borçlanır', async () => {
    const satirlar = await baglamda((tx) => tx.borcSorumlusu.findMany({
      where: { tenantId: TENANT, kisiId: MALIK_COK, borc: { tahakkukDonemi: new Date(DONEM) } },
      select: { borcId: true },
    }));
    // Asıl + ek tahakkuk, iki daire => 4 sorumluluk satırı
    expect(satirlar.length).toBe(4);
  });
});
