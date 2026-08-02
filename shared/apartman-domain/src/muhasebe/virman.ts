/**
 * VIRMAN alan kurallari (ADR-0016).
 *
 * TANIM: virman mevcut borcu IPTAL ETMEK icin degil, DOGRU KISIYE AKTARMAK
 * icin yapilan muhasebe islemidir. Toplam borc DEGISMEZ; degisen yalnizca
 * borcun muhatabidir.
 *
 * ⚠️  `fisiDogrula` DEGISTIRILMEZ. Genel mahsup fisinde ayni hesabin iki
 *     tarafta bulunmasi MESRUDUR (farkli bolum kirilimlariyla). Virmanda
 *     anlamsizdir: A'dan A'ya para tasinmaz. Kural bu yuzden virmana OZELDIR
 *     ve genel fis dogrulamasi gevsetilmez/sikilastirilmaz.
 */
import { DogrulamaHatasi } from '@bnos/core-domain';

/** Virmanin dokundugu varlik. Ucu farkli kurala tabidir. */
export type VirmanKaydiTuru = 'KASA_BANKA' | 'HESAP' | 'CARI';

/**
 * SEBEP KODLARI VERIDIR, koda gomulu degildir — ama gecerli KUME turden
 * turer. Tur basina liste ayri tutulur cunku bir turun mesru sebebi otekinde
 * anlamsizdir: `YANLIS_DAIRE_DUZELTMESI` bir kasa/banka virmaninda ne
 * demektir? Tek liste olsaydi hicbir sey engellenmezdi.
 */
export const VIRMAN_SEBEPLERI: Readonly<Record<VirmanKaydiTuru, readonly string[]>> = {
  KASA_BANKA: ['KASA_BANKA_YATIRMA', 'BANKA_HESAPLARI_ARASI', 'FON_TRANSFERI'],
  HESAP: ['HESAP_DUZELTMESI', 'SINIFLANDIRMA_DEGISIKLIGI'],
  CARI: ['YANLIS_DAIRE_DUZELTMESI', 'ICRA_TAHSILAT_DAGITIMI', 'TASINMA'],
};

export interface VirmanSatiri {
  readonly hesapId: string;
  readonly bolumId: string | null;
  /** Kurus tabanli tamsayi — ADR-0007. Float ile toplanmaz. */
  readonly borcKurus: bigint;
  readonly alacakKurus: bigint;
}

export interface VirmanPayi {
  readonly borcId: string;
  readonly kisiId: string;
  readonly sira: 'ASIL' | 'IKINCIL';
  readonly payKurus: bigint;
}

/**
 * ⚠️  AD VirmanGirdisi DEGIL: anka/banka.ts icinde ayni adda bir tip var
 *     ve o KASA/BANKA virmanidir. Ayni ad iki modulden disari verilseydi
 *     paket girisinde belirsizlik olusur, biri otekini golgelerdi.
 */
export interface VirmanKaydiGirdisi {
  readonly tur: VirmanKaydiTuru;
  readonly sebepKodu: string;
  readonly aciklama: string;
  /** Bos olabilir: tasinma virmani deftere yazilmaz (bkz. asagidaki not). */
  readonly satirlar: readonly VirmanSatiri[];
  readonly paylar: readonly VirmanPayi[];
}

/**
 * VIRMANIN IKI DAVRANISI (ADR-0016).
 *
 *   satirlar DOLU  → deftere fis yazilir (hesap virmani, yanlis daire
 *                    duzeltmesi gibi bakiye tasiyan islemler)
 *   satirlar BOS   → fis YAZILMAZ (tasinma virmani)
 *
 * ⚠️  TASINMA VIRMANI NEDEN FIS URETMEZ: kiraci tasindiginda borcun TOPLAMI
 *     da, hangi hesapta durdugu da degismez. Yalnizca `borc_sorumlusu`
 *     paylari bolunur — yani yardimci defterin ICINDE bir dagilim degisir.
 *     Kontrol hesabi bakiyesi ayni kaldigi icin deftere yazilacak DENK bir
 *     kayit yoktur; zorla uretilseydi ayni hesaba borc ve alacak yazan,
 *     bakiyeyi degistirmeyen bir gurultu satiri olurdu.
 */
export function virmanFisUretirMi(g: Pick<VirmanKaydiGirdisi, 'satirlar'>): boolean {
  return g.satirlar.length > 0;
}

export function virmanKaydiniDogrula(g: VirmanKaydiGirdisi): void {
  if (g.aciklama.trim().length < 3) {
    throw new DogrulamaHatasi(
      'Virman aciklamasi zorunludur.',
      'Bos birakilabilen zorunlu alan zorunlu degildir: denetimde "neden ' +
        'yapildi" sorusu serbest metinle cevaplanir. Somut olayi yazin.',
    );
  }

  const gecerliSebepler = VIRMAN_SEBEPLERI[g.tur];
  if (!gecerliSebepler.includes(g.sebepKodu)) {
    throw new DogrulamaHatasi(
      `'${g.sebepKodu}' ${g.tur} virmani icin gecerli bir sebep degil.`,
      `Gecerli sebepler: ${gecerliSebepler.join(', ')}.`,
    );
  }

  if (g.satirlar.length > 0) satirlariDogrula(g.satirlar);
  paylariDogrula(g.paylar);

  if (g.satirlar.length === 0 && g.paylar.length === 0) {
    throw new DogrulamaHatasi(
      'Virman hicbir sey tasimiyor.',
      'En az bir yevmiye satiri ya da bir cari payi verilmelidir.',
    );
  }
}

function satirlariDogrula(satirlar: readonly VirmanSatiri[]): void {
  if (satirlar.length < 2) {
    throw new DogrulamaHatasi(
      'Virman en az iki satir icerir.',
      'Cift tarafli kayitta bir tarafi olan islem yoktur: tutar bir yerden ' +
        'cikip bir yere girer.',
    );
  }

  let borcToplam = 0n;
  let alacakToplam = 0n;

  for (const s of satirlar) {
    if (s.borcKurus > 0n && s.alacakKurus > 0n) {
      throw new DogrulamaHatasi(
        'Bir satirda hem borc hem alacak olamaz.',
        'Satir tek yonludur; iki yon gerekiyorsa iki satir yazin.',
      );
    }
    if (s.borcKurus === 0n && s.alacakKurus === 0n) {
      throw new DogrulamaHatasi(
        'Sifir tutarli virman satiri yazilamaz.',
        'Tutarsiz satir deftere gurultu ekler ve mutabakatta aciklanamaz.',
      );
    }
    if (s.borcKurus < 0n || s.alacakKurus < 0n) {
      throw new DogrulamaHatasi(
        'Virman satiri negatif olamaz.',
        'Ters yon gerekiyorsa satirin borc/alacak tarafini degistirin.',
      );
    }
    borcToplam += s.borcKurus;
    alacakToplam += s.alacakKurus;
  }

  if (borcToplam !== alacakToplam) {
    throw new DogrulamaHatasi(
      'Virman denk degil: borc ve alacak toplamlari esit olmalidir.',
      'Denk olmayan fis defteri bozar; fark hangi satirdan geldigi ' +
        'bilinmeden kalicilasir.',
    );
  }

  /*
   * ⚠️  AYNI KAYNAK HEM BORC HEM ALACAK TARAFINDA OLAMAZ.
   *
   *     Kaynak = (hesapId, bolumId) CIFTIDIR, yalnizca hesapId degil. Ayni
   *     alacak hesabinin 3 nolu daireden 7 nolu daireye tasinmasi MESRU bir
   *     cari virmandir ve en yaygin senaryodur; hesapId ile karsilastirilsaydi
   *     bu islem yanlislikla reddedilirdi.
   */
  const anahtar = (s: VirmanSatiri): string => `${s.hesapId}|${s.bolumId ?? ''}`;
  const borcTarafi = new Set(satirlar.filter((s) => s.borcKurus > 0n).map(anahtar));
  for (const s of satirlar) {
    if (s.alacakKurus > 0n && borcTarafi.has(anahtar(s))) {
      throw new DogrulamaHatasi(
        'Ayni hesap ve bolum hem borc hem alacak tarafinda olamaz.',
        'A\'dan A\'ya virman bakiyeyi degistirmez; kaynak ya da hedefi duzeltin.',
      );
    }
  }
}

function paylariDogrula(paylar: readonly VirmanPayi[]): void {
  for (const p of paylar) {
    if (p.payKurus < 0n) {
      throw new DogrulamaHatasi(
        'Cari payi negatif olamaz.',
        'Borcun bir kismini silmek icin virman kullanilmaz; virman borcu ' +
          'IPTAL ETMEZ, muhatabini degistirir.',
      );
    }
  }

  // Ayni borcta ayni kisi + ayni sira iki kez yazilamaz: veritabani da
  // engeller (`borc_sorumlusu` benzersizligi) ama ham kisit ihlali kullaniciya
  // hicbir sey anlatmaz.
  const gorulen = new Set<string>();
  for (const p of paylar) {
    const k = `${p.borcId}|${p.kisiId}|${p.sira}`;
    if (gorulen.has(k)) {
      throw new DogrulamaHatasi(
        'Ayni borcta ayni kisi icin iki pay satiri var.',
        'Paylari tek satirda toplayin.',
      );
    }
    gorulen.add(k);
  }
}

