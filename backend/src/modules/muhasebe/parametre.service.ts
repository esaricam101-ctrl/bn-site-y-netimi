/**
 * Muhasebe parametreleri — tenant başına TEK satır.
 *
 * Ayarların koda gömülmesi, iki tenant'ın farklı kasa hesabı kullanmasını
 * imkânsız kılardı (§33 kural 3: politika veri olarak tanımlanır).
 *
 * `upsert` kullanılır: parametre kaydı yoksa açılır. Ayrı bir "oluştur"
 * adımı olsaydı kurulum tamamlanmamış tenant'ta ayar ekranı hata verirdi.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { IsKuraliIhlali } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { ParametreKaydetDto } from './dto/muhasebe.dto';

export type MuhasebeDerinligi = 'BASIT' | 'CIFT_TARAFLI';

export interface ParametreGorunumu {
  readonly varsayilanKasaHesapId: string | null;
  readonly varsayilanKasaKodu: string | null;
  readonly varsayilanBankaHesapId: string | null;
  readonly varsayilanBankaKodu: string | null;
  readonly donemKariHesapId: string | null;
  readonly donemKariKodu: string | null;
  readonly yevmiyeBaslangicNo: number;
  readonly taslakMizanaGirer: boolean;
  readonly geriyeDonukGun: number;
  /**
   * MUHASEBE DERİNLİĞİ (0034 · docs/APARTMAN-SITE-AYRIMI.md §2.1).
   *
   * ⚠️  ALAN VARDI AMA UÇ DÖNDÜRMÜYORDU. Migration ile eklenmiş,
   *     `tahakkuk.command.service` ve `makbuz.query.service` doğrudan
   *     Prisma'dan okuyordu; yani ayar yalnızca veritabanından ve tohumdan
   *     değiştirilebiliyordu. Kullanıcının göremediği bir ayar, ayar değildir.
   */
  readonly muhasebeDerinligi: MuhasebeDerinligi;
}

@Injectable()
export class ParametreServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  async oku(principal: Principal): Promise<ParametreGorunumu> {
    const p = await this.prisma.tenantIslemi(
      (tx) =>
        tx.muhasebeParametresi.findFirst({
          where: { tenantId: principal.tenantId },
          include: {
            varsayilanKasa: { select: { kod: true } },
            varsayilanBanka: { select: { kod: true } },
            donemKariHesabi: { select: { kod: true } },
          },
        }),
      principal.tenantId,
    );

    // Kayıt yoksa VARSAYILANLAR döner; boş nesne dönmek arayüzü "yükleniyor"
    // durumunda bırakırdı.
    if (!p) {
      return {
        varsayilanKasaHesapId: null, varsayilanKasaKodu: null,
        varsayilanBankaHesapId: null, varsayilanBankaKodu: null,
        donemKariHesapId: null, donemKariKodu: null,
        yevmiyeBaslangicNo: 1, taslakMizanaGirer: false, geriyeDonukGun: 0,
        /*
         * Kayıt yokken varsayılan `CIFT_TARAFLI`: veritabanı sütunu da öyle
         * (0034). Burada `BASIT` dönmek, kaydı olmayan bir projeyi muhasebe
         * uçlarından SESSİZCE dışlardı.
         */
        muhasebeDerinligi: 'CIFT_TARAFLI',
      };
    }

    return {
      varsayilanKasaHesapId: p.varsayilanKasaHesapId,
      varsayilanKasaKodu: p.varsayilanKasa?.kod ?? null,
      varsayilanBankaHesapId: p.varsayilanBankaHesapId,
      varsayilanBankaKodu: p.varsayilanBanka?.kod ?? null,
      donemKariHesapId: p.donemKariHesapId,
      donemKariKodu: p.donemKariHesabi?.kod ?? null,
      yevmiyeBaslangicNo: p.yevmiyeBaslangicNo,
      taslakMizanaGirer: p.taslakMizanaGirer,
      geriyeDonukGun: p.geriyeDonukGun,
      muhasebeDerinligi: p.muhasebeDerinligi,
    };
  }

  async kaydet(
    dto: ParametreKaydetDto, principal: Principal,
  ): Promise<{ readonly durum: string }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.parametreKaydet');

    return this.prisma.tenantIslemi(async (tx) => {
      // Verilen hesapların tenant'a ait ve FİŞ KESİLEBİLİR olduğu doğrulanır:
      // ara hesap varsayılan kasa yapılırsa tahsilat fişi hep hata verir.
      const kontrolEdilecek = [
        ['varsayilanKasaHesapId', dto.varsayilanKasaHesapId],
        ['varsayilanBankaHesapId', dto.varsayilanBankaHesapId],
        ['donemKariHesapId', dto.donemKariHesapId],
      ] as const;

      for (const [alan, hesapId] of kontrolEdilecek) {
        if (hesapId === undefined) continue;
        const h = await tx.hesap.findFirst({
          where: { id: hesapId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: { kod: true, fisKesilebilirMi: true, aktif: true },
        });
        if (!h) {
          throw new IsKuraliIhlali(`${alan} için hesap bulunamadı: ${hesapId}`);
        }
        if (!h.fisKesilebilirMi) {
          throw new IsKuraliIhlali(
            `'${h.kod}' bir ara (başlık) hesap; varsayılan hesap olarak ` +
              'seçilemez.',
            'Alt hesaplardan birini seçin: ara hesaba fiş kesilemez ve ' +
              'tahsilat her denemede hata verir.',
          );
        }
        if (!h.aktif) {
          throw new IsKuraliIhlali(`'${h.kod}' hesabı pasif; seçilemez.`);
        }
      }

      const onceki = await tx.muhasebeParametresi.findFirst({
        where: { tenantId: principal.tenantId },
      });

      /*
       * ★ DERİNLİK GEÇİŞİ TEK YÖNLÜDÜR (docs/APARTMAN-SITE-AYRIMI.md §2.6).
       *
       *   BASIT → CIFT_TARAFLI  serbest
       *   CIFT_TARAFLI → BASIT  ENGELLİ
       *
       * ⚠️  KORUMA BURADA, ARAYÜZDE DEĞİL. Ekranda düğmenin gri olması bir
       *     görünürlük önlemidir; API'yi doğrudan çağıran onu görmez.
       *
       * ⚠️  KARŞILAŞTIRMA MEVCUT DEĞERLE YAPILIR, yalnızca "yeni değer BASIT
       *     mi" diye bakılmaz: `BASIT → BASIT` bir geçiş değildir ve ekrandan
       *     yapılan her kaydetme (derinlik alanı hiç değişmese bile) düşerdi.
       */
      const mevcutDerinlik = onceki?.muhasebeDerinligi ?? 'CIFT_TARAFLI';
      if (
        dto.muhasebeDerinligi !== undefined
        && dto.muhasebeDerinligi !== mevcutDerinlik
        && mevcutDerinlik === 'CIFT_TARAFLI'
      ) {
        throw new IsKuraliIhlali(
          'Çift taraflı muhasebeden basit muhasebeye dönülemez: yazılmış ' +
            'yevmiye fişlerinin ne olacağı belirsizdir.',
          'Basit muhasebe kullanılacaksa proje yeniden kurulmalıdır. ' +
            'Ters yön serbesttir: basit muhasebeden çift taraflıya geçilebilir.',
        );
      }

      await tx.muhasebeParametresi.upsert({
        where: { tenantId: principal.tenantId },
        create: {
          tenantId: principal.tenantId,
          varsayilanKasaHesapId: dto.varsayilanKasaHesapId ?? null,
          varsayilanBankaHesapId: dto.varsayilanBankaHesapId ?? null,
          donemKariHesapId: dto.donemKariHesapId ?? null,
          yevmiyeBaslangicNo: dto.yevmiyeBaslangicNo ?? 1,
          taslakMizanaGirer: dto.taslakMizanaGirer ?? false,
          geriyeDonukGun: dto.geriyeDonukGun ?? 0,
          ...(dto.muhasebeDerinligi === undefined
            ? {} : { muhasebeDerinligi: dto.muhasebeDerinligi }),
        },
        update: {
          ...(dto.varsayilanKasaHesapId === undefined
            ? {} : { varsayilanKasaHesapId: dto.varsayilanKasaHesapId }),
          ...(dto.varsayilanBankaHesapId === undefined
            ? {} : { varsayilanBankaHesapId: dto.varsayilanBankaHesapId }),
          ...(dto.donemKariHesapId === undefined
            ? {} : { donemKariHesapId: dto.donemKariHesapId }),
          ...(dto.yevmiyeBaslangicNo === undefined
            ? {} : { yevmiyeBaslangicNo: dto.yevmiyeBaslangicNo }),
          ...(dto.taslakMizanaGirer === undefined
            ? {} : { taslakMizanaGirer: dto.taslakMizanaGirer }),
          ...(dto.geriyeDonukGun === undefined
            ? {} : { geriyeDonukGun: dto.geriyeDonukGun }),
          ...(dto.muhasebeDerinligi === undefined
            ? {} : { muhasebeDerinligi: dto.muhasebeDerinligi }),
        },
      });

      // Parametre değişikliği DENETİME YAZILIR: `taslakMizanaGirer` gibi bir
      // bayrak mali tabloyu değiştirir ve kimin açtığı sorulabilir olmalıdır.
      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'MuhasebeParametresi', varlikId: principal.tenantId,
        oncekiDeger: onceki === null ? null : {
          taslakMizanaGirer: onceki.taslakMizanaGirer,
          geriyeDonukGun: onceki.geriyeDonukGun,
          yevmiyeBaslangicNo: onceki.yevmiyeBaslangicNo,
        },
        sonrakiDeger: {
          taslakMizanaGirer: dto.taslakMizanaGirer ?? onceki?.taslakMizanaGirer ?? false,
          geriyeDonukGun: dto.geriyeDonukGun ?? onceki?.geriyeDonukGun ?? 0,
          yevmiyeBaslangicNo: dto.yevmiyeBaslangicNo ?? onceki?.yevmiyeBaslangicNo ?? 1,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { durum: 'KAYDEDILDI' };
    });
  }
}
