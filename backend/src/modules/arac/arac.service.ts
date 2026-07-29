/**
 * Araç servisi.
 *
 * DÖNEMSELDİR, SİLİNMEZ. Araç kaydı `bitis` ile kapanır; satır silinmez.
 * Otopark gideri KULLANIM_BAZLI dağıtıldığında hangi ayda hangi aracın
 * kayıtlı olduğu geriye dönük bilinmek zorundadır — kayıt silinseydi geçmiş
 * bir dönemin dağıtımı bugün yeniden hesaplandığında farklı çıkardı.
 *
 * Doğrulama domain katmanındadır (`shared/apartman-domain/src/arac`):
 * plaka biçimi, dönem çakışması ve otopark hakkı aşımı orada tanımlıdır ve
 * API ile tahakkuk AYNI kuralı kullanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  aracKaydiniDogrula, otoparkDurumu, plakayiDogrula, tarihtekiAraclar,
  type Arac, type OtoparkDurumu,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { AracDuzeltDto, AracEkleDto, AracSonlandirDto } from './dto/arac.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface AracSatiri {
  readonly id: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly plaka: string;
  readonly tur: string;
  readonly marka: string | null;
  readonly model: string | null;
  readonly renk: string | null;
  readonly otoparkYeri: string | null;
  readonly baslangic: string;
  readonly bitis: string | null;
  readonly gecerliMi: boolean;
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

@Injectable()
export class AracServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  async listele(
    principal: Principal,
    suzgec: { readonly bolumId?: string; readonly yalnizcaGecerli?: boolean } = {},
  ): Promise<readonly AracSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.arac.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.bolumId ? { bolumId: suzgec.bolumId } : {}),
          },
          select: {
            id: true, bolumId: true, kisiId: true, plaka: true, tur: true,
            marka: true, model: true, renk: true, otoparkYeri: true,
            baslangic: true, bitis: true,
            bolum: { select: { kapiNo: true } },
            kisi: { select: { ad: true, soyad: true } },
          },
          orderBy: [{ bitis: 'asc' }, { plaka: 'asc' }],
        }),
      principal.tenantId,
    );

    const simdi = bugun();
    const satirlar = kayitlar.map((a) => {
      const baslangic = gun(a.baslangic);
      const bitis = a.bitis === null ? null : gun(a.bitis);
      return {
        id: a.id,
        bolumId: a.bolumId,
        kapiNo: a.bolum.kapiNo,
        kisiId: a.kisiId,
        kisiAdi: `${a.kisi.ad} ${a.kisi.soyad}`,
        plaka: a.plaka,
        tur: a.tur,
        marka: a.marka,
        model: a.model,
        renk: a.renk,
        otoparkYeri: a.otoparkYeri,
        baslangic,
        bitis,
        gecerliMi: baslangic <= simdi && (bitis === null || bitis >= simdi),
      };
    });

    return suzgec.yalnizcaGecerli === true
      ? satirlar.filter((s) => s.gecerliMi)
      : satirlar;
  }

  async ekle(dto: AracEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('arac.ekle');
    // Plaka biçimi domain kuralıdır: harf+rakam toplamı 5 ya da 6 olmalıdır
    // ("34 ABC 123" geçerlidir, "34 A 1" değildir).
    const plaka = plakayiDogrula(dto.plaka);
    const baslangic = takvimTarihi(dto.baslangic);
    const bitis = dto.bitis === undefined ? null : takvimTarihi(dto.bitis);
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: dto.bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${dto.bolumId}`);

      const kisi = await tx.kisi.findFirst({
        where: { id: dto.kisiId, tenantId: principal.tenantId },
        select: { id: true },
      });
      if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.kisiId}`);

      // Çakışma denetimi TENANT GENELİNDE yapılır, bölüm içinde değil: aynı
      // plaka iki ayrı daireye kayıtlıysa araç iki kez sayılır ve otopark
      // gideri fazla dağıtılır.
      const mevcutKayitlar = await tx.arac.findMany({
        where: { tenantId: principal.tenantId, plaka },
        select: {
          id: true, bolumId: true, kisiId: true, plaka: true, tur: true,
          marka: true, model: true, renk: true, otoparkYeri: true,
          baslangic: true, bitis: true,
        },
      });

      const mevcut: Arac[] = mevcutKayitlar.map((m) => ({
        id: m.id, bolumId: m.bolumId, kisiId: m.kisiId, plaka: m.plaka,
        tur: m.tur, marka: m.marka, model: m.model, renk: m.renk,
        otoparkYeri: m.otoparkYeri,
        baslangic: gun(m.baslangic),
        bitis: m.bitis === null ? null : gun(m.bitis),
      }));

      aracKaydiniDogrula(mevcut, {
        id, bolumId: dto.bolumId, kisiId: dto.kisiId, plaka,
        tur: dto.tur ?? 'OTOMOBIL',
        marka: dto.marka ?? null, model: dto.model ?? null, renk: dto.renk ?? null,
        otoparkYeri: dto.otoparkYeri ?? null,
        baslangic, bitis,
      });

      await tx.arac.create({
        data: {
          id, tenantId: principal.tenantId,
          bolumId: dto.bolumId, kisiId: dto.kisiId, plaka,
          tur: dto.tur ?? 'OTOMOBIL',
          marka: dto.marka ?? null, model: dto.model ?? null, renk: dto.renk ?? null,
          otoparkYeri: dto.otoparkYeri ?? null,
          baslangic: new Date(baslangic),
          bitis: bitis === null ? null : new Date(bitis),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Arac', varlikId: id,
        sonrakiDeger: { plaka, bolumId: dto.bolumId, kisiId: dto.kisiId, baslangic },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** Yalnızca tanımlayıcı OLMAYAN alanlar düzeltilir. */
  async duzelt(id: string, dto: AracDuzeltDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('arac.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.arac.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Araç kaydı bulunamadı: ${id}`);

      await tx.arac.update({
        where: { id },
        data: {
          ...(dto.tur === undefined ? {} : { tur: dto.tur }),
          ...(dto.marka === undefined ? {} : { marka: dto.marka.trim() }),
          ...(dto.model === undefined ? {} : { model: dto.model.trim() }),
          ...(dto.renk === undefined ? {} : { renk: dto.renk.trim() }),
          ...(dto.otoparkYeri === undefined ? {} : { otoparkYeri: dto.otoparkYeri.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Arac', varlikId: id,
        oncekiDeger: {
          tur: kayit.tur, marka: kayit.marka, model: kayit.model,
          renk: kayit.renk, otoparkYeri: kayit.otoparkYeri,
        },
        sonrakiDeger: {
          tur: dto.tur ?? kayit.tur,
          marka: dto.marka ?? kayit.marka,
          model: dto.model ?? kayit.model,
          renk: dto.renk ?? kayit.renk,
          otoparkYeri: dto.otoparkYeri ?? kayit.otoparkYeri,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /** Kayıt SİLİNMEZ; dönem kapanır. */
  async sonlandir(
    id: string, dto: AracSonlandirDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('arac.sonlandir');
    const bitis = takvimTarihi(dto.bitis);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.arac.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, plaka: true, baslangic: true, bitis: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Araç kaydı bulunamadı: ${id}`);

      if (kayit.bitis !== null) {
        throw new IsKuraliIhlali(
          `'${kayit.plaka}' kaydı ${gun(kayit.bitis)} tarihinde zaten sonlandırılmış.`,
          'Yeni bir kayıt açın.',
        );
      }
      if (bitis < gun(kayit.baslangic)) {
        throw new IsKuraliIhlali(
          `Bitiş (${bitis}) başlangıçtan (${gun(kayit.baslangic)}) önce olamaz.`,
          'Bitiş tarihini düzeltin.',
        );
      }

      await tx.arac.update({ where: { id }, data: { bitis: new Date(bitis) } });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Arac', varlikId: id,
        oncekiDeger: { bitis: null }, sonrakiDeger: { bitis },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SONLANDIRILDI' };
    });
  }

  /**
   * Otopark hak/kullanım durumu.
   *
   * Aşımı ENGELLEMEZ, GÖRÜNÜR kılar: misafir aracı ya da geçici durumlar
   * meşrudur ve yönetim kararı gerektirir. Sessizce fazla araç kaydedilmesi
   * ise otopark giderinin dağıtımını bozar.
   */
  async otoparkDurumu(
    bolumId: string, hakSayisi: number, principal: Principal,
  ): Promise<OtoparkDurumu> {
    const araclar = await this.listele(principal, { bolumId });
    const domainAraclar: Arac[] = araclar.map((a) => ({
      id: a.id, bolumId: a.bolumId, kisiId: a.kisiId, plaka: a.plaka,
      tur: a.tur as Arac['tur'],
      marka: a.marka, model: a.model, renk: a.renk,
      otoparkYeri: a.otoparkYeri,
      baslangic: takvimTarihi(a.baslangic),
      bitis: a.bitis === null ? null : takvimTarihi(a.bitis),
    }));

    return otoparkDurumu({ bolumId, hakSayisi }, domainAraclar, bugun());
  }

  /** Belirli bir tarihte geçerli araçlar — tahakkuk KULLANIM_BAZLI için. */
  async tarihteGecerliler(
    principal: Principal, tarih: TakvimTarihi,
  ): Promise<readonly AracSatiri[]> {
    const hepsi = await this.listele(principal);
    const domainAraclar: Arac[] = hepsi.map((a) => ({
      id: a.id, bolumId: a.bolumId, kisiId: a.kisiId, plaka: a.plaka,
      tur: a.tur as Arac['tur'],
      marka: a.marka, model: a.model, renk: a.renk,
      otoparkYeri: a.otoparkYeri,
      baslangic: takvimTarihi(a.baslangic),
      bitis: a.bitis === null ? null : takvimTarihi(a.bitis),
    }));
    const gecerliIdler = new Set(tarihtekiAraclar(domainAraclar, tarih).map((a) => a.id));
    return hepsi.filter((a) => gecerliIdler.has(a.id));
  }
}
