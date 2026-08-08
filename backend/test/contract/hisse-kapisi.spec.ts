/**
 * CT-28 · Σ HİSSE = 1 KAPISI — bağlama seviyesinde (ADR-0018 · K5 · A2b)
 *
 * ⚠️  NEDEN VAR — DAVRANIŞ DEĞİŞİKLİĞİNİN KANITI:
 *     Bu kapı açılmadan önce bozuk hisse toplamı SESSİZCE NORMALİZE
 *     EDİLİYORDU. `dagit` ağırlıkları gerçek toplama böldüğü için
 *     `1/1 + 1/1` (yarım kalmış devir: eski malikin tapusu kapatılmamış,
 *     yenisi eklenmiş) borcu yarı yarıya paylaştırıyor ve hiçbir uyarı
 *     vermiyordu. Sonuç zincirleme: mülkiyeti devretmiş kişi adına borç
 *     doğar → `BorcSorumlusu` snapshot'ına yazılır → kişi ekstresinde
 *     çıkar → gecikme bildirimi listesine girer. Hiçbir aşamada hata yok,
 *     yalnızca yanlış rakam.
 *
 * ★ NEDEN BU TEST BİRİM TESTİNDEN AYRI:
 *   `tests/unit/hisse-dogrulama.test.mjs` (A1–A6) domain fonksiyonunun
 *   KENDİSİNİ sınar — kesir aritmetiği, süzme, hata fırlatması. Ama
 *   fonksiyonun DOĞRU olması onun ÇAĞRILDIĞI anlamına gelmez: bağlanmamış
 *   bir doğrulayıcı, yazılmamış bir doğrulayıcı kadar işe yaramaz
 *   (`hisseleriZorunluKil` tam olarak bu durumdaydı). Buradaki testler
 *   gerçek uca `POST /tahakkuk/calistir` isteği atar.
 *
 * ⚠️  CT-26 BU KONTROLÜ SINAMAZ: o test tahakkuk servisini çağırmaz,
 *     BENZERİNİ kurar — `tahakkukCalismasi` kaydını doğrudan Prisma ile
 *     yazar. Servis yolundaki hiçbir kural oradan geçmez. Bu, "tohum/fikstür
 *     sadakati" maddesinin ikinci örneğidir ve yol haritasında kayıtlıdır.
 *
 * ★ MESAJ İÇERİĞİ HEDEFLENİR, `toThrow()` YETMEZ (K5'in kapanmayan yarısı):
 *   "hisse toplamı 1 değil" diyen bir hata yöneticiye HANGİ bölümü
 *   düzelteceğini söylemez. 120 daireli bir sitede bu mesaj eylem üretmez.
 *   Bölüm + kayıtlı hisseler mesajda olmalı; bu yüzden aşağıda içerik
 *   parça parça aranıyor.
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
interface Problem {
  readonly status: number;
  readonly detail: string;
  readonly sonrakiEylem?: string;
}

const TENANT = randomUUID();
const YONETICI_KISI = randomUUID();
const EPOSTA = `ct28-yonetici@${TENANT.slice(0, 8)}.test`;

/*
 * HER HİSSE DURUMU KENDİ BLOĞUNDA.
 *
 * ⚠️  `TahakkukCalistirDto`'da bölüm seçimi ALANI YOKTUR — motor tenant'ın
 *     TÜM bölümlerini alır (servis satır 386). Tek daraltma noktası
 *     `hedefBlokId`'dir ve o süzgeç bölüm sorgusuna KOŞULSUZ uygulanır,
 *     yalnızca BLOK_BAZLI kuralında değil (satır 389). Bozuk bölümler tek
 *     blokta toplanırsa hangisinin hatayı ürettiği ayırt edilemezdi.
 */
const BLOK_SAGLAM = randomUUID();
const BLOK_FAZLA = randomUUID();
const BLOK_EKSIK = randomUUID();
const BLOK_KARMA = randomUUID();

const BOLUM_SAGLAM = randomUUID();        // 1/1 → toplam tam
const BOLUM_FAZLA = randomUUID();         // 1/1 + 1/1 → toplam 2 (yarım devir)
const BOLUM_EKSIK = randomUUID();         // 1/2 (dönem dışı) + 1/2 → toplam 1/2
const BOLUM_KARMA_SAGLAM = randomUUID();  // (5) için: aynı blokta sağlam
const BOLUM_KARMA_BOZUK = randomUUID();   // (5) için: aynı blokta bozuk

const MALIK_A = randomUUID();
const MALIK_B = randomUUID();

/*
 * HER SENARYO KENDİ DÖNEMİNDE.
 *
 * ⚠️  MÜKERRER TAHAKKUK KAPISI HİSSE KAPISINDAN ÖNCE ÇALIŞIR — aynı
 *     (gider türü, dönem) ikilisi ikinci kez denenirse 409 döner ve hisse
 *     doğrulamasına HİÇ SIRA GELMEZ. Bu sıralama doğrudur (mükerrer kontrolü
 *     bölüm döngüsünden önce, tek sorguyla yapılır) ama testte gizli bir
 *     tuzak: tüm senaryolar tek dönemde toplanırsa ilki geçer, kalanı 409
 *     alır ve test "kapı çalışmıyor" değil "kapıya varılamıyor" der.
 *
 * ⚠️  Tüm dönemler 2026 içinde: `BOLUM_EKSIK` fikstüründeki devir
 *     2025-12-31'de kapanıyor, dönem dışı kalması buna bağlı.
 */
const DONEM_SAGLAM = '2026-03-01';
const DONEM_FAZLA = '2026-04-01';
const DONEM_EKSIK = '2026-05-01';
const DONEM_KISISEL_VERI = '2026-06-01';
const DONEM_KARMA = '2026-07-01';

function baglamda<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
    return fn(tx);
  });
}

describe('CT-28 · Σ hisse = 1 kapısı (bağlama)', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  /** Tek bloğa daraltılmış çalıştırma — bkz. blok yorumu yukarıda. */
  const tahakkukEt = (
    blokId: string, donem: string, ekstra: Record<string, unknown> = {},
  ) =>
    request(sunucu())
      .post('/api/v1/tahakkuk/calistir')
      .set('Authorization', `Bearer ${jeton}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        giderTuruKodu: 'CT28_AIDAT', toplamTutar: '1200.00',
        donem, vadeTarihi: `${donem.slice(0, 8)}28`,
        hedefBlokId: blokId,
        ...ekstra,
      });

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct28-${TENANT.slice(0, 8)}`, ad: 'CT-28 Test Sitesi',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      const apartmanId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: TENANT, ad: 'A Apartmanı' } });

      const bloklar = [
        { id: BLOK_SAGLAM, ad: 'S' },
        { id: BLOK_FAZLA, ad: 'F' },
        { id: BLOK_EKSIK, ad: 'E' },
        { id: BLOK_KARMA, ad: 'K' },
      ];
      // Blok başına bir kat: `bagimsizBolum.katId` zorunlu ve kat bloğa bağlı.
      const katlar = new Map<string, string>();
      for (const b of bloklar) {
        await tx.blok.create({
          data: { id: b.id, tenantId: TENANT, apartmanId, ad: b.ad },
        });
        const katId = randomUUID();
        await tx.kat.create({ data: { id: katId, tenantId: TENANT, blokId: b.id, no: 1 } });
        katlar.set(b.id, katId);
      }

      await tx.kisi.createMany({
        data: [
          { id: YONETICI_KISI, tenantId: TENANT, ad: 'Yon', soyad: 'Etici', eposta: EPOSTA },
          { id: MALIK_A, tenantId: TENANT, ad: 'Malik', soyad: 'Bir' },
          { id: MALIK_B, tenantId: TENANT, ad: 'Malik', soyad: 'Iki' },
        ],
      });

      const bolumTanimlari = [
        { id: BOLUM_SAGLAM, kapiNo: '1', blokId: BLOK_SAGLAM },
        { id: BOLUM_FAZLA, kapiNo: '2', blokId: BLOK_FAZLA },
        { id: BOLUM_EKSIK, kapiNo: '3', blokId: BLOK_EKSIK },
        { id: BOLUM_KARMA_SAGLAM, kapiNo: '4', blokId: BLOK_KARMA },
        { id: BOLUM_KARMA_BOZUK, kapiNo: '5', blokId: BLOK_KARMA },
      ];
      for (const b of bolumTanimlari) {
        await tx.bagimsizBolum.create({
          data: {
            id: b.id, tenantId: TENANT, blokId: b.blokId,
            katId: katlar.get(b.blokId) as string, kapiNo: b.kapiNo, kat: 1,
            nitelik: 'MESKEN', brutM2: 100, netM2: 85,
            arsaPayiPay: 333_333n, arsaPayiPayda: 1_000_000n,
          },
        });
      }

      const tapu = (
        bolumId: string, kisiId: string, pay: bigint, payda: bigint,
        baslangic: string, bitis: string | null,
      ) => tx.malik.create({
        data: {
          id: randomUUID(), tenantId: TENANT, bolumId, kisiId,
          hissePay: pay, hissePayda: payda, tapuTuru: 'KAT_MULKIYETI',
          tapuBaslangic: new Date(baslangic),
          tapuBitis: bitis === null ? null : new Date(bitis),
        },
      });

      // (1) SAĞLAM — tek malik, tam hisse.
      await tapu(BOLUM_SAGLAM, MALIK_A, 1n, 1n, '2024-01-01', null);

      /*
       * (2) FAZLA — YARIM KALMIŞ DEVİR. Eski malikin tapusu KAPATILMAMIŞ
       * (`tapuBitis` yok), yeni malik eklenmiş. İkisi de dönem içi ve ikisi
       * de tam hisse taşıyor: Σ = 2. Eski davranış bunu 1/2 + 1/2 yapıp
       * devretmiş kişiye borç yazıyordu.
       */
      await tapu(BOLUM_FAZLA, MALIK_A, 1n, 1n, '2020-01-01', null);
      await tapu(BOLUM_FAZLA, MALIK_B, 1n, 1n, '2025-06-01', null);

      /*
       * (3) EKSİK — devir yapılmış ama yeni malikin payı yarım girilmiş.
       * Eski tapu DÖNEM DIŞI (2025 sonunda kapatılmış), dönem içinde
       * yalnızca 1/2 var: bölümün yarısı sahipsiz.
       */
      await tapu(BOLUM_EKSIK, MALIK_A, 1n, 2n, '2020-01-01', '2025-12-31');
      await tapu(BOLUM_EKSIK, MALIK_B, 1n, 2n, '2026-01-01', null);

      // (5) KARMA blok — aynı çalıştırmada sağlam ve bozuk bölüm.
      await tapu(BOLUM_KARMA_SAGLAM, MALIK_A, 1n, 1n, '2024-01-01', null);
      await tapu(BOLUM_KARMA_BOZUK, MALIK_A, 1n, 1n, '2020-01-01', null);
      await tapu(BOLUM_KARMA_BOZUK, MALIK_B, 1n, 1n, '2025-06-01', null);

      // Gider türü ZORUNLU muhasebe hesabı taşır (ADR-0017 · K1).
      const hesapId = randomUUID();
      await tx.hesap.create({
        data: {
          id: hesapId, tenantId: TENANT, kod: '349',
          ad: 'Alınan Ortak Gider Avansları', tip: 'BORC',
        },
      });

      /*
       * HISSE_ORANI paylaşımı — hisse kapısı her paylaşım kuralında çalışır
       * ama etkisi burada en açıktır: pay doğrudan hisseden türüyor.
       */
      await tx.giderTuru.create({
        data: {
          id: randomUUID(), tenantId: TENANT, kod: 'CT28_AIDAT', ad: 'Aidat',
          paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
          malikPaylasimi: 'HISSE_ORANI',
          kuralKaynagi: 'KMK_VARSAYILAN', aktifMi: true,
          tahakkukSikligi: 'DONEMSEL', muhasebeHesapId: hesapId,
        },
      });

      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: TENANT, kisiId: YONETICI_KISI, eposta: EPOSTA,
          sifreHash: SIFRE_HASH, aktif: true,
          roller: {
            create: { id: randomUUID(), tenantId: TENANT, rolKodu: 'APARTMAN_YONETICISI' },
          },
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

  it('(1) SAĞLAM hisse — tahakkuk geçer (kapı yanlış yere kapanmıyor)', async () => {
    const y = await tahakkukEt(BLOK_SAGLAM, DONEM_SAGLAM);
    expect(y.status).toBe(201);
  }, 60_000);

  /*
   * ★ A2b — K5'İN KAPANMAYAN YARISI. Aşağıdaki üç grup ayrı ayrı aranıyor:
   *   domain'in ölçtüğü (tarih + oran + yön) · bağlamanın eklediği (bölüm) ·
   *   bağlamanın eklediği (kayıtlı hisseler). Tek bir birleşik metinle
   *   karşılaştırma yapılmıyor: `malik.findMany` sırası garanti değil.
   */
  it('(2) FAZLA toplam — 422 ve mesaj BÖLÜMÜ + KAYITLI HİSSELERİ söylüyor', async () => {
    const y = await tahakkukEt(BLOK_FAZLA, DONEM_FAZLA);
    expect(y.status).toBe(422);

    const p = y.body as Problem;

    // (a) BAĞLAMANIN EKLEDİĞİ — hangi bölüm.
    expect(p.detail).toContain('2 nolu bağımsız bölüm');

    // (b) DOMAIN MESAJI KORUNMUŞ — tarih, oran ve yön.
    expect(p.detail).toContain(DONEM_FAZLA);
    expect(p.detail).toContain('2.000000');
    expect(p.detail).toContain('birden fazla kisiye');

    // (c) BAĞLAMANIN EKLEDİĞİ — kayıtlı hisseler, dönem içi işaretiyle.
    expect(p.detail).toContain('Kayıtlı hisseler:');
    expect(p.detail).toContain('1/1 (dönem içi)');

    /*
     * Domain'in çözüm önerisi de taşınmış.
     *
     * ⚠️  ASCII'Lİ TÜRKÇE BİLEREK BEKLENİYOR, düzeltilmiş hâli değil:
     *     `shared/*-domain` katmanının TÜM hata metinleri diakritiksiz
     *     ("kayitlarini duzeltin"), `backend/` katmanının metinleri ise
     *     diakritikli. İki katman tek cümlede birleştiği için kullanıcı
     *     KARMA metin görüyor. Bu testin işi o dikişi gizlemek değil
     *     SABİTLEMEK — depo genelindeki tercih değişirse burası kırmızıya
     *     düşer ve karar bilinçli alınır. Yol haritasında kayıtlı.
     */
    expect(p.sonrakiEylem).toBe('Tapu ve hisse kayitlarini duzeltin.');
  }, 60_000);

  it('(3) EKSİK toplam — DÖNEM DIŞI tapu da mesajda görünüyor', async () => {
    const y = await tahakkukEt(BLOK_EKSIK, DONEM_EKSIK);
    expect(y.status).toBe(422);

    const p = y.body as Problem;
    expect(p.detail).toContain('3 nolu bağımsız bölüm');
    expect(p.detail).toContain('0.500000');
    expect(p.detail).toContain('sahipsiz');

    /*
     * ★ ASIL BULGU BURADA: dönem içi kayda bakan yönetici tek bir 1/2 görür
     *   ve neyin eksik olduğunu anlamaz. Dönem DIŞI tapu tarih aralığıyla
     *   yazıldığı için hangi devrin yarım kaldığı belli olur.
     */
    expect(p.detail).toContain('1/2 (dönem içi)');
    expect(p.detail).toMatch(/1\/2 \(dönem dışı: 2020-01-01–2025-12-31\)/);
  }, 60_000);

  it('(4) mesajda KİŞİ ADI yok — hata gövdesi günlüğe düşebilir', async () => {
    const y = await tahakkukEt(BLOK_FAZLA, DONEM_KISISEL_VERI);
    expect(y.status).toBe(422);

    const p = y.body as Problem;
    // Kesir + tarih aralığı kaydı zaten tekilleştirir; ada gerek yok.
    expect(p.detail).not.toContain('Malik');
    expect(p.detail).not.toContain('Bir');
    expect(p.detail).not.toContain('Iki');
  }, 60_000);

  it('(5) KISMİ TAHAKKUK YOK — bozuk bölüm SAĞLAM bölümü de geri alır', async () => {
    /*
     * ★ ADR-0018 §2.5 üçüncü şartı: "Kısmi tahakkuk yok." Aynı blokta bir
     *   sağlam ve bir bozuk bölüm var. Sağlam bölümün borcu yazılıp bozukta
     *   patlanırsa yönetici hatayı düzeltip TEKRAR çalıştırır ve sağlam
     *   bölüm İKİNCİ KEZ borçlanır — mükerrer tahakkuk kapısı bu senaryoyu
     *   yakalamaz, çünkü ilk çalışma kaydı hiç oluşmamıştır.
     *
     * ⚠️  KAPI YERİ İTİRAFI: koruma burada işlem geri alımından (`$transaction`)
     *     geliyor, kuralın kendisinden değil. Doğrulamanın önizlemeye
     *     taşınması AYRI bir adımdır ve henüz yapılmadı. Bu test o adım
     *     yapıldığında da geçmelidir — o zaman hata yazma başlamadan önce
     *     döner, bu satırların ölçtüğü değişmez aynı kalır.
     */
    const donem = new Date('2026-07-01');
    const sayimlar = () => baglamda(async (tx) => ({
      borc: await tx.borc.count({
        where: { tenantId: TENANT, bolumId: BOLUM_KARMA_SAGLAM, tahakkukDonemi: donem },
      }),
      calisma: await tx.tahakkukCalismasi.count({ where: { tenantId: TENANT, donem } }),
    }));

    expect(await sayimlar()).toEqual({ borc: 0, calisma: 0 });

    const y = await tahakkukEt(BLOK_KARMA, DONEM_KARMA);
    expect(y.status).toBe(422);
    expect((y.body as Problem).detail).toContain('5 nolu bağımsız bölüm');

    // Sağlam bölümün borcu YAZILMAMIŞ, çalışma kaydı da AÇILMAMIŞ olmalı.
    expect(await sayimlar()).toEqual({ borc: 0, calisma: 0 });
  }, 60_000);
});
