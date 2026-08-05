/**
 * CT-26 · TAHSİS — sıra belirliliği, üst sınır ve denge
 *
 * ⚠️  NEDEN VAR: tahsilat ekranının görsel denetiminde çıktı. Üç kuralın
 *     üçü de motorda vardı ama HİÇBİRİNİN TESTİ YOKTU; biri (sıra) ise
 *     gerçekten bozuktu.
 *
 *   (1) SIRA BELİRSİZDİ. Öneri `orderBy: [{ vadeTarihi: 'asc' }]` ile tek
 *       anahtar kullanıyordu. Tohumda üç kalemin de vadesi aynı gün
 *       (`2026-07-31`) ve eşitlikte sıra veritabanına kalıyordu: aynı
 *       istek iki çağrıda farklı sırada dönebilir, dolayısıyla öneri
 *       SINANAMAZDI. Belirsiz çıktı, yanlış çıktıdan daha az görünür ama
 *       daha zor yakalanır.
 *
 *   (2) ÜST SINIR — bir borca kalanından fazlası tahsis edilemez. Arayüz
 *       de engelliyor ama arayüz KORUMA DEĞİLDİR.
 *
 *   (3) DENGE — tahsis toplamı tahsilat tutarına EŞİT olmalı. Eksik
 *       tahsis, paranın bir kısmının hiçbir borca sayılmaması demektir:
 *       kasada duran ama defterde olmayan para.
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
const EPOSTA = `ct26@${T.slice(0, 8)}.test`;
const BOLUM = randomUUID();
const KISI = randomUUID();
const HESAP = randomUUID();

/** ★ ÜÇÜ DE AYNI VADE — eşitlik bozucu kural tam olarak burada sınanır. */
const VADE = '2026-07-31';
const KALEMLER = [
  { kod: 'CT26_AIDAT', tutar: 1_000 },
  { kod: 'CT26_ELEKTRIK', tutar: 300 },
  { kod: 'CT26_TEMIZLIK', tutar: 250 },
] as const;

interface GirisYaniti { readonly accessToken: string }
interface Hata { readonly detail?: string; readonly sonrakiEylem?: string }
interface Oneri {
  readonly tahsisler: readonly { readonly borcId: string; readonly tutar: string }[];
  readonly kalan: string;
}
interface AcikBorc {
  readonly borcId: string; readonly borcSorumlusuId: string;
  readonly kalan: string; readonly borcKalemi: string;
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

describe('CT-26 · Tahsis', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;

  const oneriAl = (tutar: string) => request(sunucu())
    .post('/api/v1/makbuzlar/tahsis-onerisi')
    .set('Authorization', `Bearer ${jeton}`)
    .set('Idempotency-Key', randomUUID())
    .send({ tutar, bolumId: BOLUM });

  const makbuz = (govde: Record<string, unknown>) => request(sunucu())
    .post('/api/v1/makbuzlar')
    .set('Authorization', `Bearer ${jeton}`)
    .set('Idempotency-Key', randomUUID())
    .send({ kanal: 'NAKIT', tahsilatTarihi: '2026-08-05', ...govde });

  const borclar = async (): Promise<readonly AcikBorc[]> => {
    const y = await request(sunucu())
      .get(`/api/v1/makbuzlar/borclar/${BOLUM}`)
      .set('Authorization', `Bearer ${jeton}`);
    return y.body as readonly AcikBorc[];
  };

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: T, kod: `ct26-${T.slice(0, 8)}`, ad: 'CT-26 Tahsis',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      const apartmanId = randomUUID();
      const blokId = randomUUID();
      const katId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: T, ad: 'CT-26', adres: '-' } });
      await tx.blok.create({ data: { id: blokId, tenantId: T, apartmanId, ad: 'A' } });
      await tx.kat.create({ data: { id: katId, tenantId: T, blokId, no: 1, ad: '1' } });
      await tx.bagimsizBolum.create({
        data: {
          id: BOLUM, tenantId: T, blokId, katId, kapiNo: '1', kat: 1,
          nitelik: 'MESKEN', brutM2: 100, netM2: 85,
          arsaPayiPay: 1_000_000n, arsaPayiPayda: 1_000_000n,
        },
      });
      await tx.kisi.create({ data: { id: KISI, tenantId: T, ad: 'CT26', soyad: 'Malik' } });
      await tx.hesap.create({
        data: { id: HESAP, tenantId: T, kod: '349', ad: 'Avanslar', tip: 'BORC' },
      });

      for (const k of KALEMLER) {
        await tx.giderTuru.create({
          data: {
            id: randomUUID(), tenantId: T, kod: k.kod, ad: k.kod,
            paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
            kuralKaynagi: 'KMK_VARSAYILAN', tahakkukSikligi: 'DONEMSEL',
            muhasebeHesapId: HESAP,
          },
        });
        const calismaId = randomUUID();
        await tx.tahakkukCalismasi.create({
          data: {
            id: calismaId, tenantId: T, giderTuruKodu: k.kod,
            donem: new Date('2026-07-01'), tip: 'ASIL', sira: 1,
            toplamTutar: k.tutar, bolumSayisi: 1,
            kullanilanPaylasimKurali: 'ESIT', paylasimKuraliEzildi: false,
          },
        });
        const borcId = randomUUID();
        await tx.borc.create({
          data: {
            id: borcId, tenantId: T, bolumId: BOLUM, calismaId,
            giderTuruKodu: k.kod, tahakkukNo: `THK-2026-${k.kod}`,
            tutar: k.tutar, vadeTarihi: new Date(VADE),
            tahakkukDonemi: new Date('2026-07-01'),
          },
        });
        await tx.borcSorumlusu.create({
          data: {
            id: randomUUID(), tenantId: T, borcId, kisiId: KISI,
            sira: 'ASIL', rol: 'MALIK', cozumlemeTarihi: new Date('2026-07-01'),
            pay: k.tutar, agirlik: 1,
          },
        });
      }

      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: T, kisiId: KISI, eposta: EPOSTA,
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

  // --- SIRA BELİRLİLİĞİ -----------------------------------------------------

  it('(0) GUARD — üç borcun da vadesi AYNI', async () => {
    /*
     * Bu guard olmadan aşağıdaki belirlilik testi hiçbir şey ölçmez: vadeler
     * farklıysa sıra zaten `vadeTarihi` ile belirlenir ve eşitlik bozucu
     * kural hiç devreye girmez.
     */
    const b = await borclar();
    expect(b).toHaveLength(KALEMLER.length);
    const vadeler = await baglamda((tx) => tx.borc.findMany({
      where: { tenantId: T }, select: { vadeTarihi: true },
    }));
    expect(new Set(vadeler.map((v) => v.vadeTarihi.toISOString())).size).toBe(1);
  });

  it('(1) ★ AYNI VADEDE öneri sırası BELİRLİDİR — beş çağrı, aynı sıra', async () => {
    const siralar: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const y = await oneriAl('1550.00');
      expect(y.status).toBe(201);
      siralar.push((y.body as Oneri).tahsisler.map((s) => s.borcId).join('>'));
    }
    expect(
      new Set(siralar).size,
      `sıra çağrılar arasında DEĞİŞTİ: ${[...new Set(siralar)].join(' || ')}`,
    ).toBe(1);
  });

  it('(2) öneri tutarın tamamını dağıtır — kalan sıfır', async () => {
    // 1000 + 300 + 250 = 1550
    const y = await oneriAl('1550.00');
    expect(Number((y.body as Oneri).kalan)).toBe(0);
  });

  it('(3) öneri HİÇBİR ŞEY YAZMAZ', async () => {
    const oncesi = await baglamda((tx) => tx.tahsilat.count({ where: { tenantId: T } }));
    await oneriAl('500.00');
    const sonrasi = await baglamda((tx) => tx.tahsilat.count({ where: { tenantId: T } }));
    expect(sonrasi).toBe(oncesi);
  });

  // --- ÜST SINIR VE DENGE ---------------------------------------------------

  it('(4) ★ borca KALANINDAN FAZLA tahsis REDDEDİLİR', async () => {
    const b = await borclar();
    const hedef = b[0]!;
    const y = await makbuz({
      tutar: '99999.00',
      tahsisler: [{
        borcId: hedef.borcId, borcSorumlusuId: hedef.borcSorumlusuId, tutar: '99999.00',
      }],
    });
    expect(y.status).toBe(422);
    const g = y.body as Hata;
    expect(g.detail ?? '').toMatch(/aş|kalan/i);
  });

  it('(5) ★ TAHSİS TOPLAMI tahsilat tutarına eşit değilse REDDEDİLİR', async () => {
    /*
     * Eksik tahsis, paranın bir kısmının hiçbir borca sayılmaması demektir.
     * Ret mesajı FARKI SAYIYLA söylemelidir — "eşit değil" tek başına
     * kullanıcıya ne kadar eksik olduğunu anlatmaz.
     */
    const b = await borclar();
    const hedef = b[0]!;
    const y = await makbuz({
      tutar: '500.00',
      tahsisler: [{
        borcId: hedef.borcId, borcSorumlusuId: hedef.borcSorumlusuId, tutar: '300.00',
      }],
    });
    expect(y.status).toBe(422);
    expect((y.body as Hata).detail ?? '').toMatch(/200/);
  });

  it('(6) reddedilen denemeler HİÇBİR tahsilat yazmamıştır', async () => {
    const sayi = await baglamda((tx) => tx.tahsilat.count({ where: { tenantId: T } }));
    expect(sayi).toBe(0);
  });

  it('(7) ★ GEÇERLİ KISMİ tahsilat yazılır ve `odenen` TÜRETİLİR', async () => {
    const b = await borclar();
    const hedef = b.find((x) => x.borcKalemi === 'CT26_TEMIZLIK')!;
    const y = await makbuz({
      tutar: '100.00',
      tahsisler: [{
        borcId: hedef.borcId, borcSorumlusuId: hedef.borcSorumlusuId, tutar: '100.00',
      }],
    });
    expect(y.status, JSON.stringify(y.body).slice(0, 180)).toBe(201);
    expect((y.body as { makbuzNo: string }).makbuzNo).toMatch(/^MKB-/);

    const sonra = (await borclar()).find((x) => x.borcId === hedef.borcId)!;
    // 250 − 100 = 150 · `odenen` elle yazılmaz, tahsis satırından gelir.
    expect(Number(sonra.kalan)).toBe(150);
  });
});
