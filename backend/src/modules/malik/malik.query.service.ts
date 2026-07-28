import { Injectable } from '@nestjs/common';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, type Principal,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { hisseleriDogrula, tarihtekiMalikler, type MalikHissesi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MalikSatiri {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  /** Hisse metin olarak döner — BigInt JSON'a serileştirilemez. */
  readonly hisse: string;
  readonly tapuTuru: string;
  readonly tapuBaslangic: string;
  readonly tapuBitis: string | null;
  readonly tapuYevmiyeNo: string | null;
  readonly vekilKisiId: string | null;
  readonly vekilAdi: string | null;
  readonly vekaletnameNo: string | null;
  readonly vekaletBitisTarihi: string | null;
  /** Sorgu tarihinde geçerli mi. `tarih` verilmediyse bugüne göre. */
  readonly gecerliMi: boolean;
}

export interface HisseRaporu {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
  readonly tarih: string;
  readonly malikSayisi: number;
}

@Injectable()
export class MalikQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private async bolumuZorunluKil(bolumId: string, principal: Principal): Promise<void> {
    const bolum = await this.prisma.bagimsizBolum.findFirst({
      where: { id: bolumId, tenantId: principal.tenantId },
      select: { id: true },
    });
    if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);
  }

  private async hisseleriGetir(
    bolumId: string,
    principal: Principal,
  ): Promise<readonly MalikHissesi[]> {
    const kayitlar = await this.prisma.malik.findMany({
      where: { tenantId: principal.tenantId, bolumId },
      select: { kisiId: true, hissePay: true, hissePayda: true, tapuBaslangic: true, tapuBitis: true },
    });
    return kayitlar.map((m) => ({
      kisiId: m.kisiId,
      hissePay: m.hissePay,
      hissePayda: m.hissePayda,
      baslangic: takvimTarihiniOku(m.tapuBaslangic),
      bitis: takvimTarihiniOkuVeyaNull(m.tapuBitis),
    }));
  }

  /**
   * Bölümün malikleri. `tarih` verilirse yalnızca o gün geçerli olanlar;
   * verilmezse TÜM tarihçe (geçmiş malikler `gecerliMi: false` ile).
   *
   * Geçerlilik ölçütü domain'e (`tarihtekiMalikler`) bırakılır — borç
   * çözümlemesi de aynı fonksiyonu kullanır; iki yerde yazılırsa biri eskir.
   */
  async listele(
    bolumId: string,
    principal: Principal,
    tarihMetni?: string,
  ): Promise<readonly MalikSatiri[]> {
    await this.bolumuZorunluKil(bolumId, principal);

    const kayitlar = await this.prisma.malik.findMany({
      where: { tenantId: principal.tenantId, bolumId },
      select: {
        id: true, kisiId: true, hissePay: true, hissePayda: true,
        tapuTuru: true, tapuBaslangic: true, tapuBitis: true, tapuYevmiyeNo: true,
        vekilKisiId: true, vekaletnameNo: true, vekaletBitisTarihi: true,
        kisi: { select: { ad: true, soyad: true } },
        vekil: { select: { ad: true, soyad: true } },
      },
      orderBy: [{ tapuBaslangic: 'asc' }, { id: 'asc' }],
    });

    const tarih = tarihMetni === undefined ? null : takvimTarihi(tarihMetni);

    return kayitlar
      .map((k) => {
        const hisse: MalikHissesi = {
          kisiId: k.kisiId,
          hissePay: k.hissePay,
          hissePayda: k.hissePayda,
          baslangic: takvimTarihiniOku(k.tapuBaslangic),
          bitis: takvimTarihiniOkuVeyaNull(k.tapuBitis),
        };
        const gecerliMi =
          tarih === null ? hisse.bitis === null : tarihtekiMalikler([hisse], tarih).length > 0;
        return { kayit: k, hisse, gecerliMi };
      })
      // `tarih` verildiyse yalnizca o gun gecerli olanlar dondurulur; aksi
      // halde TARIHCE korunur ve gecmis malikler de gorunur.
      .filter((x) => tarih === null || x.gecerliMi)
      .map(({ kayit, hisse, gecerliMi }) => ({
        id: kayit.id,
        kisiId: kayit.kisiId,
        kisiAdi: `${kayit.kisi.ad} ${kayit.kisi.soyad}`,
        hisse: `${kayit.hissePay}/${kayit.hissePayda}`,
        tapuTuru: kayit.tapuTuru,
        tapuBaslangic: hisse.baslangic,
        tapuBitis: hisse.bitis,
        tapuYevmiyeNo: kayit.tapuYevmiyeNo,
        vekilKisiId: kayit.vekilKisiId,
        vekilAdi: kayit.vekil ? `${kayit.vekil.ad} ${kayit.vekil.soyad}` : null,
        vekaletnameNo: kayit.vekaletnameNo,
        vekaletBitisTarihi: takvimTarihiniOkuVeyaNull(kayit.vekaletBitisTarihi),
        gecerliMi,
      }));
  }

  /**
   * Hisse toplamı tamı ediyor mu (verilen tarihte).
   *
   * Toplam 1'in ALTINDA olmak yazma anında engellenmez — malikler tek tek
   * girilirken bu doğaldır. Bu uç, tahakkuk öncesi kontrol noktasıdır:
   * eksik hisse, bölümün bir kısmının sahipsiz olması ve o payın hiçbir kişiye
   * tahakkuk etmemesi demektir.
   */
  async hisseDurumu(
    bolumId: string,
    principal: Principal,
    tarihMetni?: string,
  ): Promise<HisseRaporu> {
    await this.bolumuZorunluKil(bolumId, principal);

    const tarih =
      tarihMetni === undefined
        ? takvimTarihiniOku(new Date())
        : takvimTarihi(tarihMetni);

    const hisseler = await this.hisseleriGetir(bolumId, principal);
    const sonuc = hisseleriDogrula(hisseler, tarih);

    return {
      gecerli: sonuc.gecerli,
      toplam: sonuc.toplam,
      mesaj: sonuc.mesaj,
      tarih,
      malikSayisi: tarihtekiMalikler(hisseler, tarih).length,
    };
  }
}
