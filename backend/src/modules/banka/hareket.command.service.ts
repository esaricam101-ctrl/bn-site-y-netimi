/**
 * Banka hareketi — komut tarafı (CQRS).
 *
 * ⚠️  HAREKET BANKA GERÇEĞİDİR, FİŞ DEĞİLDİR. İkisi ayrı tutulur: hareket
 *     fiş kesilmeden de var olabilir (banka ekstresinde görünür ama henüz
 *     deftere yazılmamıştır). Tek kayıt olsaydı muhasebeleşmemiş bir hareket
 *     mizana girer ve dönem sonu tutmazdı.
 *
 * ⚠️  MUHASEBELEŞMİŞ HAREKET DEĞİŞTİRİLEMEZ. Hareket bir yevmiye fişine
 *     dayanak olmuştur; değişirse fiş ile banka gerçeği kalıcı olarak ayrışır.
 *     Düzeltme: fişin storno'su + yeni hareket.
 *
 * ⚠️  HAREKET SİLME UCU YOKTUR. `banka_hareketi` mali kayıt dayanağıdır ve
 *     soft delete alanları TAŞIMAZ; yanlış giriş, karşı yönde düzeltme
 *     hareketiyle değil ilgili kaydın düzeltilmesiyle giderilir (muhasebeleşmemişse).
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { money, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  hareketDegistirilebilirMi, hareketiDogrula, virmaniDogrula,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { FisCommandServisi } from '../muhasebe/fis.command.service';
import type {
  HareketDuzeltDto, HareketEkleDto, MuhasebelestirDto, VirmanDto,
} from './dto/banka.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

@Injectable()
export class BankaHareketCommandServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly fis: FisCommandServisi,
  ) {}

  async ekle(dto: HareketEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.hareketEkle');
    const id = randomUUID();
    const islemTarihi = takvimTarihi(dto.islemTarihi);
    const valorTarihi = dto.valorTarihi === undefined
      ? null
      : takvimTarihi(dto.valorTarihi);

    // Domain doğrulaması ÖNCE: tutar pozitif mi, tarih gelecekte mi, valör
    // sırası doğru mu, VIRMAN tek hareket olarak yazılmaya mı çalışılıyor.
    hareketiDogrula(
      {
        islemTipi: dto.islemTipi, yon: dto.yon,
        tutar: money(dto.tutar), islemTarihi, valorTarihi,
      },
      bugun(),
    );

    return this.prisma.tenantIslemi(async (tx) => {
      const hesap = await tx.bankaHesabi.findFirst({
        where: {
          id: dto.bankaHesabiId, tenantId: principal.tenantId,
          silinmeTarihi: null,
        },
        select: { id: true, ad: true, aktif: true, paraBirimi: true },
      });
      if (!hesap) {
        throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${dto.bankaHesabiId}`);
      }
      if (!hesap.aktif) {
        throw new IsKuraliIhlali(
          `'${hesap.ad}' hesabı pasif; yeni hareket girilemez.`,
          'Geçmiş hareketler korunur ama pasif hesaba yeni kayıt yazılmaz.',
        );
      }

      if (dto.posTanimiId !== undefined) {
        const pos = await tx.posTanimi.findFirst({
          where: {
            id: dto.posTanimiId, tenantId: principal.tenantId,
            silinmeTarihi: null,
          },
          select: { id: true, bankaHesabiId: true, ad: true },
        });
        if (!pos) throw new KayitBulunamadi(`POS tanımı bulunamadı: ${dto.posTanimiId}`);
        // POS başka bir hesaba bağlıysa tahsilat yanlış hesaba yazılırdı ve
        // iki hesabın bakiyesi de yanlış çıkardı.
        if (pos.bankaHesabiId !== dto.bankaHesabiId) {
          throw new IsKuraliIhlali(
            `'${pos.ad}' POS'u başka bir banka hesabına bağlı.`,
            'POS tahsilatı POS\'un bağlı olduğu hesaba yazılır.',
          );
        }
      }

      if (dto.kiymetliEvrakId !== undefined) {
        const evrak = await tx.kiymetliEvrak.findFirst({
          where: { id: dto.kiymetliEvrakId, tenantId: principal.tenantId },
          select: { id: true, evrakNo: true, durum: true },
        });
        if (!evrak) {
          throw new KayitBulunamadi(`Kıymetli evrak bulunamadı: ${dto.kiymetliEvrakId}`);
        }
      }

      await tx.bankaHareketi.create({
        data: {
          id, tenantId: principal.tenantId,
          bankaHesabiId: dto.bankaHesabiId,
          islemTipi: dto.islemTipi, yon: dto.yon,
          tutar: new Prisma.Decimal(dto.tutar),
          islemTarihi: new Date(islemTarihi),
          valorTarihi: valorTarihi === null ? null : new Date(valorTarihi),
          aciklama: dto.aciklama.trim(),
          karsiTaraf: dto.karsiTaraf?.trim() ?? null,
          karsiIban: dto.karsiIban?.replace(/\s/gu, '').toUpperCase() ?? null,
          referansNo: dto.referansNo?.trim() ?? null,
          posTanimiId: dto.posTanimiId ?? null,
          kiymetliEvrakId: dto.kiymetliEvrakId ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BankaHareketi', varlikId: id,
        sonrakiDeger: {
          hesapAdi: hesap.ad, islemTipi: dto.islemTipi, yon: dto.yon,
          tutar: dto.tutar, islemTarihi, valorTarihi,
          referansNo: dto.referansNo ?? null,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'KAYDEDILDI' };
    });
  }

  /**
   * Hareketi düzeltir. Hesap ve YÖN değiştirilemez, muhasebeleşmiş hareket
   * hiç değiştirilemez.
   *
   * EŞLEŞMİŞ HAREKET DE DEĞİŞTİRİLEMEZ: mutabakat o tutar ve tarih üzerinden
   * kurulmuştur; tutar değişirse eşleşme sessizce yanlışa döner ve mutabakat
   * tamamlanmış görünmeye devam eder.
   */
  async duzelt(
    id: string, dto: HareketDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.hareketDuzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bankaHareketi.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: {
          id: true, bankaHesabiId: true, islemTipi: true, yon: true,
          tutar: true, islemTarihi: true, valorTarihi: true,
          aciklama: true, referansNo: true, yevmiyeFisiId: true,
          _count: { select: { eslesenSatirlar: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Banka hareketi bulunamadı: ${id}`);

      hareketDegistirilebilirMi({
        id: kayit.id, bankaHesabiId: kayit.bankaHesabiId,
        islemTipi: kayit.islemTipi, yon: kayit.yon,
        tutar: money(kayit.tutar.toFixed(4)),
        islemTarihi: gun(kayit.islemTarihi),
        valorTarihi: kayit.valorTarihi === null ? null : gun(kayit.valorTarihi),
        referansNo: kayit.referansNo,
        yevmiyeFisiId: kayit.yevmiyeFisiId,
      });

      if (kayit._count.eslesenSatirlar > 0) {
        throw new IsKuraliIhlali(
          'Bu hareket bir ekstre satırıyla eşleşmiş; değiştirilemez.',
          'Mutabakat bu tutar ve tarih üzerinden kurulmuştur. Önce eşleşmeyi ' +
            'kaldırın, sonra düzeltin.',
        );
      }

      const yeniIslemTarihi = dto.islemTarihi === undefined
        ? gun(kayit.islemTarihi)
        : takvimTarihi(dto.islemTarihi);
      const yeniValor = dto.valorTarihi === undefined
        ? (kayit.valorTarihi === null ? null : gun(kayit.valorTarihi))
        : takvimTarihi(dto.valorTarihi);

      // Düzeltme sonrası hâli YENİDEN doğrulanır. Yalnızca yeni alanlar
      // denetlenseydi, valör tarihini değiştirmeden işlem tarihini ileri almak
      // valör < işlem durumunu sessizce üretirdi.
      hareketiDogrula(
        {
          islemTipi: kayit.islemTipi, yon: kayit.yon,
          tutar: money(dto.tutar ?? kayit.tutar.toFixed(4)),
          islemTarihi: yeniIslemTarihi, valorTarihi: yeniValor,
        },
        bugun(),
      );

      await tx.bankaHareketi.update({
        where: { id },
        data: {
          ...(dto.tutar === undefined ? {} : { tutar: new Prisma.Decimal(dto.tutar) }),
          ...(dto.islemTarihi === undefined
            ? {}
            : { islemTarihi: new Date(yeniIslemTarihi) }),
          ...(dto.valorTarihi === undefined
            ? {}
            : { valorTarihi: new Date(dto.valorTarihi) }),
          ...(dto.aciklama === undefined ? {} : { aciklama: dto.aciklama.trim() }),
          ...(dto.karsiTaraf === undefined ? {} : { karsiTaraf: dto.karsiTaraf.trim() }),
          ...(dto.referansNo === undefined ? {} : { referansNo: dto.referansNo.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BankaHareketi', varlikId: id,
        oncekiDeger: {
          tutar: kayit.tutar.toFixed(4),
          islemTarihi: gun(kayit.islemTarihi),
          aciklama: kayit.aciklama, referansNo: kayit.referansNo,
        },
        sonrakiDeger: {
          tutar: dto.tutar ?? kayit.tutar.toFixed(4),
          islemTarihi: yeniIslemTarihi,
          aciklama: dto.aciklama ?? kayit.aciklama,
          referansNo: dto.referansNo ?? kayit.referansNo,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * VİRMAN — kendi hesapları arası transfer. İKİ hareket üretir.
   *
   * ⚠️  İKİ BACAK AYNI TRANSACTION'DA yazılır ve birbirine referans verir.
   *     Tek kayıt olsaydı hesap bazlı ekstre eksik çıkardı; ayrı işlemlerde
   *     yazılsaydı biri başarısız olduğunda para bir hesaptan çıkıp hiçbir
   *     yere girmemiş görünürdü.
   */
  async virman(
    dto: VirmanDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly cikisId: string; readonly girisId: string }> {
    const baglam = mevcutBaglamiZorunluKil('banka.virman');
    const cikisId = randomUUID();
    const girisId = randomUUID();
    const islemTarihi = takvimTarihi(dto.islemTarihi);

    virmaniDogrula(
      {
        kaynakHesapId: dto.kaynakHesapId, hedefHesapId: dto.hedefHesapId,
        tutar: money(dto.tutar), islemTarihi,
      },
      bugun(),
    );

    return this.prisma.tenantIslemi(async (tx) => {
      const hesaplar = await tx.bankaHesabi.findMany({
        where: {
          id: { in: [dto.kaynakHesapId, dto.hedefHesapId] },
          tenantId: principal.tenantId, silinmeTarihi: null,
        },
        select: { id: true, ad: true, aktif: true, paraBirimi: true },
      });
      const kaynak = hesaplar.find((h) => h.id === dto.kaynakHesapId);
      const hedef = hesaplar.find((h) => h.id === dto.hedefHesapId);
      if (!kaynak) throw new KayitBulunamadi(`Kaynak hesap bulunamadı: ${dto.kaynakHesapId}`);
      if (!hedef) throw new KayitBulunamadi(`Hedef hesap bulunamadı: ${dto.hedefHesapId}`);
      for (const h of [kaynak, hedef]) {
        if (!h.aktif) {
          throw new IsKuraliIhlali(
            `'${h.ad}' hesabı pasif; virman yapılamaz.`,
            'Pasif hesaba/hesaptan yeni hareket yazılmaz.',
          );
        }
      }

      // FARKLI PARA BİRİMİ virman DEĞİLDİR, kur işlemidir: tek tutarla iki
      // hesaba yazılırsa biri kesinlikle yanlış olur.
      if (kaynak.paraBirimi !== hedef.paraBirimi) {
        throw new IsKuraliIhlali(
          `Para birimleri farklı (${kaynak.paraBirimi} → ${hedef.paraBirimi}); ` +
            'virman yapılamaz.',
          'Farklı para birimi arasındaki transfer bir KUR İŞLEMİDİR ve iki ayrı ' +
            'hareket + kur farkı kaydı gerektirir.',
        );
      }

      const tutar = new Prisma.Decimal(dto.tutar);
      const aciklama = dto.aciklama.trim();

      // Çıkış bacağı önce yazılır, giriş ona referans verir, sonra çıkış
      // güncellenip karşılıklı bağ kurulur. Tek adımda yazılamaz: FK iki
      // satırın da var olmasını ister.
      await tx.bankaHareketi.create({
        data: {
          id: cikisId, tenantId: principal.tenantId,
          bankaHesabiId: dto.kaynakHesapId,
          islemTipi: 'VIRMAN', yon: 'CIKIS', tutar,
          islemTarihi: new Date(islemTarihi),
          aciklama: `${aciklama} → ${hedef.ad}`,
        },
      });
      await tx.bankaHareketi.create({
        data: {
          id: girisId, tenantId: principal.tenantId,
          bankaHesabiId: dto.hedefHesapId,
          islemTipi: 'VIRMAN', yon: 'GIRIS', tutar,
          islemTarihi: new Date(islemTarihi),
          aciklama: `${aciklama} ← ${kaynak.ad}`,
          karsiHareketId: cikisId,
        },
      });
      await tx.bankaHareketi.update({
        where: { id: cikisId },
        data: { karsiHareketId: girisId },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BankaHareketi', varlikId: cikisId,
        sonrakiDeger: {
          islemTipi: 'VIRMAN', tutar: dto.tutar, islemTarihi,
          kaynak: kaynak.ad, hedef: hedef.ad, karsiHareketId: girisId,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: cikisId, durum: 'KAYDEDILDI', cikisId, girisId };
    });
  }

  /**
   * MUHASEBELEŞTİRME — hareketten yevmiye fişi üretir.
   *
   * Banka tarafı hesabın kendi muhasebe karşılığına yazılır; karşı hesap
   * çağırandan gelir çünkü aynı para girişi aidat tahsilatı da kira geliri de
   * olabilir ve bunu sistem bilemez.
   *
   * Yön çevirimi:
   *   GİRİŞ  → banka hesabı BORÇLU (varlık arttı), karşı hesap ALACAKLI
   *   ÇIKIŞ  → banka hesabı ALACAKLI (varlık azaldı), karşı hesap BORÇLU
   *
   * ⚠️  FİŞ ÜRETİMİ VE HAREKETİN İŞARETLENMESİ AYNI TRANSACTION'DA. İki ayrı
   *     işlem olsaydı fiş yazılıp hareket işaretlenmeden hata alınabilir;
   *     hareket "muhasebeleşmemiş" görünmeye devam eder ve tekrar
   *     muhasebeleştirilerek AYNI PARA İKİ KEZ deftere girerdi.
   *
   * ⚠️  ZATEN MUHASEBELEŞMİŞ HAREKET REDDEDİLİR — mükerrer kaydın tek koruması
   *     bu denetimdir.
   */
  async muhasebelestir(
    id: string, dto: MuhasebelestirDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly fisId: string; readonly fisNo: string }> {
    const baglam = mevcutBaglamiZorunluKil('banka.muhasebelestir');

    return this.prisma.tenantIslemi(async (tx) => {
      const hareket = await tx.bankaHareketi.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: {
          id: true, yon: true, tutar: true, islemTarihi: true,
          aciklama: true, islemTipi: true, yevmiyeFisiId: true,
          bankaHesabi: {
            select: { ad: true, muhasebeHesapId: true, muhasebeHesabi: { select: { kod: true } } },
          },
        },
      });
      if (!hareket) throw new KayitBulunamadi(`Banka hareketi bulunamadı: ${id}`);

      if (hareket.yevmiyeFisiId !== null) {
        throw new IsKuraliIhlali(
          'Bu hareket zaten muhasebeleştirilmiş.',
          'Aynı hareket iki kez muhasebeleştirilse aynı para iki kez deftere ' +
            'girer. Düzeltme için ilgili fişi storno edin.',
        );
      }

      const bankaHesapId = hareket.bankaHesabi.muhasebeHesapId;
      if (bankaHesapId === dto.karsiHesapId) {
        throw new IsKuraliIhlali(
          'Karşı hesap, banka hesabının muhasebe karşılığı ile aynı olamaz.',
          'Aynı hesaba borç ve alacak yazan fiş bakiyeyi değiştirmez; ' +
            'kayıt anlamsız olur.',
        );
      }

      const tutar = hareket.tutar.toFixed(4);
      const bankaBorclu = hareket.yon === 'GIRIS';

      // Fiş üretimi KOPYALANMADI: dönem denetimi, çift kayıt denkliği, fiş no
      // tahsisi ve audit zaten `FisCommandServisi` içinde. Aynı transaction'da
      // çağrılır.
      const fis = await this.fis.ekleIslemde(
        tx,
        {
          tarih: gun(hareket.islemTarihi),
          aciklama: `Banka (${hareket.bankaHesabi.ad}): ${hareket.aciklama}`,
          fisTuru: hareket.yon === 'GIRIS' ? 'TAHSILAT' : 'TEDIYE',
          kaynakTipi: 'BANKA_HAREKETI',
          kaynakId: hareket.id,
          ...(dto.hemenIsle === undefined ? {} : { hemenIsle: dto.hemenIsle }),
          satirlar: [
            {
              hesapId: bankaHesapId,
              ...(bankaBorclu ? { borc: tutar } : { alacak: tutar }),
              aciklama: hareket.aciklama,
            },
            {
              hesapId: dto.karsiHesapId,
              ...(bankaBorclu ? { alacak: tutar } : { borc: tutar }),
              aciklama: hareket.aciklama,
            },
          ],
        },
        principal,
        baglam,
      );

      await tx.bankaHareketi.update({
        where: { id },
        data: { yevmiyeFisiId: fis.id },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BankaHareketi', varlikId: id,
        oncekiDeger: { yevmiyeFisiId: null },
        sonrakiDeger: {
          yevmiyeFisiId: fis.id, fisNo: fis.fisNo,
          bankaHesapKodu: hareket.bankaHesabi.muhasebeHesabi.kod,
          karsiHesapId: dto.karsiHesapId,
          yon: hareket.yon, tutar,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'MUHASEBELESTI', fisId: fis.id, fisNo: fis.fisNo };
    });
  }
}
