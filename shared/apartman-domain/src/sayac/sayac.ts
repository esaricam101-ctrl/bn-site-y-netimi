/**
 * Sayac ve tuketim hesabi — TUKETIM paylasim kuralinin girdisi.
 *
 * `gideriPaylastir` TUKETIM kuralinda agirlik olarak tuketim degerini alir.
 * O deger BURADA hesaplanir; yanlis hesaplanirsa yanlis dagitim SESSIZ olur —
 * toplam gider korunur, yalnizca kisiler arasindaki paylar bozulur ve kimse
 * fark etmez.
 *
 * Okumalar ONDALIK DEGIL tam sayidir. 12,345 m3 degeri `12345` olarak ve
 * `olcekBasamak: 3` ile tutulur; float kullanilsaydi yuz dairelik bir binada
 * yuvarlama farklari birikip toplam tuketimden sapardi (ADR-0007 gerekcesi).
 */
import type { TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type SayacTuru =
  | 'SU'
  | 'SICAK_SU'
  | 'ELEKTRIK'
  | 'DOGALGAZ'
  /** Isi pay olcer — radyatore takilir, orantili tuketim gosterir. */
  | 'ISI_PAY_OLCER'
  /** Kalorimetre — dogrudan enerji olcer (kWh/kcal). */
  | 'KALORIMETRE';

export interface Sayac {
  readonly id: string;
  readonly bolumId: string;
  readonly tur: SayacTuru;
  readonly seriNo: string;
  /**
   * Gostergenin basamak sayisi. Mekanik sayac bu basamagi doldurunca basa
   * doner (99999 -> 00001); devir hesabi bu degere dayanir.
   */
  readonly basamak: number;
  /** Okumadaki ondalik basamak sayisi. 12,345 -> deger 12345, olcek 3. */
  readonly olcekBasamak: number;
  readonly takilmaTarihi: TakvimTarihi;
  readonly sokulmeTarihi: TakvimTarihi | null;
  /** Takildigi andaki gosterge degeri. Kullanilmis sayacta sifir olmaz. */
  readonly ilkDeger: bigint;
}

export interface SayacOkumasi {
  readonly sayacId: string;
  readonly tarih: TakvimTarihi;
  readonly deger: bigint;
  /**
   * Gosterge basa dondu mu — OPERATOR ONAYIYLA gelir, tahmin edilmez.
   *
   * Bir okuma oncekinden kucukse iki olasilik vardir: sayac devretti ya da
   * deger yanlis girildi. Tahmin etmek, veri girisi hatasini devir sanip
   * gercekte olmayan bir tuketim yazmaya yol acar. Bu yuzden karar cagirana
   * bırakılır ve varsayilan olarak REDDEDILIR.
   */
  readonly devirMi?: boolean;
}

/** Sayacin verilen tarihte takili olup olmadigi. */
export function sayacAktifMi(sayac: Sayac, tarih: TakvimTarihi): boolean {
  return (
    sayac.takilmaTarihi <= tarih &&
    (sayac.sokulmeTarihi === null || sayac.sokulmeTarihi >= tarih)
  );
}

function gostergeSiniri(sayac: Sayac): bigint {
  if (!Number.isInteger(sayac.basamak) || sayac.basamak <= 0 || sayac.basamak > 12) {
    throw new DogrulamaHatasi(
      `Sayac basamak sayisi 1-12 arasinda olmalidir: ${sayac.basamak} (seri ${sayac.seriNo}).`,
    );
  }
  return 10n ** BigInt(sayac.basamak);
}

/**
 * Iki okuma arasindaki tuketimi hesaplar.
 *
 * SAYAC GERIYE GITMEZ. Yeni okuma oncekinden kucukse hesap yapilmaz; devir
 * oldugu `devirMi` ile ACIKCA bildirilmelidir. Negatif tuketim uretmek,
 * TUKETIM dagitiminda negatif agirlik demektir ve dagitim ya patlar ya da
 * baska daireye fazla yazar.
 */
export function tuketimHesapla(
  sayac: Sayac,
  oncekiDeger: bigint,
  yeniOkuma: SayacOkumasi,
): bigint {
  const sinir = gostergeSiniri(sayac);

  if (oncekiDeger < 0n || yeniOkuma.deger < 0n) {
    throw new DogrulamaHatasi(
      `Sayac degeri negatif olamaz (seri ${sayac.seriNo}).`,
      'Okuma degerini kontrol edin.',
    );
  }
  if (oncekiDeger >= sinir || yeniOkuma.deger >= sinir) {
    throw new DogrulamaHatasi(
      `Sayac degeri ${sayac.basamak} basamagi asiyor (seri ${sayac.seriNo}).`,
      'Sayacin basamak sayisini ya da okumayi kontrol edin.',
    );
  }

  if (yeniOkuma.deger >= oncekiDeger) return yeniOkuma.deger - oncekiDeger;

  if (yeniOkuma.devirMi !== true) {
    throw new DogrulamaHatasi(
      `'${sayac.seriNo}' sayacinda yeni okuma (${yeniOkuma.deger}) oncekinden ` +
        `(${oncekiDeger}) kucuk. Sayac geriye gitmez.`,
      'Deger yanlis girilmisse duzeltin; gosterge basa dondüyse devir olarak isaretleyin.',
    );
  }

  // Devir: gosterge sinira kadar gitti, basa dondu ve yeni degere ulasti.
  return sinir - oncekiDeger + yeniOkuma.deger;
}

/**
 * Sayac degisimi donemi icin toplam tuketim.
 *
 * Eski sayac sokulup yenisi takildiginda donem tuketimi IKI parcadan olusur:
 * eski sayacin son okumasina kadarki tuketim + yeni sayacin ilk degerinden
 * itibaren olan tuketim. Yalnizca yeni sayaca bakmak, eski sayacin son
 * gunlerini SESSIZCE kaybettirir.
 */
export function degisimDonemiTuketimi(
  eskiSayac: Sayac,
  eskiDonemBasi: bigint,
  eskiSonOkuma: SayacOkumasi,
  yeniSayac: Sayac,
  yeniSonOkuma: SayacOkumasi,
): bigint {
  if (eskiSayac.bolumId !== yeniSayac.bolumId) {
    throw new DogrulamaHatasi(
      'Degisim hesabinda iki sayac ayni bagimsiz boluma ait olmalidir.',
    );
  }
  if (eskiSayac.tur !== yeniSayac.tur) {
    throw new DogrulamaHatasi(
      `Degisim hesabinda sayac turleri ayni olmalidir (${eskiSayac.tur} / ${yeniSayac.tur}).`,
      'Farkli turdeki sayaclarin tuketimi toplanmaz.',
    );
  }
  if (eskiSayac.olcekBasamak !== yeniSayac.olcekBasamak) {
    throw new DogrulamaHatasi(
      `Degisim hesabinda olcek basamaklari ayni olmalidir ` +
        `(${eskiSayac.olcekBasamak} / ${yeniSayac.olcekBasamak}).`,
      'Farkli olcekli degerler toplanamaz; okumalari ayni olcege cevirin.',
    );
  }

  const eskiParca = tuketimHesapla(eskiSayac, eskiDonemBasi, eskiSonOkuma);
  const yeniParca = tuketimHesapla(yeniSayac, yeniSayac.ilkDeger, yeniSonOkuma);
  return eskiParca + yeniParca;
}

/**
 * Tuketimi goruntuleme icin ondalikli metne cevirir.
 *
 * Karsilastirmada ya da hesapta KULLANILMAZ — yalnizca ekran ve rapor icin.
 */
export function tuketimMetni(sayac: Sayac, tuketim: bigint): string {
  if (sayac.olcekBasamak === 0) return tuketim.toString();
  const bolen = 10n ** BigInt(sayac.olcekBasamak);
  const tam = tuketim / bolen;
  const kesir = (tuketim % bolen).toString().padStart(sayac.olcekBasamak, '0');
  return `${tam},${kesir}`;
}
