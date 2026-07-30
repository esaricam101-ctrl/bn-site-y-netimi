/**
 * Muhasebe cekirdegi — cift kayit · donem kilidi · mizan · kapanis.
 *
 * ⚠️  BURADAKI KURALLAR MUHASEBENIN TEMELIDIR ve uygulama katmanina
 *     birakilamaz. Her biri, ihlal edildiginde SESSIZ bir hata uretir:
 *     mizan tutar ama defter yanlistir, ya da bilanco yayimlanmis olur ve
 *     dayanagi degismistir.
 *
 * Para her yerde `Money` (olcekli bigint · ADR-0007). `number` kullanilmaz:
 * kurus bolmek float yuvarlamasi yapar ve borc/alacak denkligi 0.01 sapar.
 */
import {
  cikar, sifir, takvimTarihi, topla, type Money, type TakvimTarihi,
} from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type HesapTipi = 'VARLIK' | 'BORC' | 'OZKAYNAK' | 'GELIR' | 'GIDER';
export type HesapOzelligi = 'NORMAL' | 'KASA' | 'BANKA' | 'YANSITMA';
export type FisDurumu = 'TASLAK' | 'ISLENDI' | 'TERS_KAYITLI';
export type FisTuru =
  | 'ACILIS' | 'MAHSUP' | 'TAHSILAT' | 'TEDIYE' | 'YANSITMA' | 'KAPANIS';
export type DonemDurumu = 'ACIK' | 'KAPANIS_SURECI' | 'KAPALI';

/**
 * Hesabin BORC bakiyeli mi ALACAK bakiyeli mi calistigi.
 *
 * Mizan ve bilanco bunu bilmek zorundadir: 100 Kasa'nin bakiyesi borc
 * tarafinda, 300 Banka Kredileri'nin bakiyesi alacak tarafindadir. Tek
 * yonlu hesaplansaydi ozkaynak ve borc hesaplari negatif gorunurdu.
 */
export function dogalBakiyeYonu(tip: HesapTipi): 'BORC' | 'ALACAK' {
  return tip === 'VARLIK' || tip === 'GIDER' ? 'BORC' : 'ALACAK';
}

export interface FisSatiri {
  readonly hesapId: string;
  /** Hesabin fis kesilebilir olup olmadigi — ARA hesaba fis kesilemez. */
  readonly fisKesilebilirMi: boolean;
  readonly borc: Money;
  readonly alacak: Money;
  readonly bolumId?: string | null;
}

export interface FisGirdisi {
  readonly tarih: TakvimTarihi;
  readonly fisTuru: FisTuru;
  readonly satirlar: readonly FisSatiri[];
}

export interface DonemBilgisi {
  readonly id: string;
  readonly baslangic: TakvimTarihi;
  readonly bitis: TakvimTarihi;
  readonly durum: DonemDurumu;
}

/**
 * FISI DOGRULA — cift kayit muhasebesinin butun temel kurallari.
 *
 * Kurallarin her biri BIR SESSIZ HATAYI onler:
 *
 *  1. En az iki satir       → tek satirli "fis" bir kayit degil, nottur.
 *  2. Borc = Alacak         → denklik bozuksa mizan tutmaz ve bilanco
 *                             aciklanamaz bir farkla kapanir.
 *  3. Satirda tek taraf     → ayni satirda hem borc hem alacak yazmak
 *                             netlestirme demektir; hangi hesabin ne kadar
 *                             hareket gordugu kaybolur.
 *  4. Sifir satir olmaz     → tutari olmayan satir deftere gurultu yazar.
 *  5. Fis kesilebilir hesap → ARA (baslik) hesaba kayit, alt hesaplarin
 *                             toplamini bozar ve muavin tutmaz.
 *  6. Ayni hesap tekrar etmez (ayni yonde) → mizanda tek satir gorunur ama
 *                             muavinde iki; mutabakat imkansiz hale gelir.
 */
export function fisiDogrula(fis: FisGirdisi): void {
  if (fis.satirlar.length < 2) {
    throw new DogrulamaHatasi(
      'Muhasebe fisi en az iki satir tasimalidir (cift kayit).',
      'Karsi hesabi ekleyin.',
    );
  }

  let borcToplam = sifir();
  let alacakToplam = sifir();

  fis.satirlar.forEach((s, i) => {
    const sira = i + 1;
    const borcVar = s.borc.kurus !== 0n;
    const alacakVar = s.alacak.kurus !== 0n;

    if (s.borc.kurus < 0n || s.alacak.kurus < 0n) {
      throw new DogrulamaHatasi(
        `${sira}. satirda negatif tutar var. Ters kayit, negatif tutarla DEGIL ` +
          'borc/alacak yonu degistirilerek yazilir.',
      );
    }
    if (borcVar && alacakVar) {
      throw new DogrulamaHatasi(
        `${sira}. satirda hem borc hem alacak dolu. Bir satir TEK YON tasir; ` +
          'aksi halde hesabin ne kadar hareket gordugu kaybolur.',
      );
    }
    if (!borcVar && !alacakVar) {
      throw new DogrulamaHatasi(`${sira}. satirin tutari sifir; deftere yazilamaz.`);
    }
    if (!s.fisKesilebilirMi) {
      throw new DogrulamaHatasi(
        `${sira}. satirdaki hesaba fis kesilemez (ara/baslik hesap).`,
        'Alt hesaplardan birini secin.',
      );
    }

    borcToplam = topla(borcToplam, s.borc);
    alacakToplam = topla(alacakToplam, s.alacak);
  });

  if (borcToplam.kurus !== alacakToplam.kurus) {
    const fark = cikar(borcToplam, alacakToplam);
    throw new DogrulamaHatasi(
      `Fis denk degil: borc ${borcToplam.kurus} kurus, alacak ` +
        `${alacakToplam.kurus} kurus (fark ${fark.kurus}).`,
      'Cift kayit kurali: borc toplami alacak toplamina esit olmalidir.',
    );
  }

  // Ayni hesap AYNI YONDE iki kez gecmemeli. Farkli yonlerde gecmesi
  // mesrudur (ornegin bir hesaba once borc sonra alacak yazan mahsup).
  const gorulen = new Set<string>();
  for (const s of fis.satirlar) {
    const yon = s.borc.kurus !== 0n ? 'B' : 'A';
    const anahtar = `${s.hesapId}:${yon}`;
    if (gorulen.has(anahtar)) {
      throw new DogrulamaHatasi(
        'Ayni hesap ayni yonde iki kez yazilmis. Satirlari birlestirin; ' +
          'aksi halde mizan tek satir, muavin iki satir gosterir ve ' +
          'mutabakat yapilamaz.',
      );
    }
    gorulen.add(anahtar);
  }
}

/**
 * FIS TARIHINI DONEME GORE DOGRULA.
 *
 * ⚠️  KAPALI DONEME FIS YAZILAMAZ. Muhasebenin en temel korumasidir:
 *     kapanmis bir mali yilin kaydi degisirse yayimlanmis bilanco ile defter
 *     tutmaz ve denetim izi kopar. Duzeltme, kapali doneme kayit atarak DEGIL
 *     ACIK donemde ters kayit (storno) ile yapilir.
 */
export function fisTarihiniDogrula(
  tarih: TakvimTarihi,
  donem: DonemBilgisi,
  bugun: TakvimTarihi,
  geriyeDonukGun = 0,
): void {
  if (donem.durum === 'KAPALI') {
    throw new DogrulamaHatasi(
      `${donem.baslangic} – ${donem.bitis} donemi KAPALI; fis yazilamaz.`,
      'Duzeltme icin acik donemde ters kayit (storno) olusturun.',
    );
  }
  if (tarih < donem.baslangic || tarih > donem.bitis) {
    throw new DogrulamaHatasi(
      `Fis tarihi (${tarih}) donem araligi disinda ` +
        `(${donem.baslangic} – ${donem.bitis}).`,
      'Tarihi duzeltin ya da dogru donemi secin.',
    );
  }
  if (tarih > bugun) {
    throw new DogrulamaHatasi(
      `Fis tarihi gelecekte olamaz (${tarih} > ${bugun}).`,
    );
  }
  if (geriyeDonukGun > 0) {
    const sinir = gunEkle(bugun, -geriyeDonukGun);
    if (tarih < sinir) {
      throw new DogrulamaHatasi(
        `Fis tarihi geriye donuk kayit penceresinin disinda (en erken ${sinir}).`,
        'Parametrelerden pencereyi genisletin ya da tarihi duzeltin.',
      );
    }
  }
}

/**
 * Takvim tarihine gun ekler/cikarir.
 *
 * UTC'de calisir: yerel saatte hesaplanirsa yaz saati gecislerinde bir gun
 * kayar ve geriye donuk kayit penceresi yanlis hesaplanir.
 */
export function gunEkle(tarih: TakvimTarihi, gun: number): TakvimTarihi {
  const d = new Date(`${tarih}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return takvimTarihi(d.toISOString().slice(0, 10));
}

export interface MizanSatiri {
  readonly hesapId: string;
  readonly kod: string;
  readonly ad: string;
  readonly tip: HesapTipi;
  readonly borcToplam: Money;
  readonly alacakToplam: Money;
  /** Dogal yonune gore net bakiye; ters yonde ise sifir. */
  readonly borcBakiye: Money;
  readonly alacakBakiye: Money;
}

/**
 * Mizan satirinin bakiyesini hesaplar.
 *
 * Bakiye TEK TARAFTA gosterilir: borc > alacak ise borc bakiyesi, aksi halde
 * alacak bakiyesi. Iki tarafa da yazilsaydi mizan toplamlari iki kez sayar.
 */
export function mizanBakiyesi(
  borcToplam: Money,
  alacakToplam: Money,
): { readonly borcBakiye: Money; readonly alacakBakiye: Money } {
  if (borcToplam.kurus > alacakToplam.kurus) {
    return { borcBakiye: cikar(borcToplam, alacakToplam), alacakBakiye: sifir() };
  }
  if (alacakToplam.kurus > borcToplam.kurus) {
    return { borcBakiye: sifir(), alacakBakiye: cikar(alacakToplam, borcToplam) };
  }
  return { borcBakiye: sifir(), alacakBakiye: sifir() };
}

/**
 * MIZAN DENKLIGI. Borc toplami alacak toplamina esit olmak ZORUNDADIR.
 *
 * Esit degilse deftere denk olmayan bir fis girmis demektir; rapor
 * gosterilmeden once bu yakalanmali, aksi halde kullanici farki kendi
 * bulmaya calisir.
 */
export function mizaniDogrula(satirlar: readonly MizanSatiri[]): void {
  let borc = sifir();
  let alacak = sifir();
  for (const s of satirlar) {
    borc = topla(borc, s.borcToplam);
    alacak = topla(alacak, s.alacakToplam);
  }
  if (borc.kurus !== alacak.kurus) {
    throw new DogrulamaHatasi(
      `Mizan denk degil: borc ${borc.kurus} kurus, alacak ${alacak.kurus} kurus. ` +
        'Deftere denk olmayan bir fis girmis olabilir.',
      'Yevmiye defterinden fisleri denetleyin.',
    );
  }
}

export interface KapanisGirdisi {
  readonly donem: DonemBilgisi;
  /** Donemde ISLENMEMIS (taslak) fis sayisi. */
  readonly taslakFisSayisi: number;
  /** Gelir ve gider hesaplarinin net bakiyeleri. */
  readonly gelirBakiye: Money;
  readonly giderBakiye: Money;
  /** Donem kari/zarari aktarilacak ozkaynak hesabi tanimli mi. */
  readonly donemKariHesabiVarMi: boolean;
  readonly gerekce: string;
}

/**
 * DONEM KAPANISINI DOGRULA.
 *
 * Kapanis GERI ALINAMAZ bir islemdir: kapanis fisi yazilir, donem KAPALI olur
 * ve bir daha fis kabul etmez. Bu yuzden onkosullar kapanistan ONCE
 * denetlenir; sonradan "aslinda taslak fis vardi" demek mumkun degildir.
 */
export function donemKapanisiniDogrula(g: KapanisGirdisi): void {
  if (g.donem.durum === 'KAPALI') {
    throw new DogrulamaHatasi(
      'Donem zaten kapali.',
      'Islem tekrarlanmaz.',
    );
  }
  if (g.taslakFisSayisi > 0) {
    throw new DogrulamaHatasi(
      `Donemde ${g.taslakFisSayisi} islenmemis (taslak) fis var; donem ` +
        'kapatilamaz.',
      'Taslak fisleri isleyin ya da iptal edin: islenmemis kayit mali ' +
        'tabloya girmez ve kapanis eksik hesaplanir.',
    );
  }
  if (!g.donemKariHesabiVarMi
      && (g.gelirBakiye.kurus !== 0n || g.giderBakiye.kurus !== 0n)) {
    throw new DogrulamaHatasi(
      'Donem kari/zarari aktarilacak ozkaynak hesabi tanimli degil.',
      'Muhasebe parametrelerinden donem kari hesabini secin.',
    );
  }
  if (g.gerekce.trim().length < 10) {
    throw new DogrulamaHatasi(
      'Donem kapanisi icin gerekce zorunludur (en az 10 karakter).',
      'Kapanis geri alinamaz; hangi kararla yapildigi kayitta durmalidir.',
    );
  }
}

/**
 * Donem kari/zarari. Gelir > gider ise KAR, aksi halde ZARAR.
 *
 * Isaret ayrica dondurulur: tek bir imzali sayi dondurulseydi cagiran taraf
 * kar mi zarar mi oldugunu isaretten cikarmak zorunda kalir ve sifir durumu
 * belirsiz kalirdi.
 */
export function donemSonucu(
  gelirBakiye: Money,
  giderBakiye: Money,
): { readonly sonuc: 'KAR' | 'ZARAR' | 'BASABAS'; readonly tutar: Money } {
  if (gelirBakiye.kurus > giderBakiye.kurus) {
    return { sonuc: 'KAR', tutar: cikar(gelirBakiye, giderBakiye) };
  }
  if (giderBakiye.kurus > gelirBakiye.kurus) {
    return { sonuc: 'ZARAR', tutar: cikar(giderBakiye, gelirBakiye) };
  }
  return { sonuc: 'BASABAS', tutar: sifir() };
}

/**
 * Hesap kodu bicimi. Tekduzen hesap planinda kod rakamdir ve hiyerarsi
 * uzunlukla kurulur (1 / 10 / 100 / 100.01).
 *
 * Nokta ile ayrilmis alt kirilim kabul edilir; harf KABUL EDILMEZ cunku
 * kod siralamasi mizanin satir sirasini belirler ve harf karisik siralar.
 */
const HESAP_KODU = /^[0-9]{1,3}(\.[0-9]{1,4})*$/;

export function hesapKodunuDogrula(kod: string): string {
  const temiz = kod.trim();
  if (!HESAP_KODU.test(temiz)) {
    throw new DogrulamaHatasi(
      `Gecersiz hesap kodu: '${kod}'. Bicim: 100 · 100.01 · 100.01.001`,
      'Yalnizca rakam ve nokta kullanin; kod siralamasi mizanin satir ' +
        'sirasini belirler.',
    );
  }
  return temiz;
}

/**
 * Alt hesap kodu, ust hesap kodunun ONEKI olmak zorundadir.
 *
 * Olmazsa hesap agaci ile kod duzeni birbirinden kopar: mizan koda gore
 * siralanir, muavin agaca gore toplanir ve ikisi ayni sonucu vermez.
 */
export function altHesapKodunuDogrula(ustKod: string, altKod: string): void {
  if (!altKod.startsWith(`${ustKod}.`) && !altKod.startsWith(ustKod)) {
    throw new DogrulamaHatasi(
      `Alt hesap kodu ('${altKod}') ust hesap kodu ('${ustKod}') ile baslamalidir.`,
      'Aksi halde hesap agaci ile kod duzeni birbirinden kopar ve mizan ile ' +
        'muavin ayni sonucu vermez.',
    );
  }
}
