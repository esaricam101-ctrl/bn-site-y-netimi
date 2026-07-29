import { Injectable } from '@nestjs/common';
import { takvimTarihiniOku, takvimTarihiniOkuVeyaNull, type Principal } from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface KisiSatiri {
  readonly id: string;
  readonly ad: string;
  readonly soyad: string;
  readonly eposta: string | null;
}

export interface SayfaliSonuc<T> {
  readonly kayitlar: readonly T[];
  readonly sonrakiImlec: string | null;
}

/** Bir kişinin bir bölümle ilişkisi. Aynı kişi aynı bölümde üç rolde de olabilir. */
export interface KisiBolumIliskisi {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly blokAdi: string | null;
  readonly apartmanAdi: string | null;
  readonly rol: 'MALIK' | 'KIRACI' | 'SAKIN';
  /** MALIK için hisse oranı; diğerlerinde null. */
  readonly hisse: string | null;
  /** SAKIN için yakınlık derecesi; diğerlerinde null. */
  readonly yakinlikDerecesi: string | null;
  readonly baslangic: string;
  readonly bitis: string | null;
  readonly gecerliMi: boolean;
}

export interface KisiIliskiOzeti {
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly iliskiler: readonly KisiBolumIliskisi[];
}

@Injectable()
export class KisiQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor tabanlı sayfalama (BFS v1 §12).
   * Soft delete filtresi Prisma uzantısı tarafından MERKEZÎ uygulanır —
   * burada elle `silinmeTarihi: null` yazılmaz.
   */
  async listele(
    principal: Principal,
    imlec: string | undefined,
    limit: number,
  ): Promise<SayfaliSonuc<KisiSatiri>> {
    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.kisi.findMany({
      where: { tenantId: principal.tenantId },
      select: { id: true, ad: true, soyad: true, eposta: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(imlec ? { cursor: { id: imlec }, skip: 1 } : {}),
    }), principal.tenantId);

    const fazlaVar = kayitlar.length > limit;
    const sayfa = fazlaVar ? kayitlar.slice(0, limit) : kayitlar;
    const sonKayit = sayfa[sayfa.length - 1];

    return {
      kayitlar: sayfa,
      sonrakiImlec: fazlaVar && sonKayit ? sonKayit.id : null,
    };
  }

  /**
   * Kişinin tüm bölüm ilişkileri — malik · kiracı · sakin.
   *
   * Bölüm tarafından bakan görünümün (daire kartı) TERSİ: "bu kişi nerelerde
   * kayıtlı?" sorusunu cevaplar. Bir kişi taşındığında ya da KVKK talebi
   * geldiğinde hangi kayıtların etkilendiğini görmek için gerekir.
   *
   * Aynı kişi aynı bölümde üç rolde birden bulunabilir: oturan malik hem
   * MALIK hem SAKIN kaydı taşır. Bu yüzden roller ayrı satırlar olarak döner,
   * tek bir "rol" alanına indirgenmez.
   */
  async bolumIliskileri(kisiId: string, principal: Principal): Promise<KisiIliskiOzeti> {
    const kisi = await this.prisma.tenantIslemi((tx) => tx.kisi.findFirst({
      where: { id: kisiId, tenantId: principal.tenantId },
      select: { id: true, ad: true, soyad: true },
    }), principal.tenantId);
    if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${kisiId}`);

    const bolumSecimi = {
      select: {
        kapiNo: true,
        blok: { select: { ad: true, apartman: { select: { ad: true } } } },
      },
    } as const;

    const [malikler, kiracilar, sakinler] = await Promise.all([
      this.prisma.tenantIslemi((tx) => tx.malik.findMany({
        where: { tenantId: principal.tenantId, kisiId },
        select: {
          bolumId: true, hissePay: true, hissePayda: true,
          tapuBaslangic: true, tapuBitis: true, bolum: bolumSecimi,
        },
        orderBy: { tapuBaslangic: 'asc' },
      }), principal.tenantId),
      this.prisma.tenantIslemi((tx) => tx.kiraci.findMany({
        where: { tenantId: principal.tenantId, kisiId },
        select: { bolumId: true, baslangic: true, bitis: true, bolum: bolumSecimi },
        orderBy: { baslangic: 'asc' },
      }), principal.tenantId),
      this.prisma.tenantIslemi((tx) => tx.sakin.findMany({
        where: { tenantId: principal.tenantId, kisiId },
        select: {
          bolumId: true, yakinlikDerecesi: true, girisTarihi: true, cikisTarihi: true,
          bolum: bolumSecimi,
        },
        orderBy: { girisTarihi: 'asc' },
      }), principal.tenantId),
    ]);

    const konum = (b: { blok: { ad: string; apartman: { ad: string } } | null }) => ({
      blokAdi: b.blok?.ad ?? null,
      apartmanAdi: b.blok?.apartman.ad ?? null,
    });

    const iliskiler: KisiBolumIliskisi[] = [
      ...malikler.map((m) => ({
        bolumId: m.bolumId,
        kapiNo: m.bolum.kapiNo,
        ...konum(m.bolum),
        rol: 'MALIK' as const,
        hisse: `${m.hissePay}/${m.hissePayda}`,
        yakinlikDerecesi: null,
        baslangic: takvimTarihiniOku(m.tapuBaslangic),
        bitis: takvimTarihiniOkuVeyaNull(m.tapuBitis),
        gecerliMi: m.tapuBitis === null,
      })),
      ...kiracilar.map((k) => ({
        bolumId: k.bolumId,
        kapiNo: k.bolum.kapiNo,
        ...konum(k.bolum),
        rol: 'KIRACI' as const,
        hisse: null,
        yakinlikDerecesi: null,
        baslangic: takvimTarihiniOku(k.baslangic),
        bitis: takvimTarihiniOkuVeyaNull(k.bitis),
        gecerliMi: k.bitis === null,
      })),
      ...sakinler.map((s) => ({
        bolumId: s.bolumId,
        kapiNo: s.bolum.kapiNo,
        ...konum(s.bolum),
        rol: 'SAKIN' as const,
        hisse: null,
        yakinlikDerecesi: s.yakinlikDerecesi,
        baslangic: takvimTarihiniOku(s.girisTarihi),
        bitis: takvimTarihiniOkuVeyaNull(s.cikisTarihi),
        gecerliMi: s.cikisTarihi === null,
      })),
    ];

    return {
      kisiId: kisi.id,
      kisiAdi: `${kisi.ad} ${kisi.soyad}`,
      iliskiler,
    };
  }
}
