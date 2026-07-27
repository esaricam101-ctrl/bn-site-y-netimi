import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { mevcutBaglam } from '../context/request-context';

/**
 * Mutasyon uçlarının denetlendiğini gözlemler.
 *
 * Asıl audit yazımı servis katmanında, domain yazmasıyla aynı transaction
 * içinde yapılır (AuditServisi). Bu interceptor gözlemleme ve eksik audit
 * tespiti içindir — geliştirme sırasında CT-02 ihlalini erken yakalar.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');
  private static readonly MUTASYON = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const istek = ctx.switchToHttp().getRequest<{ method: string; url: string }>();
    if (!AuditInterceptor.MUTASYON.has(istek.method)) return next.handle();

    const baslangic = Date.now();
    const correlationId = mevcutBaglam()?.correlationId ?? 'yok';

    return next.handle().pipe(
      tap(() => {
        this.logger.debug(
          `[${correlationId}] ${istek.method} ${istek.url} — ${Date.now() - baslangic}ms`,
        );
      }),
    );
  }
}
