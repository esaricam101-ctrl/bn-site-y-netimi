/**
 * Outbox — ADR v1.1 §31 · AIS v1 §4.2
 *
 * EVENT SOURCING KULLANILMAZ. Outbox teslimat garantisi içindir,
 * kayıt kaynağı olduğu için değil. Event kaybı veri kaybı değildir.
 *
 * KRİTİK: Event, domain yazmasıyla AYNI TRANSACTION içinde outbox'a yazılır.
 * Ayrı yazılsaydı, kayıt başarılı olup event kaybolabilirdi (veya tersi).
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { eventOlustur, type EventGirdisi } from '@bnos/core-domain';

@Injectable()
export class OutboxServisi {
  /**
   * Event'i standart zarfla üretir, katalog kaydını doğrular ve outbox'a yazar.
   * Katalogda olmayan event üretilemez (sözleşme testi CT-03).
   */
  async yayinla<T>(
    tx: Prisma.TransactionClient,
    girdi: EventGirdisi<T>,
  ): Promise<string> {
    const eventId = randomUUID();
    const zarf = eventOlustur(girdi, eventId, new Date());

    await tx.outboxKayit.create({
      data: {
        id: eventId,
        tenantId: zarf.tenantId,
        eventType: zarf.eventType,
        eventVersion: zarf.eventVersion,
        zarf: zarf as unknown as Prisma.InputJsonValue,
        olusturulmaTarihi: zarf.occurredAt,
        yayinlanmaTarihi: null,
        denemeSayisi: 0,
      },
    });
    return eventId;
  }
}
