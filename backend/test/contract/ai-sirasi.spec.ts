/**
 * CT-12 · AI boru hattında LLM ilk bileşen DEĞİLDİR
 * Kaynak: ADR-0004 · AIS v1 §3
 *
 * Bu test veritabanı gerektirmez — saf domain davranışıdır.
 */
import { describe, expect, it, vi } from 'vitest';
import { BnosAiPipeline, YerelMemoryAdaptoru, YerelBusinessRulesAdaptoru, niyetiCoz } from '@bnos/bnos-client';
import { tenantId } from '@bnos/kernel';

const TID = tenantId('11111111-2222-3333-4444-555555555555');

const bosKg = {
  varlikCozumle: () => Promise.resolve([]),
  iliskiGenislet: () => Promise.resolve({ dugumler: [], iliskiler: [] }),
};

describe('CT-12 · AI yürütme sırası', () => {
  it('niyet sınıflandırması DETERMİNİSTİKTİR — LLM çağırmaz', () => {
    expect(niyetiCoz('Nisan aidatı ne kadar?').kaynak).toBe('KURAL');
    expect(niyetiCoz('Tahakkuk oluştur').niyet).toBe('EYLEM_ONERISI');
  });

  it('kural katmanı engellerse LLM HİÇ çağrılmaz', async () => {
    const llm = { uret: vi.fn().mockResolvedValue('cevap') };
    const pipeline = new BnosAiPipeline(
      new YerelMemoryAdaptoru(), bosKg, new YerelBusinessRulesAdaptoru(), llm,
    );

    const sonuc = await pipeline.calistir({
      tenantId: TID,
      // İzin seti boş → AI-002 kuralı engeller
      principal: { id: 'p1', tip: 'INSAN', tenantId: TID, izinler: [] },
      metin: 'Tahakkuk oluştur',
    });

    expect(sonuc.kurallar.izinliMi).toBe(false);
    expect(sonuc.llmCagrildiMi).toBe(false);
    expect(llm.uret).not.toHaveBeenCalled();
  });

  it('AI ajanı kayıt atamaz — BRE üretimden ÖNCE engeller', async () => {
    const llm = { uret: vi.fn().mockResolvedValue('cevap') };
    const pipeline = new BnosAiPipeline(
      new YerelMemoryAdaptoru(), bosKg, new YerelBusinessRulesAdaptoru(), llm,
    );

    const sonuc = await pipeline.calistir({
      tenantId: TID,
      principal: { id: 'a1', tip: 'AGENT', tenantId: TID, izinler: ['x'] },
      metin: 'Tahakkuk oluştur',
    });

    // Öneri hiç ÜRETİLMEZ; üretilip bastırılmaz.
    expect(sonuc.oneri).toBeNull();
    expect(llm.uret).not.toHaveBeenCalled();
  });

  it('bellekten yanıtlanabiliyorsa LLM çağrılmaz', async () => {
    const memory = new YerelMemoryAdaptoru();
    await memory.yaz({
      tenantId: TID, tur: 'NOT', icerik: 'Nisan aidatı 1.250 TL olarak belirlendi.',
      ustveri: {}, olusmaAni: new Date(),
    });

    const llm = { uret: vi.fn().mockResolvedValue('cevap') };
    const pipeline = new BnosAiPipeline(memory, bosKg, new YerelBusinessRulesAdaptoru(), llm);

    const sonuc = await pipeline.calistir({
      tenantId: TID,
      principal: { id: 'p1', tip: 'INSAN', tenantId: TID, izinler: ['ai.copilot.use'] },
      metin: 'Nisan aidatı ne kadar?',
    });

    expect(sonuc.llmCagrildiMi).toBe(false);
    expect(sonuc.oneri).toContain('1.250');
    expect(sonuc.kanitlar.length).toBeGreaterThan(0);
  });

  it('bellek başka tenant kaydını sızdırmaz', async () => {
    const memory = new YerelMemoryAdaptoru();
    const digerTenant = tenantId('99999999-8888-7777-6666-555555555555');
    await memory.yaz({
      tenantId: digerTenant, tur: 'NOT', icerik: 'Gizli aidat bilgisi',
      ustveri: {}, olusmaAni: new Date(),
    });
    const sonuc = await memory.ara({ tenantId: TID, metin: 'aidat', izinler: [], limit: 10 });
    expect(sonuc).toHaveLength(0);
  });
});
