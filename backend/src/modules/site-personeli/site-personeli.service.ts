/**
 * Site Personeli servisi — İŞVERENİ YÖNETİM OLAN kadro.
 *
 * Site müdürü · yönetici · güvenlik · temizlik · teknik · bahçıvan · vale ·
 * resepsiyon · havuz görevlisi. Ücreti işletme projesinden ödenir, SGK'sı
 * yönetim tarafından yapılır, vardiyası yönetim planlar, zimmeti yönetimin
 * malıdır.
 *
 * ⚠️  DAİRE GÖREVLİSİ İLE KARIŞTIRILMAMALIDIR (`../daire-gorevlisi`). Daire
 *     görevlisinin (bakıcı · ev yardımcısı · şoför) işvereni malik ya da
 *     kiracıdır; SGK · departman · vardiya · zimmet alanları orada YOKTUR,
 *     çünkü bu yükümlülükler yönetimin değildir.
 *
 * `Kisi` TABLOSUNDAN AYRIDIR ve bu bilinçlidir:
 *   - `Kisi`, malik/kiracı/sakin ilişkilerinin dayandığı KİMLİK kaydıdır.
 *   - Personel bir İSTİHDAM kaydıdır; kendi yaşam döngüsü vardır (işe giriş ·
 *     vardiya · SGK · çıkış · zimmet).
 * Aynı tabloya sıkıştırılsaydı, bir kapıcının aynı zamanda o binada kiracı
 * olması durumunda iki kavram tek satıra biner ve "işten ayrıldı" işareti
 * kiracılık kaydını da etkilerdi.
 *
 * KAYIT SİLİNMEZ, KAPANIR. İşten ayrılan personelin kaydı `istenAyrilisTarihi`
 * ile kapatılır: geçmiş bordro, zimmet ve sertifika sorguları o kayda dayanır.
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
  PersonelAyrilDto, PersonelDuzeltDto, PersonelEkleDto,
  SertifikaEkleDto, ZimmetEkleDto, ZimmetIadeDto,
} from './dto/site-personeli.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface SertifikaSatiri {
  readonly id: string;
  readonly ad: string;
  readonly kurum: string | null;
  readonly belgeNo: string | null;
  readonly verilisTarihi: string;
  readonly gecerlilikBitisi: string | null;
  /** Bugün itibarıyla süresi dolmuş mu — idari yaptırım riski. */
  readonly suresiDolduMu: boolean;
}

export interface ZimmetSatiri {
  readonly id: string;
  readonly ad: string;
  readonly seriNo: string | null;
  readonly adet: number;
  readonly zimmetTarihi: string;
  readonly iadeTarihi: string | null;
  readonly acikMi: boolean;
  readonly notlar: string | null;
}

export interface PersonelSatiri {
  readonly id: string;
  readonly apartmanId: string | null;
  readonly apartmanAdi: string | null;
  readonly ad: string;
  readonly soyad: string;
  readonly adSoyad: string;
  readonly gorev: string;
  readonly departman: string | null;
  readonly telefon: string | null;
  readonly eposta: string | null;
  readonly tcKimlikNo: string | null;
  readonly sgkNo: string | null;
  readonly iseGirisTarihi: string;
  readonly istenAyrilisTarihi: string | null;
  readonly vardiya: string;
  readonly durum: string;
  readonly notlar: string | null;
  readonly sertifikalar: readonly SertifikaSatiri[];
  readonly zimmetler: readonly ZimmetSatiri[];
  /** Üzerinde iade edilmemiş zimmet sayısı — ayrılışta uyarı üretir. */
  readonly acikZimmetSayisi: number;
  /** Süresi dolmuş sertifika sayısı. */
  readonly suresiDolanSertifikaSayisi: number;
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

@Injectable()
export class SitePersoneliServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  // ---------------------------------------------------------------- okuma

  async listele(
    principal: Principal,
    suzgec: {
      readonly gorev?: string; readonly durum?: string;
      readonly apartmanId?: string; readonly arama?: string;
    } = {},
  ): Promise<readonly PersonelSatiri[]> {
    const aramaMetni = suzgec.arama?.trim();

    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.sitePersoneli.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.gorev ? { gorev: suzgec.gorev as never } : {}),
            ...(suzgec.durum ? { durum: suzgec.durum as never } : {}),
            ...(suzgec.apartmanId ? { apartmanId: suzgec.apartmanId } : {}),
            ...(aramaMetni
              ? {
                  OR: [
                    { ad: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { soyad: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { departman: { contains: aramaMetni, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          include: {
            apartman: { select: { ad: true } },
            sertifikalar: { orderBy: { verilisTarihi: 'desc' } },
            zimmetler: { orderBy: [{ iadeTarihi: 'asc' }, { zimmetTarihi: 'desc' }] },
          },
          orderBy: [{ durum: 'asc' }, { soyad: 'asc' }, { ad: 'asc' }],
        }),
      principal.tenantId,
    );

    const simdi = bugun();
    return kayitlar.map((c) => {
      const sertifikalar = c.sertifikalar.map((s) => {
        const bitis = s.gecerlilikBitisi === null ? null : gun(s.gecerlilikBitisi);
        return {
          id: s.id,
          ad: s.ad,
          kurum: s.kurum,
          belgeNo: s.belgeNo,
          verilisTarihi: gun(s.verilisTarihi),
          gecerlilikBitisi: bitis,
          suresiDolduMu: bitis !== null && bitis < simdi,
        };
      });
      const zimmetler = c.zimmetler.map((z) => ({
        id: z.id,
        ad: z.ad,
        seriNo: z.seriNo,
        adet: z.adet,
        zimmetTarihi: gun(z.zimmetTarihi),
        iadeTarihi: z.iadeTarihi === null ? null : gun(z.iadeTarihi),
        acikMi: z.iadeTarihi === null,
        notlar: z.notlar,
      }));

      return {
        id: c.id,
        apartmanId: c.apartmanId,
        apartmanAdi: c.apartman?.ad ?? null,
        ad: c.ad,
        soyad: c.soyad,
        adSoyad: `${c.ad} ${c.soyad}`,
        gorev: c.gorev,
        departman: c.departman,
        telefon: c.telefon,
        eposta: c.eposta,
        tcKimlikNo: c.tcKimlikNo,
        sgkNo: c.sgkNo,
        iseGirisTarihi: gun(c.iseGirisTarihi),
        istenAyrilisTarihi: c.istenAyrilisTarihi === null ? null : gun(c.istenAyrilisTarihi),
        vardiya: c.vardiya,
        durum: c.durum,
        notlar: c.notlar,
        sertifikalar,
        zimmetler,
        acikZimmetSayisi: zimmetler.filter((z) => z.acikMi).length,
        suresiDolanSertifikaSayisi: sertifikalar.filter((s) => s.suresiDolduMu).length,
      };
    });
  }

  async detay(id: string, principal: Principal): Promise<PersonelSatiri> {
    const hepsi = await this.listele(principal);
    const kayit = hepsi.find((c) => c.id === id);
    if (kayit === undefined) throw new KayitBulunamadi(`Personel bulunamadı: ${id}`);
    return kayit;
  }

  /**
   * Süresi dolmuş sertifikası olan AKTİF personel.
   *
   * Süresi geçmiş güvenlik sertifikasıyla çalıştırmak idari yaptırım
   * sebebidir; bu ancak takip edilirse görülür.
   */
  async sertifikasiDolanlar(principal: Principal): Promise<readonly PersonelSatiri[]> {
    const hepsi = await this.listele(principal, { durum: 'AKTIF' });
    return hepsi.filter((c) => c.suresiDolanSertifikaSayisi > 0);
  }

  // ---------------------------------------------------------------- yazma

  async ekle(
    dto: PersonelEkleDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly plakaSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.ekle');
    const id = randomUUID();
    const giris = takvimTarihi(dto.iseGirisTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      if (dto.apartmanId !== undefined) {
        const apartman = await tx.apartman.findFirst({
          where: { id: dto.apartmanId, tenantId: principal.tenantId },
          select: { id: true },
        });
        if (!apartman) throw new KayitBulunamadi(`Apartman bulunamadı: ${dto.apartmanId}`);
      }

      // Aynı TC ile AKTİF ikinci kayıt bordroyu ikiye katlar. Ayrılmış kayıt
      // engellemez: aynı kişi tekrar işe alınabilir.
      if (dto.tcKimlikNo !== undefined) {
        const mevcut = await tx.sitePersoneli.findFirst({
          where: {
            tenantId: principal.tenantId,
            tcKimlikNo: dto.tcKimlikNo,
            istenAyrilisTarihi: null,
          },
          select: { id: true, ad: true, soyad: true },
        });
        if (mevcut) {
          throw new IsKuraliIhlali(
            `Bu TC kimlik numarasıyla aktif bir personel kaydı var: ` +
              `${mevcut.ad} ${mevcut.soyad}.`,
            'Önce mevcut kaydı kapatın ya da bilgileri düzeltin.',
          );
        }
      }

      await tx.sitePersoneli.create({
        data: {
          id, tenantId: principal.tenantId,
          apartmanId: dto.apartmanId ?? null,
          ad: dto.ad.trim(), soyad: dto.soyad.trim(),
          gorev: dto.gorev,
          departman: dto.departman?.trim() ?? null,
          telefon: dto.telefon?.trim() ?? null,
          eposta: dto.eposta?.trim().toLowerCase() ?? null,
          tcKimlikNo: dto.tcKimlikNo ?? null,
          sgkNo: dto.sgkNo?.trim() ?? null,
          iseGirisTarihi: new Date(giris),
          vardiya: dto.vardiya ?? 'GUNDUZ',
          durum: 'AKTIF',
          notlar: dto.notlar?.trim() ?? null,
        },
      });

      // Personel aracı YÖNETİME kayıtlanır (`bolumId: null`): bir daireye
      // yazmak o dairenin otopark hakkını tüketmiş gösterir ve kullanım
      // bazlı dağıtımda ona fazla pay çıkarır (`arac_kapsam` kısıtı).
      const plakalar = await plakalariYaz(tx, principal.tenantId, {
        bolumId: null,
        sahip: { personelId: id },
        baslangic: giris,
        plakalar: dto.plakalar ?? [],
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'SitePersoneli', varlikId: id,
        // KVKK: TC kimlik no denetim gövdesine YAZILMAZ. Audit kaydı
        // değiştirilemezdir; oraya giren kişisel veri bir daha silinemez.
        sonrakiDeger: {
          ad: dto.ad, soyad: dto.soyad, gorev: dto.gorev,
          departman: dto.departman ?? null, iseGirisTarihi: giris,
          plakaSayisi: plakalar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF', plakaSayisi: plakalar.length };
    });
  }

  async duzelt(
    id: string, dto: PersonelDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sitePersoneli.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Personel bulunamadı: ${id}`);

      if (dto.apartmanId !== undefined) {
        const apartman = await tx.apartman.findFirst({
          where: { id: dto.apartmanId, tenantId: principal.tenantId },
          select: { id: true },
        });
        if (!apartman) throw new KayitBulunamadi(`Apartman bulunamadı: ${dto.apartmanId}`);
      }

      await tx.sitePersoneli.update({
        where: { id },
        data: {
          ...(dto.apartmanId === undefined ? {} : { apartmanId: dto.apartmanId }),
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.soyad === undefined ? {} : { soyad: dto.soyad.trim() }),
          ...(dto.gorev === undefined ? {} : { gorev: dto.gorev }),
          ...(dto.departman === undefined ? {} : { departman: dto.departman.trim() }),
          ...(dto.telefon === undefined ? {} : { telefon: dto.telefon.trim() }),
          ...(dto.eposta === undefined ? {} : { eposta: dto.eposta.trim().toLowerCase() }),
          ...(dto.sgkNo === undefined ? {} : { sgkNo: dto.sgkNo.trim() }),
          ...(dto.vardiya === undefined ? {} : { vardiya: dto.vardiya }),
          ...(dto.notlar === undefined ? {} : { notlar: dto.notlar.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'SitePersoneli', varlikId: id,
        oncekiDeger: {
          ad: kayit.ad, soyad: kayit.soyad, gorev: kayit.gorev,
          departman: kayit.departman, vardiya: kayit.vardiya,
        },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad, soyad: dto.soyad ?? kayit.soyad,
          gorev: dto.gorev ?? kayit.gorev,
          departman: dto.departman ?? kayit.departman,
          vardiya: dto.vardiya ?? kayit.vardiya,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * İşten ayrılış — kayıt KAPANIR, silinmez.
   *
   * Durum aynı işlemde PASIF'e çekilir: veritabanı kısıtı
   * (`daire_gorevlisi_durum_tutarlilik`) ayrılmış personelin AKTİF kalmasını
   * reddeder. Ayrı bırakılsaydı "aktif personel" listesi işten ayrılmış
   * kişileri gösterir ve vardiya planlaması yanlış yapılırdı.
   *
   * AÇIK ZİMMET ENGELLEMEZ, UYARIR: telsiz teslim edilmeden ayrılan bir
   * personelin kaydı kapatılabilmelidir, ama zimmet açık kaldığı görünür
   * olmalıdır. Engellemek, kaydı hiç kapatmamaya ve listenin bozulmasına
   * yol açardı.
   */
  async ayril(
    id: string, dto: PersonelAyrilDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly acikZimmetSayisi: number }> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.ayril');
    const ayrilis = takvimTarihi(dto.istenAyrilisTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sitePersoneli.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Personel bulunamadı: ${id}`);

      if (kayit.istenAyrilisTarihi !== null) {
        throw new IsKuraliIhlali(
          `${kayit.ad} ${kayit.soyad} ${gun(kayit.istenAyrilisTarihi)} tarihinde ` +
            'zaten işten ayrılmış.',
          'Yeniden işe alım için yeni kayıt açın.',
        );
      }
      if (ayrilis < gun(kayit.iseGirisTarihi)) {
        throw new IsKuraliIhlali(
          `Ayrılış (${ayrilis}) işe giriş tarihinden (${gun(kayit.iseGirisTarihi)}) önce olamaz.`,
          'Tarihi düzeltin.',
        );
      }

      const acikZimmet = await tx.personelZimmeti.count({
        where: { tenantId: principal.tenantId, personelId: id, iadeTarihi: null },
      });

      await tx.sitePersoneli.update({
        where: { id },
        data: { istenAyrilisTarihi: new Date(ayrilis), durum: 'PASIF' },
      });

      // Personelin açık araç kayıtları da aynı tarihte kapanır: işten ayrılmış
      // personelin aracı personel otoparkında yer kaplamaya devam ederse
      // kapasite yanlış görünür.
      await tx.arac.updateMany({
        where: { tenantId: principal.tenantId, personelId: id, bitis: null },
        data: { bitis: new Date(ayrilis) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'SitePersoneli', varlikId: id,
        oncekiDeger: { durum: kayit.durum, istenAyrilisTarihi: null },
        sonrakiDeger: {
          durum: 'PASIF', istenAyrilisTarihi: ayrilis, acikZimmetSayisi: acikZimmet,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AYRILDI', acikZimmetSayisi: acikZimmet };
    });
  }

  async softSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sitePersoneli.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, ad: true, soyad: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Personel bulunamadı: ${id}`);

      silmeyiDogrula(
        { varlik: 'SitePersoneli', sinif: 'ANA_VERI', engelleyenBagimliliklar: [] },
        gerekce,
      );

      await tx.sitePersoneli.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'SitePersoneli', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SILINDI' };
    });
  }

  // ----------------------------------------------------- sertifika · zimmet

  async sertifikaEkle(
    personelId: string, dto: SertifikaEkleDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.sertifika');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const calisan = await tx.sitePersoneli.findFirst({
        where: { id: personelId, tenantId: principal.tenantId }, select: { id: true },
      });
      if (!calisan) throw new KayitBulunamadi(`Personel bulunamadı: ${personelId}`);

      await tx.personelSertifikasi.create({
        data: {
          id, tenantId: principal.tenantId, personelId,
          ad: dto.ad.trim(),
          kurum: dto.kurum?.trim() ?? null,
          belgeNo: dto.belgeNo?.trim() ?? null,
          verilisTarihi: new Date(takvimTarihi(dto.verilisTarihi)),
          gecerlilikBitisi:
            dto.gecerlilikBitisi === undefined
              ? null
              : new Date(takvimTarihi(dto.gecerlilikBitisi)),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'PersonelSertifikasi', varlikId: id,
        sonrakiDeger: { personelId, ad: dto.ad, gecerlilikBitisi: dto.gecerlilikBitisi ?? null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async zimmetEkle(
    personelId: string, dto: ZimmetEkleDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.zimmet');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const calisan = await tx.sitePersoneli.findFirst({
        where: { id: personelId, tenantId: principal.tenantId },
        select: { id: true, istenAyrilisTarihi: true },
      });
      if (!calisan) throw new KayitBulunamadi(`Personel bulunamadı: ${personelId}`);
      if (calisan.istenAyrilisTarihi !== null) {
        throw new IsKuraliIhlali(
          'İşten ayrılmış personele yeni zimmet verilemez.',
          'Personel yeniden işe alındıysa yeni kayıt açın.',
        );
      }

      await tx.personelZimmeti.create({
        data: {
          id, tenantId: principal.tenantId, personelId,
          ad: dto.ad.trim(),
          seriNo: dto.seriNo?.trim() ?? null,
          adet: dto.adet ?? 1,
          zimmetTarihi: new Date(takvimTarihi(dto.zimmetTarihi)),
          notlar: dto.notlar?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'PersonelZimmeti', varlikId: id,
        sonrakiDeger: { personelId, ad: dto.ad, adet: dto.adet ?? 1 },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** Zimmet İADE ile kapanır, silinmez — teslim geçmişi kanıttır. */
  async zimmetIade(
    zimmetId: string, dto: ZimmetIadeDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('site-personeli.zimmetIade');
    const iade = takvimTarihi(dto.iadeTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.personelZimmeti.findFirst({
        where: { id: zimmetId, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Zimmet kaydı bulunamadı: ${zimmetId}`);
      if (kayit.iadeTarihi !== null) {
        throw new IsKuraliIhlali(
          `'${kayit.ad}' ${gun(kayit.iadeTarihi)} tarihinde zaten iade edilmiş.`,
          'İşlem tekrarlanmaz.',
        );
      }
      if (iade < gun(kayit.zimmetTarihi)) {
        throw new IsKuraliIhlali(
          `İade (${iade}) zimmet tarihinden (${gun(kayit.zimmetTarihi)}) önce olamaz.`,
          'Tarihi düzeltin.',
        );
      }

      await tx.personelZimmeti.update({
        where: { id: zimmetId },
        data: {
          iadeTarihi: new Date(iade),
          ...(dto.notlar === undefined ? {} : { notlar: dto.notlar.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'PersonelZimmeti', varlikId: zimmetId,
        oncekiDeger: { iadeTarihi: null }, sonrakiDeger: { iadeTarihi: iade },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: zimmetId, durum: 'IADE_EDILDI' };
    });
  }
}
