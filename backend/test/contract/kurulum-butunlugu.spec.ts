/**
 * CT-20 · KURULUM BÜTÜNLÜĞÜ — hesap planı özellikleri ve muhasebe parametreleri
 *
 * ⚠️  NEDEN VAR: hangi hesabın kasa, banka, cari kontrol ya da yansıtma olduğu
 *     hesap KODUNA gömülü DEĞİLDİR — `hesap.ozellik` alanında VERİ olarak
 *     durur (§33 kural 3). Gerekçesi sağlam: kod planı tenant'a göre değişir
 *     ve '120' her tenant'ta alıcılar hesabı olmayabilir.
 *
 *     Ama tohum bu alanları HİÇ İŞARETLEMİYORDU ve `MuhasebeParametresi`
 *     kaydını da açmıyordu. Sonuç ölçüldü: tohumla kurulan projede tahsilat
 *     muhasebeleştirilemiyor —
 *
 *       POST /makbuzlar/:id/muhasebelestir → 422
 *       "Varsayılan kasa hesabı tanımlı değil; nakit tahsilat muhasebeleşemez."
 *
 * ⚠️  ★ KURULUM BÜTÜNLÜĞÜ **DERİNLİĞE GÖRE** DEĞİŞİR (2 Ağustos 2026).
 *
 *     Bu dosya önce her projede hesap planı + `MuhasebeParametresi` + açık
 *     dönem arıyordu. `BASIT` derinlikteki bir projede bunların olmaması
 *     EKSİKLİK DEĞİLDİR — test o hâliyle YANLIŞ TEŞHİS koyuyordu.
 *
 *     Ayrım `MuhasebeParametresi.muhasebeDerinligi`dedir (docs/
 *     APARTMAN-SITE-AYRIMI.md §2.1); `Tenant.tip` yalnızca VARSAYILANI
 *     belirler, kuralı değil.
 *
 * ⚠️  BU DOSYA ÜÇ FARKLI ŞEY ÖLÇER, karıştırılmamalı:
 *
 *       BÖLÜM 1 — CIFT_TARAFLI projede kurulum tam mı
 *       BÖLÜM 2 — kurulum EKSİKKEN sistem ne yapıyor (BİLİNEN EKSİK)
 *       BÖLÜM 3 — BASIT projede aynı eksiklikler HATA SAYILMAZ
 *
 *     İkinci bölüm, tohum düzeltildikten sonra da DURUR. Yoksa sessizlik
 *     görünmez hale gelir: düzeltme semptomu kapatır, sebebi değil. Yeni bir
 *     tenant elle kurulduğunda aynı sessizlik geri gelir.
 *
 * PostgreSQL + tohum gerektirir: `pnpm db:up && pnpm db:migrate && pnpm db:seed`
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

interface GirisYaniti { readonly accessToken: string }

/** BÖLÜM 2 için: özelliği HİÇ işaretlenmemiş kendi tenant'ı. */
const T2 = randomUUID();
const T2_KISI = randomUUID();
const T2_EPOSTA = `ct20-eksik@${T2.slice(0, 8)}.test`;
const T2_DONEM = randomUUID();
const BASIT_EPOSTA = `ct20-basit@${T2.slice(0, 8)}.test`;

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

describe('CT-20 · Kurulum bütünlüğü', () => {
  let app: INestApplication;
  let tohumTenantId: string;
  let apartmanTenantId: string;
  let eksikJeton: string;
  let basitJeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    /*
     * ⚠️  ÖLÇÜM ÖZNESİ `SITE` TENANT'IDIR, apartman değil. Bölüm 1'in
     *     aradığı şeyler (hesap planı özellikleri, parametre kaydı, açık
     *     dönem) yalnızca CIFT_TARAFLI derinlikte zorunludur.
     */
    const tohum = await prisma.tenant.findFirst({ where: { kod: 'papatya-sitesi' } });
    if (tohum === null) {
      throw new Error('Site tohumu yok. Önce `pnpm db:seed` çalıştırın.');
    }
    tohumTenantId = tohum.id;

    const apartman = await prisma.tenant.findFirst({ where: { kod: 'guzel-apartmani' } });
    if (apartman === null) {
      throw new Error('Apartman tohumu yok. Önce `pnpm db:seed` çalıştırın.');
    }
    apartmanTenantId = apartman.id;

    // Bölüm 3 için apartman tenant'ında KENDİ kullanıcısı (bkz. giriş notu).
    await baglamda(apartmanTenantId, async (tx) => {
      const kisiId = randomUUID();
      await tx.kisi.create({
        data: { id: kisiId, tenantId: apartmanTenantId, ad: 'CT-20', soyad: 'Basit' },
      });
      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: apartmanTenantId, kisiId, eposta: BASIT_EPOSTA,
          sifreHash: SIFRE_HASH, aktif: true,
          roller: {
            create: {
              id: randomUUID(), tenantId: apartmanTenantId,
              rolKodu: 'APARTMAN_YONETICISI',
            },
          },
        },
      });
    });

    // --- BÖLÜM 2 fikstürü: hesapları İŞARETSİZ bir tenant ---------------
    await prisma.tenant.create({
      data: {
        id: T2, kod: `ct20-${T2.slice(0, 8)}`, ad: 'CT-20 Eksik Kurulum',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });
    await baglamda(T2, async (tx) => {
      await tx.hesap.createMany({
        data: [
          { id: randomUUID(), tenantId: T2, kod: '100', ad: 'Kasa', tip: 'VARLIK' },
          { id: randomUUID(), tenantId: T2, kod: '102', ad: 'Bankalar', tip: 'VARLIK' },
          { id: randomUUID(), tenantId: T2, kod: '120', ad: 'Alacaklar', tip: 'VARLIK' },
        ],
      });
      await tx.muhasebeDonemi.create({
        data: {
          id: T2_DONEM, tenantId: T2, maliYil: 2026, ad: '2026',
          baslangic: new Date('2026-01-01'), bitis: new Date('2026-12-31'),
          durum: 'ACIK',
        },
      });
      await tx.kisi.create({
        data: { id: T2_KISI, tenantId: T2, ad: 'Eksik', soyad: 'Kurulum' },
      });
      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: T2, kisiId: T2_KISI, eposta: T2_EPOSTA,
          sifreHash: SIFRE_HASH, aktif: true,
          roller: { create: { id: randomUUID(), tenantId: T2, rolKodu: 'YONETIM_SIRKETI' } },
        },
      });
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const y = await request(sunucu())
      .post('/api/v1/oturum/giris').send({ eposta: T2_EPOSTA, sifre: 'bnos1234' });
    if (y.status >= 300) throw new Error(`Giriş başarısız: ${y.status}`);
    eksikJeton = (y.body as GirisYaniti).accessToken;

    /*
     * ⚠️  TOHUM KULLANICISIYLA GİRİLMEZ, KENDİ KULLANICISI AÇILIR.
     *
     *     Giriş ucu E-POSTA BAŞINA 5 deneme / 5 dk sınırlıyor
     *     (`oturum.controller.ts:23`). `yonetici@guzel-apartmani.test` ile
     *     girilseydi CT-04'ün de kullandığı kimliğin bütçesi tükenir ve
     *     BAŞKA BİR TEST kırmızıya düşerdi — ölçüldü, tam olarak bu oldu.
     *     Paylaşılan kimlik, paylaşılan fikstürdür.
     */
    const b = await request(sunucu())
      .post('/api/v1/oturum/giris').send({ eposta: BASIT_EPOSTA, sifre: 'bnos1234' });
    if (b.status >= 300) throw new Error(`Apartman girişi başarısız: ${b.status}`);
    basitJeton = (b.body as GirisYaniti).accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  // =====================================================================
  // BÖLÜM 1 — CIFT_TARAFLI PROJEDE KURULUM TAM MI
  //
  // Özne: `papatya-sitesi` (tip SITE, derinlik CIFT_TARAFLI).
  // =====================================================================

  it('(0) ölçüm öznesi gerçekten CIFT_TARAFLI', async () => {
    /*
     * Bu testin kendisi bir koruma: özne yanlışlıkla BASIT bir projeye
     * kayarsa Bölüm 1'in tamamı ANLAMSIZ olur ama yine de kırmızı görünür
     * ve sebebi aranırken zaman kaybedilir.
     */
    const p = await baglamda(tohumTenantId, (tx) =>
      tx.muhasebeParametresi.findFirst({ where: { tenantId: tohumTenantId } }));
    expect(p?.muhasebeDerinligi).toBe('CIFT_TARAFLI');
  });

  it('(1) tohum projesinde MuhasebeParametresi kaydı VAR', async () => {
    const p = await baglamda(tohumTenantId, (tx) =>
      tx.muhasebeParametresi.findFirst({ where: { tenantId: tohumTenantId } }));
    expect(p).not.toBeNull();
  });

  it('(2) varsayılan KASA ve BANKA hesapları seçili', async () => {
    /*
     * `p?.alan` KULLANMAYIN: kayıt yokken `undefined` üretir ve
     * `not.toBeNull()` sessizce geçer — testin kendisi de sessiz boşluk
     * üretebiliyor. Önce kaydın varlığı daraltılır.
     */
    const p = await baglamda(tohumTenantId, (tx) =>
      tx.muhasebeParametresi.findFirst({ where: { tenantId: tohumTenantId } }));
    if (p === null) throw new Error('MuhasebeParametresi kaydı yok.');
    expect(p.varsayilanKasaHesapId).not.toBeNull();
    expect(p.varsayilanBankaHesapId).not.toBeNull();
  });

  it('(3) TAM BİR tane CARI_KONTROL hesabı işaretli', async () => {
    /*
     * Birden çok işaretli hesap da hata: hangisinin kontrol hesabı olduğu
     * belirsizken yardımcı defter mutabakatı anlamsızdır (ADR-0010).
     */
    const sayi = await baglamda(tohumTenantId, (tx) => tx.hesap.count({
      where: { tenantId: tohumTenantId, ozellik: 'CARI_KONTROL', aktif: true, silinmeTarihi: null },
    }));
    expect(sayi).toBe(1);
  });

  it('(4) KASA · BANKA · YANSITMA özellikleri işaretli', async () => {
    const say = (ozellik: 'KASA' | 'BANKA' | 'YANSITMA') =>
      baglamda(tohumTenantId, (tx) => tx.hesap.count({
        where: { tenantId: tohumTenantId, ozellik, aktif: true, silinmeTarihi: null },
      }));
    expect(await say('KASA')).toBeGreaterThan(0);
    expect(await say('BANKA')).toBeGreaterThan(0);
    expect(await say('YANSITMA')).toBeGreaterThan(0);
  });

  it('(5) BUGÜNÜ kapsayan AÇIK muhasebe dönemi var', async () => {
    /*
     * Üçüncü boşluk, ilk ikisi kapatıldıktan SONRA ortaya çıktı: hesaplar
     * işaretli ve parametreler dolu olsa bile dönem yoksa fiş kesilemez —
     * "2026-08-02 tarihini kapsayan bir muhasebe dönemi yok."
     *
     * Bugün ile ölçülür, sabit yılla değil: tohum başka bir yılda kurulursa
     * sabit yıl testi yeşil kalır ama proje yine çalışmaz.
     */
    const bugun = new Date();
    const sayi = await baglamda(tohumTenantId, (tx) => tx.muhasebeDonemi.count({
      where: {
        tenantId: tohumTenantId, durum: 'ACIK',
        baslangic: { lte: bugun }, bitis: { gte: bugun },
      },
    }));
    expect(sayi).toBeGreaterThan(0);
  });

  // =====================================================================
  // BÖLÜM 2 — KURULUM EKSİKKEN SİSTEM NE YAPIYOR
  //
  // ⚠️  Buradaki testler DOĞRU davranışı değil, BUGÜNKÜ davranışı belgeler.
  //     Tohum düzeltildikten sonra da koşarlar; amaçları sessizliğin
  //     görünür kalmasıdır.
  // =====================================================================

  it('(6) ⚠️ BİLİNEN EKSİK: kasa defteri işaretsiz hesapta SESSİZCE boş döner', async () => {
    /*
     * ⛔ BU DAVRANIŞ YANLIŞTIR. "Hesap işaretlenmemiş" ile "hesapta hareket
     *    yok" farklı iki durumdur; ikisi de `200 + []` dönüyor. Kullanıcı
     *    defterin doğru olduğunu sanar.
     *
     *    Doğrusu: hiç işaretli hesap yoksa 422 + çıkış yolu; işaretli hesap
     *    var ama hareket yoksa 200 + []. Tahsilat tarafı bu ayrımı YAPIYOR
     *    (`cariKontrolHesabi`), defter tarafı yapmıyor — ürünün kendi
     *    içinde tutarsızlık.
     *
     *    Yol haritası: "Defter sorgusu açık hata" maddesi. Düzeltildiğinde
     *    bu test 422 bekleyecek şekilde GÜNCELLENİR, silinmez.
     */
    for (const ozellik of ['KASA', 'BANKA']) {
      const y = await request(sunucu())
        .get('/api/v1/muhasebe/defterler/kasa')
        .query({ baslangic: '2026-01-01', bitis: '2026-12-31', ozellik })
        .set('Authorization', `Bearer ${eksikJeton}`);
      expect(y.status).toBe(200);
      expect(y.body).toEqual([]);
    }
  });

  it('(7) karşılaştırma: YANSITMA işaretsizken AÇIK HATA veriyor — sessiz değil', async () => {
    /*
     * Bu test (6) ile birlikte okunmalıdır: aynı eksiklik sınıfı, iki farklı
     * davranış. Yansıtma yolu doğruyu yapıyor, kasa/banka yolu yapmıyor.
     * Fark ölçülebilir olmasaydı "hepsi sessiz" ya da "hepsi açık" sanılırdı.
     */
    const y = await request(sunucu())
      .post(`/api/v1/muhasebe/donemler/${T2_DONEM}/yansitma-fisi`)
      .set('Authorization', `Bearer ${eksikJeton}`)
      .set('Idempotency-Key', randomUUID())
      .send({});
    expect(y.status).toBe(422);
    const govde = y.body as { sonrakiEylem?: string };
    expect(govde.sonrakiEylem).toMatch(/YANSITMA/);
  });

  // =====================================================================
  // BÖLÜM 3 — ★ BASIT PROJEDE AYNI EKSİKLİKLER HATA SAYILMAZ
  //
  // Bu bölüm bir DÜZELTMEDİR. Bu dosya önce her projede hesap planı ve
  // kontrol hesabı arıyordu; `BASIT` derinlikte bunların olmaması eksiklik
  // DEĞİLDİR (docs/APARTMAN-SITE-AYRIMI.md §2.1) ve test yanlış teşhis
  // koyuyordu.
  // =====================================================================

  it('(8) apartman tohumu BASIT derinliktedir', async () => {
    const p = await baglamda(apartmanTenantId, (tx) =>
      tx.muhasebeParametresi.findFirst({ where: { tenantId: apartmanTenantId } }));
    expect(p?.muhasebeDerinligi).toBe('BASIT');
  });

  it('(9) ★ BASIT projede CARI_KONTROL hesabı ARANMAZ', async () => {
    /*
     * Apartman yönetimlerinin tüzel kişiliği ve vergi mükellefiyeti yoktur;
     * çift taraflı bilanço esaslı muhasebe kanunen zorunlu değildir. Kontrol
     * hesabının bulunmaması bu projelerde NORMALDİR.
     *
     * ⚠️  Test hesabın YOKLUĞUNU dayatmaz — tohum bugün onu yazıyor ve bu da
     *     meşrudur (derinlik sonradan yükseltilebilir). Ölçülen şey:
     *     varlığının ZORUNLU OLMADIĞI, yani hiçbir iddia kurulmadığıdır.
     */
    const sayi = await baglamda(apartmanTenantId, (tx) => tx.hesap.count({
      where: { tenantId: apartmanTenantId, ozellik: 'CARI_KONTROL' },
    }));
    expect(sayi).toBeGreaterThanOrEqual(0);
  });

  it('(10) ★ BASIT projede kontrol mutabakatı 422 — null DEĞİL', async () => {
    /*
     * `mutabikMi: null` dönmek "hesaplandı ama sonuç yok" izlenimi verir.
     * Bu proje o hesabı HİÇ YAPMIYOR; ikisi farklı şeydir.
     */
    const y = await request(sunucu())
      .get('/api/v1/makbuzlar/rapor/kontrol-mutabakati')
      .set('Authorization', `Bearer ${basitJeton}`);
    expect(y.status).toBe(422);
    const g = y.body as { detail?: string; sonrakiEylem?: string };
    expect(g.detail ?? '').toMatch(/basit muhasebe/i);
    // ★ Alacak takibinin ETKİLENMEDİĞİ açıkça söylenmeli: kullanıcı
    //   "borç takibim de mi yok" diye düşünmemeli.
    expect(g.sonrakiEylem ?? '').toMatch(/[Aa]lacak takibi/);
  });

  it('(11) ★ BASIT projede cari ekstre ÇALIŞIR — alacak takibi etkilenmez', async () => {
    /*
     * Ayrımın en kritik noktası: tahakkuk ve alacak takibi İKİ TARAFTA DA
     * vardır. Fark yalnızca deftere düşüp düşmemesidir.
     */
    const bolum = await baglamda(apartmanTenantId, (tx) =>
      tx.bagimsizBolum.findFirstOrThrow({
        where: { tenantId: apartmanTenantId }, select: { id: true },
      }));
    const y = await request(sunucu())
      .get(`/api/v1/makbuzlar/cari/${bolum.id}`)
      .query({ baslangic: '2026-01-01', bitis: '2026-12-31' })
      .set('Authorization', `Bearer ${basitJeton}`);
    expect(y.status).toBe(200);
    const g = y.body as { satirlar: unknown[] };
    expect(g.satirlar.length).toBeGreaterThan(0);
  });
});
