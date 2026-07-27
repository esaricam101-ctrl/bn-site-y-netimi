/**
 * Önbellek servisi — ADR-0005 · BFS v1 §7
 *
 * TİP DÜZEYİ ZORLAMA: bu servis yalnızca `OnbellekAnahtari` markalı tipini
 * kabul eder. Ham string geçilemez, dolayısıyla tenantId'siz anahtar
 * DERLENMEZ. onbellekAnahtari() üretici fonksiyonu ayrıca yasaklı finansal
 * alanları çalışma zamanında reddeder.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { OnbellekAnahtari } from '@bnos/kernel';

@Injectable()
export class OnbellekServisi implements OnModuleDestroy {
  private readonly logger = new Logger('Onbellek');
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.redis.on('error', (h) => this.logger.warn(`Redis hatası: ${h.message}`));
  }

  async getir<T>(anahtar: OnbellekAnahtari): Promise<T | null> {
    try {
      const ham = await this.redis.get(anahtar);
      return ham ? (JSON.parse(ham) as T) : null;
    } catch {
      // Önbellek ASLA kayıt kaynağı değildir: Redis düşerse sistem yavaşlar, bozulmaz.
      return null;
    }
  }

  async yaz(anahtar: OnbellekAnahtari, deger: unknown, ttlSaniye: number): Promise<void> {
    try {
      await this.redis.set(anahtar, JSON.stringify(deger), 'EX', ttlSaniye);
    } catch {
      /* yut — önbellek yazımı başarısızlığı isteği bozmaz */
    }
  }

  /** Geçersizleştirme domain event'lerle yapılır; TTL'e bel bağlanmaz (§37 kural 2). */
  async desenSil(desen: string): Promise<void> {
    const anahtarlar = await this.redis.keys(desen);
    if (anahtarlar.length > 0) await this.redis.del(...anahtarlar);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
