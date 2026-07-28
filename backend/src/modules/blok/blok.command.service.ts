/**
 * Blok Command servisi.
 *
 * Blok, bağımsız bölümleri gruplayan yapıdır; tek bloklu apartmanlarda hiç
 * kullanılmayabilir. `BagimsizBolum.blokId` bu kayda işaret eder.
 *
 * Soft delete standardı (BFS v1 §5): ANA_VERİ sınıfı, gerekçe zorunlu.
 * Bölümü olan blok silinemez — silinirse bölümler sahipsiz bir kimliğe
 * işaret eder ve mükerrer kapı no kontrolü (blok bazlıdır) anlamını yitirir.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { BlokGuncelleDto, BlokOlusturDto } from './dto/blok.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class BlokCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async olustur(dto: BlokOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('blok.olustur');
    const id = randomUUID();
    const ad = dto.ad.trim();

    return this.prisma.tenantIslemi(async (tx) => {
      // Apartman bu tenant'a ait olmalidir. FK kontrolu bunu YAKALAMAZ:
      // PostgreSQL referans butunlugu tetikleyicileri RLS'i baypas eder.
      const apartman = await tx.apartman.findFirst({
        where: { id: dto.apartmanId, tenantId: principal.tenantId },
        select: { id: true, ad: true },
      });
      if (!apartman) throw new KayitBulunamadi(`Apartman bulunamadı: ${dto.apartmanId}`);

      // Blok adi APARTMAN icinde tekildir — sitede iki apartmanin da 'A Blok'u olabilir.
      const mevcut = await tx.blok.findFirst({
        where: { tenantId: principal.tenantId, apartmanId: dto.apartmanId, ad },
        select: { id: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `'${apartman.ad}' apartmanında '${ad}' adında bir blok zaten var.`,
          'Farklı bir blok adı kullanın.',
        );
      }

      await tx.blok.create({
        data: { id, tenantId: principal.tenantId, apartmanId: dto.apartmanId, ad },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Blok', varlikId: id,
        sonrakiDeger: { ad, apartmanId: dto.apartmanId },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.blok.olusturuldu', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Blok', id, version: 1 },
        payload: { ad, apartmanId: dto.apartmanId },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** Kısmi güncelleme. Blok başka bir apartmana TAŞINMAZ — hiyerarşi sabittir. */
  async guncelle(id: string, dto: BlokGuncelleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('blok.guncelle');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.blok.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, ad: true, apartmanId: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Blok bulunamadı: ${id}`);

      const yeniAd = dto.ad?.trim();
      if (yeniAd !== undefined && yeniAd !== kayit.ad) {
        // Tekillik APARTMAN icindedir; sitede iki apartmanin da 'A Blok'u olabilir.
        const cakisan = await tx.blok.findFirst({
          where: {
            tenantId: principal.tenantId, apartmanId: kayit.apartmanId,
            ad: yeniAd, id: { not: id },
          },
          select: { id: true },
        });
        if (cakisan) {
          throw new IsKuraliIhlali(
            `Bu apartmanda '${yeniAd}' adında bir blok zaten var.`,
            'Farklı bir blok adı kullanın.',
          );
        }
        await tx.blok.update({ where: { id }, data: { ad: yeniAd } });
      }

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Blok', varlikId: id,
        oncekiDeger: { ad: kayit.ad }, sonrakiDeger: { ad: yeniAd ?? kayit.ad },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('blok.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.blok.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, ad: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Blok bulunamadı: ${id}`);

      silmeyiDogrula(
        { varlik: 'Blok', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      // Soft delete uzantisi silinmis bolumleri zaten disarida birakir;
      // burada sayilanlar yalnizca YASAYAN bolumlerdir.
      const bolumSayisi = await tx.bagimsizBolum.count({ where: { blokId: id } });
      if (bolumSayisi > 0) {
        throw new IsKuraliIhlali(
          `'${kayit.ad}' bloğunda ${bolumSayisi} bağımsız bölüm var; blok silinemez.`,
          'Önce bölümleri başka bir bloğa taşıyın veya silin.',
        );
      }

      await tx.blok.update({
        where: { id },
        data: {
          silindiMi: true,
          silinmeTarihi: new Date(),
          silenKullanici: principal.id,
          silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Blok', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.blok.silindi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Blok', id, version: 2 },
        payload: { gerekce, ad: kayit.ad },
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
