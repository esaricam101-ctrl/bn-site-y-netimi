/**
 * Kiracı Command servisi — kira sözleşmesi (ADR v1.1 §5).
 *
 * Kiracı, SAKİN ile aynı şey değildir: şirket kiracı olup hiç oturmayabilir,
 * kiracının ailesi oturur. Fiilen oturanlar `Sakin` tablosundadır.
 *
 * KAYIT SİLİNMEZ. Tahliyede sözleşme kapanır; geçmiş kiracı tarihçede kalır —
 * "Şubat borcu neden eski kiracıda?" sorusunun cevabı budur.
 *
 * TEKİLLİK: Bir bölümde aynı anda EN FAZLA BİR kiracı bulunur. İki geçerli
 * kira ilişkisi olursa kullanana ait gider yanlış kişiye yazılır ve hata
 * sessizdir; kural `iliskiyiDogrula` ile yazma anında zorlanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal, type TenantId,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { iliskiyiDogrula, type BolumIliskisi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { TenantOkuyucu } from '../../common/prisma/tenant.reader';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import {
  kisiyiCoz, plakalariYaz, type HizliKayitSonucu,
} from '../../common/kayit/hizli-kayit';
import {
  dayanakSakinleriniCikar, type OtomatikCikisSonucu,
} from '../../common/kayit/sakin-otomatik-cikis';
import type { KiraciDuzeltDto, KiraciEkleDto, KiraciTahliyeDto } from './dto/kiraci.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/**
 * Tahliye sonucu — kaç sakinin otomatik çıkarıldığını TAŞIR.
 *
 * ⚠️  Sayı yanıta konmasaydı kullanıcı dört kişiyi de sessizce listeden
 *     düşürmüş olurdu; ekranda hiçbir iz kalmazdı.
 */
export interface TahliyeSonucu extends KomutSonucu {
  readonly sakinCikisi: OtomatikCikisSonucu;
}

@Injectable()
export class KiraciCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
    /*
     * KAPSAM ONBELLEGI GECERSIZLESTIRME (ADR-0011).
     *
     * Bu servis ILISKI DONEMINI degistirir; kapsam listesi o donemden
     * turetilir. Onbellek silinmezse tahliye edilmis kiraci ya da
     * devretmis malik dairesini TTL suresince (5 dk) gormeye devam eder.
     */
    private readonly okuyucu: TenantOkuyucu,
  ) {}

  async ekle(
    bolumId: string, dto: KiraciEkleDto, principal: Principal,
  ): Promise<HizliKayitSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kiraci.ekle');
    const id = randomUUID();

    const baslangic = takvimTarihi(dto.baslangic);
    const bitis = dto.bitis === undefined ? null : takvimTarihi(dto.bitis);

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      // Kişi ya seçilir ya bu bilgilerden oluşturulur. `kisiyiCoz` tenant
      // aidiyetini de doğrular — FK kontrolü RLS'i baypas eder.
      const cozum = await kisiyiCoz(tx, principal.tenantId, {
        ...(dto.kisi ?? {}),
        ...(dto.kisiId === undefined ? {} : { kisiId: dto.kisiId }),
      });
      const kisiId = cozum.kisiId;

      // Cakisma kontrolu domain'e aittir; kiraci tekilligi orada tanimli.
      const mevcutKayitlar = await tx.kiraci.findMany({
        where: { tenantId: principal.tenantId, bolumId },
        select: { kisiId: true, baslangic: true, bitis: true },
      });

      const mevcut: BolumIliskisi[] = mevcutKayitlar.map((k) => ({
        kisiId: k.kisiId,
        rol: 'KIRACI' as const,
        baslangic: takvimTarihiniOku(k.baslangic),
        bitis: takvimTarihiniOkuVeyaNull(k.bitis),
      }));

      iliskiyiDogrula(mevcut, { kisiId, rol: 'KIRACI', baslangic, bitis });

      await tx.kiraci.create({
        data: {
          id, tenantId: principal.tenantId, bolumId, kisiId,
          baslangic: takvimTarihiniYaz(baslangic),
          bitis: bitis === null ? null : takvimTarihiniYaz(bitis),
          sozlesmeNo: dto.sozlesmeNo ?? null,
          sozlesmeTarihi:
            dto.sozlesmeTarihi === undefined
              ? null
              : takvimTarihiniYaz(takvimTarihi(dto.sozlesmeTarihi)),
          depozito: dto.depozito ?? null,
          // Kefil `Kisi` DEĞİLDİR: yönetimin alacağı malike ve kiracıya
          // yönelir (KMK md. 20 · md. 22), kefile yönelmez. Ayrı kimlik
          // kaydı açılsaydı borç sorumluluğu sorgularında görünürdü.
          kefilAdSoyad: dto.kefil?.adSoyad.trim() ?? null,
          kefilTcKimlikNo: dto.kefil?.tcKimlikNo ?? null,
          kefilTelefon: dto.kefil?.telefon?.trim() ?? null,
          kefilAdres: dto.kefil?.adres?.trim() ?? null,
        },
      });

      // Plakalar AYNI İŞLEMDE yazılır: hata verirse kiracı kaydı da geri alınır.
      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId,
        sahip: { kisiId },
        baslangic,
        bitis,
        plakalar: dto.kisi?.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Kiraci', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId,
          kisiOlusturulduMu: cozum.olusturulduMu,
          baslangic, bitis, sozlesmeNo: dto.sozlesmeNo ?? null,
          depozito: dto.depozito ?? null,
          // KVKK: kefilin TC'si denetim gövdesine YAZILMAZ; audit kaydı
          // değiştirilemezdir, oraya giren kişisel veri bir daha silinemez.
          kefilVarMi: dto.kefil !== undefined,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.kiraci.eklendi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kiraci', id, version: 1 },
        payload: { bolumId, kisiId, baslangic },
      });

      // Yeni ilişki kapsamı GENİŞLETİR; önbellek eski dar listeyi tutmamalı.
      await this.kapsamiTazele(principal.tenantId, kisiId);
      return {
        id,
        durum: 'AKTIF',
        kisiId,
        kisiOlusturulduMu: cozum.olusturulduMu,
        tcIleEslestiMi: cozum.tcIleEslestiMi,
        plakaSayisi: plakalar.length,
      };
    });
  }

  /**
   * Sözleşme bilgisi düzeltme / uzatma.
   *
   * KİŞİ ve BAŞLANGIÇ tarihi değiştirilemez — ikisi de sözleşmenin kimliğidir.
   * Yanlış kişiye açılmış bir sözleşme düzeltilmez; tahliye edilip doğru
   * kişiyle yenisi açılır.
   *
   * `bitis` uzatılırsa sonraki kira sözleşmeleriyle çakışma kontrol edilir —
   * aksi halde iki geçerli kiracı oluşur ve kullanana ait gider yanlış kişiye
   * yazılır.
   */
  async duzelt(
    bolumId: string,
    kiraciId: string,
    dto: KiraciDuzeltDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kiraci.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.kiraci.findFirst({
        where: { id: kiraciId, bolumId, tenantId: principal.tenantId },
        select: {
          id: true, kisiId: true, baslangic: true, bitis: true,
          sozlesmeNo: true, sozlesmeTarihi: true, depozito: true, tahliyeTarihi: true,
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Kiracı kaydı bulunamadı: ${kiraciId}`);

      const baslangic = takvimTarihiniOku(kayit.baslangic);
      const yeniBitis = dto.bitis === undefined ? undefined : takvimTarihi(dto.bitis);

      if (yeniBitis !== undefined) {
        if (kayit.tahliyeTarihi !== null) {
          throw new IsKuraliIhlali(
            'Tahliye edilmiş bir sözleşmenin bitiş tarihi değiştirilemez.',
            'Yeni bir kira sözleşmesi oluşturun.',
          );
        }
        if (yeniBitis < baslangic) {
          throw new IsKuraliIhlali(
            `Sözleşme bitişi (${yeniBitis}) başlangıçtan (${baslangic}) önce olamaz.`,
          );
        }

        // Uzatma sonraki sozlesmelerle cakisabilir; kendi kaydi disarida birakilir.
        const digerleri = await tx.kiraci.findMany({
          where: { tenantId: principal.tenantId, bolumId, id: { not: kiraciId } },
          select: { kisiId: true, baslangic: true, bitis: true },
        });
        const mevcut: BolumIliskisi[] = digerleri.map((k) => ({
          kisiId: k.kisiId, rol: 'KIRACI' as const,
          baslangic: takvimTarihiniOku(k.baslangic),
          bitis: takvimTarihiniOkuVeyaNull(k.bitis),
        }));
        iliskiyiDogrula(mevcut, {
          kisiId: kayit.kisiId, rol: 'KIRACI', baslangic, bitis: yeniBitis,
        });
      }

      await tx.kiraci.update({
        where: { id: kiraciId },
        data: {
          ...(dto.sozlesmeNo === undefined ? {} : { sozlesmeNo: dto.sozlesmeNo }),
          ...(dto.sozlesmeTarihi === undefined
            ? {}
            : { sozlesmeTarihi: takvimTarihiniYaz(takvimTarihi(dto.sozlesmeTarihi)) }),
          ...(dto.depozito === undefined ? {} : { depozito: dto.depozito }),
          ...(yeniBitis === undefined ? {} : { bitis: takvimTarihiniYaz(yeniBitis) }),
          // Kefil bilgisi TÜMÜYLE değişir: yarım güncelleme, eski kefilin
          // telefonunu yeni kefilin adının yanında bırakır.
          ...(dto.kefil === undefined
            ? {}
            : {
                kefilAdSoyad: dto.kefil.adSoyad.trim(),
                kefilTcKimlikNo: dto.kefil.tcKimlikNo ?? null,
                kefilTelefon: dto.kefil.telefon?.trim() ?? null,
                kefilAdres: dto.kefil.adres?.trim() ?? null,
              }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Kiraci', varlikId: kiraciId,
        oncekiDeger: {
          sozlesmeNo: kayit.sozlesmeNo,
          depozito: kayit.depozito === null ? null : kayit.depozito.toFixed(4),
          bitis: takvimTarihiniOkuVeyaNull(kayit.bitis),
        },
        sonrakiDeger: {
          sozlesmeNo: dto.sozlesmeNo ?? kayit.sozlesmeNo,
          depozito: dto.depozito ?? (kayit.depozito === null ? null : kayit.depozito.toFixed(4)),
          bitis: yeniBitis ?? takvimTarihiniOkuVeyaNull(kayit.bitis),
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.kapsamiTazele(principal.tenantId, kayit.kisiId);
      return { id: kiraciId, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Tahliye — sözleşme kapanır, kayıt silinmez.
   *
   * ⚠️  KİRACIYA DAYANAN SAKİNLER DE OTOMATİK ÇIKARILIR. Kiracı taşındıysa
   *     eşi ve çocukları da taşınmıştır; kayıtları açık bırakılsaydı daire
   *     kartında "hâlen oturuyor" görünür, acil durum listesi ve doluluk
   *     raporu yanlış kalırdı (bkz. `dayanakSakinleriniCikar`).
   */
  async tahliyeEt(
    bolumId: string,
    kiraciId: string,
    dto: KiraciTahliyeDto,
    principal: Principal,
  ): Promise<TahliyeSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kiraci.tahliye');
    const tahliyeTarihi = takvimTarihi(dto.tahliyeTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.kiraci.findFirst({
        where: { id: kiraciId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, baslangic: true, bitis: true, tahliyeTarihi: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Kiracı kaydı bulunamadı: ${kiraciId}`);

      const baslangic = takvimTarihiniOku(kayit.baslangic);
      if (tahliyeTarihi < baslangic) {
        throw new IsKuraliIhlali(
          `Tahliye tarihi (${tahliyeTarihi}) sözleşme başlangıcından (${baslangic}) önce olamaz.`,
        );
      }
      if (kayit.tahliyeTarihi !== null) {
        throw new IsKuraliIhlali(
          `Bu kira sözleşmesi ${takvimTarihiniOku(kayit.tahliyeTarihi)} tarihinde zaten tahliye edilmiş.`,
          'Yeni bir kira sözleşmesi oluşturun.',
        );
      }

      // Tahliye sozlesmeyi de kapatir: bitis bos kalirsa iliski suresiz
      // gorunur ve yeni kiraci eklenemez.
      await tx.kiraci.update({
        where: { id: kiraciId },
        data: {
          tahliyeTarihi: takvimTarihiniYaz(tahliyeTarihi),
          tahliyeGerekcesi: dto.tahliyeGerekcesi,
          bitis: takvimTarihiniYaz(tahliyeTarihi),
          depozitoIadeTarihi:
            dto.depozitoIadeTarihi === undefined
              ? null
              : takvimTarihiniYaz(takvimTarihi(dto.depozitoIadeTarihi)),
        },
      });

      // Bu kiracıya dayanan sakinler AYNI İŞLEMDE çıkarılır: tahliye ile
      // sakinlerin çıkışı ya birlikte olur ya hiç olmaz.
      const sakinCikisi = await dayanakSakinleriniCikar(
        tx, this.audit, this.outbox, principal, baglam,
        { bolumId, kiraciId, cikisTarihi: tahliyeTarihi, sebep: 'kiracı tahliyesi' },
      );

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Kiraci', varlikId: kiraciId,
        oncekiDeger: { bitis: takvimTarihiniOkuVeyaNull(kayit.bitis), tahliyeTarihi: null },
        sonrakiDeger: {
          bitis: tahliyeTarihi, tahliyeTarihi,
          otomatikCikarilanSakin: sakinCikisi.cikarilan,
          cikarilamayanSakin: sakinCikisi.cikarilamayan.length,
        },
        gerekce: dto.tahliyeGerekcesi,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.kiraci.tahliye_edildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kiraci', id: kiraciId, version: 2 },
        payload: {
          bolumId, kisiId: kayit.kisiId, tahliyeTarihi,
          otomatikCikarilanSakin: sakinCikisi.cikarilan,
        },
      });

      await this.kapsamiTazele(principal.tenantId, kayit.kisiId);
      return { id: kiraciId, durum: 'TAHLIYE_EDILDI', sakinCikisi };
    });
  }

  /**
   * Kapsam önbelleğini tazeler — ilişki dönemi değiştiğinde ZORUNLU.
   *
   * ⚠️  TRANSACTION DIŞINDA çağrılır: silme başarısız olsa bile domain
   *     yazması geri alınmamalıdır. Silme kaçarsa TTL (5 dk) ağdır ve
   *     `OnbellekServisi.sil` bunu ERROR olarak loglar — sessiz kalmaz.
   */
  private async kapsamiTazele(tenantId: TenantId, kisiId: string): Promise<void> {
    await this.okuyucu.kapsamiGecersizKil(tenantId, kisiId);
  }

}
