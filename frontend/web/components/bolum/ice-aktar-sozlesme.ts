/**
 * Bağımsız bölüm içe aktarma — alan sözleşmesi ve satır doğrulaması.
 *
 * React'ten ayrı tutuldu: doğrulama bir görünüm değil veri kuralıdır ve
 * `POST /bolumler/toplu` DTO'sunun aynasıdır (`backend/.../bolum.dto.ts`).
 *
 * NEDEN İSTEMCİDE DE DOĞRULANIYOR — sunucu zaten doğruluyor ve son sözü o
 * söylüyor. Ama toplu oluşturma TEK İŞLEMDİR: bir satır geçersizse hiçbiri
 * yazılmaz. 40 satırlık dosyayı gönderip "27. satır geçersiz" cevabı almak,
 * düzeltip yeniden göndermek ve bu kez 31. satırda takılmak kullanılabilir
 * bir akış değildir. İstemci doğrulaması TÜM hataları bir kerede gösterir.
 */
import { kesirOku, mantikOku, sayiOku } from '../tablo/csv-oku';
import { DAIRE_TIPLERI, NITELIKLER } from '@/lib/kodlar';

/** İçe aktarılabilir alanlar. Sıra, şablon CSV'nin kolon sırasıdır. */
export const ICE_AKTARIM_ALANLARI = [
  'kapiNo', 'icKapiNo', 'nitelik', 'daireTipi',
  'brutM2', 'netM2', 'arsaPayi', 'aidatMuafiyeti',
] as const;

export type IceAktarimAlani = (typeof ICE_AKTARIM_ALANLARI)[number];

export const ZORUNLU_ALANLAR: readonly IceAktarimAlani[] = [
  'kapiNo', 'brutM2', 'netM2', 'arsaPayi',
];

/**
 * Başlık eşleştirmede tanınan yazımlar. Türkçe karakter, büyük/küçük harf ve
 * boşluk farkları normalleştirilerek karşılaştırılır; kullanıcı "Brüt m2",
 * "BRUT M²" ya da "brutm2" yazabilir.
 */
const BASLIK_ESLESMELERI: Readonly<Record<IceAktarimAlani, readonly string[]>> = {
  kapiNo: ['kapino', 'kapi no', 'daire no', 'daireno', 'no'],
  icKapiNo: ['ickapino', 'ic kapi no', 'ickapi'],
  nitelik: ['nitelik', 'vasif', 'tapu vasfi'],
  daireTipi: ['dairetipi', 'daire tipi', 'tip', 'oda sayisi'],
  brutM2: ['brutm2', 'brut m2', 'brut', 'brut alan'],
  netM2: ['netm2', 'net m2', 'net', 'net alan'],
  arsaPayi: ['arsapayi', 'arsa payi', 'arsa'],
  aidatMuafiyeti: ['aidatmuafiyeti', 'muafiyet', 'aidat muaf', 'muaf'],
};

/**
 * Türkçe duyarsız normalleştirme.
 *
 * Aksan ayrıştırılıp birleştirici işaretler atılır, ardından `ı`/`İ` elle
 * eşlenir: `'İ'.toLowerCase()` İngilizce katlamada `i̇` (noktalı i + birleşik
 * nokta) verir ve karşılaştırma sessizce başarısız olur.
 */
export function baslikNormalle(ham: string): string {
  return ham
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[İI]/gu, 'i')
    .replace(/ı/gu, 'i')
    .toLocaleLowerCase('tr')
    .replace(/[²]/gu, '2')
    .replace(/[\s._-]/gu, '')
    .trim();
}

/**
 * CSV başlık satırından otomatik eşleştirme üretir.
 * Eşleşmeyen alan `-1` döner ve kullanıcı elle seçer.
 */
export function otomatikEsle(baslikSatiri: readonly string[]): Record<IceAktarimAlani, number> {
  const normal = baslikSatiri.map(baslikNormalle);
  const sonuc = {} as Record<IceAktarimAlani, number>;
  for (const alan of ICE_AKTARIM_ALANLARI) {
    const adaylar = BASLIK_ESLESMELERI[alan].map((a) => a.replace(/\s/gu, ''));
    sonuc[alan] = normal.findIndex((b) => adaylar.includes(b));
  }
  return sonuc;
}

/** Sunucuya gidecek satır — `TopluBolumSatiriDto` ile birebir aynı şekil. */
export interface TopluBolumSatiri {
  readonly kapiNo: string;
  readonly icKapiNo?: string;
  readonly nitelik?: string;
  readonly daireTipi?: string;
  readonly brutM2: number;
  readonly netM2: number;
  readonly arsaPayiPay: string;
  readonly arsaPayiPayda: string;
  readonly aidatMuafiyeti?: boolean;
}

export interface SatirSonucu {
  /** CSV'deki 1 tabanlı satır numarası — kullanıcı dosyada bu numarayı arar. */
  readonly satirNo: number;
  readonly ham: readonly string[];
  readonly deger: TopluBolumSatiri | null;
  /** Boşsa satır geçerlidir. Anahtarlar i18n anahtarıdır (CT-05). */
  readonly hatalar: readonly SatirHatasi[];
}

export interface SatirHatasi {
  readonly alan: IceAktarimAlani | 'genel';
  /** `filtre`/`iceAktar` namespace'inde çözülecek anahtar. */
  readonly anahtar: string;
  readonly baglam?: Readonly<Record<string, string | number>>;
}

function hucre(satir: readonly string[], indeks: number): string {
  return indeks < 0 ? '' : (satir[indeks] ?? '').trim();
}

/**
 * Tek satırı doğrular ve DTO şekline çevirir.
 *
 * `gorulenKapiNolari` dosya İÇİNDEKİ mükerrerliği yakalar. Sunucu da mükerrer
 * kapı numarasını reddeder ama tüm işlemi geri alır; kullanıcı hangi iki
 * satırın çakıştığını göremez.
 */
export function satiriCoz(
  ham: readonly string[],
  satirNo: number,
  eslesme: Readonly<Record<IceAktarimAlani, number>>,
  gorulenKapiNolari: ReadonlySet<string>,
): SatirSonucu {
  const hatalar: SatirHatasi[] = [];

  const kapiNo = hucre(ham, eslesme.kapiNo);
  if (kapiNo === '') hatalar.push({ alan: 'kapiNo', anahtar: 'hataZorunlu' });
  else if (kapiNo.length > 16) {
    hatalar.push({ alan: 'kapiNo', anahtar: 'hataUzun', baglam: { sinir: 16 } });
  } else if (gorulenKapiNolari.has(kapiNo.toLocaleLowerCase('tr'))) {
    hatalar.push({ alan: 'kapiNo', anahtar: 'hataMukerrer', baglam: { deger: kapiNo } });
  }

  const icKapiNo = hucre(ham, eslesme.icKapiNo);
  if (icKapiNo.length > 16) {
    hatalar.push({ alan: 'icKapiNo', anahtar: 'hataUzun', baglam: { sinir: 16 } });
  }

  const nitelikHam = hucre(ham, eslesme.nitelik);
  const nitelik = nitelikHam === '' ? undefined : nitelikHam.toLocaleUpperCase('tr');
  if (nitelik !== undefined && !(NITELIKLER as readonly string[]).includes(nitelik)) {
    hatalar.push({
      alan: 'nitelik', anahtar: 'hataKod',
      baglam: { deger: nitelikHam, gecerli: NITELIKLER.join(', ') },
    });
  }

  const daireTipiHam = hucre(ham, eslesme.daireTipi);
  const daireTipi = daireTipiHam === '' ? undefined : daireTipiHam.toLocaleUpperCase('tr');
  if (daireTipi !== undefined && !(DAIRE_TIPLERI as readonly string[]).includes(daireTipi)) {
    hatalar.push({
      alan: 'daireTipi', anahtar: 'hataKod',
      baglam: { deger: daireTipiHam, gecerli: DAIRE_TIPLERI.join(', ') },
    });
  }

  const brutM2 = sayiOku(hucre(ham, eslesme.brutM2));
  if (brutM2 === null) hatalar.push({ alan: 'brutM2', anahtar: 'hataSayi' });
  else if (brutM2 <= 0) hatalar.push({ alan: 'brutM2', anahtar: 'hataPozitif' });

  const netM2 = sayiOku(hucre(ham, eslesme.netM2));
  if (netM2 === null) hatalar.push({ alan: 'netM2', anahtar: 'hataSayi' });
  else if (netM2 <= 0) hatalar.push({ alan: 'netM2', anahtar: 'hataPozitif' });

  // Net m² brütü asamaz. Sunucu da reddeder; burada yakalamak kullaniciya
  // hangi satirda oldugunu gosterir.
  if (brutM2 !== null && netM2 !== null && brutM2 > 0 && netM2 > brutM2) {
    hatalar.push({ alan: 'netM2', anahtar: 'hataNetBrut' });
  }

  const arsaHam = hucre(ham, eslesme.arsaPayi);
  const arsa = kesirOku(arsaHam);
  if (arsaHam === '') hatalar.push({ alan: 'arsaPayi', anahtar: 'hataZorunlu' });
  else if (arsa === null) {
    hatalar.push({ alan: 'arsaPayi', anahtar: 'hataKesir', baglam: { deger: arsaHam } });
  }

  const muafHam = hucre(ham, eslesme.aidatMuafiyeti);

  if (hatalar.length > 0 || arsa === null || brutM2 === null || netM2 === null) {
    return { satirNo, ham, deger: null, hatalar };
  }

  return {
    satirNo,
    ham,
    hatalar: [],
    deger: {
      kapiNo,
      ...(icKapiNo === '' ? {} : { icKapiNo }),
      ...(nitelik === undefined ? {} : { nitelik }),
      ...(daireTipi === undefined ? {} : { daireTipi }),
      brutM2,
      netM2,
      arsaPayiPay: arsa.pay,
      arsaPayiPayda: arsa.payda,
      ...(muafHam === '' ? {} : { aidatMuafiyeti: mantikOku(muafHam) }),
    },
  };
}

/** Tüm satırları sırayla çözer; mükerrer kapı no takibi buradadır. */
export function satirlariCoz(
  satirlar: readonly (readonly string[])[],
  eslesme: Readonly<Record<IceAktarimAlani, number>>,
  ilkSatirBaslikMi: boolean,
): readonly SatirSonucu[] {
  const gorulenler = new Set<string>();
  const sonuc: SatirSonucu[] = [];
  const baslangic = ilkSatirBaslikMi ? 1 : 0;

  for (let i = baslangic; i < satirlar.length; i += 1) {
    const ham = satirlar[i] ?? [];
    const cozum = satiriCoz(ham, i + 1, eslesme, gorulenler);
    const kapiNo = hucre(ham, eslesme.kapiNo);
    if (kapiNo !== '') gorulenler.add(kapiNo.toLocaleLowerCase('tr'));
    sonuc.push(cozum);
  }
  return sonuc;
}

/** Kullanıcının indireceği örnek dosya — kolon adları ve bir örnek satır. */
export function sablonCsv(): string {
  const basliklar = [
    'kapiNo', 'icKapiNo', 'nitelik', 'daireTipi',
    'brutM2', 'netM2', 'arsaPayi', 'aidatMuafiyeti',
  ];
  const ornek = ['1', '1A', 'MESKEN', 'IKI_BIR', '120,50', '98,25', '45/1000', 'hayir'];
  // BOM + noktali virgul: Excel Turkce yerel ayari (bkz. disa-aktar.ts).
  return `﻿${basliklar.join(';')}\r\n${ornek.join(';')}`;
}
