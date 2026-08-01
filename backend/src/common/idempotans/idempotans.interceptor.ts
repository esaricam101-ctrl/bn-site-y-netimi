/**
 * IDEMPOTENCY-KEY — kayıt oluşturan POST uçları için tekrar koruması.
 *
 * ⚠️  NEDEN VAR: BFS v1 §366 bu başlığı ZORUNLU kılıyordu ama depoda hiçbir yer
 *     onu OKUMUYORDU. İstemciler gönderiyor, sunucu yok sayıyordu — yani
 *     belgelenmiş bir koruma vardı ve YOKTU. `yalnizcaKendiVerisi` bayrağıyla
 *     aynı sınıf hata: beyan edilmiş ama bağlanmamış koruma.
 *
 *     Somut sonucu ölçüldü: uzun bir toplu tahakkuk ters vekilde kesildiğinde
 *     kullanıcı tekrar deniyor ve mali veri bozuluyordu.
 *
 * ⚠️  BU KATMAN TEK BAŞINA YETMEZ ve yetmesi de beklenmez. İki eşzamanlı istek
 *     ikisi de kaydı bulamayıp işi başlatabilir. Asıl koruma veritabanı
 *     kısıtıdır (`tahakkuk_calismasi_asil_uq`, 0026); bu katman kullanıcının
 *     tekrar denemesine 409 yerine İLK SONUCU döndürür.
 *
 * SAKLANAN ŞEY YANITTIR, tutar ya da bakiye değil — ADR-0005'in yasak alan
 * listesi önbellek içindir; bu bir önbellek değil, işlem kaydıdır ve
 * veritabanında yaşar.
 */
import {
  Injectable, Logger,
  type CallHandler, type ExecutionContext, type NestInterceptor,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CakismaHatasi } from '@bnos/core-domain';
import { of, type Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { mevcutBaglam } from '../context/request-context';

interface IstekGovdesi {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
}

@Injectable()
export class IdempotansInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Idempotans');
  /** Yanıtı saklanacak süre — tekrar denemeler dakikalar içinde gelir. */
  private static readonly SAKLAMA_SAAT = 24;

  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const istek = ctx.switchToHttp().getRequest<IstekGovdesi>();
    if (istek.method !== 'POST') return next.handle();

    const ham = istek.headers['idempotency-key'];
    const anahtar = Array.isArray(ham) ? ham[0] : ham;
    if (!anahtar) return next.handle();

    const tenantId = mevcutBaglam()?.tenant?.tenantId;
    // Kimlik kurulmamışsa (giriş ucu) saklanacak tenant yoktur.
    if (!tenantId) return next.handle();

    const yol = `${istek.method} ${istek.url.split('?')[0] ?? ''}`;
    const ozet = createHash('sha256')
      .update(JSON.stringify(istek.body ?? null))
      .digest('hex');

    return of(null).pipe(
      switchMap(async () => {
        const mevcut = await this.prisma.tenantIslemi(
          (tx) => tx.idempotansKaydi.findFirst({ where: { tenantId, anahtar } }),
          tenantId,
        );
        if (mevcut) {
          if (mevcut.yol !== yol || mevcut.istekOzeti !== ozet) {
            throw new CakismaHatasi(
              'Bu Idempotency-Key başka bir istek için kullanılmış.',
              'Yeni bir işlem için yeni bir anahtar üretin.',
            );
          }
          this.logger.debug(`[${mevcutBaglam()?.correlationId ?? 'yok'}] ${yol} — tekrar, saklanan yanıt döndü`);
          ctx.switchToHttp().getResponse<{ statusCode: number }>().statusCode = mevcut.durum;
          return mevcut.yanit;
        }

        const yanit = await new Promise<unknown>((coz, red) => {
          next.handle().subscribe({ next: coz, error: red });
        });

        const durum = ctx.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
        try {
          await this.prisma.tenantIslemi(
            (tx) => tx.idempotansKaydi.create({
              data: {
                id: randomUUID(), tenantId, anahtar, yol, istekOzeti: ozet, durum,
                yanit: yanit as Prisma.InputJsonValue,
                gecerlilikSonu: new Date(
                  Date.now() + IdempotansInterceptor.SAKLAMA_SAAT * 3_600_000,
                ),
              },
            }),
            tenantId,
          );
        } catch (e) {
          // P2002: aynı anahtarla eşzamanlı ikinci istek önce yazdı. İş zaten
          // bitti ve yanıt üretildi; kaydı yazamamak yanıtı düşürmez.
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        }
        return yanit;
      }),
    );
  }
}
