import { Injectable } from '@nestjs/common';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, type Principal,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SakinSatiri {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly eposta: string | null;
  readonly telefon: string | null;
  readonly yakinlikDerecesi: string;
  /** `DIGER` ise kullanıcının yazdığı ifade (Amcası · Bakıcısı…). */
  readonly yakinlikAciklamasi: string | null;
  /**
   * DAYANAK — sakin kimin yakını olarak oturuyor (0021).
   *
   * ⚠️  Bu alan LİSTEDE DÖNMEK ZORUNDA: "Ayşe Yılmaz · Eşi" satırı, kimin eşi
   *     olduğu yazılmazsa dört daireli bir katta hiçbir şey anlatmaz.
   */
  readonly dayanakTipi: 'MALIK' | 'KIRACI';
  readonly dayanakKisiAdi: string;
  readonly malikId: string | null;
  readonly kiraciId: string | null;
  readonly girisTarihi: string;
  readonly cikisTarihi: string | null;
  readonly acilDurumKisiAdi: string | null;
  readonly acilDurumTelefon: string | null;
  readonly gecerliMi: boolean;
}

@Injectable()
export class SakinQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bölümde oturanlar. `tarih` verilirse o gün oturanlar; verilmezse TÜM
   * yerleşim tarihçesi (çıkmış sakinler dâhil).
   *
   * Bir bölümde aynı anda birden çok sakin geçerlidir — tekillik kuralı yoktur.
   */
  async listele(
    bolumId: string,
    principal: Principal,
    tarihMetni?: string,
  ): Promise<readonly SakinSatiri[]> {
    const bolum = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findFirst({
      where: { id: bolumId, tenantId: principal.tenantId },
      select: { id: true },
    }), principal.tenantId);
    if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.sakin.findMany({
      where: { tenantId: principal.tenantId, bolumId },
      select: {
        id: true, kisiId: true, yakinlikDerecesi: true, yakinlikAciklamasi: true,
        malikId: true, kiraciId: true,
        girisTarihi: true, cikisTarihi: true,
        acilDurumKisiAdi: true, acilDurumTelefon: true,
        kisi: { select: { ad: true, soyad: true, eposta: true, telefon: true } },
        malik: { select: { kisi: { select: { ad: true, soyad: true } } } },
        kiraci: { select: { kisi: { select: { ad: true, soyad: true } } } },
      },
      orderBy: [{ girisTarihi: 'asc' }, { id: 'asc' }],
    }), principal.tenantId);

    const tarih = tarihMetni === undefined ? null : takvimTarihi(tarihMetni);

    return kayitlar
      .map((k) => {
        const giris = takvimTarihiniOku(k.girisTarihi);
        const cikis = takvimTarihiniOkuVeyaNull(k.cikisTarihi);
        const gecerliMi =
          tarih === null
            ? cikis === null
            : giris <= tarih && (cikis === null || cikis >= tarih);
        return { kayit: k, giris, cikis, gecerliMi };
      })
      .filter((x) => tarih === null || x.gecerliMi)
      .map(({ kayit, giris, cikis, gecerliMi }) => ({
        id: kayit.id,
        kisiId: kayit.kisiId,
        kisiAdi: `${kayit.kisi.ad} ${kayit.kisi.soyad}`,
        eposta: kayit.kisi.eposta,
        telefon: kayit.kisi.telefon,
        yakinlikDerecesi: kayit.yakinlikDerecesi,
        yakinlikAciklamasi: kayit.yakinlikAciklamasi,
        // Dayanak TAM OLARAK BİRİDİR (veritabanı CHECK `sakin_dayanak_tek`);
        // `malik` doluysa malik, değilse kiracıdır.
        dayanakTipi: kayit.malikId !== null ? 'MALIK' : 'KIRACI',
        dayanakKisiAdi: kayit.malik !== null
          ? `${kayit.malik.kisi.ad} ${kayit.malik.kisi.soyad}`
          : kayit.kiraci !== null
            ? `${kayit.kiraci.kisi.ad} ${kayit.kiraci.kisi.soyad}`
            : '—',
        malikId: kayit.malikId,
        kiraciId: kayit.kiraciId,
        girisTarihi: giris,
        cikisTarihi: cikis,
        acilDurumKisiAdi: kayit.acilDurumKisiAdi,
        acilDurumTelefon: kayit.acilDurumTelefon,
        gecerliMi,
      }));
  }
}
