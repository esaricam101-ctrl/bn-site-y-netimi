/**
 * Sakin Command servisi — fiilen oturan kişi.
 *
 * SAKİN, KİRACI DEĞİLDİR. Bir dairede:
 *   - malik oturabilir,
 *   - kiracı oturabilir,
 *   - malik oturmaz ama aile bireyleri oturabilir,
 *   - kiracı dışında başka sakinler bulunabilir.
 *
 * Bu yüzden bir bölümde AYNI ANDA BİRDEN ÇOK sakin geçerlidir; malik ve
 * kiracıdaki gibi bir tekillik kuralı YOKTUR. Tekillik zorlanırsa dört kişilik
 * bir ailenin yalnızca biri kaydedilebilirdi.
 *
 * Sakin kaydı borç sorumluluğu DOĞURMAZ — borç malike ya da kiracıya yazılır
 * (ADR v1.1 §5). Sakin listesi acil durum ve fiili yerleşim bilgisidir.
 *
 * KAYIT SİLİNMEZ; çıkışta dönem kapanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal, type TenantId,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { TenantOkuyucu } from '../../common/prisma/tenant.reader';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import {
  kisiyiCoz, plakalariYaz, type HizliKayitSonucu,
} from '../../common/kayit/hizli-kayit';
import type { SakinDuzeltDto, SakinEkleDto } from './dto/sakin.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/** Dayanak çözümünün sonucu. */
interface Dayanak {
  readonly malikId: string | null;
  readonly kiraciId: string | null;
  /** Denetim kaydı ve hata mesajları için okunabilir ad. */
  readonly aciklama: string;
}

/**
 * DAYANAK DOĞRULAMASI — sakin ya bir malike ya bir kiracıya bağlanır.
 *
 * ⚠️  TAM OLARAK BİRİ. İkisi birden verilirse hangisinin geçerli olduğu
 *     belirsizdir; hiçbiri verilmezse kayıt "havada" kalır ve kuralın kendisi
 *     anlamsızlaşır.
 *
 * ⚠️  DAYANAK AYNI BÖLÜMDE OLMAK ZORUNDA. Değilse A dairesinin sakini B
 *     dairesinin malikine bağlanır ve "bu hanede kimler oturuyor" listesi
 *     kalıcı olarak yanlış çıkar. Veritabanı bunu bileşik yabancı anahtarla da
 *     zorlar; burada AÇIK HATA mesajı verilmesi için ayrıca denetlenir —
 *     yoksa kullanıcı anlaşılmaz bir FK hatası görürdü.
 *
 * ⚠️  DAYANAK İLİŞKİSİ HÂLÂ SÜRMELİ. Tapusu devredilmiş malike ya da tahliye
 *     olmuş kiracıya yeni sakin bağlanamaz: o hane artık onun değildir.
 */
async function dayanagiCoz(
  tx: Parameters<Parameters<PrismaService['tenantIslemi']>[0]>[0],
  tenantId: string,
  bolumId: string,
  girdi: { readonly malikId?: string; readonly kiraciId?: string },
  bugun: string,
): Promise<Dayanak> {
  const verilen = [girdi.malikId, girdi.kiraciId].filter((x) => x !== undefined);
  if (verilen.length === 0) {
    throw new IsKuraliIhlali(
      'Sakin kaydı bir MALİK ya da KİRACI ile ilişkilendirilmelidir.',
      'Sakin ekleme ekranında önce dayanağı (malik ya da kiracı) seçin: ' +
        'bağ olmadan "bu kişi kimin yakını olarak oturuyor" sorusu ' +
        'yanıtsız kalır.',
    );
  }
  if (verilen.length > 1) {
    throw new IsKuraliIhlali(
      'Sakin hem malike hem kiracıya bağlanamaz; TAM OLARAK BİRİNİ seçin.',
      'İkisi birden verilirse hangisinin geçerli olduğu belirsiz kalır.',
    );
  }

  if (girdi.malikId !== undefined) {
    const malik = await tx.malik.findFirst({
      where: { id: girdi.malikId, tenantId, bolumId },
      select: {
        id: true, tapuBitis: true,
        kisi: { select: { ad: true, soyad: true } },
      },
    });
    if (!malik) {
      throw new IsKuraliIhlali(
        'Seçilen malik bu bağımsız bölüme ait değil.',
        'Dayanak, sakinin oturduğu dairenin maliki olmalıdır.',
      );
    }
    if (malik.tapuBitis !== null && takvimTarihiniOku(malik.tapuBitis) < bugun) {
      throw new IsKuraliIhlali(
        'Seçilen malikin tapu kaydı sona ermiş.',
        'Devredilmiş bir malike yeni sakin bağlanamaz; güncel maliki seçin.',
      );
    }
    return {
      malikId: malik.id, kiraciId: null,
      aciklama: `Malik ${malik.kisi.ad} ${malik.kisi.soyad}`,
    };
  }

  const kiraci = await tx.kiraci.findFirst({
    where: { id: girdi.kiraciId ?? '', tenantId, bolumId },
    select: { id: true, bitis: true, kisi: { select: { ad: true, soyad: true } } },
  });
  if (!kiraci) {
    throw new IsKuraliIhlali(
      'Seçilen kiracı bu bağımsız bölüme ait değil.',
      'Dayanak, sakinin oturduğu dairenin kiracısı olmalıdır.',
    );
  }
  if (kiraci.bitis !== null && takvimTarihiniOku(kiraci.bitis) < bugun) {
    throw new IsKuraliIhlali(
      'Seçilen kiracının sözleşmesi sona ermiş.',
      'Tahliye olmuş bir kiracıya yeni sakin bağlanamaz.',
    );
  }
  return {
    malikId: null, kiraciId: kiraci.id,
    aciklama: `Kiracı ${kiraci.kisi.ad} ${kiraci.kisi.soyad}`,
  };
}

/**
 * "Diğer" seçildiğinde serbest metin ZORUNLU; başka derecede BOŞALTILIR.
 *
 * ⚠️  Boşaltma önemlidir: "Diğer — Amcası" kaydı sonradan "Eşi"ne çevrilirse
 *     eski açıklama kalırsa ekranda "Eşi (Amcası)" gibi çelişkili bir bilgi
 *     görünürdü. Veritabanı da bunu CHECK ile zorlar.
 */
function yakinlikAciklamasiniCoz(
  derece: string, aciklama: string | undefined,
): string | null {
  if (derece !== 'DIGER') return null;
  const metin = aciklama?.trim() ?? '';
  if (metin.length < 2) {
    throw new IsKuraliIhlali(
      '"Diğer" seçildiğinde yakınlık derecesi yazılmalıdır.',
      'Örnek: Amcası · Halası · Dayısı · Teyzesi · Kuzeni · Yeğeni · ' +
        'Arkadaşı · Bakıcısı · Refakatçisi.',
    );
  }
  return metin;
}

@Injectable()
export class SakinCommandService {
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
    bolumId: string, dto: SakinEkleDto, principal: Principal,
  ): Promise<HizliKayitSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sakin.ekle');
    const id = randomUUID();

    const girisTarihi = takvimTarihi(dto.girisTarihi);
    const cikisTarihi = dto.cikisTarihi === undefined ? null : takvimTarihi(dto.cikisTarihi);

    if (cikisTarihi !== null && cikisTarihi < girisTarihi) {
      throw new IsKuraliIhlali(
        `Çıkış tarihi (${cikisTarihi}) giriş tarihinden (${girisTarihi}) önce olamaz.`,
      );
    }

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

      // Coklu sakin serbesttir; yalnizca AYNI kisinin ayni bolumde acik bir
      // kaydinin iki kez olusmasi engellenir — bu bir veri girisi hatasidir.
      const acikKayit = await tx.sakin.findFirst({
        where: {
          tenantId: principal.tenantId, bolumId, kisiId, cikisTarihi: null,
        },
        select: { id: true },
      });
      if (acikKayit) {
        throw new IsKuraliIhlali(
          `Bu kişi '${bolum.kapiNo}' bölümünde zaten açık bir sakin kaydına sahip.`,
          'Önce mevcut kaydın çıkışını verin.',
        );
      }

      // DAYANAK — zorunlu ve aynı bölümde olmak zorunda.
      const dayanak = await dayanagiCoz(
        tx, principal.tenantId, bolumId,
        {
          ...(dto.malikId === undefined ? {} : { malikId: dto.malikId }),
          ...(dto.kiraciId === undefined ? {} : { kiraciId: dto.kiraciId }),
        },
        takvimTarihi(new Date().toISOString().slice(0, 10)),
      );

      const derece = dto.yakinlikDerecesi ?? 'KENDISI';
      const yakinlikAciklamasi = yakinlikAciklamasiniCoz(derece, dto.yakinlikAciklamasi);

      await tx.sakin.create({
        data: {
          id, tenantId: principal.tenantId, bolumId, kisiId,
          malikId: dayanak.malikId,
          kiraciId: dayanak.kiraciId,
          yakinlikDerecesi: derece,
          yakinlikAciklamasi,
          girisTarihi: takvimTarihiniYaz(girisTarihi),
          cikisTarihi: cikisTarihi === null ? null : takvimTarihiniYaz(cikisTarihi),
          acilDurumKisiAdi: dto.acilDurumKisiAdi ?? null,
          acilDurumTelefon: dto.acilDurumTelefon ?? null,
        },
      });

      // Plakalar AYNI İŞLEMDE yazılır: hata verirse sakin kaydı da geri alınır.
      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId,
        sahip: { kisiId },
        baslangic: girisTarihi,
        bitis: cikisTarihi,
        plakalar: dto.kisi?.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Sakin', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId,
          kisiOlusturulduMu: cozum.olusturulduMu,
          malikId: dayanak.malikId, kiraciId: dayanak.kiraciId,
          dayanak: dayanak.aciklama,
          yakinlikDerecesi: derece,
          yakinlikAciklamasi,
          girisTarihi, cikisTarihi,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.sakin.eklendi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Sakin', id, version: 1 },
        payload: { bolumId, kisiId, girisTarihi },
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
   * Sakin bilgisi düzeltme. KİŞİ değiştirilemez — kaydın kimliğidir.
   *
   * Giriş tarihi düzeltilirse çıkış tarihiyle sırası yeniden denetlenir.
   */
  async duzelt(
    bolumId: string,
    sakinId: string,
    dto: SakinDuzeltDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sakin.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sakin.findFirst({
        where: { id: sakinId, bolumId, tenantId: principal.tenantId },
        select: {
          // `kisiId` KAPSAM GEÇERSİZLEŞTİRME için gerekir.
          id: true, kisiId: true, yakinlikDerecesi: true, yakinlikAciklamasi: true,
          malikId: true, kiraciId: true,
          girisTarihi: true, cikisTarihi: true,
          acilDurumKisiAdi: true, acilDurumTelefon: true,
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Sakin kaydı bulunamadı: ${sakinId}`);

      // DAYANAK DEĞİŞİKLİĞİ — verilmezse mevcut korunur. Kiracı değişip
      // ailesi aynı dairede kalıyorsa bağın yeni kiracıya taşınması gerekir.
      const dayanak = dto.malikId === undefined && dto.kiraciId === undefined
        ? null
        : await dayanagiCoz(
            tx, principal.tenantId, bolumId,
            {
              ...(dto.malikId === undefined ? {} : { malikId: dto.malikId }),
              ...(dto.kiraciId === undefined ? {} : { kiraciId: dto.kiraciId }),
            },
            takvimTarihi(new Date().toISOString().slice(0, 10)),
          );

      // Derece değişirse açıklama YENİDEN çözülür: "Diğer"den çıkıldığında
      // eski serbest metin kalırsa "Eşi (Amcası)" gibi çelişkili bir kayıt
      // oluşurdu.
      const yeniDerece = dto.yakinlikDerecesi ?? kayit.yakinlikDerecesi;
      const yeniAciklama = yakinlikAciklamasiniCoz(
        yeniDerece,
        dto.yakinlikAciklamasi ?? kayit.yakinlikAciklamasi ?? undefined,
      );

      const yeniGiris = dto.girisTarihi === undefined ? undefined : takvimTarihi(dto.girisTarihi);
      const mevcutCikis = takvimTarihiniOkuVeyaNull(kayit.cikisTarihi);

      if (yeniGiris !== undefined && mevcutCikis !== null && mevcutCikis < yeniGiris) {
        throw new IsKuraliIhlali(
          `Giriş tarihi (${yeniGiris}) mevcut çıkış tarihinden (${mevcutCikis}) sonra olamaz.`,
          'Önce çıkış tarihini düzeltin.',
        );
      }

      await tx.sakin.update({
        where: { id: sakinId },
        data: {
          yakinlikDerecesi: yeniDerece,
          yakinlikAciklamasi: yeniAciklama,
          ...(dayanak === null
            ? {}
            : { malikId: dayanak.malikId, kiraciId: dayanak.kiraciId }),
          ...(yeniGiris === undefined ? {} : { girisTarihi: takvimTarihiniYaz(yeniGiris) }),
          ...(dto.acilDurumKisiAdi === undefined ? {} : { acilDurumKisiAdi: dto.acilDurumKisiAdi }),
          ...(dto.acilDurumTelefon === undefined ? {} : { acilDurumTelefon: dto.acilDurumTelefon }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Sakin', varlikId: sakinId,
        oncekiDeger: {
          yakinlikDerecesi: kayit.yakinlikDerecesi,
          yakinlikAciklamasi: kayit.yakinlikAciklamasi,
          malikId: kayit.malikId, kiraciId: kayit.kiraciId,
          girisTarihi: takvimTarihiniOku(kayit.girisTarihi),
          acilDurumKisiAdi: kayit.acilDurumKisiAdi,
          acilDurumTelefon: kayit.acilDurumTelefon,
        },
        sonrakiDeger: {
          yakinlikDerecesi: yeniDerece,
          yakinlikAciklamasi: yeniAciklama,
          malikId: dayanak?.malikId ?? kayit.malikId,
          kiraciId: dayanak?.kiraciId ?? kayit.kiraciId,
          ...(dayanak === null ? {} : { dayanak: dayanak.aciklama }),
          girisTarihi: yeniGiris ?? takvimTarihiniOku(kayit.girisTarihi),
          acilDurumKisiAdi: dto.acilDurumKisiAdi ?? kayit.acilDurumKisiAdi,
          acilDurumTelefon: dto.acilDurumTelefon ?? kayit.acilDurumTelefon,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.kapsamiTazele(principal.tenantId, kayit.kisiId);
      return { id: sakinId, durum: 'GUNCELLENDI' };
    });
  }

  /** Çıkış — dönem kapanır, kayıt silinmez. */
  async cikisVer(
    bolumId: string,
    sakinId: string,
    cikisMetni: string,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sakin.cikis');
    const cikisTarihi = takvimTarihi(cikisMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sakin.findFirst({
        where: { id: sakinId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, girisTarihi: true, cikisTarihi: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Sakin kaydı bulunamadı: ${sakinId}`);

      const girisTarihi = takvimTarihiniOku(kayit.girisTarihi);
      if (cikisTarihi < girisTarihi) {
        throw new IsKuraliIhlali(
          `Çıkış tarihi (${cikisTarihi}) giriş tarihinden (${girisTarihi}) önce olamaz.`,
        );
      }

      const oncekiCikis = takvimTarihiniOkuVeyaNull(kayit.cikisTarihi);

      await tx.sakin.update({
        where: { id: sakinId },
        data: { cikisTarihi: takvimTarihiniYaz(cikisTarihi) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Sakin', varlikId: sakinId,
        oncekiDeger: { cikisTarihi: oncekiCikis }, sonrakiDeger: { cikisTarihi },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.sakin.cikti', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Sakin', id: sakinId, version: 2 },
        payload: { bolumId, kisiId: kayit.kisiId, cikisTarihi },
      });

      await this.kapsamiTazele(principal.tenantId, kayit.kisiId);
      return { id: sakinId, durum: 'CIKIS_VERILDI' };
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
