/**
 * Bağımsız bölüm Command servisi — 634 sayılı Kat Mülkiyeti Kanunu.
 *
 * Doğrulama kuralları BURADA TEKRARLANMAZ. `BagimsizBolum.olustur()` net/brüt
 * m² ilişkisini ve arsa payı sınırlarını zorlar; servis yalnızca kalıcılık,
 * denetim ve event sorumluluğunu taşır. Kural iki yerde yazılırsa biri eskir.
 *
 * Soft delete standardı (BFS v1 §5): bölüm ANA_VERİ sınıfındadır, gerekçe
 * zorunludur ve açık borcu olan bölüm silinemez — borç bölüme bağlıdır,
 * kişiye değil (ADR v1.1 §5).
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { BagimsizBolum } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { BolumOlusturDto } from './dto/bolum.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class BolumCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async olustur(dto: BolumOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('bolum.olustur');
    const id = randomUUID();

    // Domain aggregate'i once kurulur: gecersiz olcu ya da arsa payi
    // veritabanina hic ulasmaz.
    const bolum = BagimsizBolum.olustur({
      id,
      tenantId: principal.tenantId,
      blokId: dto.blokId ?? null,
      kapiNo: dto.kapiNo.trim(),
      kat: dto.kat,
      nitelik: dto.nitelik,
      brutM2: dto.brutM2,
      netM2: dto.netM2,
      arsaPayiPay: BigInt(dto.arsaPayiPay),
      arsaPayiPayda: BigInt(dto.arsaPayiPayda),
      aidatMuafiyeti: dto.aidatMuafiyeti ?? false,
    });
    const o = bolum.anlik();

    return this.prisma.tenantIslemi(async (tx) => {
      // Ayni blokta ayni kapi no iki kez bulunamaz. NOT: bu kontrol ile yazma
      // arasinda dar bir yaris penceresi vardir; kalici cozum (tenant_id,
      // blok_id, kapi_no) uzerinde kismi unique index'tir ve migration gerektirir.
      const mevcut = await tx.bagimsizBolum.findFirst({
        where: { tenantId: principal.tenantId, blokId: o.blokId, kapiNo: o.kapiNo },
        select: { id: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `'${o.kapiNo}' kapı numarası bu blokta zaten kayıtlı.`,
          'Kapı numarasını kontrol edin veya mevcut kaydı düzenleyin.',
        );
      }

      await tx.bagimsizBolum.create({
        data: {
          id: o.id,
          tenantId: o.tenantId,
          blokId: o.blokId,
          kapiNo: o.kapiNo,
          kat: o.kat,
          nitelik: o.nitelik,
          brutM2: o.brutM2,
          netM2: o.netM2,
          arsaPayiPay: o.arsaPayiPay,
          arsaPayiPayda: o.arsaPayiPayda,
          aidatMuafiyeti: o.aidatMuafiyeti,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BagimsizBolum', varlikId: o.id,
        sonrakiDeger: {
          kapiNo: o.kapiNo, kat: o.kat, nitelik: o.nitelik,
          brutM2: o.brutM2, netM2: o.netM2,
          // BigInt JSON'a serilestirilemez; denetim kaydinda metin tutulur.
          arsaPayi: `${o.arsaPayiPay}/${o.arsaPayiPayda}`,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.bagimsiz_bolum.olusturuldu', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'BagimsizBolum', id: o.id, version: 1 },
        payload: { kapiNo: o.kapiNo, nitelik: o.nitelik, blokId: o.blokId },
      });

      return { id: o.id, durum: 'AKTIF' };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('bolum.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bagimsizBolum.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${id}`);

      // ANA_VERI sinifi, gerekce zorunlu (BFS v1 §5.3).
      silmeyiDogrula(
        { varlik: 'BagimsizBolum', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      // Borc bagimsiz boluma baglidir (ADR v1.1 §5). Acik borcu olan bolum
      // silinirse borc sahipsiz kalir — kiraci degisimi bile borcu dusurmez.
      const acikBorc = await tx.borc.count({ where: { bolumId: id, kapandiMi: false } });
      if (acikBorc > 0) {
        throw new IsKuraliIhlali(
          `'${kayit.kapiNo}' nolu bölümün ${acikBorc} açık borç kaydı var; silinemez.`,
          'Önce borçları kapatın; borç bölüme bağlıdır ve sahipsiz bırakılamaz.',
        );
      }

      await tx.bagimsizBolum.update({
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
        varlik: 'BagimsizBolum', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.bagimsiz_bolum.silindi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'BagimsizBolum', id, version: 2 },
        payload: { gerekce, kapiNo: kayit.kapiNo },
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
