/**
 * RFC 7807 problem+json — BFS v1 §12
 *
 * Hiçbir hata mesajı yalnızca "Bir hata oluştu" değildir.
 * Her hata korelasyon kimliği ve TEK NET SONRAKİ EYLEM taşır.
 */
import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainHatasi } from '@bnos/core-domain';
import { TenantBaglamiHatasi, OnbellekPolitikaHatasi, ParaHatasi } from '@bnos/kernel';
import { mevcutBaglam } from '../context/request-context';

/**
 * HttpException gövdesi serbest biçimlidir; alanlar `unknown`'dur. `String(...)`
 * ile zorlamak, nesne gelen bir `mesaj` alanını kullanıcıya "[object Object]"
 * olarak gösterir — BFS v1 §12'nin "tek net sonraki eylem" kuralını sessizce
 * bozar. Yalnızca gerçek metin kabul edilir; gerisi geri düşüşe bırakılır.
 */
function metinVeyaYok(deger: unknown): string | undefined {
  return typeof deger === 'string' && deger.length > 0 ? deger : undefined;
}

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlationId: string;
  sonrakiEylem?: string;
  [k: string]: unknown;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Hata');

  catch(hata: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const yanit = ctx.getResponse<Response>();
    const istek = ctx.getRequest<{ url?: string }>();
    const correlationId = mevcutBaglam()?.correlationId ?? 'yok';

    const problem = this.coz(hata, istek.url ?? '', correlationId);

    if (problem.status >= 500) {
      this.logger.error(`[${correlationId}] ${problem.detail}`, (hata as Error)?.stack);
    } else {
      this.logger.warn(`[${correlationId}] ${problem.status} ${problem.detail}`);
    }

    yanit.status(problem.status).type('application/problem+json').json(problem);
  }

  private coz(hata: unknown, url: string, correlationId: string): ProblemDetails {
    const temel = { instance: url, correlationId };

    if (hata instanceof DomainHatasi) {
      return {
        ...temel,
        type: `https://bnos.local/hatalar/${hata.kod.toLowerCase()}`,
        title: hata.kod,
        status: hata.httpDurum,
        detail: hata.message,
        ...(hata.sonrakiEylem ? { sonrakiEylem: hata.sonrakiEylem } : {}),
      };
    }

    if (hata instanceof TenantBaglamiHatasi) {
      return {
        ...temel,
        type: 'https://bnos.local/hatalar/tenant-baglami',
        title: 'TENANT_BAGLAMI',
        status: HttpStatus.FORBIDDEN,
        detail: hata.message,
        sonrakiEylem: 'Oturumu yenileyip tekrar deneyin.',
      };
    }

    if (hata instanceof OnbellekPolitikaHatasi || hata instanceof ParaHatasi) {
      return {
        ...temel,
        type: 'https://bnos.local/hatalar/is-kurali',
        title: 'IS_KURALI_IHLALI',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: hata.message,
      };
    }

    if (hata instanceof HttpException) {
      const yanit = hata.getResponse();
      const govde = typeof yanit === 'object' && yanit !== null ? (yanit as Record<string, unknown>) : {};
      const sonrakiEylem = metinVeyaYok(govde['sonrakiEylem']);
      return {
        ...temel,
        type: 'https://bnos.local/hatalar/http',
        title: hata.name,
        status: hata.getStatus(),
        detail: metinVeyaYok(govde['mesaj']) ?? metinVeyaYok(govde['message']) ?? hata.message,
        ...(sonrakiEylem ? { sonrakiEylem } : {}),
        ...(govde['gerekenIzinler'] ? { gerekenIzinler: govde['gerekenIzinler'] } : {}),
      };
    }

    return {
      ...temel,
      type: 'https://bnos.local/hatalar/beklenmeyen',
      title: 'BEKLENMEYEN_HATA',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'İstek işlenirken beklenmeyen bir sorun oluştu.',
      sonrakiEylem: `Sorun sürerse bu numarayla destek talebi açın: ${correlationId}`,
    };
  }
}
