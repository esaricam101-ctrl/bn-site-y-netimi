/**
 * CT-18 · YEVMİYE KAPSAMI — sakin sınıfı roller muhasebe defterini göremez
 *
 * ⚠️  NEDEN VAR: `yevmiye_fisi` ve `yevmiye_satiri` yalnızca TENANT
 *     izolasyonu taşıyor; satır kapsamı (ADR-0011) politikası YOK ve
 *     muafiyet listesinde de değiller.
 *
 *     Bugün bunun sorun olmamasının tek sebebi Kapı 3'tür:
 *     `FINANS_YEVMIYE_GIRIS` izni MALİK/KİRACI/SAKİN rollerinde yok.
 *     Yani koruma İZİN katmanında, VERİ katmanında değil. Bir uç
 *     yanlışlıkla daha gevşek bir izinle açılırsa defterin tamamı sızar.
 *
 * ⚠️  TEST HTTP'DEN GİTMEZ — bilinçli. HTTP'den denenirse Kapı 3 isteği
 *     403 ile keser ve test YEŞİL görünür; ama ölçtüğü şey RLS değil,
 *     izindir. Bu, ADR-0011'deki "psql üretim yolunu temsil etmez"
 *     dersinin aynısıdır: doğru sonucu YANLIŞ sebeple almak.
 *
 *     Bu yüzden sorgu, uygulama rolüyle (`bnos_app`) ve kapsam ayarları
 *     KURULMUŞ hâlde doğrudan veritabanına gider — tam olarak
 *     `PrismaService.tenantIslemi`'nin ürettiği bağlam.
 *
 * PostgreSQL gerektirir: `pnpm db:up && pnpm db:migrate`
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient();

const TENANT = randomUUID();
const BOLUM_A = randomUUID();   // sakinin kendi hanesi
const BOLUM_B = randomUUID();   // KOMŞU hane
const KISI_A = randomUUID();
const HESAP_KASA = randomUUID();
const HESAP_ALACAK = randomUUID();
const FIS = randomUUID();

/** Kapsamı SERBEST bağlam — yönetici gibi. Kurulum bununla yapılır. */
function serbest<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
    return fn(tx);
  });
}

/**
 * KISITLI bağlam — sakin sınıfı bir rolün gördüğü dünya.
 * `PrismaService.tenantIslemi`'nin kapsam kurulmuş hâliyle birebir aynı.
 */
function kisitli<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TENANT}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_kisi_id', '${KISI_A}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_bolumler', '${BOLUM_A}', true)`);
    await tx.$executeRawUnsafe(`SELECT set_config('app.kapsam_mulk_bolumler', '', true)`);
    return fn(tx);
  });
}

describe('CT-18 · Yevmiye kapsamı', () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: TENANT, kod: `ct18-${TENANT.slice(0, 8)}`, ad: 'CT-18 Test Sitesi',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await serbest(async (tx) => {
      const apartmanId = randomUUID();
      const blokId = randomUUID();
      const katId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: TENANT, ad: 'A' } });
      await tx.blok.create({ data: { id: blokId, tenantId: TENANT, apartmanId, ad: 'A' } });
      await tx.kat.create({ data: { id: katId, tenantId: TENANT, blokId, no: 1 } });

      for (const [i, id] of [BOLUM_A, BOLUM_B].entries()) {
        await tx.bagimsizBolum.create({
          data: {
            id, tenantId: TENANT, blokId, katId, kapiNo: String(i + 1), kat: 1,
            nitelik: 'MESKEN', brutM2: 100, netM2: 85,
            arsaPayiPay: 500_000n, arsaPayiPayda: 1_000_000n,
          },
        });
      }

      await tx.kisi.create({
        data: { id: KISI_A, tenantId: TENANT, ad: 'Sakin', soyad: 'Test' },
      });

      await tx.hesap.createMany({
        data: [
          { id: HESAP_KASA, tenantId: TENANT, kod: '100', ad: 'Kasa', tip: 'VARLIK' },
          { id: HESAP_ALACAK, tenantId: TENANT, kod: '120', ad: 'Alacaklar', tip: 'VARLIK' },
        ],
      });

      // İki satırlı denk bir fiş: biri KOMŞU haneye (BOLUM_B) bağlı.
      await tx.yevmiyeFisi.create({
        data: {
          id: FIS, tenantId: TENANT, fisNo: 'YEV-2026-000001',
          tarih: new Date('2026-06-15'), aciklama: 'CT-18 kurulum fişi',
          kaynakTipi: 'ELLE', durum: 'ISLENDI',
        },
      });
      await tx.yevmiyeSatiri.createMany({
        data: [
          {
            id: randomUUID(), tenantId: TENANT, fisId: FIS, hesapId: HESAP_ALACAK,
            borc: 1000, alacak: 0, bolumId: BOLUM_B, aciklama: 'KOMŞU hanenin borcu',
          },
          {
            id: randomUUID(), tenantId: TENANT, fisId: FIS, hesapId: HESAP_KASA,
            borc: 0, alacak: 1000, bolumId: null, aciklama: 'kasa',
          },
        ],
      });
    });
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('kurulum: kapsamı SERBEST bağlamda fiş ve satırlar görünür', async () => {
    const { fis, satir } = await serbest(async (tx) => ({
      fis: await tx.yevmiyeFisi.count({ where: { tenantId: TENANT } }),
      satir: await tx.yevmiyeSatiri.count({ where: { tenantId: TENANT } }),
    }));
    expect(fis).toBe(1);
    expect(satir).toBe(2);
  });

  it('★ KISITLI kapsamda YEVMİYE FİŞİ GÖRÜNMEZ', async () => {
    /*
     * Yevmiye fişi PROJE seviyesinde bir muhasebe kaydıdır; sakin sınıfı
     * roller kendi borcunu `borc` üzerinden görür (`borc_kapsam`). Defterin
     * kendisine erişimleri OLMAMALIDIR.
     */
    const sayi = await kisitli((tx) => tx.yevmiyeFisi.count({ where: { tenantId: TENANT } }));
    expect(sayi).toBe(0);
  });

  it('★ KISITLI kapsamda KOMŞU hanenin yevmiye satırı GÖRÜNMEZ', async () => {
    /*
     * En ağır sızıntı budur: satır `bolumId` taşıyor ve o bölüm kapsam
     * DIŞINDA. Komşunun borç tutarı okunabiliyorsa satır kapsamı (ADR-0011)
     * defterde hiç uygulanmıyor demektir.
     */
    const satirlar = await kisitli((tx) => tx.yevmiyeSatiri.findMany({
      where: { tenantId: TENANT, bolumId: BOLUM_B },
      select: { id: true, borc: true },
    }));
    expect(satirlar).toHaveLength(0);
  });

  it('★ KISITLI kapsamda HİÇBİR yevmiye satırı görünmez', async () => {
    const sayi = await kisitli((tx) => tx.yevmiyeSatiri.count({ where: { tenantId: TENANT } }));
    expect(sayi).toBe(0);
  });

  it('★ KISITLI kapsam deftere YAZAMAZ da — koruma yalnızca okumada değil', async () => {
    /*
     * Politika `FOR SELECT` değil `FOR ALL`: kısıtlı kapsamdaki bir rol,
     * izin katmanı yanılırsa deftere KAYIT ATABİLMEMELİDİR. Bu test o
     * iddiayı ölçer — yoksa `FOR ALL` yazmak bir varsayım olarak kalırdı.
     */
    await expect(
      kisitli((tx) => tx.yevmiyeFisi.create({
        data: {
          id: randomUUID(), tenantId: TENANT, fisNo: 'YEV-2026-000999',
          tarih: new Date('2026-06-20'), aciklama: 'kisitli kapsamdan yazma denemesi',
          kaynakTipi: 'ELLE',
        },
      })),
    ).rejects.toThrow();

    // Yazılmadığı SERBEST bağlamdan doğrulanır: kısıtlı bağlamda zaten
    // görünmezdi ve "görünmüyor" ile "yazılmadı" aynı şey değildir.
    const sayi = await serbest((tx) =>
      tx.yevmiyeFisi.count({ where: { tenantId: TENANT, fisNo: 'YEV-2026-000999' } }));
    expect(sayi).toBe(0);
  });

  it('SERBEST kapsam deftere yazabilir — kural meşru yolu engellemiyor', async () => {
    const id = randomUUID();
    await serbest((tx) => tx.yevmiyeFisi.create({
      data: {
        id, tenantId: TENANT, fisNo: 'YEV-2026-000002',
        tarih: new Date('2026-06-21'), aciklama: 'serbest kapsamdan yazma',
        kaynakTipi: 'ELLE',
      },
    }));
    const sayi = await serbest((tx) => tx.yevmiyeFisi.count({ where: { id } }));
    expect(sayi).toBe(1);
  });

  it('karşılaştırma: AYNI bağlamda kendi hanesinin BORCU görünür (borc_kapsam çalışıyor)', async () => {
    /*
     * Bu test kapsamın çalıştığını değil, DOĞRU YERDE çalıştığını gösterir:
     * `borc` üzerinde politika var, `yevmiye_satiri` üzerinde yok. İkisi
     * aynı bağlamda karşılaştırılınca fark ölçülebilir hale gelir.
     */
    const gorunur = await kisitli((tx) => tx.bagimsizBolum.count({ where: { id: BOLUM_A } }));
    const gorunmez = await kisitli((tx) => tx.bagimsizBolum.count({ where: { id: BOLUM_B } }));
    expect(gorunur).toBe(1);
    expect(gorunmez).toBe(0);
  });
});
