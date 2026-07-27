/**
 * Yerel Enterprise Memory adaptoru.
 *
 * BNOS gercek endpoint'leri Sprint 15'e kadar mevcut degildir (acik madde C-1).
 * Sozlesme aynidir; arkasi degisir. Kernel'e gecis TEK adaptor degisimidir.
 */
import type { TenantId } from '@bnos/kernel';
import type { IMemoryQueryService, IMemoryCommandService, BellekKaydi, BellekSorgusu } from '../ports/memory.port.js';

export class YerelMemoryAdaptoru implements IMemoryQueryService, IMemoryCommandService {
  private readonly kayitlar = new Map<string, BellekKaydi>();
  private sayac = 0;

  ara(sorgu: BellekSorgusu): Promise<readonly BellekKaydi[]> {
    const kelimeler = sorgu.metin.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
    const sonuc = [...this.kayitlar.values()]
      // Tenant izolasyonu adaptorde de zorlanir — RLS'e tek basina guvenilmez.
      .filter((k) => k.tenantId === sorgu.tenantId)
      .filter((k) => kelimeler.some((kelime) => k.icerik.toLowerCase().includes(kelime)))
      .slice(0, sorgu.limit);
    return Promise.resolve(sonuc);
  }

  baglamGetir(tenantId: TenantId, anahtar: string): Promise<BellekKaydi | null> {
    const k = this.kayitlar.get(anahtar);
    return Promise.resolve(k && k.tenantId === tenantId ? k : null);
  }

  yaz(kayit: Omit<BellekKaydi, 'id'>): Promise<string> {
    const id = `mem-${++this.sayac}`;
    this.kayitlar.set(id, { ...kayit, id });
    return Promise.resolve(id);
  }

  sil(tenantId: TenantId, id: string): Promise<void> {
    const k = this.kayitlar.get(id);
    if (k && k.tenantId === tenantId) this.kayitlar.delete(id);
    return Promise.resolve();
  }
}
