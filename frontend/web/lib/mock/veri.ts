/**
 * Mock veri — backend çalışmadığında arayüzün geliştirilebilmesi için.
 *
 * NEDEN GEREKLİ: PostgreSQL kurulu değil (DEVLOG TODO-3), dolayısıyla backend
 * ayağa kalksa bile veri döndüremez. Arayüz geliştirmesi buna bağlı kalamaz.
 *
 * KURAL: Mock, gerçek uçların DÖNDÜĞÜ tipleri birebir taşır. Tip uyuşmazsa
 * arayüz mock'a göre çalışır, gerçeğe geçince bozulur — bu yüzden tipler
 * backend'in query servislerinden kopyalanır ve sapma derlemede yakalanır.
 */

export interface MockApartman {
  readonly id: string;
  readonly ad: string;
  readonly adres: string | null;
  readonly siteIciKod: string | null;
  readonly blokSayisi: number;
}

export interface MockBlok {
  readonly id: string;
  readonly ad: string;
  readonly apartmanId: string;
  readonly apartmanAdi: string;
  readonly katSayisi: number;
  readonly bolumSayisi: number;
}

export interface MockKat {
  readonly id: string;
  readonly blokId: string;
  readonly no: number;
  readonly ad: string | null;
  readonly bolumSayisi: number;
}

export interface MockBolum {
  readonly id: string;
  readonly kapiNo: string;
  readonly icKapiNo: string | null;
  readonly kat: number;
  readonly katId: string | null;
  readonly blokId: string | null;
  readonly nitelik: string;
  readonly daireTipi: string | null;
  readonly durum: string;
  readonly brutM2: number;
  readonly netM2: number;
  readonly arsaPayi: string;
  readonly aidatMuafiyeti: boolean;
}

/** Gerçek uç cursor sayfalama döner; mock da AYNI zarfı taşır. */
export interface SayfaliSonuc<T> {
  readonly kayitlar: readonly T[];
  readonly sonrakiImlec: string | null;
}

export interface MockYerlesimSatiri {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly blokAdi: string | null;
  readonly kat: number;
  readonly durum: string;
  readonly malikSayisi: number;
  readonly hisseTam: boolean;
  readonly kiraciVarMi: boolean;
  readonly sakinSayisi: number;
  readonly bosMu: boolean;
}

const APARTMAN_ID = 'ap-1';
const BLOK_A = 'blok-a';
const BLOK_B = 'blok-b';

export const mockApartmanlar: readonly MockApartman[] = [
  { id: APARTMAN_ID, ad: 'Güzel Apartmanı', adres: 'Bağdat Cad. No:12, Kadıköy/İstanbul', siteIciKod: null, blokSayisi: 2 },
];

export const mockBloklar: readonly MockBlok[] = [
  { id: BLOK_A, ad: 'A Blok', apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı', katSayisi: 4, bolumSayisi: 8 },
  { id: BLOK_B, ad: 'B Blok', apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı', katSayisi: 3, bolumSayisi: 6 },
];

export const mockKatlar: readonly MockKat[] = [
  { id: 'kat-a0', blokId: BLOK_A, no: 0, ad: 'Zemin', bolumSayisi: 2 },
  { id: 'kat-a1', blokId: BLOK_A, no: 1, ad: null, bolumSayisi: 2 },
  { id: 'kat-a2', blokId: BLOK_A, no: 2, ad: null, bolumSayisi: 2 },
  { id: 'kat-a3', blokId: BLOK_A, no: 3, ad: null, bolumSayisi: 2 },
  { id: 'kat-b0', blokId: BLOK_B, no: 0, ad: 'Zemin', bolumSayisi: 2 },
  { id: 'kat-b1', blokId: BLOK_B, no: 1, ad: null, bolumSayisi: 2 },
  { id: 'kat-b2', blokId: BLOK_B, no: 2, ad: null, bolumSayisi: 2 },
];

const NITELIKLER = ['MESKEN', 'MESKEN', 'MESKEN', 'ISYERI'] as const;
const DAIRE_TIPLERI = ['IKI_BIR', 'UC_BIR', 'BIR_BIR', 'DORT_BIR'] as const;
const DURUMLAR = ['AKTIF', 'AKTIF', 'AKTIF', 'BOS', 'TADILATTA'] as const;

/** 14 bölüm — iki blok, sabit üretilir (rastgelelik testleri kırılganlaştırır). */
export const mockBolumler: readonly MockBolum[] = mockKatlar.flatMap((kat, ki) =>
  [1, 2].map((sira, si): MockBolum => {
    const i = ki * 2 + si;
    const blokHarfi = kat.blokId === BLOK_A ? 'A' : 'B';
    return {
      id: `bolum-${kat.id}-${sira}`,
      kapiNo: `${blokHarfi}${kat.no}${sira}`,
      icKapiNo: null,
      kat: kat.no,
      katId: kat.id,
      blokId: kat.blokId,
      nitelik: NITELIKLER[i % NITELIKLER.length] as string,
      daireTipi: DAIRE_TIPLERI[i % DAIRE_TIPLERI.length] as string,
      durum: DURUMLAR[i % DURUMLAR.length] as string,
      brutM2: 95 + (i % 5) * 12,
      netM2: 78 + (i % 5) * 10,
      arsaPayi: `${5 + (i % 3)}/100`,
      aidatMuafiyeti: false,
    };
  }),
);

/** Bina geneli yerleşim özeti — gerçek uçla AYNI şekil. */
export interface MockYerlesimOzeti {
  readonly bolumSayisi: number;
  readonly malikKaydiOlmayan: number;
  readonly hissesiEksikOlan: number;
  readonly kiracili: number;
  readonly bos: number;
  readonly satirlar: readonly MockYerlesimSatiri[];
}

const yerlesimSatirlari: readonly MockYerlesimSatiri[] = mockBolumler.map((b, i) => ({
  bolumId: b.id,
  kapiNo: b.kapiNo,
  blokAdi: b.blokId === BLOK_A ? 'A Blok' : 'B Blok',
  kat: b.kat,
  durum: b.durum,
  malikSayisi: i % 5 === 0 ? 0 : (i % 3 === 0 ? 2 : 1),
  // Her besinci bolumde hisse eksik — denetim ekraninin sorunlu satir
  // gostermesi test edilebilsin diye kasitlidir.
  hisseTam: i % 5 !== 0,
  kiraciVarMi: i % 3 === 1,
  sakinSayisi: i % 4,
  bosMu: i % 5 === 0,
}));

export const mockYerlesim: MockYerlesimOzeti = {
  bolumSayisi: yerlesimSatirlari.length,
  malikKaydiOlmayan: yerlesimSatirlari.filter((s) => s.malikSayisi === 0).length,
  hissesiEksikOlan: yerlesimSatirlari.filter((s) => !s.hisseTam).length,
  kiracili: yerlesimSatirlari.filter((s) => s.kiraciVarMi).length,
  bos: yerlesimSatirlari.filter((s) => s.bosMu).length,
  satirlar: yerlesimSatirlari,
};
