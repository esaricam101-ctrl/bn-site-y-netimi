/**
 * Tahakkuk / borç Query servisi.
 *
 * SORUMLULUK YENİDEN HESAPLANMAZ. Borç yazıldığı anda kimin sorumlu olduğu
 * çözülüp `borc_sorumlusu` satırlarına yazılmıştır (snapshot). Sorgu tarafı
 * bunu OKUR; yeniden çözseydi, kiracı taşındığında geçmiş borçlar sessizce
 * el değiştirirdi.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface BorcSorumlusuSatiri {
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly rol: string;
  readonly sira: string;
  readonly pay: string;
  readonly odenen: string;
  readonly kapandiMi: boolean;
}

export interface BorcSatiri {
  readonly id: string;
  readonly tahakkukNo: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly giderTuruKodu: string;
  readonly tutar: string;
  readonly odenen: string;
  readonly kalan: string;
  readonly vadeTarihi: string;
  readonly tahakkukDonemi: string;
  readonly kapandiMi: boolean;
  /** Vadesi geçmiş ve kapanmamış — gecikme tazminatı bundan hesaplanır. */
  readonly gecikmisMi: boolean;
  readonly sorumlular: readonly BorcSorumlusuSatiri[];
}

export interface DonemOzeti {
  readonly donem: string;
  readonly giderTuruKodu: string;
  readonly borcSayisi: number;
  readonly toplamTutar: string;
  readonly toplamOdenen: string;
  readonly tahsilatOrani: number;
}

function gun(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class TahakkukQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async borclar(
    principal: Principal,
    suzgec: { readonly bolumId?: string; readonly donem?: string; readonly acikMi?: boolean } = {},
  ): Promise<readonly BorcSatiri[]> {
    const bugun = new Date().toISOString().slice(0, 10);

    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.borc.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.bolumId ? { bolumId: suzgec.bolumId } : {}),
            ...(suzgec.donem ? { tahakkukDonemi: new Date(suzgec.donem) } : {}),
            ...(suzgec.acikMi === true ? { kapandiMi: false } : {}),
          },
          select: {
            id: true, tahakkukNo: true, bolumId: true, giderTuruKodu: true,
            tutar: true, odenen: true, vadeTarihi: true, tahakkukDonemi: true,
            kapandiMi: true,
            bolum: { select: { kapiNo: true } },
            sorumlular: {
              select: {
                kisiId: true, rol: true, sira: true, pay: true, odenen: true,
                kapandiMi: true,
                kisi: { select: { ad: true, soyad: true } },
              },
              orderBy: { sira: 'asc' },
            },
          },
          orderBy: [{ tahakkukDonemi: 'desc' }, { tahakkukNo: 'asc' }],
        }),
      principal.tenantId,
    );

    return kayitlar.map((b) => {
      const vade = gun(b.vadeTarihi);
      return {
        id: b.id,
        tahakkukNo: b.tahakkukNo,
        bolumId: b.bolumId,
        kapiNo: b.bolum.kapiNo,
        giderTuruKodu: b.giderTuruKodu,
        tutar: b.tutar.toFixed(2),
        odenen: b.odenen.toFixed(2),
        kalan: b.tutar.sub(b.odenen).toFixed(2),
        vadeTarihi: vade,
        tahakkukDonemi: gun(b.tahakkukDonemi),
        kapandiMi: b.kapandiMi,
        // Tarih karşılaştırması YYYY-MM-DD üzerinde yapılır: `Date` nesnesi
        // saat dilimi sınırında bir gün kaydırır ve vadesi bugün olan borç
        // gecikmiş görünür (BFS v1 §4.1).
        gecikmisMi: !b.kapandiMi && vade < bugun,
        sorumlular: b.sorumlular.map((s) => ({
          kisiId: s.kisiId,
          kisiAdi: `${s.kisi.ad} ${s.kisi.soyad}`,
          rol: s.rol,
          sira: s.sira,
          pay: s.pay.toFixed(2),
          odenen: s.odenen.toFixed(2),
          kapandiMi: s.kapandiMi,
        })),
      };
    });
  }

  /**
   * Dönem bazlı özet — tahsilat oranı buradan okunur.
   *
   * Oran YÜZDE olarak DEĞİL, oran olarak döner (0–1); biçimlendirme
   * arayüzün işidir ve yerel ayara bağlıdır.
   */
  async donemOzetleri(principal: Principal): Promise<readonly DonemOzeti[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.borc.groupBy({
          by: ['tahakkukDonemi', 'giderTuruKodu'],
          where: { tenantId: principal.tenantId },
          _count: { id: true },
          _sum: { tutar: true, odenen: true },
          orderBy: { tahakkukDonemi: 'desc' },
        }),
      principal.tenantId,
    );

    return kayitlar.map((k) => {
      const tutar = k._sum.tutar ?? null;
      const odenen = k._sum.odenen ?? null;
      const tutarSayi = tutar === null ? 0 : Number(tutar.toFixed(2));
      const odenenSayi = odenen === null ? 0 : Number(odenen.toFixed(2));
      return {
        donem: gun(k.tahakkukDonemi),
        giderTuruKodu: k.giderTuruKodu,
        borcSayisi: k._count.id,
        toplamTutar: tutar === null ? '0.00' : tutar.toFixed(2),
        toplamOdenen: odenen === null ? '0.00' : odenen.toFixed(2),
        // Sıfıra bölme: hiç borç yazılmamış dönemde oran 0'dır, NaN değil.
        tahsilatOrani: tutarSayi === 0 ? 0 : odenenSayi / tutarSayi,
      };
    });
  }
}
