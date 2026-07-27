/**
 * Numara tahsis — ADR v1.1 §35 · BFS v1 §8
 *
 * BOŞLUKSUZ serilerde eşzamanlı tahsis boşluk bırakmamalı ve
 * çakışmamalıdır. PostgreSQL gerektirir.
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NumaraServisi } from '../../src/common/numbering/numara.service';
import { tenantId } from '@bnos/kernel';

const prisma = new PrismaClient();
const servis = new NumaraServisi();
const TID = tenantId(randomUUID());

async function baglamda<T>(fn: (tx: never) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${TID}', true)`);
    return fn(tx as never);
  });
}

describe('Numara tahsisi', () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: { id: TID, kod: `num-${TID.slice(0, 8)}`, ad: 'Numara Testi',
              tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
              paraBirimi: 'TRY', lisansKodu: 'TEST' },
    });
  });

  afterAll(() => prisma.$disconnect());

  it('sıralı tahsis boşluksuz ilerler', async () => {
    const numaralar: string[] = [];
    for (let i = 0; i < 5; i++) {
      numaralar.push(await baglamda((tx) =>
        servis.tahsisEt(tx, { tenantId: TID, seriKodu: 'MAKBUZ', yil: 2026 })));
    }
    expect(numaralar).toEqual([
      'MKB-2026-000001', 'MKB-2026-000002', 'MKB-2026-000003',
      'MKB-2026-000004', 'MKB-2026-000005',
    ]);
  });

  it('eşzamanlı tahsis ÇAKIŞMAZ ve boşluk bırakmaz', async () => {
    const sonuclar = await Promise.all(
      Array.from({ length: 20 }, () =>
        baglamda((tx) => servis.tahsisEt(tx, { tenantId: TID, seriKodu: 'TAHAKKUK', yil: 2026 }))),
    );
    const benzersiz = new Set(sonuclar);
    expect(benzersiz.size).toBe(20);

    const siralar = sonuclar.map((n) => Number(n.split('-')[2])).sort((a, b) => a - b);
    // Boşluksuz: 1..20 kesintisiz
    expect(siralar).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('yıl değişince sayaç sıfırlanır (TENANT_YIL kapsamı)', async () => {
    const y2027 = await baglamda((tx) =>
      servis.tahsisEt(tx, { tenantId: TID, seriKodu: 'MAKBUZ', yil: 2027 }));
    expect(y2027).toBe('MKB-2027-000001');
  });

  it('katalogda olmayan seri reddedilir', async () => {
    await expect(
      baglamda((tx) => servis.tahsisEt(tx, { tenantId: TID, seriKodu: 'HAYALI', yil: 2026 })),
    ).rejects.toThrow(/katalogda yok/);
  });
});
