/**
 * Rol katalogu ve yetki matrisi — DMS'e tasinacak, burada calisir hali tutulur.
 *
 * Tek giris ekrani, rol bazli yonlendirme. Her rol yalnizca yetkili oldugu
 * ekranlari gorur (ADR v1.1 §10).
 */
import { IZINLER, type Izin } from './izinler.js';

export type RolKodu =
  | 'APARTMAN_YONETICISI'
  | 'YONETIM_SIRKETI'
  | 'YK_BASKANI'
  | 'YK_UYESI'
  | 'DENETCI'
  | 'MALIK'
  | 'KIRACI'
  | 'SAKIN'
  | 'PERSONEL';

export interface RolTanimi {
  readonly kod: RolKodu;
  readonly ad: string;
  /** Giristen sonra yonlendirilecek panel. */
  readonly varsayilanPanel: string;
  readonly izinler: readonly Izin[];
  /** true ise izinler yalnizca kendi kayitlari icin gecerlidir (KVKK). */
  readonly yalnizcaKendiVerisi: boolean;
}

const I = IZINLER;

export const ROLLER: readonly RolTanimi[] = [
  {
    kod: 'APARTMAN_YONETICISI', ad: 'Apartman Yöneticisi', varsayilanPanel: '/yonetim',
    yalnizcaKendiVerisi: false,
    izinler: [
      I.TENANT_GORUNTULE, I.TENANT_YONET, I.TENANT_KURULUM,
      I.KISI_GORUNTULE, I.KISI_YONET, I.BOLUM_GORUNTULE, I.BOLUM_YONET,
      I.FINANS_OZET, I.FINANS_BORCLU_DETAY, I.FINANS_TAHAKKUK, I.FINANS_TAHSILAT,
      I.FINANS_MAKBUZ, I.FINANS_DEFTER_GORUNTULE, I.FINANS_AYAR,
      I.TALEP_GORUNTULE, I.TALEP_YONET, I.BELGE_GORUNTULE, I.BELGE_YUKLE,
      I.AI_KULLAN, I.AI_ONERI_KABUL,
    ],
  },
  {
    kod: 'YONETIM_SIRKETI', ad: 'Yönetim Şirketi', varsayilanPanel: '/yonetim',
    yalnizcaKendiVerisi: false,
    izinler: [
      I.TENANT_GORUNTULE, I.TENANT_YONET,
      I.KISI_GORUNTULE, I.KISI_YONET, I.BOLUM_GORUNTULE, I.BOLUM_YONET,
      I.FINANS_OZET, I.FINANS_BORCLU_DETAY, I.FINANS_TAHAKKUK, I.FINANS_TAHSILAT,
      I.FINANS_MAKBUZ, I.FINANS_DEFTER_GORUNTULE, I.FINANS_YEVMIYE_GIRIS,
      I.FINANS_DONEM_KAPAT, I.FINANS_AYAR,
      I.TALEP_GORUNTULE, I.TALEP_YONET, I.BELGE_GORUNTULE, I.BELGE_YUKLE,
      I.AI_KULLAN, I.AI_ONERI_KABUL,
    ],
  },
  {
    kod: 'YK_BASKANI', ad: 'Yönetim Kurulu Başkanı', varsayilanPanel: '/kurul',
    yalnizcaKendiVerisi: false,
    izinler: [
      I.TENANT_GORUNTULE, I.KISI_GORUNTULE, I.BOLUM_GORUNTULE,
      I.FINANS_OZET, I.FINANS_BORCLU_DETAY, I.FINANS_DEFTER_GORUNTULE,
      I.TALEP_GORUNTULE, I.BELGE_GORUNTULE, I.AI_KULLAN,
    ],
  },
  {
    kod: 'YK_UYESI', ad: 'Yönetim Kurulu Üyesi', varsayilanPanel: '/kurul',
    yalnizcaKendiVerisi: false,
    izinler: [
      I.TENANT_GORUNTULE, I.BOLUM_GORUNTULE,
      I.FINANS_OZET, I.FINANS_DEFTER_GORUNTULE,
      I.TALEP_GORUNTULE, I.BELGE_GORUNTULE,
    ],
  },
  {
    kod: 'DENETCI', ad: 'Denetçi', varsayilanPanel: '/denetim',
    yalnizcaKendiVerisi: false,
    // Salt okunur. Erisimi de denetlenir (ADR v1.1 §10).
    izinler: [
      I.TENANT_GORUNTULE, I.BOLUM_GORUNTULE,
      I.FINANS_OZET, I.FINANS_BORCLU_DETAY, I.FINANS_DEFTER_GORUNTULE,
      I.BELGE_GORUNTULE, I.AUDIT_GORUNTULE,
    ],
  },
  {
    kod: 'MALIK', ad: 'Malik', varsayilanPanel: '/sakin',
    yalnizcaKendiVerisi: true,
    izinler: [
      I.KISI_GORUNTULE, I.BOLUM_GORUNTULE, I.FINANS_OZET,
      I.TALEP_OLUSTUR, I.TALEP_GORUNTULE, I.BELGE_GORUNTULE, I.BELGE_YUKLE,
    ],
  },
  {
    kod: 'KIRACI', ad: 'Kiracı', varsayilanPanel: '/sakin',
    yalnizcaKendiVerisi: true,
    izinler: [
      I.KISI_GORUNTULE, I.FINANS_OZET,
      I.TALEP_OLUSTUR, I.TALEP_GORUNTULE, I.BELGE_GORUNTULE, I.BELGE_YUKLE,
    ],
  },
  {
    kod: 'SAKIN', ad: 'Sakin', varsayilanPanel: '/sakin',
    yalnizcaKendiVerisi: true,
    izinler: [I.TALEP_OLUSTUR, I.TALEP_GORUNTULE, I.BELGE_GORUNTULE],
  },
  {
    kod: 'PERSONEL', ad: 'Personel', varsayilanPanel: '/personel',
    yalnizcaKendiVerisi: true,
    izinler: [I.TALEP_GORUNTULE, I.BELGE_GORUNTULE],
  },
];

const ROL_INDEKS = new Map(ROLLER.map((r) => [r.kod, r]));

export function rolTanimi(kod: RolKodu): RolTanimi | undefined {
  return ROL_INDEKS.get(kod);
}

/** Birden cok rolun izinlerinin birlesimi. */
export function izinleriBirlestir(roller: readonly RolKodu[]): readonly Izin[] {
  const kume = new Set<Izin>();
  for (const kod of roller) {
    for (const izin of ROL_INDEKS.get(kod)?.izinler ?? []) kume.add(izin);
  }
  return [...kume];
}

/** Giristen sonra yonlendirilecek panel — en genis yetkili rol kazanir. */
export function varsayilanPanel(roller: readonly RolKodu[]): string {
  const sira: readonly RolKodu[] = [
    'YONETIM_SIRKETI', 'APARTMAN_YONETICISI', 'YK_BASKANI', 'YK_UYESI',
    'DENETCI', 'PERSONEL', 'MALIK', 'KIRACI', 'SAKIN',
  ];
  for (const kod of sira) {
    if (roller.includes(kod)) return ROL_INDEKS.get(kod)?.varsayilanPanel ?? '/sakin';
  }
  return '/sakin';
}
