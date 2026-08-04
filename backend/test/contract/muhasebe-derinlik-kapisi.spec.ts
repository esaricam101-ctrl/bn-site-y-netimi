/**
 * CT-24 · MUHASEBE DERİNLİĞİ KAPISI — `BASIT` projede defter uçları kapalıdır
 *
 * ⚠️  NEDEN VAR: docs/MENU-HARITASI.md §5 "Muhasebe uçları `BASIT` projede 422
 *     döner ve sebebini yazar" diyordu; ÖLÇÜLDÜ, HİÇBİRİ DÖNMÜYORDU. Basit
 *     muhasebe kullanan bir apartman projesinde hesap planı, yevmiye defteri
 *     ve mizan uçlarının tamamı 200 + BOŞ dönüyordu.
 *
 *     Boş dönmek bu projede en kötü cevaptır: kullanıcı "veri yok" sanır,
 *     oysa kavramın kendisi o projede YOKTUR. Eksik veri ile tanımsız kavram
 *     ayrı şeylerdir (CT-20 Bölüm 3 ile aynı ayrım).
 *
 * ⚠️  MENÜDEN GİZLEMEK KORUMA DEĞİLDİR. Arayüz kararı görünürlük önlemidir;
 *     adres çubuğuna yolu yazan ya da API'yi doğrudan çağıran onu görmez.
 *     Kapı sunucuda olmalıdır — CT-23 (4) ile aynı gerekçe.
 *
 * ★ KAPI MEŞRU YOLU KAPATMAMALIDIR: `parametreler` uçları BASIT projede AÇIK
 *   KALIR. Kapatılsaydı `BASIT → CIFT_TARAFLI` yükseltmesi imkânsız olurdu —
 *   ayarın okunduğu ve değiştirildiği tek uç odur. Yasak yazarken tek çıkış
 *   kapısını kilitlemek, yasağı kuralsız bir hapse çevirirdi.
 *
 * ★ PARAMETRE KAYDI YOKKEN UÇLAR AÇIK KALIR. Kayıt yokluğu "basit muhasebe"
 *   anlamına GELMEZ; kurulumun henüz yapılmadığı anlamına gelir. Yokluğu
 *   BASIT saymak, kurulum sırasında hesap planı ekranını kendi kendine
 *   kilitlerdi. (Yazma yolunda tersi geçerlidir — bkz. `tahakkuk.command
 *   .service.ts` `ciftTarafliZorunluKil`: oraya deftere KAYIT ÜRETİLİR ve
 *   belirsizlikte yazmamak doğrudur. Okuma ile yazmanın varsayılanı bilinçli
 *   olarak terstir.)
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

/** Üç ayrı proje: derinlik farkının SONUCU ölçülür, tek projede ayar oynatılmaz. */
const T_BASIT = randomUUID();
const T_CIFT = randomUUID();
const T_KURULMAMIS = randomUUID();

const DONEM = 'baslangic=2026-01-01&bitis=2026-12-31';

interface GirisYaniti { readonly accessToken: string }
interface Hata { readonly detail?: string; readonly sonrakiEylem?: string }

function baglamda<T2>(
  tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T2>,
): Promise<T2> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', true)`);
    for (const a of ['app.kapsam_kisi_id', 'app.kapsam_bolumler', 'app.kapsam_mulk_bolumler']) {
      await tx.$executeRawUnsafe(`SELECT set_config('${a}', '', true)`);
    }
    return fn(tx);
  });
}

async function projeKur(
  tenantId: string, ad: string, tip: 'SITE' | 'APARTMAN',
  derinlik: 'BASIT' | 'CIFT_TARAFLI' | null,
): Promise<string> {
  const eposta = `ct24-${tenantId.slice(0, 8)}@test.test`;

  await prisma.tenant.create({
    data: {
      id: tenantId, kod: `ct24-${tenantId.slice(0, 8)}`, ad,
      tip, durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
      paraBirimi: 'TRY', lisansKodu: 'TEST',
    },
  });

  await baglamda(tenantId, async (tx) => {
    // Hesap planı HER projede kurulur: BASIT projede uçların kapalı olması
    // "veri yok" ile karışmasın. Veri VAR, kavram kapalı.
    await tx.hesap.createMany({
      data: [
        { id: randomUUID(), tenantId, kod: '100', ad: 'Kasa', tip: 'VARLIK', ozellik: 'KASA' },
        { id: randomUUID(), tenantId, kod: '120', ad: 'Alacaklar', tip: 'VARLIK', ozellik: 'CARI_KONTROL' },
      ],
    });

    if (derinlik !== null) {
      await tx.muhasebeParametresi.create({
        data: { tenantId, muhasebeDerinligi: derinlik },
      });
    }

    const kisiId = randomUUID();
    await tx.kisi.create({ data: { id: kisiId, tenantId, ad: 'CT24', soyad: 'Yönetici' } });
    await tx.kullanici.create({
      data: {
        id: randomUUID(), tenantId, kisiId, eposta,
        sifreHash: SIFRE_HASH, aktif: true,
        /*
         * ⚠️  APARTMAN_YONETICISI DEĞİL — o rolde `FINANS_YEVMIYE_GIRIS` YOK
         *     ve fiş yazma testi 422 yerine 403 alıyordu. Rol tanımı
         *     GEVŞETİLMEDİ: apartman yöneticisinin serbest yevmiye fişi kesip
         *     kesemeyeceği yol haritasında AÇIK bir sorudur (roller.ts:45-48
         *     gerekçesi). Testi yeşile boyamak için izin eklemek, o kararı
         *     sessizce vermek olurdu.
         */
        roller: { create: { id: randomUUID(), tenantId, rolKodu: 'YONETIM_SIRKETI' } },
      },
    });
  });

  return eposta;
}

/** Defter işi uçları — BASIT projede hiçbiri anlamlı değildir. */
const DEFTER_UCLARI: readonly (readonly [string, string])[] = [
  ['hesap planı', '/api/v1/muhasebe/hesaplar'],
  ['fiş listesi', '/api/v1/muhasebe/fisler'],
  ['dönemler', '/api/v1/muhasebe/donemler'],
  ['yevmiye defteri', `/api/v1/muhasebe/defterler/yevmiye?${DONEM}`],
  ['kasa defteri', `/api/v1/muhasebe/defterler/kasa?${DONEM}&ozellik=KASA`],
  ['mizan', `/api/v1/muhasebe/dokumler/mizan?${DONEM}`],
];

describe('CT-24 · Muhasebe derinliği kapısı', () => {
  let app: INestApplication;
  const jeton: Record<string, string> = {};

  const sunucu = (): Server => app.getHttpServer() as Server;
  const al = (proje: string, yol: string) => request(sunucu())
    .get(yol).set('Authorization', `Bearer ${jeton[proje]}`);

  beforeAll(async () => {
    const epostalar: Record<string, string> = {
      [T_BASIT]: await projeKur(T_BASIT, 'CT-24 Basit', 'APARTMAN', 'BASIT'),
      [T_CIFT]: await projeKur(T_CIFT, 'CT-24 Çift', 'SITE', 'CIFT_TARAFLI'),
      [T_KURULMAMIS]: await projeKur(T_KURULMAMIS, 'CT-24 Kurulmamış', 'SITE', null),
    };

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    for (const [tenantId, eposta] of Object.entries(epostalar)) {
      const y = await request(sunucu())
        .post('/api/v1/oturum/giris').send({ eposta, sifre: 'bnos1234' });
      if (y.status >= 300) throw new Error(`Giriş başarısız (${eposta}): ${y.status}`);
      jeton[tenantId] = (y.body as GirisYaniti).accessToken;
    }
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  // --- BÖLÜM 1 · BASIT projede defter uçları KAPALI --------------------------

  it.each(DEFTER_UCLARI)(
    '(1) BASIT projede %s ucu 422 döner — 200 + boş DEĞİL',
    async (_ad, yol) => {
      const y = await al(T_BASIT, yol);
      expect(
        y.status,
        `beklenen 422, gelen ${y.status}: ${JSON.stringify(y.body).slice(0, 160)}`,
      ).toBe(422);
    },
  );

  it('(2) ret SEBEBİ söylenir ve ÇIKIŞ YOLU gösterilir', async () => {
    /*
     * Gerekçesiz ret, kullanıcıyı ürünün bozuk olduğuna inandırır. Mesaj iki
     * şeyi birden söylemelidir: bu projede kavram neden yok, ve isteniyorsa
     * nereden açılır.
     */
    const y = await al(T_BASIT, '/api/v1/muhasebe/hesaplar');
    const g = y.body as Hata;
    expect(g.detail ?? '').toMatch(/basit muhasebe/i);
    expect(g.sonrakiEylem ?? '').toMatch(/parametre/i);
  });

  it('(3) YAZMA ucu da kapalıdır — okuma kapatılıp yazma açık kalmaz', async () => {
    /*
     * Yalnızca okuma kapatılsaydı, fiş yazan bir istemci BASIT projede deftere
     * kayıt üretmeye devam ederdi; sonra o kayıtlar hiçbir ekrandan
     * görünmezdi. Görünmeyen ama var olan mali kayıt, en kötü durumdur.
     */
    const y = await request(sunucu())
      .post('/api/v1/muhasebe/fisler')
      .set('Authorization', `Bearer ${jeton[T_BASIT]}`)
      .set('Idempotency-Key', randomUUID())
      .send({ tarih: '2026-03-01', aciklama: 'CT-24 deneme', satirlar: [] });
    expect(y.status).toBe(422);
  });

  // --- BÖLÜM 2 · Kapı MEŞRU YOLU kapatmaz -----------------------------------

  it('(4) ★ parametreler OKUMA ucu BASIT projede AÇIK kalır', async () => {
    /*
     * Kapatılsaydı arayüz projenin derinliğini hiç öğrenemez, dolayısıyla
     * menüyü de doğru filtreleyemezdi: kapı kendi ölçüm aletini kırardı.
     */
    const y = await al(T_BASIT, '/api/v1/muhasebe/parametreler');
    expect(y.status).toBe(200);
    expect((y.body as { muhasebeDerinligi: string }).muhasebeDerinligi).toBe('BASIT');
  });

  it('(5) ★ BASIT → CIFT_TARAFLI yükseltmesi hâlâ yapılabilir', async () => {
    /*
     * Tek çıkış kapısı. Kapatılsaydı basit muhasebeyle kurulmuş bir proje
     * sonsuza dek orada kalırdı ve ADR kararı ("ters yön serbest") kâğıt
     * üstünde kalırdı.
     *
     * ⚠️  Bu test T_BASIT'in derinliğini DEĞİŞTİRİR; bu yüzden en sonda
     *     çalışacak testlerden önce gelmemesi için Bölüm 1 ve (4) yukarıdadır.
     *     Sıra bilinçlidir.
     */
    const y = await request(sunucu())
      .patch('/api/v1/muhasebe/parametreler')
      .set('Authorization', `Bearer ${jeton[T_BASIT]}`)
      .set('Idempotency-Key', randomUUID())
      .send({ muhasebeDerinligi: 'CIFT_TARAFLI' });
    expect(y.status, `yükseltme reddedildi: ${JSON.stringify(y.body).slice(0, 160)}`).toBe(200);

    // Yükseltmeden SONRA defter ucu açılmalıdır — kapı gerçekten derinliğe
    // bağlı mı, yoksa projeye mi sabitlenmiş?
    const sonra = await al(T_BASIT, '/api/v1/muhasebe/hesaplar');
    expect(sonra.status).toBe(200);
  });

  // --- BÖLÜM 3 · Kapı YANLIŞ TARAFI kapatmaz --------------------------------

  it.each(DEFTER_UCLARI)(
    '(6) CIFT_TARAFLI projede %s ucu 200 döner',
    async (_ad, yol) => {
      const y = await al(T_CIFT, yol);
      expect(
        y.status,
        `beklenen 200, gelen ${y.status}: ${JSON.stringify(y.body).slice(0, 160)}`,
      ).toBe(200);
    },
  );

  it.each(DEFTER_UCLARI)(
    '(7) ★ parametre kaydı YOKKEN %s ucu açık kalır',
    async (_ad, yol) => {
      /*
       * Kayıt yokluğu kurulumun yapılmadığı anlamına gelir, "basit muhasebe"
       * anlamına gelmez. Yokluğu BASIT saysaydık, hesap planını kurmak için
       * girilen ekran kendi kendini kilitlerdi: hesap yok → parametre yok →
       * uç kapalı → hesap eklenemez.
       */
      const y = await al(T_KURULMAMIS, yol);
      expect(
        y.status,
        `kurulmamış projede kapandı (${y.status}): ${JSON.stringify(y.body).slice(0, 160)}`,
      ).toBe(200);
    },
  );
});
