/**
 * Prisma servisi — tenant bağlamı ve soft delete filtresi MERKEZÎ olarak enjekte edilir.
 *
 * ADR-0002 · BFS v1 §2.3:
 *   - Her transaction başında `SET LOCAL app.tenant_id`
 *   - İzolasyon uygulama katmanındaki `where` koşuluna BIRAKILMAZ; veritabanı zorlar
 *   - Bağlam yoksa sorgu HATA VERİR, sessizce geçmez
 *
 * BFS v1 §5.3 kural 2:
 *   - Soft delete varsayılan filtresi merkezîdir. Her `where` koşuluna elle
 *     eklenmez — biri unutulduğunda silinmiş kayıt sızar.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantBaglamiHatasi, type TenantId } from '@bnos/kernel';
import { mevcutBaglam } from '../context/request-context';

/**
 * Soft delete taşımayan tablolar — finansal ve değiştirilemez kayıtlar
 * (BFS v1 §5.1).
 *
 * ⚠️  BU LİSTE EKSİK ve eksikliği ŞU AN GÖRÜNMÜYOR. Aşağıdaki `$extends`
 *     çağrısının dönüş değeri atıldığı için uzantı hiç devreye girmiyor
 *     (SESSION_SUMMARY §B.0). Uzantı bağlanır bağlanmaz, `silinmeTarihi`
 *     sütunu OLMAYAN her modele yapılan okuma sorgusu
 *     `PrismaClientValidationError` verir çünkü uzantı `where` koşuluna
 *     `silinmeTarihi: null` ekler.
 *
 *     Listede olmayan ama sütunu da olmayan modeller (2026-07 itibarıyla):
 *       YevmiyeFisi · YevmiyeSatiri · Borc · BorcSorumlusu · MuhasebeDonemi ·
 *       MuhasebeParametresi · BolumIliskisi · SayacOkumasi · BelgeIliskisi ·
 *       YonetimDelegasyonu · BankaHareketi · BankaEkstresi · EkstreSatiri ·
 *       KiymetliEvrak · BankaParametresi
 *
 *     Yani §B.0'ı "tek satırlık bir düzeltme" sanıp `$extends` sonucunu
 *     bağlamak, 15 modelin bütün okuma uçlarını birden kırar. Doğru çözüm
 *     listeyi elle uzatmak DEĞİL, muafiyeti modelin gerçekten o sütunu taşıyıp
 *     taşımadığından türetmektir (`Prisma.dmmf`): elle tutulan liste her yeni
 *     tabloda güncellenmeyi unutur ve hata SESSİZDİR.
 */
const SOFT_DELETE_HARICI = new Set([
  'AuditKaydi', 'OutboxKayit', 'IsCalistirma', 'NumaraSayaci',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor() {
    super({ log: [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] });
    this.$extends(softDeleteUzantisi());
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Veritabanı bağlantısı kuruldu');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Tenant kapsamlı işlem. Transaction açar, `SET LOCAL app.tenant_id` çalıştırır
   * ve gövdeyi o bağlamda yürütür. RLS politikaları bu ayara bakar.
   */
  async tenantIslemi<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    tenantIdDegeri?: TenantId,
  ): Promise<T> {
    const tid = tenantIdDegeri ?? mevcutBaglam()?.tenant?.tenantId;
    if (!tid) {
      throw new TenantBaglamiHatasi(
        'Tenant bağlamı kurulmadan veritabanı işlemi çalıştırılamaz. ' +
          'Sistem işleri SISTEM principal ile açık tenant döngüsü kurmalıdır (BFS v1 §2.3).',
      );
    }

    return this.$transaction(async (tx) => {
      // SET LOCAL: yalnızca bu transaction için geçerlidir, havuzdaki
      // bağlantıya sızmaz. Parametre bağlama ile SQL enjeksiyonu engellenir.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tid}::text, true)`;
      return fn(tx);
    });
  }

  /**
   * Sistem işlemi — RLS'i ATLAMAZ. Yalnızca tenant tablosu gibi
   * RLS taşımayan katalog tabloları için kullanılır ve kullanımı sayılıdır.
   */
  sistemIslemi<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn);
  }
}

/**
 * Soft delete uzantısı — global varsayılan filtre.
 * `withDeleted` bayrağı olmadan silinmiş kayıt DÖNMEZ.
 */
export function softDeleteUzantisi() {
  return Prisma.defineExtension({
    name: 'bnos-soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && SOFT_DELETE_HARICI.has(model)) return query(args);

          const okumaIslemleri = ['findFirst', 'findMany', 'findUnique', 'count', 'aggregate'];
          if (okumaIslemleri.includes(operation)) {
            const a = args as { where?: Record<string, unknown> };
            const w = a.where ?? {};
            if (!('silinmeTarihi' in w) && w['__silinmisleriDahilEt'] !== true) {
              a.where = { ...w, silinmeTarihi: null };
            }
            delete (a.where as Record<string, unknown>)['__silinmisleriDahilEt'];
          }
          return query(args);
        },
      },
    },
  });
}
