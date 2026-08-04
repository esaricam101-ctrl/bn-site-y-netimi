/**
 * CT-25 · DEFTER BÜTÜNLÜĞÜ — ara hesap yasağı ve mizan denkliği
 *
 * ⚠️  NEDEN VAR: iki kural da UYGULANIYOR ama HİÇBİR TEST ÖLÇMÜYORDU.
 *     Gerçek bir site hesap planı çözümlenirken ortaya çıktı
 *     (docs/HESAP-PLANI-MANTIGI.md · madde 1 ve 6).
 *
 *   (a) ARA/BAŞLIK HESABA FİŞ YAZILAMAZ. Kural üç mekanizmayla birden
 *       uygulanıyor (`ustHesapId` ağacı · `fisKesilebilirMi` bayrağı ·
 *       `fisiDogrula` kontrolü) ama korumasızdı: yarın `fisiDogrula`
 *       değiştirilse tek bir test bile kırmızı olmazdı.
 *
 *       Bozulursa ne olur: üst hesaba yazılan tutar hem kendisinde hem
 *       alt hesaplar toplamında sayılır — mizan çift sayar ve fark hangi
 *       satırdan geldiği bilinmeden kalıcılaşır.
 *
 *   (b) MİZAN DENK OLMALIDIR. `denkMi` hesaplanıyor, yanıtta dönüyor,
 *       ekranda görünüyor — ve YANLIŞ HESAPLANSA KİMSE GÖRMEZDİ.
 *       "Toplam sıfır" bir defterin en basit bütünlük kontrolüdür.
 *
 * ★ TEST HTTP'DEN GİDER — bilinçli. Ölçülen şey uçtan uca davranıştır:
 *   doğrulamanın domain katmanında olması bir uygulama ayrıntısıdır,
 *   kullanıcının gördüğü şey uçtan dönen cevaptır.
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
const EPOSTA = `ct25@${T.slice(0, 8)}.test`;

/** `10` ARA hesaptır: altında `100` vardır, kendisine fiş kesilemez. */
const H_ARA = randomUUID();
const H_KASA = randomUUID();
const H_GELIR = randomUUID();

const YIL = 2026;
const TARIH = '2026-03-15';
const ARALIK = 'baslangic=2026-01-01&bitis=2026-12-31';

interface GirisYaniti { readonly accessToken: string }
interface Hata { readonly detail?: string; readonly sonrakiEylem?: string }

interface MizanDokumu {
  readonly satirlar: readonly { readonly kod: string; readonly borcToplam: string }[];
  readonly borcToplam: string;
  readonly alacakToplam: string;
  readonly borcBakiyeToplam: string;
  readonly alacakBakiyeToplam: string;
  readonly denkMi: boolean;
}

function baglamda<T2>(fn: (tx: Prisma.TransactionClient) => Promise<T2>): Promise<T2> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${T}', true)`);
    for (const a of ['app.kapsam_kisi_id', 'app.kapsam_bolumler', 'app.kapsam_mulk_bolumler']) {
      await tx.$executeRawUnsafe(`SELECT set_config('${a}', '', true)`);
    }
    return fn(tx);
  });
}

describe('CT-25 · Defter bütünlüğü', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  const fisYaz = (satirlar: readonly Record<string, unknown>[]) =>
    request(sunucu())
      .post('/api/v1/muhasebe/fisler')
      .set('Authorization', `Bearer ${jeton}`)
      .set('Idempotency-Key', randomUUID())
      .send({ tarih: TARIH, aciklama: 'CT-25 deneme fişi', satirlar });

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: T, kod: `ct25-${T.slice(0, 8)}`, ad: 'CT-25 Defter',
        tip: 'SITE', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      await tx.hesap.createMany({
        data: [
          /*
           * ARA HESAP — `fisKesilebilirMi: false`. Üretimde bu bayrağı
           * `hesap-plani.service` alt hesap eklenince OTOMATİK indirir;
           * burada doğrudan kurulur çünkü ölçülen şey bayrağın nasıl
           * indiği değil, indikten SONRA fişin reddedilmesidir.
           */
          {
            id: H_ARA, tenantId: T, kod: '10', ad: 'Hazır Değerler',
            tip: 'VARLIK', fisKesilebilirMi: false,
          },
          {
            id: H_KASA, tenantId: T, kod: '100', ad: 'Kasa', tip: 'VARLIK',
            ozellik: 'KASA', ustHesapId: H_ARA,
          },
          { id: H_GELIR, tenantId: T, kod: '600', ad: 'Aidat Gelirleri', tip: 'GELIR' },
        ],
      });

      // Açık dönem olmadan hiçbir fiş kesilemez.
      await tx.muhasebeDonemi.create({
        data: {
          id: randomUUID(), tenantId: T, maliYil: YIL, ad: `${YIL} Mali Yılı`,
          baslangic: new Date(`${YIL}-01-01`), bitis: new Date(`${YIL}-12-31`),
          durum: 'ACIK',
        },
      });

      const kisiId = randomUUID();
      await tx.kisi.create({ data: { id: kisiId, tenantId: T, ad: 'CT25', soyad: 'Yönetim' } });
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

  // --- (a) ARA HESAP YASAĞI -------------------------------------------------

  it('(1) ★ ARA hesaba fiş satırı yazılamaz — açık hata, sessiz kabul değil', async () => {
    const y = await fisYaz([
      { hesapId: H_ARA, borc: '1000.00' },
      { hesapId: H_GELIR, alacak: '1000.00' },
    ]);

    expect(
      y.status,
      `ara hesaba fiş kabul edildi: ${JSON.stringify(y.body).slice(0, 200)}`,
    ).toBe(422);
    const g = y.body as Hata;
    // Mesaj SEBEBİ söylemeli ve çıkış yolunu göstermeli.
    expect(g.detail ?? '').toMatch(/fis kesilemez|fiş kesilemez/i);
    expect(g.sonrakiEylem ?? '').toMatch(/alt hesap/i);
  });

  it('(2) ara hesap ALACAK tarafında da reddedilir — yön farkı yok', async () => {
    /*
     * Kontrol satır satır çalışmalıdır. Yalnızca borç tarafı denetlenseydi,
     * alacak tarafına yazılan tutar sessizce geçerdi ve mizan yine çift
     * sayardı.
     */
    const y = await fisYaz([
      { hesapId: H_KASA, borc: '1000.00' },
      { hesapId: H_ARA, alacak: '1000.00' },
    ]);
    expect(y.status).toBe(422);
  });

  it('(3) reddedilen fiş HİÇBİR kayıt bırakmaz', async () => {
    const fisSayisi = await baglamda((tx) => tx.yevmiyeFisi.count({ where: { tenantId: T } }));
    expect(fisSayisi, 'reddedilen denemeler fiş yazmış').toBe(0);
  });

  it('(4) ★ ALT hesaba fiş yazılabilir — yasak meşru yolu kapatmıyor', async () => {
    /*
     * Yasağı yazarken bütün ağacı kapatmak kolaydır. `100` bir ARA hesabın
     * altındadır ama kendisi yaprak hesaptır; fiş oraya yazılır.
     */
    const y = await fisYaz([
      { hesapId: H_KASA, borc: '1000.00' },
      { hesapId: H_GELIR, alacak: '1000.00' },
    ]);
    expect(y.status, JSON.stringify(y.body).slice(0, 200)).toBe(201);

    /*
     * ⚠️  FİŞ İŞLENMEDEN MİZANA GİRMEZ ve bu ölçülerek öğrenildi: işlenmemiş
     *     fişle çekilen mizan BOŞ dönüyordu. `POST /fisler` TASLAK üretir;
     *     `taslakMizanaGirer` parametresi varsayılan `false`'tur — taslak
     *     bir kayıt mali tabloya girmemelidir.
     *
     *     Bu adım atlanırsa aşağıdaki denklik testleri 0 = 0 karşılaştırıp
     *     YEŞİL görünür ve hiçbir şey ölçmemiş olur. Test (5)'teki (0)
     *     guard'ı tam olarak bunun için var.
     */
    const fisId = (y.body as { id: string }).id;
    const isle = await request(sunucu())
      .patch(`/api/v1/muhasebe/fisler/${fisId}/isle`)
      .set('Authorization', `Bearer ${jeton}`)
      .set('Idempotency-Key', randomUUID())
      .send({});
    expect(isle.status, `fiş işlenemedi: ${JSON.stringify(isle.body).slice(0, 200)}`).toBe(200);
  });

  // --- (b) MİZAN DENKLİĞİ ---------------------------------------------------

  it('(5) ★ MİZAN DENKTİR — borç toplamı = alacak toplamı', async () => {
    /*
     * Defterin en basit bütünlük kontrolü. `denkMi` hesaplanıyor ve yanıtta
     * dönüyordu ama hiçbir test ölçmüyordu: yanlış hesaplansa kimse
     * görmezdi.
     */
    const y = await request(sunucu())
      .get(`/api/v1/muhasebe/dokumler/mizan?${ARALIK}`)
      .set('Authorization', `Bearer ${jeton}`);
    expect(y.status).toBe(200);

    const m = y.body as MizanDokumu;

    // (0) GUARD — mizan BOŞSA denklik anlamsızdır: 0 = 0 her zaman denktir
    //     ve test hiçbir şey ölçmemiş olur.
    expect(m.satirlar.length, 'mizan boş — denklik iddiası anlamsız').toBeGreaterThan(0);
    expect(Number(m.borcToplam), 'mizan sıfır hareketli').toBeGreaterThan(0);

    expect(m.borcToplam).toBe(m.alacakToplam);
    expect(m.denkMi, `borç ${m.borcToplam} ≠ alacak ${m.alacakToplam}`).toBe(true);
  });

  it('(6) BAKİYE toplamları da denktir — toplam sıfır', async () => {
    /*
     * Hareket toplamının denk olması yetmez: bakiyeler de denk olmalıdır.
     * Tek kolonlu (işaretli) mizan gösteriminde bu, "tüm hesapların
     * toplamı = 0,00" kuralının aynısıdır.
     */
    const y = await request(sunucu())
      .get(`/api/v1/muhasebe/dokumler/mizan?${ARALIK}`)
      .set('Authorization', `Bearer ${jeton}`);
    const m = y.body as MizanDokumu;
    expect(m.borcBakiyeToplam).toBe(m.alacakBakiyeToplam);
  });

  it('(7) ★ ÇİFT SAYIM YOK — tutar yalnızca YAPRAK hesapta durur', async () => {
    /*
     * ASIL RİSK BUDUR: üst hesaba yazılan tutar hem kendisinde hem alt
     * hesaplar toplamında sayılırsa mizan iki katına çıkar.
     *
     * ⚠️  ÖLÇÜLEREK ÖĞRENİLDİ: mizan YALNIZCA HAREKET GÖRMÜŞ hesapları
     *     listeler; toplayıcı hesap dökümde HİÇ YER ALMAZ. Bu test önce
     *     "ara hesap görünür ama sıfırdır" diye yazılmıştı — o bir
     *     VARSAYIMDI ve çürüdü. Ürün davranışı doğrudur ve daha güvenlidir:
     *     hiç yazılmayan satır yanlışlıkla toplanamaz.
     *
     *     Bu yüzden iddia "görünür" değil, "HAREKET TAŞIMAZ" biçiminde
     *     kuruldu: satır varsa sıfır olmalı, yoksa zaten sorun yok.
     */
    const y = await request(sunucu())
      .get(`/api/v1/muhasebe/dokumler/mizan?${ARALIK}`)
      .set('Authorization', `Bearer ${jeton}`);
    const m = y.body as MizanDokumu;

    const ara = m.satirlar.find((s) => s.kod === '10');
    expect(Number(ara?.borcToplam ?? '0'), 'ARA hesap hareket taşıyor').toBe(0);

    // Tutarın tamamı yaprak hesapta olmalı — ne eksik ne fazla.
    const kasa = m.satirlar.find((s) => s.kod === '100');
    expect(kasa, 'yaprak hesap mizanda yok').toBeDefined();
    expect(Number(kasa?.borcToplam ?? '0')).toBe(1000);

    // ★ ÇİFT SAYIM KONTROLÜ: mizanın borç toplamı tek bir fişin tutarıdır.
    //   Ara hesap da sayılsaydı bu 2000 olurdu.
    expect(Number(m.borcToplam), 'mizan çift sayıyor').toBe(1000);
  });
});
