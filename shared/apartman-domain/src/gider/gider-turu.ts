/**
 * Gider siniflandirmasi — ADR v1.1 §4 · backlog Y-11 · 634 sayili KMK
 *
 * Her gider turu DORT BAGIMSIZ EKSEN tasir:
 *   1. paylasimKurali  gider BOLUMLERE nasil dagitilir
 *   2. sorumlulukTipi  borc KIME yazilir (malik / kiraci / sakin)
 *   3. kuralKaynagi    kurali kim koydu (KMK / yonetim plani / genel kurul)
 *   4. malikPaylasimi  bolumun payi MALIKLER ARASINDA nasil bolunur
 *
 * Eksenler birbirinden bagimsizdir: bir gider hem arsa payina gore dagitilip
 * hem kullanana yansitilabilir, hem de bolum icinde esit bolunebilir.
 *
 * KURALLAR KODA GOMULMEZ. Buradaki KMK_VARSAYILAN_GIDERLER yalnizca kanunun
 * varsayilanidir; her tenant yonetim plani veya genel kurul karariyla kendi
 * kuralini tanimlar ve override daima kaynak referansi tasir.
 */
import type { MalikPaylasimi } from '../malik/malik.js';

/**
 * Eksen 1 — paylasim kurali.
 *
 * `METREKARE` geriye donuk uyumluluk icindir ve `BRUT_M2` ile ayni davranir;
 * yeni tanimlarda hangi olcunun kastedildigi acik yazilmalidir (BFS v1 §11).
 *
 * `MALIK_HISSE` burada YOKTUR ve bu bilinclidir: hisse orani bir gideri
 * bolumlere dagitmaz, bir bolumun borcunu O BOLUMUN malikleri arasinda boler.
 * Ayri bir eksendir — bkz. `MalikPaylasimi` (malik/malik.ts).
 */
export type PaylasimKurali =
  | 'ESIT'
  | 'ARSA_PAYI'
  | 'BRUT_M2'
  | 'NET_M2'
  | 'METREKARE'
  | 'TUKETIM'
  | 'SABIT_TUTAR'
  /** Yalnizca hizmeti KULLANAN bolumler oder — otopark, havuz, jeneratör. */
  | 'KULLANIM_BAZLI'
  /** Yalnizca ilgili BLOGUN bolumleri oder — o bloktaki asansor onarimi gibi. */
  | 'BLOK_BAZLI'
  /** Yonetici tutarlari BOLUM BOLUM belirler; toplam gidere esit olmak zorundadir. */
  | 'MANUEL'
  | 'KARMA';

/**
 * KARMA modelin bir bileseni: giderin `yuzde` kadarlik kismi `kural` ile
 * dagitilir. Ornek: yakitin %30'u esit, %70'i brut m2.
 */
export interface KarmaBilesen {
  /**
   * MANUEL bir bilesen OLAMAZ: manuel dagitim oransal degil, bolum bolum
   * verilen tutarlardir; bir yuzdenin icine yerlestirilemez.
   */
  readonly kural: Exclude<PaylasimKurali, 'KARMA' | 'MANUEL'>;
  /** Tam sayi yuzde. Bilesenlerin toplami 100 olmak zorundadir. */
  readonly yuzde: number;
}

/**
 * Eksen 2 — sorumluluk tipi. Borcun KIME yazilacagini belirler.
 *
 *   MALIKE_AIT    -> demirbas, yatirim, ana yapi onarimi. HER KOSULDA malik
 *                    (KMK md. 19-20: anayapinin korunmasi malike aittir).
 *   KULLANANA_AIT -> varsa kiraci, yoksa malik (KMK md. 20/a: kapici, kalorifer,
 *                    temizlik giderlerine kullanan katilir).
 *   SAKINE_AIT    -> fiilen oturan. Sakin yoksa kiraci, o da yoksa malik.
 *
 * SAKINE_AIT ile KULLANANA_AIT ayrimi onemlidir: kiraci bir sirket olabilir ve
 * dairede sirketin calisani oturuyor olabilir. Su ya da isinma gibi tuketime
 * bagli giderlerde yonetim plani sorumlulugu FIILEN OTURANA verebilir.
 *
 * Hangi giderin hangi tipte oldugu KODA GOMULMEZ — yonetim plani veya genel
 * kurul karariyla belirlenir ve `kuralKaynagi` ile kayda gecer.
 */
export type SorumlulukTipi = 'MALIKE_AIT' | 'KULLANANA_AIT' | 'SAKINE_AIT';

/** Bolumde tahakkuk aninda kimlerin bulundugu. */
export interface KullanimDurumu {
  readonly kiraciVarMi: boolean;
  readonly sakinVarMi: boolean;
}

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
  /** Yalnizca `paylasimKurali === 'KARMA'` iken doludur. */
  readonly karmaBilesenler?: readonly KarmaBilesen[];
  /**
   * Eksen 4 — bolumun borcu MALIKLER ARASINDA nasil bolunur.
   *
   * `paylasimKurali` gideri BOLUMLERE dagitir; bu alan bir bolume dusen payin
   * o bolumun (birden cok olabilen) malikleri arasinda nasil bolunecegini
   * belirler. Iki eksen bagimsizdir: arsa payina gore dagitilan bir gider,
   * bolum icinde esit de bolunebilir.
   *
   * Belirtilmezse `HISSE_ORANI` varsayilir — tapu hissesi dogal olcuttur.
   */
  readonly malikPaylasimi?: MalikPaylasimi;
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

  const bilesenler = g.karmaBilesenler ?? [];

  if (g.paylasimKurali === 'KARMA') {
    if (bilesenler.length === 0) {
      hatalar.push(`'${g.kod}': KARMA paylasim en az bir bilesen tasimalidir.`);
    } else {
      const toplam = bilesenler.reduce((t, b) => t + b.yuzde, 0);
      if (toplam !== 100) {
        hatalar.push(
          `'${g.kod}': KARMA bilesenlerinin toplami 100 olmalidir, ${toplam} verildi. ` +
            `Aksi halde giderin bir kismi dagitilmadan kalir ya da fazla dagitilir.`,
        );
      }
      for (const b of bilesenler) {
        if (!Number.isInteger(b.yuzde) || b.yuzde <= 0) {
          hatalar.push(`'${g.kod}': KARMA bilesen yuzdesi pozitif tam sayi olmalidir: ${b.yuzde}`);
        }
      }
      const tekrar = bilesenler.length !== new Set(bilesenler.map((b) => b.kural)).size;
      if (tekrar) {
        hatalar.push(`'${g.kod}': ayni kural KARMA icinde birden fazla kez kullanilamaz.`);
      }
    }
  } else if (bilesenler.length > 0) {
    // Sessizce yok saymak, yoneticinin tanimladigi kuralin uygulandigini
    // sanmasina yol acar.
    hatalar.push(
      `'${g.kod}': karma bilesenler yalnizca KARMA paylasiminda tanimlanir, ` +
        `kural '${g.paylasimKurali}'.`,
    );
  }

  return hatalar;
}

/**
 * Bir giderin borcunun kime yazilacagini belirler (Eksen 2).
 *
 * Yonetici, yonetim plani ve genel kurul kararlarina gore bu secimi override
 * edebilir; override daima GiderTuru uzerinden yapilir, TAHAKKUK ANINDA DEGIL.
 * Aksi halde ayni gider iki ayri tahakkukta farkli kisiye yazilabilir ve
 * "neden bu kisi?" sorusunun belgeye dayali cevabi kalmaz.
 *
 * GERI DUSUS ZINCIRI: sorumlu rol o bolumde bulunmuyorsa bir ust role dusulur.
 * Malik her zaman zincirin sonundadir — basvurulacak taraf kaybolmaz.
 */
export function borcAlicisiTipi(
  gider: GiderTuru,
  durum: KullanimDurumu,
): 'MALIK' | 'KIRACI' | 'SAKIN' {
  switch (gider.sorumlulukTipi) {
    case 'MALIKE_AIT':
      return 'MALIK';
    case 'SAKINE_AIT':
      if (durum.sakinVarMi) return 'SAKIN';
      return durum.kiraciVarMi ? 'KIRACI' : 'MALIK';
    case 'KULLANANA_AIT':
      return durum.kiraciVarMi ? 'KIRACI' : 'MALIK';
  }
}
