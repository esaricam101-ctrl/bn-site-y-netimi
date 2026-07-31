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
      // Kural AST tabanlidir ve markali tipi goremez; `anahtar` burada zaten
      // OnbellekAnahtari'dir — ham string GECILEMEZ, derlenmez. Zorlama tip
      // duzeyinde bu imzada yapilir (ADR v1.1 §37).
      // eslint-disable-next-line bnos/require-tenant-cache-key
      const ham = await this.redis.get(anahtar);
      return ham ? (JSON.parse(ham) as T) : null;
    } catch {
      // Önbellek ASLA kayıt kaynağı değildir: Redis düşerse sistem yavaşlar, bozulmaz.
      return null;
    }
  }

  async yaz(anahtar: OnbellekAnahtari, deger: unknown, ttlSaniye: number): Promise<void> {
    try {
      // Ayni gerekce: `anahtar` markali OnbellekAnahtari tipindedir.
      // eslint-disable-next-line bnos/require-tenant-cache-key
      await this.redis.set(anahtar, JSON.stringify(deger), 'EX', ttlSaniye);
    } catch {
      /* yut — önbellek yazımı başarısızlığı isteği bozmaz */
    }
  }

  /**
   * TEK anahtarı siler — aktif geçersizleştirme.
   *
   * ⚠️  `desenSil` DEĞİL bu kullanılır: `KEYS` taraması Redis'i tek iş
   *     parçacığı boyunca bloke eder ve yetki değişimi sıcak yolda olur.
   *     Hangi anahtarın silineceği biliniyorsa taramaya gerek yoktur.
   */
  async sil(anahtar: OnbellekAnahtari): Promise<void> {
    try {
      // Markalı tip; ham string GEÇİLEMEZ (imza düzeyinde zorlanır).
      // eslint-disable-next-line bnos/require-tenant-cache-key
      await this.redis.del(anahtar);
    } catch (hata) {
      /*
       * ⚠️  SESSİZ KALINMAZ. Yazma başarısızlığı isteği bozmaz ama SİLME
       *     başarısızlığı YETKİ KALDIRMANIN GEÇMEMESİ demektir: tahliye
       *     edilmiş kiracı en çok TTL kadar (5 dk) daireyi görmeye devam
       *     eder. TTL ağdır, ama ağa düştüğümüzü bilmemiz gerekir.
       */
      this.logger.error(
        `Önbellek anahtarı silinemedi: ${(hata as Error).message}. ` +
          'Yetki değişikliği en çok TTL kadar gecikecek.',
      );
    }
  }

  /** Geçersizleştirme domain event'lerle yapılır; TTL'e bel bağlanmaz (§37 kural 2). */
  async desenSil(desen: string): Promise<void> {
    const anahtarlar = await this.redis.keys(desen);
    // `anahtarlar` redis.keys() ciktisidir, cagiran tarafindan uretilmis bir
    // anahtar degildir. Desenin tenant kapsamli oldugunu `desen` parametresini
    // veren cagiran garanti eder — bu imza markali tip tasimaz.
    // eslint-disable-next-line bnos/require-tenant-cache-key
    if (anahtarlar.length > 0) await this.redis.del(...anahtarlar);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
