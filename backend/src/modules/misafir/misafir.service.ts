/**
 * Misafir servisi — bağımsız bölümü ziyaret eden kişi.
 *
 * ⚠️  MİSAFİR HAK SAHİBİ DEĞİLDİR: borç sorumlusu olmaz, tahakkuka girmez,
 *     arsa payı taşımaz, genel kurulda oy kullanmaz. Bu yüzden `Kisi` kaydı
 *     AÇILMAZ ve bilgiler misafir kaydının içinde tutulur. `Kisi`ye
 *     yazılsaydı malik/kiracı listelerine karışır ve borç sorumluluğu
 *     sorgularında görünürdü.
 *
 * ⚠️  KVKK — VERİ ÖMRÜ. Misafir verisi doğası gereği kısa ömürlüdür; kalıcı
 *     bir kimlik kaydı açmak, ziyaretten aylar sonra silinmesi gereken
 *     veriyi malik/kiracı kayıtlarıyla aynı ömre bağlardı. Silme
 *     `gerekce` ile yapılır ve denetim kaydına yazılır.
 *
 * ÇIKIŞ TARİHİ BOŞSA MİSAFİR HÂLEN İÇERİDEDİR. Güvenlik ve tahliye listesi
 * bu alana dayanır; bu yüzden `icerideOlanlar` ayrı bir uçtur.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { plakalariYaz } from '../../common/kayit/hizli-kayit';
import type { MisafirCikisDto, MisafirDuzeltDto, MisafirEkleDto } from './dto/misafir.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface MisafirAraciSatiri {
  readonly id: string;
  readonly plaka: string;
  readonly tur: string;
  readonly otoparkYeri: string | null;
}

export interface MisafirSatiri {
  readonly id: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly ad: string;
  readonly soyad: string;
  readonly adSoyad: string;
  readonly tcKimlikNo: string | null;
  readonly telefon: string | null;
  readonly eposta: string | null;
  readonly dogumTarihi: string | null;
  readonly cinsiyet: string;
  readonly adres: string | null;
  readonly notlar: string | null;
  readonly girisTarihi: string;
  readonly cikisTarihi: string | null;
  readonly ziyaretNedeni: string | null;
  /** Çıkış tarihi boşsa doğrudur — güvenlik listesi bunu kullanır. */
  readonly icerideMi: boolean;
  readonly araclari: readonly MisafirAraciSatiri[];
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

@Injectable()
export class MisafirServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  // ---------------------------------------------------------------- okuma

  async listele(
    principal: Principal,
    suzgec: {
      readonly bolumId?: string; readonly icerideMi?: boolean;
      readonly arama?: string;
    } = {},
  ): Promise<readonly MisafirSatiri[]> {
    const aramaMetni = suzgec.arama?.trim();

    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.misafir.findMany({
          where: {
            tenantId: principal.tenantId,
            // Soft delete uzantısı istemciye bağlı değil; açıkça süzülür.
            silinmeTarihi: null,
            ...(suzgec.bolumId ? { bolumId: suzgec.bolumId } : {}),
            ...(suzgec.icerideMi === undefined
              ? {}
              : suzgec.icerideMi
                ? { cikisTarihi: null }
                : { cikisTarihi: { not: null } }),
            ...(aramaMetni
              ? {
                  OR: [
                    { ad: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { soyad: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { ziyaretNedeni: { contains: aramaMetni, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          include: {
            bolum: { select: { kapiNo: true } },
            araclari: {
              select: { id: true, plaka: true, tur: true, otoparkYeri: true },
              orderBy: { plaka: 'asc' },
            },
          },
          orderBy: [{ girisTarihi: 'desc' }, { soyad: 'asc' }],
        }),
      principal.tenantId,
    );

    return kayitlar.map((m) => ({
      id: m.id,
      bolumId: m.bolumId,
      kapiNo: m.bolum.kapiNo,
      ad: m.ad,
      soyad: m.soyad,
      adSoyad: `${m.ad} ${m.soyad}`,
      tcKimlikNo: m.tcKimlikNo,
      telefon: m.telefon,
      eposta: m.eposta,
      dogumTarihi: m.dogumTarihi === null ? null : gun(m.dogumTarihi),
      cinsiyet: m.cinsiyet,
      adres: m.adres,
      notlar: m.notlar,
      girisTarihi: gun(m.girisTarihi),
      cikisTarihi: m.cikisTarihi === null ? null : gun(m.cikisTarihi),
      ziyaretNedeni: m.ziyaretNedeni,
      icerideMi: m.cikisTarihi === null,
      araclari: m.araclari.map((a) => ({
        id: a.id, plaka: a.plaka, tur: a.tur, otoparkYeri: a.otoparkYeri,
      })),
    }));
  }

  /** Hâlen içeride olan misafirler — güvenlik ve tahliye listesi. */
  icerideOlanlar(principal: Principal): Promise<readonly MisafirSatiri[]> {
    return this.listele(principal, { icerideMi: true });
  }

  async detay(id: string, principal: Principal): Promise<MisafirSatiri> {
    const hepsi = await this.listele(principal);
    const kayit = hepsi.find((m) => m.id === id);
    if (kayit === undefined) throw new KayitBulunamadi(`Misafir bulunamadı: ${id}`);
    return kayit;
  }

  // ---------------------------------------------------------------- yazma

  async ekle(
    dto: MisafirEkleDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly plakaSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('misafir.ekle');
    const id = randomUUID();
    const giris = takvimTarihi(dto.girisTarihi);
    const cikis = dto.cikisTarihi === undefined ? null : takvimTarihi(dto.cikisTarihi);

    if (cikis !== null && cikis < giris) {
      throw new IsKuraliIhlali(
        `Çıkış (${cikis}) giriş tarihinden (${giris}) önce olamaz.`,
        'Tarihleri düzeltin.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: dto.bolumId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${dto.bolumId}`);

      await tx.misafir.create({
        data: {
          id,
          tenantId: principal.tenantId,
          bolumId: dto.bolumId,
          ad: dto.ad.trim(),
          soyad: dto.soyad.trim(),
          tcKimlikNo: dto.tcKimlikNo ?? null,
          telefon: dto.telefon?.trim() ?? null,
          eposta: dto.eposta?.trim().toLowerCase() ?? null,
          dogumTarihi:
            dto.dogumTarihi === undefined
              ? null
              : new Date(takvimTarihi(dto.dogumTarihi)),
          cinsiyet: dto.cinsiyet ?? 'BELIRTILMEMIS',
          adres: dto.adres?.trim() ?? null,
          notlar: dto.notlar?.trim() ?? null,
          girisTarihi: new Date(giris),
          cikisTarihi: cikis === null ? null : new Date(cikis),
          ziyaretNedeni: dto.ziyaretNedeni?.trim() ?? null,
        },
      });

      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId: dto.bolumId,
        sahip: { misafirId: id },
        baslangic: giris,
        bitis: cikis,
        plakalar: dto.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Misafir', varlikId: id,
        // KVKK: TC kimlik no denetim gövdesine YAZILMAZ. Audit kaydı
        // değiştirilemezdir; oraya giren kişisel veri bir daha silinemez.
        sonrakiDeger: {
          bolumId: dto.bolumId, kapiNo: bolum.kapiNo,
          ad: dto.ad, soyad: dto.soyad,
          girisTarihi: giris, cikisTarihi: cikis,
          ziyaretNedeni: dto.ziyaretNedeni ?? null,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id,
        durum: cikis === null ? 'ICERIDE' : 'CIKTI',
        plakaSayisi: plakalar.length,
      };
    });
  }

  async duzelt(
    id: string, dto: MisafirDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('misafir.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.misafir.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
      });
      if (!kayit) throw new KayitBulunamadi(`Misafir bulunamadı: ${id}`);

      await tx.misafir.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.soyad === undefined ? {} : { soyad: dto.soyad.trim() }),
          ...(dto.telefon === undefined ? {} : { telefon: dto.telefon.trim() }),
          ...(dto.eposta === undefined ? {} : { eposta: dto.eposta.trim().toLowerCase() }),
          ...(dto.cinsiyet === undefined ? {} : { cinsiyet: dto.cinsiyet }),
          ...(dto.adres === undefined ? {} : { adres: dto.adres.trim() }),
          ...(dto.ziyaretNedeni === undefined
            ? {}
            : { ziyaretNedeni: dto.ziyaretNedeni.trim() }),
          ...(dto.notlar === undefined ? {} : { notlar: dto.notlar.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Misafir', varlikId: id,
        oncekiDeger: {
          ad: kayit.ad, soyad: kayit.soyad, ziyaretNedeni: kayit.ziyaretNedeni,
        },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad, soyad: dto.soyad ?? kayit.soyad,
          ziyaretNedeni: dto.ziyaretNedeni ?? kayit.ziyaretNedeni,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Çıkış işlemi.
   *
   * MİSAFİR ARAÇLARI DA AYNI TARİHTE KAPANIR: çıkmış misafirin aracı otopark
   * sayımında yer kaplamaya devam ederse kapasite yanlış görünür ve
   * KULLANIM_BAZLI dağıtımda fazla pay hesaplanır.
   */
  async cikis(
    id: string, dto: MisafirCikisDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly kapatilanAracSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('misafir.cikis');
    const cikis = takvimTarihi(dto.cikisTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.misafir.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
      });
      if (!kayit) throw new KayitBulunamadi(`Misafir bulunamadı: ${id}`);

      if (kayit.cikisTarihi !== null) {
        throw new IsKuraliIhlali(
          `${kayit.ad} ${kayit.soyad} ${gun(kayit.cikisTarihi)} tarihinde zaten ` +
            'çıkış yapmış.',
          'Yeni ziyaret için yeni kayıt açın.',
        );
      }
      if (cikis < gun(kayit.girisTarihi)) {
        throw new IsKuraliIhlali(
          `Çıkış (${cikis}) giriş tarihinden (${gun(kayit.girisTarihi)}) önce olamaz.`,
          'Tarihi düzeltin.',
        );
      }

      await tx.misafir.update({
        where: { id },
        data: { cikisTarihi: new Date(cikis) },
      });

      const arac = await tx.arac.updateMany({
        where: { tenantId: principal.tenantId, misafirId: id, bitis: null },
        data: { bitis: new Date(cikis) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Misafir', varlikId: id,
        oncekiDeger: { cikisTarihi: null },
        sonrakiDeger: { cikisTarihi: cikis, kapatilanAracSayisi: arac.count },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'CIKTI', kapatilanAracSayisi: arac.count };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('misafir.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.misafir.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Misafir bulunamadı: ${id}`);

      const acikArac = await tx.arac.count({
        where: { tenantId: principal.tenantId, misafirId: id, bitis: null },
      });
      silmeyiDogrula(
        {
          varlik: 'Misafir',
          sinif: 'ANA_VERI',
          engelleyenBagimliliklar:
            acikArac === 0
              ? []
              : [
                  {
                    aciklama: `${acikArac} açık araç kaydı var.`,
                    kontrol: 'MISAFIR_ACIK_ARAC',
                  },
                ],
        },
        gerekce,
      );

      await tx.misafir.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Misafir', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
