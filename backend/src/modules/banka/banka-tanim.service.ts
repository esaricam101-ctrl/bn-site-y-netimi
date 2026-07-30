/**
 * Banka tanım verisi — banka · şube · banka hesabı · POS.
 *
 * Dördü tek serviste toplandı çünkü hepsi AYNI ŞEYİ yapar: ana veri sınıfı
 * (BFS v1 §5) kaydı ekler, düzeltir, arşivler. Dört ayrı servis yazılsaydı
 * soft-delete/audit/gerekçe iskeleti dört kez tekrar ederdi.
 *
 * ⚠️  BANKA HESABI MUHASEBE HESABINA BAĞLANMAK ZORUNDADIR ve bağlanan hesabın
 *     `ozellik` alanı BANKA olmalıdır. Bağ olmasaydı banka bakiyesi ile 102
 *     Bankalar hesabının bakiyesi birbirinden bağımsız iki sayı olur ve
 *     mutabakat yapılamazdı. Özellik denetimi de gerekli: 'ozellik = KASA'
 *     bir hesaba banka hesabı bağlanırsa Kasa Defteri banka hareketlerini
 *     gösterir ve iki defter de yanlış çıkar.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { ibaniDogrula, ibandanBankaKodu } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type {
  BankaDuzeltDto, BankaEkleDto, BankaHesabiDuzeltDto, BankaHesabiEkleDto,
  PosDuzeltDto, PosEkleDto, SubeDuzeltDto, SubeEkleDto,
} from './dto/banka.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface BankaSatiri {
  readonly id: string;
  readonly ad: string;
  readonly eftKodu: string | null;
  readonly swift: string | null;
  readonly subeSayisi: number;
  readonly hesapSayisi: number;
}

export interface SubeSatiri {
  readonly id: string;
  readonly bankaId: string;
  readonly bankaAdi: string;
  readonly ad: string;
  readonly subeKodu: string | null;
  readonly telefon: string | null;
  readonly hesapSayisi: number;
}

export interface BankaHesabiSatiri {
  readonly id: string;
  readonly ad: string;
  readonly bankaId: string;
  readonly bankaAdi: string;
  readonly subeAdi: string | null;
  readonly iban: string | null;
  readonly hesapNo: string | null;
  readonly paraBirimi: string;
  readonly aktif: boolean;
  readonly muhasebeHesapId: string;
  readonly muhasebeHesapKodu: string;
  readonly muhasebeHesapAdi: string;
  readonly acilisBakiyesi: string;
  readonly acilisTarihi: string | null;
  readonly hareketSayisi: number;
}

export interface PosSatiri {
  readonly id: string;
  readonly ad: string;
  readonly tip: string;
  readonly bankaHesabiId: string;
  readonly bankaHesabiAdi: string;
  readonly terminalNo: string | null;
  readonly uyeIsyeriNo: string | null;
  readonly komisyonBinde: number;
  readonly valorGunu: number;
  readonly aktif: boolean;
  readonly hareketSayisi: number;
}

@Injectable()
export class BankaTanimServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  /* ------------------------------- Banka -------------------------------- */

  async bankalariListele(principal: Principal): Promise<readonly BankaSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.banka.findMany({
          where: { tenantId: principal.tenantId, silinmeTarihi: null },
          orderBy: { ad: 'asc' },
          select: {
            id: true, ad: true, eftKodu: true, swift: true,
            _count: { select: { subeler: true, hesaplar: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((b) => ({
      id: b.id, ad: b.ad, eftKodu: b.eftKodu, swift: b.swift,
      subeSayisi: b._count.subeler, hesapSayisi: b._count.hesaplar,
    }));
  }

  async bankaEkle(dto: BankaEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.bankaEkle');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      await tx.banka.create({
        data: {
          id, tenantId: principal.tenantId,
          ad: dto.ad.trim(),
          eftKodu: dto.eftKodu ?? null,
          swift: dto.swift?.toUpperCase() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Banka', varlikId: id,
        sonrakiDeger: { ad: dto.ad, eftKodu: dto.eftKodu ?? null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async bankaDuzelt(
    id: string, dto: BankaDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.bankaDuzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.banka.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, eftKodu: true, swift: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Banka bulunamadı: ${id}`);

      await tx.banka.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.eftKodu === undefined ? {} : { eftKodu: dto.eftKodu }),
          ...(dto.swift === undefined ? {} : { swift: dto.swift.toUpperCase() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Banka', varlikId: id,
        oncekiDeger: { ad: kayit.ad, eftKodu: kayit.eftKodu, swift: kayit.swift },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad,
          eftKodu: dto.eftKodu ?? kayit.eftKodu,
          swift: dto.swift ?? kayit.swift,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Bankayı arşivler. HESABI ya da ŞUBESİ olan banka arşivlenemez: hesap
   * sahipsiz kalır ve o hesabın hareketleri hangi bankaya ait olduğu
   * bilinmeyen kayıtlara dönüşür.
   */
  async bankaSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.bankaSil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.banka.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: {
          id: true, ad: true,
          _count: { select: { hesaplar: true, subeler: true, evraklar: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Banka bulunamadı: ${id}`);

      const engeller: { readonly aciklama: string; readonly kontrol: string }[] = [];
      if (kayit._count.hesaplar > 0) {
        engeller.push({
          aciklama: `${kayit._count.hesaplar} banka hesabı bu bankaya bağlı.`,
          kontrol: 'BANKA_HESAP_VAR',
        });
      }
      if (kayit._count.subeler > 0) {
        engeller.push({
          aciklama: `${kayit._count.subeler} şubesi var.`,
          kontrol: 'BANKA_SUBE_VAR',
        });
      }
      if (kayit._count.evraklar > 0) {
        engeller.push({
          aciklama: `${kayit._count.evraklar} çek/senet bu bankaya bağlı.`,
          kontrol: 'BANKA_EVRAK_VAR',
        });
      }

      silmeyiDogrula(
        { varlik: 'Banka', sinif: 'ANA_VERI', engelleyenBagimliliklar: engeller },
        gerekce,
      );

      await tx.banka.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce.trim(),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Banka', varlikId: id,
        oncekiDeger: { ad: kayit.ad },
        gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ARSIVLENDI' };
    });
  }

  /* -------------------------------- Şube -------------------------------- */

  async subeleriListele(
    principal: Principal, bankaId?: string,
  ): Promise<readonly SubeSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaSubesi.findMany({
          where: {
            tenantId: principal.tenantId, silinmeTarihi: null,
            ...(bankaId === undefined ? {} : { bankaId }),
          },
          orderBy: [{ banka: { ad: 'asc' } }, { ad: 'asc' }],
          select: {
            id: true, bankaId: true, ad: true, subeKodu: true, telefon: true,
            banka: { select: { ad: true } },
            _count: { select: { hesaplar: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((s) => ({
      id: s.id, bankaId: s.bankaId, bankaAdi: s.banka.ad, ad: s.ad,
      subeKodu: s.subeKodu, telefon: s.telefon,
      hesapSayisi: s._count.hesaplar,
    }));
  }

  async subeEkle(dto: SubeEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.subeEkle');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const banka = await tx.banka.findFirst({
        where: { id: dto.bankaId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true },
      });
      if (!banka) throw new KayitBulunamadi(`Banka bulunamadı: ${dto.bankaId}`);

      await tx.bankaSubesi.create({
        data: {
          id, tenantId: principal.tenantId, bankaId: dto.bankaId,
          ad: dto.ad.trim(),
          subeKodu: dto.subeKodu ?? null,
          adres: dto.adres?.trim() ?? null,
          telefon: dto.telefon ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BankaSubesi', varlikId: id,
        sonrakiDeger: { bankaAdi: banka.ad, ad: dto.ad, subeKodu: dto.subeKodu ?? null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async subeDuzelt(
    id: string, dto: SubeDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.subeDuzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bankaSubesi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, subeKodu: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Şube bulunamadı: ${id}`);

      await tx.bankaSubesi.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.subeKodu === undefined ? {} : { subeKodu: dto.subeKodu }),
          ...(dto.adres === undefined ? {} : { adres: dto.adres.trim() }),
          ...(dto.telefon === undefined ? {} : { telefon: dto.telefon }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BankaSubesi', varlikId: id,
        oncekiDeger: { ad: kayit.ad, subeKodu: kayit.subeKodu },
        sonrakiDeger: { ad: dto.ad ?? kayit.ad, subeKodu: dto.subeKodu ?? kayit.subeKodu },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  async subeSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.subeSil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bankaSubesi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: {
          id: true, ad: true,
          _count: { select: { hesaplar: true, evraklar: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Şube bulunamadı: ${id}`);

      const engeller: { readonly aciklama: string; readonly kontrol: string }[] = [];
      if (kayit._count.hesaplar > 0) {
        engeller.push({
          aciklama: `${kayit._count.hesaplar} banka hesabı bu şubeye bağlı.`,
          kontrol: 'SUBE_HESAP_VAR',
        });
      }
      if (kayit._count.evraklar > 0) {
        engeller.push({
          aciklama: `${kayit._count.evraklar} çek/senet bu şubeye bağlı.`,
          kontrol: 'SUBE_EVRAK_VAR',
        });
      }

      silmeyiDogrula(
        { varlik: 'BankaSubesi', sinif: 'ANA_VERI', engelleyenBagimliliklar: engeller },
        gerekce,
      );

      await tx.bankaSubesi.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce.trim(),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'BankaSubesi', varlikId: id,
        oncekiDeger: { ad: kayit.ad }, gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ARSIVLENDI' };
    });
  }

  /* ---------------------------- Banka hesabı ---------------------------- */

  async hesaplariListele(
    principal: Principal, secenek: { readonly yalnizcaAktif?: boolean } = {},
  ): Promise<readonly BankaHesabiSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaHesabi.findMany({
          where: {
            tenantId: principal.tenantId, silinmeTarihi: null,
            ...(secenek.yalnizcaAktif === true ? { aktif: true } : {}),
          },
          orderBy: [{ banka: { ad: 'asc' } }, { ad: 'asc' }],
          select: {
            id: true, ad: true, bankaId: true, iban: true, hesapNo: true,
            paraBirimi: true, aktif: true, muhasebeHesapId: true,
            acilisBakiyesi: true, acilisTarihi: true,
            banka: { select: { ad: true } },
            sube: { select: { ad: true } },
            muhasebeHesabi: { select: { kod: true, ad: true } },
            _count: { select: { hareketler: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((h) => ({
      id: h.id, ad: h.ad, bankaId: h.bankaId, bankaAdi: h.banka.ad,
      subeAdi: h.sube?.ad ?? null,
      iban: h.iban, hesapNo: h.hesapNo, paraBirimi: h.paraBirimi,
      aktif: h.aktif,
      muhasebeHesapId: h.muhasebeHesapId,
      muhasebeHesapKodu: h.muhasebeHesabi.kod,
      muhasebeHesapAdi: h.muhasebeHesabi.ad,
      acilisBakiyesi: h.acilisBakiyesi.toFixed(4),
      acilisTarihi: h.acilisTarihi === null
        ? null
        : h.acilisTarihi.toISOString().slice(0, 10),
      hareketSayisi: h._count.hareketler,
    }));
  }

  async hesapEkle(dto: BankaHesabiEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.hesapEkle');
    const id = randomUUID();
    // IBAN mod-97 ile doğrulanır ve NORMALLENMİŞ hâli saklanır: aynı IBAN'ın
    // boşluklu ve boşluksuz iki kaydı olursa tekillik index'i çalışmaz ve
    // mutabakat hangi hesaba yazacağını bilemez.
    const iban = dto.iban === undefined ? null : ibaniDogrula(dto.iban);

    return this.prisma.tenantIslemi(async (tx) => {
      const banka = await tx.banka.findFirst({
        where: { id: dto.bankaId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, eftKodu: true },
      });
      if (!banka) throw new KayitBulunamadi(`Banka bulunamadı: ${dto.bankaId}`);

      if (dto.subeId !== undefined) {
        const sube = await tx.bankaSubesi.findFirst({
          where: {
            id: dto.subeId, tenantId: principal.tenantId,
            bankaId: dto.bankaId, silinmeTarihi: null,
          },
          select: { id: true },
        });
        if (!sube) {
          throw new IsKuraliIhlali(
            'Şube bu bankaya ait değil.',
            'Şube seçimini bankaya göre daraltın.',
          );
        }
      }

      // IBAN'ın banka kodu ile seçilen bankanın EFT kodu tutmuyorsa UYARMAK
      // yetmez, REDDEDİLİR: yanlış bankaya bağlanmış hesap, mutabakatta
      // hareketin kaynağını kalıcı olarak yanlış gösterir.
      if (iban !== null && banka.eftKodu !== null) {
        const ibanBankaKodu = ibandanBankaKodu(iban);
        if (ibanBankaKodu !== null && !ibanBankaKodu.startsWith(banka.eftKodu)) {
          throw new IsKuraliIhlali(
            `IBAN'ın banka kodu (${ibanBankaKodu}) seçilen bankanın EFT kodu ` +
              `(${banka.eftKodu}) ile uyuşmuyor.`,
            'IBAN başka bir bankaya ait. Doğru bankayı seçin ya da IBAN\'ı ' +
              'dekonttan tekrar okuyun.',
          );
        }
      }

      await this.muhasebeHesabiniDogrula(tx, dto.muhasebeHesapId, principal);

      await tx.bankaHesabi.create({
        data: {
          id, tenantId: principal.tenantId,
          bankaId: dto.bankaId,
          subeId: dto.subeId ?? null,
          muhasebeHesapId: dto.muhasebeHesapId,
          ad: dto.ad.trim(),
          iban,
          hesapNo: dto.hesapNo ?? null,
          paraBirimi: dto.paraBirimi ?? 'TRY',
          acilisBakiyesi: new Prisma.Decimal(dto.acilisBakiyesi ?? '0'),
          acilisTarihi: dto.acilisTarihi === undefined
            ? null
            : new Date(dto.acilisTarihi),
          notlar: dto.notlar?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BankaHesabi', varlikId: id,
        sonrakiDeger: {
          bankaAdi: banka.ad, ad: dto.ad, iban,
          muhasebeHesapId: dto.muhasebeHesapId,
          acilisBakiyesi: dto.acilisBakiyesi ?? '0',
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /**
   * Muhasebe hesabı denetimi — `ozellik = BANKA` ZORUNLU.
   *
   * Bir banka hesabı 'ozellik = KASA' hesaba bağlanırsa Kasa Defteri banka
   * hareketlerini gösterir; ikisi de yanlış çıkar. Ara hesaba (fiş kesilemez)
   * bağlanırsa muhasebeleştirme hiç çalışmaz.
   */
  private async muhasebeHesabiniDogrula(
    tx: Prisma.TransactionClient, hesapId: string, principal: Principal,
  ): Promise<void> {
    const hesap = await tx.hesap.findFirst({
      where: { id: hesapId, tenantId: principal.tenantId, silinmeTarihi: null },
      select: { id: true, kod: true, ad: true, ozellik: true, aktif: true, fisKesilebilirMi: true },
    });
    if (!hesap) throw new KayitBulunamadi(`Muhasebe hesabı bulunamadı: ${hesapId}`);

    if (hesap.ozellik !== 'BANKA') {
      throw new IsKuraliIhlali(
        `'${hesap.kod} ${hesap.ad}' hesabının özelliği ${hesap.ozellik}; ` +
          'banka hesabı yalnızca özelliği BANKA olan hesaba bağlanabilir.',
        'Banka Defteri hesap KODUNA değil `ozellik` alanına dayanır. Yanlış ' +
          'özellikli hesaba bağlanırsa hem Kasa hem Banka Defteri yanlış çıkar.',
      );
    }
    if (!hesap.aktif) {
      throw new IsKuraliIhlali(
        `'${hesap.kod}' hesabı pasif.`,
        'Pasif hesaba fiş kesilemez; banka hareketleri muhasebeleşemez.',
      );
    }
    if (!hesap.fisKesilebilirMi) {
      throw new IsKuraliIhlali(
        `'${hesap.kod}' bir ARA HESAPTIR; fiş kesilemez.`,
        'Alt hesap seçin: ara hesaba doğrudan kayıt alt hesapların toplamını ' +
          'bozar.',
      );
    }
  }

  async hesapDuzelt(
    id: string, dto: BankaHesabiDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.hesapDuzelt');
    const iban = dto.iban === undefined ? undefined : ibaniDogrula(dto.iban);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bankaHesabi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, iban: true, aktif: true, bankaId: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${id}`);

      if (dto.subeId !== undefined) {
        const sube = await tx.bankaSubesi.findFirst({
          where: {
            id: dto.subeId, tenantId: principal.tenantId,
            bankaId: kayit.bankaId, silinmeTarihi: null,
          },
          select: { id: true },
        });
        if (!sube) {
          throw new IsKuraliIhlali(
            'Şube bu bankaya ait değil.',
            'Şube seçimini hesabın bankasına göre daraltın.',
          );
        }
      }

      await tx.bankaHesabi.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(iban === undefined ? {} : { iban }),
          ...(dto.hesapNo === undefined ? {} : { hesapNo: dto.hesapNo }),
          ...(dto.subeId === undefined ? {} : { subeId: dto.subeId }),
          ...(dto.aktif === undefined ? {} : { aktif: dto.aktif }),
          ...(dto.notlar === undefined ? {} : { notlar: dto.notlar.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BankaHesabi', varlikId: id,
        oncekiDeger: { ad: kayit.ad, iban: kayit.iban, aktif: kayit.aktif },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad,
          iban: iban ?? kayit.iban,
          aktif: dto.aktif ?? kayit.aktif,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Banka hesabını arşivler.
   *
   * HAREKET GÖRMÜŞ HESAP ARŞİVLENEMEZ: hareketleri sahipsiz kalır ve o
   * hesabın muhasebe karşılığı ile banka gerçeği bir daha karşılaştırılamaz.
   * Kullanımdan çıkarmak için `aktif = false` yeterlidir — geçmiş korunur.
   */
  async hesapSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.hesapSil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.bankaHesabi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: {
          id: true, ad: true,
          _count: {
            select: {
              hareketler: true, ekstreler: true, posTanimlari: true,
              tahsilEvraklari: true,
            },
          },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${id}`);

      const engeller: { readonly aciklama: string; readonly kontrol: string }[] = [];
      if (kayit._count.hareketler > 0) {
        engeller.push({
          aciklama: `${kayit._count.hareketler} banka hareketi bu hesaba yazılmış.`,
          kontrol: 'BANKA_HESAP_HAREKET_VAR',
        });
      }
      if (kayit._count.ekstreler > 0) {
        engeller.push({
          aciklama: `${kayit._count.ekstreler} ekstre bu hesaba bağlı.`,
          kontrol: 'BANKA_HESAP_EKSTRE_VAR',
        });
      }
      if (kayit._count.posTanimlari > 0) {
        engeller.push({
          aciklama: `${kayit._count.posTanimlari} POS tanımı bu hesaba bağlı.`,
          kontrol: 'BANKA_HESAP_POS_VAR',
        });
      }
      if (kayit._count.tahsilEvraklari > 0) {
        engeller.push({
          aciklama: `${kayit._count.tahsilEvraklari} çek/senet bu hesaba tahsile verilmiş.`,
          kontrol: 'BANKA_HESAP_EVRAK_VAR',
        });
      }

      silmeyiDogrula(
        { varlik: 'BankaHesabi', sinif: 'ANA_VERI', engelleyenBagimliliklar: engeller },
        gerekce,
      );

      await tx.bankaHesabi.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce.trim(),
          // Arşivlenen hesap aynı zamanda PASİFTİR: aksi hâlde "aktif hesaplar"
          // listesi arşivlenmiş bir hesabı gösterebilirdi.
          aktif: false,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'BankaHesabi', varlikId: id,
        oncekiDeger: { ad: kayit.ad }, gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ARSIVLENDI' };
    });
  }

  /* --------------------------------- POS -------------------------------- */

  async posListele(
    principal: Principal, secenek: { readonly tip?: string } = {},
  ): Promise<readonly PosSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.posTanimi.findMany({
          where: {
            tenantId: principal.tenantId, silinmeTarihi: null,
            ...(secenek.tip === 'FIZIKI' || secenek.tip === 'SANAL'
              ? { tip: secenek.tip }
              : {}),
          },
          orderBy: { ad: 'asc' },
          select: {
            id: true, ad: true, tip: true, bankaHesabiId: true,
            terminalNo: true, uyeIsyeriNo: true, komisyonBinde: true,
            valorGunu: true, aktif: true,
            bankaHesabi: { select: { ad: true } },
            _count: { select: { hareketler: true } },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((p) => ({
      id: p.id, ad: p.ad, tip: p.tip,
      bankaHesabiId: p.bankaHesabiId, bankaHesabiAdi: p.bankaHesabi.ad,
      terminalNo: p.terminalNo, uyeIsyeriNo: p.uyeIsyeriNo,
      komisyonBinde: p.komisyonBinde, valorGunu: p.valorGunu,
      aktif: p.aktif, hareketSayisi: p._count.hareketler,
    }));
  }

  async posEkle(dto: PosEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.posEkle');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const hesap = await tx.bankaHesabi.findFirst({
        where: {
          id: dto.bankaHesabiId, tenantId: principal.tenantId,
          silinmeTarihi: null,
        },
        select: { id: true, ad: true, aktif: true },
      });
      if (!hesap) {
        throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${dto.bankaHesabiId}`);
      }
      if (!hesap.aktif) {
        throw new IsKuraliIhlali(
          `'${hesap.ad}' hesabı pasif; POS bağlanamaz.`,
          'POS tahsilatı pasif bir hesaba giremez.',
        );
      }

      await tx.posTanimi.create({
        data: {
          id, tenantId: principal.tenantId,
          bankaHesabiId: dto.bankaHesabiId,
          tip: dto.tip ?? 'FIZIKI',
          ad: dto.ad.trim(),
          terminalNo: dto.terminalNo ?? null,
          uyeIsyeriNo: dto.uyeIsyeriNo ?? null,
          komisyonBinde: dto.komisyonBinde ?? 0,
          valorGunu: dto.valorGunu ?? 0,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'PosTanimi', varlikId: id,
        sonrakiDeger: {
          ad: dto.ad, tip: dto.tip ?? 'FIZIKI',
          bankaHesabiAdi: hesap.ad,
          komisyonBinde: dto.komisyonBinde ?? 0,
          valorGunu: dto.valorGunu ?? 0,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async posDuzelt(
    id: string, dto: PosDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.posDuzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.posTanimi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, komisyonBinde: true, valorGunu: true, aktif: true },
      });
      if (!kayit) throw new KayitBulunamadi(`POS tanımı bulunamadı: ${id}`);

      await tx.posTanimi.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.terminalNo === undefined ? {} : { terminalNo: dto.terminalNo }),
          ...(dto.uyeIsyeriNo === undefined ? {} : { uyeIsyeriNo: dto.uyeIsyeriNo }),
          ...(dto.komisyonBinde === undefined ? {} : { komisyonBinde: dto.komisyonBinde }),
          ...(dto.valorGunu === undefined ? {} : { valorGunu: dto.valorGunu }),
          ...(dto.aktif === undefined ? {} : { aktif: dto.aktif }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'PosTanimi', varlikId: id,
        // Komisyon oranı değişikliği AUDIT'te tutulur: geçmiş tahsilatların
        // komisyonu o günkü oranla hesaplanmıştır ve oran değişikliği geçmişi
        // yeniden yazmaz.
        oncekiDeger: {
          ad: kayit.ad, komisyonBinde: kayit.komisyonBinde,
          valorGunu: kayit.valorGunu, aktif: kayit.aktif,
        },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad,
          komisyonBinde: dto.komisyonBinde ?? kayit.komisyonBinde,
          valorGunu: dto.valorGunu ?? kayit.valorGunu,
          aktif: dto.aktif ?? kayit.aktif,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  async posSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.posSil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.posTanimi.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, _count: { select: { hareketler: true } } },
      });
      if (!kayit) throw new KayitBulunamadi(`POS tanımı bulunamadı: ${id}`);

      const engeller: { readonly aciklama: string; readonly kontrol: string }[] = [];
      if (kayit._count.hareketler > 0) {
        engeller.push({
          aciklama: `${kayit._count.hareketler} tahsilat bu POS ile yapılmış.`,
          kontrol: 'POS_HAREKET_VAR',
        });
      }

      silmeyiDogrula(
        { varlik: 'PosTanimi', sinif: 'ANA_VERI', engelleyenBagimliliklar: engeller },
        gerekce,
      );

      await tx.posTanimi.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce.trim(),
          aktif: false,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'PosTanimi', varlikId: id,
        oncekiDeger: { ad: kayit.ad }, gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ARSIVLENDI' };
    });
  }
}
