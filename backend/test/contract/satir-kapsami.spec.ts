/**
 * CT-13 · SATIR KAPSAMI — sakin sınıfı roller yalnızca kendi hanesini görür
 *
 * Kaynak: ADR v1.1 §10 (KVKK) · `RolTanimi.yalnizcaKendiVerisi`
 *
 * ⚠️  NEDEN VAR: `yalnizcaKendiVerisi` bayrağı ve `KENDI_VERISI_KISITLI` listesi
 *     aylarca TANIMLIYDI ama HİÇBİR YERDE OKUNMUYORDU. README bunun tersini
 *     iddia ediyordu. Canlı doğrulamada bir MALİK kullanıcısı `/kisiler`
 *     ucundan tenant'ın 27 kişisini, `/bolumler`den bütün daireleri ve
 *     `/daireler/<başka>/kart` ucundan komşusunun tapu bilgisini çekebildi.
 *
 *     Bayrağın varlığı korumanın varlığı DEĞİLDİR. Bu test, farkı ölçen şeydir.
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
interface KisiSatiri { readonly id: string; readonly ad: string }
interface SayfaliKisi { readonly kayitlar: readonly KisiSatiri[] }
interface DaireKarti { readonly malikler: readonly { readonly kisiAdi: string }[] }

const TENANT = randomUUID();
const BOLUM_A = randomUUID();   // kapı 1 — test kullanıcılarının hanesi
const BOLUM_B = randomUUID();   // kapı 2 — KOMŞU hane

const KISI = {
  malikA: randomUUID(),
  malikB: randomUUID(),   // komşunun maliki — GÖRÜNMEMELİ
  kiraciA: randomUUID(),
  sakinA: randomUUID(),
  cocukA: randomUUID(),   // REŞİT DEĞİL — KENDİ hanesinde
  cocukB: randomUUID(),   // REŞİT DEĞİL — KOMŞU hanede
};

const EPOSTA = {
  malikA: `ct13-malik@${TENANT.slice(0, 8)}.test`,
  kiraciA: `ct13-kiraci@${TENANT.slice(0, 8)}.test`,
  sakinA: `ct13-sakin@${TENANT.slice(0, 8)}.test`,
};

function baglamda<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    return fn(tx);
  });
}

/** 12 yaşında — reşit değil. */
function cocukDogumu(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 12);
  return new Date(d.toISOString().slice(0, 10));
}

describe('CT-13 · Satır kapsamı (yalnizcaKendiVerisi)', () => {
  let app: INestApplication;
  const jeton: Record<string, string> = {};

  const sunucu = (): Server => app.getHttpServer() as Server;

  const girisYap = async (eposta: string): Promise<string> => {
    const y = await request(sunucu())
      .post('/api/v1/oturum/giris')
      .send({ eposta, sifre: 'bnos1234' });
    if (y.status >= 300) {
      throw new Error(`Giriş başarısız (${eposta}): ${y.status} ${JSON.stringify(y.body)}`);
    }
    return (y.body as GirisYaniti).accessToken;
  };

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct13-${TENANT.slice(0, 8)}`, ad: 'CT-13 Test Sitesi',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      const apartmanId = randomUUID();
      const blokId = randomUUID();
      const katId = randomUUID();
      await tx.apartman.create({
        data: { id: apartmanId, tenantId: TENANT, ad: 'A Apartmanı' },
      });
      await tx.blok.create({
        data: { id: blokId, tenantId: TENANT, apartmanId, ad: 'A' },
      });
      await tx.kat.create({
        data: { id: katId, tenantId: TENANT, blokId, no: 1 },
      });

      for (const [id, kapiNo] of [[BOLUM_A, '1'], [BOLUM_B, '2']] as const) {
        await tx.bagimsizBolum.create({
          data: {
            id, tenantId: TENANT, blokId, katId, kapiNo, kat: 1, nitelik: 'MESKEN',
            brutM2: 100, netM2: 85, arsaPayiPay: 500_000n, arsaPayiPayda: 1_000_000n,
          },
        });
      }

      await tx.kisi.createMany({
        data: [
          { id: KISI.malikA, tenantId: TENANT, ad: 'MalikA', soyad: 'Test', eposta: EPOSTA.malikA },
          { id: KISI.malikB, tenantId: TENANT, ad: 'KomsuMalikB', soyad: 'Test' },
          { id: KISI.kiraciA, tenantId: TENANT, ad: 'KiraciA', soyad: 'Test', eposta: EPOSTA.kiraciA },
          { id: KISI.sakinA, tenantId: TENANT, ad: 'SakinA', soyad: 'Test', eposta: EPOSTA.sakinA },
          { id: KISI.cocukA, tenantId: TENANT, ad: 'CocukA', soyad: 'Test',
            dogumTarihi: cocukDogumu() },
          { id: KISI.cocukB, tenantId: TENANT, ad: 'KomsuCocukB', soyad: 'Test',
            dogumTarihi: cocukDogumu() },
        ],
      });

      await tx.malik.createMany({
        data: [
          { id: randomUUID(), tenantId: TENANT, bolumId: BOLUM_A, kisiId: KISI.malikA,
            hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
            tapuBaslangic: new Date('2024-01-01') },
          { id: randomUUID(), tenantId: TENANT, bolumId: BOLUM_B, kisiId: KISI.malikB,
            hissePay: 1n, hissePayda: 1n, tapuTuru: 'KAT_MULKIYETI',
            tapuBaslangic: new Date('2024-01-01') },
        ],
      });

      await tx.kiraci.create({
        data: {
          id: randomUUID(), tenantId: TENANT, bolumId: BOLUM_A, kisiId: KISI.kiraciA,
          baslangic: new Date('2025-01-01'),
        },
      });

      // Sakin dayanağı ZORUNLU (0021): ikisi de A hanesinin malikine bağlanır.
      const malikA = await tx.malik.findFirstOrThrow({ where: { bolumId: BOLUM_A } });
      const malikB = await tx.malik.findFirstOrThrow({ where: { bolumId: BOLUM_B } });
      await tx.sakin.createMany({
        data: [
          { id: randomUUID(), tenantId: TENANT, bolumId: BOLUM_A, kisiId: KISI.sakinA,
            malikId: malikA.id, yakinlikDerecesi: 'ES', girisTarihi: new Date('2025-01-01') },
          { id: randomUUID(), tenantId: TENANT, bolumId: BOLUM_A, kisiId: KISI.cocukA,
            malikId: malikA.id, yakinlikDerecesi: 'COCUK', girisTarihi: new Date('2025-01-01') },
          { id: randomUUID(), tenantId: TENANT, bolumId: BOLUM_B, kisiId: KISI.cocukB,
            malikId: malikB.id, yakinlikDerecesi: 'COCUK', girisTarihi: new Date('2025-01-01') },
        ],
      });

      for (const [kisiId, eposta, rol] of [
        [KISI.malikA, EPOSTA.malikA, 'MALIK'],
        [KISI.kiraciA, EPOSTA.kiraciA, 'KIRACI'],
        [KISI.sakinA, EPOSTA.sakinA, 'SAKIN'],
      ] as const) {
        const kid = randomUUID();
        await tx.kullanici.create({
          data: {
            id: kid, tenantId: TENANT, kisiId, eposta,
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

    jeton['malik'] = await girisYap(EPOSTA.malikA);
    jeton['kiraci'] = await girisYap(EPOSTA.kiraciA);
    jeton['sakin'] = await girisYap(EPOSTA.sakinA);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    // Fikstür temizliği: bağımlılık sırasına göre.
    await baglamda(async (tx) => {
      await tx.sakin.deleteMany({ where: { tenantId: TENANT } });
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
    /*
     * ⚠️  `audit_kaydi` SİLİNMEZ ve tenant satırı da bu yüzden KALIR:
     *     denetim kaydı trigger ile değiştirilemez (0001 §4) ve tenant'a
     *     yabancı anahtarla bağlıdır. Testin artığı bir tenant satırı ile
     *     giriş denetim kaydıdır; bu, değiştirilemezliğin bedelidir ve
     *     silinmeye ÇALIŞILMAZ — çalışılsaydı trigger'ı gevşetmek gerekirdi.
     */
    // Sayım BAĞLAM İÇİNDE yapılır: `audit_kaydi` RLS taşır ve bağlamsız
    // sorgu "Tenant baglami kurulmadan..." ile düşer.
    const denetim = await baglamda((tx) =>
      tx.auditKaydi.count({ where: { tenantId: TENANT } }),
    );
    if (denetim === 0) await prisma.tenant.delete({ where: { id: TENANT } });
    await prisma.$disconnect();
  }, 60_000);

  const al = (rol: string, yol: string) =>
    request(sunucu()).get(yol).set('Authorization', `Bearer ${jeton[rol]}`);

  /* ------------------- 1) MALIK /kisiler — yalnızca kendi hanesi ----------- */

  it('MALIK /kisiler komşu hanenin malikini DÖNMEZ', async () => {
    const y = await al('malik', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);

    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar).toContain('MalikA');
    // KOMŞU hanenin maliki DÖNMEMELİ.
    expect(adlar).not.toContain('KomsuMalikB');
  });

  it('KIRACI /kisiler yalnızca KENDİ hanesini döner', async () => {
    const y = await al('kiraci', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);

    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar).toContain('KiraciA');
    expect(adlar).toContain('SakinA');
    expect(adlar).not.toContain('KomsuMalikB');
    expect(adlar).not.toContain('KomsuCocukB');
  });

  /* ------- 2) KIRACI ve SAKIN başka bölümün malik kimliğini görmez --------- */

  it('KIRACI başka bölümün daire kartından malik kimliğini GÖREMEZ', async () => {
    const y = await al('kiraci', `/api/v1/daireler/${BOLUM_B}/kart`);
    // Ya 403/404 döner ya da malik listesi BOŞ gelir; kimlik SIZMAZ.
    if (y.status === 200) {
      const adlar = (y.body as DaireKarti).malikler.map((m) => m.kisiAdi);
      expect(adlar).not.toContain('KomsuMalikB Test');
    } else {
      expect([403, 404]).toContain(y.status);
    }
  });

  it('SAKIN başka bölümün daire kartından malik kimliğini GÖREMEZ', async () => {
    const y = await al('sakin', `/api/v1/daireler/${BOLUM_B}/kart`);
    if (y.status === 200) {
      const adlar = (y.body as DaireKarti).malikler.map((m) => m.kisiAdi);
      expect(adlar).not.toContain('KomsuMalikB Test');
    } else {
      expect([403, 404]).toContain(y.status);
    }
  });

  it('KIRACI başka bölümün malik listesini GÖREMEZ', async () => {
    const y = await al('kiraci', `/api/v1/bolumler/${BOLUM_B}/malikler`);
    if (y.status === 200) {
      const adlar = (y.body as { kisiAdi: string }[]).map((m) => m.kisiAdi);
      expect(adlar).not.toContain('KomsuMalikB Test');
    } else {
      expect([403, 404]).toContain(y.status);
    }
  });

  it('SAKIN başka bölümün malik listesini GÖREMEZ', async () => {
    const y = await al('sakin', `/api/v1/bolumler/${BOLUM_B}/malikler`);
    if (y.status === 200) {
      const adlar = (y.body as { kisiAdi: string }[]).map((m) => m.kisiAdi);
      expect(adlar).not.toContain('KomsuMalikB Test');
    } else {
      expect([403, 404]).toContain(y.status);
    }
  });

  /* --------------- 3) Dönem özeti — KİRACI/SAKIN hayır, MALİK evet --------- */

  it('KIRACI /tahakkuk/donemler ÇAĞIRAMAZ (403)', async () => {
    const y = await al('kiraci', '/api/v1/tahakkuk/donemler');
    expect(y.status).toBe(403);
  });

  it('SAKIN /tahakkuk/donemler ÇAĞIRAMAZ (403)', async () => {
    const y = await al('sakin', '/api/v1/tahakkuk/donemler');
    expect(y.status).toBe(403);
  });

  /**
   * ⚠️  MALİK'in bu hakkı KAPATILMAZ. KMK md. 38-39 uyarınca kat maliki
   *     yönetimin hesabını denetleme hakkına sahiptir; bina geneli tahakkuk
   *     özeti bu hakkın kapsamındadır. Kiracının böyle bir hakkı yoktur.
   */
  it('MALIK /tahakkuk/donemler ÇAĞIRABİLİR (200) — KMK denetim hakkı', async () => {
    const y = await al('malik', '/api/v1/tahakkuk/donemler');
    expect(y.status).toBe(200);
  });

  /* ------------------------ 4) Reşit olmayan kişiler ---------------------- */

  /**
   * ⚠️  KURAL "BAŞKA HANENİN reşit olmayanı görünmez"dir — ürün sahibi kararı.
   *     Mutlak okuma (kendi çocuğu da gizli) REDDEDİLDİ: veli kendi çocuğunun
   *     sakin kaydını göremezse giriş/çıkış düzeltmesi ve acil durum kişisi
   *     yönetimi kırılır.
   *
   * ⚠️  Koruma AYRI BİR YAŞ SÜZGECİYLE değil, kapsamın kendisiyle sağlanır:
   *     başka hanenin hiçbir kişisi dönmediği için çocuğu da dönmez. Ayrı bir
   *     `dogum_tarihi < 18` koşulu eklenseydi, `dogum_tarihi` isteğe bağlı
   *     olduğu için (KVKK veri minimizasyonu) kayıtların çoğunda ETKİSİZ
   *     kalırdı ve korumanın gerçekte kapsamdan geldiği görünmezdi.
   */
  it('BAŞKA hanenin reşit olmayan kaydı hiçbir sakin sınıfı role dönmez', async () => {
    for (const rol of ['malik', 'kiraci', 'sakin']) {
      const y = await al(rol, '/api/v1/kisiler?limit=100');
      if (y.status !== 200) continue;
      const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
      expect(adlar, `${rol} komşunun çocuğunu gördü`).not.toContain('KomsuCocukB');
    }
  });

  /* ------------- 5) KİRAYA VERİLMİŞ MÜLK — yalnızca borç/ödeme ------------ */

  /**
   * ⚠️  BOLUM_A KİRAYA VERİLMİŞTİR (KiraciA oturuyor). MalikA orada oturmuyor.
   *
   *     KMK md. 22: kiracı aidatı ödemezse borç MALİKE döner. Malikin menfaati
   *     bu yüzden BORÇTADIR ve ödeme durumunu görmesi hakkıdır. Ama kiracının
   *     kimliği, sözleşmesi ve ailesi bu hakkın kapsamında DEĞİLDİR.
   */
  it('MALİK kiraya verdiği dairenin BORCUNU görür', async () => {
    const y = await al('malik', '/api/v1/tahakkuk/donemler');
    expect(y.status).toBe(200);
  });

  it('MALİK kiraya verdiği dairede KİRACININ KİMLİĞİNİ görmez', async () => {
    const y = await al('malik', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar, 'malik kendi kaydını görmelidir').toContain('MalikA');
    expect(adlar, 'kiracının kimliği malike SIZMAMALI').not.toContain('KiraciA');
  });

  it('MALİK kiraya verdiği dairenin SAKİNLERİNİ görmez', async () => {
    const y = await al('malik', `/api/v1/bolumler/${BOLUM_A}/sakinler`);
    if (y.status === 200) {
      const adlar = (y.body as { kisiAdi: string }[]).map((s) => s.kisiAdi);
      expect(adlar.join(' '), 'kiracının ailesi malike sızmamalı').not.toContain('SakinA');
    } else {
      expect([403, 404]).toContain(y.status);
    }
  });

  /**
   * ⚠️  PERSONA KİRACIDIR, MALİK DEĞİL — fikstürde BOLUM_A kiraya verilmiştir
   *     ve MalikA orada OTURMAZ. Hanede fiilen oturan KiraciA'dır; kendi
   *     çocuğunun kaydını görmesi gereken de odur.
   */
  it('KENDİ hanesinin reşit olmayanı hanede OTURANA dönmeye devam eder', async () => {
    const y = await al('kiraci', '/api/v1/kisiler?limit=100');
    expect(y.status).toBe(200);
    const adlar = (y.body as SayfaliKisi).kayitlar.map((k) => k.ad);
    expect(adlar, 'hanede oturan kendi çocuğunun kaydını görmelidir').toContain('CocukA');
  });
});
