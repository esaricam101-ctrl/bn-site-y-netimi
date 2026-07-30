/**
 * Muhasebe Fişi — komut tarafı (CQRS).
 *
 * ⚠️  FİŞ SİLİNMEZ. `borc` ve `yevmiye_fisi` FİNANSAL sınıftır (BFS v1 §5.1).
 *     Hatalı fiş TERS KAYIT (storno) ile düzeltilir: iki kayıt da defterde
 *     durur ve neyin neden düzeltildiği görünür. Silme, denetim izini yok
 *     ederdi.
 *
 * ⚠️  TASLAK ≠ İŞLENDİ. Taslak fiş deftere GİRMEZ ve mizanda görünmez
 *     (parametre `taslakMizanaGirer` bunu açar). İşlenmiş fiş bir daha
 *     değiştirilemez — düzeltme yalnızca storno ile.
 *
 * ⚠️  KAPALI DÖNEME FİŞ YAZILAMAZ (`fisTarihiniDogrula`). Kapanmış mali yılın
 *     kaydı değişirse yayımlanmış bilanço ile defter tutmaz.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { money, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { fisiDogrula, fisTarihiniDogrula, type FisSatiri } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { NumaraServisi } from '../../common/numbering/numara.service';
import {
  mevcutBaglamiZorunluKil, type IstekBaglami,
} from '../../common/context/request-context';
import type { FisEkleDto, FisStornoDto } from './dto/muhasebe.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

@Injectable()
export class FisCommandServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly numara: NumaraServisi,
  ) {}

  /**
   * Fiş oluşturur. Varsayılan TASLAK; `hemenIsle` ile aynı işlemde işlenir.
   *
   * Doğrulama sırası ÖNEMLİ: önce dönem (kapalı mı, tarih aralıkta mı), sonra
   * çift kayıt denkliği. Ters sırada olsaydı kapalı döneme yazılan denk bir
   * fiş için "denk değil" yerine hiç hata almazdık.
   */
  async ekle(
    dto: FisEkleDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly fisNo: string }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.fisEkle');
    return this.prisma.tenantIslemi((tx) => this.ekleIslemde(tx, dto, principal, baglam));
  }

  /**
   * Fiş oluşturmanın GÖVDESİ — açık bir transaction içinde çalışır.
   *
   * NEDEN AYRI: banka hareketini muhasebeleştirme, hareketi işaretlemek ile
   * fişi yazmayı AYNI transaction'da yapmak zorundadır. İki ayrı işlem
   * olsaydı fiş yazılıp hareket işaretlenmeden hata alınabilir; hareket
   * "muhasebeleşmemiş" görünmeye devam eder ve bir daha muhasebeleştirilerek
   * AYNI PARA İKİ KEZ deftere girerdi.
   *
   * Bu yüzden `BankaHareketCommandServisi` fiş üretimini KOPYALAMAZ, buradan
   * çağırır (kural: kod tekrarı yok).
   */
  async ekleIslemde(
    tx: Prisma.TransactionClient,
    dto: FisEkleDto,
    principal: Principal,
    baglam: IstekBaglami,
  ): Promise<KomutSonucu & { readonly fisNo: string }> {
    const id = randomUUID();
    const tarih = takvimTarihi(dto.tarih);

    {
      // --- Dönem ---
      const donem = await tx.muhasebeDonemi.findFirst({
        where: {
          tenantId: principal.tenantId,
          baslangic: { lte: new Date(tarih) },
          bitis: { gte: new Date(tarih) },
        },
        select: { id: true, baslangic: true, bitis: true, durum: true },
      });
      if (!donem) {
        throw new IsKuraliIhlali(
          `${tarih} tarihini kapsayan bir muhasebe dönemi yok.`,
          'Önce dönem açın: fişin hangi mali yıla ait olduğu belirsiz kalamaz.',
        );
      }

      const parametre = await tx.muhasebeParametresi.findFirst({
        where: { tenantId: principal.tenantId },
        select: { geriyeDonukGun: true },
      });

      fisTarihiniDogrula(
        tarih,
        {
          id: donem.id,
          baslangic: gun(donem.baslangic),
          bitis: gun(donem.bitis),
          durum: donem.durum,
        },
        bugun(),
        parametre?.geriyeDonukGun ?? 0,
      );

      // --- Hesaplar ---
      const hesapIdler = dto.satirlar.map((s) => s.hesapId);
      const hesaplar = await tx.hesap.findMany({
        where: {
          id: { in: hesapIdler }, tenantId: principal.tenantId,
          silinmeTarihi: null,
        },
        select: { id: true, kod: true, fisKesilebilirMi: true, aktif: true },
      });
      const hesapHaritasi = new Map(hesaplar.map((h) => [h.id, h]));

      for (const s of dto.satirlar) {
        const h = hesapHaritasi.get(s.hesapId);
        if (!h) throw new KayitBulunamadi(`Hesap bulunamadı: ${s.hesapId}`);
        if (!h.aktif) {
          throw new IsKuraliIhlali(
            `'${h.kod}' hesabı pasif; fiş kesilemez.`,
            'Hesabı aktifleştirin ya da başka hesap seçin.',
          );
        }
      }

      // --- Çift kayıt denkliği (domain) ---
      const domainSatirlari: FisSatiri[] = dto.satirlar.map((s) => ({
        hesapId: s.hesapId,
        fisKesilebilirMi: hesapHaritasi.get(s.hesapId)?.fisKesilebilirMi ?? false,
        borc: money(s.borc ?? '0'),
        alacak: money(s.alacak ?? '0'),
        ...(s.bolumId === undefined ? {} : { bolumId: s.bolumId }),
      }));

      fisiDogrula({ tarih, fisTuru: dto.fisTuru ?? 'MAHSUP', satirlar: domainSatirlari });

      // --- Fiş no: BOŞLUKSUZ seri (VUK: yevmiye numarası atlamaz) ---
      const fisNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'YEVMIYE',
        yil: donem.baslangic.getUTCFullYear(),
      });

      await tx.yevmiyeFisi.create({
        data: {
          id, tenantId: principal.tenantId, fisNo,
          tarih: new Date(tarih),
          aciklama: dto.aciklama.trim(),
          kaynakTipi: dto.kaynakTipi ?? 'MANUEL',
          kaynakId: dto.kaynakId ?? null,
          durum: dto.hemenIsle === true ? 'ISLENDI' : 'TASLAK',
          fisTuru: dto.fisTuru ?? 'MAHSUP',
          donemId: donem.id,
          ...(dto.hemenIsle === true
            ? { islenmeAni: new Date(), isleyenKisi: principal.id }
            : {}),
          satirlar: {
            create: dto.satirlar.map((s) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              hesapId: s.hesapId,
              borc: new Prisma.Decimal(s.borc ?? '0'),
              alacak: new Prisma.Decimal(s.alacak ?? '0'),
              aciklama: s.aciklama?.trim() ?? null,
              bolumId: s.bolumId ?? null,
            })),
          },
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'YevmiyeFisi', varlikId: id,
        sonrakiDeger: {
          fisNo, tarih, fisTuru: dto.fisTuru ?? 'MAHSUP',
          durum: dto.hemenIsle === true ? 'ISLENDI' : 'TASLAK',
          satirSayisi: dto.satirlar.length,
          donemId: donem.id,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: dto.hemenIsle === true ? 'ISLENDI' : 'TASLAK', fisNo };
    }
  }

  /**
   * Taslak fişi işler — deftere alır.
   *
   * İşlenmiş fiş bir daha değiştirilemez. Bu geçiş TEK YÖNLÜDÜR: "işlemeyi
   * geri al" diye bir işlem yoktur, çünkü fiş deftere girdiği anda mizanı ve
   * mali tabloyu etkilemiş olur.
   */
  async isle(id: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.fisIsle');

    return this.prisma.tenantIslemi(async (tx) => {
      const fis = await tx.yevmiyeFisi.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: {
          id: true, fisNo: true, durum: true, tarih: true,
          donem: { select: { durum: true, baslangic: true, bitis: true } },
        },
      });
      if (!fis) throw new KayitBulunamadi(`Fiş bulunamadı: ${id}`);
      if (fis.durum !== 'TASLAK') {
        throw new IsKuraliIhlali(
          `Fiş ${fis.durum} durumunda; yalnızca TASLAK fiş işlenebilir.`,
          fis.durum === 'ISLENDI'
            ? 'Düzeltme için ters kayıt (storno) oluşturun.'
            : 'Ters kayıtlı fiş yeniden işlenemez.',
        );
      }
      if (fis.donem !== null && fis.donem.durum === 'KAPALI') {
        throw new IsKuraliIhlali(
          'Fişin dönemi KAPALI; işlenemez.',
          'Kapanmış bir mali yılın defteri değişemez.',
        );
      }

      await tx.yevmiyeFisi.update({
        where: { id },
        data: { durum: 'ISLENDI', islenmeAni: new Date(), isleyenKisi: principal.id },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'YevmiyeFisi', varlikId: id,
        oncekiDeger: { durum: 'TASLAK' },
        sonrakiDeger: { durum: 'ISLENDI', fisNo: fis.fisNo },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ISLENDI' };
    });
  }

  /**
   * TERS KAYIT (storno) — hatalı fişin düzeltme yolu.
   *
   * Yeni bir fiş üretilir: orijinalin borç/alacak yönleri TERS ÇEVRİLİR.
   * Negatif tutar YAZILMAZ — muhasebede düzeltme, eksi tutarla değil karşı
   * yöne kayıtla yapılır; eksi tutar mizan toplamlarını bozar.
   *
   * Orijinal fiş SİLİNMEZ, durumu `TERS_KAYITLI` olur ve iki kayıt birbirine
   * referans verir. Denetimde "bu kayıt neden düzeltildi" sorusunun cevabı
   * gerekçe alanındadır.
   */
  async storno(
    id: string, dto: FisStornoDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly tersFisId: string; readonly tersFisNo: string }> {
    const baglam = mevcutBaglamiZorunluKil('muhasebe.fisStorno');
    const tersId = randomUUID();
    const tarih = dto.tarih === undefined ? bugun() : takvimTarihi(dto.tarih);

    return this.prisma.tenantIslemi(async (tx) => {
      const fis = await tx.yevmiyeFisi.findFirst({
        where: { id, tenantId: principal.tenantId },
        include: { satirlar: true },
      });
      if (!fis) throw new KayitBulunamadi(`Fiş bulunamadı: ${id}`);
      if (fis.durum === 'TERS_KAYITLI') {
        throw new IsKuraliIhlali(
          'Bu fiş için zaten ters kayıt oluşturulmuş.',
          'İşlem tekrarlanmaz.',
        );
      }
      if (fis.durum === 'TASLAK') {
        throw new IsKuraliIhlali(
          'Taslak fiş için ters kayıt oluşturulmaz.',
          'Taslak deftere girmemiştir; satırlarını düzeltin ya da fişi ' +
            'işlemeden bırakın.',
        );
      }

      // Ters kayıt, ORİJİNALİN dönemine değil VERİLEN TARİHİN dönemine yazılır:
      // orijinalin dönemi kapanmış olabilir ve düzeltme açık dönemde yapılır.
      const donem = await tx.muhasebeDonemi.findFirst({
        where: {
          tenantId: principal.tenantId,
          baslangic: { lte: new Date(tarih) },
          bitis: { gte: new Date(tarih) },
        },
        select: { id: true, baslangic: true, bitis: true, durum: true },
      });
      if (!donem) {
        throw new IsKuraliIhlali(
          `${tarih} tarihini kapsayan bir muhasebe dönemi yok.`,
          'Ters kayıt için açık bir dönem gerekir.',
        );
      }
      fisTarihiniDogrula(
        tarih,
        {
          id: donem.id, baslangic: gun(donem.baslangic),
          bitis: gun(donem.bitis), durum: donem.durum,
        },
        bugun(),
      );

      const tersFisNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'YEVMIYE',
        yil: donem.baslangic.getUTCFullYear(),
      });

      await tx.yevmiyeFisi.create({
        data: {
          id: tersId, tenantId: principal.tenantId, fisNo: tersFisNo,
          tarih: new Date(tarih),
          aciklama: `TERS KAYIT (${fis.fisNo}): ${dto.gerekce.trim()}`,
          kaynakTipi: 'STORNO',
          kaynakId: fis.id,
          durum: 'ISLENDI',
          fisTuru: fis.fisTuru,
          donemId: donem.id,
          islenmeAni: new Date(),
          isleyenKisi: principal.id,
          satirlar: {
            // YÖN TERS ÇEVRİLİR, tutar negatife çevrilmez.
            create: fis.satirlar.map((s) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              hesapId: s.hesapId,
              borc: s.alacak,
              alacak: s.borc,
              aciklama: s.aciklama,
              bolumId: s.bolumId,
            })),
          },
        },
      });

      await tx.yevmiyeFisi.update({
        where: { id },
        data: { durum: 'TERS_KAYITLI', tersKaydiOlanId: tersId },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'YevmiyeFisi', varlikId: id,
        oncekiDeger: { durum: fis.durum },
        sonrakiDeger: {
          durum: 'TERS_KAYITLI', tersFisId: tersId, tersFisNo,
          tersKayitTarihi: tarih,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'TERS_KAYITLI', tersFisId: tersId, tersFisNo };
    });
  }
}
