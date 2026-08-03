/**
 * CT-23 · MUHASEBE PARAMETRELERİ — derinlik geçişi ve hesap doğrulaması
 *
 * ⚠️  NEDEN VAR: `muhasebeDerinligi` migration 0034 ile eklenmişti ama uç
 *     ne döndürüyor ne kabul ediyordu; ayar yalnızca veritabanından ve
 *     tohumdan değiştirilebiliyordu. Kullanıcının göremediği bir ayar, ayar
 *     değildir.
 *
 * ⚠️  ASIL KURAL — `CIFT_TARAFLI → BASIT` GEÇİŞİ ENGELLİDİR. Karar
 *     verilmişti (docs/APARTMAN-SITE-AYRIMI.md §2.6) ama HİÇBİR YERDE
 *     UYGULANMIYORDU. Arayüzde gri düğme koruma değildir: API'den doğrudan
 *     çağıran geçebilirdi.
 *
 *     Gerekçe ADR-0017 K6 ile aynı sınıf: yazılmış yevmiye fişlerinin ne
 *     olacağı belirsizdir. Ters yön (`BASIT → CIFT_TARAFLI`) SERBESTTİR ve
 *     bu test onu da ölçer — yasağı yazarken meşru yol kapatılmamalıdır.
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

const T = randomUUID();
const EPOSTA = `ct23@${T.slice(0, 8)}.test`;
const HESAP = { kasa: randomUUID(), banka: randomUUID(), kar: randomUUID(), ana: randomUUID() };

interface GirisYaniti { readonly accessToken: string }
interface Hata { readonly detail?: string; readonly sonrakiEylem?: string }

function baglamda<T2>(fn: (tx: Prisma.TransactionClient) => Promise<T2>): Promise<T2> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${T}', true)`);
    for (const a of ['app.kapsam_kisi_id', 'app.kapsam_bolumler', 'app.kapsam_mulk_bolumler']) {
      await tx.$executeRawUnsafe(`SELECT set_config('${a}', '', true)`);
    }
    return fn(tx);
  });
}

describe('CT-23 · Muhasebe parametreleri', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;
  const oku = () => request(sunucu())
    .get('/api/v1/muhasebe/parametreler').set('Authorization', `Bearer ${jeton}`);
  const kaydet = (govde: Record<string, unknown>) => request(sunucu())
    .patch('/api/v1/muhasebe/parametreler')
    .set('Authorization', `Bearer ${jeton}`)
    .set('Idempotency-Key', randomUUID())
    .send(govde);

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: T, kod: `ct23-${T.slice(0, 8)}`, ad: 'CT-23 Parametre',
        tip: 'SITE', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      await tx.hesap.createMany({
        data: [
          { id: HESAP.kasa, tenantId: T, kod: '100', ad: 'Kasa', tip: 'VARLIK', ozellik: 'KASA' },
          { id: HESAP.banka, tenantId: T, kod: '102', ad: 'Bankalar', tip: 'VARLIK', ozellik: 'BANKA' },
          { id: HESAP.kar, tenantId: T, kod: '590', ad: 'Dönem Kârı', tip: 'OZKAYNAK' },
          // ARA (başlık) hesap — fiş kesilemez; varsayılan seçilemediği
          // ölçülür.
          {
            id: HESAP.ana, tenantId: T, kod: '10', ad: 'Hazır Değerler',
            tip: 'VARLIK', fisKesilebilirMi: false,
          },
        ],
      });

      const kisiId = randomUUID();
      await tx.kisi.create({ data: { id: kisiId, tenantId: T, ad: 'CT23', soyad: 'Yönetim' } });
      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: T, kisiId, eposta: EPOSTA,
          sifreHash: SIFRE_HASH, aktif: true,
          roller: { create: { id: randomUUID(), tenantId: T, rolKodu: 'YONETIM_SIRKETI' } },
        },
      });
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const y = await request(sunucu())
      .post('/api/v1/oturum/giris').send({ eposta: EPOSTA, sifre: 'bnos1234' });
    if (y.status >= 300) throw new Error(`Giriş başarısız: ${y.status}`);
    jeton = (y.body as GirisYaniti).accessToken;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('(1) kayıt yokken varsayılanlar döner — boş nesne DEĞİL', async () => {
    /*
     * Boş nesne dönseydi arayüz "yükleniyor" durumunda asılı kalırdı; ekran
     * kurulmamış bir projede hiç açılmazdı.
     */
    const y = await oku();
    expect(y.status).toBe(200);
    const p = y.body as { muhasebeDerinligi: string; varsayilanKasaHesapId: string | null };
    expect(p.varsayilanKasaHesapId).toBeNull();
    expect(p.muhasebeDerinligi).toBe('CIFT_TARAFLI');
  });

  it('(2) varsayılan kasa/banka/dönem kârı seçilebilir ve geri okunur', async () => {
    const k = await kaydet({
      varsayilanKasaHesapId: HESAP.kasa,
      varsayilanBankaHesapId: HESAP.banka,
      donemKariHesapId: HESAP.kar,
    });
    expect(k.status).toBe(200);

    const y = await oku();
    const p = y.body as {
      varsayilanKasaHesapId: string; varsayilanKasaKodu: string;
      varsayilanBankaKodu: string; donemKariKodu: string;
    };
    expect(p.varsayilanKasaHesapId).toBe(HESAP.kasa);
    expect(p.varsayilanKasaKodu).toBe('100');
    expect(p.varsayilanBankaKodu).toBe('102');
    expect(p.donemKariKodu).toBe('590');
  });

  it('(3) ARA hesap varsayılan seçilemez — açık hata', async () => {
    /*
     * Ara hesaba fiş kesilemez; varsayılan kasa yapılırsa tahsilat HER
     * denemede hata verir ve sebebi ayar ekranından görünmez.
     */
    const y = await kaydet({ varsayilanKasaHesapId: HESAP.ana });
    expect(y.status).toBe(422);
    expect((y.body as Hata).detail ?? '').toMatch(/ara/i);
  });

  // --- DERİNLİK GEÇİŞİ ---------------------------------------------------

  it('(4) ★ CIFT_TARAFLI → BASIT REDDEDİLİR ve SEBEBİ söylenir', async () => {
    /*
     * ⚠️  ARAYÜZ ENGELİ KORUMA DEĞİLDİR. Ekranda düğme gri olsa bile API'den
     *     doğrudan çağıran geçebilir; koruma veri katmanında olmalıdır.
     *
     *     Hata mesajı SEBEBİ söylemelidir: "yazılmış yevmiye fişlerinin ne
     *     olacağı belirsiz" (ADR-0017 K6 gerekçesi). Gerekçesiz bir ret,
     *     kullanıcıyı ürünün bozuk olduğuna inandırır.
     */
    const once = await oku();
    expect((once.body as { muhasebeDerinligi: string }).muhasebeDerinligi).toBe('CIFT_TARAFLI');

    const y = await kaydet({ muhasebeDerinligi: 'BASIT' });
    expect(y.status).toBe(422);
    const g = y.body as Hata;
    expect(g.detail ?? '').toMatch(/yevmiye/i);

    // ★ Reddedilen istek HİÇBİR ŞEYİ değiştirmemiş olmalıdır.
    const sonra = await oku();
    expect((sonra.body as { muhasebeDerinligi: string }).muhasebeDerinligi).toBe('CIFT_TARAFLI');
  });

  it('(5) ★ BASIT → CIFT_TARAFLI SERBEST — yasak meşru yolu kapatmıyor', async () => {
    /*
     * Yasağı yazarken ters yönü de kapatmak, basit muhasebeyle başlayan bir
     * projenin çift taraflıya geçmesini imkânsız kılardı.
     */
    await baglamda((tx) => tx.muhasebeParametresi.update({
      where: { tenantId: T }, data: { muhasebeDerinligi: 'BASIT' },
    }));

    const y = await kaydet({ muhasebeDerinligi: 'CIFT_TARAFLI' });
    expect(y.status, `geçiş reddedildi: ${JSON.stringify(y.body).slice(0, 160)}`).toBe(200);

    const sonra = await oku();
    expect((sonra.body as { muhasebeDerinligi: string }).muhasebeDerinligi).toBe('CIFT_TARAFLI');
  });

  it('(6) aynı değeri yeniden yazmak REDDEDİLMEZ', async () => {
    /*
     * `CIFT_TARAFLI → CIFT_TARAFLI` bir GEÇİŞ değildir. Yasak naif yazılsaydı
     * (yalnızca "yeni değer BASIT mi") ekrandan yapılan her kaydetme, derinlik
     * alanı değişmemiş olsa bile düşerdi.
     */
    const y = await kaydet({ muhasebeDerinligi: 'CIFT_TARAFLI', geriyeDonukGun: 0 });
    expect(y.status).toBe(200);
  });
});
