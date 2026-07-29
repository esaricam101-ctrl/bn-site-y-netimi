import { Injectable } from '@nestjs/common';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, type Principal,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import {
  BagimsizBolum, arsaPaylariniDogrula, hisseleriDogrula, tarihtekiMalikler,
} from '@bnos/apartman-domain';
import type { BolumDurumu, BolumNiteligi, MalikHissesi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { SayfaliSonuc } from '../kisi/kisi.query.service';

export interface BolumSatiri {
  readonly id: string;
  readonly kapiNo: string;
  readonly icKapiNo: string | null;
  readonly kat: number;
  readonly katId: string | null;
  /** Tapudaki hukuki vasıf. */
  readonly nitelik: string;
  readonly daireTipi: string | null;
  readonly kullanimAmaci: string | null;
  /** Fiili işletme durumu. */
  readonly durum: string;
  readonly brutM2: number;
  readonly netM2: number;
  /** Arsa payı metin olarak döner — BigInt JSON'a serileştirilemez. */
  readonly arsaPayi: string;
  readonly aidatMuafiyeti: boolean;
  readonly tapu: {
    readonly ada: string | null;
    readonly parsel: string | null;
    readonly pafta: string | null;
    readonly bagimsizBolumNo: string | null;
    readonly cilt: string | null;
    readonly sahife: string | null;
  };
}

/** Hiyerarşi ve durum süzgeçleri. Hepsi isteğe bağlıdır. */
export interface BolumSuzgeci {
  /** Blok üzerinden dolaylı süzer — bölümün doğrudan apartman referansı yoktur. */
  readonly apartmanId?: string;
  readonly blokId?: string;
  readonly katId?: string;
  readonly durum?: BolumDurumu;
  readonly nitelik?: BolumNiteligi;
}

/**
 * Hiyerarşi tutarsızlığı. Oluşturma anında kontrol edilen kurallar, MEVCUT
 * veride bozuk kalmış olabilir: kontroller sonradan eklendi ve migration
 * öncesi kayıtlar bu kapıdan geçmedi.
 */
export interface HiyerarsiSorunu {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly tur:
    | 'KAT_BLOK_UYUSMAZLIGI'
    | 'KAT_NO_UYUSMAZLIGI'
    | 'KATSIZ_BLOK'
    | 'BLOKSUZ_KAT'
    | 'HIYERARSI_DISI';
  readonly aciklama: string;
}

export interface HiyerarsiDenetimi {
  readonly saglam: boolean;
  readonly bolumSayisi: number;
  readonly sorunlar: readonly HiyerarsiSorunu[];
}

/** Tek bölümün yerleşim ve mülkiyet durumu — bina geneli özet satırı. */
export interface YerlesimSatiri {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly blokAdi: string | null;
  readonly kat: number;
  readonly durum: string;
  readonly malikSayisi: number;
  /** Hisse toplamı tamı ediyor mu (bugün itibarıyla). */
  readonly hisseTam: boolean;
  readonly kiraciVarMi: boolean;
  readonly sakinSayisi: number;
  /** Ne malik ne kiracı ne sakin — fiilen boş. */
  readonly bosMu: boolean;
}

export interface YerlesimOzeti {
  readonly bolumSayisi: number;
  readonly malikKaydiOlmayan: number;
  readonly hissesiEksikOlan: number;
  readonly kiracili: number;
  readonly bos: number;
  readonly satirlar: readonly YerlesimSatiri[];
}

/** Bina geneli hisse denetimi — tahakkuk öncesi kapı. */
export interface HisseDenetimSatiri {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly toplam: string;
  readonly mesaj: string;
}

export interface HisseDenetimi {
  readonly saglam: boolean;
  readonly tarih: string;
  readonly bolumSayisi: number;
  /** Yalnızca SORUNLU bölümler döner; sağlam olanlar listeye girmez. */
  readonly sorunlular: readonly HisseDenetimSatiri[];
}

export interface ArsaPayiRaporu {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
  readonly bolumSayisi: number;
  /**
   * Domain aggregate'i olarak yeniden kurulamayan kayıtlar. Boş değilse
   * `toplam` bu kayıtları İÇERMEZ ve tek başına güvenilmez.
   */
  readonly okunamayanBolumler: readonly string[];
}

@Injectable()
export class BolumQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor tabanlı sayfalama (BFS v1 §12).
   * Soft delete filtresi Prisma uzantısı tarafından MERKEZÎ uygulanır —
   * burada elle `silinmeTarihi: null` yazılmaz.
   *
   * HİYERARŞİ SÜZGEÇLERİ: `apartmanId` bloğun üzerinden dolaylı süzer —
   * bölümün doğrudan apartman referansı yoktur, hiyerarşi blok üzerinden kurulur.
   * Süzgeç olmadan bir bloğun bölümleri listelenemiyordu.
   */
  async listele(
    principal: Principal,
    imlec: string | undefined,
    limit: number,
    suzgec: BolumSuzgeci = {},
  ): Promise<SayfaliSonuc<BolumSatiri>> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findMany({
      where: {
        tenantId: principal.tenantId,
        ...(suzgec.blokId ? { blokId: suzgec.blokId } : {}),
        ...(suzgec.katId ? { katId: suzgec.katId } : {}),
        ...(suzgec.durum ? { durum: suzgec.durum } : {}),
        ...(suzgec.nitelik ? { nitelik: suzgec.nitelik } : {}),
        ...(suzgec.apartmanId ? { blok: { apartmanId: suzgec.apartmanId } } : {}),
      },
      select: {
        id: true, kapiNo: true, icKapiNo: true, kat: true, katId: true,
        nitelik: true, daireTipi: true, kullanimAmaci: true, durum: true,
        brutM2: true, netM2: true,
        arsaPayiPay: true, arsaPayiPayda: true, aidatMuafiyeti: true,
        tapuAda: true, tapuParsel: true, tapuPafta: true,
        tapuBagimsizBolumNo: true, tapuCilt: true, tapuSahife: true,
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(imlec ? { cursor: { id: imlec }, skip: 1 } : {}),
    }), principal.tenantId);

    const fazlaVar = kayitlar.length > limit;
    const sayfa = fazlaVar ? kayitlar.slice(0, limit) : kayitlar;
    const sonKayit = sayfa[sayfa.length - 1];

    return {
      kayitlar: sayfa.map((k) => ({
        id: k.id,
        kapiNo: k.kapiNo,
        icKapiNo: k.icKapiNo,
        kat: k.kat,
        katId: k.katId,
        nitelik: k.nitelik,
        daireTipi: k.daireTipi,
        kullanimAmaci: k.kullanimAmaci,
        durum: k.durum,
        brutM2: k.brutM2.toNumber(),
        netM2: k.netM2.toNumber(),
        arsaPayi: `${k.arsaPayiPay}/${k.arsaPayiPayda}`,
        aidatMuafiyeti: k.aidatMuafiyeti,
        tapu: {
          ada: k.tapuAda,
          parsel: k.tapuParsel,
          pafta: k.tapuPafta,
          bagimsizBolumNo: k.tapuBagimsizBolumNo,
          cilt: k.tapuCilt,
          sahife: k.tapuSahife,
        },
      })),
      sonrakiImlec: fazlaVar && sonKayit ? sonKayit.id : null,
    };
  }

  async detay(id: string, principal: Principal): Promise<BolumSatiri> {
    const k = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findFirst({
      where: { id, tenantId: principal.tenantId },
      select: {
        id: true, kapiNo: true, icKapiNo: true, kat: true, katId: true,
        nitelik: true, daireTipi: true, kullanimAmaci: true, durum: true,
        brutM2: true, netM2: true,
        arsaPayiPay: true, arsaPayiPayda: true, aidatMuafiyeti: true,
        tapuAda: true, tapuParsel: true, tapuPafta: true,
        tapuBagimsizBolumNo: true, tapuCilt: true, tapuSahife: true,
      },
    }), principal.tenantId);
    if (!k) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${id}`);

    return {
      id: k.id,
      kapiNo: k.kapiNo,
      icKapiNo: k.icKapiNo,
      kat: k.kat,
      katId: k.katId,
      nitelik: k.nitelik,
      daireTipi: k.daireTipi,
      kullanimAmaci: k.kullanimAmaci,
      durum: k.durum,
      brutM2: k.brutM2.toNumber(),
      netM2: k.netM2.toNumber(),
      arsaPayi: `${k.arsaPayiPay}/${k.arsaPayiPayda}`,
      aidatMuafiyeti: k.aidatMuafiyeti,
      tapu: {
        ada: k.tapuAda,
        parsel: k.tapuParsel,
        pafta: k.tapuPafta,
        bagimsizBolumNo: k.tapuBagimsizBolumNo,
        cilt: k.tapuCilt,
        sahife: k.tapuSahife,
      },
    };
  }

  /**
   * BİNA GENELİ hisse denetimi — tahakkuk öncesi kapı.
   *
   * `malikler/hisse-durumu` tek bölümü denetler; kırk daireli bir binada kırk
   * çağrı gerekirdi ve yönetici hangisinin eksik olduğunu göremezdi. Bu uç
   * yalnızca SORUNLU bölümleri döndürür — sağlam olanlar listeyi şişirmez.
   *
   * Hisse toplamı tamı etmeyen bir bölümde tahakkuk yapılamaz: eksikse payın
   * bir kısmı hiçbir kişiye yazılmaz, fazlaysa aynı tutar iki kez istenir.
   */
  async hisseDenetimi(principal: Principal, tarihMetni?: string): Promise<HisseDenetimi> {
    const tarih =
      tarihMetni === undefined ? takvimTarihiniOku(new Date()) : takvimTarihi(tarihMetni);

    const bolumler = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, kapiNo: true,
        malikler: {
          select: { kisiId: true, hissePay: true, hissePayda: true, tapuBaslangic: true, tapuBitis: true },
        },
      },
      orderBy: { kapiNo: 'asc' },
    }), principal.tenantId);

    const sorunlular: HisseDenetimSatiri[] = [];

    for (const b of bolumler) {
      const hisseler: MalikHissesi[] = b.malikler.map((m) => ({
        kisiId: m.kisiId,
        hissePay: m.hissePay,
        hissePayda: m.hissePayda,
        baslangic: takvimTarihiniOku(m.tapuBaslangic),
        bitis: takvimTarihiniOkuVeyaNull(m.tapuBitis),
      }));

      // Dogrulama domain'e aittir ve burada TEKRARLANMAZ.
      const sonuc = hisseleriDogrula(hisseler, tarih);
      if (!sonuc.gecerli) {
        sorunlular.push({
          bolumId: b.id, kapiNo: b.kapiNo,
          toplam: sonuc.toplam, mesaj: sonuc.mesaj,
        });
      }
    }

    return {
      saglam: sorunlular.length === 0,
      tarih,
      bolumSayisi: bolumler.length,
      sorunlular,
    };
  }

  /**
   * Bina geneli yerleşim özeti — kim oturuyor, hangi daire boş.
   *
   * Yönetim ekranının ana tablosudur: her bölüm için malik sayısı, hisse
   * tamlığı, kira durumu ve sakin sayısı tek sorguda gelir. Daire kartını
   * bölüm bölüm çağırmak kırk daire için kırk istek demektir.
   *
   * `bosMu`: ne malik ne kiracı ne sakin kaydı var. Malik kaydı olmayan bir
   * bölüm tahakkuka giremez; bu yüzden ayrıca sayılır.
   */
  async yerlesimOzeti(principal: Principal, tarihMetni?: string): Promise<YerlesimOzeti> {
    const tarih =
      tarihMetni === undefined ? takvimTarihiniOku(new Date()) : takvimTarihi(tarihMetni);

    const bolumler = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, kapiNo: true, kat: true, durum: true,
        blok: { select: { ad: true } },
        malikler: {
          select: { kisiId: true, hissePay: true, hissePayda: true, tapuBaslangic: true, tapuBitis: true },
        },
        kiracilar: { select: { baslangic: true, bitis: true } },
        sakinler: { select: { girisTarihi: true, cikisTarihi: true } },
      },
      orderBy: [{ kat: 'asc' }, { kapiNo: 'asc' }],
    }), principal.tenantId);

    const satirlar: YerlesimSatiri[] = bolumler.map((b) => {
      const hisseler: MalikHissesi[] = b.malikler.map((m) => ({
        kisiId: m.kisiId,
        hissePay: m.hissePay,
        hissePayda: m.hissePayda,
        baslangic: takvimTarihiniOku(m.tapuBaslangic),
        bitis: takvimTarihiniOkuVeyaNull(m.tapuBitis),
      }));
      const gecerliMalikler = tarihtekiMalikler(hisseler, tarih);

      const kiraciVarMi = b.kiracilar.some((k) => {
        const bas = takvimTarihiniOku(k.baslangic);
        const bit = takvimTarihiniOkuVeyaNull(k.bitis);
        return bas <= tarih && (bit === null || bit >= tarih);
      });

      const sakinSayisi = b.sakinler.filter((s) => {
        const giris = takvimTarihiniOku(s.girisTarihi);
        const cikis = takvimTarihiniOkuVeyaNull(s.cikisTarihi);
        return giris <= tarih && (cikis === null || cikis >= tarih);
      }).length;

      return {
        bolumId: b.id,
        kapiNo: b.kapiNo,
        blokAdi: b.blok?.ad ?? null,
        kat: b.kat,
        durum: b.durum,
        malikSayisi: gecerliMalikler.length,
        hisseTam: hisseleriDogrula(hisseler, tarih).gecerli,
        kiraciVarMi,
        sakinSayisi,
        bosMu: gecerliMalikler.length === 0 && !kiraciVarMi && sakinSayisi === 0,
      };
    });

    return {
      bolumSayisi: satirlar.length,
      malikKaydiOlmayan: satirlar.filter((s) => s.malikSayisi === 0).length,
      hissesiEksikOlan: satirlar.filter((s) => !s.hisseTam).length,
      kiracili: satirlar.filter((s) => s.kiraciVarMi).length,
      bos: satirlar.filter((s) => s.bosMu).length,
      satirlar,
    };
  }

  /**
   * Hiyerarşiyi uçtan uca denetler: Apartman → Blok → Kat → Bölüm.
   *
   * Oluşturma anında zorlanan kurallar MEVCUT veride bozuk kalmış olabilir —
   * kontroller sonradan eklendi ve daha önce yazılmış kayıtlar bu kapıdan
   * geçmedi. Bu uç, verinin bugünkü hâlini denetler:
   *
   *   KAT_BLOK_UYUSMAZLIGI  bölümün katı, bölümün bloğuna ait değil
   *   KAT_NO_UYUSMAZLIGI    bölümün `kat` sayısı, kat kaydının `no`suyla farklı
   *   KATSIZ_BLOK           bloğu var, katı yok (hiyerarşi yarım)
   *   BLOKSUZ_KAT           katı var, bloğu yok (tutarsız)
   *   HIYERARSI_DISI        ne bloğu ne katı var
   *
   * Yalnızca rapor üretir; veriyi DÜZELTMEZ. Toplu düzeltme ayrı bir akıştır
   * ve yönetici onayı gerektirir.
   */
  async hiyerarsiDenetimi(principal: Principal): Promise<HiyerarsiDenetimi> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, kapiNo: true, kat: true, blokId: true, katId: true,
        katKaydi: { select: { id: true, no: true, blokId: true } },
      },
      orderBy: { kapiNo: 'asc' },
    }), principal.tenantId);

    const sorunlar: HiyerarsiSorunu[] = [];

    for (const b of kayitlar) {
      const temel = { bolumId: b.id, kapiNo: b.kapiNo };

      if (b.blokId === null && b.katId === null) {
        sorunlar.push({
          ...temel, tur: 'HIYERARSI_DISI',
          aciklama: 'Bölüm hiçbir bloğa ve kata bağlı değil; hiyerarşide yer almıyor.',
        });
        continue;
      }

      if (b.blokId === null && b.katId !== null) {
        sorunlar.push({
          ...temel, tur: 'BLOKSUZ_KAT',
          aciklama: 'Bölümün katı var ama bloğu yok; kat bir bloğa aittir, bu tutarsızdır.',
        });
      }

      if (b.blokId !== null && b.katId === null) {
        sorunlar.push({
          ...temel, tur: 'KATSIZ_BLOK',
          aciklama: 'Bölüm bir bloğa bağlı ama kat kaydı yok; hiyerarşi yarım kalmış.',
        });
      }

      if (b.katKaydi !== null) {
        if (b.blokId !== null && b.katKaydi.blokId !== b.blokId) {
          sorunlar.push({
            ...temel, tur: 'KAT_BLOK_UYUSMAZLIGI',
            aciklama:
              `Bölümün katı başka bir bloğa ait (kat bloğu: ${b.katKaydi.blokId}, ` +
              `bölüm bloğu: ${b.blokId}).`,
          });
        }
        if (b.katKaydi.no !== b.kat) {
          sorunlar.push({
            ...temel, tur: 'KAT_NO_UYUSMAZLIGI',
            aciklama:
              `Bölümün kat sayısı (${b.kat}) kat kaydının numarasıyla ` +
              `(${b.katKaydi.no}) uyuşmuyor.`,
          });
        }
      }
    }

    return {
      saglam: sorunlar.length === 0,
      bolumSayisi: kayitlar.length,
      sorunlar,
    };
  }

  /**
   * KMK md. 3 — arsa paylarının toplamı tamı etmelidir.
   *
   * Bu kural `apartman-domain` içinde tanımlı ve birim testliydi ancak hiçbir
   * uygulama kodu çağırmıyordu: kural belgede ve testte vardı, çalışan sistemde
   * yoktu. Toplam 1'den sapıyorsa yönetim planı hatalıdır ve tahakkuk
   * çalıştırılmamalıdır.
   *
   * Ağırlık aritmetiği domain'e bırakılır; burada tekrarlanmaz.
   */
  async arsaPayiDurumu(principal: Principal): Promise<ArsaPayiRaporu> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, kapiNo: true, icKapiNo: true, kat: true, katId: true,
        nitelik: true, daireTipi: true, kullanimAmaci: true, durum: true,
        brutM2: true, netM2: true,
        arsaPayiPay: true, arsaPayiPayda: true, aidatMuafiyeti: true,
        tapuAda: true, tapuParsel: true, tapuPafta: true,
        tapuBagimsizBolumNo: true, tapuCilt: true, tapuSahife: true,
      },
    }), principal.tenantId);

    const bolumler: BagimsizBolum[] = [];
    const okunamayanBolumler: string[] = [];

    for (const k of kayitlar) {
      try {
        bolumler.push(
          BagimsizBolum.olustur({
            id: k.id,
            tenantId: principal.tenantId,
            blokId: null,
            katId: null,
            kapiNo: k.kapiNo,
            icKapiNo: null,
            kat: k.kat,
            nitelik: k.nitelik,
            daireTipi: null,
            kullanimAmaci: null,
            durum: k.durum,
            brutM2: k.brutM2.toNumber(),
            netM2: k.netM2.toNumber(),
            arsaPayiPay: k.arsaPayiPay,
            arsaPayiPayda: k.arsaPayiPayda,
            aidatMuafiyeti: k.aidatMuafiyeti,
            tapu: {
              ada: null, parsel: null, pafta: null,
              bagimsizBolumNo: null, cilt: null, sahife: null,
            },
          }),
        );
      } catch {
        // Sessizce atlamak toplami YANLIS gosterirdi; kayit acikca raporlanir.
        okunamayanBolumler.push(k.kapiNo);
      }
    }

    const sonuc = arsaPaylariniDogrula(bolumler);

    return {
      gecerli: sonuc.gecerli && okunamayanBolumler.length === 0,
      toplam: sonuc.toplam,
      mesaj:
        okunamayanBolumler.length > 0
          ? `${sonuc.mesaj} AYRICA ${okunamayanBolumler.length} bölüm kaydı geçerli bir ` +
            'bağımsız bölüm olarak okunamadı; yukarıdaki toplam bu kayıtları içermez.'
          : sonuc.mesaj,
      bolumSayisi: bolumler.length,
      okunamayanBolumler,
    };
  }
}
