import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { baglamIcinde } from './request-context';

/**
 * Korelasyon kimliği her yanıtta yankılanır (BFS v1 §12).
 * Bağlam burada kurulur; guard'lar principal ve tenant bilgisini ekler.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const istek = ctx.switchToHttp().getRequest<Request>();
    const yanit = ctx.switchToHttp().getResponse<Response>();

    const correlationId =
      (istek.headers['x-request-id'] as string | undefined) ?? randomUUID();
    yanit.setHeader('X-Request-Id', correlationId);

    return baglamIcinde(
      {
        correlationId,
        ip: istek.ip ?? null,
        kullaniciAjani: (istek.headers['user-agent'] as string | undefined) ?? null,
      },
      () => next.handle(),
    );
  }
}
