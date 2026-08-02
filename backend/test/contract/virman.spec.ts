/**
 * CT-19 · VİRMAN — mevcut borcun doğru kişiye aktarılması
 *
 * ⚠️  TANIM (ADR-0016 §C): virman mevcut borcu İPTAL ETMEK için değil,
 *     DOĞRU KİŞİYE AKTARMAK için yapılan muhasebe işlemidir. Toplam borç
 *     DEĞİŞMEZ; değişen yalnızca borcun muhatabıdır.
 *
 *     Bu tanım kritiktir: virmanı bir düzeltme/iptal aracı sanmak yaygın bir
 *     hatadır ve model tasarımını yanlış yöne götürür. Testler bu yüzden
 *     `borc.tutar`, `vadeTarihi` ve `calismaId`'nin DEĞİŞMEDİĞİNİ de ölçer —
 *     yalnızca payların değiştiğini değil.
 *
 * ⚠️  İKİ TARAF AYNI TRANSACTION'DA: yevmiye fişi ve `borc_sorumlusu` payları
 *     birlikte yazılır. Biri yazılıp öteki yazılmazsa defter ile cari KALICI
 *     olarak ayrışır — bu risk tahsilat tarafında zaten kayıtlıdır
 *     (`tahsilat.command.service.ts:292`).
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

const SIFRE_HASH =
  'scrypt$131072$8$1$06dAft8lIJHsbeHFYucc8Q==$9GdovR26bdPFcpXtV96jbzSTjTcywpYL' +
  '/6gx4argmiuioNYMtEfo9FApnPK7FopBCy1xw+IJn78EIwJ+SJ0qiA==';

interface GirisYaniti { readonly accessToken: string }

const TENANT = randomUUID();
const BOLUM = randomUUID();
const KISI = {
  yonetici: randomUUID(),
  denetci: randomUUID(),
  eskiKiraci: randomUUID(),
  yeniKiraci: randomUUID(),
  malik: randomUUID(),
};
const EPOSTA = {
  yonetici: `ct19-yonetici@${TENANT.slice(0, 8)}.test`,
  denetci: `ct19-denetci@${TENANT.slice(0, 8)}.test`,
};
const HESAP = { kasa: randomUUID(), alacak: randomUUID(), gider: randomUUID() };

/** Taşınma senaryosunun borcu: 500 TL, tek sorumlu (eski kiracı). */
const CALISMA = randomUUID();
const BORC = randomUUID();
const SORUMLU_ESKI = randomUUID();
const DONEM = '2026-08-01';
const VADE = '2026-08-31';

function baglamda<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    for (const a of ['app.kapsam_kisi_id', 'app.kapsam_bolumler', 'app.kapsam_mulk_bolumler']) {
      await tx.$executeRawUnsafe(`SELECT set_config('${a}', '', true)`);
    }
    return fn(tx);
  });
}

describe('CT-19 · Virman', () => {
  let app: INestApplication;
  let jeton: string;
  let denetciJetonu: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  /** Geçerli bir taşınma virmanı gövdesi; testler alanlarını bozarak kullanır. */
  const gecerliGovde = (): Record<string, unknown> => ({
    tur: 'CARI',
    sebepKodu: 'YANLIS_DAIRE_DUZELTMESI',
    tarih: '2026-08-20',
    aciklama: 'Kiracı 15 Ağustos\'ta taşındı; aidat payı bölündü.',
    satirlar: [
      { hesapId: HESAP.alacak, bolumId: BOLUM, borc: '250.00', alacak: '0.00' },
      { hesapId: HESAP.gider, bolumId: BOLUM, borc: '0.00', alacak: '250.00' },
    ],
    paylar: [
      { borcId: BORC, kisiId: KISI.eskiKiraci, sira: 'ASIL', pay: '250.00' },
      { borcId: BORC, kisiId: KISI.yeniKiraci, sira: 'ASIL', pay: '250.00' },
    ],
  });

  const virmanKur = (govde: Record<string, unknown>, jetonu = jeton) =>
    request(sunucu())
      .post('/api/v1/virman')
      .set('Authorization', `Bearer ${jetonu}`)
      .set('Idempotency-Key', randomUUID())
      .send(govde);

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct19-${TENANT.slice(0, 8)}`, ad: 'CT-19 Test Sitesi',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      const apartmanId = randomUUID();
      const blokId = randomUUID();
      const katId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: TENANT, ad: 'A' } });
      await tx.blok.create({ data: { id: blokId, tenantId: TENANT, apartmanId, ad: 'A' } });
      await tx.kat.create({ data: { id: katId, tenantId: TENANT, blokId, no: 1 } });
      await tx.bagimsizBolum.create({
        data: {
          id: BOLUM, tenantId: TENANT, blokId, katId, kapiNo: '1', kat: 1,
          nitelik: 'MESKEN', brutM2: 100, netM2: 85,
          arsaPayiPay: 1_000_000n, arsaPayiPayda: 1_000_000n,
        },
      });

      await tx.kisi.createMany({
        data: [
          { id: KISI.yonetici, tenantId: TENANT, ad: 'Yön', soyad: 'Etici', eposta: EPOSTA.yonetici },
          { id: KISI.denetci, tenantId: TENANT, ad: 'Denet', soyad: 'Çi', eposta: EPOSTA.denetci },
          { id: KISI.eskiKiraci, tenantId: TENANT, ad: 'Eski', soyad: 'Kiracı' },
          { id: KISI.yeniKiraci, tenantId: TENANT, ad: 'Yeni', soyad: 'Kiracı' },
          { id: KISI.malik, tenantId: TENANT, ad: 'Daire', soyad: 'Maliki' },
        ],
      });

      await tx.malik.create({
        data: {
          id: randomUUID(), tenantId: TENANT, bolumId: BOLUM, kisiId: KISI.malik,
          hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
          tapuBaslangic: new Date('2024-01-01'),
        },
      });

      await tx.hesap.createMany({
        data: [
          { id: HESAP.kasa, tenantId: TENANT, kod: '100', ad: 'Kasa', tip: 'VARLIK' },
          { id: HESAP.alacak, tenantId: TENANT, kod: '120', ad: 'Alacaklar', tip: 'VARLIK' },
          { id: HESAP.gider, tenantId: TENANT, kod: '770', ad: 'Giderler', tip: 'GIDER' },
        ],
      });

      await tx.giderTuru.create({
        data: {
          id: randomUUID(), tenantId: TENANT, kod: 'CT19_AIDAT', ad: 'Aidat',
          paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
          kuralKaynagi: 'KMK_VARSAYILAN', aktifMi: true, tahakkukSikligi: 'DONEMSEL',
          // ZORUNLU (ADR-0017 · K1): tahakkuk fişinin alacak tarafı.
          muhasebeHesapId: HESAP.gider,
        },
      });

      // TAŞINMA SENARYOSUNUN BAŞLANGIÇ DURUMU: 500 TL borç, tek sorumlu.
      await tx.tahakkukCalismasi.create({
        data: {
          id: CALISMA, tenantId: TENANT, giderTuruKodu: 'CT19_AIDAT',
          donem: new Date(DONEM), tip: 'ASIL', sira: 1,
          toplamTutar: 500, bolumSayisi: 1,
          // Dağıtım snapshot'ı ZORUNLU (ADR-0017 · K7a).
          kullanilanPaylasimKurali: 'ESIT', paylasimKuraliEzildi: false,
        },
      });
      await tx.borc.create({
        data: {
          id: BORC, tenantId: TENANT, bolumId: BOLUM, calismaId: CALISMA,
          giderTuruKodu: 'CT19_AIDAT', tahakkukNo: 'THK-2026-000001',
          tutar: 500, odenen: 0,
          vadeTarihi: new Date(VADE), tahakkukDonemi: new Date(DONEM),
        },
      });
      await tx.borcSorumlusu.create({
        data: {
          id: SORUMLU_ESKI, tenantId: TENANT, borcId: BORC, kisiId: KISI.eskiKiraci,
          sira: 'ASIL', rol: 'KIRACI', cozumlemeTarihi: new Date(DONEM),
          pay: 500, agirlik: 1n,
        },
      });

      for (const [kisiId, eposta, rol] of [
        [KISI.yonetici, EPOSTA.yonetici, 'APARTMAN_YONETICISI'],
        [KISI.denetci, EPOSTA.denetci, 'DENETCI'],
      ] as const) {
        await tx.kullanici.create({
          data: {
            id: randomUUID(), tenantId: TENANT, kisiId, eposta,
            sifreHash: SIFRE_HASH, aktif: true,
            roller: { create: { id: randomUUID(), tenantId: TENANT, rolKodu: rol } },
          },
        });
      }
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const giris = async (eposta: string): Promise<string> => {
      const y = await request(sunucu())
        .post('/api/v1/oturum/giris').send({ eposta, sifre: 'bnos1234' });
      if (y.status >= 300) throw new Error(`Giriş başarısız: ${y.status}`);
      return (y.body as GirisYaniti).accessToken;
    };
    jeton = await giris(EPOSTA.yonetici);
    denetciJetonu = await giris(EPOSTA.denetci);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  // --- DOĞRULAMA KURALLARI ----------------------------------------------

  it('(1) borç ≠ alacak → reddedilir', async () => {
    const g = gecerliGovde();
    (g['satirlar'] as Record<string, unknown>[])[1]!['alacak'] = '240.00';
    const y = await virmanKur(g);
    expect(y.status).toBe(422);
  });

  it('(2) tek satır → reddedilir (çift kayıt)', async () => {
    const g = gecerliGovde();
    g['satirlar'] = [(g['satirlar'] as unknown[])[0]];
    expect((await virmanKur(g)).status).toBe(422);
  });

  it('(3) aynı satırda hem borç hem alacak → reddedilir', async () => {
    const g = gecerliGovde();
    (g['satirlar'] as Record<string, unknown>[])[0]!['alacak'] = '250.00';
    expect((await virmanKur(g)).status).toBe(422);
  });

  it('(4) sıfır tutarlı satır → reddedilir', async () => {
    const g = gecerliGovde();
    g['satirlar'] = [
      { hesapId: HESAP.alacak, bolumId: BOLUM, borc: '0.00', alacak: '0.00' },
      { hesapId: HESAP.gider, bolumId: BOLUM, borc: '0.00', alacak: '0.00' },
    ];
    expect((await virmanKur(g)).status).toBe(422);
  });

  it('(5) aynı hesap hem borç hem alacak tarafında → reddedilir', async () => {
    /*
     * Genel mahsup fişinde bu MEŞRUDUR (`fisiDogrula` yalnızca aynı yönde
     * tekrarı yasaklar). Virmanda anlamsızdır: A'dan A'ya para taşınmaz.
     * Kural bu yüzden virmana ÖZELDİR, `fisiDogrula` değişmez.
     */
    const g = gecerliGovde();
    (g['satirlar'] as Record<string, unknown>[])[1]!['hesapId'] = HESAP.alacak;
    expect((await virmanKur(g)).status).toBe(422);
  });

  it('(6) açıklama BOŞ → reddedilir (boş bırakılabilen zorunlu alan zorunlu değildir)', async () => {
    const g = gecerliGovde();
    g['aciklama'] = '   ';
    expect((await virmanKur(g)).status).toBe(422);
  });

  it('(7) kapalı döneme virman → reddedilir', async () => {
    const donemId = randomUUID();
    await baglamda((tx) => tx.muhasebeDonemi.create({
      data: {
        id: donemId, tenantId: TENANT, maliYil: 2025, ad: '2025',
        baslangic: new Date('2025-01-01'), bitis: new Date('2025-12-31'),
        durum: 'KAPALI',
      },
    }));
    const g = gecerliGovde();
    g['tarih'] = '2025-06-15';
    expect((await virmanKur(g)).status).toBe(422);
  });

  it('(8) DENETCI virman yapamaz → 403', async () => {
    expect((await virmanKur(gecerliGovde(), denetciJetonu)).status).toBe(403);
  });

  it('(9) ★ ödenenin ALTINA pay indirimi → domain hatası (ham CHECK ihlali DEĞİL)', async () => {
    /*
     * Kiracı 300 ödemişse payı 250'ye indirilemez. Veritabanı kısıtı
     * (`odenen <= pay`) bunu zaten yakalar ama ham bir CHECK ihlali kullanıcıya
     * hiçbir şey anlatmaz. Domain katmanı ÖNCE yakalamalı ve çıkış yolunu
     * göstermeli.
     */
    await baglamda((tx) => tx.borcSorumlusu.update({
      where: { id: SORUMLU_ESKI }, data: { odenen: 300 },
    }));

    const y = await virmanKur(gecerliGovde());
    expect(y.status).toBe(422);
    const govde = y.body as { detail?: string };
    expect(govde.detail).toMatch(/300/);          // ödediği tutar söylenmeli
    expect(govde.detail).toMatch(/tahsis|iade/i); // çıkış yolu gösterilmeli
    expect(govde.detail).not.toMatch(/CHECK|constraint|violates/i);

    await baglamda((tx) => tx.borcSorumlusu.update({
      where: { id: SORUMLU_ESKI }, data: { odenen: 0 },
    }));
  });

  it('(10) ★ Σ pay ≠ borc.tutar bırakan virman → reddedilir', async () => {
    const g = gecerliGovde();
    (g['paylar'] as Record<string, unknown>[])[1]!['pay'] = '200.00'; // 250+200=450 ≠ 500
    const y = await virmanKur(g);
    expect(y.status).toBe(422);

    const toplam = await baglamda((tx) => tx.borcSorumlusu.aggregate({
      where: { borcId: BORC }, _sum: { pay: true },
    }));
    expect(Number(toplam._sum.pay)).toBe(500);
  });

  // --- BAŞARILI TAŞINMA SENARYOSU ---------------------------------------

  it('(11) ★ TAŞINMA: 500 TL borç 250/250 bölünür, BORÇ DEĞİŞMEZ', async () => {
    const y = await virmanKur(gecerliGovde());
    expect(y.status).toBe(201);

    const borc = await baglamda((tx) => tx.borc.findFirstOrThrow({ where: { id: BORC } }));
    // ★ TANIM GEREĞİ: virman borcu iptal etmez, muhatabını değiştirir.
    expect(Number(borc.tutar)).toBe(500);
    expect(borc.calismaId).toBe(CALISMA);
    expect(borc.vadeTarihi.toISOString().slice(0, 10)).toBe(VADE);
  });

  it('(12) ★ paylar: eski 250, yeni 250 — Σ pay = 500', async () => {
    const paylar = await baglamda((tx) => tx.borcSorumlusu.findMany({
      where: { borcId: BORC }, orderBy: { pay: 'asc' },
    }));
    expect(paylar).toHaveLength(2);
    expect(paylar.reduce((t, p) => t + Number(p.pay), 0)).toBe(500);
    const eski = paylar.find((p) => p.kisiId === KISI.eskiKiraci);
    const yeni = paylar.find((p) => p.kisiId === KISI.yeniKiraci);
    expect(Number(eski?.pay)).toBe(250);
    expect(Number(yeni?.pay)).toBe(250);
  });

  it('(13) ★ sira: taşınmada İKİSİ DE ASIL — kendi dönemlerinden doğrudan sorumlular', async () => {
    /*
     * ASIL    = bu kişiden istenir
     * IKINCIL = asıldan alınamazsa istenir
     *
     * Taşınmada iki kiracı da KENDİ oturduğu dönemden doğrudan sorumludur;
     * biri ötekinin kefili değildir. IKINCIL yazılsaydı tahsilat ve icra
     * yanlış sıra izlerdi. Malikin KMK md. 22 müteselsil sorumluluğu AYRI
     * bir satırdır ve bu virmanın konusu değildir.
     */
    const paylar = await baglamda((tx) => tx.borcSorumlusu.findMany({ where: { borcId: BORC } }));
    for (const p of paylar) expect(p.sira).toBe('ASIL');
  });

  it('(14) ★ eski sorumlunun cozumlemeTarihi DEĞİŞMEZ', async () => {
    /*
     * `cozumlemeTarihi` orijinal çözümlemenin tarihidir — virmanın tarihi
     * virman kaydında durur. Üzerine yazılsaydı borcun ne zaman kime
     * bağlandığı geçmişi kaybolurdu.
     */
    const eski = await baglamda((tx) => tx.borcSorumlusu.findFirstOrThrow({
      where: { borcId: BORC, kisiId: KISI.eskiKiraci },
    }));
    expect(eski.cozumlemeTarihi.toISOString().slice(0, 10)).toBe(DONEM);
  });

  it('(15) ★ TEK yevmiye fişi üretilmiş ve DENK', async () => {
    const fisler = await baglamda((tx) => tx.yevmiyeFisi.findMany({
      where: { tenantId: TENANT, kaynakTipi: 'VIRMAN' },
      include: { satirlar: true },
    }));
    expect(fisler).toHaveLength(1);
    const satirlar = fisler[0]!.satirlar;
    const borcT = satirlar.reduce((t, s) => t + Number(s.borc), 0);
    const alacakT = satirlar.reduce((t, s) => t + Number(s.alacak), 0);
    expect(borcT).toBe(alacakT);
    expect(borcT).toBe(250);
  });

  it('(16) ★ denetim kaydı yazılmış', async () => {
    const kayit = await baglamda((tx) => tx.auditKaydi.findFirst({
      where: { tenantId: TENANT, varlik: 'Virman' },
    }));
    expect(kayit).not.toBeNull();
  });

  it('(17) ★ ATOMİKLİK: fiş yazılıp cari yazılmazsa İKİSİ DE geri alınır', async () => {
    /*
     * Var olmayan bir kişiye pay yazılmak istenir: yevmiye tarafı geçerli,
     * cari tarafı FK ihlali verir. Fiş yazılıp cari yazılmadan kalırsa
     * defter ile cari KALICI olarak ayrışır.
     */
    const oncekiFis = await baglamda((tx) => tx.yevmiyeFisi.count({ where: { tenantId: TENANT } }));

    const g = gecerliGovde();
    (g['paylar'] as Record<string, unknown>[])[1]!['kisiId'] = randomUUID(); // yok
    const y = await virmanKur(g);
    expect(y.status).toBeGreaterThanOrEqual(400);

    const sonrakiFis = await baglamda((tx) => tx.yevmiyeFisi.count({ where: { tenantId: TENANT } }));
    expect(sonrakiFis).toBe(oncekiFis);
  });
});
