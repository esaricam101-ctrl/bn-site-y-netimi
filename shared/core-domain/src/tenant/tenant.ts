/**
 * Tenant — ADR-0002 · ADR-0008 · ADR-0009 · BFS v1 §2
 *
 * TENANT = YONETILEN YERLESKE ya da YONETIM FIRMASI:
 *   APARTMAN | SITE      -> bir PROJE (ADR-0008). Ic hiyerarsi:
 *                           Apartman -> Blok -> Kat -> BagimsizBolum.
 *   YONETIM_SIRKETI      -> birden cok projeyi yoneten firma (ADR-0009).
 *
 * ⚠️  CAPRAZ-TENANT SORGU YOKTUR. Firma ile proje arasindaki bag bir
 *     `YonetimDelegasyonu` (acik devir) kaydidir; portfoy ozeti PROJE BASINA
 *     ayri sorgu + uygulama katmaninda toplamadir. ADR-0002 bunu
 *     "RLS gevsetilerek cozulmeyecektir" diye yazmisti ve cozum yolu olarak
 *     tam olarak bu devir iliskisini gostermisti.
 */
import type { TenantId } from '@bnos/kernel';
import { DogrulamaHatasi } from '../errors/domain-error.js';

export type TenantTipi = 'APARTMAN' | 'SITE' | 'YONETIM_SIRKETI';
export type TenantDurumu = 'KURULUM' | 'AKTIF' | 'ASKIDA' | 'ARSIV';

export interface TenantOzellikleri {
  readonly id: TenantId;
  readonly kod: string;
  readonly ad: string;
  readonly tip: TenantTipi;
  readonly durum: TenantDurumu;
  /** IANA saat dilimi. Turkiye sabit UTC+3'tur ancak koda gomulmez (BFS v1 §4.2). */
  readonly saatDilimi: string;
  readonly paraBirimi: 'TRY';
  readonly lisansKodu: string;
}

const KOD = /^[a-z0-9][a-z0-9-]{2,31}$/;

export class Tenant {
  private constructor(private readonly o: TenantOzellikleri) {}

  static olustur(o: TenantOzellikleri): Tenant {
    if (!KOD.test(o.kod)) {
      throw new DogrulamaHatasi(
        `Gecersiz tenant kodu: '${o.kod}'. 3-32 karakter; kucuk harf, rakam ve tire.`,
        'Kodu duzeltip tekrar deneyin.',
      );
    }
    if (o.ad.trim().length < 3) {
      throw new DogrulamaHatasi('Tenant adi en az 3 karakter olmalidir.');
    }
    // Uc tip de gecerlidir (ADR-0008 SITE'yi, ADR-0009 YONETIM_SIRKETI'ni
    // kapsama aldi). Eski `tip !== 'APARTMAN'` reddi "v1 kapsaminda" diye
    // yazilmis GECICI bir kisitti; ikisi de o notu acikca kaldirdi.
    return new Tenant(o);
  }

  get id(): TenantId { return this.o.id; }
  get kod(): string { return this.o.kod; }
  get ad(): string { return this.o.ad; }
  get tip(): TenantTipi { return this.o.tip; }
  get durum(): TenantDurumu { return this.o.durum; }
  get saatDilimi(): string { return this.o.saatDilimi; }
  get lisansKodu(): string { return this.o.lisansKodu; }

  /** Kurulum tamamlanmadan is islemi yapilamaz. */
  islemeAcikMi(): boolean { return this.o.durum === 'AKTIF'; }

  aktiflestir(): Tenant {
    if (this.o.durum !== 'KURULUM') {
      throw new DogrulamaHatasi('Yalnizca KURULUM durumundaki tenant aktiflestirilebilir.');
    }
    return new Tenant({ ...this.o, durum: 'AKTIF' });
  }

  anlik(): TenantOzellikleri { return this.o; }
}
