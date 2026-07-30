/**
 * Kıymetli evrak — çek ve senet.
 *
 * İkisi AYNI kayıt tipidir; farkı `tip` alanıdır. Alan kümesi birebir aynıdır
 * (vade · tutar · borçlu · durum). Ayrı tutulsaydı durum makinesi iki yerde
 * yazılır ve biri güncellenmeyi unuturdu.
 *
 * ⚠️  DURUM MAKİNESİ ATLAMA KABUL ETMEZ:
 *       PORTFOYDE → TAHSILDE → TAHSIL_EDILDI | KARSILIKSIZ
 *       KARSILIKSIZ → TAHSILDE (yeniden ibraz / yasal takip)
 *       PORTFOYDE → CIRO_EDILDI | IADE_EDILDI
 *     PORTFOYDE'den doğrudan TAHSIL_EDILDI'ye geçmek, çekin bankaya hiç
 *     verilmediği hâlde tahsil edilmiş görünmesi demektir; "tahsilde
 *     bekleyenler" listesi bir daha doğru olmazdı.
 *
 * ⚠️  EVRAK SİLİNMEZ. Tahsil edilmiş ya da karşılıksız çıkmış bir çek mali
 *     kaydın dayanağıdır; kayıt yanlışsa gerekçeli durum geçişiyle kapatılır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { money, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  durumGecisiniDogrula, kiymetliEvrakiDogrula, vadesiGelenler,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { EvrakDurumDto, KiymetliEvrakEkleDto } from './dto/banka.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

export interface EvrakSatiri {
  readonly id: string;
  readonly tip: string;
  readonly durum: string;
  readonly evrakNo: string;
  readonly tutar: string;
  readonly vadeTarihi: string;
  readonly alisTarihi: string;
  readonly borcluAdi: string;
  readonly bankaAdi: string | null;
  readonly subeAdi: string | null;
  readonly tahsilHesabiAdi: string | null;
  readonly tahsilTarihi: string | null;
  readonly durumGerekcesi: string | null;
  /** Vadesi geçmiş ve hâlâ tahsil edilmemiş mi. */
  readonly vadesiGecmisMi: boolean;
  /** Kalan gün — negatifse gecikme. */
  readonly kalanGun: number;
}

export interface EvrakOzeti {
  readonly portfoydeSayisi: number;
  readonly portfoydeTutar: string;
  readonly tahsildeSayisi: number;
  readonly tahsildeTutar: string;
  readonly vadesiGelenSayisi: number;
  readonly vadesiGelenTutar: string;
  readonly karsiliksizSayisi: number;
  readonly karsiliksizTutar: string;
}

export interface EvrakFiltresi {
  readonly tip?: string;
  readonly durum?: string;
  /** Yalnızca vadesi bu tarihe kadar (dahil) olanlar. */
  readonly vadeyeKadar?: string;
  /** true ise yalnızca vadesi geçmiş ve açık durumdakiler. */
  readonly yalnizcaVadesiGelen?: boolean;
}

@Injectable()
export class KiymetliEvrakServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  async listele(
    principal: Principal, filtre: EvrakFiltresi = {},
  ): Promise<readonly EvrakSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.kiymetliEvrak.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(filtre.tip === 'CEK' || filtre.tip === 'SENET'
              ? { tip: filtre.tip }
              : {}),
            ...(filtre.durum === undefined
              ? {}
              : { durum: filtre.durum as Prisma.EnumKiymetliEvrakDurumuFilter }),
            ...(filtre.vadeyeKadar === undefined
              ? {}
              : { vadeTarihi: { lte: new Date(filtre.vadeyeKadar) } }),
          },
          orderBy: [{ vadeTarihi: 'asc' }],
          select: {
            id: true, tip: true, durum: true, evrakNo: true, tutar: true,
            vadeTarihi: true, alisTarihi: true, borcluAdi: true,
            tahsilTarihi: true, durumGerekcesi: true,
            banka: { select: { ad: true } },
            sube: { select: { ad: true } },
            tahsilHesabi: { select: { ad: true } },
          },
        }),
      principal.tenantId,
    );

    const simdi = bugun();
    // Vadesi gelenler DOMAIN'de süzülür: kapalı durumlar (tahsil · ciro ·
    // iade) dışlanır. Yalnızca `vadeTarihi <= bugün` denetimi yapılsaydı
    // tahsil edilmiş çekler de "vadesi geçmiş" görünürdü.
    const vadesiGelenIdler = new Set(
      vadesiGelenler(
        kayitlar.map((e) => ({
          id: e.id, vadeTarihi: gun(e.vadeTarihi), durum: e.durum,
        })),
        simdi,
      ).map((e) => e.id),
    );

    const bugunMs = Date.parse(`${simdi}T00:00:00.000Z`);

    return kayitlar.map((e) => ({
      id: e.id,
      tip: e.tip,
      durum: e.durum,
      evrakNo: e.evrakNo,
      tutar: e.tutar.toFixed(4),
      vadeTarihi: gun(e.vadeTarihi),
      alisTarihi: gun(e.alisTarihi),
      borcluAdi: e.borcluAdi,
      bankaAdi: e.banka?.ad ?? null,
      subeAdi: e.sube?.ad ?? null,
      tahsilHesabiAdi: e.tahsilHesabi?.ad ?? null,
      tahsilTarihi: e.tahsilTarihi === null ? null : gun(e.tahsilTarihi),
      durumGerekcesi: e.durumGerekcesi,
      vadesiGecmisMi: vadesiGelenIdler.has(e.id),
      kalanGun: Math.round(
        (Date.parse(`${gun(e.vadeTarihi)}T00:00:00.000Z`) - bugunMs) / 86_400_000,
      ),
    }));
  }

  /**
   * Portföy özeti — durum bazlı sayı ve tutar.
   *
   * KAPALI DURUMLAR ÖZETTE YOK: tahsil edilmiş ya da ciro edilmiş evrak artık
   * beklenen bir tahsilat değildir ve "portföydeki çekler" toplamına
   * karışırsa alacak iki kez sayılır.
   */
  async ozet(principal: Principal): Promise<EvrakOzeti> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.kiymetliEvrak.findMany({
          where: {
            tenantId: principal.tenantId,
            durum: { in: ['PORTFOYDE', 'TAHSILDE', 'KARSILIKSIZ'] },
          },
          select: { id: true, durum: true, tutar: true, vadeTarihi: true },
        }),
      principal.tenantId,
    );

    const simdi = bugun();
    const vadesiGelen = vadesiGelenler(
      kayitlar.map((e) => ({
        id: e.id, vadeTarihi: gun(e.vadeTarihi), durum: e.durum, tutar: e.tutar,
      })),
      simdi,
    );

    const topla = (
      liste: readonly { readonly tutar: Prisma.Decimal }[],
    ): string =>
      liste
        .reduce((acc, e) => acc.plus(e.tutar), new Prisma.Decimal(0))
        .toFixed(4);

    const portfoyde = kayitlar.filter((e) => e.durum === 'PORTFOYDE');
    const tahsilde = kayitlar.filter((e) => e.durum === 'TAHSILDE');
    const karsiliksiz = kayitlar.filter((e) => e.durum === 'KARSILIKSIZ');

    return {
      portfoydeSayisi: portfoyde.length,
      portfoydeTutar: topla(portfoyde),
      tahsildeSayisi: tahsilde.length,
      tahsildeTutar: topla(tahsilde),
      vadesiGelenSayisi: vadesiGelen.length,
      vadesiGelenTutar: topla(vadesiGelen),
      karsiliksizSayisi: karsiliksiz.length,
      karsiliksizTutar: topla(karsiliksiz),
    };
  }

  async ekle(dto: KiymetliEvrakEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.evrakEkle');
    const id = randomUUID();
    const vadeTarihi = takvimTarihi(dto.vadeTarihi);
    const alisTarihi = takvimTarihi(dto.alisTarihi);

    kiymetliEvrakiDogrula({
      tip: dto.tip, tutar: money(dto.tutar),
      vadeTarihi, alisTarihi,
      borcluAdi: dto.borcluAdi, evrakNo: dto.evrakNo,
    });

    return this.prisma.tenantIslemi(async (tx) => {
      if (dto.bankaId !== undefined) {
        const banka = await tx.banka.findFirst({
          where: { id: dto.bankaId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: { id: true },
        });
        if (!banka) throw new KayitBulunamadi(`Banka bulunamadı: ${dto.bankaId}`);
      }
      if (dto.subeId !== undefined) {
        const sube = await tx.bankaSubesi.findFirst({
          where: {
            id: dto.subeId, tenantId: principal.tenantId, silinmeTarihi: null,
            ...(dto.bankaId === undefined ? {} : { bankaId: dto.bankaId }),
          },
          select: { id: true },
        });
        if (!sube) {
          throw new IsKuraliIhlali(
            'Şube bulunamadı ya da belirtilen bankaya ait değil.',
            'Şube seçimini bankaya göre daraltın.',
          );
        }
      }
      if (dto.borcluKisiId !== undefined) {
        const kisi = await tx.kisi.findFirst({
          where: {
            id: dto.borcluKisiId, tenantId: principal.tenantId,
            silinmeTarihi: null,
          },
          select: { id: true },
        });
        if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.borcluKisiId}`);
      }

      await tx.kiymetliEvrak.create({
        data: {
          id, tenantId: principal.tenantId,
          tip: dto.tip, durum: 'PORTFOYDE',
          evrakNo: dto.evrakNo.trim(),
          tutar: new Prisma.Decimal(dto.tutar),
          vadeTarihi: new Date(vadeTarihi),
          alisTarihi: new Date(alisTarihi),
          borcluAdi: dto.borcluAdi.trim(),
          borcluKisiId: dto.borcluKisiId ?? null,
          bankaId: dto.bankaId ?? null,
          subeId: dto.subeId ?? null,
          notlar: dto.notlar?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'KiymetliEvrak', varlikId: id,
        sonrakiDeger: {
          tip: dto.tip, evrakNo: dto.evrakNo, tutar: dto.tutar,
          vadeTarihi, alisTarihi, borcluAdi: dto.borcluAdi,
          durum: 'PORTFOYDE',
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'PORTFOYDE' };
    });
  }

  /**
   * Durum geçişi. Geçerli geçişler domain'de tanımlıdır ve ATLAMA KABUL EDİLMEZ.
   *
   * TAHSIL_EDILDI geçişinde hesap ve tarih ZORUNLUDUR: hangi hesaba ve ne
   * zaman girdiği bilinmeyen bir tahsilat mutabık edilemez. Bu, hem domain
   * hem veritabanı CHECK ile iki kez zorlanır — biri atlanırsa öteki tutar.
   */
  async durumGecisi(
    id: string, dto: EvrakDurumDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.evrakDurum');

    return this.prisma.tenantIslemi(async (tx) => {
      const evrak = await tx.kiymetliEvrak.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: {
          id: true, tip: true, evrakNo: true, durum: true, tutar: true,
          tahsilHesabiId: true, tahsilTarihi: true, durumGerekcesi: true,
        },
      });
      if (!evrak) throw new KayitBulunamadi(`Kıymetli evrak bulunamadı: ${id}`);

      // TAHSIL_EDILDI için hesap: istekte gelmediyse mevcut kayıttakine
      // düşülür (tahsile verirken girilmiş olabilir).
      const tahsilHesabiId = dto.tahsilHesabiId ?? evrak.tahsilHesabiId;
      const tahsilTarihi = dto.tahsilTarihi === undefined
        ? (evrak.tahsilTarihi === null ? null : gun(evrak.tahsilTarihi))
        : takvimTarihi(dto.tahsilTarihi);

      durumGecisiniDogrula({
        mevcut: evrak.durum,
        hedef: dto.hedefDurum,
        gerekce: dto.gerekce ?? null,
        tahsilHesabiVarMi: tahsilHesabiId !== null,
        tahsilTarihiVarMi: tahsilTarihi !== null,
      });

      if (tahsilHesabiId !== null && dto.tahsilHesabiId !== undefined) {
        const hesap = await tx.bankaHesabi.findFirst({
          where: {
            id: tahsilHesabiId, tenantId: principal.tenantId,
            silinmeTarihi: null,
          },
          select: { id: true },
        });
        if (!hesap) {
          throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${tahsilHesabiId}`);
        }
      }

      await tx.kiymetliEvrak.update({
        where: { id },
        data: {
          durum: dto.hedefDurum,
          ...(dto.tahsilHesabiId === undefined ? {} : { tahsilHesabiId }),
          ...(tahsilTarihi === null || dto.tahsilTarihi === undefined
            ? {}
            : { tahsilTarihi: new Date(tahsilTarihi) }),
          ...(dto.gerekce === undefined ? {} : { durumGerekcesi: dto.gerekce.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'KiymetliEvrak', varlikId: id,
        oncekiDeger: {
          durum: evrak.durum,
          tahsilHesabiId: evrak.tahsilHesabiId,
          tahsilTarihi: evrak.tahsilTarihi === null ? null : gun(evrak.tahsilTarihi),
        },
        sonrakiDeger: {
          durum: dto.hedefDurum,
          tip: evrak.tip, evrakNo: evrak.evrakNo,
          tutar: evrak.tutar.toFixed(4),
          tahsilHesabiId, tahsilTarihi,
        },
        ...(dto.gerekce === undefined ? {} : { gerekce: dto.gerekce }),
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: dto.hedefDurum };
    });
  }
}
