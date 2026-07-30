/**
 * Iletisim cekirdegi — WhatsApp Business · SMS (ileride e-posta).
 *
 * ⚠️  WHATSAPP ve SMS AYRI KURAL KUMESI DEGILDIR. Numara normalizasyonu,
 *     sablon cozumu, izin denetimi ve durum makinesi ortaktir. Kanal bir
 *     ALANDIR; yalnizca kontor hesabi SMS'e ozeldir.
 */
import { DogrulamaHatasi } from '@bnos/core-domain';

export type IletisimKanali = 'WHATSAPP' | 'SMS' | 'EPOSTA';
export type IletiTuru = 'BILGILENDIRME' | 'TICARI';
export type IletiIzinDurumu = 'IZIN' | 'RET';
export type MesajDurumu =
  | 'BEKLIYOR' | 'KUYRUKTA' | 'GONDERILDI' | 'TESLIM_EDILDI' | 'OKUNDU'
  | 'BASARISIZ' | 'IPTAL' | 'SAGLAYICI_YOK' | 'IZIN_YOK';

/* ------------------------------- Numara ---------------------------------- */

/**
 * TELEFON NUMARASINI E.164'e NORMALLER (Turkiye varsayilani).
 *
 * ⚠️  NORMALIZASYON ZORUNLUDUR. Ayni kisi "0532 111 22 33", "+90 532 111 2233"
 *     ve "532 1112233" biciminde uc kez kaydedilebilir; ham hâliyle
 *     saklanirsa "bu kisiye daha once gonderdik mi" sorusu YANITLANAMAZ ve
 *     ayni duyuru ayni kisiye uc kez gider.
 *
 * ⚠️  SABIT HAT REDDEDILIR. SMS ve WhatsApp yalnizca mobil hatta gider; sabit
 *     hatta gonderim sessizce basarisiz olur ve kontor yine dusulur.
 *     Turkiye'de mobil operator kodlari 5 ile baslar.
 */
export function numarayiNormalle(ham: string, ulkeKodu = '90'): string {
  const rakamlar = ham.replace(/[^\d+]/gu, '');
  if (rakamlar === '') {
    throw new DogrulamaHatasi('Telefon numarasi bos olamaz.');
  }

  let govde = rakamlar.startsWith('+') ? rakamlar.slice(1) : rakamlar;

  // "0532..." -> ulke kodu eklenir. "90532..." zaten tam.
  if (govde.startsWith('0')) govde = ulkeKodu + govde.slice(1);
  else if (!govde.startsWith(ulkeKodu)) govde = ulkeKodu + govde;

  if (ulkeKodu === '90') {
    if (govde.length !== 12) {
      throw new DogrulamaHatasi(
        `Gecersiz numara: '${ham}'. Turkiye numarasi ulke koduyla 12 hane ` +
          `olmalidir (90 + 10 hane); ${govde.length} hane bulundu.`,
        'Numarayi 0 ile ya da +90 ile eksiksiz girin.',
      );
    }
    if (!govde.startsWith('905')) {
      throw new DogrulamaHatasi(
        `'${ham}' bir MOBIL numara degil.`,
        'SMS ve WhatsApp yalnizca mobil hatta gider; sabit hatta gonderim ' +
          'sessizce basarisiz olur ve kontor yine dusulur.',
      );
    }
  }

  return `+${govde}`;
}

/** Numara gecerli mi — istisna firlatmadan. Listeleme/onizleme icin. */
export function numaraGecerliMi(ham: string | null, ulkeKodu = '90'): boolean {
  if (ham === null || ham.trim() === '') return false;
  try {
    numarayiNormalle(ham, ulkeKodu);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------- Sablon ---------------------------------- */

const DEGISKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu;

/** Sablondaki degisken adlari. */
export function sablonDegiskenleri(govde: string): readonly string[] {
  return [...new Set([...govde.matchAll(DEGISKEN)].map((m) => m[1] ?? ''))]
    .filter((d) => d !== '');
}

/**
 * Sablonu cozer.
 *
 * ⚠️  COZULMEYEN DEGISKEN GONDERIMI ENGELLER. "Sayin {{ad}}, {{tutar}} TL
 *     borcunuz var" mesajinin ham hâliyle gitmesi, yonetime olan guveni tek
 *     seferde bitirir. Bos dizeyle degistirmek de yanlistir: "Sayin ,  TL
 *     borcunuz var" ayni sorunun sessiz hâlidir.
 */
export function sablonuCoz(
  govde: string, degerler: Readonly<Record<string, string | null | undefined>>,
): string {
  const eksik: string[] = [];
  const sonuc = govde.replace(DEGISKEN, (_tam, ad: string) => {
    const deger = degerler[ad];
    if (deger === undefined || deger === null || deger === '') {
      eksik.push(ad);
      return '';
    }
    return deger;
  });

  if (eksik.length > 0) {
    throw new DogrulamaHatasi(
      `Sablon degiskenleri cozulemedi: ${[...new Set(eksik)].join(', ')}.`,
      'Eksik degiskenle gonderim yapilmaz: alici ham `{{ad}}` metnini ya da ' +
        'bos birakilmis bir cumleyi gorurdu.',
    );
  }
  return sonuc;
}

/* ------------------------------- Kontor ---------------------------------- */

/**
 * GSM-7 temel alfabesi (3GPP TS 23.038). Turkce ozel harfler (ğ ı ş İ) BU
 * KUMEDE YOKTUR; iceren mesaj UCS-2'ye duser.
 */
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
/** GSM-7 genisletme tablosu — her biri IKI karakter sayilir. */
const GSM7_GENIS = '^{}\\[~]|€';

export interface SmsKontoru {
  readonly alfabe: 'GSM7' | 'UCS2';
  /** Sayilan karakter uzunlugu (genisletme karakterleri 2 sayilir). */
  readonly uzunluk: number;
  readonly parcaSayisi: number;
  /** Bir sonraki parcaya gecmeden kalan karakter. */
  readonly kalanKarakter: number;
}

/**
 * SMS PARCA (KONTOR) HESABI.
 *
 * ⚠️  TURKCE KARAKTER FATURAYI IKI KATINA CIKARIR. GSM-7'de 160 karakter olan
 *     bir mesaj, tek bir "ğ" yuzunden UCS-2'ye duser ve 70 karaktere iner.
 *     Coklu parcada baslik alani daha da daraltir (153 / 67).
 *
 *     Bu hesap yanlis yapilsaydi hata SESSIZ olurdu: mesaj yine gider, kimse
 *     bir sey fark etmez, yalnizca ay sonunda fatura iki katina cikar. Bu
 *     yuzden parca sayisi mesajla birlikte SAKLANIR ve raporlanir.
 */
export function smsKontoru(metin: string): SmsKontoru {
  let uzunluk = 0;
  let gsm7 = true;

  for (const ch of metin) {
    if (GSM7.includes(ch)) { uzunluk += 1; continue; }
    if (GSM7_GENIS.includes(ch)) { uzunluk += 2; continue; }
    gsm7 = false;
    break;
  }

  if (!gsm7) {
    // UCS-2: kod BIRIMI sayilir, karakter degil. Emoji gibi vekil cift
    // karakterler IKI birim tutar; `[...metin].length` kullanilsaydi emoji
    // iceren mesaj eksik hesaplanirdi.
    const birim = metin.length;
    const tek = 70;
    const coklu = 67;
    const parca = birim <= tek ? 1 : Math.ceil(birim / coklu);
    return {
      alfabe: 'UCS2',
      uzunluk: birim,
      parcaSayisi: Math.max(1, parca),
      kalanKarakter: birim <= tek ? tek - birim : coklu * parca - birim,
    };
  }

  const tek = 160;
  const coklu = 153;
  const parca = uzunluk <= tek ? 1 : Math.ceil(uzunluk / coklu);
  return {
    alfabe: 'GSM7',
    uzunluk,
    parcaSayisi: Math.max(1, parca),
    kalanKarakter: uzunluk <= tek ? tek - uzunluk : coklu * parca - uzunluk,
  };
}

/* --------------------------------- İzin ---------------------------------- */

export interface IzinKaydi {
  readonly kanal: IletisimKanali;
  readonly iletiTuru: IletiTuru;
  readonly durum: IletiIzinDurumu;
}

export interface IzinSonucu {
  readonly gonderilebilirMi: boolean;
  /** Gonderilemiyorsa GEREKCE — kullaniciya ve rapora yazilir. */
  readonly gerekce: string | null;
}

/**
 * ILETI IZNI DENETIMI (6563 s. K. md. 6 · İYS).
 *
 * ⚠️  UC DURUM VARDIR, IKI DEGIL:
 *       · RET      → hicbir sey gonderilmez (kisi acikca istemedi).
 *       · IZIN YOK → BILGILENDIRME gider, TICARI gitmez.
 *       · IZIN     → ikisi de gider.
 *
 *     "Izin var mi" diye tek bayrakla sorulsaydi ya butun bildirimler izne
 *     takilir (aidat borcu haber verilemez) ya da ticari ileti izinsiz giderdi
 *     — ikincisi idari para cezasidir.
 *
 * ⚠️  RET, ILGILI KANALDA HER SEYI KAPATIR — ileti turune bakilmaz. Kisi "bana
 *     SMS atmayin" dediyse aidat hatirlatmasi da atilmaz; bilgilendirme baska
 *     kanaldan (e-posta · tebligat) yapilir.
 */
export function iletiIzniniDenetle(
  kanal: IletisimKanali,
  iletiTuru: IletiTuru,
  izinler: readonly IzinKaydi[],
): IzinSonucu {
  const kanalIzinleri = izinler.filter((i) => i.kanal === kanal);

  const ret = kanalIzinleri.find((i) => i.durum === 'RET');
  if (ret !== undefined) {
    return {
      gonderilebilirMi: false,
      gerekce:
        `Kisi ${kanal} kanalinda ileti almayi REDDETMIS ` +
        `(${ret.iletiTuru}). Bilgilendirme baska kanaldan yapilmalidir.`,
    };
  }

  if (iletiTuru === 'BILGILENDIRME') return { gonderilebilirMi: true, gerekce: null };

  const ticariIzin = kanalIzinleri.find(
    (i) => i.iletiTuru === 'TICARI' && i.durum === 'IZIN',
  );
  if (ticariIzin === undefined) {
    return {
      gonderilebilirMi: false,
      gerekce:
        'TICARI ileti icin onceden alinmis izin yok (6563 s. K. md. 6). ' +
        'Hizmet iliskisinden dogan bildirimler BILGILENDIRME olarak ' +
        'gonderilebilir.',
    };
  }
  return { gonderilebilirMi: true, gerekce: null };
}

/* --------------------------- Mesaj durum makinesi ------------------------- */

/**
 * Mesaj durum gecisleri.
 *
 * ⚠️  `SAGLAYICI_YOK` ve `IZIN_YOK` UC DURUMLARDIR ve `BASARISIZ` DEGILDIR.
 *     Basarisiz, saglayicinin REDDETTIGI mesajdir; yeniden denenebilir.
 *     Saglayici yoklugu bir YAPILANDIRMA eksigi, izin yoklugu bir HUKUKI
 *     engeldir. Ucu tek durumda toplansaydi durum raporundaki "hata orani"
 *     hicbir seyi anlatmazdi.
 */
const GECERLI_GECISLER: Readonly<Record<MesajDurumu, readonly MesajDurumu[]>> = {
  BEKLIYOR: ['KUYRUKTA', 'IPTAL', 'SAGLAYICI_YOK', 'IZIN_YOK'],
  KUYRUKTA: ['GONDERILDI', 'BASARISIZ', 'IPTAL'],
  GONDERILDI: ['TESLIM_EDILDI', 'BASARISIZ'],
  TESLIM_EDILDI: ['OKUNDU'],
  // Ucu kapali durumlar.
  OKUNDU: [],
  IPTAL: [],
  IZIN_YOK: [],
  // Basarisiz mesaj YENIDEN denenebilir; saglayici tanimlaninca bekleyenler
  // yeniden kuyruga alinir.
  BASARISIZ: ['KUYRUKTA'],
  SAGLAYICI_YOK: ['KUYRUKTA', 'IPTAL'],
};

export function mesajDurumGecisiniDogrula(
  mevcut: MesajDurumu, hedef: MesajDurumu,
): void {
  if (mevcut === hedef) {
    throw new DogrulamaHatasi(`Mesaj zaten ${hedef} durumunda.`, 'Islem tekrarlanmaz.');
  }
  const izinli = GECERLI_GECISLER[mevcut];
  if (!izinli.includes(hedef)) {
    throw new DogrulamaHatasi(
      `${mevcut} durumundan ${hedef} durumuna gecilemez. ` +
        `Izinli gecisler: ${izinli.length === 0 ? 'yok (kapali durum)' : izinli.join(', ')}.`,
      hedef === 'TESLIM_EDILDI'
        ? 'Teslim bilgisi yalnizca saglayicidan gelir; elle isaretlenemez. ' +
          'Sahte bir "teslim edildi", yoneticinin sakinleri bilgilendirdigini ' +
          'sanmasina yol acar.'
        : 'Durum makinesi atlama kabul etmez.',
    );
  }
}

/** Yeniden gonderilebilir mi. */
export function yenidenGonderilebilirMi(
  durum: MesajDurumu, denemeSayisi: number, azamiDeneme = 3,
): void {
  if (durum !== 'BASARISIZ' && durum !== 'SAGLAYICI_YOK') {
    throw new DogrulamaHatasi(
      `${durum} durumundaki mesaj yeniden gonderilemez.`,
      'Yalnizca BASARISIZ ve SAGLAYICI_YOK durumundaki mesajlar yeniden ' +
        'denenebilir. Teslim edilmis bir mesajin tekrari, aliciya ayni ' +
        'bildirimi iki kez gonderir.',
    );
  }
  if (denemeSayisi >= azamiDeneme) {
    throw new DogrulamaHatasi(
      `Azami deneme sayisina ulasildi (${denemeSayisi}/${azamiDeneme}).`,
      'Surekli basarisiz olan numara muhtemelen gecersiz; kisi kartindaki ' +
        'numarayi kontrol edin. Sinirsiz deneme kontor tuketir.',
    );
  }
}

/* ------------------------------ Durum raporu ------------------------------ */

export interface DurumOzeti {
  readonly toplam: number;
  readonly basarili: number;
  readonly basarisiz: number;
  readonly bekleyen: number;
  readonly iptal: number;
  readonly saglayiciYok: number;
  readonly izinYok: number;
  readonly toplamKontor: number;
  /** Yuzde — BIR ONDALIK. Payda sifirsa `null` doner. */
  readonly basariOrani: number | null;
}

/**
 * Durum ozeti.
 *
 * ⚠️  BASARI ORANI PAYDASI, GONDERIM DENENEN mesajlardir. Toplam uzerinden
 *     hesaplansaydi, izin yoklugundan hic denenmemis mesajlar orani asagi
 *     ceker ve saglayici saglikli gorunurken "hata orani yuksek" sanilirdi.
 *
 * ⚠️  Payda SIFIRSA `null` doner, `0` degil. Sifir yazilsaydi "hic gonderim
 *     yok" ile "hepsi basarisiz" ayni gorunurdu.
 */
export function durumOzeti(
  mesajlar: readonly { readonly durum: MesajDurumu; readonly parcaSayisi: number }[],
): DurumOzeti {
  const say = (...durumlar: readonly MesajDurumu[]): number =>
    mesajlar.filter((m) => durumlar.includes(m.durum)).length;

  const basarili = say('GONDERILDI', 'TESLIM_EDILDI', 'OKUNDU');
  const basarisiz = say('BASARISIZ');
  const denenen = basarili + basarisiz;

  return {
    toplam: mesajlar.length,
    basarili,
    basarisiz,
    bekleyen: say('BEKLIYOR', 'KUYRUKTA'),
    iptal: say('IPTAL'),
    saglayiciYok: say('SAGLAYICI_YOK'),
    izinYok: say('IZIN_YOK'),
    // Kontor YALNIZCA gercekten gonderilenlerden sayilir: gonderilmemis mesaj
    // kontor tuketmez ve tuketmis gibi raporlanirsa maliyet sisirilir.
    toplamKontor: mesajlar
      .filter((m) => ['GONDERILDI', 'TESLIM_EDILDI', 'OKUNDU'].includes(m.durum))
      .reduce((a, m) => a + m.parcaSayisi, 0),
    basariOrani: denenen === 0
      ? null
      : Math.round((basarili / denenen) * 1000) / 10,
  };
}
