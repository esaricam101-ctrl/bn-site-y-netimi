import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { BagimsizBolum, arsaPaylariniDogrula } from '@bnos/apartman-domain';
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
   */
  async listele(
    principal: Principal,
    imlec: string | undefined,
    limit: number,
  ): Promise<SayfaliSonuc<BolumSatiri>> {
    const kayitlar = await this.prisma.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId },
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
    });

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
    const kayitlar = await this.prisma.bagimsizBolum.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, kapiNo: true, icKapiNo: true, kat: true, katId: true,
        nitelik: true, daireTipi: true, kullanimAmaci: true, durum: true,
        brutM2: true, netM2: true,
        arsaPayiPay: true, arsaPayiPayda: true, aidatMuafiyeti: true,
        tapuAda: true, tapuParsel: true, tapuPafta: true,
        tapuBagimsizBolumNo: true, tapuCilt: true, tapuSahife: true,
      },
    });

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
