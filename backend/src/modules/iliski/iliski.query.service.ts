import { Injectable } from '@nestjs/common';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, type Principal,
} from '@bnos/kernel';
import { KayitBulunamadi } from '@bnos/core-domain';
import { tarihtekiIliskiler, type BolumIliskisi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface IliskiSatiri {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly rol: string;
  readonly baslangic: string;
  readonly bitis: string | null;
}

@Injectable()
export class IliskiQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bölümün ilişkileri. `tarih` verilirse yalnızca o tarihte GEÇERLİ olanlar
   * döner — hangi tarihte kimin sorumlu olduğu sorusunun cevabıdır.
   *
   * Geçerlilik süzgeci domain'e (`tarihtekiIliskiler`) bırakılır; borç
   * çözümlemesi de aynı fonksiyonu kullanır. İki yerde yazılırsa biri eskir
   * ve rapor ile tahakkuk farklı kişiyi gösterir.
   */
  async listele(
    bolumId: string,
    principal: Principal,
    tarihMetni?: string,
  ): Promise<readonly IliskiSatiri[]> {
    const bolum = await this.prisma.tenantIslemi((tx) => tx.bagimsizBolum.findFirst({
      where: { id: bolumId, tenantId: principal.tenantId },
      select: { id: true },
    }), principal.tenantId);
    if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

    const kayitlar = await this.prisma.tenantIslemi((tx) => tx.bolumIliskisi.findMany({
      where: { tenantId: principal.tenantId, bolumId },
      select: {
        id: true, kisiId: true, rol: true, baslangic: true, bitis: true,
        kisi: { select: { ad: true, soyad: true } },
      },
      orderBy: [{ baslangic: 'asc' }, { id: 'asc' }],
    }), principal.tenantId);

    const zenginlestirilmis = kayitlar.map((k) => ({
      kayit: k,
      iliski: {
        kisiId: k.kisiId,
        rol: k.rol,
        baslangic: takvimTarihiniOku(k.baslangic),
        bitis: takvimTarihiniOkuVeyaNull(k.bitis),
      } satisfies BolumIliskisi,
    }));

    // Geçerlilik ölçütü domain'de tanımlıdır ve burada TEKRARLANMAZ; tek kayıt
    // için çağırmak, süzgeci elle yeniden yazmaktan daha ucuzdur.
    const tarih = tarihMetni === undefined ? null : takvimTarihi(tarihMetni);
    const secilen =
      tarih === null
        ? zenginlestirilmis
        : zenginlestirilmis.filter((z) => tarihtekiIliskiler([z.iliski], tarih).length > 0);

    return secilen.map(({ kayit, iliski }) => ({
      id: kayit.id,
      kisiId: iliski.kisiId,
      kisiAdi: `${kayit.kisi.ad} ${kayit.kisi.soyad}`,
      rol: iliski.rol,
      baslangic: iliski.baslangic,
      bitis: iliski.bitis,
    }));
  }
}
