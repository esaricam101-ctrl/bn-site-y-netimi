/**
 * Yonetim devri — PORTFOY YONETIM MERKEZI'nin domain kurallari (ADR-0009).
 *
 * Bir PROJE tenant'i (APARTMAN | SITE) yonetimini bir YONETIM_SIRKETI
 * tenant'ina devreder. Devir bir KAYITTIR: kim, ne zaman, hangi dayanakla
 * verdi ve ne zaman sona erdi.
 *
 * ⚠️  DEVIR BIR YETKILENDIRMEDIR, IZOLASYON DEGILDIR. Firma neye
 *     erisebilecegini devir kaydindan ogrenir; ama her sorgu yine TEK TENANT
 *     baglaminda kosar ve RLS her sorguda tek tenant gorur. Devir kaydi
 *     silinse bile RLS ayakta kalir — guvenlik iki bagimsiz katmandadir.
 */
import type { TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '../errors/domain-error.js';
import type { TenantTipi } from './tenant.js';

export type DevirDurumu = 'AKTIF' | 'SONA_ERDI' | 'IPTAL';

export interface YonetimDevri {
  readonly id: string;
  /** Yonetimi DEVRALAN firma tenant'i. */
  readonly yonetimTenantId: string;
  /** Yonetimi DEVREDEN proje tenant'i. */
  readonly projeTenantId: string;
  readonly durum: DevirDurumu;
  /** Yonetim sozlesmesi no, genel kurul karar no vb. */
  readonly dayanak: string;
  readonly baslangic: TakvimTarihi;
  /** Bossa devir SURESIZDIR. */
  readonly bitis: TakvimTarihi | null;
}

/**
 * Devrin verilen gunde GECERLI olup olmadigi.
 *
 * ⚠️  Bu fonksiyon TEK KARAR NOKTASIDIR. Iki yere kopyalanirsa biri
 *     guncellenmeyi unutur ve firma, devri sona ermis bir projeyi okumaya
 *     devam eder — sessiz bir yetki asimi.
 */
export function devirGecerliMi(devir: YonetimDevri, gun: TakvimTarihi): boolean {
  if (devir.durum !== 'AKTIF') return false;
  if (devir.baslangic > gun) return false;
  return devir.bitis === null || devir.bitis >= gun;
}

export interface DevirGirdisi {
  readonly yonetimTenantId: string;
  readonly yonetimTenantTipi: TenantTipi;
  readonly projeTenantId: string;
  readonly projeTenantTipi: TenantTipi;
  readonly dayanak: string;
  readonly baslangic: TakvimTarihi;
  readonly bitis: TakvimTarihi | null;
}

/**
 * Yeni devir kaydini dogrular.
 *
 * `mevcutAktifDevir`: projenin halihazirda AKTIF devri (varsa). Ayni proje ayni
 * anda iki firmaya devredilemez; veritabaninda da kismi unique index bunu
 * zorlar (`yonetim_delegasyonu_aktif_proje_uq`).
 */
export function devriDogrula(
  girdi: DevirGirdisi,
  mevcutAktifDevir: YonetimDevri | null,
): void {
  if (girdi.yonetimTenantTipi !== 'YONETIM_SIRKETI') {
    throw new DogrulamaHatasi(
      'Yonetimi yalnizca YONETIM_SIRKETI tipli bir tenant devralabilir. ' +
        `Verilen: ${girdi.yonetimTenantTipi}.`,
      'Once YONETIM_SIRKETI tipli bir tenant olusturun.',
    );
  }
  if (girdi.projeTenantTipi === 'YONETIM_SIRKETI') {
    throw new DogrulamaHatasi(
      'Bir yonetim firmasinin yonetimi devredilemez; devir yalnizca ' +
        'APARTMAN ya da SITE tipli projeler icindir.',
    );
  }
  if (girdi.yonetimTenantId === girdi.projeTenantId) {
    throw new DogrulamaHatasi('Bir tenant kendi yonetimini kendine devredemez.');
  }
  if (girdi.dayanak.trim().length < 3) {
    throw new DogrulamaHatasi(
      'Devrin dayanagi zorunludur (yonetim sozlesmesi no, genel kurul karar no).',
      'Dayanagi girin: devir hangi kararla verildi?',
    );
  }
  if (girdi.bitis !== null && girdi.bitis < girdi.baslangic) {
    throw new DogrulamaHatasi(
      `Devir bitisi (${girdi.bitis}) baslangictan (${girdi.baslangic}) once olamaz.`,
    );
  }
  if (mevcutAktifDevir !== null) {
    throw new DogrulamaHatasi(
      'Bu projenin yonetimi zaten baska bir firmaya devredilmis ' +
        `(dayanak: ${mevcutAktifDevir.dayanak}).`,
      'Once mevcut devri sona erdirin; iki firma ayni projeyi ayni anda ' +
        'yonetemez, aksi halde tahakkukun hangi yonetim tarafindan yapildigi ' +
        'belirsiz kalir.',
    );
  }
}

/**
 * Devri sona erdirmeyi dogrular.
 *
 * KAYIT SILINMEZ, durumu degisir: hangi firmanin hangi tarihte yetkili oldugu,
 * gecmise donuk her tahakkukun dayanagidir.
 */
export function devirSonlandirmayiDogrula(
  devir: YonetimDevri,
  gerekce: string,
): void {
  if (devir.durum !== 'AKTIF') {
    throw new DogrulamaHatasi(
      `Devir zaten ${devir.durum === 'IPTAL' ? 'iptal edilmis' : 'sona ermis'}.`,
      'Islem tekrarlanmaz.',
    );
  }
  if (gerekce.trim().length < 5) {
    throw new DogrulamaHatasi(
      'Devri sona erdirmek icin gerekce zorunludur.',
      'Yetkinin ne zaman ve neden kalktigi, sonradan "bu firma o tarihte ' +
        'neden erisemedi?" sorusunun cevabidir.',
    );
  }
}
