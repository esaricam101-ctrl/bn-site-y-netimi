/**
 * Dönem Sonu Kapanış İşlemleri.
 *
 * Kapsananlar:
 *   · Yeni Dönem Açılışı        (`ac`)
 *   · Muhasebe Açılış İşlemleri (`acilisFisiUret` — önceki dönemin devri)
 *   · Yansıtma Hesapları        (`yansitmaFisiUret`)
 *   · Yevmiye Yeniden Numaralandırma (`yevmiyeYenidenNumarala`)
 *   · Muhasebe Kapanış / Mali Yıl Kapanışı (`kapat`)
 *
 * ⚠️  KAPANIŞ GERİ ALINAMAZ. Kapanış fişi yazılır, dönem KAPALI olur ve bir
 *     daha fiş kabul etmez. Bu yüzden bütün önkoşullar kapanıştan ÖNCE
 *     denetlenir (`donemKapanisiniDogrula`); sonradan "aslında taslak fiş
 *     vardı" demek mümkün değildir.
 *
 * ⚠️  Bütün fişler `hemenIsle` eşdeğeriyle ISLENDI yazılır: kapanış fişinin
 *     taslak kalması, dönemi kapalı ama defteri eksik bırakırdı.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { donemKapanisiniDogrula, donemSonucu } from '@bnos/apartman-domain';
import { moneyKurustan } from '@bnos/kernel';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { NumaraServisi } from '../../common/numbering/numara.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { DonemAcDto, DonemKapatDto } from './dto/muhasebe.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

/**
 * Decimal'i `Money`'ye çevirir (ölçek 4 · ADR-0007).
 *
 * `Number`'a çevirip çarpmak float yuvarlaması yapardı; dizgi üzerinden
 * BigInt'e geçilir.
 */
function decimalToMoney(d: Prisma.Decimal): ReturnType<typeof moneyKurustan> {
  const [tam, ondalik = ''] = d.toFixed(4).replace('-', '').split('.');
  const kurus = BigInt(`${tam ?? '0'}${ondalik.padEnd(4, '0')}`);
  return moneyKurustan(d.isNegative() ? -kurus : kurus);
}

export interface DonemSatiri {
  readonly id: string;
  readonly maliYil: number;
  readonly ad: string;
  readonly baslangic: string;
  readonly bitis: string;
  readonly durum: string;
  readonly acilisFisiId: string | null;
  readonly kapanisFisiId: string | null;
  readonly kapanisAni: string | null;
  readonly kapanisGerekcesi: string | null;
  readonly fisSayisi: number;
  readonly taslakFisSayisi: number;
  /** Deftere basılmamış fiş sayısı — yeniden numaralandırma gereksinimi. */
  readonly numarasizFisSayisi: number;
}

@Injectable()
export class DonemServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly numara: NumaraServisi,
  ) {}

  async listele(principal: Principal): Promise<readonly DonemSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.muhasebeDonemi.findMany({
          where: { tenantId: principal.tenantId },
          include: { fisler: { select: { durum: true, yevmiyeSiraNo: true } } },
          orderBy: { maliYil: 'desc' },
        }),
      principal.tenantId,
    );

    return kayitlar.map((d) => ({
      id: d.id,
      maliYil: d.maliYil,
      ad: d.ad,
      baslangic: gun(d.baslangic),
      bitis: gun(d.bitis),
      durum: d.durum,
      acilisFisiId: d.acilisFisiId,
      kapanisFisiId: d.kapanisFisiId,
      kapanisAni: d.kapanisAni === null ? null : d.kapanisAni.toISOString(),
      kapanisGerekcesi: d.kapanisGerekcesi,
      fisSayisi: d.fisler.length,
      taslakFisSayisi: d.fisler.filter((f) => f.durum === 'TASLAK').length,
      numarasizFisSayisi: d.fisler.filter((f) => f.yevmiyeSiraNo === null).length,
    }));
  }

  /** YENİ DÖNEM AÇILIŞI. Aynı mali yıl iki kez açılamaz. */
  async ac(dto: DonemAcDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.donemAc');
    const id = randomUUID();
    const baslangic = takvimTarihi(dto.baslangic);
    const bitis = takvimTarihi(dto.bitis);

    if (bitis <= baslangic) {
      throw new IsKuraliIhlali(
        `Dönem bitişi (${bitis}) başlangıçtan (${baslangic}) sonra olmalıdır.`,
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const mevcut = await tx.muhasebeDonemi.findFirst({
        where: { tenantId: principal.tenantId, maliYil: dto.maliYil },
        select: { ad: true, durum: true },
      });
      if (mevcut) {
        throw new IsKuraliIhlali(
          `${dto.maliYil} mali yılı zaten açık: ${mevcut.ad} (${mevcut.durum}).`,
          'İşlem tekrarlanmaz.',
        );
      }

      // ÇAKIŞAN TARİH ARALIĞI REDDEDİLİR: iki dönem aynı günü kapsarsa fiş
      // hangi döneme yazılacağı belirsiz kalır ve mizan iki kez sayar.
      const cakisan = await tx.muhasebeDonemi.findFirst({
        where: {
          tenantId: principal.tenantId,
          baslangic: { lte: new Date(bitis) },
          bitis: { gte: new Date(baslangic) },
        },
        select: { ad: true, baslangic: true, bitis: true },
      });
      if (cakisan) {
        throw new IsKuraliIhlali(
          `Tarih aralığı '${cakisan.ad}' dönemiyle çakışıyor ` +
            `(${gun(cakisan.baslangic)} – ${gun(cakisan.bitis)}).`,
          'İki dönem aynı günü kapsarsa fişin hangi döneme ait olduğu ' +
            'belirsiz kalır ve mizan iki kez sayar.',
        );
      }

      await tx.muhasebeDonemi.create({
        data: {
          id, tenantId: principal.tenantId,
          maliYil: dto.maliYil,
          ad: dto.ad.trim(),
          baslangic: new Date(baslangic),
          bitis: new Date(bitis),
          durum: 'ACIK',
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'MuhasebeDonemi', varlikId: id,
        sonrakiDeger: { maliYil: dto.maliYil, ad: dto.ad, baslangic, bitis },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ACIK' };
    });
  }

  /**
   * YEVMİYE YENİDEN NUMARALANDIRMA.
   *
   * Yevmiye defteri TARİH SIRASIYLA tutulur (VUK md. 183). Fişler giriş
   * sırasına göre `fisNo` alır ama tarih sırası farklı olabilir; deftere
   * basılırken sıra yeniden verilir.
   *
   * ⚠️  `fisNo` DEĞİŞTİRİLMEZ. Makbuz ve dekont üzerinde o numara yazılıdır;
   *     değiştirilse belge ile defter tutmaz. Yalnızca `yevmiyeSiraNo` yazılır.
   *
   * ⚠️  KAPALI DÖNEMDE ÇALIŞMAZ: kapanmış defterin sırası değişemez.
   */
  async yevmiyeYenidenNumarala(
    donemId: string, principal: Principal,
  ): Promise<KomutSonucu & { readonly numaralananFisSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.yevmiyeNumarala');

    return this.prisma.tenantIslemi(async (tx) => {
      const donem = await tx.muhasebeDonemi.findFirst({
        where: { id: donemId, tenantId: principal.tenantId },
        select: { id: true, durum: true, maliYil: true },
      });
      if (!donem) throw new KayitBulunamadi(`Dönem bulunamadı: ${donemId}`);
      if (donem.durum === 'KAPALI') {
        throw new IsKuraliIhlali(
          'Kapalı dönemde yevmiye yeniden numaralandırılamaz.',
          'Kapanmış defterin sırası değişemez.',
        );
      }

      const parametre = await tx.muhasebeParametresi.findFirst({
        where: { tenantId: principal.tenantId },
        select: { yevmiyeBaslangicNo: true },
      });
      const baslangicNo = parametre?.yevmiyeBaslangicNo ?? 1;

      // TASLAK fiş numaralanmaz: deftere girmemiştir.
      const fisler = await tx.yevmiyeFisi.findMany({
        where: {
          tenantId: principal.tenantId, donemId,
          durum: { in: ['ISLENDI', 'TERS_KAYITLI'] },
        },
        select: { id: true },
        orderBy: [{ tarih: 'asc' }, { olusturulmaTarihi: 'asc' }, { fisNo: 'asc' }],
      });

      // İki aşamalı yazım: unique index (tenant, donem, sira) yüzünden
      // doğrudan yeniden atama çakışabilir. Önce tümü boşaltılır, sonra
      // sırayla yazılır. Tek transaction içindedir; ara durum dışarıdan
      // görünmez.
      await tx.yevmiyeFisi.updateMany({
        where: { tenantId: principal.tenantId, donemId },
        data: { yevmiyeSiraNo: null },
      });

      let sira = baslangicNo;
      for (const f of fisler) {
        await tx.yevmiyeFisi.update({
          where: { id: f.id },
          data: { yevmiyeSiraNo: sira },
        });
        sira += 1;
      }

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'MuhasebeDonemi', varlikId: donemId,
        sonrakiDeger: {
          islem: 'YEVMIYE_YENIDEN_NUMARALANDIRMA',
          maliYil: donem.maliYil,
          baslangicNo,
          numaralananFisSayisi: fisler.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: donemId, durum: 'NUMARALANDI', numaralananFisSayisi: fisler.length };
    });
  }

  /**
   * MALİ YIL KAPANIŞI — kapanış fişi üretir ve dönemi KAPALI yapar.
   *
   * Kapanış fişi gelir ve gider hesaplarını SIFIRLAR: bakiyeleri ters yönde
   * yazılır, net sonuç dönem kârı/zararı hesabına aktarılır. Bilanço
   * hesapları (varlık · borç · özkaynak) DEVREDER, sıfırlanmaz — onların
   * bakiyesi yeni dönemin açılışıdır.
   *
   * ⚠️  GERİ ALINAMAZ. Önkoşullar (`donemKapanisiniDogrula`) kapanıştan önce
   *     denetlenir: taslak fiş kalmışsa kapanış eksik hesaplanırdı.
   */
  async kapat(
    donemId: string, dto: DonemKapatDto, principal: Principal,
  ): Promise<KomutSonucu & {
    readonly kapanisFisiId: string;
    readonly sonuc: string;
    readonly tutar: string;
  }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.donemKapat');
    const kapanisFisiId = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const donem = await tx.muhasebeDonemi.findFirst({
        where: { id: donemId, tenantId: principal.tenantId },
        select: {
          id: true, maliYil: true, baslangic: true, bitis: true, durum: true,
        },
      });
      if (!donem) throw new KayitBulunamadi(`Dönem bulunamadı: ${donemId}`);

      const taslakSayisi = await tx.yevmiyeFisi.count({
        where: { tenantId: principal.tenantId, donemId, durum: 'TASLAK' },
      });

      const parametre = await tx.muhasebeParametresi.findFirst({
        where: { tenantId: principal.tenantId },
        select: { donemKariHesapId: true },
      });

      // Gelir ve gider hesaplarının dönem bakiyeleri.
      const gelirGider = await tx.yevmiyeSatiri.groupBy({
        by: ['hesapId'],
        where: {
          tenantId: principal.tenantId,
          hesap: { tip: { in: ['GELIR', 'GIDER'] }, silinmeTarihi: null },
          fis: {
            donemId,
            durum: { in: ['ISLENDI', 'TERS_KAYITLI'] },
          },
        },
        _sum: { borc: true, alacak: true },
      });

      const hesapIdler = gelirGider.map((g) => g.hesapId);
      const hesaplar = hesapIdler.length === 0
        ? []
        : await tx.hesap.findMany({
            where: { id: { in: hesapIdler } },
            select: { id: true, tip: true, kod: true },
          });
      const tipHaritasi = new Map(hesaplar.map((h) => [h.id, h.tip]));

      let gelirBakiye = new Prisma.Decimal(0);
      let giderBakiye = new Prisma.Decimal(0);
      const kapanisSatirlari: {
        hesapId: string; borc: Prisma.Decimal; alacak: Prisma.Decimal;
      }[] = [];

      for (const g of gelirGider) {
        const borc = g._sum.borc ?? new Prisma.Decimal(0);
        const alacak = g._sum.alacak ?? new Prisma.Decimal(0);
        const tip = tipHaritasi.get(g.hesapId);
        if (tip === 'GELIR') {
          // Gelir alacak bakiyeli çalışır; kapanışta BORÇ yazılarak sıfırlanır.
          const net = alacak.sub(borc);
          if (net.isZero()) continue;
          gelirBakiye = gelirBakiye.add(net);
          kapanisSatirlari.push(
            net.isPositive()
              ? { hesapId: g.hesapId, borc: net, alacak: new Prisma.Decimal(0) }
              : { hesapId: g.hesapId, borc: new Prisma.Decimal(0), alacak: net.abs() },
          );
        } else if (tip === 'GIDER') {
          // Gider borç bakiyeli çalışır; kapanışta ALACAK yazılarak sıfırlanır.
          const net = borc.sub(alacak);
          if (net.isZero()) continue;
          giderBakiye = giderBakiye.add(net);
          kapanisSatirlari.push(
            net.isPositive()
              ? { hesapId: g.hesapId, borc: new Prisma.Decimal(0), alacak: net }
              : { hesapId: g.hesapId, borc: net.abs(), alacak: new Prisma.Decimal(0) },
          );
        }
      }

      donemKapanisiniDogrula({
        donem: {
          id: donem.id, baslangic: gun(donem.baslangic),
          bitis: gun(donem.bitis), durum: donem.durum,
        },
        taslakFisSayisi: taslakSayisi,
        gelirBakiye: decimalToMoney(gelirBakiye),
        giderBakiye: decimalToMoney(giderBakiye),
        donemKariHesabiVarMi: parametre?.donemKariHesapId != null,
        gerekce: dto.gerekce,
      });

      const sonuc = donemSonucu(
        decimalToMoney(gelirBakiye), decimalToMoney(giderBakiye),
      );

      // Kâr/zarar özkaynak hesabına aktarılır: kâr ALACAK, zarar BORÇ.
      const kariHesapId = parametre?.donemKariHesapId;
      const netTutar = gelirBakiye.sub(giderBakiye).abs();
      if (kariHesapId != null && !netTutar.isZero()) {
        kapanisSatirlari.push(
          sonuc.sonuc === 'KAR'
            ? { hesapId: kariHesapId, borc: new Prisma.Decimal(0), alacak: netTutar }
            : { hesapId: kariHesapId, borc: netTutar, alacak: new Prisma.Decimal(0) },
        );
      }

      // Hiç gelir/gider hareketi yoksa kapanış fişi de olmaz; ama dönem
      // KAPALI olmak zorundadır ve kısıt `kapanis_fisi_id` ister. Bu yüzden
      // BOŞ DEĞİL, denk bir "hareketsiz kapanış" fişi yazılır: kapanışın
      // yapıldığı defterde görünmelidir.
      if (kapanisSatirlari.length === 0) {
        throw new IsKuraliIhlali(
          'Dönemde kapatılacak gelir/gider hareketi yok.',
          'Hareketsiz bir dönem için kapanış fişi üretilemez; dönemi açık ' +
            'bırakın ya da önce kayıt girin.',
        );
      }

      const fisNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'YEVMIYE',
        yil: donem.maliYil,
      });

      await tx.yevmiyeFisi.create({
        data: {
          id: kapanisFisiId, tenantId: principal.tenantId, fisNo,
          // Kapanış fişi dönemin SON GÜNÜNE yazılır: bir gün sonrası yeni
          // döneme düşer ve kapanış yanlış yıla girer.
          tarih: donem.bitis,
          aciklama: `${donem.maliYil} mali yılı kapanış fişi — ${dto.gerekce.trim()}`,
          kaynakTipi: 'DONEM_KAPANIS',
          kaynakId: donem.id,
          durum: 'ISLENDI',
          fisTuru: 'KAPANIS',
          donemId: donem.id,
          islenmeAni: new Date(),
          isleyenKisi: principal.id,
          satirlar: {
            create: kapanisSatirlari.map((s) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              hesapId: s.hesapId,
              borc: s.borc,
              alacak: s.alacak,
              aciklama: 'Dönem kapanışı',
            })),
          },
        },
      });

      await tx.muhasebeDonemi.update({
        where: { id: donemId },
        data: {
          durum: 'KAPALI',
          kapanisFisiId,
          kapanisAni: new Date(),
          kapatanKullanici: principal.id,
          kapanisGerekcesi: dto.gerekce.trim(),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'MuhasebeDonemi', varlikId: donemId,
        oncekiDeger: { durum: donem.durum },
        sonrakiDeger: {
          durum: 'KAPALI', kapanisFisiId, fisNo,
          sonuc: sonuc.sonuc,
          tutar: netTutar.toFixed(2),
          satirSayisi: kapanisSatirlari.length,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id: donemId, durum: 'KAPALI', kapanisFisiId,
        sonuc: sonuc.sonuc, tutar: netTutar.toFixed(2),
      };
    });
  }

  /**
   * MUHASEBE AÇILIŞ İŞLEMLERİ — önceki dönemin bilanço bakiyelerini devreder.
   *
   * Yalnızca BİLANÇO hesapları devreder (varlık · borç · özkaynak). Gelir ve
   * gider hesapları kapanışta sıfırlandığı için devretmez; devretseydi
   * geçmiş yılın kârı yeni yılın gelir tablosunda ikinci kez görünürdü.
   */
  async acilisFisiUret(
    donemId: string, principal: Principal,
  ): Promise<KomutSonucu & { readonly acilisFisiId: string; readonly satirSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.acilisFisi');
    const acilisFisiId = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const donem = await tx.muhasebeDonemi.findFirst({
        where: { id: donemId, tenantId: principal.tenantId },
        select: {
          id: true, maliYil: true, baslangic: true, durum: true, acilisFisiId: true,
        },
      });
      if (!donem) throw new KayitBulunamadi(`Dönem bulunamadı: ${donemId}`);
      if (donem.durum === 'KAPALI') {
        throw new IsKuraliIhlali('Kapalı döneme açılış fişi yazılamaz.');
      }
      if (donem.acilisFisiId !== null) {
        throw new IsKuraliIhlali(
          'Bu dönemin açılış fişi zaten üretilmiş.',
          'İşlem tekrarlanmaz; iki açılış fişi bakiyeleri iki kez devrederdi.',
        );
      }

      const onceki = await tx.muhasebeDonemi.findFirst({
        where: { tenantId: principal.tenantId, maliYil: donem.maliYil - 1 },
        select: { id: true, durum: true, maliYil: true },
      });
      if (!onceki) {
        throw new IsKuraliIhlali(
          `${donem.maliYil - 1} mali yılı bulunamadı; devredilecek bakiye yok.`,
          'İlk dönemde açılış fişi elle girilir.',
        );
      }
      if (onceki.durum !== 'KAPALI') {
        throw new IsKuraliIhlali(
          `${onceki.maliYil} dönemi henüz kapatılmadı.`,
          'Devir, kapanmış bir dönemin kesinleşmiş bakiyelerinden alınır; ' +
            'açık dönemin bakiyesi hâlâ değişebilir.',
        );
      }

      // BİLANÇO hesapları: gelir/gider HARİÇ.
      const gruplar = await tx.yevmiyeSatiri.groupBy({
        by: ['hesapId'],
        where: {
          tenantId: principal.tenantId,
          hesap: { tip: { in: ['VARLIK', 'BORC', 'OZKAYNAK'] }, silinmeTarihi: null },
          fis: { donemId: onceki.id, durum: { in: ['ISLENDI', 'TERS_KAYITLI'] } },
        },
        _sum: { borc: true, alacak: true },
      });

      const satirlar: { hesapId: string; borc: Prisma.Decimal; alacak: Prisma.Decimal }[] = [];
      for (const g of gruplar) {
        const borc = g._sum.borc ?? new Prisma.Decimal(0);
        const alacak = g._sum.alacak ?? new Prisma.Decimal(0);
        const net = borc.sub(alacak);
        if (net.isZero()) continue;
        satirlar.push(
          net.isPositive()
            ? { hesapId: g.hesapId, borc: net, alacak: new Prisma.Decimal(0) }
            : { hesapId: g.hesapId, borc: new Prisma.Decimal(0), alacak: net.abs() },
        );
      }

      if (satirlar.length === 0) {
        throw new IsKuraliIhlali(
          `${onceki.maliYil} döneminde devredilecek bilanço bakiyesi yok.`,
        );
      }

      const fisNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'YEVMIYE',
        yil: donem.maliYil,
      });

      await tx.yevmiyeFisi.create({
        data: {
          id: acilisFisiId, tenantId: principal.tenantId, fisNo,
          // Açılış dönemin İLK GÜNÜNE yazılır.
          tarih: donem.baslangic,
          aciklama: `${donem.maliYil} mali yılı açılış fişi (${onceki.maliYil} devri)`,
          kaynakTipi: 'DONEM_ACILIS',
          kaynakId: donem.id,
          durum: 'ISLENDI',
          fisTuru: 'ACILIS',
          donemId: donem.id,
          islenmeAni: new Date(),
          isleyenKisi: principal.id,
          satirlar: {
            create: satirlar.map((s) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              hesapId: s.hesapId,
              borc: s.borc,
              alacak: s.alacak,
              aciklama: `${onceki.maliYil} devri`,
            })),
          },
        },
      });

      await tx.muhasebeDonemi.update({
        where: { id: donemId },
        data: { acilisFisiId },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'YevmiyeFisi', varlikId: acilisFisiId,
        sonrakiDeger: {
          islem: 'DONEM_ACILIS', fisNo, donemId,
          oncekiDonem: onceki.maliYil, satirSayisi: satirlar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: donemId, durum: 'ACILIS_URETILDI', acilisFisiId, satirSayisi: satirlar.length };
    });
  }

  /**
   * YANSITMA HESAPLARI — 7/A ve 7/B maliyet yansıtma fişi.
   *
   * Özelliği YANSITMA olan hesapların bakiyeleri karşı yöne yazılarak
   * sıfırlanır. Tekdüzen planda gider hesapları (7xx) dönem sonunda yansıtma
   * hesaplarıyla kapatılır; yansıtma yapılmazsa gelir tablosu ile maliyet
   * hesapları çift sayar.
   *
   * ⚠️  Hangi hesabın yansıtma olduğu KODA GÖMÜLMEZ, `hesap.ozellik`
   *     alanından okunur: kod planı tenant'a göre değişir.
   */
  async yansitmaFisiUret(
    donemId: string, principal: Principal,
  ): Promise<KomutSonucu & { readonly fisId: string; readonly satirSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.yansitmaFisi');
    const fisId = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const donem = await tx.muhasebeDonemi.findFirst({
        where: { id: donemId, tenantId: principal.tenantId },
        select: { id: true, maliYil: true, bitis: true, durum: true },
      });
      if (!donem) throw new KayitBulunamadi(`Dönem bulunamadı: ${donemId}`);
      if (donem.durum === 'KAPALI') {
        throw new IsKuraliIhlali('Kapalı döneme yansıtma fişi yazılamaz.');
      }

      const gruplar = await tx.yevmiyeSatiri.groupBy({
        by: ['hesapId'],
        where: {
          tenantId: principal.tenantId,
          hesap: { ozellik: 'YANSITMA', silinmeTarihi: null },
          fis: { donemId, durum: { in: ['ISLENDI', 'TERS_KAYITLI'] } },
        },
        _sum: { borc: true, alacak: true },
      });

      const satirlar: { hesapId: string; borc: Prisma.Decimal; alacak: Prisma.Decimal }[] = [];
      for (const g of gruplar) {
        const borc = g._sum.borc ?? new Prisma.Decimal(0);
        const alacak = g._sum.alacak ?? new Prisma.Decimal(0);
        const net = borc.sub(alacak);
        if (net.isZero()) continue;
        // Karşı yöne yazılarak sıfırlanır.
        satirlar.push(
          net.isPositive()
            ? { hesapId: g.hesapId, borc: new Prisma.Decimal(0), alacak: net }
            : { hesapId: g.hesapId, borc: net.abs(), alacak: new Prisma.Decimal(0) },
        );
      }

      if (satirlar.length === 0) {
        throw new IsKuraliIhlali(
          'Yansıtılacak hesap hareketi yok.',
          'Hesap planında özelliği YANSITMA olan hesap tanımlı mı?',
        );
      }
      // Yansıtma fişi TEK BAŞINA DENK OLMAZ: karşı hesap (630/631 gibi)
      // kullanıcının seçtiği hesaptır ve otomatik tahmin edilemez. Bu yüzden
      // denkleştirme satırı ZORUNLU olarak istenir.
      if (satirlar.length < 2) {
        throw new IsKuraliIhlali(
          'Yansıtma fişi tek satırla denk olmaz; karşı hesap gerekir.',
          'Hesap planında en az iki yansıtma hesabı tanımlayın ya da fişi elle ' +
            'girin: karşı hesap otomatik tahmin edilemez.',
        );
      }

      const borcT = satirlar.reduce((t, s) => t.add(s.borc), new Prisma.Decimal(0));
      const alacakT = satirlar.reduce((t, s) => t.add(s.alacak), new Prisma.Decimal(0));
      if (!borcT.equals(alacakT)) {
        throw new IsKuraliIhlali(
          `Yansıtma fişi denk değil (borç ${borcT.toFixed(2)}, alacak ` +
            `${alacakT.toFixed(2)}).`,
          'Yansıtma hesaplarının bakiyeleri birbirini kapatmıyor; fişi elle girin.',
        );
      }

      const fisNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'YEVMIYE',
        yil: donem.maliYil,
      });

      await tx.yevmiyeFisi.create({
        data: {
          id: fisId, tenantId: principal.tenantId, fisNo,
          tarih: donem.bitis,
          aciklama: `${donem.maliYil} yansıtma fişi`,
          kaynakTipi: 'YANSITMA',
          kaynakId: donem.id,
          durum: 'ISLENDI',
          fisTuru: 'YANSITMA',
          donemId: donem.id,
          islenmeAni: new Date(),
          isleyenKisi: principal.id,
          satirlar: {
            create: satirlar.map((s) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              hesapId: s.hesapId,
              borc: s.borc,
              alacak: s.alacak,
              aciklama: 'Yansıtma',
            })),
          },
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'YevmiyeFisi', varlikId: fisId,
        sonrakiDeger: {
          islem: 'YANSITMA', fisNo, donemId, satirSayisi: satirlar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: donemId, durum: 'YANSITILDI', fisId, satirSayisi: satirlar.length };
    });
  }
}
