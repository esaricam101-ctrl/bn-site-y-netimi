/**
 * Hesap Planı servisi — tekdüzen hesap planı ağacı.
 *
 * ⚠️  HESAP SİLİNMEZ, PASİFE ALINIR. Hareket görmüş bir hesabı silmek, o
 *     hesaba yazılmış yevmiye satırlarını sahipsiz bırakır ve mizan ile
 *     muavin tutmaz hale gelir. Kullanılmamış hesap bile soft-delete edilir
 *     (BFS v1 §5.2 · gerekçe zorunlu).
 *
 * ⚠️  KOD DÜZENİ İLE AĞAÇ TUTARLI OLMAK ZORUNDA. Mizan koda göre sıralanır,
 *     muavin ağaca göre toplanır; ikisi koparsa aynı veriden iki farklı sonuç
 *     çıkar. `altHesapKodunuDogrula` bunu yazma anında zorlar.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { altHesapKodunuDogrula, hesapKodunuDogrula } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { HesapEkleDto, HesapDuzeltDto } from './dto/muhasebe.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface HesapSatiri {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly tip: string;
  readonly ozellik: string;
  readonly ustHesapId: string | null;
  readonly fisKesilebilirMi: boolean;
  readonly aktif: boolean;
  /** Ağaç derinliği — arayüz girinti için kullanır. */
  readonly seviye: number;
  /** Bu hesaba yazılmış yevmiye satırı sayısı — silme kararı buna bakar. */
  readonly hareketSayisi: number;
}

@Injectable()
export class HesapPlaniServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  /**
   * Hesap planı — KOD SIRASINA göre, ağaç derinliğiyle.
   *
   * Sıralama koda göredir çünkü mizanın satır sırası da odur; ada göre
   * sıralansaydı iki rapor farklı sırada çıkar ve karşılaştırılamazdı.
   */
  async listele(
    principal: Principal,
    suzgec: {
      readonly arama?: string; readonly tip?: string;
      readonly ozellik?: string; readonly yalnizcaAktif?: boolean;
    } = {},
  ): Promise<readonly HesapSatiri[]> {
    const aramaMetni = suzgec.arama?.trim();

    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.hesap.findMany({
          where: {
            tenantId: principal.tenantId,
            // Soft delete uzantısı istemciye bağlı değil; açıkça süzülür.
            silinmeTarihi: null,
            ...(suzgec.yalnizcaAktif === true ? { aktif: true } : {}),
            ...(suzgec.tip ? { tip: suzgec.tip as never } : {}),
            ...(suzgec.ozellik ? { ozellik: suzgec.ozellik as never } : {}),
            ...(aramaMetni
              ? {
                  OR: [
                    { kod: { startsWith: aramaMetni } },
                    { ad: { contains: aramaMetni, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          select: {
            id: true, kod: true, ad: true, tip: true, ozellik: true,
            ustHesapId: true, fisKesilebilirMi: true, aktif: true,
            _count: { select: { satirlar: true } },
          },
          orderBy: { kod: 'asc' },
        }),
      principal.tenantId,
    );

    return kayitlar.map((h) => ({
      id: h.id,
      kod: h.kod,
      ad: h.ad,
      tip: h.tip,
      ozellik: h.ozellik,
      ustHesapId: h.ustHesapId,
      fisKesilebilirMi: h.fisKesilebilirMi,
      aktif: h.aktif,
      // Derinlik KODDAN türetilir, ağaç dolaşmadan: tekdüzen planda hiyerarşi
      // kod uzunluğuyla kurulur (1 / 10 / 100 / 100.01).
      seviye: h.kod.split('.').length - 1,
      hareketSayisi: h._count.satirlar,
    }));
  }

  async ekle(dto: HesapEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.hesapEkle');
    const id = randomUUID();
    const kod = hesapKodunuDogrula(dto.kod);

    return this.prisma.tenantIslemi(async (tx) => {
      const mevcut = await tx.hesap.findFirst({
        where: { tenantId: principal.tenantId, kod, silinmeTarihi: null },
        select: { ad: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `'${kod}' kodlu hesap zaten var: ${mevcut.ad}.`,
          'Farklı bir kod verin; aynı kodla iki hesap mizanda iki satır ' +
            'gösterir ve hangi satırın hangi hesap olduğu belirsiz kalır.',
        );
      }

      if (dto.ustHesapId !== undefined) {
        const ust = await tx.hesap.findFirst({
          where: { id: dto.ustHesapId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: { kod: true, tip: true, fisKesilebilirMi: true },
        });
        if (!ust) throw new KayitBulunamadi(`Üst hesap bulunamadı: ${dto.ustHesapId}`);

        altHesapKodunuDogrula(ust.kod, kod);

        // Alt hesabın tipi ÜST HESAPLA AYNI olmak zorundadır: 100 Kasa
        // (VARLIK) altına GELIR tipli bir hesap açılırsa bilanço ile gelir
        // tablosu aynı bakiyeyi iki yerde sayar.
        if (ust.tip !== dto.tip) {
          throw new IsKuraliIhlali(
            `Alt hesabın tipi üst hesapla aynı olmalıdır (üst: ${ust.tip}, ` +
              `verilen: ${dto.tip}).`,
            'Aksi hâlde bilanço ile gelir tablosu aynı bakiyeyi iki yerde sayar.',
          );
        }

        // ÜST HESABA ARTIK FİŞ KESİLEMEZ. Alt hesabı olan bir hesaba doğrudan
        // kayıt, alt hesapların toplamını bozar ve muavin tutmaz.
        if (ust.fisKesilebilirMi) {
          await tx.hesap.update({
            where: { id: dto.ustHesapId },
            data: { fisKesilebilirMi: false },
          });
        }
      }

      await tx.hesap.create({
        data: {
          id, tenantId: principal.tenantId, kod, ad: dto.ad.trim(),
          tip: dto.tip,
          ozellik: dto.ozellik ?? 'NORMAL',
          ustHesapId: dto.ustHesapId ?? null,
          fisKesilebilirMi: true,
          aktif: true,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Hesap', varlikId: id,
        sonrakiDeger: {
          kod, ad: dto.ad, tip: dto.tip, ozellik: dto.ozellik ?? 'NORMAL',
          ustHesapId: dto.ustHesapId ?? null,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /**
   * Hesap düzeltme. KOD ve TİP DEĞİŞTİRİLEMEZ.
   *
   * Kod değişirse geçmiş mizanların satır sırası değişir ve yayımlanmış
   * raporlarla tutmaz. Tip değişirse hesap bilançodan gelir tablosuna atlar ve
   * geçmiş dönemlerin sonucu sessizce başkalaşır. Yanlış girilmişse hesap
   * pasife alınıp yenisi açılır.
   */
  async duzelt(
    id: string, dto: HesapDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.hesapDuzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.hesap.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, ozellik: true, aktif: true, kod: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Hesap bulunamadı: ${id}`);

      await tx.hesap.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.ozellik === undefined ? {} : { ozellik: dto.ozellik }),
          ...(dto.aktif === undefined ? {} : { aktif: dto.aktif }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Hesap', varlikId: id,
        oncekiDeger: { ad: kayit.ad, ozellik: kayit.ozellik, aktif: kayit.aktif },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad,
          ozellik: dto.ozellik ?? kayit.ozellik,
          aktif: dto.aktif ?? kayit.aktif,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Hesabı arşivler (soft delete).
   *
   * HAREKET GÖRMÜŞ HESAP ARŞİVLENEMEZ: ona yazılmış yevmiye satırları
   * sahipsiz kalır ve mizan ile muavin tutmaz. Alt hesabı olan hesap da
   * arşivlenemez; ağaç kopar.
   */
  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.hesapSil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.hesap.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: {
          id: true, kod: true,
          _count: { select: { satirlar: true, altHesaplar: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Hesap bulunamadı: ${id}`);

      const engeller: { readonly aciklama: string; readonly kontrol: string }[] = [];
      if (kayit._count.satirlar > 0) {
        engeller.push({
          aciklama: `${kayit._count.satirlar} yevmiye satırı bu hesaba yazılmış.`,
          kontrol: 'HESAP_HAREKET_VAR',
        });
      }
      if (kayit._count.altHesaplar > 0) {
        engeller.push({
          aciklama: `${kayit._count.altHesaplar} alt hesabı var.`,
          kontrol: 'HESAP_ALT_HESAP_VAR',
        });
      }

      silmeyiDogrula(
        { varlik: 'Hesap', sinif: 'ANA_VERI', engelleyenBagimliliklar: engeller },
        gerekce,
      );

      await tx.hesap.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
          aktif: false,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Hesap', varlikId: id,
        oncekiDeger: { kod: kayit.kod, silindiMi: false },
        sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
