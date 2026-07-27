/**
 * Tenant Command servisi — CQRS (ADR v1.1 §32 · BFS v1 §6)
 *
 * Kurallar:
 *   1. Command hiçbir koşulda okuma amaçlı kullanılmaz
 *   2. Command TAM OKUMA MODELİ DÖNDÜRMEZ — { id, durum } döndürür
 *   5. Transaction sınırı YALNIZCA burada
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { tenantId, type Principal } from '@bnos/kernel';
import { Tenant, CakismaHatasi, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { TenantOlusturDto } from './dto/tenant.dto';

/** Command yanıtı — tam nesne DEĞİL (§32 kural 2). */
export interface KomutSonucu {
  readonly id: string;
  readonly durum: string;
}

@Injectable()
export class TenantCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async olustur(dto: TenantOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('tenant.olustur');
    const id = randomUUID();

    // Domain kuralları önce çalışır — geçersiz veri veritabanına ulaşmaz.
    const tenant = Tenant.olustur({
      id: tenantId(id),
      kod: dto.kod,
      ad: dto.ad,
      tip: 'APARTMAN',
      durum: 'KURULUM',
      saatDilimi: dto.saatDilimi ?? 'Europe/Istanbul',
      paraBirimi: 'TRY',
      lisansKodu: dto.lisansKodu ?? 'BNOS-APT-V1',
    });

    return this.prisma.sistemIslemi(async (tx) => {
      const mevcut = await tx.tenant.findUnique({ where: { kod: dto.kod } });
      if (mevcut) {
        throw new CakismaHatasi(
          `'${dto.kod}' kodu başka bir apartman tarafından kullanılıyor.`,
          'Farklı bir kod seçin.',
        );
      }

      const mevcutKod = await tx.tenant.findUnique({ where: { kod: dto.kod } });
      if (mevcutKod) {
        throw new CakismaHatasi(
          `'${dto.kod}' kodu başka bir apartman tarafından kullanılıyor.`,
          'Farklı bir kod seçin.',
        );
      }

      const a = tenant.anlik();
      await tx.tenant.create({
        data: {
          id: a.id, kod: a.kod, ad: a.ad, tip: a.tip, durum: a.durum,
          saatDilimi: a.saatDilimi, paraBirimi: a.paraBirimi, lisansKodu: a.lisansKodu,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: a.id, principal, eylem: 'OLUSTUR',
        varlik: 'Tenant', varlikId: a.id,
        sonrakiDeger: { kod: a.kod, ad: a.ad, durum: a.durum },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'core.tenant.olusturuldu', eventVersion: 1,
        tenantId: a.id, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Tenant', id: a.id, version: 1 },
        payload: { kod: a.kod, ad: a.ad },
      });

      // Tam okuma modeli DEĞİL — istemci gerekiyorsa Query çağırır.
      return { id: a.id, durum: a.durum };
    });
  }

  async aktiflestir(id: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('tenant.aktiflestir');

    return this.prisma.sistemIslemi(async (tx) => {
      const kayit = await tx.tenant.findUnique({ where: { id } });
      if (!kayit) throw new KayitBulunamadi(`Apartman bulunamadı: ${id}`);

      const tenant = Tenant.olustur({
        id: tenantId(kayit.id), kod: kayit.kod, ad: kayit.ad,
        tip: kayit.tip, durum: kayit.durum,
        saatDilimi: kayit.saatDilimi, paraBirimi: 'TRY', lisansKodu: kayit.lisansKodu,
      });
      const aktif = tenant.aktiflestir();

      await tx.tenant.update({ where: { id }, data: { durum: aktif.durum } });

      await this.audit.yaz(tx, {
        tenantId: aktif.id, principal, eylem: 'GUNCELLE',
        varlik: 'Tenant', varlikId: id,
        oncekiDeger: { durum: kayit.durum }, sonrakiDeger: { durum: aktif.durum },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'core.tenant.aktiflestirildi', eventVersion: 1,
        tenantId: aktif.id, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Tenant', id, version: 2 },
        payload: { kod: aktif.kod },
      });

      return { id, durum: aktif.durum };
    });
  }
}
