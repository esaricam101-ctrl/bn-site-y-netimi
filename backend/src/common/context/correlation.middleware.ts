import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { baglamIcinde } from './request-context';

/**
 * İstek bağlamını kuran MIDDLEWARE — interceptor DEĞİL.
 *
 * NEDEN MIDDLEWARE: NestJS çalıştırma sırası
 *   middleware → guard → interceptor → pipe → handler
 * şeklindedir. Bağlam bir interceptor'da kurulursa GUARD'LAR ONDAN ÖNCE
 * çalışır ve `mevcutBaglam()` onlar için `undefined` döner.
 *
 * Sonucu şuydu: Kapı 1 principal'ı, Kapı 2 tenant'ı bağlama yazmaya
 * çalışıyor, bağlam olmadığı için sessizce atlıyordu (`if (baglam)`).
 * Handler'a gelindiğinde bağlam vardı ama TENANT'SIZDI; açık `tenantId`
 * geçmeyen her yazma işlemi
 *   "Tenant bağlamı kurulmadan veritabanı işlemi çalıştırılamaz"
 * ile 403 dönüyordu. Yani BÜTÜN yazma uçları kırıktı.
 *
 * Hata sessizdi çünkü `if (baglam)` koşulu bir hata değil, bir atlamaydı:
 * kod "bağlam yoksa yazma" diyordu ve bağlam HİÇBİR ZAMAN yoktu.
 *
 * Korelasyon kimliği her yanıtta yankılanır (BFS v1 §12).
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(istek: Request, yanit: Response, next: NextFunction): void {
    const correlationId =
      (istek.headers['x-request-id'] as string | undefined) ?? randomUUID();
    yanit.setHeader('X-Request-Id', correlationId);

    // `next()` bu blok İÇİNDE çağrılır: AsyncLocalStorage deposu isteğin
    // geri kalan zincirine (guard · interceptor · handler) böylece taşınır.
    baglamIcinde(
      {
        correlationId,
        ip: istek.ip ?? null,
        kullaniciAjani: istek.headers['user-agent'] ?? null,
      },
      () => { next(); },
    );
  }
}
