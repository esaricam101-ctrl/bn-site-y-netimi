/**
 * Kişi Command servisi.
 *
 * Soft delete standardı burada uygulanır (BFS v1 §5):
 *   - Kişi ANA_VERİ sınıfındadır → soft delete
 *   - Gerekçe zorunludur
 *   - SilinebilirlikPolitikasi kontrol edilir (açık borcu olan kişi silinemez)
 *   - KVKK silme talebi AYRI bir işlemdir: anonimleştirme (Sprint 9)
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { KisiOlusturDto } from './dto/kisi.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class KisiCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async olustur(dto: KisiOlusturDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kisi.olustur');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      await tx.kisi.create({
        data: {
          id, tenantId: principal.tenantId,
          ad: dto.ad, soyad: dto.soyad,
          eposta: dto.eposta ?? null, telefon: dto.telefon ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Kisi', varlikId: id,
        sonrakiDeger: { ad: dto.ad, soyad: dto.soyad, eposta: dto.eposta },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'core.kisi.olusturuldu', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kisi', id, version: 1 },
        payload: { ad: dto.ad, soyad: dto.soyad },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kisi.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kisi = await tx.kisi.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${id}`);

      // Domain politikası: ANA_VERI sınıfı, gerekçe zorunlu (BFS v1 §5.3).
      silmeyiDogrula(
        { varlik: 'Kisi', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      // SilinebilirlikPolitikasi — bağımlılık kontrolü VERİ olarak tanımlıdır,
      // koda gömülmez. v1'de tek kural: açık borç sorumluluğu.
      const acikBorc = await tx.borcSorumlusu.count({
        where: { kisiId: id, borc: { kapandiMi: false } },
      });
      if (acikBorc > 0) {
        throw new IsKuraliIhlali(
          `Bu kişinin ${acikBorc} açık borç kaydı var; silinemez.`,
          'Önce borçları kapatın veya sorumluluğu devredin.',
        );
      }

      await tx.kisi.update({
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
        varlik: 'Kisi', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'core.kisi.silindi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kisi', id, version: 2 },
        payload: { gerekce },
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
