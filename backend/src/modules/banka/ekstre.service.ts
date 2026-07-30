/**
 * Banka ekstresi ve MUTABAKAT.
 *
 * Ekstre BANKANIN beyanıdır, bizim kaydımız değil. İkisi ayrı tutulur ki FARK
 * GÖRÜNÜR olsun: ekstrede olup sistemde olmayan satır kaçırılmış bir hareket,
 * sistemde olup ekstrede olmayan hareket ise gerçekleşmemiş ya da geç
 * yansıyan bir işlem demektir.
 *
 * ⚠️  OTOMATİK EŞLEŞTİRME BELİRSİZLİKTE DURUR. Bir satıra iki aday hareket
 *     uyuyorsa hiçbiri seçilmez ve satır eşleşmemiş kalır. Makine tahmin
 *     ederse yanlış eşleşme mutabakatı SESSİZCE tamamlanmış gösterir; oysa
 *     mutabakatın bütün amacı farkı görünür kılmaktır.
 *
 * ⚠️  MUTABAKAT İKİ KOŞULLA tamamlanır: (a) eşleşmemiş satır kalmaması VE
 *     (b) banka kapanış bakiyesi ile sistem bakiyesinin eşit olması. Yalnızca
 *     satır sayısına bakılsaydı, ekstrede hiç görünmeyen bir sistem hareketi
 *     (bizde var, bankada yok) mutabakatı tamamlanmış gösterirdi.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { apiBicimi, money, takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  eslestirmeAdayiBul, eslestirmeyiDogrula, mutabakatOzeti,
  type EslestirmeAdayi, type EslestirmeAyari,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { BankaHareketQueryServisi } from './hareket.query.service';
import type { EkstreEkleDto, EslestirDto, FarkKabulDto } from './dto/banka.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

export interface EkstreBasligi {
  readonly id: string;
  readonly bankaHesabiId: string;
  readonly bankaHesabiAdi: string;
  readonly baslangic: string;
  readonly bitis: string;
  readonly acilisBakiyesi: string;
  readonly kapanisBakiyesi: string;
  readonly kaynak: string;
  readonly satirSayisi: number;
  readonly eslesmeyenSayisi: number;
}

export interface EkstreSatirDokumu {
  readonly id: string;
  readonly islemTarihi: string;
  readonly valorTarihi: string | null;
  readonly yon: string;
  readonly tutar: string;
  readonly aciklama: string;
  readonly referansNo: string | null;
  readonly bakiye: string | null;
  readonly mutabakatDurumu: string;
  readonly eslesenHareketId: string | null;
  readonly eslesenHareketAciklamasi: string | null;
  readonly farkGerekcesi: string | null;
}

export interface MutabakatDokumu {
  readonly ekstre: EkstreBasligi;
  readonly satirlar: readonly EkstreSatirDokumu[];
  readonly satirSayisi: number;
  readonly eslesenSayisi: number;
  readonly farkKabulSayisi: number;
  readonly eslesmeyenSayisi: number;
  /** Bankanın beyan ettiği kapanış ile sistem bakiyesi arasındaki fark. */
  readonly bakiyeFarki: string;
  readonly sistemBakiyesi: string;
  /**
   * ⚠️  Bu alan GİZLENMEZ. `false` ise mutabakat tamamlanmamıştır; ekranın
   *     "mutabık" yazması ancak bu `true` ise doğrudur.
   */
  readonly mutabikMi: boolean;
}

export interface EslestirmeOnerisi {
  readonly satirId: string;
  readonly satirAciklamasi: string;
  readonly tutar: string;
  readonly hareketId: string | null;
  readonly hareketAciklamasi: string | null;
  readonly yontem: 'REFERANS' | 'TUTAR_TARIH' | null;
  /** Aday bulunamadıysa ya da BELİRSİZ kaldıysa gerekçe. */
  readonly not: string | null;
}

@Injectable()
export class EkstreServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly hareketSorgu: BankaHareketQueryServisi,
  ) {}

  /* -------------------------------- Ekstre ------------------------------- */

  async ekstreleriListele(
    principal: Principal, bankaHesabiId?: string,
  ): Promise<readonly EkstreBasligi[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaEkstresi.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(bankaHesabiId === undefined ? {} : { bankaHesabiId }),
          },
          orderBy: [{ baslangic: 'desc' }],
          select: {
            id: true, bankaHesabiId: true, baslangic: true, bitis: true,
            acilisBakiyesi: true, kapanisBakiyesi: true, kaynak: true,
            bankaHesabi: { select: { ad: true } },
            _count: { select: { satirlar: true } },
            satirlar: {
              where: { mutabakatDurumu: 'ESLESMEDI' },
              select: { id: true },
            },
          },
        }),
      principal.tenantId,
    );

    return kayitlar.map((e) => ({
      id: e.id,
      bankaHesabiId: e.bankaHesabiId,
      bankaHesabiAdi: e.bankaHesabi.ad,
      baslangic: gun(e.baslangic),
      bitis: gun(e.bitis),
      acilisBakiyesi: e.acilisBakiyesi.toFixed(4),
      kapanisBakiyesi: e.kapanisBakiyesi.toFixed(4),
      kaynak: e.kaynak,
      satirSayisi: e._count.satirlar,
      eslesmeyenSayisi: e.satirlar.length,
    }));
  }

  /**
   * Ekstre yükler. Satırlar aynı işlemde yazılır.
   *
   * Satırlar tek tek eklenebilir olsaydı yarım yüklenmiş bir ekstre ile
   * mutabakat yapılır ve eksik satırlar "bankada yok" gibi görünürdü.
   */
  async ekstreEkle(dto: EkstreEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.ekstreEkle');
    const id = randomUUID();
    const baslangic = takvimTarihi(dto.baslangic);
    const bitis = takvimTarihi(dto.bitis);

    if (bitis < baslangic) {
      throw new IsKuraliIhlali(
        `Ekstre bitiş tarihi (${bitis}) başlangıçtan (${baslangic}) önce olamaz.`,
        'Tarih aralığını düzeltin.',
      );
    }
    if (dto.satirlar.length === 0) {
      throw new IsKuraliIhlali(
        'Ekstre en az bir satır içermelidir.',
        'Boş ekstre mutabakata bir şey katmaz; hareketsiz dönem için ekstre ' +
          'yüklemeye gerek yoktur.',
      );
    }

    // Satır tarihleri ekstre aralığının DIŞINA çıkamaz: çıkarsa aynı hareket
    // iki ekstrede görünür ve iki kez mutabık edilmeye çalışılır.
    for (const s of dto.satirlar) {
      const t = takvimTarihi(s.islemTarihi);
      if (t < baslangic || t > bitis) {
        throw new IsKuraliIhlali(
          `Satır tarihi (${t}) ekstre aralığının (${baslangic} … ${bitis}) dışında.`,
          'Aralık dışı satır iki ekstrede birden görünür ve aynı hareket iki ' +
            'kez mutabık edilmeye çalışılır.',
        );
      }
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const hesap = await tx.bankaHesabi.findFirst({
        where: {
          id: dto.bankaHesabiId, tenantId: principal.tenantId,
          silinmeTarihi: null,
        },
        select: { id: true, ad: true },
      });
      if (!hesap) {
        throw new KayitBulunamadi(`Banka hesabı bulunamadı: ${dto.bankaHesabiId}`);
      }

      // ARALIK ÇAKIŞMASI reddedilir: aynı günü kapsayan iki ekstre olursa aynı
      // banka satırı iki kez mutabık edilir ve fark gizlenir.
      const cakisan = await tx.bankaEkstresi.findFirst({
        where: {
          tenantId: principal.tenantId,
          bankaHesabiId: dto.bankaHesabiId,
          baslangic: { lte: new Date(bitis) },
          bitis: { gte: new Date(baslangic) },
        },
        select: { id: true, baslangic: true, bitis: true },
      });
      if (cakisan) {
        throw new IsKuraliIhlali(
          `Bu hesapta ${gun(cakisan.baslangic)} … ${gun(cakisan.bitis)} aralığını ` +
            'kapsayan bir ekstre zaten var.',
          'Çakışan aralıklar aynı banka satırını iki kez mutabık ettirir ve ' +
            'gerçek farkı gizler.',
        );
      }

      await tx.bankaEkstresi.create({
        data: {
          id, tenantId: principal.tenantId,
          bankaHesabiId: dto.bankaHesabiId,
          baslangic: new Date(baslangic),
          bitis: new Date(bitis),
          acilisBakiyesi: new Prisma.Decimal(dto.acilisBakiyesi),
          kapanisBakiyesi: new Prisma.Decimal(dto.kapanisBakiyesi),
          kaynak: dto.kaynak ?? 'ELLE',
          kaynakReferansi: dto.kaynakReferansi ?? null,
          satirlar: {
            create: dto.satirlar.map((s) => ({
              id: randomUUID(),
              tenantId: principal.tenantId,
              islemTarihi: new Date(s.islemTarihi),
              valorTarihi: s.valorTarihi === undefined ? null : new Date(s.valorTarihi),
              yon: s.yon,
              tutar: new Prisma.Decimal(s.tutar),
              aciklama: s.aciklama.trim(),
              referansNo: s.referansNo?.trim() ?? null,
              bakiye: s.bakiye === undefined ? null : new Prisma.Decimal(s.bakiye),
            })),
          },
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'BankaEkstresi', varlikId: id,
        sonrakiDeger: {
          hesapAdi: hesap.ad, baslangic, bitis,
          acilisBakiyesi: dto.acilisBakiyesi,
          kapanisBakiyesi: dto.kapanisBakiyesi,
          kaynak: dto.kaynak ?? 'ELLE',
          satirSayisi: dto.satirlar.length,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'KAYDEDILDI' };
    });
  }

  /* ------------------------------ Mutabakat ------------------------------ */

  async mutabakat(ekstreId: string, principal: Principal): Promise<MutabakatDokumu> {
    const ekstre = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaEkstresi.findFirst({
          where: { id: ekstreId, tenantId: principal.tenantId },
          select: {
            id: true, bankaHesabiId: true, baslangic: true, bitis: true,
            acilisBakiyesi: true, kapanisBakiyesi: true, kaynak: true,
            bankaHesabi: { select: { ad: true } },
            satirlar: {
              orderBy: [{ islemTarihi: 'asc' }, { olusturulmaTarihi: 'asc' }],
              select: {
                id: true, islemTarihi: true, valorTarihi: true, yon: true,
                tutar: true, aciklama: true, referansNo: true, bakiye: true,
                mutabakatDurumu: true, eslesenHareketId: true,
                farkGerekcesi: true,
                eslesenHareket: { select: { aciklama: true } },
              },
            },
          },
        }),
      principal.tenantId,
    );
    if (!ekstre) throw new KayitBulunamadi(`Ekstre bulunamadı: ${ekstreId}`);

    // Sistem bakiyesi ekstre BİTİŞ tarihine göre okunur: banka kapanış
    // bakiyesi o güne aittir, bugüne göre karşılaştırmak arada oluşan
    // hareketleri fark gibi gösterirdi.
    const sistem = await this.hareketSorgu.bakiye(
      ekstre.bankaHesabiId, principal, gun(ekstre.bitis),
    );

    const ozet = mutabakatOzeti(
      ekstre.satirlar.map((s) => ({
        id: s.id,
        islemTarihi: gun(s.islemTarihi),
        yon: s.yon,
        tutar: money(s.tutar.toFixed(4)),
        referansNo: s.referansNo,
        mutabakatDurumu: s.mutabakatDurumu,
        eslesenHareketId: s.eslesenHareketId,
      })),
      money(ekstre.kapanisBakiyesi.toFixed(4)),
      money(sistem.islemBakiyesi),
    );

    return {
      ekstre: {
        id: ekstre.id,
        bankaHesabiId: ekstre.bankaHesabiId,
        bankaHesabiAdi: ekstre.bankaHesabi.ad,
        baslangic: gun(ekstre.baslangic),
        bitis: gun(ekstre.bitis),
        acilisBakiyesi: ekstre.acilisBakiyesi.toFixed(4),
        kapanisBakiyesi: ekstre.kapanisBakiyesi.toFixed(4),
        kaynak: ekstre.kaynak,
        satirSayisi: ekstre.satirlar.length,
        eslesmeyenSayisi: ozet.eslesmeyenSayisi,
      },
      satirlar: ekstre.satirlar.map((s) => ({
        id: s.id,
        islemTarihi: gun(s.islemTarihi),
        valorTarihi: s.valorTarihi === null ? null : gun(s.valorTarihi),
        yon: s.yon,
        tutar: s.tutar.toFixed(4),
        aciklama: s.aciklama,
        referansNo: s.referansNo,
        bakiye: s.bakiye === null ? null : s.bakiye.toFixed(4),
        mutabakatDurumu: s.mutabakatDurumu,
        eslesenHareketId: s.eslesenHareketId,
        eslesenHareketAciklamasi: s.eslesenHareket?.aciklama ?? null,
        farkGerekcesi: s.farkGerekcesi,
      })),
      satirSayisi: ozet.satirSayisi,
      eslesenSayisi: ozet.eslesenSayisi,
      farkKabulSayisi: ozet.farkKabulSayisi,
      eslesmeyenSayisi: ozet.eslesmeyenSayisi,
      bakiyeFarki: apiBicimi(ozet.bakiyeFarki),
      sistemBakiyesi: sistem.islemBakiyesi,
      mutabikMi: ozet.mutabikMi,
    };
  }

  private async ayariOku(principal: Principal): Promise<EslestirmeAyari> {
    const p = await this.prisma.tenantIslemi(
      (tx) =>
        tx.bankaParametresi.findFirst({
          where: { tenantId: principal.tenantId },
          select: { mutabakatToleransKurus: true, mutabakatGunPenceresi: true },
        }),
      principal.tenantId,
    );
    // Parametre yoksa TOLERANS SIFIR: kurulum tamamlanmadan makinenin kuruş
    // farkını yutması, gerçek bir eksik tahsilatı mutabık gösterirdi.
    return {
      toleransKurus: p?.mutabakatToleransKurus ?? 0,
      gunPenceresi: p?.mutabakatGunPenceresi ?? 3,
    };
  }

  /**
   * Eşleştirme adaylarını hesaplar — HİÇBİR ŞEY YAZMAZ.
   *
   * Önizleme ayrı bir uçtur çünkü kullanıcı neyin neyle eşleşeceğini görmeden
   * onay veremez; "otomatik eşleştir" düğmesi görülmemiş bir sonucu yazmış
   * olurdu.
   */
  async oneriler(
    ekstreId: string, principal: Principal,
  ): Promise<readonly EslestirmeOnerisi[]> {
    const veri = await this.eslestirmeVerisi(ekstreId, principal);
    const ayar = await this.ayariOku(principal);

    return veri.satirlar.map((s) => {
      const sonuc = eslestirmeAdayiBul(s.domain, veri.adaylar, ayar);
      if (sonuc === null) {
        // Aday sayısı raporlanır: "0 aday" ile "3 aday, belirsiz" farklı
        // sorunlardır ve farklı çözüm ister.
        const yaklasik = veri.adaylar.filter(
          (a) => !a.esleshmisMi && a.yon === s.domain.yon,
        ).length;
        return {
          satirId: s.id,
          satirAciklamasi: s.aciklama,
          tutar: s.tutarMetni,
          hareketId: null,
          hareketAciklamasi: null,
          yontem: null,
          not: yaklasik === 0
            ? 'Bu yönde eşleşmemiş hareket yok — hareket sisteme hiç girilmemiş olabilir.'
            : `${yaklasik} aday var ama tek bir eşleşme belirlenemedi; elle seçim gerekir.`,
        };
      }
      const aday = veri.adayHaritasi.get(sonuc.hareketId);
      return {
        satirId: s.id,
        satirAciklamasi: s.aciklama,
        tutar: s.tutarMetni,
        hareketId: sonuc.hareketId,
        hareketAciklamasi: aday?.aciklama ?? null,
        yontem: sonuc.yontem,
        not: null,
      };
    });
  }

  /**
   * OTOMATİK EŞLEŞTİRME — yalnızca TEK ADAYLI satırları eşler.
   *
   * ⚠️  Belirsiz kalan satır sayısı YANITTA DÖNER ve gizlenmez. "Otomatik
   *     eşleştirme tamamlandı" mesajı, geride 12 eşleşmemiş satır kalmışken
   *     mutabakatın bittiği izlenimini verirdi.
   */
  async otomatikEslestir(
    ekstreId: string, principal: Principal,
  ): Promise<{
    readonly eslesen: number;
    readonly kalanEslesmeyen: number;
    readonly mutabikMi: boolean;
  }> {
    const baglam = mevcutBaglamiZorunluKil('banka.otomatikEslestir');
    const ayar = await this.ayariOku(principal);

    const eslesenIdler = await this.prisma.tenantIslemi(async (tx) => {
      const veri = await this.eslestirmeVerisiIslemde(tx, ekstreId, principal);
      // Bir hareket yalnızca BİR satırla eşleşebilir; döngü içinde kullanılan
      // adaylar işaretlenir. İşaretlenmeseydi aynı hareket birden çok satıra
      // atanır ve veritabanı tekillik index'i işlemi ortada kestirirdi.
      const kullanilan = new Set<string>();
      const yazilanlar: { satirId: string; hareketId: string; yontem: string }[] = [];

      for (const s of veri.satirlar) {
        const adaylar = veri.adaylar.map((a) =>
          kullanilan.has(a.hareketId) ? { ...a, esleshmisMi: true } : a,
        );
        const sonuc = eslestirmeAdayiBul(s.domain, adaylar, ayar);
        if (sonuc === null) continue;

        kullanilan.add(sonuc.hareketId);
        await tx.ekstreSatiri.update({
          where: { id: s.id },
          data: {
            mutabakatDurumu: 'ESLESTI',
            eslesenHareketId: sonuc.hareketId,
            eslestirenKullanici: principal.id,
            eslesmeAni: new Date(),
          },
        });
        yazilanlar.push({
          satirId: s.id, hareketId: sonuc.hareketId, yontem: sonuc.yontem,
        });
      }

      if (yazilanlar.length > 0) {
        await this.audit.yaz(tx, {
          tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
          varlik: 'BankaEkstresi', varlikId: ekstreId,
          sonrakiDeger: {
            islem: 'OTOMATIK_ESLESTIRME',
            eslesenSayisi: yazilanlar.length,
            eslesmeler: yazilanlar,
            toleransKurus: ayar.toleransKurus,
            gunPenceresi: ayar.gunPenceresi,
          },
          correlationId: baglam.correlationId,
          ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
        });
      }

      return yazilanlar.length;
    }, principal.tenantId);

    const sonrasi = await this.mutabakat(ekstreId, principal);
    return {
      eslesen: eslesenIdler,
      kalanEslesmeyen: sonrasi.eslesmeyenSayisi,
      mutabikMi: sonrasi.mutabikMi,
    };
  }

  /** Elle eşleştirme — kullanıcının seçtiği hareket. */
  async eslestir(
    satirId: string, dto: EslestirDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.eslestir');
    const ayar = await this.ayariOku(principal);

    return this.prisma.tenantIslemi(async (tx) => {
      const satir = await tx.ekstreSatiri.findFirst({
        where: { id: satirId, tenantId: principal.tenantId },
        select: {
          id: true, islemTarihi: true, yon: true, tutar: true,
          referansNo: true, mutabakatDurumu: true, eslesenHareketId: true,
          ekstre: { select: { id: true, bankaHesabiId: true } },
        },
      });
      if (!satir) throw new KayitBulunamadi(`Ekstre satırı bulunamadı: ${satirId}`);

      const hareket = await tx.bankaHareketi.findFirst({
        where: { id: dto.hareketId, tenantId: principal.tenantId },
        select: {
          id: true, bankaHesabiId: true, yon: true, tutar: true,
          islemTarihi: true, referansNo: true, aciklama: true,
          _count: { select: { eslesenSatirlar: true } },
        },
      });
      if (!hareket) {
        throw new KayitBulunamadi(`Banka hareketi bulunamadı: ${dto.hareketId}`);
      }

      // BAŞKA HESABIN hareketi eşleştirilemez: iki hesabın mutabakatı
      // birbirine karışır ve ikisi de yanlış çıkar.
      if (hareket.bankaHesabiId !== satir.ekstre.bankaHesabiId) {
        throw new IsKuraliIhlali(
          'Hareket, ekstrenin hesabına ait değil.',
          'Farklı hesapların hareketleri eşleştirilirse iki hesabın da ' +
            'mutabakatı bozulur.',
        );
      }

      eslestirmeyiDogrula(
        {
          id: satir.id, islemTarihi: gun(satir.islemTarihi), yon: satir.yon,
          tutar: money(satir.tutar.toFixed(4)), referansNo: satir.referansNo,
          mutabakatDurumu: satir.mutabakatDurumu,
          eslesenHareketId: satir.eslesenHareketId,
        },
        {
          hareketId: hareket.id, yon: hareket.yon,
          tutar: money(hareket.tutar.toFixed(4)),
          islemTarihi: gun(hareket.islemTarihi),
          referansNo: hareket.referansNo,
          esleshmisMi: hareket._count.eslesenSatirlar > 0,
        },
        ayar,
      );

      await tx.ekstreSatiri.update({
        where: { id: satirId },
        data: {
          mutabakatDurumu: 'ESLESTI',
          eslesenHareketId: dto.hareketId,
          eslestirenKullanici: principal.id,
          eslesmeAni: new Date(),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'EkstreSatiri', varlikId: satirId,
        oncekiDeger: { mutabakatDurumu: satir.mutabakatDurumu },
        sonrakiDeger: {
          mutabakatDurumu: 'ESLESTI', eslesenHareketId: dto.hareketId,
          yontem: 'ELLE', hareketAciklamasi: hareket.aciklama,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: satirId, durum: 'ESLESTI' };
    });
  }

  /**
   * Eşleşmeyi kaldırır.
   *
   * Yanlış eşleştirmenin düzeltme yolu budur; eşleşme "üzerine yazılarak"
   * değiştirilmez çünkü o zaman hangi hareketin serbest kaldığı denetim
   * izinde görünmezdi.
   */
  async eslesmeyiKaldir(
    satirId: string, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.eslesmeyiKaldir');

    return this.prisma.tenantIslemi(async (tx) => {
      const satir = await tx.ekstreSatiri.findFirst({
        where: { id: satirId, tenantId: principal.tenantId },
        select: {
          id: true, mutabakatDurumu: true, eslesenHareketId: true,
          farkGerekcesi: true,
        },
      });
      if (!satir) throw new KayitBulunamadi(`Ekstre satırı bulunamadı: ${satirId}`);
      if (satir.mutabakatDurumu === 'ESLESMEDI') {
        throw new IsKuraliIhlali(
          'Bu satır zaten eşleşmemiş durumda.',
          'İşlem tekrarlanmaz.',
        );
      }

      await tx.ekstreSatiri.update({
        where: { id: satirId },
        data: {
          mutabakatDurumu: 'ESLESMEDI',
          eslesenHareketId: null,
          eslestirenKullanici: null,
          eslesmeAni: null,
          // Fark gerekçesi de temizlenir: eski gerekçe yeni duruma ait değildir
          // ve kalırsa denetimde açıklanamayan bir metin olur.
          farkGerekcesi: null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'EkstreSatiri', varlikId: satirId,
        oncekiDeger: {
          mutabakatDurumu: satir.mutabakatDurumu,
          eslesenHareketId: satir.eslesenHareketId,
          farkGerekcesi: satir.farkGerekcesi,
        },
        sonrakiDeger: { mutabakatDurumu: 'ESLESMEDI', eslesenHareketId: null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: satirId, durum: 'ESLESMEDI' };
    });
  }

  /**
   * FARK KABUL — eşleşmeyen satırı gerekçeyle kapatır.
   *
   * ⚠️  GEREKÇE ZORUNLUDUR (veritabanı CHECK ile de zorlanır). Bir farkı
   *     "kabul edildi" diye kapatmak, gerekçesi yazılmazsa denetimde
   *     açıklanamaz. Bu yüzden FARK_KABUL satırları özetle AYRI SAYILIR ve
   *     eşleşmiş satırların içine karıştırılmaz.
   */
  async farkKabul(
    satirId: string, dto: FarkKabulDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('banka.farkKabul');

    return this.prisma.tenantIslemi(async (tx) => {
      const satir = await tx.ekstreSatiri.findFirst({
        where: { id: satirId, tenantId: principal.tenantId },
        select: {
          id: true, mutabakatDurumu: true, tutar: true, aciklama: true,
        },
      });
      if (!satir) throw new KayitBulunamadi(`Ekstre satırı bulunamadı: ${satirId}`);
      if (satir.mutabakatDurumu === 'ESLESTI') {
        throw new IsKuraliIhlali(
          'Bu satır bir hareketle eşleşmiş; fark kabulü uygulanamaz.',
          'Fark kabulü YALNIZCA karşılığı bulunmayan satırlar için vardır. ' +
            'Eşleşme yanlışsa önce eşleşmeyi kaldırın.',
        );
      }

      await tx.ekstreSatiri.update({
        where: { id: satirId },
        data: {
          mutabakatDurumu: 'FARK_KABUL',
          farkGerekcesi: dto.gerekce.trim(),
          eslestirenKullanici: principal.id,
          eslesmeAni: new Date(),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'EkstreSatiri', varlikId: satirId,
        oncekiDeger: { mutabakatDurumu: satir.mutabakatDurumu },
        sonrakiDeger: {
          mutabakatDurumu: 'FARK_KABUL',
          tutar: satir.tutar.toFixed(4),
          satirAciklamasi: satir.aciklama,
        },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: satirId, durum: 'FARK_KABUL' };
    });
  }

  /* ------------------------------ Yardımcılar ---------------------------- */

  private async eslestirmeVerisi(
    ekstreId: string, principal: Principal,
  ): Promise<EslestirmeVerisi> {
    return this.prisma.tenantIslemi(
      (tx) => this.eslestirmeVerisiIslemde(tx, ekstreId, principal),
      principal.tenantId,
    );
  }

  /**
   * Eşleştirme için satırları ve aday hareketleri okur.
   *
   * Aday havuzu ekstrenin tarih aralığından PENCERE KADAR GENİŞ alınır: banka
   * valörü yüzünden bir hareket ekstrede birkaç gün kayarak görünebilir. Dar
   * alınsaydı gerçek eşleşme aday listesine hiç girmezdi.
   */
  private async eslestirmeVerisiIslemde(
    tx: Prisma.TransactionClient, ekstreId: string, principal: Principal,
  ): Promise<EslestirmeVerisi> {
    const ekstre = await tx.bankaEkstresi.findFirst({
      where: { id: ekstreId, tenantId: principal.tenantId },
      select: {
        id: true, bankaHesabiId: true, baslangic: true, bitis: true,
        satirlar: {
          where: { mutabakatDurumu: 'ESLESMEDI' },
          orderBy: [{ islemTarihi: 'asc' }],
          select: {
            id: true, islemTarihi: true, yon: true, tutar: true,
            aciklama: true, referansNo: true, mutabakatDurumu: true,
            eslesenHareketId: true,
          },
        },
      },
    });
    if (!ekstre) throw new KayitBulunamadi(`Ekstre bulunamadı: ${ekstreId}`);

    const p = await tx.bankaParametresi.findFirst({
      where: { tenantId: principal.tenantId },
      select: { mutabakatGunPenceresi: true },
    });
    const pencere = p?.mutabakatGunPenceresi ?? 3;
    const alt = new Date(ekstre.baslangic);
    alt.setUTCDate(alt.getUTCDate() - pencere);
    const ust = new Date(ekstre.bitis);
    ust.setUTCDate(ust.getUTCDate() + pencere);

    const hareketler = await tx.bankaHareketi.findMany({
      where: {
        tenantId: principal.tenantId,
        bankaHesabiId: ekstre.bankaHesabiId,
        islemTarihi: { gte: alt, lte: ust },
      },
      select: {
        id: true, yon: true, tutar: true, islemTarihi: true,
        referansNo: true, aciklama: true,
        _count: { select: { eslesenSatirlar: true } },
      },
    });

    const adaylar: EslestirmeAdayi[] = hareketler.map((h) => ({
      hareketId: h.id,
      yon: h.yon,
      tutar: money(h.tutar.toFixed(4)),
      islemTarihi: gun(h.islemTarihi),
      referansNo: h.referansNo,
      esleshmisMi: h._count.eslesenSatirlar > 0,
    }));

    return {
      adaylar,
      adayHaritasi: new Map(hareketler.map((h) => [h.id, { aciklama: h.aciklama }])),
      satirlar: ekstre.satirlar.map((s) => ({
        id: s.id,
        aciklama: s.aciklama,
        tutarMetni: s.tutar.toFixed(4),
        domain: {
          id: s.id,
          islemTarihi: gun(s.islemTarihi),
          yon: s.yon,
          tutar: money(s.tutar.toFixed(4)),
          referansNo: s.referansNo,
          mutabakatDurumu: s.mutabakatDurumu,
          eslesenHareketId: s.eslesenHareketId,
        },
      })),
    };
  }
}

interface EslestirmeVerisi {
  readonly adaylar: readonly EslestirmeAdayi[];
  readonly adayHaritasi: ReadonlyMap<string, { readonly aciklama: string }>;
  readonly satirlar: readonly {
    readonly id: string;
    readonly aciklama: string;
    readonly tutarMetni: string;
    readonly domain: Parameters<typeof eslestirmeAdayiBul>[0];
  }[];
}
