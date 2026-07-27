/**
 * CT-01 · Tenant izolasyonu — RLS altında çapraz okuma reddedilir
 * CT-11 · Uygulama veritabanı rolünün BYPASSRLS yetkisi yok
 *
 * Kaynak: ADR-0002 · BFS v1 §2 · module-sdk SOZLESME_TESTLERI
 *
 * Bu test PostgreSQL gerektirir: `pnpm db:up && pnpm db:migrate`
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const TENANT_A = randomUUID();
const TENANT_B = randomUUID();

async function baglamda<T>(tenantId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', true)`);
    return fn(tx);
  });
}

describe('CT-01 · Tenant izolasyonu', () => {
  beforeAll(async () => {
    for (const [id, kod] of [[TENANT_A, 'test-a'], [TENANT_B, 'test-b']] as const) {
      await prisma.tenant.create({
        data: { id, kod: `${kod}-${id.slice(0, 8)}`, ad: `Test ${kod}`,
                tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
                paraBirimi: 'TRY', lisansKodu: 'TEST' },
      });
    }
    await baglamda(TENANT_A, (tx) =>
      tx.kisi.create({ data: { id: randomUUID(), tenantId: TENANT_A, ad: 'Gizli', soyad: 'Kayit' } }),
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`SET app.tenant_id = ''`);
    await prisma.$disconnect();
  });

  it('A tenant kendi kaydını görür', async () => {
    const kayitlar = await baglamda<unknown[]>(TENANT_A, (tx) => tx.kisi.findMany());
    expect(kayitlar.length).toBeGreaterThan(0);
  });

  it('B tenant, A tenant kaydını GÖREMEZ', async () => {
    const kayitlar = await baglamda(TENANT_B, (tx) => tx.kisi.findMany());
    expect(kayitlar).toHaveLength(0);
  });

  it('B tenant, A tenant kaydına yazamaz', async () => {
    await expect(
      baglamda(TENANT_B, (tx) =>
        tx.kisi.create({ data: { id: randomUUID(), tenantId: TENANT_A, ad: 'Sizinti', soyad: 'Denemesi' } }),
      ),
    ).rejects.toThrow();
  });

  it('bağlam kurulmadan sorgu HATA verir — sessizce boş dönmez', async () => {
    await expect(prisma.kisi.findMany()).rejects.toThrow(/tenant/i);
  });

  it('CT-11 · uygulama rolünün BYPASSRLS yetkisi yoktur', async () => {
    const sonuc = await prisma.$queryRaw<{ rolbypassrls: boolean }[]>`
      SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(sonuc[0]?.rolbypassrls).toBe(false);
  });
});
