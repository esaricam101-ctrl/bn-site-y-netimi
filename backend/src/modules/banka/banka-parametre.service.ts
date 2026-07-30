/**
 * Banka parametreleri — tenant başına TEK satır.
 *
 * Ayarların koda gömülmesi, iki tenant'ın farklı masraf hesabı kullanmasını
 * imkânsız kılardı (§33 kural 3: politika VERİ olarak tanımlanır).
 *
 * ⚠️  MUTABAKAT TOLERANSI VARSAYILAN OLARAK SIFIRDIR. Makine kuruş farkını
 *     sessizce yutarsa gerçek bir eksik tahsilat mutabık görünür; toleransı
 *     açmak bilinçli bir karardır ve denetime yazılır.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { IsKuraliIhlali } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { BankaParametreKaydetDto } from './dto/banka.dto';

export interface BankaParametreGorunumu {
  readonly varsayilanBankaHesabiId: string | null;
  readonly varsayilanBankaHesabiAdi: string | null;
  readonly masrafGiderHesapId: string | null;
  readonly masrafGiderKodu: string | null;
  readonly posKomisyonHesapId: string | null;
  readonly posKomisyonKodu: string | null;
  readonly mutabakatToleransKurus: number;
  readonly mutabakatGunPenceresi: number;
}

@Injectable()
export class BankaParametreServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  async oku(principal: Principal): Promise<BankaParametreGorunumu> {
    const p = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaParametresi.findFirst({
          where: { tenantId: principal.tenantId },
          include: {
            varsayilanHesap: { select: { ad: true } },
            masrafHesabi: { select: { kod: true } },
            komisyonHesabi: { select: { kod: true } },
          },
        }),
      principal.tenantId,
    );

    // Kayıt yoksa VARSAYILANLAR döner; boş nesne arayüzü "yükleniyor"
    // durumunda bırakırdı.
    if (!p) {
      return {
        varsayilanBankaHesabiId: null, varsayilanBankaHesabiAdi: null,
        masrafGiderHesapId: null, masrafGiderKodu: null,
        posKomisyonHesapId: null, posKomisyonKodu: null,
        mutabakatToleransKurus: 0, mutabakatGunPenceresi: 3,
      };
    }

    return {
      varsayilanBankaHesabiId: p.varsayilanBankaHesabiId,
      varsayilanBankaHesabiAdi: p.varsayilanHesap?.ad ?? null,
      masrafGiderHesapId: p.masrafGiderHesapId,
      masrafGiderKodu: p.masrafHesabi?.kod ?? null,
      posKomisyonHesapId: p.posKomisyonHesapId,
      posKomisyonKodu: p.komisyonHesabi?.kod ?? null,
      mutabakatToleransKurus: p.mutabakatToleransKurus,
      mutabakatGunPenceresi: p.mutabakatGunPenceresi,
    };
  }

  async kaydet(
    dto: BankaParametreKaydetDto, principal: Principal,
  ): Promise<{ readonly durum: string }> {
    const baglam = mevcutBaglamiZorunluKil('banka.parametreKaydet');

    return this.prisma.tenantIslemi(async (tx) => {
      // Gider hesapları FİŞ KESİLEBİLİR olmalı: ara hesap masraf hesabı
      // yapılırsa banka masrafı her muhasebeleştirmede hata verir.
      const giderHesaplari = [
        ['masrafGiderHesapId', dto.masrafGiderHesapId],
        ['posKomisyonHesapId', dto.posKomisyonHesapId],
      ] as const;

      for (const [alan, hesapId] of giderHesaplari) {
        if (hesapId === undefined) continue;
        const h = await tx.hesap.findFirst({
          where: { id: hesapId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: { kod: true, tip: true, fisKesilebilirMi: true, aktif: true },
        });
        if (!h) throw new IsKuraliIhlali(`${alan} için hesap bulunamadı: ${hesapId}`);
        if (!h.fisKesilebilirMi) {
          throw new IsKuraliIhlali(
            `'${h.kod}' bir ara (başlık) hesap; gider hesabı olarak seçilemez.`,
            'Alt hesaplardan birini seçin: ara hesaba fiş kesilemez.',
          );
        }
        if (!h.aktif) {
          throw new IsKuraliIhlali(`'${h.kod}' hesabı pasif; seçilemez.`);
        }
        // Masraf ve komisyon GİDERDİR. Yanlış tipte hesap seçilirse banka
        // masrafı gelir tablosunda değil bilançoda görünür ve dönem sonucu
        // sessizce yanlış çıkar.
        if (h.tip !== 'GIDER') {
          throw new IsKuraliIhlali(
            `'${h.kod}' hesabının tipi ${h.tip}; masraf/komisyon hesabı GİDER ` +
              'tipinde olmalıdır.',
            'Gider olmayan bir hesaba masraf yazılırsa dönem sonucu yanlış çıkar.',
          );
        }
      }

      if (dto.varsayilanBankaHesabiId !== undefined) {
        const h = await tx.bankaHesabi.findFirst({
          where: {
            id: dto.varsayilanBankaHesabiId, tenantId: principal.tenantId,
            silinmeTarihi: null,
          },
          select: { id: true, ad: true, aktif: true },
        });
        if (!h) {
          throw new IsKuraliIhlali(
            `Banka hesabı bulunamadı: ${dto.varsayilanBankaHesabiId}`,
          );
        }
        if (!h.aktif) {
          throw new IsKuraliIhlali(
            `'${h.ad}' hesabı pasif; varsayılan yapılamaz.`,
            'Varsayılan hesap her yeni harekette önerilir; pasif olamaz.',
          );
        }
      }

      const onceki = await tx.bankaParametresi.findFirst({
        where: { tenantId: principal.tenantId },
      });

      await tx.bankaParametresi.upsert({
        where: { tenantId: principal.tenantId },
        create: {
          tenantId: principal.tenantId,
          varsayilanBankaHesabiId: dto.varsayilanBankaHesabiId ?? null,
          masrafGiderHesapId: dto.masrafGiderHesapId ?? null,
          posKomisyonHesapId: dto.posKomisyonHesapId ?? null,
          mutabakatToleransKurus: dto.mutabakatToleransKurus ?? 0,
          mutabakatGunPenceresi: dto.mutabakatGunPenceresi ?? 3,
        },
        update: {
          ...(dto.varsayilanBankaHesabiId === undefined
            ? {} : { varsayilanBankaHesabiId: dto.varsayilanBankaHesabiId }),
          ...(dto.masrafGiderHesapId === undefined
            ? {} : { masrafGiderHesapId: dto.masrafGiderHesapId }),
          ...(dto.posKomisyonHesapId === undefined
            ? {} : { posKomisyonHesapId: dto.posKomisyonHesapId }),
          ...(dto.mutabakatToleransKurus === undefined
            ? {} : { mutabakatToleransKurus: dto.mutabakatToleransKurus }),
          ...(dto.mutabakatGunPenceresi === undefined
            ? {} : { mutabakatGunPenceresi: dto.mutabakatGunPenceresi }),
        },
      });

      // Tolerans değişikliği DENETİME YAZILIR: toleransı açmak makinenin kuruş
      // farkını yutmasına izin vermek demektir ve kimin açtığı sorulabilir
      // olmalıdır.
      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BankaParametresi', varlikId: principal.tenantId,
        oncekiDeger: onceki === null ? null : {
          mutabakatToleransKurus: onceki.mutabakatToleransKurus,
          mutabakatGunPenceresi: onceki.mutabakatGunPenceresi,
        },
        sonrakiDeger: {
          mutabakatToleransKurus:
            dto.mutabakatToleransKurus ?? onceki?.mutabakatToleransKurus ?? 0,
          mutabakatGunPenceresi:
            dto.mutabakatGunPenceresi ?? onceki?.mutabakatGunPenceresi ?? 3,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { durum: 'KAYDEDILDI' };
    });
  }
}
