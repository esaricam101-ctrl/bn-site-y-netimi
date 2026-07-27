/**
 * Kat Command servisi.
 *
 * Kat, blok içindeki düzeydir: Tenant → Apartman → Blok → **Kat** →
 * BagimsizBolum. Üst kayıt olmadan alt kayıt oluşturulamaz; blok doğrulanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { KatOlusturDto } from './dto/kat.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class KatCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async olustur(dto: KatOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kat.olustur');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      // Blok bu tenant'a ait olmalidir. FK kontrolu bunu YAKALAMAZ: PostgreSQL
      // referans butunlugu tetikleyicileri tablo sahibi yetkisiyle calisir ve
      // RLS'i baypas eder.
      const blok = await tx.blok.findFirst({
        where: { id: dto.blokId, tenantId: principal.tenantId },
        select: { id: true, ad: true },
      });
      if (!blok) throw new KayitBulunamadi(`Blok bulunamadı: ${dto.blokId}`);

      const mevcut = await tx.kat.findFirst({
        where: { tenantId: principal.tenantId, blokId: dto.blokId, no: dto.no },
        select: { id: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `'${blok.ad}' bloğunda ${dto.no}. kat zaten tanımlı.`,
          'Kat numarasını kontrol edin.',
        );
      }

      await tx.kat.create({
        data: {
          id, tenantId: principal.tenantId, blokId: dto.blokId,
          no: dto.no, ad: dto.ad?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Kat', varlikId: id,
        sonrakiDeger: { blokId: dto.blokId, no: dto.no, ad: dto.ad ?? null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.kat.olusturuldu', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kat', id, version: 1 },
        payload: { blokId: dto.blokId, no: dto.no },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kat.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.kat.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, no: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Kat bulunamadı: ${id}`);

      silmeyiDogrula(
        { varlik: 'Kat', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      const bolumSayisi = await tx.bagimsizBolum.count({ where: { katId: id } });
      if (bolumSayisi > 0) {
        throw new IsKuraliIhlali(
          `${kayit.no}. katta ${bolumSayisi} bağımsız bölüm var; kat silinemez.`,
          'Önce bölümleri başka bir kata taşıyın veya silin.',
        );
      }

      await tx.kat.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Kat', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.kat.silindi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kat', id, version: 2 },
        payload: { gerekce, no: kayit.no },
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
