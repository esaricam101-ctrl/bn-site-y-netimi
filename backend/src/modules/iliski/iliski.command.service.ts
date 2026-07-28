/**
 * Bölüm ilişkisi Command servisi — malik / kiracı bağlama (ADR v1.1 §5).
 *
 * İlişkiler SİLİNMEZ, sonlandırılır. Borç sorumluluğu borcun oluştuğu anda
 * çözülüp kayda yazılır (snapshot); geçmiş bir ilişkiyi silmek o snapshot'ın
 * dayanağını ortadan kaldırır ve "bu borç neden bu kişide?" sorusu
 * cevapsız kalır. Kiracı taşındığında ilişki `bitis` alır, yok edilmez.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { iliskiyiDogrula, type BolumIliskisi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { IliskiKurDto } from './dto/iliski.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class IliskiCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async kur(bolumId: string, dto: IliskiKurDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iliski.kur');
    const id = randomUUID();

    const yeni: BolumIliskisi = {
      kisiId: dto.kisiId,
      rol: dto.rol,
      baslangic: takvimTarihi(dto.baslangic),
      bitis: dto.bitis === undefined ? null : takvimTarihi(dto.bitis),
    };

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      const kisi = await tx.kisi.findFirst({
        where: { id: dto.kisiId, tenantId: principal.tenantId },
        select: { id: true },
      });
      if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.kisiId}`);

      // Cakisma kontrolu domain'e aittir; burada yalnizca mevcut kayitlar
      // toplanir. NOT: kontrol ile yazma arasinda dar bir yaris penceresi
      // vardir — kalici cozum ortusme dislayan bir exclusion constraint'tir
      // (PostgreSQL EXCLUDE USING gist) ve migration gerektirir.
      const mevcutKayitlar = await tx.bolumIliskisi.findMany({
        where: { tenantId: principal.tenantId, bolumId, rol: dto.rol },
        select: { kisiId: true, rol: true, baslangic: true, bitis: true },
      });

      iliskiyiDogrula(
        mevcutKayitlar.map((m) => ({
          kisiId: m.kisiId,
          rol: m.rol,
          baslangic: takvimTarihiniOku(m.baslangic),
          bitis: takvimTarihiniOkuVeyaNull(m.bitis),
        })),
        yeni,
      );

      await tx.bolumIliskisi.create({
        data: {
          id, tenantId: principal.tenantId, bolumId,
          // `dto.rol` dar tiplidir (MALIK | KIRACI); `yeni.rol` domain'in genis
          // `BolumRolu` tipini tasir ve SAKIN'i da icerir. Prisma `IliskiRolu`
          // enum'unda SAKIN YOKTUR — eklenmesi migration gerektirir (DEVLOG TODO).
          // Bu yuzden veritabanina dar tip yazilir.
          kisiId: yeni.kisiId, rol: dto.rol,
          baslangic: takvimTarihiniYaz(yeni.baslangic),
          bitis: yeni.bitis === null ? null : takvimTarihiniYaz(yeni.bitis),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BolumIliskisi', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId: yeni.kisiId, rol: yeni.rol,
          baslangic: yeni.baslangic, bitis: yeni.bitis,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.bolum_iliskisi.kuruldu', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'BolumIliskisi', id, version: 1 },
        payload: { bolumId, kisiId: yeni.kisiId, rol: yeni.rol, baslangic: yeni.baslangic },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** İlişkiyi bitiş tarihi vererek kapatır. Kayıt silinmez. */
  async sonlandir(
    bolumId: string,
    iliskiId: string,
    bitisMetni: string,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iliski.sonlandir');
    const bitis = takvimTarihi(bitisMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bolumIliskisi.findFirst({
        where: { id: iliskiId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, rol: true, baslangic: true, bitis: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Bölüm ilişkisi bulunamadı: ${iliskiId}`);

      const oncekiBitis = takvimTarihiniOkuVeyaNull(kayit.bitis);

      // Bitis < baslangic kontrolu domain'de; bos mevcut kume ile cagrilir
      // cunku kaydin kendisiyle cakismasi anlamsizdir.
      iliskiyiDogrula([], {
        kisiId: kayit.kisiId,
        rol: kayit.rol,
        baslangic: takvimTarihiniOku(kayit.baslangic),
        bitis,
      });

      await tx.bolumIliskisi.update({
        where: { id: iliskiId },
        data: { bitis: takvimTarihiniYaz(bitis) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BolumIliskisi', varlikId: iliskiId,
        oncekiDeger: { bitis: oncekiBitis }, sonrakiDeger: { bitis },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.bolum_iliskisi.sonlandirildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'BolumIliskisi', id: iliskiId, version: 2 },
        payload: { bolumId, kisiId: kayit.kisiId, rol: kayit.rol, bitis },
      });

      return { id: iliskiId, durum: 'SONLANDIRILDI' };
    });
  }
}
