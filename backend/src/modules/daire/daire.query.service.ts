/**
 * Daire kartı — bir bağımsız bölümün yerleşim dosyası.
 *
 * "Daire", `nitelik: MESKEN` olan bir bağımsız bölümdür; ayrı bir hiyerarşi
 * seviyesi DEĞİLDİR (KMK'da bağımsız bölüm zaten dairedir). Bu modül yeni bir
 * varlık tanımlamaz — mevcut kayıtları yönetim ekranının ihtiyaç duyduğu tek
 * görünümde birleştiren bir OKUMA MODELİDİR.
 *
 * Neden tek uç: bir daire kartını çizmek için malik listesi, hisse durumu,
 * kira sözleşmesi ve sakin listesi birlikte gerekir. Dört ayrı istek, ekranın
 * dört ayrı anlık görüntüyü birleştirmesi demektir; `tarih` süzgeci verildiğinde
 * bunların tutarsız olması mümkündür.
 *
 * Satır eşleme mantığı KOPYALANMAZ: mevcut query servisleri yeniden kullanılır.
 */
import { Injectable } from '@nestjs/common';
import type { Principal } from '@bnos/kernel';
import { BolumQueryService, type BolumSatiri } from '../bolum/bolum.query.service';
import { MalikQueryService, type HisseRaporu, type MalikSatiri } from '../malik/malik.query.service';
import { KiraciQueryService, type KiraciSatiri } from '../kiraci/kiraci.query.service';
import { SakinQueryService, type SakinSatiri } from '../sakin/sakin.query.service';

export interface DaireKarti {
  readonly bolum: BolumSatiri;
  /** Birden çok malik olabilir; hisse oranlarıyla. */
  readonly malikler: readonly MalikSatiri[];
  /** Hisse toplamının tamı ettiği doğrulaması — tahakkuk öncesi kapı. */
  readonly hisseDurumu: HisseRaporu;
  /** Kira sözleşmeleri. Bir bölümde aynı anda en fazla biri geçerlidir. */
  readonly kiracilar: readonly KiraciSatiri[];
  /** Fiilen oturanlar. Aynı anda birden çok geçerlidir. */
  readonly sakinler: readonly SakinSatiri[];
  /**
   * `tarih` verildiyse o güne ait anlık görüntü; verilmediyse TÜM tarihçe
   * (geçmiş malik, tahliye edilmiş kiracı ve çıkmış sakinler dâhil).
   */
  readonly tarih: string | null;
}

@Injectable()
export class DaireQueryService {
  constructor(
    private readonly bolumQuery: BolumQueryService,
    private readonly malikQuery: MalikQueryService,
    private readonly kiraciQuery: KiraciQueryService,
    private readonly sakinQuery: SakinQueryService,
  ) {}

  /**
   * Dairenin tüm yerleşim dosyası.
   *
   * `tarih` verilmezse tarihçe tam döner — "bu dairede kim oturdu?" sorusunun
   * cevabı budur ve geçmiş kayıtlar silinmediği için eksiksizdir.
   */
  async kart(
    bolumId: string,
    principal: Principal,
    tarih?: string,
  ): Promise<DaireKarti> {
    // Bolum detayi ilk cagrilir: bolum yoksa KayitBulunamadi burada firlar ve
    // digerleri bosuna sorgu atmaz.
    const bolum = await this.bolumQuery.detay(bolumId, principal);

    const [malikler, hisseDurumu, kiracilar, sakinler] = await Promise.all([
      this.malikQuery.listele(bolumId, principal, tarih),
      this.malikQuery.hisseDurumu(bolumId, principal, tarih),
      this.kiraciQuery.listele(bolumId, principal, tarih),
      this.sakinQuery.listele(bolumId, principal, tarih),
    ]);

    return {
      bolum,
      malikler,
      hisseDurumu,
      kiracilar,
      sakinler,
      tarih: tarih ?? null,
    };
  }
}
