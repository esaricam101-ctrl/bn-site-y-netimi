/**
 * Arac ve otopark tahsisi.
 *
 * Otopark, yonetim planinda ORTAK ALAN ya da eklenti olarak tanimlanir. Bir
 * bagimsiz bolume tahsis edilen yer sayisi yonetim planindan gelir; kanun
 * sabit bir sayi ongormez (KMK md. 4 · md. 19).
 */
import type { TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type AracTuru = 'OTOMOBIL' | 'MOTOSIKLET' | 'TICARI' | 'BISIKLET' | 'DIGER';

/**
 * Turkiye plaka bicimi: il kodu (01-81) + 1-3 harf + rakam.
 *
 * Harf sayisi rakam sayisini belirler; toplam DAIMA 5 ya da 6 karakterdir:
 *   1 harf -> 4-5 rakam   (34 A 1234 · 34 A 12345)
 *   2 harf -> 3-4 rakam   (34 AB 123 · 34 AB 1234)
 *   3 harf -> 2-3 rakam   (34 ABC 12 · 34 ABC 123)
 *
 * Bu kisit yanlis girilmis plakalari yakalar; yalnizca uzunluk bakmak
 * '34ABCD1' gibi gecersiz bir degeri kabul ederdi.
 */
const PLAKA = /^(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{1,5})$/;
const TOPLAM_ALT = 5;
const TOPLAM_UST = 6;

/** Bosluk ve kucuk harf farklarini eler; karsilastirma bu bicim uzerinden yapilir. */
export function plakayiNormalize(ham: string): string {
  return ham.toUpperCase().replace(/[\s-]/g, '');
}

export function plakayiDogrula(ham: string): string {
  const normal = plakayiNormalize(ham);
  const eslesme = PLAKA.exec(normal);
  if (!eslesme) {
    throw new DogrulamaHatasi(
      `Gecersiz plaka: '${ham}'. Bicim: il kodu (01-81) + 1-3 harf + 1-4 rakam.`,
      'Plakayi ornek bicimde girin: 34ABC123',
    );
  }
  const harf = eslesme[2] as string;
  const rakam = eslesme[3] as string;
  const toplam = harf.length + rakam.length;
  if (toplam < TOPLAM_ALT || toplam > TOPLAM_UST) {
    throw new DogrulamaHatasi(
      `Gecersiz plaka: '${ham}'. Harf ve rakam toplami ${TOPLAM_ALT} ya da ` +
        `${TOPLAM_UST} olmalidir (${harf.length} harf + ${rakam.length} rakam = ${toplam}).`,
      'Plakayi kontrol edin: 34 A 1234 · 34 AB 123 · 34 ABC 12 gibi.',
    );
  }
  return normal;
}

/**
 * Aracin sahip tipi.
 *
 * Otopark kapasitesi malik aracini bakicinin ya da guvenlik gorevlisinin
 * aracindan AYIRT ETMEZ: hepsi yer kaplar. Bu yuzden tek plaka kutugu
 * kullanilir ve sahip alani dorde acilir.
 */
export type AracSahipTipi = 'KISI' | 'DAIRE_GOREVLISI' | 'SITE_PERSONELI' | 'MISAFIR';

export interface Arac {
  readonly id: string;
  /**
   * KAPSAM (`arac_kapsam` kisiti):
   *   · Malik · kiraci · sakin · daire gorevlisi · misafir araci → BOLUME
   *     kayitlidir, bu alan doludur.
   *   · Site personeli araci → YONETIME kayitlidir, bu alan BOSTUR.
   *
   * Personel aracini bir daireye yazmak, o dairenin otopark hakkini tuketmis
   * gosterir ve KULLANIM_BAZLI dagitimda ona fazla pay cikarir.
   */
  readonly bolumId: string | null;
  /**
   * SAHIP — TAM OLARAK BIRI dolu olur (`arac_tek_sahip` kisiti).
   *
   * `kisiId`: malik · kiraci · sakin (hak sahibi kisi kaydi).
   * `gorevliId`: daire gorevlisi (isvereni malik/kiraci olan kisi).
   * `personelId`: site personeli (isvereni yonetim olan kadro).
   * `misafirId`: misafir.
   */
  readonly kisiId: string | null;
  readonly gorevliId?: string | null;
  readonly personelId?: string | null;
  readonly misafirId?: string | null;
  readonly plaka: string;
  readonly tur: AracTuru;
  readonly marka: string | null;
  readonly model: string | null;
  readonly renk: string | null;
  /** Tahsisli otopark yeri etiketi. Bos ise arac kayitli ama yer tahsisli degil. */
  readonly otoparkYeri: string | null;
  readonly baslangic: TakvimTarihi;
  readonly bitis: TakvimTarihi | null;
}

/** Verilen tarihte gecerli arac kayitlari. */
export function tarihtekiAraclar(
  araclar: readonly Arac[],
  tarih: TakvimTarihi,
): readonly Arac[] {
  return araclar.filter(
    (a) => a.baslangic <= tarih && (a.bitis === null || a.bitis >= tarih),
  );
}

/**
 * Ayni plakanin ayni tarihte iki kez kayitli olmasini reddeder.
 *
 * NEDEN: otopark kullanim listesi ve KULLANIM_BAZLI aidat dagitimi arac
 * kaydina dayanir. Mukerrer plaka, bir aracin iki daireye sayilmasi ve
 * otopark giderinin fazla dagitilmasi demektir.
 */
export function aracKaydiniDogrula(
  mevcut: readonly Arac[],
  yeni: Arac,
): void {
  if (yeni.bitis !== null && yeni.bitis < yeni.baslangic) {
    throw new DogrulamaHatasi(
      `Arac kaydinin bitisi (${yeni.bitis}) baslangictan (${yeni.baslangic}) once olamaz.`,
    );
  }

  const ACIK_UC = '9999-12-31' as TakvimTarihi;
  const kesisiyor = (a: Arac, b: Arac): boolean =>
    a.baslangic <= (b.bitis ?? ACIK_UC) && b.baslangic <= (a.bitis ?? ACIK_UC);

  const cakisan = mevcut.find((m) => m.plaka === yeni.plaka && kesisiyor(m, yeni));
  if (cakisan) {
    const aralik = `${cakisan.baslangic} – ${cakisan.bitis ?? 'suresiz'}`;
    throw new DogrulamaHatasi(
      `'${yeni.plaka}' plakasi ${aralik} araliginda zaten kayitli.`,
      'Once mevcut kaydi sonlandirin.',
    );
  }
}

export interface OtoparkTahsisi {
  readonly bolumId: string;
  /** Yonetim planinin bu boluma tanidigi yer sayisi. */
  readonly hakSayisi: number;
}

export interface OtoparkDurumu {
  readonly bolumId: string;
  readonly hakSayisi: number;
  readonly kullanilan: number;
  readonly asimVarMi: boolean;
  readonly mesaj: string;
}

/**
 * Bolumun otopark hakkini asip asmadigini raporlar.
 *
 * Asimi ENGELLEMEZ — misafir araci ya da gecici durumlar mesrudur ve yonetim
 * karari gerektirir. Kural, kaydi reddetmek degil GORUNUR kilmaktir; sessizce
 * fazla arac kaydedilmesi otopark giderinin dagitimini bozar.
 */
export function otoparkDurumu(
  tahsis: OtoparkTahsisi,
  araclar: readonly Arac[],
  tarih: TakvimTarihi,
): OtoparkDurumu {
  const gecerliler = tarihtekiAraclar(araclar, tarih).filter(
    (a) => a.bolumId === tahsis.bolumId && a.otoparkYeri !== null,
  );
  const kullanilan = gecerliler.length;
  const asimVarMi = kullanilan > tahsis.hakSayisi;

  return {
    bolumId: tahsis.bolumId,
    hakSayisi: tahsis.hakSayisi,
    kullanilan,
    asimVarMi,
    mesaj: asimVarMi
      ? `Bolume tanimli ${tahsis.hakSayisi} otopark hakkina karsilik ${kullanilan} arac ` +
        'yer kullaniyor. Yonetim planindaki hak sayisini ya da tahsisleri gozden gecirin.'
      : `${kullanilan}/${tahsis.hakSayisi} otopark yeri kullanimda.`,
  };
}
