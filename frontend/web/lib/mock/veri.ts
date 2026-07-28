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

/** Malik satırı — gerçek uçla (MalikSatiri) aynı şekil. */
export interface MockMalik {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly hisse: string;
  readonly tapuTuru: string;
  readonly tapuBaslangic: string;
  readonly tapuBitis: string | null;
  readonly tapuYevmiyeNo: string | null;
  readonly vekilKisiId: string | null;
  readonly vekilAdi: string | null;
  readonly vekaletnameNo: string | null;
  readonly vekaletBitisTarihi: string | null;
  readonly gecerliMi: boolean;
}

export interface MockHisseRaporu {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
  readonly tarih: string;
  readonly malikSayisi: number;
}

export interface MockKiraci {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly baslangic: string;
  readonly bitis: string | null;
  readonly sozlesmeNo: string | null;
  readonly sozlesmeTarihi: string | null;
  readonly depozito: string | null;
  readonly depozitoIadeTarihi: string | null;
  readonly tahliyeTarihi: string | null;
  readonly tahliyeGerekcesi: string | null;
  readonly gecerliMi: boolean;
}

export interface MockSakin {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly eposta: string | null;
  readonly telefon: string | null;
  readonly yakinlikDerecesi: string;
  readonly girisTarihi: string;
  readonly cikisTarihi: string | null;
  readonly acilDurumKisiAdi: string | null;
  readonly acilDurumTelefon: string | null;
  readonly gecerliMi: boolean;
}

/** Daire kartı — gerçek uçla (DaireKarti) aynı şekil. */
export interface MockDaireKarti {
  readonly bolum: MockBolum;
  readonly malikler: readonly MockMalik[];
  readonly hisseDurumu: MockHisseRaporu;
  readonly kiracilar: readonly MockKiraci[];
  readonly sakinler: readonly MockSakin[];
  readonly tarih: string | null;
}

/** Denetim kaydı — gerçek uçla (AuditSatiri) aynı şekil. */
export interface MockAuditSatiri {
  readonly id: string;
  readonly eylem: string;
  readonly varlik: string;
  readonly varlikId: string;
  readonly principalId: string;
  readonly principalTipi: string;
  readonly gerekce: string | null;
  readonly correlationId: string;
  readonly olusmaAni: string;
  readonly oncekiDeger: unknown;
  readonly sonrakiDeger: unknown;
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

/**
 * Daire kartı mock'u — bölüm kimliğinden TÜRETİLİR, sabittir.
 *
 * Her beşinci bölümde malik yok (hisse denetimi uyarısı görünsün), her
 * üçüncüsünde kiracı var. Yerleşim özetiyle AYNI kuralı kullanır; iki ekran
 * çelişkili veri göstermez.
 */
export function mockDaireKarti(bolumId: string): MockDaireKarti | null {
  const bolum = mockBolumler.find((b) => b.id === bolumId);
  if (bolum === undefined) return null;

  const i = mockBolumler.indexOf(bolum);
  const malikSayisi = i % 5 === 0 ? 0 : i % 3 === 0 ? 2 : 1;
  const hisseTam = i % 5 !== 0;

  const malikler: MockMalik[] = Array.from({ length: malikSayisi }, (_, m) => ({
    id: `malik-${bolumId}-${m}`,
    kisiId: `kisi-m-${i}-${m}`,
    kisiAdi: m === 0 ? 'Ayşe Yılmaz' : 'Mehmet Yılmaz',
    hisse: malikSayisi === 2 ? '1/2' : '1/1',
    tapuTuru: 'KAT_MULKIYETI',
    tapuBaslangic: '2020-03-15',
    tapuBitis: null,
    tapuYevmiyeNo: `2020/${1000 + i}`,
    vekilKisiId: null,
    vekilAdi: null,
    vekaletnameNo: null,
    vekaletBitisTarihi: null,
    gecerliMi: true,
  }));

  const kiraciVar = i % 3 === 1;
  const kiracilar: MockKiraci[] = kiraciVar
    ? [{
        id: `kiraci-${bolumId}`,
        kisiId: `kisi-k-${i}`,
        kisiAdi: 'Zeynep Demir',
        baslangic: '2025-09-01',
        bitis: null,
        sozlesmeNo: `K-2025-${100 + i}`,
        sozlesmeTarihi: '2025-08-20',
        depozito: '25000.0000',
        depozitoIadeTarihi: null,
        tahliyeTarihi: null,
        tahliyeGerekcesi: null,
        gecerliMi: true,
      }]
    : [];

  const sakinSayisi = i % 4;
  const sakinler: MockSakin[] = Array.from({ length: sakinSayisi }, (_, s) => ({
    id: `sakin-${bolumId}-${s}`,
    kisiId: `kisi-s-${i}-${s}`,
    kisiAdi: s === 0 ? 'Zeynep Demir' : 'Ali Demir',
    eposta: s === 0 ? 'zeynep@ornek.test' : null,
    telefon: '+90 532 000 00 00',
    yakinlikDerecesi: s === 0 ? 'KENDISI' : 'COCUK',
    girisTarihi: '2025-09-01',
    cikisTarihi: null,
    acilDurumKisiAdi: 'Fatma Demir',
    acilDurumTelefon: '+90 533 111 11 11',
    gecerliMi: true,
  }));

  return {
    bolum,
    malikler,
    hisseDurumu: {
      gecerli: hisseTam && malikSayisi > 0,
      toplam: malikSayisi === 0 ? '0.000000' : '1.000000',
      mesaj:
        malikSayisi === 0
          ? 'Bu tarihte geçerli malik kaydı yok. Bölüm sahipsiz görünüyor.'
          : 'Hisse oranları toplamı tamı ediyor.',
      tarih: '2026-07-28',
      malikSayisi,
    },
    kiracilar,
    sakinler,
    tarih: null,
  };
}

/** Denetim kaydı mock'u — bölüm kimliğine göre sabit üretilir. */
export function mockAuditKayitlari(varlikId: string): readonly MockAuditSatiri[] {
  return [
    {
      id: `audit-${varlikId}-2`, eylem: 'GUNCELLE', varlik: 'BagimsizBolum',
      varlikId, principalId: 'kullanici-1', principalTipi: 'INSAN',
      gerekce: null, correlationId: 'c-2', olusmaAni: '2026-06-14T09:12:00.000Z',
      oncekiDeger: { durum: 'BOS' }, sonrakiDeger: { durum: 'AKTIF' },
    },
    {
      id: `audit-${varlikId}-1`, eylem: 'OLUSTUR', varlik: 'BagimsizBolum',
      varlikId, principalId: 'kullanici-1', principalTipi: 'INSAN',
      gerekce: null, correlationId: 'c-1', olusmaAni: '2026-01-08T14:03:00.000Z',
      oncekiDeger: null, sonrakiDeger: { kapiNo: 'A11', nitelik: 'MESKEN' },
    },
  ];
}

export const mockYerlesim: MockYerlesimOzeti = {
  bolumSayisi: yerlesimSatirlari.length,
  malikKaydiOlmayan: yerlesimSatirlari.filter((s) => s.malikSayisi === 0).length,
  hissesiEksikOlan: yerlesimSatirlari.filter((s) => !s.hisseTam).length,
  kiracili: yerlesimSatirlari.filter((s) => s.kiraciVarMi).length,
  bos: yerlesimSatirlari.filter((s) => s.bosMu).length,
  satirlar: yerlesimSatirlari,
};
