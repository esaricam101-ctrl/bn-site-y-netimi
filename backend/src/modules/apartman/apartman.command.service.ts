/**
 * Apartman Command servisi — ADR-0008.
 *
 * Hiyerarşinin tenant altındaki ilk katmanıdır:
 *   Tenant → Apartman → Blok → Kat → BagimsizBolum
 *
 * Tek apartmanlı tenant'ta burada bir kayıt bulunur; site tipi tenant'ta
 * birden çok. Tenant sınırı AŞILMAZ — hepsi aynı `tenant_id` altındadır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { ApartmanOlusturDto } from './dto/apartman.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class ApartmanCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async olustur(dto: ApartmanOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('apartman.olustur');
    const id = randomUUID();
    const ad = dto.ad.trim();

    return this.prisma.tenantIslemi(async (tx) => {
      const mevcut = await tx.apartman.findFirst({
        where: { tenantId: principal.tenantId, ad },
        select: { id: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `'${ad}' adında bir apartman bu yerleşkede zaten var.`,
          'Farklı bir apartman adı kullanın.',
        );
      }

      await tx.apartman.create({
        data: {
          id, tenantId: principal.tenantId, ad,
          adres: dto.adres?.trim() ?? null,
          siteIciKod: dto.siteIciKod?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Apartman', varlikId: id,
        sonrakiDeger: { ad, adres: dto.adres ?? null, siteIciKod: dto.siteIciKod ?? null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.apartman.olusturuldu', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Apartman', id, version: 1 },
        payload: { ad },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('apartman.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.apartman.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, ad: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Apartman bulunamadı: ${id}`);

      silmeyiDogrula(
        { varlik: 'Apartman', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      // Referans butunlugu: bloklu apartman silinirse bloklar sahipsiz kalir.
      const blokSayisi = await tx.blok.count({ where: { apartmanId: id } });
      if (blokSayisi > 0) {
        throw new IsKuraliIhlali(
          `'${kayit.ad}' apartmanında ${blokSayisi} blok var; apartman silinemez.`,
          'Önce blokları silin veya başka bir apartmana taşıyın.',
        );
      }

      await tx.apartman.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Apartman', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.apartman.silindi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Apartman', id, version: 2 },
        payload: { gerekce, ad: kayit.ad },
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
