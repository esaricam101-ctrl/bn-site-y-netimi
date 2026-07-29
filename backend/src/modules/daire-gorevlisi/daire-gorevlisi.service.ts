/**
 * Daire Görevlisi servisi — İŞVERENİ MALİK / KİRACI / SAKİN olan kişi.
 *
 * Çocuk bakıcısı · hasta bakıcısı · ev yardımcısı · temizlikçi · aşçı ·
 * şoför · özel güvenlik · özel öğretmen. Ücretini daire sahibi öder.
 *
 * ⚠️  YÖNETİM BU KİŞİNİN İŞVERENİ DEĞİLDİR. Kayıt, yönetimin site giriş ve
 *     güvenlik kütüğü olarak tuttuğu bilgidir. Bu yüzden SGK · departman ·
 *     vardiya · zimmet YOKTUR; bunlar `site-personeli` modülündedir.
 *
 * ⚠️  `Kisi` KAYDI AÇILMAZ. Görevli bir hak sahibi değildir: borç sorumlusu
 *     olmaz, tahakkuka girmez, arsa payı taşımaz. `Kisi`ye yazılsaydı
 *     malik/kiracı listelerine karışır ve borç sorumluluğu sorgularında
 *     görünürdü. `isverenKisiId` yalnızca ONU ÇALIŞTIRAN kişiyi gösterir.
 *
 * KAYIT SİLİNMEZ, KAPANIR: hizmet ilişkisi `calismaBitis` ile sonlandırılır.
 * Geçmişe dönük "o tarihte siteye kim giriyordu" sorusu bu kayda dayanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { silmeyiDogrula, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { plakalariYaz } from '../../common/kayit/hizli-kayit';
import type {
  DaireGorevlisiAyrilDto, DaireGorevlisiDuzeltDto, DaireGorevlisiEkleDto,
} from './dto/daire-gorevlisi.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface GorevliAraciSatiri {
  readonly id: string;
  readonly plaka: string;
  readonly tur: string;
  readonly otoparkYeri: string | null;
}

export interface DaireGorevlisiSatiri {
  readonly id: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly ad: string;
  readonly soyad: string;
  readonly adSoyad: string;
  readonly gorev: string;
  readonly isvereniTipi: string;
  readonly isverenKisiId: string | null;
  readonly isverenAdSoyad: string | null;
  readonly tcKimlikNo: string | null;
  readonly telefon: string | null;
  readonly eposta: string | null;
  readonly dogumTarihi: string | null;
  readonly cinsiyet: string;
  readonly adres: string | null;
  readonly calismaBaslangic: string;
  readonly calismaBitis: string | null;
  readonly aciklama: string | null;
  readonly notlar: string | null;
  readonly durum: string;
  readonly araclari: readonly GorevliAraciSatiri[];
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

@Injectable()
export class DaireGorevlisiServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  // ---------------------------------------------------------------- okuma

  async listele(
    principal: Principal,
    suzgec: {
      readonly bolumId?: string; readonly gorev?: string;
      readonly durum?: string; readonly arama?: string;
    } = {},
  ): Promise<readonly DaireGorevlisiSatiri[]> {
    const aramaMetni = suzgec.arama?.trim();

    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.daireGorevlisi.findMany({
          where: {
            tenantId: principal.tenantId,
            // Soft delete uzantısı istemciye bağlı değil; açıkça süzülür.
            silinmeTarihi: null,
            ...(suzgec.bolumId ? { bolumId: suzgec.bolumId } : {}),
            ...(suzgec.gorev ? { gorev: suzgec.gorev as never } : {}),
            ...(suzgec.durum ? { durum: suzgec.durum as never } : {}),
            ...(aramaMetni
              ? {
                  OR: [
                    { ad: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { soyad: { contains: aramaMetni, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          include: {
            bolum: { select: { kapiNo: true } },
            isverenKisi: { select: { ad: true, soyad: true } },
            araclari: {
              select: { id: true, plaka: true, tur: true, otoparkYeri: true },
              orderBy: { plaka: 'asc' },
            },
          },
          orderBy: [{ durum: 'asc' }, { soyad: 'asc' }, { ad: 'asc' }],
        }),
      principal.tenantId,
    );

    return kayitlar.map((g) => ({
      id: g.id,
      bolumId: g.bolumId,
      kapiNo: g.bolum.kapiNo,
      ad: g.ad,
      soyad: g.soyad,
      adSoyad: `${g.ad} ${g.soyad}`,
      gorev: g.gorev,
      isvereniTipi: g.isvereniTipi,
      isverenKisiId: g.isverenKisiId,
      isverenAdSoyad:
        g.isverenKisi === null ? null : `${g.isverenKisi.ad} ${g.isverenKisi.soyad}`,
      tcKimlikNo: g.tcKimlikNo,
      telefon: g.telefon,
      eposta: g.eposta,
      dogumTarihi: g.dogumTarihi === null ? null : gun(g.dogumTarihi),
      cinsiyet: g.cinsiyet,
      adres: g.adres,
      calismaBaslangic: gun(g.calismaBaslangic),
      calismaBitis: g.calismaBitis === null ? null : gun(g.calismaBitis),
      aciklama: g.aciklama,
      notlar: g.notlar,
      durum: g.durum,
      araclari: g.araclari.map((a) => ({
        id: a.id, plaka: a.plaka, tur: a.tur, otoparkYeri: a.otoparkYeri,
      })),
    }));
  }

  async detay(id: string, principal: Principal): Promise<DaireGorevlisiSatiri> {
    const hepsi = await this.listele(principal);
    const kayit = hepsi.find((g) => g.id === id);
    if (kayit === undefined) throw new KayitBulunamadi(`Daire görevlisi bulunamadı: ${id}`);
    return kayit;
  }

  // ---------------------------------------------------------------- yazma

  /**
   * Tek ekrandan hızlı kayıt: kişi bilgileri, görev bilgileri ve plakalar
   * AYNI İŞLEMDE yazılır.
   *
   * Plaka yazımı hata verirse görevli kaydı da geri alınır: yarım kayıt,
   * "plakayı da girdim" sanan kullanıcı için sessiz veri kaybıdır.
   */
  async ekle(
    dto: DaireGorevlisiEkleDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly plakaSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('daire-gorevlisi.ekle');
    const id = randomUUID();
    const baslangic = takvimTarihi(dto.calismaBaslangic);
    const bitis = dto.calismaBitis === undefined ? null : takvimTarihi(dto.calismaBitis);

    if (bitis !== null && bitis < baslangic) {
      throw new IsKuraliIhlali(
        `Çalışma bitişi (${bitis}) başlangıçtan (${baslangic}) önce olamaz.`,
        'Tarihleri düzeltin.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: dto.bolumId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${dto.bolumId}`);

      if (dto.isverenKisiId !== undefined) {
        const isveren = await tx.kisi.findFirst({
          where: { id: dto.isverenKisiId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: { id: true },
        });
        if (!isveren) throw new KayitBulunamadi(`İşveren kişi bulunamadı: ${dto.isverenKisiId}`);
      }

      // Aynı TC ile AYNI BÖLÜMDE ikinci aktif kayıt açılamaz. Tekillik BÖLÜM
      // BAŞINADIR: bir temizlik görevlisinin sitede üç ayrı dairede çalışması
      // olağandır ve her biri ayrı bir hizmet ilişkisidir.
      if (dto.tcKimlikNo !== undefined) {
        const mevcut = await tx.daireGorevlisi.findFirst({
          where: {
            tenantId: principal.tenantId,
            bolumId: dto.bolumId,
            tcKimlikNo: dto.tcKimlikNo,
            calismaBitis: null,
            silinmeTarihi: null,
          },
          select: { ad: true, soyad: true },
        });
        if (mevcut) {
          throw new IsKuraliIhlali(
            `${bolum.kapiNo} numaralı bölümde bu TC kimlik numarasıyla süren bir ` +
              `görevli kaydı var: ${mevcut.ad} ${mevcut.soyad}.`,
            'Önce mevcut kaydı sonlandırın ya da bilgileri düzeltin.',
          );
        }
      }

      await tx.daireGorevlisi.create({
        data: {
          id,
          tenantId: principal.tenantId,
          bolumId: dto.bolumId,
          isvereniTipi: dto.isvereniTipi,
          isverenKisiId: dto.isverenKisiId ?? null,
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
          gorev: dto.gorev,
          calismaBaslangic: new Date(baslangic),
          calismaBitis: bitis === null ? null : new Date(bitis),
          aciklama: dto.aciklama?.trim() ?? null,
          notlar: dto.notlar?.trim() ?? null,
          // Bitiş girildiyse kayıt PASİF açılır; kısıt aksini reddeder.
          durum: bitis === null ? 'AKTIF' : 'PASIF',
        },
      });

      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId: dto.bolumId,
        sahip: { gorevliId: id },
        baslangic,
        bitis,
        plakalar: dto.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'DaireGorevlisi', varlikId: id,
        // KVKK: TC kimlik no denetim gövdesine YAZILMAZ. Audit kaydı
        // değiştirilemezdir; oraya giren kişisel veri bir daha silinemez.
        sonrakiDeger: {
          bolumId: dto.bolumId, kapiNo: bolum.kapiNo,
          ad: dto.ad, soyad: dto.soyad, gorev: dto.gorev,
          isvereniTipi: dto.isvereniTipi,
          calismaBaslangic: baslangic, calismaBitis: bitis,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id,
        durum: bitis === null ? 'AKTIF' : 'PASIF',
        plakaSayisi: plakalar.length,
      };
    });
  }

  async duzelt(
    id: string, dto: DaireGorevlisiDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('daire-gorevlisi.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.daireGorevlisi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
      });
      if (!kayit) throw new KayitBulunamadi(`Daire görevlisi bulunamadı: ${id}`);

      if (dto.isverenKisiId !== undefined) {
        const isveren = await tx.kisi.findFirst({
          where: { id: dto.isverenKisiId, tenantId: principal.tenantId, silinmeTarihi: null },
          select: { id: true },
        });
        if (!isveren) throw new KayitBulunamadi(`İşveren kişi bulunamadı: ${dto.isverenKisiId}`);
      }

      await tx.daireGorevlisi.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.soyad === undefined ? {} : { soyad: dto.soyad.trim() }),
          ...(dto.telefon === undefined ? {} : { telefon: dto.telefon.trim() }),
          ...(dto.eposta === undefined ? {} : { eposta: dto.eposta.trim().toLowerCase() }),
          ...(dto.cinsiyet === undefined ? {} : { cinsiyet: dto.cinsiyet }),
          ...(dto.adres === undefined ? {} : { adres: dto.adres.trim() }),
          ...(dto.gorev === undefined ? {} : { gorev: dto.gorev }),
          ...(dto.isvereniTipi === undefined ? {} : { isvereniTipi: dto.isvereniTipi }),
          ...(dto.isverenKisiId === undefined ? {} : { isverenKisiId: dto.isverenKisiId }),
          ...(dto.aciklama === undefined ? {} : { aciklama: dto.aciklama.trim() }),
          ...(dto.notlar === undefined ? {} : { notlar: dto.notlar.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'DaireGorevlisi', varlikId: id,
        oncekiDeger: {
          ad: kayit.ad, soyad: kayit.soyad, gorev: kayit.gorev,
          isvereniTipi: kayit.isvereniTipi,
        },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad, soyad: dto.soyad ?? kayit.soyad,
          gorev: dto.gorev ?? kayit.gorev,
          isvereniTipi: dto.isvereniTipi ?? kayit.isvereniTipi,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Hizmet ilişkisini sonlandırır — kayıt KAPANIR, silinmez.
   *
   * Durum aynı işlemde PASIF'e çekilir: veritabanı kısıtı
   * (`daire_gorevlisi_durum_tutarlilik`) bitmiş çalışmanın AKTİF kalmasını
   * reddeder. Ayrı bırakılsaydı "dairede çalışan görevliler" listesi kartı
   * iptal edilmiş kişileri gösterir ve site giriş yetkisi açık kalırdı.
   *
   * GÖREVLİNİN ARAÇLARI DA AYNI TARİHTE KAPANIR: işi bitmiş görevlinin aracı
   * otopark sayımında yer kaplamaya devam ederse kapasite yanlış görünür.
   */
  async ayril(
    id: string, dto: DaireGorevlisiAyrilDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly kapatilanAracSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('daire-gorevlisi.ayril');
    const bitis = takvimTarihi(dto.calismaBitis);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.daireGorevlisi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
      });
      if (!kayit) throw new KayitBulunamadi(`Daire görevlisi bulunamadı: ${id}`);

      if (kayit.calismaBitis !== null) {
        throw new IsKuraliIhlali(
          `${kayit.ad} ${kayit.soyad} için çalışma ${gun(kayit.calismaBitis)} ` +
            'tarihinde zaten sonlandırılmış.',
          'Yeniden başlıyorsa yeni kayıt açın.',
        );
      }
      if (bitis < gun(kayit.calismaBaslangic)) {
        throw new IsKuraliIhlali(
          `Bitiş (${bitis}) çalışma başlangıcından ` +
            `(${gun(kayit.calismaBaslangic)}) önce olamaz.`,
          'Tarihi düzeltin.',
        );
      }

      await tx.daireGorevlisi.update({
        where: { id },
        data: { calismaBitis: new Date(bitis), durum: 'PASIF' },
      });

      const arac = await tx.arac.updateMany({
        where: { tenantId: principal.tenantId, gorevliId: id, bitis: null },
        data: { bitis: new Date(bitis) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'DaireGorevlisi', varlikId: id,
        oncekiDeger: { durum: kayit.durum, calismaBitis: null },
        sonrakiDeger: {
          durum: 'PASIF', calismaBitis: bitis, kapatilanAracSayisi: arac.count,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SONLANDIRILDI', kapatilanAracSayisi: arac.count };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('daire-gorevlisi.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.daireGorevlisi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Daire görevlisi bulunamadı: ${id}`);

      // Araç kaydı `ON DELETE RESTRICT` ile bağlıdır; soft delete onu
      // düşürmez ama otopark listesinde sahibi arşivlenmiş araç kalmamalı.
      const acikArac = await tx.arac.count({
        where: { tenantId: principal.tenantId, gorevliId: id, bitis: null },
      });
      silmeyiDogrula(
        {
          varlik: 'DaireGorevlisi',
          sinif: 'ANA_VERI',
          engelleyenBagimliliklar:
            acikArac === 0
              ? []
              : [
                  {
                    aciklama: `${acikArac} açık araç kaydı var.`,
                    kontrol: 'DAIRE_GOREVLISI_ACIK_ARAC',
                  },
                ],
        },
        gerekce,
      );

      await tx.daireGorevlisi.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'DaireGorevlisi', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SILINDI' };
    });
  }
}
