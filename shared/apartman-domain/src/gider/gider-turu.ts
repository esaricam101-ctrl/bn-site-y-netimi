/**
 * Gider siniflandirmasi — ADR v1.1 §4 · backlog Y-11
 *
 * Her gider turu UC BAGIMSIZ EKSEN tasir. Eksenler birbirinden bagimsizdir:
 * bir gider hem arsa payina gore dagitilip hem kullanana yansitilabilir.
 */

/** Eksen 1 — paylasim kurali */
export type PaylasimKurali = 'ESIT' | 'ARSA_PAYI' | 'METREKARE' | 'TUKETIM' | 'SABIT_TUTAR';

/**
 * Eksen 2 — sorumluluk tipi
 *   MALIKE_AIT    -> demirbas, yatirim, ana yapi onarimi. HER KOSULDA malik.
 *   KULLANANA_AIT -> varsa kiraci, yoksa malik.
 */
export type SorumlulukTipi = 'MALIKE_AIT' | 'KULLANANA_AIT';

/** Eksen 3 — kuralin kaynagi. Kimin degistirebilecegini belirler. */
export type KuralKaynagi = 'KMK_VARSAYILAN' | 'YONETIM_PLANI' | 'GENEL_KURUL_KARARI';

export interface GiderTuru {
  readonly kod: string;
  readonly ad: string;
  readonly paylasimKurali: PaylasimKurali;
  readonly sorumlulukTipi: SorumlulukTipi;
  readonly kuralKaynagi: KuralKaynagi;
  /** YONETIM_PLANI veya GENEL_KURUL_KARARI ise referans zorunludur. */
  readonly kaynakReferansi: string | null;
}

/**
 * KMK varsayilanlari (md. 20). Tenant bazinda yonetim planina gore override edilir.
 * Override her zaman kaynak referansi tasir — bir kuralin nereden geldigi kaybolmaz.
 */
export const KMK_VARSAYILAN_GIDERLER: readonly GiderTuru[] = [
  { kod: 'KAPICI_GIDERI', ad: 'Kapıcı gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/a' },
  { kod: 'TEMIZLIK', ad: 'Temizlik gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/a' },
  { kod: 'ASANSOR_BAKIM', ad: 'Asansör bakım gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/a' },
  { kod: 'ISITMA', ad: 'Isıtma gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'Isı Yönetmeliği' },
  { kod: 'ORTAK_ELEKTRIK', ad: 'Ortak alan elektrik', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/b' },
  { kod: 'ORTAK_SU', ad: 'Ortak alan su', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'KULLANANA_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/b' },
  { kod: 'DEMIRBAS', ad: 'Demirbaş alımı', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/b' },
  { kod: 'ANA_YAPI_ONARIM', ad: 'Ana yapı onarımı', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 19' },
  { kod: 'YENILEME_FONU', ad: 'Yenileme fonu', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20' },
  { kod: 'SIGORTA', ad: 'Bina sigortası', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', kuralKaynagi: 'KMK_VARSAYILAN', kaynakReferansi: 'KMK md. 20/b' },
];

/**
 * Override yapiliyorsa kaynak referansi zorunludur — kuralin nereden geldigi,
 * kimin degistirebilecegini belirler.
 */
export function giderTuruDogrula(g: GiderTuru): readonly string[] {
  const hatalar: string[] = [];
  if (g.kuralKaynagi !== 'KMK_VARSAYILAN' && !g.kaynakReferansi) {
    hatalar.push(
      `'${g.kod}': ${g.kuralKaynagi} kaynakli kural referans tasimalidir ` +
        `(yonetim plani maddesi veya genel kurul karar no).`,
    );
  }
  return hatalar;
}

/**
 * Bir giderin borcunun kime yazilacagini belirler (Eksen 2).
 * Yonetici, yonetim plani ve kararlara gore bu secimi override edebilir;
 * override daima GiderTuru uzerinden yapilir, tahakkuk aninda degil.
 */
export function borcAlicisiTipi(gider: GiderTuru, kiraciVarMi: boolean): 'MALIK' | 'KIRACI' {
  if (gider.sorumlulukTipi === 'MALIKE_AIT') return 'MALIK';
  return kiraciVarMi ? 'KIRACI' : 'MALIK';
}
