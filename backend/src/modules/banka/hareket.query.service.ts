/**
 * Banka hareketleri ve bakiye — sorgu tarafı (CQRS).
 *
 * ⚠️  PARA DECIMAL İLE TOPLANIR, `Number` İLE DEĞİL. Kuruşu `Number`'a
 *     çevirip toplamak float yuvarlaması yapar ve banka bakiyesi ile 102
 *     Bankalar hesabı arasında açıklanamayan bir kuruş farkı doğar (ADR-0007).
 *
 * ⚠️  VALÖR BAKİYESİ İLE İŞLEM BAKİYESİ AYRI RAPORLANIR ve ikisi de döner.
 *     Tek sayı verilseydi POS tahsilatı henüz hesaba geçmemişken bakiyede
 *     görünür, harcanabilir sanılır ve karşılıksız ödeme yapılırdı.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

export interface HareketSatiri {
  readonly id: string;
  readonly bankaHesabiId: string;
  readonly bankaHesabiAdi: string;
  readonly islemTipi: string;
  readonly yon: string;
  readonly tutar: string;
  readonly islemTarihi: string;
  readonly valorTarihi: string | null;
  readonly aciklama: string;
  readonly karsiTaraf: string | null;
  readonly referansNo: string | null;
  readonly posAdi: string | null;
  readonly evrakNo: string | null;
  /** Boşsa hareket henüz deftere GİRMEMİŞTİR. */
  readonly yevmiyeFisiId: string | null;
  readonly fisNo: string | null;
  readonly mutabakatDurumu: 'ESLESTI' | 'ESLESMEDI';
  /** Virmanın karşı bacağı. */
  readonly karsiHareketId: string | null;
}

export interface HesapBakiyesi {
  readonly bankaHesabiId: string;
  readonly ad: string;
  readonly paraBirimi: string;
  readonly acilisBakiyesi: string;
  readonly girisToplam: string;
  readonly cikisToplam: string;
  /** İşlem tarihine göre bakiye — defterin gördüğü tutar. */
  readonly islemBakiyesi: string;
  /**
   * Valöre göre bakiye — bankada GERÇEKTEN kullanılabilir tutar. Valörü
   * gelmemiş hareketler HARİÇTİR.
   */
  readonly valorBakiyesi: string;
  /** Valörü henüz gelmemiş tutar (yolda olan para). */
  readonly yoldaTutar: string;
  readonly muhasebelesmemisSayisi: number;
  readonly tarih: string;
}

export interface HareketFiltresi {
  readonly bankaHesabiId?: string;
  readonly baslangic?: string;
  readonly bitis?: string;
  readonly islemTipi?: string;
  readonly yon?: string;
  /** true ise YALNIZCA deftere girmemiş hareketler. */
  readonly yalnizcaMuhasebesiz?: boolean;
  readonly limit?: number;
}

@Injectable()
export class BankaHareketQueryServisi {
  constructor(private readonly prisma: PrismaService) {}

  async listele(
    principal: Principal, filtre: HareketFiltresi = {},
  ): Promise<readonly HareketSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaHareketi.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(filtre.bankaHesabiId === undefined
              ? {}
              : { bankaHesabiId: filtre.bankaHesabiId }),
            ...(filtre.baslangic === undefined && filtre.bitis === undefined
              ? {}
              : {
                  islemTarihi: {
                    ...(filtre.baslangic === undefined
                      ? {}
                      : { gte: new Date(filtre.baslangic) }),
                    ...(filtre.bitis === undefined
                      ? {}
                      : { lte: new Date(filtre.bitis) }),
                  },
                }),
            ...(filtre.islemTipi === undefined
              ? {}
              : { islemTipi: filtre.islemTipi as Prisma.EnumBankaIslemTipiFilter }),
            ...(filtre.yon === 'GIRIS' || filtre.yon === 'CIKIS'
              ? { yon: filtre.yon }
              : {}),
            ...(filtre.yalnizcaMuhasebesiz === true ? { yevmiyeFisiId: null } : {}),
          },
          orderBy: [{ islemTarihi: 'desc' }, { olusturulmaTarihi: 'desc' }],
          take: filtre.limit ?? 500,
          select: {
            id: true, bankaHesabiId: true, islemTipi: true, yon: true,
            tutar: true, islemTarihi: true, valorTarihi: true,
            aciklama: true, karsiTaraf: true, referansNo: true,
            yevmiyeFisiId: true, karsiHareketId: true,
            bankaHesabi: { select: { ad: true } },
            posTanimi: { select: { ad: true } },
            kiymetliEvrak: { select: { evrakNo: true } },
            yevmiyeFisi: { select: { fisNo: true } },
            _count: { select: { eslesenSatirlar: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((h) => ({
      id: h.id,
      bankaHesabiId: h.bankaHesabiId,
      bankaHesabiAdi: h.bankaHesabi.ad,
      islemTipi: h.islemTipi,
      yon: h.yon,
      tutar: h.tutar.toFixed(4),
      islemTarihi: gun(h.islemTarihi),
      valorTarihi: h.valorTarihi === null ? null : gun(h.valorTarihi),
      aciklama: h.aciklama,
      karsiTaraf: h.karsiTaraf,
      referansNo: h.referansNo,
      posAdi: h.posTanimi?.ad ?? null,
      evrakNo: h.kiymetliEvrak?.evrakNo ?? null,
      yevmiyeFisiId: h.yevmiyeFisiId,
      fisNo: h.yevmiyeFisi?.fisNo ?? null,
      mutabakatDurumu: h._count.eslesenSatirlar > 0 ? 'ESLESTI' : 'ESLESMEDI',
      karsiHareketId: h.karsiHareketId,
    }));
  }

  /**
   * Hesap bakiyesi — İŞLEM ve VALÖR olmak üzere İKİ tutar.
   *
   * Toplamlar `groupBy` ile veritabanında yapılır: bütün hareketleri çekip
   * uygulama katmanında toplamak, on yıllık bir hesapta yüz binlerce satır
   * taşırdı ve `Decimal` nesnesi başına ayrı ayrı tahsis yapardı.
   */
  async bakiye(
    bankaHesabiId: string, principal: Principal, tarihMetni?: string,
  ): Promise<HesapBakiyesi> {
    const tarih = tarihMetni === undefined
      ? takvimTarihi(new Date().toISOString().slice(0, 10))
      : takvimTarihi(tarihMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const hesap = await tx.bankaHesabi.findFirst({
        where: { id: bankaHesabiId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, paraBirimi: true, acilisBakiyesi: true },
      });
      if (!hesap) throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${bankaHesabiId}`);

      const sonGun = new Date(tarih);

      const islemToplam = await tx.bankaHareketi.groupBy({
        by: ['yon'],
        where: {
          tenantId: principal.tenantId, bankaHesabiId,
          islemTarihi: { lte: sonGun },
        },
        _sum: { tutar: true },
      });

      // Valör bakiyesi: valörü BOŞ olan hareket aynı gün geçmiş sayılır
      // (valör alanı yalnızca gecikme varsa doldurulur).
      const valorToplam = await tx.bankaHareketi.groupBy({
        by: ['yon'],
        where: {
          tenantId: principal.tenantId, bankaHesabiId,
          OR: [
            { valorTarihi: { lte: sonGun } },
            { valorTarihi: null, islemTarihi: { lte: sonGun } },
          ],
        },
        _sum: { tutar: true },
      });

      const muhasebesiz = await tx.bankaHareketi.count({
        where: {
          tenantId: principal.tenantId, bankaHesabiId,
          yevmiyeFisiId: null, islemTarihi: { lte: sonGun },
        },
      });

      const topla = (
        satirlar: readonly { yon: string; _sum: { tutar: Prisma.Decimal | null } }[],
        yon: string,
      ): Prisma.Decimal =>
        satirlar.find((s) => s.yon === yon)?._sum.tutar ?? new Prisma.Decimal(0);

      const islemGiris = topla(islemToplam, 'GIRIS');
      const islemCikis = topla(islemToplam, 'CIKIS');
      const valorGiris = topla(valorToplam, 'GIRIS');
      const valorCikis = topla(valorToplam, 'CIKIS');

      const islemBakiyesi = hesap.acilisBakiyesi.plus(islemGiris).minus(islemCikis);
      const valorBakiyesi = hesap.acilisBakiyesi.plus(valorGiris).minus(valorCikis);

      return {
        bankaHesabiId: hesap.id,
        ad: hesap.ad,
        paraBirimi: hesap.paraBirimi,
        acilisBakiyesi: hesap.acilisBakiyesi.toFixed(4),
        girisToplam: islemGiris.toFixed(4),
        cikisToplam: islemCikis.toFixed(4),
        islemBakiyesi: islemBakiyesi.toFixed(4),
        valorBakiyesi: valorBakiyesi.toFixed(4),
        yoldaTutar: islemBakiyesi.minus(valorBakiyesi).toFixed(4),
        muhasebelesmemisSayisi: muhasebesiz,
        tarih,
      };
    }, principal.tenantId);
  }
}
