/**
 * Belge yonetimi — BFS v1 §5 silme standardi ile hizali.
 *
 * BELGE SILINMEZ, VERSIYONLANIR (BFS v1 §5.3 kural 3). Yeni surum eskisini
 * gecersiz kilar ama yok etmez: "hangi yonetim planina gore karar verildi?"
 * sorusunun cevabi eski surumdedir.
 *
 * Saklama suresi belge tipine baglidir ve KODA GOMULMEZ; mevzuat ve yonetim
 * karari degisir. Tip katalogu veri olarak tasinir.
 */
import type { TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type BelgeTipi =
  | 'YONETIM_PLANI'
  | 'GENEL_KURUL_KARARI'
  | 'TAPU'
  | 'KIRA_SOZLESMESI'
  | 'FATURA'
  | 'MAKBUZ'
  | 'SIGORTA_POLICESI'
  | 'RUHSAT'
  | 'TEKNIK_RAPOR'
  | 'YAZISMA'
  | 'DIGER';

/** Belgenin baglandigi varlik. Bolume, kisiye ya da tenant'in tamamina ait olabilir. */
export type BelgeKapsami = 'TENANT' | 'APARTMAN' | 'BLOK' | 'BOLUM' | 'KISI';

export interface BelgeTipiPolitikasi {
  readonly tip: BelgeTipi;
  /** Yil cinsinden asgari saklama suresi. `null` ise SURESIZ saklanir. */
  readonly saklamaYili: number | null;
  /**
   * FINANSAL sinif — silinmez, yalnizca versiyonlanir (BFS v1 §5.1).
   * Fatura, makbuz ve karar belgeleri bu siniftadir.
   */
  readonly finansalMi: boolean;
  readonly kaynakReferansi: string | null;
}

export interface Belge {
  readonly id: string;
  readonly tip: BelgeTipi;
  readonly kapsam: BelgeKapsami;
  /** Kapsamin isaret ettigi kaydin kimligi. TENANT kapsaminda `null`. */
  readonly hedefId: string | null;
  readonly ad: string;
  /** Ayni belgenin kacinci surumu. 1'den baslar. */
  readonly surum: number;
  /** Bu surumun gecersiz kildigi onceki surum. Ilk surumde `null`. */
  readonly oncekiSurumId: string | null;
  readonly belgeTarihi: TakvimTarihi;
  /** Gecerlilik bitisi — police, ruhsat gibi belgelerde anlamlidir. */
  readonly gecerlilikBitisi: TakvimTarihi | null;
  readonly dosyaAnahtari: string;
  readonly dosyaBoyutu: number;
  readonly icerikTipi: string;
  /** Yeni bir surum yayinlandiginda eskisi arsivlenir; SILINMEZ. */
  readonly arsivMi: boolean;
}

export function tipPolitikasi(
  politikalar: readonly BelgeTipiPolitikasi[],
  tip: BelgeTipi,
): BelgeTipiPolitikasi {
  return (
    politikalar.find((p) => p.tip === tip) ?? {
      tip, saklamaYili: null, finansalMi: false, kaynakReferansi: null,
    }
  );
}

/**
 * Yeni surum kaydini dogrular.
 *
 * Surum numarasi bir artmalidir ve onceki surum referansi ZORUNLUDUR: zincir
 * kopmussa "bu belge neyin yerine geldi?" sorusu cevapsiz kalir ve eski karara
 * dayanan islemler gerekcesiz gorunur.
 */
export function yeniSurumuDogrula(onceki: Belge, yeni: Belge): void {
  if (yeni.tip !== onceki.tip) {
    throw new DogrulamaHatasi(
      `Surum zinciri ayni belge tipinde olmalidir (${onceki.tip} / ${yeni.tip}).`,
      'Farkli tipte bir belge yeni surum degil, yeni belgedir.',
    );
  }
  if (yeni.kapsam !== onceki.kapsam || yeni.hedefId !== onceki.hedefId) {
    throw new DogrulamaHatasi(
      'Surum zinciri ayni kapsam ve hedefe bagli olmalidir.',
      'Baska bir kayda ait belge yeni surum olarak baglanamaz.',
    );
  }
  if (yeni.surum !== onceki.surum + 1) {
    throw new DogrulamaHatasi(
      `Surum numarasi bir artmalidir: ${onceki.surum} -> ${yeni.surum}.`,
      'Atlanan surum, kaybolmus bir belge oldugu izlenimi verir.',
    );
  }
  if (yeni.oncekiSurumId !== onceki.id) {
    throw new DogrulamaHatasi(
      'Yeni surum, gecersiz kildigi surumu referans vermelidir.',
      'Zincir kopmussa belgenin neyin yerine geldigi anlasilamaz.',
    );
  }
}

export interface SilinebilirlikSonucu {
  readonly silinebilir: boolean;
  readonly mesaj: string;
}

/**
 * Belge silinebilir mi — BFS v1 §5 ile hizali.
 *
 * FINANSAL belgeler ASLA silinmez. Digerleri saklama suresi dolduysa ve
 * arsivdeyse silinebilir; guncel surum silinemez cunku aktif bir kaydin
 * dayanagidir.
 */
export function silinebilirMi(
  politikalar: readonly BelgeTipiPolitikasi[],
  belge: Belge,
  bugun: TakvimTarihi,
): SilinebilirlikSonucu {
  const p = tipPolitikasi(politikalar, belge.tip);

  if (p.finansalMi) {
    return {
      silinebilir: false,
      mesaj: `'${belge.tip}' finansal siniftadir ve silinemez (BFS v1 §5.1). ` +
        'Duzeltme yeni surum yayinlayarak yapilir.',
    };
  }
  if (!belge.arsivMi) {
    return {
      silinebilir: false,
      mesaj: 'Guncel surum silinemez; once yeni surum yayinlanmali ya da belge arsivlenmeli.',
    };
  }
  if (p.saklamaYili === null) {
    return {
      silinebilir: false,
      mesaj: `'${belge.tip}' suresiz saklanir` +
        `${p.kaynakReferansi === null ? '' : ` (${p.kaynakReferansi})`}.`,
    };
  }

  // Takvim tarihi YYYY-MM-DD; yil karsilastirmasi metin dilimiyle yapilir.
  const belgeYili = Number.parseInt(belge.belgeTarihi.slice(0, 4), 10);
  const bugunYili = Number.parseInt(bugun.slice(0, 4), 10);
  const gecenYil = bugunYili - belgeYili;

  if (gecenYil < p.saklamaYili) {
    return {
      silinebilir: false,
      mesaj: `Saklama suresi dolmadi: ${gecenYil}/${p.saklamaYili} yil.`,
    };
  }

  return {
    silinebilir: true,
    mesaj: `Saklama suresi doldu (${gecenYil}/${p.saklamaYili} yil); belge silinebilir.`,
  };
}

/** Gecerliligi dolmus belgeler — police, ruhsat gibi takip gerektirenler. */
export function gecerliligiDolanlar(
  belgeler: readonly Belge[],
  bugun: TakvimTarihi,
): readonly Belge[] {
  return belgeler.filter(
    (b) => !b.arsivMi && b.gecerlilikBitisi !== null && b.gecerlilikBitisi < bugun,
  );
}
