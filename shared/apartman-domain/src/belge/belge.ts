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

/**
 * Belgenin baglanabilecegi varlik turleri.
 *
 * MALIK · KIRACI · SAKIN, KISI'den AYRIDIR ve bu bilinclidir: bir kira
 * sozlesmesi kisiye degil, o kisinin O BOLUMDEKI kiracilik donemine aittir.
 * Kisi baska daireye tasindiginda eski sozlesme eski doneme bagli kalir.
 */
export type BelgeVarlikTipi =
  | 'TENANT' | 'APARTMAN' | 'BLOK' | 'KAT' | 'BOLUM'
  | 'KISI' | 'MALIK' | 'KIRACI' | 'SAKIN';

/** Geriye donuk ad. Yeni kodda `BelgeVarlikTipi` kullanilir. */
export type BelgeKapsami = BelgeVarlikTipi;

/**
 * Kategori — turun USTUNDE dosyalama duzeyi.
 *
 * Kategori TURUN ozelligidir, belgenin degil: "Fatura" her zaman MALI'dir.
 * Belge basina serbest birakilsaydi ayni tur farkli kategorilere duser ve
 * kategori bazli arama guvenilmez olurdu.
 */
export type BelgeKategorisi = 'HUKUKI' | 'MALI' | 'TEKNIK' | 'KURUMSAL' | 'KISISEL';

/**
 * Gizlilik seviyesi — KVKK veri minimizasyonu (md. 4/1-c).
 *
 * Bir kiracinin kimlik fotokopisi butun yonetim kuruluna acik olmamalidir.
 * Seviye IZIN kontrolunun USTUNE biner: izni olan bile kapsam disindaki
 * KISIYE_OZEL belgeyi goremez.
 */
export type BelgeGizliligi = 'GENEL' | 'YONETIM' | 'KISIYE_OZEL';

/** Gizlilik siralamasi — buyuk sayi daha kisitli demektir. */
const GIZLILIK_DUZEYI: Readonly<Record<BelgeGizliligi, number>> = {
  GENEL: 0,
  YONETIM: 1,
  KISIYE_OZEL: 2,
};

/**
 * Gizlilik YUKSELTILEBILIR, DUSURULEMEZ.
 *
 * Turun varsayilani KISIYE_OZEL olan bir kimlik fotokopisi, belge kaydinda
 * GENEL'e cekilebilseydi tek bir yanlis tikla butun sakinlere acilirdi.
 * Dusurme ihtiyaci varsa tur politikasi degistirilir — o da denetime yazilir.
 */
export function gizliligiDogrula(
  varsayilan: BelgeGizliligi,
  istenen: BelgeGizliligi,
): void {
  if (GIZLILIK_DUZEYI[istenen] < GIZLILIK_DUZEYI[varsayilan]) {
    throw new DogrulamaHatasi(
      `Gizlilik dusurulemez: tur varsayilani '${varsayilan}', istenen '${istenen}'.`,
      'Daha genis erisim gerekiyorsa once belge turunun politikasini degistirin.',
    );
  }
}

/**
 * Etiket normalizasyonu — ASCII katlama.
 *
 * ETIKET BIR KIMLIKTIR, prose degil: "ACIL", "acil", "ACİL" ve "Acil"
 * yazan kullanicilar AYNI etiketi kastediyor.
 *
 * TURKCE KATLAMA BURADA YANLIS SONUC VERIR ve bu sezgiye aykiridir:
 * `'ACIL'.toLocaleLowerCase('tr')` -> 'acıl' cikar, cunku Turkcede noktasiz
 * 'I' harfinin kucugu 'ı'dir. Dilbilgisel olarak dogru, pratikte yikici:
 * caps lock ile "ACIL" yazan kullanicinin etiketi, "acil" yazanla
 * eslesmezdi ve iki ayri etiket olusurdu.
 *
 * Bu yuzden once aksan ayristirilir, birlestirici isaretler atilir ve
 * i/I/İ/ı ailesi tek harfe indirilir — `baslikNormalle` (CSV baslik
 * eslestirme) ile AYNI yaklasim.
 *
 * Prose aramasinda (`ad`, `notlar`) Turkce katlama DOGRU olandir; ayrimi
 * karistirmamak icin bu fonksiyon yalnizca etiket icin kullanilir.
 */
export function etiketNormalle(ham: string): string {
  return ham
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[İI]/gu, 'i')
    .replace(/ı/gu, 'i')
    .toLowerCase()
    .replace(/\s+/gu, '-');
}

/** Etiket bicim denetimi. Bos ve tek harfli etiket aramaya yaramaz. */
export function etiketiDogrula(ham: string): string {
  const normal = etiketNormalle(ham);
  if (normal.length < 2 || normal.length > 40) {
    throw new DogrulamaHatasi(
      `Etiket 2-40 karakter olmalidir: '${ham}'.`,
      'Daha aciklayici bir etiket girin.',
    );
  }
  return normal;
}

export interface BelgeTipiPolitikasi {
  readonly tip: BelgeTipi;
  /** Turun kategorisi — dosyalama duzeyi. */
  readonly kategori?: BelgeKategorisi;
  /** Bu turdeki belgelerin varsayilan gizliligi. */
  readonly varsayilanGizlilik?: BelgeGizliligi;
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

/**
 * Varsayilan saklama politikalari — TEK KAYNAK.
 *
 * Hem tohum verisi hem de yeni tenant olusturma bu listeyi kullanir. Iki ayri
 * yerde yazilsaydi biri guncellenip digeri unutulur ve bazi tenant'lar yanlis
 * politikayla acilirdi.
 *
 * KRITIK: politikasi OLMAYAN bir tip icin `tipPolitikasi` guvenli gorunen bir
 * varsayilan doner (`finansalMi: false`). Fatura ve makbuz icin bu YANLISTIR:
 * finansal isareti dusunce belge arsivlendiginde silinebilir hale gelir ve
 * mali denetim izi kaybolur. Bu yuzden her tenant acilirken politikalar
 * yazilmali, varsayilana BIRAKILMAMALIDIR.
 */
export const VARSAYILAN_BELGE_POLITIKALARI: readonly BelgeTipiPolitikasi[] = [
  // Yonetim plani ve genel kurul kararlari SURESIZ saklanir: bir dairenin
  // aidat kuralinin dayanagi bunlardir ve on yil sonra da sorulabilir.
  { tip: 'YONETIM_PLANI', kategori: 'HUKUKI', varsayilanGizlilik: 'GENEL', saklamaYili: null, finansalMi: false, kaynakReferansi: 'KMK md. 28' },
  { tip: 'GENEL_KURUL_KARARI', kategori: 'HUKUKI', varsayilanGizlilik: 'GENEL', saklamaYili: null, finansalMi: true, kaynakReferansi: 'KMK md. 32 — karar defteri' },
  { tip: 'TAPU', kategori: 'HUKUKI', varsayilanGizlilik: 'KISIYE_OZEL', saklamaYili: null, finansalMi: false, kaynakReferansi: 'KMK md. 12' },
  // Fatura ve makbuz FINANSAL: asla silinmez, duzeltme yeni surumle yapilir.
  { tip: 'FATURA', kategori: 'MALI', varsayilanGizlilik: 'YONETIM', saklamaYili: 10, finansalMi: true, kaynakReferansi: 'VUK md. 253' },
  { tip: 'MAKBUZ', kategori: 'MALI', varsayilanGizlilik: 'YONETIM', saklamaYili: 10, finansalMi: true, kaynakReferansi: 'VUK md. 253' },
  { tip: 'KIRA_SOZLESMESI', kategori: 'HUKUKI', varsayilanGizlilik: 'KISIYE_OZEL', saklamaYili: 10, finansalMi: false, kaynakReferansi: null },
  { tip: 'SIGORTA_POLICESI', kategori: 'TEKNIK', varsayilanGizlilik: 'YONETIM', saklamaYili: 10, finansalMi: false, kaynakReferansi: null },
  { tip: 'RUHSAT', kategori: 'TEKNIK', varsayilanGizlilik: 'YONETIM', saklamaYili: null, finansalMi: false, kaynakReferansi: null },
  { tip: 'TEKNIK_RAPOR', kategori: 'TEKNIK', varsayilanGizlilik: 'YONETIM', saklamaYili: 10, finansalMi: false, kaynakReferansi: null },
  { tip: 'YAZISMA', kategori: 'KURUMSAL', varsayilanGizlilik: 'YONETIM', saklamaYili: 5, finansalMi: false, kaynakReferansi: null },
  { tip: 'DIGER', kategori: 'KURUMSAL', varsayilanGizlilik: 'YONETIM', saklamaYili: 5, finansalMi: false, kaynakReferansi: null },
];

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
