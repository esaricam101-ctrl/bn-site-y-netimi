import { Injectable } from '@nestjs/common';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, type Principal,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { tarihtekiIliskiler, type BolumIliskisi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface KiraciSatiri {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly baslangic: string;
  readonly bitis: string | null;
  readonly sozlesmeNo: string | null;
  readonly sozlesmeTarihi: string | null;
  /** Para metin olarak döner — float'a çevrilmez (BFS v1 §11). */
  readonly depozito: string | null;
  readonly depozitoIadeTarihi: string | null;
  readonly tahliyeTarihi: string | null;
  readonly tahliyeGerekcesi: string | null;
  readonly gecerliMi: boolean;
}

@Injectable()
export class KiraciQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bölümün kira geçmişi. `tarih` verilirse yalnızca o gün geçerli sözleşme;
   * verilmezse TÜM tarihçe (tahliye edilmişler dâhil).
   */
  async listele(
    bolumId: string,
    principal: Principal,
    tarihMetni?: string,
  ): Promise<readonly KiraciSatiri[]> {
    const bolum = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findFirst({
      where: { id: bolumId, tenantId: principal.tenantId },
      select: { id: true },
    }), principal.tenantId);
    if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.kiraci.findMany({
      where: { tenantId: principal.tenantId, bolumId },
      select: {
        id: true, kisiId: true, baslangic: true, bitis: true,
        sozlesmeNo: true, sozlesmeTarihi: true,
        depozito: true, depozitoIadeTarihi: true,
        tahliyeTarihi: true, tahliyeGerekcesi: true,
        kisi: { select: { ad: true, soyad: true } },
      },
      orderBy: [{ baslangic: 'asc' }, { id: 'asc' }],
    }), principal.tenantId);

    const tarih = tarihMetni === undefined ? null : takvimTarihi(tarihMetni);

    return kayitlar
      .map((k) => {
        const iliski: BolumIliskisi = {
          kisiId: k.kisiId,
          rol: 'KIRACI',
          baslangic: takvimTarihiniOku(k.baslangic),
          bitis: takvimTarihiniOkuVeyaNull(k.bitis),
        };
        // Gecerlilik olcutu domain'de tanimlidir ve burada TEKRARLANMAZ.
        const gecerliMi =
          tarih === null
            ? k.tahliyeTarihi === null && iliski.bitis === null
            : tarihtekiIliskiler([iliski], tarih).length > 0;
        return { kayit: k, iliski, gecerliMi };
      })
      .filter((x) => tarih === null || x.gecerliMi)
      .map(({ kayit, iliski, gecerliMi }) => ({
        id: kayit.id,
        kisiId: kayit.kisiId,
        kisiAdi: `${kayit.kisi.ad} ${kayit.kisi.soyad}`,
        baslangic: iliski.baslangic,
        bitis: iliski.bitis,
        sozlesmeNo: kayit.sozlesmeNo,
        sozlesmeTarihi: takvimTarihiniOkuVeyaNull(kayit.sozlesmeTarihi),
        depozito: kayit.depozito === null ? null : kayit.depozito.toFixed(4),
        depozitoIadeTarihi: takvimTarihiniOkuVeyaNull(kayit.depozitoIadeTarihi),
        tahliyeTarihi: takvimTarihiniOkuVeyaNull(kayit.tahliyeTarihi),
        tahliyeGerekcesi: kayit.tahliyeGerekcesi,
        gecerliMi,
      }));
  }
}
