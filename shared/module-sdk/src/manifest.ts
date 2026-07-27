/** Modul manifestosu — ADR v1.1 §40 · AIS v1 §8 */

export type Dikey = 'APARTMAN' | 'SITE' | 'AVM' | 'PLAZA' | 'OSB' | 'HASTANE' | 'OTEL';

export type CekirdekServis =
  | 'MEMORY' | 'KNOWLEDGE_GRAPH' | 'BUSINESS_RULES'
  | 'WORKFLOW' | 'NOTIFICATION' | 'AUDIT' | 'AUTHZ';

export type GenisletmeNoktasiTipi =
  | 'MENU' | 'WIDGET' | 'RAPOR' | 'KURAL_TIPI' | 'BILDIRIM_SABLONU' | 'KURULUM_ADIMI';

export interface GenisletmeNoktasi {
  readonly tip: GenisletmeNoktasiTipi;
  readonly kod: string;
  readonly ad: string;
}

export interface ModulBagimliligi {
  readonly modulKodu: string;
  readonly minimumSurum: string;
}

export interface ModuleManifest {
  readonly kod: string;
  readonly surum: string;
  readonly gorunenAd: string;
  readonly dikey: Dikey;
  readonly bagimliliklar: readonly ModulBagimliligi[];
  readonly gerektirdigiCekirdek: readonly CekirdekServis[];
  readonly sagladigiYetenekler: readonly string[];
  readonly yayinladigiEventler: readonly string[];
  readonly tukettigiEventler: readonly string[];
  readonly izinTanimlari: readonly string[];
  readonly lisansKodu: string;
  readonly genisletmeNoktalari: readonly GenisletmeNoktasi[];
}

/** Yasam dongusu sozlesmesi — her modul uygulamak zorundadir. */
export interface ModulYasamDongusu {
  install(): Promise<void>;
  migrate(hedefSurum: string): Promise<void>;
  enable(tenantId: string): Promise<void>;
  disable(tenantId: string): Promise<void>;
  uninstall(): Promise<void>;
}

const SURUM = /^\d+\.\d+\.\d+$/;

export function manifestDogrula(m: ModuleManifest): readonly string[] {
  const hatalar: string[] = [];
  if (!/^[a-z][a-z0-9-]{2,31}$/.test(m.kod)) hatalar.push(`Gecersiz modul kodu: '${m.kod}'`);
  if (!SURUM.test(m.surum)) hatalar.push(`Surum semver olmali: '${m.surum}'`);
  if (m.izinTanimlari.length === 0) hatalar.push('Modul en az bir izin tanimlamalidir.');
  if (m.gerektirdigiCekirdek.length === 0) {
    hatalar.push('Modul en az bir cekirdek servis bildirmelidir (AUDIT her modul icin zorunludur).');
  }
  if (!m.gerektirdigiCekirdek.includes('AUDIT')) {
    hatalar.push('AUDIT zorunludur — her mutasyon Audit Log a yazar (ADR v1.1 §40).');
  }
  for (const b of m.bagimliliklar) {
    if (!SURUM.test(b.minimumSurum)) {
      hatalar.push(`'${b.modulKodu}' bagimliliginda gecersiz minimum surum: '${b.minimumSurum}'`);
    }
  }
  return hatalar;
}

/** Bu modulun manifestosu. */
export const APARTMAN_MANIFEST: ModuleManifest = {
  kod: 'apartman-yonetimi',
  surum: '0.1.0',
  gorunenAd: 'Apartman Yönetimi',
  dikey: 'APARTMAN',
  bagimliliklar: [],
  gerektirdigiCekirdek: ['MEMORY', 'KNOWLEDGE_GRAPH', 'BUSINESS_RULES', 'NOTIFICATION', 'AUDIT', 'AUTHZ'],
  sagladigiYetenekler: [
    'tenant.kurulum', 'bagimsiz-bolum.yonetimi', 'kisi.yonetimi',
    'muhasebe.cift-tarafli', 'tahakkuk', 'tahsilat', 'talep.yonetimi',
  ],
  yayinladigiEventler: [
    'core.tenant.olusturuldu', 'core.tenant.aktiflestirildi',
    'core.kisi.olusturuldu', 'core.kisi.guncellendi', 'core.kisi.silindi',
  ],
  tukettigiEventler: [],
  izinTanimlari: ['tenant.view', 'tenant.manage', 'kisi.view', 'kisi.manage', 'bolum.view', 'bolum.manage'],
  lisansKodu: 'BNOS-APT-V1',
  genisletmeNoktalari: [
    { tip: 'MENU', kod: 'apartman.yonetim', ad: 'Yönetim' },
    { tip: 'WIDGET', kod: 'apartman.tahsilat-orani', ad: 'Tahsilat Oranı' },
    { tip: 'RAPOR', kod: 'apartman.isletme-defteri', ad: 'İşletme Defteri' },
    { tip: 'KURULUM_ADIMI', kod: 'apartman.bolum-tanimlama', ad: 'Bağımsız Bölüm Tanımlama' },
  ],
};
