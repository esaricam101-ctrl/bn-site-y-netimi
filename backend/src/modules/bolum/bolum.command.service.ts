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
import type { BolumGuncelleDto, BolumOlusturDto } from './dto/bolum.dto';
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
      katId: dto.katId ?? null,
      kapiNo: dto.kapiNo.trim(),
      icKapiNo: dto.icKapiNo?.trim() ?? null,
      kat: dto.kat,
      nitelik: dto.nitelik,
      daireTipi: dto.daireTipi ?? null,
      kullanimAmaci: dto.kullanimAmaci?.trim() ?? null,
      durum: dto.durum ?? 'AKTIF',
      brutM2: dto.brutM2,
      netM2: dto.netM2,
      arsaPayiPay: BigInt(dto.arsaPayiPay),
      arsaPayiPayda: BigInt(dto.arsaPayiPayda),
      aidatMuafiyeti: dto.aidatMuafiyeti ?? false,
      tapu: {
        ada: dto.tapuAda ?? null,
        parsel: dto.tapuParsel ?? null,
        pafta: dto.tapuPafta ?? null,
        bagimsizBolumNo: dto.tapuBagimsizBolumNo ?? null,
        cilt: dto.tapuCilt ?? null,
        sahife: dto.tapuSahife ?? null,
      },
    });
    const o = bolum.anlik();

    return this.prisma.tenantIslemi(async (tx) => {
      // Blok bu tenant'a AIT OLMALIDIR. Yabanci anahtar kisiti bunu yakalamaz:
      // PostgreSQL referans butunlugu tetikleyicileri tablo sahibi yetkisiyle
      // calisir ve RLS'i BAYPAS EDER. Kontrol yapilmazsa baska bir tenant'in
      // blok kimligi yazilabilir ve bolum, gormedigi bir bloga baglanir.
      if (o.blokId !== null) {
        const blok = await tx.blok.findFirst({
          where: { id: o.blokId, tenantId: principal.tenantId },
          select: { id: true },
        });
        if (!blok) throw new KayitBulunamadi(`Blok bulunamadı: ${o.blokId}`);
      }

      // Kat da tenant kapsamlidir; ayrica VERILEN BLOGA ait olmalidir, aksi
      // halde hiyerarsi tutarsizlasir (bolum A blogunda, kati B blogunda).
      if (o.katId !== null) {
        const kat = await tx.kat.findFirst({
          where: { id: o.katId, tenantId: principal.tenantId },
          select: { id: true, blokId: true, no: true },
        });
        if (!kat) throw new KayitBulunamadi(`Kat bulunamadı: ${o.katId}`);
        if (o.blokId !== null && kat.blokId !== o.blokId) {
          throw new IsKuraliIhlali(
            'Seçilen kat, seçilen bloğa ait değil.',
            'Kat ve blok seçimini kontrol edin.',
          );
        }
        if (kat.no !== o.kat) {
          throw new IsKuraliIhlali(
            `Kat numarası (${o.kat}) seçilen kat kaydıyla (${kat.no}) uyuşmuyor.`,
            'Kat numarasını kat kaydıyla eşitleyin.',
          );
        }
      }

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
          katId: o.katId,
          kapiNo: o.kapiNo,
          icKapiNo: o.icKapiNo,
          kat: o.kat,
          nitelik: o.nitelik,
          daireTipi: o.daireTipi,
          kullanimAmaci: o.kullanimAmaci,
          durum: o.durum,
          brutM2: o.brutM2,
          netM2: o.netM2,
          arsaPayiPay: o.arsaPayiPay,
          arsaPayiPayda: o.arsaPayiPayda,
          aidatMuafiyeti: o.aidatMuafiyeti,
          tapuAda: o.tapu.ada,
          tapuParsel: o.tapu.parsel,
          tapuPafta: o.tapu.pafta,
          tapuBagimsizBolumNo: o.tapu.bagimsizBolumNo,
          tapuCilt: o.tapu.cilt,
          tapuSahife: o.tapu.sahife,
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

  /**
   * Kısmi güncelleme.
   *
   * Ölçü değişikliği domain'e yeniden doğrulatılır: net m² brüt m²yi aşamaz.
   * Bu kural iki yerde yazılmaz — mevcut ve yeni değerler birleştirilip
   * `BagimsizBolum.olustur()` çağrılır.
   */
  async guncelle(
    id: string,
    dto: BolumGuncelleDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('bolum.guncelle');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bagimsizBolum.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${id}`);

      const kapiNo = dto.kapiNo?.trim() ?? kayit.kapiNo;
      const brutM2 = dto.brutM2 ?? kayit.brutM2.toNumber();
      const netM2 = dto.netM2 ?? kayit.netM2.toNumber();

      // Olcu ve nitelik kurallari domain'de; burada TEKRARLANMAZ.
      BagimsizBolum.olustur({
        id: kayit.id,
        tenantId: principal.tenantId,
        blokId: kayit.blokId,
        katId: kayit.katId,
        kapiNo,
        icKapiNo: dto.icKapiNo?.trim() ?? kayit.icKapiNo,
        kat: kayit.kat,
        nitelik: dto.nitelik ?? kayit.nitelik,
        daireTipi: dto.daireTipi ?? kayit.daireTipi,
        kullanimAmaci: dto.kullanimAmaci?.trim() ?? kayit.kullanimAmaci,
        durum: dto.durum ?? kayit.durum,
        brutM2,
        netM2,
        arsaPayiPay: kayit.arsaPayiPay,
        arsaPayiPayda: kayit.arsaPayiPayda,
        aidatMuafiyeti: dto.aidatMuafiyeti ?? kayit.aidatMuafiyeti,
        tapu: {
          ada: dto.tapuAda ?? kayit.tapuAda,
          parsel: dto.tapuParsel ?? kayit.tapuParsel,
          pafta: dto.tapuPafta ?? kayit.tapuPafta,
          bagimsizBolumNo: dto.tapuBagimsizBolumNo ?? kayit.tapuBagimsizBolumNo,
          cilt: dto.tapuCilt ?? kayit.tapuCilt,
          sahife: dto.tapuSahife ?? kayit.tapuSahife,
        },
      });

      if (kapiNo !== kayit.kapiNo) {
        const cakisan = await tx.bagimsizBolum.findFirst({
          where: {
            tenantId: principal.tenantId, blokId: kayit.blokId, kapiNo, id: { not: id },
          },
          select: { id: true },
        });
        if (cakisan) {
          throw new IsKuraliIhlali(
            `'${kapiNo}' kapı numarası bu blokta zaten kayıtlı.`,
            'Kapı numarasını kontrol edin.',
          );
        }
      }

      await tx.bagimsizBolum.update({
        where: { id },
        data: {
          ...(dto.kapiNo === undefined ? {} : { kapiNo }),
          ...(dto.icKapiNo === undefined ? {} : { icKapiNo: dto.icKapiNo.trim() }),
          ...(dto.nitelik === undefined ? {} : { nitelik: dto.nitelik }),
          ...(dto.daireTipi === undefined ? {} : { daireTipi: dto.daireTipi }),
          ...(dto.kullanimAmaci === undefined ? {} : { kullanimAmaci: dto.kullanimAmaci.trim() }),
          ...(dto.durum === undefined ? {} : { durum: dto.durum }),
          ...(dto.brutM2 === undefined ? {} : { brutM2: dto.brutM2 }),
          ...(dto.netM2 === undefined ? {} : { netM2: dto.netM2 }),
          ...(dto.aidatMuafiyeti === undefined ? {} : { aidatMuafiyeti: dto.aidatMuafiyeti }),
          ...(dto.tapuAda === undefined ? {} : { tapuAda: dto.tapuAda }),
          ...(dto.tapuParsel === undefined ? {} : { tapuParsel: dto.tapuParsel }),
          ...(dto.tapuPafta === undefined ? {} : { tapuPafta: dto.tapuPafta }),
          ...(dto.tapuBagimsizBolumNo === undefined ? {} : { tapuBagimsizBolumNo: dto.tapuBagimsizBolumNo }),
          ...(dto.tapuCilt === undefined ? {} : { tapuCilt: dto.tapuCilt }),
          ...(dto.tapuSahife === undefined ? {} : { tapuSahife: dto.tapuSahife }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BagimsizBolum', varlikId: id,
        oncekiDeger: {
          kapiNo: kayit.kapiNo, durum: kayit.durum,
          brutM2: kayit.brutM2.toNumber(), netM2: kayit.netM2.toNumber(),
        },
        sonrakiDeger: { kapiNo, durum: dto.durum ?? kayit.durum, brutM2, netM2 },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
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
