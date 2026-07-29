/**
 * Sakin Command servisi — fiilen oturan kişi.
 *
 * SAKİN, KİRACI DEĞİLDİR. Bir dairede:
 *   - malik oturabilir,
 *   - kiracı oturabilir,
 *   - malik oturmaz ama aile bireyleri oturabilir,
 *   - kiracı dışında başka sakinler bulunabilir.
 *
 * Bu yüzden bir bölümde AYNI ANDA BİRDEN ÇOK sakin geçerlidir; malik ve
 * kiracıdaki gibi bir tekillik kuralı YOKTUR. Tekillik zorlanırsa dört kişilik
 * bir ailenin yalnızca biri kaydedilebilirdi.
 *
 * Sakin kaydı borç sorumluluğu DOĞURMAZ — borç malike ya da kiracıya yazılır
 * (ADR v1.1 §5). Sakin listesi acil durum ve fiili yerleşim bilgisidir.
 *
 * KAYIT SİLİNMEZ; çıkışta dönem kapanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import {
  kisiyiCoz, plakalariYaz, type HizliKayitSonucu,
} from '../../common/kayit/hizli-kayit';
import type { SakinDuzeltDto, SakinEkleDto } from './dto/sakin.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class SakinCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async ekle(
    bolumId: string, dto: SakinEkleDto, principal: Principal,
  ): Promise<HizliKayitSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sakin.ekle');
    const id = randomUUID();

    const girisTarihi = takvimTarihi(dto.girisTarihi);
    const cikisTarihi = dto.cikisTarihi === undefined ? null : takvimTarihi(dto.cikisTarihi);

    if (cikisTarihi !== null && cikisTarihi < girisTarihi) {
      throw new IsKuraliIhlali(
        `Çıkış tarihi (${cikisTarihi}) giriş tarihinden (${girisTarihi}) önce olamaz.`,
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      // Kişi ya seçilir ya bu bilgilerden oluşturulur. `kisiyiCoz` tenant
      // aidiyetini de doğrular — FK kontrolü RLS'i baypas eder.
      const cozum = await kisiyiCoz(tx, principal.tenantId, {
        ...(dto.kisi ?? {}),
        ...(dto.kisiId === undefined ? {} : { kisiId: dto.kisiId }),
      });
      const kisiId = cozum.kisiId;

      // Coklu sakin serbesttir; yalnizca AYNI kisinin ayni bolumde acik bir
      // kaydinin iki kez olusmasi engellenir — bu bir veri girisi hatasidir.
      const acikKayit = await tx.sakin.findFirst({
        where: {
          tenantId: principal.tenantId, bolumId, kisiId, cikisTarihi: null,
        },
        select: { id: true },
      });
      if (acikKayit) {
        throw new IsKuraliIhlali(
          `Bu kişi '${bolum.kapiNo}' bölümünde zaten açık bir sakin kaydına sahip.`,
          'Önce mevcut kaydın çıkışını verin.',
        );
      }

      await tx.sakin.create({
        data: {
          id, tenantId: principal.tenantId, bolumId, kisiId,
          yakinlikDerecesi: dto.yakinlikDerecesi ?? 'KENDISI',
          girisTarihi: takvimTarihiniYaz(girisTarihi),
          cikisTarihi: cikisTarihi === null ? null : takvimTarihiniYaz(cikisTarihi),
          acilDurumKisiAdi: dto.acilDurumKisiAdi ?? null,
          acilDurumTelefon: dto.acilDurumTelefon ?? null,
        },
      });

      // Plakalar AYNI İŞLEMDE yazılır: hata verirse sakin kaydı da geri alınır.
      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId,
        sahip: { kisiId },
        baslangic: girisTarihi,
        bitis: cikisTarihi,
        plakalar: dto.kisi?.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Sakin', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId,
          kisiOlusturulduMu: cozum.olusturulduMu,
          yakinlikDerecesi: dto.yakinlikDerecesi ?? 'KENDISI',
          girisTarihi, cikisTarihi,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.sakin.eklendi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Sakin', id, version: 1 },
        payload: { bolumId, kisiId, girisTarihi },
      });

      return {
        id,
        durum: 'AKTIF',
        kisiId,
        kisiOlusturulduMu: cozum.olusturulduMu,
        tcIleEslestiMi: cozum.tcIleEslestiMi,
        plakaSayisi: plakalar.length,
      };
    });
  }

  /**
   * Sakin bilgisi düzeltme. KİŞİ değiştirilemez — kaydın kimliğidir.
   *
   * Giriş tarihi düzeltilirse çıkış tarihiyle sırası yeniden denetlenir.
   */
  async duzelt(
    bolumId: string,
    sakinId: string,
    dto: SakinDuzeltDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sakin.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sakin.findFirst({
        where: { id: sakinId, bolumId, tenantId: principal.tenantId },
        select: {
          id: true, yakinlikDerecesi: true, girisTarihi: true, cikisTarihi: true,
          acilDurumKisiAdi: true, acilDurumTelefon: true,
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Sakin kaydı bulunamadı: ${sakinId}`);

      const yeniGiris = dto.girisTarihi === undefined ? undefined : takvimTarihi(dto.girisTarihi);
      const mevcutCikis = takvimTarihiniOkuVeyaNull(kayit.cikisTarihi);

      if (yeniGiris !== undefined && mevcutCikis !== null && mevcutCikis < yeniGiris) {
        throw new IsKuraliIhlali(
          `Giriş tarihi (${yeniGiris}) mevcut çıkış tarihinden (${mevcutCikis}) sonra olamaz.`,
          'Önce çıkış tarihini düzeltin.',
        );
      }

      await tx.sakin.update({
        where: { id: sakinId },
        data: {
          ...(dto.yakinlikDerecesi === undefined ? {} : { yakinlikDerecesi: dto.yakinlikDerecesi }),
          ...(yeniGiris === undefined ? {} : { girisTarihi: takvimTarihiniYaz(yeniGiris) }),
          ...(dto.acilDurumKisiAdi === undefined ? {} : { acilDurumKisiAdi: dto.acilDurumKisiAdi }),
          ...(dto.acilDurumTelefon === undefined ? {} : { acilDurumTelefon: dto.acilDurumTelefon }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Sakin', varlikId: sakinId,
        oncekiDeger: {
          yakinlikDerecesi: kayit.yakinlikDerecesi,
          girisTarihi: takvimTarihiniOku(kayit.girisTarihi),
          acilDurumKisiAdi: kayit.acilDurumKisiAdi,
          acilDurumTelefon: kayit.acilDurumTelefon,
        },
        sonrakiDeger: {
          yakinlikDerecesi: dto.yakinlikDerecesi ?? kayit.yakinlikDerecesi,
          girisTarihi: yeniGiris ?? takvimTarihiniOku(kayit.girisTarihi),
          acilDurumKisiAdi: dto.acilDurumKisiAdi ?? kayit.acilDurumKisiAdi,
          acilDurumTelefon: dto.acilDurumTelefon ?? kayit.acilDurumTelefon,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: sakinId, durum: 'GUNCELLENDI' };
    });
  }

  /** Çıkış — dönem kapanır, kayıt silinmez. */
  async cikisVer(
    bolumId: string,
    sakinId: string,
    cikisMetni: string,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sakin.cikis');
    const cikisTarihi = takvimTarihi(cikisMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sakin.findFirst({
        where: { id: sakinId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, girisTarihi: true, cikisTarihi: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Sakin kaydı bulunamadı: ${sakinId}`);

      const girisTarihi = takvimTarihiniOku(kayit.girisTarihi);
      if (cikisTarihi < girisTarihi) {
        throw new IsKuraliIhlali(
          `Çıkış tarihi (${cikisTarihi}) giriş tarihinden (${girisTarihi}) önce olamaz.`,
        );
      }

      const oncekiCikis = takvimTarihiniOkuVeyaNull(kayit.cikisTarihi);

      await tx.sakin.update({
        where: { id: sakinId },
        data: { cikisTarihi: takvimTarihiniYaz(cikisTarihi) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Sakin', varlikId: sakinId,
        oncekiDeger: { cikisTarihi: oncekiCikis }, sonrakiDeger: { cikisTarihi },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.sakin.cikti', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Sakin', id: sakinId, version: 2 },
        payload: { bolumId, kisiId: kayit.kisiId, cikisTarihi },
      });

      return { id: sakinId, durum: 'CIKIS_VERILDI' };
    });
  }
}
