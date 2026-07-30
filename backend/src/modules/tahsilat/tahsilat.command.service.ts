/**
 * Tahsilat (MAKBUZ) — komut tarafı (CQRS).
 *
 * Makbuz ayrı bir varlık DEĞİLDİR: `tahsilat` kaydının belge görünümüdür.
 * Ayrı bir `makbuz` tablosu açılsaydı aynı para iki yerde durur ve biri
 * güncellenmediğinde makbuz ile defter tutmazdı.
 *
 * ⚠️  TAHSİLAT SİLİNMEZ (BFS v1 §5.1). Hatalı kayıt `durum = IPTAL` ile
 *     gerekçelenir; makbuz numarası serisinde boşluk oluşmaz (VUK: makbuz
 *     numarası atlamaz, iptal edilen makbuz "iptal" olarak saklanır).
 *
 * ⚠️  `borc.odenen` HER DEĞİŞİKLİKTE YENİDEN HESAPLANIR, artırılmaz.
 *     `increment` kullanılsaydı iptal/düzeltme sonrası iki kaynak (kolon ve
 *     tahsis satırları) ayrışır ve bakiye SESSİZCE yanlış çıkardı.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { money, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  tahsilatIptalEdilebilirMi, tahsilatiDogrula, tahsisleriDogrula,
  type AcikBorc, type TahsisGirdisi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { NumaraServisi } from '../../common/numbering/numara.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { FisCommandServisi } from '../muhasebe/fis.command.service';
import type {
  TahsilatEkleDto, TahsilatIptalDto, TahsilatMuhasebelestirDto,
} from './dto/tahsilat.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

@Injectable()
export class TahsilatCommandServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly numara: NumaraServisi,
    private readonly fis: FisCommandServisi,
  ) {}

  /**
   * Tahsilat (makbuz) oluşturur.
   *
   * Doğrulama sırası ÖNEMLİ: önce tahsilatın kendisi (kanal kanıtı, tarih),
   * sonra tahsisler. Ters sırada olsaydı kanıtsız bir banka tahsilatı için
   * "tahsis toplamı tutmuyor" gibi alakasız bir hata dönerdi.
   */
  async ekle(
    dto: TahsilatEkleDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly makbuzNo: string }> {
    const baglam = mevcutBaglamiZorunluKil('tahsilat.ekle');
    const id = randomUUID();
    const tarih = takvimTarihi(dto.tahsilatTarihi);
    const tutar = money(dto.tutar);

    tahsilatiDogrula(
      {
        kanal: dto.kanal, tutar, tahsilatTarihi: tarih,
        bankaHareketiVarMi: dto.bankaHareketiId !== undefined,
        kiymetliEvrakVarMi: dto.kiymetliEvrakId !== undefined,
      },
      bugun(),
    );

    return this.prisma.tenantIslemi(async (tx) => {
      const borcIdler = [...new Set(dto.tahsisler.map((t) => t.borcId))];
      const borclar = await tx.borc.findMany({
        where: { id: { in: borcIdler }, tenantId: principal.tenantId },
        select: {
          id: true, tutar: true, odenen: true, vadeTarihi: true, kapandiMi: true,
          bolumId: true,
          sorumlular: {
            select: { id: true, kisiId: true, pay: true, odenen: true },
          },
        },
      });
      if (borclar.length !== borcIdler.length) {
        throw new KayitBulunamadi(
          'Tahsis edilen borçlardan biri bulunamadı ya da başka tenant\'a ait.',
        );
      }

      // Domain'in gördüğü "açık borç" listesi: hem borcun kendisi hem de
      // hisseli mülkiyette PAY bazında. İkisi bir arada verilir çünkü tahsis
      // ya borca ya da paya yapılır.
      const acikBorclar: AcikBorc[] = [];
      for (const b of borclar) {
        acikBorclar.push({
          borcId: b.id, borcSorumlusuId: null,
          tutar: money(b.tutar.toFixed(4)),
          odenen: money(b.odenen.toFixed(4)),
          vadeTarihi: gun(b.vadeTarihi),
        });
        for (const s of b.sorumlular) {
          acikBorclar.push({
            borcId: b.id, borcSorumlusuId: s.id,
            tutar: money(s.pay.toFixed(4)),
            odenen: money(s.odenen.toFixed(4)),
            vadeTarihi: gun(b.vadeTarihi),
          });
        }
      }

      const tahsisler: TahsisGirdisi[] = dto.tahsisler.map((t) => ({
        borcId: t.borcId,
        borcSorumlusuId: t.borcSorumlusuId ?? null,
        tutar: money(t.tutar),
      }));

      tahsisleriDogrula(tutar, tahsisler, acikBorclar);

      // Kanıt kayıtlarının varlığı ve tenant'a aitliği ayrıca doğrulanır: DTO
      // yalnızca "UUID mi" diye bakar, "bizim mi" diye bakmaz.
      if (dto.bankaHareketiId !== undefined) {
        const h = await tx.bankaHareketi.findFirst({
          where: { id: dto.bankaHareketiId, tenantId: principal.tenantId },
          select: { id: true, yon: true },
        });
        if (!h) {
          throw new KayitBulunamadi(`Banka hareketi bulunamadı: ${dto.bankaHareketiId}`);
        }
        // ÇIKIŞ hareketi tahsilata bağlanamaz: para bizden çıkmışken tahsilat
        // yazmak, aynı hareketi hem gelir hem gider gösterir.
        if (h.yon !== 'GIRIS') {
          throw new IsKuraliIhlali(
            'Tahsilata yalnızca GİRİŞ yönlü banka hareketi bağlanabilir.',
            'Çıkış hareketi bir ödemedir; tahsilat değildir.',
          );
        }
      }
      if (dto.kiymetliEvrakId !== undefined) {
        const e = await tx.kiymetliEvrak.findFirst({
          where: { id: dto.kiymetliEvrakId, tenantId: principal.tenantId },
          select: { id: true },
        });
        if (!e) {
          throw new KayitBulunamadi(`Kıymetli evrak bulunamadı: ${dto.kiymetliEvrakId}`);
        }
      }
      if (dto.odeyenKisiId !== undefined) {
        const k = await tx.kisi.findFirst({
          where: {
            id: dto.odeyenKisiId, tenantId: principal.tenantId, silinmeTarihi: null,
          },
          select: { id: true },
        });
        if (!k) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.odeyenKisiId}`);
      }

      // MAKBUZ NO — BOŞLUKSUZ seri (VUK: makbuz numarası atlamaz).
      const makbuzNo = await this.numara.tahsisEt(tx, {
        tenantId: principal.tenantId,
        seriKodu: 'MAKBUZ',
        yil: new Date(tarih).getUTCFullYear(),
      });

      await tx.tahsilat.create({
        data: {
          id, tenantId: principal.tenantId,
          makbuzNo,
          kanal: dto.kanal,
          durum: 'GECERLI',
          tutar: new Prisma.Decimal(dto.tutar),
          tahsilatTarihi: new Date(tarih),
          aciklama: dto.aciklama?.trim() ?? null,
          odeyenKisiId: dto.odeyenKisiId ?? null,
          tahsilEden: principal.id,
          bankaHareketiId: dto.bankaHareketiId ?? null,
          kiymetliEvrakId: dto.kiymetliEvrakId ?? null,
          tahsisler: {
            create: dto.tahsisler.map((t) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              borcId: t.borcId,
              borcSorumlusuId: t.borcSorumlusuId ?? null,
              tutar: new Prisma.Decimal(t.tutar),
            })),
          },
        },
      });

      await this.borcBakiyeleriniYenidenHesapla(tx, borcIdler, principal.tenantId);

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Tahsilat', varlikId: id,
        sonrakiDeger: {
          makbuzNo, kanal: dto.kanal, tutar: dto.tutar, tahsilatTarihi: tarih,
          tahsisSayisi: dto.tahsisler.length,
          borcIdler,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GECERLI', makbuzNo };
    });
  }

  /**
   * `borc.odenen` ve `borc_sorumlusu.odenen` alanlarını TAHSİS SATIRLARINDAN
   * yeniden hesaplar.
   *
   * ⚠️  ARTIRMA (`increment`) KULLANILMAZ. Artırma, iptal ve düzeltme
   *     sonrasında iki kaynağı (kolon ve tahsis satırları) ayrıştırır; kolon
   *     doğru görünmeye devam eder ama gerçeği yansıtmaz. Yeniden hesaplama
   *     her zaman tek gerçek kaynağa (tahsis satırları) döner.
   *
   * ⚠️  YALNIZCA GEÇERLİ tahsilatların tahsisleri sayılır. İptal edilen
   *     tahsilatın tahsisleri silinir ama savunma amaçlı burada da süzülür.
   */
  private async borcBakiyeleriniYenidenHesapla(
    tx: Prisma.TransactionClient, borcIdler: readonly string[], tenantId: string,
  ): Promise<void> {
    if (borcIdler.length === 0) return;

    const borcToplamlari = await tx.tahsilatTahsisi.groupBy({
      by: ['borcId'],
      where: {
        tenantId, borcId: { in: [...borcIdler] },
        tahsilat: { durum: 'GECERLI' },
      },
      _sum: { tutar: true },
    });
    const borcHaritasi = new Map(
      borcToplamlari.map((t) => [t.borcId, t._sum.tutar ?? new Prisma.Decimal(0)]),
    );

    const borclar = await tx.borc.findMany({
      where: { id: { in: [...borcIdler] }, tenantId },
      select: { id: true, tutar: true, sorumlular: { select: { id: true, pay: true } } },
    });

    for (const b of borclar) {
      const odenen = borcHaritasi.get(b.id) ?? new Prisma.Decimal(0);
      await tx.borc.update({
        where: { id: b.id },
        data: { odenen, kapandiMi: odenen.gte(b.tutar) },
      });
    }

    const sorumluIdler = borclar.flatMap((b) => b.sorumlular.map((s) => s.id));
    if (sorumluIdler.length === 0) return;

    const sorumluToplamlari = await tx.tahsilatTahsisi.groupBy({
      by: ['borcSorumlusuId'],
      where: {
        tenantId, borcSorumlusuId: { in: sorumluIdler },
        tahsilat: { durum: 'GECERLI' },
      },
      _sum: { tutar: true },
    });
    const sorumluHaritasi = new Map(
      sorumluToplamlari
        .filter((t): t is typeof t & { borcSorumlusuId: string } => t.borcSorumlusuId !== null)
        .map((t) => [t.borcSorumlusuId, t._sum.tutar ?? new Prisma.Decimal(0)]),
    );

    for (const b of borclar) {
      for (const s of b.sorumlular) {
        const odenen = sorumluHaritasi.get(s.id) ?? new Prisma.Decimal(0);
        await tx.borcSorumlusu.update({
          where: { id: s.id },
          data: { odenen, kapandiMi: odenen.gte(s.pay) },
        });
      }
    }
  }

  /**
   * MAKBUZ İPTALİ.
   *
   * ⚠️  KAYIT SİLİNMEZ. `durum = IPTAL` olur, gerekçe ve iptal eden yazılır.
   *     Makbuz numarası KORUNUR: seride boşluk oluşsaydı "kaç makbuz kesildi"
   *     sorusunun cevabı defterle tutmazdı.
   *
   * ⚠️  TAHSİS SATIRLARI SİLİNİR ve borç bakiyeleri yeniden hesaplanır.
   *     Bırakılsaydı iptal edilmiş bir makbuz borcu kapatmaya devam ederdi.
   *
   * ⚠️  MUHASEBELEŞMİŞ tahsilat iptal EDİLEMEZ — önce fişin ters kaydı
   *     (storno) gerekir. Aksi hâlde fiş ile cari defter kalıcı olarak ayrışır.
   */
  async iptal(
    id: string, dto: TahsilatIptalDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('tahsilat.iptal');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.tahsilat.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: {
          id: true, makbuzNo: true, durum: true, tutar: true, kanal: true,
          yevmiyeFisiId: true,
          tahsisler: { select: { borcId: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Tahsilat bulunamadı: ${id}`);

      tahsilatIptalEdilebilirMi({
        durum: kayit.durum, yevmiyeFisiId: kayit.yevmiyeFisiId,
      });

      const borcIdler = [...new Set(kayit.tahsisler.map((t) => t.borcId))];

      await tx.tahsilatTahsisi.deleteMany({ where: { tahsilatId: id } });
      await tx.tahsilat.update({
        where: { id },
        data: {
          durum: 'IPTAL',
          iptalGerekcesi: dto.gerekce.trim(),
          iptalEden: principal.id,
          iptalAni: new Date(),
        },
      });

      await this.borcBakiyeleriniYenidenHesapla(tx, borcIdler, principal.tenantId);

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Tahsilat', varlikId: id,
        oncekiDeger: { durum: 'GECERLI', makbuzNo: kayit.makbuzNo },
        sonrakiDeger: {
          durum: 'IPTAL', makbuzNo: kayit.makbuzNo,
          tutar: kayit.tutar.toFixed(4),
          etkilenenBorcSayisi: borcIdler.length,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'IPTAL' };
    });
  }

  /**
   * MUHASEBELEŞTİRME — tahsilattan yevmiye fişi üretir.
   *
   * Kayıt: BORÇ = paranın girdiği hesap (kanala göre), ALACAK = cari kontrol
   * hesabı (`ozellik = CARI_KONTROL`). Alacak tarafı sabittir çünkü tahsilat
   * her zaman bir ALACAĞI kapatır; borç tarafı paranın nereye girdiğine bağlıdır.
   *
   * ⚠️  KANAL İÇİN HESAP TANIMLI DEĞİLSE İŞLEM REDDEDİLİR. "En yakın" hesap
   *     seçilseydi para yanlış hesaba yazılır ve hata yalnızca mizan
   *     tutmadığında — aylar sonra — fark edilirdi.
   */
  async muhasebelestir(
    id: string, dto: TahsilatMuhasebelestirDto, principal: Principal,
  ): Promise<KomutSonucu & { readonly fisId: string; readonly fisNo: string }> {
    const baglam = mevcutBaglamiZorunluKil('tahsilat.muhasebelestir');

    return this.prisma.tenantIslemi(async (tx) => {
      const t = await tx.tahsilat.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: {
          id: true, makbuzNo: true, durum: true, kanal: true, tutar: true,
          tahsilatTarihi: true, aciklama: true, yevmiyeFisiId: true,
          bankaHareketi: {
            select: { bankaHesabi: { select: { muhasebeHesapId: true, ad: true } } },
          },
        },
      });
      if (!t) throw new KayitBulunamadi(`Tahsilat bulunamadı: ${id}`);

      if (t.durum === 'IPTAL') {
        throw new IsKuraliIhlali(
          'İptal edilmiş tahsilat muhasebeleştirilemez.',
          'İptal edilmiş bir makbuzun deftere girmesi, olmayan parayı gelir yazar.',
        );
      }
      if (t.yevmiyeFisiId !== null) {
        throw new IsKuraliIhlali(
          'Bu tahsilat zaten muhasebeleştirilmiş.',
          'Aynı tahsilat iki kez muhasebeleştirilse aynı para iki kez deftere ' +
            'girer. Düzeltme için ilgili fişi storno edin.',
        );
      }

      const borcHesapId = await this.borcTarafiHesabi(tx, t.kanal, principal, t.bankaHareketi);
      const alacakHesapId = await this.cariKontrolHesabi(tx, principal);

      if (borcHesapId === alacakHesapId) {
        throw new IsKuraliIhlali(
          'Borç ve alacak tarafı aynı hesap olamaz.',
          'Aynı hesaba borç ve alacak yazan fiş bakiyeyi değiştirmez.',
        );
      }

      const tutar = t.tutar.toFixed(4);
      const fis = await this.fis.ekleIslemde(
        tx,
        {
          tarih: gun(t.tahsilatTarihi),
          aciklama: `Tahsilat makbuzu ${t.makbuzNo}${t.aciklama === null ? '' : `: ${t.aciklama}`}`,
          fisTuru: 'TAHSILAT',
          kaynakTipi: 'TAHSILAT',
          kaynakId: t.id,
          ...(dto.hemenIsle === undefined ? {} : { hemenIsle: dto.hemenIsle }),
          satirlar: [
            { hesapId: borcHesapId, borc: tutar, aciklama: `Makbuz ${t.makbuzNo}` },
            { hesapId: alacakHesapId, alacak: tutar, aciklama: `Makbuz ${t.makbuzNo}` },
          ],
        },
        principal,
        baglam,
      );

      await tx.tahsilat.update({ where: { id }, data: { yevmiyeFisiId: fis.id } });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Tahsilat', varlikId: id,
        oncekiDeger: { yevmiyeFisiId: null },
        sonrakiDeger: {
          yevmiyeFisiId: fis.id, fisNo: fis.fisNo,
          makbuzNo: t.makbuzNo, kanal: t.kanal, tutar,
          borcHesapId, alacakHesapId,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'MUHASEBELESTI', fisId: fis.id, fisNo: fis.fisNo };
    });
  }

  /**
   * Paranın GİRDİĞİ hesap — kanala göre.
   *
   * BANKA/POS: tahsilata bağlı banka hareketinin hesabı; yoksa parametredeki
   * varsayılan banka hesabı. NAKIT: varsayılan kasa hesabı.
   *
   * ÇEK · SENET · MAHSUP için hesap tanımı YOKTUR ve bu bilinçli bir
   * eksikliktir: çek portföy hesabı (121) ve mahsup karşılığı henüz
   * tanımlanmadı. Rastgele bir hesap seçmek yerine AÇIKÇA reddedilir.
   */
  private async borcTarafiHesabi(
    tx: Prisma.TransactionClient,
    kanal: string,
    principal: Principal,
    bankaHareketi: { bankaHesabi: { muhasebeHesapId: string; ad: string } } | null,
  ): Promise<string> {
    const parametre = await tx.muhasebeParametresi.findFirst({
      where: { tenantId: principal.tenantId },
      select: { varsayilanKasaHesapId: true, varsayilanBankaHesapId: true },
    });

    if (kanal === 'NAKIT') {
      if (!parametre?.varsayilanKasaHesapId) {
        throw new IsKuraliIhlali(
          'Varsayılan kasa hesabı tanımlı değil; nakit tahsilat muhasebeleşemez.',
          'Muhasebe → Parametreler ekranından varsayılan kasa hesabını seçin.',
        );
      }
      return parametre.varsayilanKasaHesapId;
    }

    if (kanal === 'BANKA' || kanal === 'POS') {
      if (bankaHareketi !== null) return bankaHareketi.bankaHesabi.muhasebeHesapId;
      if (!parametre?.varsayilanBankaHesapId) {
        throw new IsKuraliIhlali(
          `${kanal} tahsilatı için banka hesabı belirlenemedi.`,
          'Tahsilata banka hareketi bağlayın ya da Muhasebe → Parametreler ' +
            'ekranından varsayılan banka hesabını seçin.',
        );
      }
      return parametre.varsayilanBankaHesapId;
    }

    throw new IsKuraliIhlali(
      `${kanal} kanalı için muhasebe hesabı tanımlı değil.`,
      'Çek/senet portföy hesabı ve mahsup karşılığı henüz tanımlanmadı. ' +
        'Bu tahsilat elle fiş kesilerek muhasebeleştirilmelidir — sistem ' +
        'rastgele bir hesap seçmez.',
    );
  }

  /**
   * CARİ KONTROL HESABI — `ozellik = CARI_KONTROL` (ADR-0010).
   *
   * Hesap KODUNA bakılmaz: kod planı tenant'a göre değişir ve '120' her
   * tenant'ta alıcılar hesabı olmayabilir (§33 kural 3).
   *
   * BİRDEN ÇOK işaretli hesap varsa REDDEDİLİR: hangisinin kontrol hesabı
   * olduğu belirsizken yardımcı defter mutabakatı anlamsızdır.
   */
  private async cariKontrolHesabi(
    tx: Prisma.TransactionClient, principal: Principal,
  ): Promise<string> {
    const hesaplar = await tx.hesap.findMany({
      where: {
        tenantId: principal.tenantId, ozellik: 'CARI_KONTROL',
        silinmeTarihi: null, aktif: true,
      },
      select: { id: true, kod: true, fisKesilebilirMi: true },
    });

    if (hesaplar.length === 0) {
      throw new IsKuraliIhlali(
        'Cari kontrol hesabı tanımlı değil.',
        'Hesap planında alacaklar hesabını (genellikle 120) düzenleyip ' +
          'özelliğini CARI_KONTROL yapın. Kod ile değil özellik ile ' +
          'işaretlenir: kod planı tenant\'a göre değişir.',
      );
    }
    if (hesaplar.length > 1) {
      throw new IsKuraliIhlali(
        `Birden çok cari kontrol hesabı işaretli (${hesaplar.map((h) => h.kod).join(', ')}).`,
        'Yardımcı defter tek bir kontrol hesabıyla mutabık olur; fazlalıkları ' +
          'NORMAL özelliğine çevirin.',
      );
    }

    const hesap = hesaplar[0];
    if (hesap === undefined) {
      throw new IsKuraliIhlali('Cari kontrol hesabı okunamadı.');
    }
    if (!hesap.fisKesilebilirMi) {
      throw new IsKuraliIhlali(
        `Cari kontrol hesabı '${hesap.kod}' bir ARA HESAPTIR; fiş kesilemez.`,
        'Alt hesaplardan birini CARI_KONTROL olarak işaretleyin.',
      );
    }
    return hesap.id;
  }
}
