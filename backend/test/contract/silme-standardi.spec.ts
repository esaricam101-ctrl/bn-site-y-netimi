/**
 * CT-06 · Soft delete standardı — kısmi unique index kuruldu
 * Kaynak: BFS v1 §5.3 kural 1
 *
 * Bu kural atlanırsa silinen "A-3 dairesi", yeni "A-3" oluşturulmasını
 * KALICI olarak engeller.
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient();

describe('CT-06 · Silme standardı', () => {
  afterAll(() => prisma.$disconnect());

  it('soft delete taşıyan tablolarda kısmi unique index vardır', async () => {
    const indexler = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexdef LIKE '%silinme_tarihi IS NULL%'
    `;
    const tablolar = ['kisi', 'kullanici', 'blok', 'bagimsiz_bolum', 'hesap'];
    for (const t of tablolar) {
      expect(
        indexler.some((i) => i.indexdef.includes(` ${t} `) || i.indexname.startsWith(t)),
        `${t} tablosunda kısmi unique index yok (BFS v1 §5.3 kural 1)`,
      ).toBe(true);
    }
  });

  it('finansal tablolar soft delete alanı TAŞIMAZ — asla silinmez', async () => {
    const kolonlar = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT DISTINCT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'silinme_tarihi'
    `;
    const adlar = kolonlar.map((k) => k.table_name);
    for (const finansal of ['yevmiye_fisi', 'yevmiye_satiri', 'borc', 'audit_kaydi']) {
      expect(adlar, `${finansal} soft delete taşımamalı (BFS v1 §5.1)`).not.toContain(finansal);
    }
  });

  it('audit kaydı UPDATE kabul etmez', async () => {
    await expect(
      prisma.$executeRawUnsafe(`UPDATE audit_kaydi SET gerekce = 'degistirildi' WHERE true`),
    ).rejects.toThrow();
  });
});
