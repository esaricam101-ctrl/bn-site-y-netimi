/**
 * Tenant — ADR-0002 · BFS v1 §2
 *
 * Her tenant bir apartmandir. portfolio/group/site kapsami bu modulde uygulanmaz.
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
    if (o.tip !== 'APARTMAN') {
      throw new DogrulamaHatasi(
        `v1 kapsaminda yalnizca APARTMAN tenant tipi desteklenir (ADR v1.1 §11). Verilen: ${o.tip}`,
        'Site ve Yonetim Sirketi dikeyleri sonraki surumlerde eklenecektir.',
      );
    }
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
