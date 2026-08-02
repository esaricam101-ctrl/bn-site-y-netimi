/**
 * CT-17 · TAHAKKUK UYARILARI — engelleme değil, görünürlük
 *
 * ⚠️  NEDEN VAR: merkezi ısıtmada iki dağıtım modeli vardır ve ikisi AYNI
 *     PROJEDE kullanılmamalıdır:
 *       · pay ölçerli site  → ISITMA (dönemsel, tüketim payına göre)
 *       · pay ölçersiz site → YAKIT  (olay bazlı, her dolum ayrı gider)
 *
 *     İkisi aynı dönemde tahakkuk edilirse ısınma gideri sakinlere İKİ KEZ
 *     yansır. Mükerrer tahakkukla aynı sınıf mali hatadır — ama farklı bir
 *     kapıdan girer ve bugün hiçbir koruma yoktur. Yönetici fark etmez;
 *     sakin aylar sonra fark eder.
 *
 * ⚠️  NEDEN ENGELLEME DEĞİL: geçiş dönemi meşrudur (yıl ortasında pay ölçer
 *     takılabilir), kısmi pay ölçerli siteler vardır ve bu aslında bir
 *     TAHAKKUK ANI kuralı değil PROJE YAPILANDIRMASI kuralıdır. Kalıcı
 *     çözüm ısınma modeli ayarıdır (ADR-0014). O gelene kadar uyarı,
 *     riski görünür kılar.
 *
 * ⚠️  GİDER TÜRÜ KODU KODA GÖMÜLÜ DEĞİLDİR. Çakışma tanımı VERİDİR:
 *     karşılıklı dışlayan türler `gider_turu_grubu` altında toplanır; motor
 *     yalnızca "aynı gruptan farklı bir tür bu dönemde tahakkuk edilmiş mi"
 *     sorusunu sorar. Üçüncü bir üye eklemek tek satırdır.
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
interface Uyari { readonly kod: string; readonly mesaj: string; readonly siddet: string }
interface TahakkukYaniti { readonly uyarilar: readonly Uyari[] }

const TENANT = randomUUID();
const YONETICI_KISI = randomUUID();
const EPOSTA = `ct17-yonetici@${TENANT.slice(0, 8)}.test`;
const BOLUMLER = [randomUUID(), randomUUID()];
const MALIK = randomUUID();

function baglamda<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
    return fn(tx);
  });
}

describe('CT-17 · Tahakkuk uyarıları', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  const tahakkukEt = (kod: string, donem: string, ekstra: Record<string, unknown> = {}) =>
    request(sunucu())
      .post('/api/v1/tahakkuk/calistir')
      .set('Authorization', `Bearer ${jeton}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        giderTuruKodu: kod, toplamTutar: '2000.00',
        donem, vadeTarihi: `${donem.slice(0, 8)}28`, ...ekstra,
      });

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct17-${TENANT.slice(0, 8)}`, ad: 'CT-17 Test Sitesi',
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

      // Kişiler bölüm/malik kayıtlarından ÖNCE: `malik.kisi_id` yabancı
      // anahtarı ters sırada ihlal edilir.
      await tx.kisi.createMany({
        data: [
          { id: YONETICI_KISI, tenantId: TENANT, ad: 'Yon', soyad: 'Etici', eposta: EPOSTA },
          { id: MALIK, tenantId: TENANT, ad: 'Malik', soyad: 'Test' },
        ],
      });

      for (const [i, id] of BOLUMLER.entries()) {
        await tx.bagimsizBolum.create({
          data: {
            id, tenantId: TENANT, blokId, katId, kapiNo: String(i + 1), kat: 1,
            nitelik: 'MESKEN', brutM2: 100, netM2: 85,
            arsaPayiPay: 500_000n, arsaPayiPayda: 1_000_000n,
          },
        });
        await tx.malik.create({
          data: {
            id: randomUUID(), tenantId: TENANT, bolumId: id, kisiId: MALIK,
            hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
            tapuBaslangic: new Date('2024-01-01'),
          },
        });
      }

      /*
       * KARŞILIKLI DIŞLAYAN GRUP. Çakışma tanımı VERİDİR: kod, şiddet ve
       * açıklama buradan gelir; motor hiçbir gider türü kodu bilmez.
       */
      // Gider türü ZORUNLU muhasebe hesabı taşır (ADR-0017 · K1); bu fikstür
      // muhasebeyle ilgilenmiyor ama bağ olmadan tür yazılamaz.
      const hesapId = randomUUID();
      await tx.hesap.create({
        data: {
          id: hesapId, tenantId: TENANT, kod: '349',
          ad: 'Alınan Ortak Gider Avansları', tip: 'BORC',
        },
      });

      const grupId = randomUUID();
      await tx.giderTuruGrubu.create({
        data: {
          id: grupId, tenantId: TENANT, kod: 'ISINMA', ad: 'Isınma gideri modeli',
          cakismaSiddeti: 'DIKKAT',
          cakismaAciklamasi:
            'Pay ölçerli sitede ISITMA, pay ölçersiz sitede YAKIT kullanılır. ' +
            'İkisi aynı dönemde tahakkuk edilirse ısınma gideri iki kez yansımış olabilir.',
        },
      });

      await tx.giderTuru.createMany({
        data: [
          {
            id: randomUUID(), tenantId: TENANT, kod: 'CT17_ISITMA', ad: 'Isıtma',
            paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
            kuralKaynagi: 'KMK_VARSAYILAN', aktifMi: true,
            tahakkukSikligi: 'DONEMSEL', grupId, muhasebeHesapId: hesapId,
          },
          {
            id: randomUUID(), tenantId: TENANT, kod: 'CT17_YAKIT', ad: 'Yakıt alımı',
            paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'KULLANANA_AIT',
            kuralKaynagi: 'KMK_VARSAYILAN', aktifMi: true,
            tahakkukSikligi: 'OLAY_BAZLI', grupId, muhasebeHesapId: hesapId,
          },
          // Gruba AİT DEĞİL — çakışma üretmemeli.
          {
            id: randomUUID(), tenantId: TENANT, kod: 'CT17_TEMIZLIK', ad: 'Temizlik',
            paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
            kuralKaynagi: 'KMK_VARSAYILAN', aktifMi: true,
            tahakkukSikligi: 'DONEMSEL', muhasebeHesapId: hesapId,
          },
        ],
      });

      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: TENANT, kisiId: YONETICI_KISI, eposta: EPOSTA,
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

  it('(1) yalnız ISITMA — uyarı YOK, alan yine de DÖNER', async () => {
    const y = await tahakkukEt('CT17_ISITMA', '2026-03-01');
    expect(y.status).toBe(201);
    // Alan her zaman döner: bazen var bazen yok olması istemcide sessiz
    // `undefined` hatası üretirdi.
    expect((y.body as TahakkukYaniti).uyarilar).toEqual([]);
  }, 60_000);

  it('(2) aynı dönemde ISITMA sonra YAKIT — 201 ve UYARI', async () => {
    const y = await tahakkukEt('CT17_YAKIT', '2026-03-01', { referans: 'IRS-2026-1' });
    expect(y.status).toBe(201);   // ★ işlem TAMAMLANIR, engellenmez

    const uyarilar = (y.body as TahakkukYaniti).uyarilar;
    expect(uyarilar).toHaveLength(1);
    expect(uyarilar[0]?.kod).toBe('ISINMA_CAKISMASI');
    expect(uyarilar[0]?.siddet).toBe('DIKKAT');
    expect(uyarilar[0]?.mesaj).toContain('iki kez');
  }, 60_000);

  it('(3) TERS SIRA — YAKIT sonra ISITMA da uyarır', async () => {
    const ilk = await tahakkukEt('CT17_YAKIT', '2026-04-01', { referans: 'IRS-2026-2' });
    expect(ilk.status).toBe(201);
    expect((ilk.body as TahakkukYaniti).uyarilar).toEqual([]);

    const ikinci = await tahakkukEt('CT17_ISITMA', '2026-04-01');
    expect(ikinci.status).toBe(201);
    const uyarilar = (ikinci.body as TahakkukYaniti).uyarilar;
    expect(uyarilar).toHaveLength(1);
    expect(uyarilar[0]?.kod).toBe('ISINMA_CAKISMASI');
  }, 60_000);

  it('(4) FARKLI DÖNEMLERDE ikisi — uyarı YOK (geçiş dönemi meşrudur)', async () => {
    const y = await tahakkukEt('CT17_YAKIT', '2026-05-01', { referans: 'IRS-2026-3' });
    expect(y.status).toBe(201);
    expect((y.body as TahakkukYaniti).uyarilar).toEqual([]);

    const digerDonem = await tahakkukEt('CT17_ISITMA', '2026-06-01');
    expect(digerDonem.status).toBe(201);
    expect((digerDonem.body as TahakkukYaniti).uyarilar).toEqual([]);
  }, 60_000);

  it('(5) uyarı DENETİM KAYDINA yazılır', async () => {
    const kayit = await baglamda((tx) => tx.auditKaydi.findFirst({
      where: { tenantId: TENANT, varlik: 'Tahakkuk' },
      orderBy: { olusmaAni: 'desc' },
    }));
    // En son çalıştırma (4)'ün ikinci tahakkuku — uyarısız.
    expect(kayit).not.toBeNull();

    const uyarili = await baglamda((tx) => tx.auditKaydi.findMany({
      where: { tenantId: TENANT, varlik: 'Tahakkuk' },
      orderBy: { olusmaAni: 'asc' },
    }));
    const uyariTasiyan = uyarili.filter((k) => {
      const d = k.sonrakiDeger as { uyarilar?: readonly Uyari[] } | null;
      return (d?.uyarilar?.length ?? 0) > 0;
    });
    // (2) ve (3) uyarı üretti.
    expect(uyariTasiyan).toHaveLength(2);
    const govde = uyariTasiyan[0]?.sonrakiDeger as unknown as { uyarilar: readonly Uyari[] };
    expect(govde.uyarilar[0]?.kod).toBe('ISINMA_CAKISMASI');
  }, 60_000);

  it('(6) ÖNİZLEMEDE de uyarı görünür — hata hiç oluşmadan önce', async () => {
    const y = await tahakkukEt('CT17_YAKIT', '2026-04-01', {
      referans: 'IRS-ONIZLEME', onizleme: true,
    });
    expect(y.status).toBe(201);
    const uyarilar = (y.body as TahakkukYaniti).uyarilar;
    expect(uyarilar).toHaveLength(1);
    expect(uyarilar[0]?.kod).toBe('ISINMA_CAKISMASI');
  }, 60_000);

  it('(7) gruba ait olmayan tür çakışma üretmez', async () => {
    const y = await tahakkukEt('CT17_TEMIZLIK', '2026-03-01');
    expect(y.status).toBe(201);
    expect((y.body as TahakkukYaniti).uyarilar).toEqual([]);
  }, 60_000);
});

