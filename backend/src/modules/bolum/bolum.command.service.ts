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
import {
  BagimsizBolum, kesirleriTopla, kesirOrani, tamiEdiyorMu,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type {
  ArsaPayiDuzeltDto, BolumGuncelleDto, BolumOlusturDto, BolumTasiDto,
  TopluBolumOlusturDto,
} from './dto/bolum.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/** Toplu düzeltme sonucu — tek kayıt değil, etkilenen satır sayısı döner. */
export interface TopluSonuc {
  readonly etkilenen: number;
  readonly durum: string;
}

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

  /**
   * Bölümleri TOPLU oluşturur.
   *
   * Kırk daireli bir binayı tek tek girmek operasyonel olarak kullanılamaz.
   * Tek transaction: bir satır geçersizse hiçbiri yazılmaz — yarım girilmiş bir
   * kat, arsa payı toplamını da yarım bırakır ve neyin eksik olduğu görünmez.
   *
   * Her satır domain aggregate'inden geçer; ölçü kuralları burada tekrarlanmaz.
   */
  async topluOlustur(
    dto: TopluBolumOlusturDto,
    principal: Principal,
  ): Promise<TopluSonuc> {
    const baglam = mevcutBaglamiZorunluKil('bolum.topluOlustur');

    // Parti icindeki mukerrer kapi no, veritabanina hic gitmeden yakalanir.
    const kapiSayaci = new Map<string, number>();
    for (const b of dto.bolumler) {
      const k = b.kapiNo.trim();
      kapiSayaci.set(k, (kapiSayaci.get(k) ?? 0) + 1);
    }
    const mukerrer = Array.from(kapiSayaci.entries()).filter(([, n]) => n > 1).map(([k]) => k);
    if (mukerrer.length > 0) {
      throw new IsKuraliIhlali(
        `Listede mükerrer kapı numarası var: ${mukerrer.join(', ')}.`,
        'Aynı blokta iki bölüm aynı kapı numarasını taşıyamaz.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const blok = await tx.blok.findFirst({
        where: { id: dto.blokId, tenantId: principal.tenantId },
        select: { id: true, ad: true },
      });
      if (!blok) throw new KayitBulunamadi(`Blok bulunamadı: ${dto.blokId}`);

      if (dto.katId !== undefined) {
        const kat = await tx.kat.findFirst({
          where: { id: dto.katId, tenantId: principal.tenantId },
          select: { id: true, no: true, blokId: true },
        });
        if (!kat) throw new KayitBulunamadi(`Kat bulunamadı: ${dto.katId}`);
        if (kat.blokId !== dto.blokId) {
          throw new IsKuraliIhlali(
            'Seçilen kat, seçilen bloğa ait değil.',
            'Kat ve blok seçimini kontrol edin.',
          );
        }
        if (kat.no !== dto.kat) {
          throw new IsKuraliIhlali(
            `Kat numarası (${dto.kat}) seçilen kat kaydıyla (${kat.no}) uyuşmuyor.`,
            'Kat numarasını kat kaydıyla eşitleyin.',
          );
        }
      }

      const mevcutlar = await tx.bagimsizBolum.findMany({
        where: { tenantId: principal.tenantId, blokId: dto.blokId },
        select: { kapiNo: true },
      });
      const dolu = new Set(mevcutlar.map((m) => m.kapiNo));
      const cakisan = dto.bolumler.map((b) => b.kapiNo.trim()).filter((k) => dolu.has(k));
      if (cakisan.length > 0) {
        throw new IsKuraliIhlali(
          `'${blok.ad}' bloğunda şu kapı numaraları zaten kayıtlı: ${cakisan.join(', ')}.`,
          'Çakışan satırları listeden çıkarın.',
        );
      }

      // Once TUM satirlar domain'den gecirilir; biri gecersizse hicbiri yazilmaz.
      const hazir = dto.bolumler.map((b) =>
        BagimsizBolum.olustur({
          id: randomUUID(),
          tenantId: principal.tenantId,
          blokId: dto.blokId,
          katId: dto.katId ?? null,
          kapiNo: b.kapiNo.trim(),
          icKapiNo: b.icKapiNo?.trim() ?? null,
          kat: dto.kat,
          nitelik: b.nitelik ?? 'MESKEN',
          daireTipi: b.daireTipi ?? null,
          kullanimAmaci: null,
          durum: 'AKTIF',
          brutM2: b.brutM2,
          netM2: b.netM2,
          arsaPayiPay: BigInt(b.arsaPayiPay),
          arsaPayiPayda: BigInt(b.arsaPayiPayda),
          aidatMuafiyeti: b.aidatMuafiyeti ?? false,
          tapu: {
            ada: null, parsel: null, pafta: null,
            bagimsizBolumNo: null, cilt: null, sahife: null,
          },
        }).anlik(),
      );

      await tx.bagimsizBolum.createMany({
        data: hazir.map((o) => ({
          id: o.id, tenantId: o.tenantId, blokId: o.blokId, katId: o.katId,
          kapiNo: o.kapiNo, icKapiNo: o.icKapiNo, kat: o.kat,
          nitelik: o.nitelik, daireTipi: o.daireTipi, durum: o.durum,
          brutM2: o.brutM2, netM2: o.netM2,
          arsaPayiPay: o.arsaPayiPay, arsaPayiPayda: o.arsaPayiPayda,
          aidatMuafiyeti: o.aidatMuafiyeti,
        })),
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BagimsizBolum', varlikId: hazir.map((o) => o.id).join(','),
        sonrakiDeger: {
          blokId: dto.blokId, katId: dto.katId ?? null, kat: dto.kat,
          kapiNolar: hazir.map((o) => o.kapiNo),
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      // Her bolum icin ayri event: tuketiciler tek tek bolume tepki verir.
      for (const o of hazir) {
        await this.outbox.yayinla(tx, {
          eventType: 'apartman.bagimsiz_bolum.olusturuldu', eventVersion: 1,
          tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
          aggregate: { tip: 'BagimsizBolum', id: o.id, version: 1 },
          payload: { kapiNo: o.kapiNo, nitelik: o.nitelik, blokId: o.blokId },
        });
      }

      return { etkilenen: hazir.length, durum: 'OLUSTURULDU' };
    });
  }

  /**
   * Bölümleri başka bir blok/kata taşır — TOPLU.
   *
   * Hiyerarşi denetiminin raporladığı sorunların düzeltme akışıdır. Tek
   * transaction: biri başarısız olursa hiçbiri taşınmaz. Yarım kalan bir
   * taşıma, hiyerarşiyi denetimin bulduğundan daha bozuk bırakırdı.
   *
   * Kapı no tekilliği BLOK bazlıdır; hedef blokta çakışma varsa taşıma
   * reddedilir. `hedefKatId` verilirse bölümün `kat` alanı katın numarasıyla
   * EŞİTLENİR — aksi halde `KAT_NO_UYUSMAZLIGI` üretirdik.
   */
  async tasi(dto: BolumTasiDto, principal: Principal): Promise<TopluSonuc> {
    const baglam = mevcutBaglamiZorunluKil('bolum.tasi');
    const benzersizIdler = Array.from(new Set<string>(dto.bolumIdler));

    return this.prisma.tenantIslemi(async (tx) => {
      const blok = await tx.blok.findFirst({
        where: { id: dto.hedefBlokId, tenantId: principal.tenantId },
        select: { id: true, ad: true },
      });
      if (!blok) throw new KayitBulunamadi(`Hedef blok bulunamadı: ${dto.hedefBlokId}`);

      let hedefKatNo: number | null = null;
      if (dto.hedefKatId !== undefined) {
        const kat = await tx.kat.findFirst({
          where: { id: dto.hedefKatId, tenantId: principal.tenantId },
          select: { id: true, no: true, blokId: true },
        });
        if (!kat) throw new KayitBulunamadi(`Hedef kat bulunamadı: ${dto.hedefKatId}`);
        if (kat.blokId !== dto.hedefBlokId) {
          throw new IsKuraliIhlali(
            'Hedef kat, hedef bloğa ait değil.',
            'Kat ve blok seçimini kontrol edin.',
          );
        }
        hedefKatNo = kat.no;
      }

      const bolumler = await tx.bagimsizBolum.findMany({
        where: { id: { in: benzersizIdler }, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true, blokId: true, katId: true, kat: true },
      });
      if (bolumler.length !== benzersizIdler.length) {
        const bulunan = new Set(bolumler.map((b) => b.id));
        const eksik = benzersizIdler.filter((id) => !bulunan.has(id));
        throw new KayitBulunamadi(`Bazı bölümler bulunamadı: ${eksik.join(', ')}`);
      }

      // Hedef bloktaki mevcut kapi numaralari — tasinanlar haric.
      const tasinanKumesi = new Set(benzersizIdler);
      const hedeftekiler = await tx.bagimsizBolum.findMany({
        where: { tenantId: principal.tenantId, blokId: dto.hedefBlokId },
        select: { id: true, kapiNo: true },
      });
      const doluKapiNolar = new Set(
        hedeftekiler.filter((b) => !tasinanKumesi.has(b.id)).map((b) => b.kapiNo),
      );

      const cakisanlar = bolumler.filter((b) => doluKapiNolar.has(b.kapiNo));
      if (cakisanlar.length > 0) {
        throw new IsKuraliIhlali(
          `'${blok.ad}' bloğunda şu kapı numaraları zaten dolu: ` +
            `${cakisanlar.map((b) => b.kapiNo).join(', ')}.`,
          'Çakışan bölümlerin kapı numaralarını değiştirin veya farklı bir blok seçin.',
        );
      }

      // Tasinanlarin kendi aralarinda da mukerrer kapi no olmamali.
      const kapiSayaci = new Map<string, number>();
      for (const b of bolumler) kapiSayaci.set(b.kapiNo, (kapiSayaci.get(b.kapiNo) ?? 0) + 1);
      const mukerrer = Array.from(kapiSayaci.entries()).filter(([, n]) => n > 1).map(([k]) => k);
      if (mukerrer.length > 0) {
        throw new IsKuraliIhlali(
          `Taşınan bölümler arasında mükerrer kapı numarası var: ${mukerrer.join(', ')}.`,
          'Aynı blokta iki bölüm aynı kapı numarasını taşıyamaz.',
        );
      }

      await tx.bagimsizBolum.updateMany({
        where: { id: { in: benzersizIdler }, tenantId: principal.tenantId },
        data: {
          blokId: dto.hedefBlokId,
          katId: dto.hedefKatId ?? null,
          ...(hedefKatNo === null ? {} : { kat: hedefKatNo }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BagimsizBolum', varlikId: benzersizIdler.join(','),
        oncekiDeger: {
          bolumler: bolumler.map((b) => ({
            id: b.id, kapiNo: b.kapiNo, blokId: b.blokId, katId: b.katId, kat: b.kat,
          })),
        },
        sonrakiDeger: {
          hedefBlokId: dto.hedefBlokId, hedefKatId: dto.hedefKatId ?? null, kat: hedefKatNo,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.bagimsiz_bolum.tasindi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'BagimsizBolum', id: dto.hedefBlokId, version: 1 },
        payload: {
          bolumIdler: benzersizIdler,
          hedefBlokId: dto.hedefBlokId,
          hedefKatId: dto.hedefKatId ?? null,
          gerekce: dto.gerekce,
        },
      });

      return { etkilenen: benzersizIdler.length, durum: 'TASINDI' };
    });
  }

  /**
   * Arsa paylarını TOPLU düzeltir — KMK md. 3.
   *
   * Tek bölümün arsa payını değiştirmek binanın toplamını sessizce bozar; bu
   * yüzden `guncelle` arsa payına dokunmaz. Burada işlem SONUNDAKİ toplam
   * hesaplanır: gönderilen satırlar + DOKUNULMAYAN bölümler. Toplam tamı
   * etmiyorsa hiçbir satır yazılmaz.
   *
   * Doğrulama kayıpsız kesir aritmetiğiyle yapılır — ölçekli tam sayı toplamı
   * 1/3 gibi paylarda asla tam etmez.
   */
  async arsaPayiDuzelt(dto: ArsaPayiDuzeltDto, principal: Principal): Promise<TopluSonuc> {
    const baglam = mevcutBaglamiZorunluKil('bolum.arsaPayiDuzelt');

    const istenen = new Map<string, { pay: bigint; payda: bigint }>();
    for (const s of dto.satirlar) {
      const pay = BigInt(s.arsaPayiPay);
      const payda = BigInt(s.arsaPayiPayda);
      if (payda <= 0n) {
        throw new IsKuraliIhlali(`Arsa payı paydası sıfırdan büyük olmalıdır: ${s.bolumId}`);
      }
      if (pay < 0n || pay > payda) {
        throw new IsKuraliIhlali(
          `Arsa payı geçerli bir kesir olmalıdır (${pay}/${payda}): ${s.bolumId}`,
        );
      }
      if (istenen.has(s.bolumId)) {
        throw new IsKuraliIhlali(
          `Aynı bölüm için iki kez arsa payı verilmiş: ${s.bolumId}`,
          'Her bölüm listede bir kez bulunmalıdır.',
        );
      }
      istenen.set(s.bolumId, { pay, payda });
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const tumBolumler = await tx.bagimsizBolum.findMany({
        where: { tenantId: principal.tenantId },
        select: { id: true, kapiNo: true, arsaPayiPay: true, arsaPayiPayda: true },
      });
      const mevcutKumesi = new Set(tumBolumler.map((b) => b.id));

      const bilinmeyen = Array.from(istenen.keys()).filter((id) => !mevcutKumesi.has(id));
      if (bilinmeyen.length > 0) {
        throw new KayitBulunamadi(`Bazı bölümler bulunamadı: ${bilinmeyen.join(', ')}`);
      }

      // Islem SONRASI durum: gonderilenler yeni, digerleri mevcut degeriyle.
      const sonrakiKesirler = tumBolumler.map((b) => {
        const yeni = istenen.get(b.id);
        return yeni ?? { pay: b.arsaPayiPay, payda: b.arsaPayiPayda };
      });

      const toplam = kesirleriTopla(sonrakiKesirler);
      if (!tamiEdiyorMu(toplam)) {
        const oran = kesirOrani(toplam).toFixed(6);
        throw new IsKuraliIhlali(
          `Düzeltme sonrası arsa payları toplamı 1 etmiyor (${oran}). ` +
            `KMK md. 3 uyarınca toplam tamı etmelidir; hiçbir satır yazılmadı.`,
          'Dokunulmayan bölümlerin payları da toplama dâhildir — tabloyu bütün olarak gözden geçirin.',
        );
      }

      for (const [bolumId, kesir] of istenen) {
        await tx.bagimsizBolum.update({
          where: { id: bolumId },
          data: { arsaPayiPay: kesir.pay, arsaPayiPayda: kesir.payda },
        });
      }

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BagimsizBolum', varlikId: Array.from(istenen.keys()).join(','),
        oncekiDeger: {
          // BigInt JSON'a serilestirilemez; denetim kaydinda metin tutulur.
          paylar: tumBolumler
            .filter((b) => istenen.has(b.id))
            .map((b) => ({ id: b.id, kapiNo: b.kapiNo, arsaPayi: `${b.arsaPayiPay}/${b.arsaPayiPayda}` })),
        },
        sonrakiDeger: {
          paylar: Array.from(istenen.entries()).map(([id, k]) => ({ id, arsaPayi: `${k.pay}/${k.payda}` })),
          toplam: '1.000000',
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.bagimsiz_bolum.arsa_payi_duzeltildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'BagimsizBolum', id: Array.from(istenen.keys())[0] ?? '', version: 1 },
        payload: { bolumSayisi: istenen.size, gerekce: dto.gerekce },
      });

      return { etkilenen: istenen.size, durum: 'DUZELTILDI' };
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
