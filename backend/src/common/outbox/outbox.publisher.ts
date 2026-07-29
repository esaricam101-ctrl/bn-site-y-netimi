/**
 * Outbox yayıncısı — en-az-bir-kez teslim eder.
 *
 * Tekilleştirme TÜKETİCİ tarafındadır: her tüketici idempotent ve
 * replay-toleranslı olmak zorundadır (ADR v1.1 §31).
 *
 * Başarısız çalıştırma SESSİZ KALAMAZ (§36 kural 5): geri çekilmeli
 * yeniden deneme → ölü mektup → yöneticiye alarm.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { tenantId } from '@bnos/kernel';
import { PrismaService } from '../prisma/prisma.service';

const AKIS = 'bnos:events';
const AZAMI_DENEME = 5;
const ARALIK_MS = 2000;

@Injectable()
export class OutboxYayincisi implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Outbox');
  private readonly redis: Redis;
  private zamanlayici: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');
  }

  onModuleInit(): void {
    this.zamanlayici = setInterval(() => void this.dongu(), ARALIK_MS);
  }

  onModuleDestroy(): void {
    if (this.zamanlayici) clearInterval(this.zamanlayici);
    void this.redis.quit();
  }

  /**
   * Tenant döngüsü — RLS ATLANMAZ.
   *
   * `outbox_kayit` RLS taşır; tenant bağlamı kurulmadan tek satır bile
   * okunamaz. Yayıncı bütün tenant'ların kayıtlarını işlemek zorunda
   * olduğundan tenant listesi katalogdan (RLS'siz `tenant` tablosu) okunur
   * ve her tenant için AYRI bağlam kurulur.
   *
   * Alternatifi BYPASSRLS'li bir rol olurdu; o rol ele geçirildiğinde
   * izolasyon tümüyle kalkar. Döngü daha yavaştır ama garantiyi korur
   * (ADR-0002 · BFS v1 §2.3).
   */
  private async dongu(): Promise<void> {
    let tenantlar: { id: string }[];
    try {
      tenantlar = await this.prisma.sistemIslemi((tx) =>
        tx.tenant.findMany({ where: { durum: 'AKTIF' }, select: { id: true } }),
      );
    } catch (hata) {
      this.logger.error(`Outbox tenant listesi okunamadi: ${(hata as Error).message}`);
      return;
    }

    for (const t of tenantlar) {
      await this.tenantDongusu(t.id);
    }
  }

  private async tenantDongusu(tenantIdDegeri: string): Promise<void> {
    try {
      await this.prisma.tenantIslemi(async (tx) => {
        const bekleyenler = await tx.outboxKayit.findMany({
          where: { yayinlanmaTarihi: null, denemeSayisi: { lt: AZAMI_DENEME } },
          orderBy: { olusturulmaTarihi: 'asc' },
          take: 100,
        });

        for (const kayit of bekleyenler) {
          try {
            await this.redis.xadd(
              AKIS, '*',
              'eventId', kayit.id,
              'eventType', kayit.eventType,
              'tenantId', kayit.tenantId,
              'zarf', JSON.stringify(kayit.zarf),
            );
            await tx.outboxKayit.update({
              where: { id: kayit.id },
              data: { yayinlanmaTarihi: new Date() },
            });
          } catch (hata) {
            const yeniDeneme = kayit.denemeSayisi + 1;
            await tx.outboxKayit.update({
              where: { id: kayit.id },
              data: { denemeSayisi: yeniDeneme, sonHata: (hata as Error).message },
            });
            if (yeniDeneme >= AZAMI_DENEME) {
              // Ölü mektup: sessiz kalmaz, alarm üretir.
              this.logger.error(
                `Event ${AZAMI_DENEME} denemede teslim edilemedi: ${kayit.eventType} (${kayit.id}). ` +
                  `Ölü mektup kuyruğuna alındı — yönetici müdahalesi gerekiyor.`,
              );
            }
          }
        }
      }, tenantId(tenantIdDegeri));
    } catch (hata) {
      this.logger.error(
        `Outbox döngüsü hatası (tenant ${tenantIdDegeri}): ${(hata as Error).message}`,
      );
    }
  }
}
