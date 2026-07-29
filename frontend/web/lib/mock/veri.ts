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
/**
 * Bölümün BAŞLANGIÇ malik listesi — yazma örtüsünden bağımsız saf hesap.
 *
 * `malikleriAl` bunu çağırır; `mockDaireKarti` de örtüyü çağırır. İkisi
 * birbirini çağırsaydı sonsuz özyineleme olurdu.
 */
function varsayilanMalikler(bolumId: string, i: number): MockMalik[] {
  const malikSayisi = i % 5 === 0 ? 0 : i % 3 === 0 ? 2 : 1;
  return Array.from({ length: malikSayisi }, (_, m) => ({
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
}

export function mockDaireKarti(bolumId: string): MockDaireKarti | null {
  const bolum = mockBolumler.find((b) => b.id === bolumId);
  if (bolum === undefined) return null;

  const i = mockBolumler.indexOf(bolum);
  // Yazma ortusu varsa o gecerlidir; eklenen malik kartta gorunur.
  const malikler = malikleriAl(bolumId, varsayilanMalikler(bolumId, i));
  const gecerliMalikler = malikler.filter((m) => m.gecerliMi);
  const hisseTam = gecerliMalikler.length > 0;

  const kiraciVar = i % 3 === 1;
  const varsayilanKiracilar: MockKiraci[] = kiraciVar
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
  const varsayilanSakinler: MockSakin[] = Array.from({ length: sakinSayisi }, (_, s) => ({
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

  // Yazma ortuleri varsa onlar gecerlidir; eklenen kayit kartta gorunur.
  const kiracilar = kiracilariAl(bolumId, varsayilanKiracilar);
  const sakinler = sakinleriAl(bolumId, varsayilanSakinler);

  return {
    bolum,
    malikler,
    hisseDurumu: {
      gecerli: hisseTam,
      toplam: hisseTam ? '1.000000' : '0.000000',
      mesaj: hisseTam
        ? 'Hisse oranları toplamı tamı ediyor.'
        : 'Bu tarihte geçerli malik kaydı yok. Bölüm sahipsiz görünüyor.',
      tarih: '2026-07-28',
      malikSayisi: gecerliMalikler.length,
    },
    kiracilar,
    sakinler,
    tarih: null,
  };
}

/**
 * Mock yazma katmanı — oturum içi bellek örtüsü.
 *
 * NEDEN VAR: malik uçları backend'de GERÇEKTEN var, yalnızca veritabanı
 * çalışmıyor (TODO-3). Yazma işlemi hiçbir şey yapmasaydı kullanıcı formu
 * doldurur, "kaydedildi" görür ve liste değişmezdi — akış test edilemezdi.
 *
 * SINIR: örtü YALNIZCA bellektedir; sayfa yenilenince başlangıç durumuna
 * döner. Kalıcılık gerçek backend'in işidir ve taklit edilmez.
 */
const malikOrtusu = new Map<string, MockMalik[]>();

function malikleriAl(bolumId: string, varsayilan: readonly MockMalik[]): MockMalik[] {
  const mevcut = malikOrtusu.get(bolumId);
  if (mevcut !== undefined) return mevcut;
  const kopya = [...varsayilan];
  malikOrtusu.set(bolumId, kopya);
  return kopya;
}

export interface MockMalikEkle {
  readonly kisiAdi: string;
  readonly hissePay: string;
  readonly hissePayda: string;
  readonly tapuTuru: string;
  readonly tapuBaslangic: string;
  readonly tapuYevmiyeNo?: string;
}

export function mockMalikEkle(bolumId: string, dto: MockMalikEkle): MockMalik {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) throw new Error(`Bölüm bulunamadı: ${bolumId}`);
  const liste = malikleriAl(bolumId, kart.malikler);

  const yeni: MockMalik = {
    id: `malik-${bolumId}-${liste.length}-${liste.length + 1}`,
    kisiId: `kisi-yeni-${liste.length}`,
    kisiAdi: dto.kisiAdi,
    hisse: `${dto.hissePay}/${dto.hissePayda}`,
    tapuTuru: dto.tapuTuru,
    tapuBaslangic: dto.tapuBaslangic,
    tapuBitis: null,
    tapuYevmiyeNo: dto.tapuYevmiyeNo ?? null,
    vekilKisiId: null,
    vekilAdi: null,
    vekaletnameNo: null,
    vekaletBitisTarihi: null,
    gecerliMi: true,
  };
  liste.push(yeni);
  return yeni;
}

export function mockMalikDevret(bolumId: string, malikId: string, tapuBitis: string): void {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) throw new Error(`Bölüm bulunamadı: ${bolumId}`);
  const liste = malikleriAl(bolumId, kart.malikler);
  const i = liste.findIndex((m) => m.id === malikId);
  if (i < 0) throw new Error(`Malik kaydı bulunamadı: ${malikId}`);
  // Kayit SILINMEZ; donemi kapanir ve tarihcede kalir.
  liste[i] = { ...(liste[i] as MockMalik), tapuBitis, gecerliMi: false };
}

export function mockMalikDuzelt(
  bolumId: string,
  malikId: string,
  dto: { readonly tapuTuru?: string; readonly tapuYevmiyeNo?: string },
): void {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) throw new Error(`Bölüm bulunamadı: ${bolumId}`);
  const liste = malikleriAl(bolumId, kart.malikler);
  const i = liste.findIndex((m) => m.id === malikId);
  if (i < 0) throw new Error(`Malik kaydı bulunamadı: ${malikId}`);
  const mevcut = liste[i] as MockMalik;
  liste[i] = {
    ...mevcut,
    ...(dto.tapuTuru === undefined ? {} : { tapuTuru: dto.tapuTuru }),
    ...(dto.tapuYevmiyeNo === undefined ? {} : { tapuYevmiyeNo: dto.tapuYevmiyeNo }),
  };
}

/** Örtü varsa onu, yoksa hesaplanan varsayılanı döner. */
export function mockMalikleriOku(bolumId: string): readonly MockMalik[] | null {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) return null;
  return malikleriAl(bolumId, kart.malikler);
}

// --- Kiracı ve Sakin yazma örtüleri (aynı bellek-içi mantık) ---

const kiraciOrtusu = new Map<string, MockKiraci[]>();
const sakinOrtusu = new Map<string, MockSakin[]>();

function kiracilariAl(bolumId: string, varsayilan: readonly MockKiraci[]): MockKiraci[] {
  const mevcut = kiraciOrtusu.get(bolumId);
  if (mevcut !== undefined) return mevcut;
  const kopya = [...varsayilan];
  kiraciOrtusu.set(bolumId, kopya);
  return kopya;
}

function sakinleriAl(bolumId: string, varsayilan: readonly MockSakin[]): MockSakin[] {
  const mevcut = sakinOrtusu.get(bolumId);
  if (mevcut !== undefined) return mevcut;
  const kopya = [...varsayilan];
  sakinOrtusu.set(bolumId, kopya);
  return kopya;
}

export interface MockKiraciEkle {
  readonly kisiAdi: string;
  readonly baslangic: string;
  readonly bitis?: string;
  readonly sozlesmeNo?: string;
  readonly depozito?: string;
}

export function mockKiraciEkle(bolumId: string, dto: MockKiraciEkle): void {
  const liste = kiraciOrtusu.get(bolumId) ?? [];

  // Kiraci TEKILLIGI: bir bolumde ayni anda en fazla bir gecerli sozlesme.
  // Domain kurali (iliskiyiDogrula) sunucuda zorlanir; burada kullaniciya
  // HIZLI geri bildirim icin tekrarlanir.
  if (liste.some((k) => k.gecerliMi)) {
    throw new Error('Bu bölümde geçerli bir kira sözleşmesi zaten var.');
  }

  liste.push({
    id: `kiraci-${bolumId}-${liste.length}`,
    kisiId: `kisi-k-yeni-${liste.length}`,
    kisiAdi: dto.kisiAdi,
    baslangic: dto.baslangic,
    bitis: dto.bitis ?? null,
    sozlesmeNo: dto.sozlesmeNo ?? null,
    sozlesmeTarihi: null,
    depozito: dto.depozito ?? null,
    depozitoIadeTarihi: null,
    tahliyeTarihi: null,
    tahliyeGerekcesi: null,
    gecerliMi: true,
  });
  kiraciOrtusu.set(bolumId, liste);
}

export function mockKiraciTahliye(
  bolumId: string, kiraciId: string, tahliyeTarihi: string, gerekce: string,
): void {
  const liste = kiraciOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((k) => k.id === kiraciId);
  if (i < 0) throw new Error(`Kiracı kaydı bulunamadı: ${kiraciId}`);
  const mevcut = liste[i] as MockKiraci;
  // Tahliye sozlesmeyi de kapatir: bitis bos kalirsa iliski suresiz gorunur
  // ve yeni kiraci eklenemez.
  liste[i] = {
    ...mevcut, tahliyeTarihi, tahliyeGerekcesi: gerekce,
    bitis: tahliyeTarihi, gecerliMi: false,
  };
}

export function mockKiraciDuzelt(
  bolumId: string,
  kiraciId: string,
  dto: { readonly sozlesmeNo?: string; readonly depozito?: string; readonly bitis?: string },
): void {
  const liste = kiraciOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((k) => k.id === kiraciId);
  if (i < 0) throw new Error(`Kiracı kaydı bulunamadı: ${kiraciId}`);
  const mevcut = liste[i] as MockKiraci;

  if (mevcut.tahliyeTarihi !== null && dto.bitis !== undefined) {
    throw new Error('Tahliye edilmiş bir sözleşmenin bitiş tarihi değiştirilemez.');
  }
  if (dto.bitis !== undefined && dto.bitis < mevcut.baslangic) {
    throw new Error(`Sözleşme bitişi başlangıçtan (${mevcut.baslangic}) önce olamaz.`);
  }

  liste[i] = {
    ...mevcut,
    ...(dto.sozlesmeNo === undefined ? {} : { sozlesmeNo: dto.sozlesmeNo }),
    ...(dto.depozito === undefined ? {} : { depozito: dto.depozito }),
    ...(dto.bitis === undefined ? {} : { bitis: dto.bitis }),
  };
}

export function mockSakinDuzelt(
  bolumId: string,
  sakinId: string,
  dto: {
    readonly yakinlikDerecesi?: string;
    readonly girisTarihi?: string;
    readonly acilDurumKisiAdi?: string;
    readonly acilDurumTelefon?: string;
  },
): void {
  const liste = sakinOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((s) => s.id === sakinId);
  if (i < 0) throw new Error(`Sakin kaydı bulunamadı: ${sakinId}`);
  const mevcut = liste[i] as MockSakin;

  if (
    dto.girisTarihi !== undefined &&
    mevcut.cikisTarihi !== null &&
    mevcut.cikisTarihi < dto.girisTarihi
  ) {
    throw new Error(
      `Giriş tarihi mevcut çıkış tarihinden (${mevcut.cikisTarihi}) sonra olamaz.`,
    );
  }

  liste[i] = {
    ...mevcut,
    ...(dto.yakinlikDerecesi === undefined ? {} : { yakinlikDerecesi: dto.yakinlikDerecesi }),
    ...(dto.girisTarihi === undefined ? {} : { girisTarihi: dto.girisTarihi }),
    ...(dto.acilDurumKisiAdi === undefined ? {} : { acilDurumKisiAdi: dto.acilDurumKisiAdi }),
    ...(dto.acilDurumTelefon === undefined ? {} : { acilDurumTelefon: dto.acilDurumTelefon }),
  };
}

export interface MockSakinEkle {
  readonly kisiAdi: string;
  readonly yakinlikDerecesi: string;
  readonly girisTarihi: string;
  readonly telefon?: string;
  readonly acilDurumKisiAdi?: string;
  readonly acilDurumTelefon?: string;
}

export function mockSakinEkle(bolumId: string, dto: MockSakinEkle): void {
  const liste = sakinOrtusu.get(bolumId) ?? [];
  // Sakin TEKILLIGI YOKTUR — bir dairede ayni anda birden cok sakin gecerlidir.
  liste.push({
    id: `sakin-${bolumId}-${liste.length}`,
    kisiId: `kisi-s-yeni-${liste.length}`,
    kisiAdi: dto.kisiAdi,
    eposta: null,
    telefon: dto.telefon ?? null,
    yakinlikDerecesi: dto.yakinlikDerecesi,
    girisTarihi: dto.girisTarihi,
    cikisTarihi: null,
    acilDurumKisiAdi: dto.acilDurumKisiAdi ?? null,
    acilDurumTelefon: dto.acilDurumTelefon ?? null,
    gecerliMi: true,
  });
  sakinOrtusu.set(bolumId, liste);
}

// --- Apartman ve Blok yazma örtüleri ---

let apartmanOrtusu: MockApartman[] | null = null;
let blokOrtusu: MockBlok[] | null = null;

export function mockApartmanlariOku(): readonly MockApartman[] {
  apartmanOrtusu ??= [...mockApartmanlar];
  return apartmanOrtusu;
}

export function mockBloklariOku(apartmanId?: string): readonly MockBlok[] {
  blokOrtusu ??= [...mockBloklar];
  return apartmanId === undefined
    ? blokOrtusu
    : blokOrtusu.filter((b) => b.apartmanId === apartmanId);
}

export function mockApartmanEkle(ad: string, adres?: string, siteIciKod?: string): void {
  const liste = apartmanOrtusu ?? (apartmanOrtusu = [...mockApartmanlar]);
  if (liste.some((a) => a.ad === ad)) {
    throw new Error(`'${ad}' adında bir apartman bu yerleşkede zaten var.`);
  }
  liste.push({
    id: `ap-yeni-${liste.length}`,
    ad,
    adres: adres ?? null,
    siteIciKod: siteIciKod ?? null,
    blokSayisi: 0,
  });
}

export function mockApartmanGuncelle(
  id: string,
  dto: { readonly ad?: string; readonly adres?: string; readonly siteIciKod?: string },
): void {
  const liste = apartmanOrtusu ?? (apartmanOrtusu = [...mockApartmanlar]);
  const i = liste.findIndex((a) => a.id === id);
  if (i < 0) throw new Error(`Apartman bulunamadı: ${id}`);
  if (dto.ad !== undefined && liste.some((a) => a.id !== id && a.ad === dto.ad)) {
    throw new Error(`'${dto.ad}' adında bir apartman bu yerleşkede zaten var.`);
  }
  liste[i] = {
    ...(liste[i] as MockApartman),
    ...(dto.ad === undefined ? {} : { ad: dto.ad }),
    ...(dto.adres === undefined ? {} : { adres: dto.adres }),
    ...(dto.siteIciKod === undefined ? {} : { siteIciKod: dto.siteIciKod }),
  };
}

export function mockApartmanSil(id: string): void {
  const liste = apartmanOrtusu ?? (apartmanOrtusu = [...mockApartmanlar]);
  const a = liste.find((x) => x.id === id);
  if (a === undefined) throw new Error(`Apartman bulunamadı: ${id}`);
  // Referans butunlugu: bloklu apartman silinirse bloklar sahipsiz kalir.
  if (a.blokSayisi > 0) {
    throw new Error(`'${a.ad}' apartmanında ${a.blokSayisi} blok var; apartman silinemez.`);
  }
  apartmanOrtusu = liste.filter((x) => x.id !== id);
}

export function mockBlokEkle(apartmanId: string, ad: string): void {
  const apartmanlar = apartmanOrtusu ?? (apartmanOrtusu = [...mockApartmanlar]);
  const apartman = apartmanlar.find((a) => a.id === apartmanId);
  if (apartman === undefined) throw new Error(`Apartman bulunamadı: ${apartmanId}`);

  const liste = blokOrtusu ?? (blokOrtusu = [...mockBloklar]);
  // Blok adi APARTMAN ICINDE tekildir; sitede iki apartmanin da "A Blok"u olabilir.
  if (liste.some((b) => b.apartmanId === apartmanId && b.ad === ad)) {
    throw new Error(`'${apartman.ad}' apartmanında '${ad}' adında bir blok zaten var.`);
  }
  liste.push({
    id: `blok-yeni-${liste.length}`,
    ad,
    apartmanId,
    apartmanAdi: apartman.ad,
    katSayisi: 0,
    bolumSayisi: 0,
  });
  const ai = apartmanlar.findIndex((a) => a.id === apartmanId);
  apartmanlar[ai] = { ...apartman, blokSayisi: apartman.blokSayisi + 1 };
}

export function mockBlokGuncelle(id: string, ad: string): void {
  const liste = blokOrtusu ?? (blokOrtusu = [...mockBloklar]);
  const i = liste.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`Blok bulunamadı: ${id}`);
  const mevcut = liste[i] as MockBlok;
  if (liste.some((b) => b.id !== id && b.apartmanId === mevcut.apartmanId && b.ad === ad)) {
    throw new Error(`Bu apartmanda '${ad}' adında bir blok zaten var.`);
  }
  // Blok BASKA APARTMANA TASINMAZ; yalnizca ad degisir.
  liste[i] = { ...mevcut, ad };
}

export function mockBlokSil(id: string): void {
  const liste = blokOrtusu ?? (blokOrtusu = [...mockBloklar]);
  const b = liste.find((x) => x.id === id);
  if (b === undefined) throw new Error(`Blok bulunamadı: ${id}`);
  if (b.bolumSayisi > 0) {
    throw new Error(`'${b.ad}' bloğunda ${b.bolumSayisi} bağımsız bölüm var; blok silinemez.`);
  }
  blokOrtusu = liste.filter((x) => x.id !== id);

  const apartmanlar = apartmanOrtusu ?? (apartmanOrtusu = [...mockApartmanlar]);
  const ai = apartmanlar.findIndex((a) => a.id === b.apartmanId);
  if (ai >= 0) {
    const a = apartmanlar[ai] as MockApartman;
    apartmanlar[ai] = { ...a, blokSayisi: Math.max(0, a.blokSayisi - 1) };
  }
}

// --- Kat yazma örtüsü ---

const katOrtusu = new Map<string, MockKat[]>();

/** Bloğun katları — örtü varsa o geçerlidir. */
export function mockKatlariOku(blokId: string): readonly MockKat[] {
  const mevcut = katOrtusu.get(blokId);
  if (mevcut !== undefined) return mevcut;
  const kopya = mockKatlar.filter((k) => k.blokId === blokId);
  katOrtusu.set(blokId, kopya);
  return kopya;
}

function katListesi(blokId: string): MockKat[] {
  mockKatlariOku(blokId);
  return katOrtusu.get(blokId) as MockKat[];
}

export function mockKatEkle(blokId: string, no: number, ad?: string): void {
  const liste = katListesi(blokId);
  // Kat no BLOK ICINDE tekildir; sunucu da ayni kurali uygular.
  if (liste.some((k) => k.no === no)) {
    throw new Error(`Bu blokta ${no}. kat zaten tanımlı.`);
  }
  liste.push({
    id: `kat-yeni-${blokId}-${no}`,
    blokId,
    no,
    ad: ad ?? null,
    bolumSayisi: 0,
  });
  liste.sort((a, b) => a.no - b.no);
}

export function mockKatGuncelle(
  blokId: string, katId: string, dto: { readonly no?: number; readonly ad?: string },
): void {
  const liste = katListesi(blokId);
  const i = liste.findIndex((k) => k.id === katId);
  if (i < 0) throw new Error(`Kat bulunamadı: ${katId}`);
  const mevcut = liste[i] as MockKat;

  if (dto.no !== undefined && dto.no !== mevcut.no) {
    // Bolumu olan katin NUMARASI degistirilemez: bolumlerin `kat` alani bu
    // numaraya baglidir ve olusturmada esitligi zorlanir.
    if (mevcut.bolumSayisi > 0) {
      throw new Error(
        `${mevcut.no}. katta ${mevcut.bolumSayisi} bağımsız bölüm var; kat numarası değiştirilemez.`,
      );
    }
    if (liste.some((k) => k.id !== katId && k.no === dto.no)) {
      throw new Error(`Bu blokta ${dto.no}. kat zaten tanımlı.`);
    }
  }

  liste[i] = {
    ...mevcut,
    ...(dto.no === undefined ? {} : { no: dto.no }),
    ...(dto.ad === undefined ? {} : { ad: dto.ad }),
  };
  liste.sort((a, b) => a.no - b.no);
}

export function mockKatSil(blokId: string, katId: string): void {
  const liste = katListesi(blokId);
  const kat = liste.find((k) => k.id === katId);
  if (kat === undefined) throw new Error(`Kat bulunamadı: ${katId}`);
  if (kat.bolumSayisi > 0) {
    throw new Error(
      `${kat.no}. katta ${kat.bolumSayisi} bağımsız bölüm var; kat silinemez.`,
    );
  }
  katOrtusu.set(blokId, liste.filter((k) => k.id !== katId));
}

// --- Bölüm yazma örtüsü (toplu oluşturma · taşıma) ---

let bolumOrtusu: MockBolum[] | null = null;

export function mockBolumleriOku(): readonly MockBolum[] {
  return bolumOrtusu ?? mockBolumler;
}

function bolumListesi(): MockBolum[] {
  return bolumOrtusu ?? (bolumOrtusu = [...mockBolumler]);
}

/** Blok ve kat sayaçlarını örtüde günceller. */
function sayaclariArtir(blokId: string, katId: string | null, artis: number): void {
  const bloklar = blokOrtusu ?? (blokOrtusu = [...mockBloklar]);
  const bi = bloklar.findIndex((b) => b.id === blokId);
  if (bi >= 0) {
    const b = bloklar[bi] as MockBlok;
    bloklar[bi] = { ...b, bolumSayisi: Math.max(0, b.bolumSayisi + artis) };
  }
  if (katId === null) return;
  const katlar = katOrtusu.get(blokId);
  if (katlar === undefined) return;
  const ki = katlar.findIndex((k) => k.id === katId);
  if (ki >= 0) {
    const k = katlar[ki] as MockKat;
    katlar[ki] = { ...k, bolumSayisi: Math.max(0, k.bolumSayisi + artis) };
  }
}

export interface MockTopluBolumSatiri {
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

/**
 * Toplu oluşturma — TEK İŞLEM. Bir satır geçersizse hiçbiri yazılmaz;
 * sunucu da böyle davranır. Yarım yazılmış kat, arsa payı toplamını da yarım
 * bırakır ve neyin eksik olduğu görünmez.
 */
export function mockBolumTopluOlustur(
  blokId: string, katId: string | null, kat: number,
  satirlar: readonly MockTopluBolumSatiri[],
): number {
  const liste = bolumListesi();

  // Kapi no BLOK ICINDE tekildir; once tumu denetlenir, sonra yazilir.
  const blokKapilari = new Set(
    liste.filter((b) => b.blokId === blokId).map((b) => b.kapiNo.toLocaleLowerCase('tr')),
  );
  for (const s of satirlar) {
    const anahtar = s.kapiNo.toLocaleLowerCase('tr');
    if (blokKapilari.has(anahtar)) {
      throw new Error(`'${s.kapiNo}' kapı numarası bu blokta zaten kayıtlı; hiçbir satır yazılmadı.`);
    }
    blokKapilari.add(anahtar);
  }

  for (const [i, s] of satirlar.entries()) {
    liste.push({
      id: `bolum-ice-${blokId}-${kat}-${i}-${s.kapiNo}`,
      kapiNo: s.kapiNo,
      icKapiNo: s.icKapiNo ?? null,
      kat,
      katId,
      blokId,
      nitelik: s.nitelik ?? 'MESKEN',
      daireTipi: s.daireTipi ?? null,
      durum: 'AKTIF',
      brutM2: s.brutM2,
      netM2: s.netM2,
      arsaPayi: `${s.arsaPayiPay}/${s.arsaPayiPayda}`,
      aidatMuafiyeti: s.aidatMuafiyeti ?? false,
    });
  }

  sayaclariArtir(blokId, katId, satirlar.length);
  return satirlar.length;
}

/**
 * Toplu taşıma — TEK İŞLEM. `hedefKatId` verilirse bölümün `kat` alanı katın
 * numarasıyla EŞİTLENİR; eşitlenmezse bölüm bir katta, `kat` alanı başka bir
 * numarada kalır ve hiyerarşi denetimi sonsuza dek uyarı üretir.
 */
export function mockBolumTasi(
  bolumIdler: readonly string[], hedefBlokId: string, hedefKatId: string | null,
): number {
  const liste = bolumListesi();
  const hedefKat = hedefKatId === null
    ? null
    : (katOrtusu.get(hedefBlokId) ?? mockKatlar.filter((k) => k.blokId === hedefBlokId))
      .find((k) => k.id === hedefKatId);

  if (hedefKatId !== null && hedefKat === undefined) {
    throw new Error('Hedef kat seçilen bloğa ait değil.');
  }

  const tasinacak = bolumIdler
    .map((id) => liste.findIndex((b) => b.id === id))
    .filter((i) => i >= 0);
  if (tasinacak.length !== bolumIdler.length) {
    throw new Error('Bölümlerden biri bulunamadı; hiçbiri taşınmadı.');
  }

  // Hedef blokta kapi no cakismasi varsa HICBIRI tasinmaz.
  const hedefKapilari = new Set(
    liste.filter((b) => b.blokId === hedefBlokId && !bolumIdler.includes(b.id))
      .map((b) => b.kapiNo.toLocaleLowerCase('tr')),
  );
  for (const i of tasinacak) {
    const b = liste[i] as MockBolum;
    if (hedefKapilari.has(b.kapiNo.toLocaleLowerCase('tr'))) {
      throw new Error(`Hedef blokta '${b.kapiNo}' kapı numarası zaten var; hiçbiri taşınmadı.`);
    }
  }

  for (const i of tasinacak) {
    const b = liste[i] as MockBolum;
    sayaclariArtir(b.blokId ?? hedefBlokId, b.katId, -1);
    liste[i] = {
      ...b,
      blokId: hedefBlokId,
      katId: hedefKatId,
      ...(hedefKat === undefined || hedefKat === null ? {} : { kat: hedefKat.no }),
    };
    sayaclariArtir(hedefBlokId, hedefKatId, 1);
  }
  return tasinacak.length;
}

/** Gider türü satırı — gerçek uçla (`GiderTuruSatiri`) aynı şekil. */
export interface MockGiderTuru {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly paylasimKurali: string;
  readonly sorumlulukTipi: string;
  readonly kuralKaynagi: string;
  readonly kaynakReferansi: string | null;
  readonly karmaBilesenler: readonly { kural: string; yuzde: number }[] | null;
  readonly malikPaylasimi: string;
  readonly aktifMi: boolean;
  readonly ozelKuralMi: boolean;
}

/**
 * KMK md. 20 varsayılanları — tohum verisiyle AYNI liste.
 *
 * Mock ile gerçek uç arasında fark olmaması önemlidir: arayüz mock'ta
 * çalışıp gerçekte çalışmazsa fark ancak sahada görülür.
 */
const mockGiderTurleriTaban: readonly MockGiderTuru[] = [
  ['KAPICI', 'Kapıcı gideri', 'ESIT', 'KULLANANA_AIT'],
  ['ANA_BAKIM', 'Anagayrimenkul bakım ve onarım', 'ARSA_PAYI', 'MALIKE_AIT'],
  ['SIGORTA', 'Bina sigortası', 'ARSA_PAYI', 'MALIKE_AIT'],
  ['YENILEME_FONU', 'Yenileme fonu', 'ARSA_PAYI', 'MALIKE_AIT'],
  ['ISITMA', 'Isıtma gideri', 'TUKETIM', 'KULLANANA_AIT'],
  ['SU', 'Su gideri', 'TUKETIM', 'KULLANANA_AIT'],
  ['ASANSOR_ISLETME', 'Asansör işletme gideri', 'ESIT', 'KULLANANA_AIT'],
  ['ELEKTRIK_ORTAK', 'Ortak alan elektriği', 'ESIT', 'KULLANANA_AIT'],
  ['TEMIZLIK', 'Temizlik gideri', 'ESIT', 'KULLANANA_AIT'],
  ['YONETIM', 'Yönetim gideri', 'ESIT', 'KULLANANA_AIT'],
].map(([kod, ad, kural, sorumluluk]) => ({
  id: `gt-${kod as string}`,
  kod: kod as string,
  ad: ad as string,
  paylasimKurali: kural as string,
  sorumlulukTipi: sorumluluk as string,
  kuralKaynagi: 'KMK_VARSAYILAN',
  kaynakReferansi: null,
  karmaBilesenler: null,
  malikPaylasimi: 'HISSE_ORANI',
  aktifMi: true,
  ozelKuralMi: false,
}));

let giderTuruOrtusu: MockGiderTuru[] | null = null;

export function mockGiderTurleriniOku(yalnizcaAktif = false): readonly MockGiderTuru[] {
  const liste = giderTuruOrtusu ?? mockGiderTurleriTaban;
  return yalnizcaAktif ? liste.filter((g) => g.aktifMi) : liste;
}

function giderTuruListesi(): MockGiderTuru[] {
  return giderTuruOrtusu ?? (giderTuruOrtusu = [...mockGiderTurleriTaban]);
}

export interface MockGiderTuruGirdisi {
  readonly kod: string;
  readonly ad: string;
  readonly paylasimKurali: string;
  readonly sorumlulukTipi: string;
  readonly kuralKaynagi: string;
  readonly kaynakReferansi?: string;
  readonly karmaBilesenler?: readonly { kural: string; yuzde: number }[];
  readonly malikPaylasimi?: string;
  readonly aktifMi?: boolean;
}

/**
 * Sunucudaki `giderTuruDogrula` ile AYNI kuralları uygular.
 *
 * Mock gevşek olsaydı arayüz mock'ta kabul edip gerçekte reddedilirdi;
 * geliştirici hatayı ancak backend'e bağlandığında görürdü.
 */
function giderTuruDogrulaMock(g: MockGiderTuruGirdisi): void {
  if (g.kuralKaynagi !== 'KMK_VARSAYILAN' && (g.kaynakReferansi ?? '').trim() === '') {
    throw new Error(
      `'${g.kod}': ${g.kuralKaynagi} kaynaklı kural referans taşımalıdır ` +
        '(yönetim planı maddesi veya genel kurul karar no).',
    );
  }
  const bilesenler = g.karmaBilesenler ?? [];
  if (g.paylasimKurali === 'KARMA') {
    if (bilesenler.length === 0) {
      throw new Error(`'${g.kod}': KARMA paylaşım en az bir bileşen taşımalıdır.`);
    }
    const toplam = bilesenler.reduce((t, b) => t + b.yuzde, 0);
    if (toplam !== 100) {
      throw new Error(
        `'${g.kod}': KARMA bileşenlerinin toplamı 100 olmalıdır, ${toplam} verildi. ` +
          'Aksi halde giderin bir kısmı dağıtılmadan kalır ya da fazla dağıtılır.',
      );
    }
    if (bilesenler.length !== new Set(bilesenler.map((b) => b.kural)).size) {
      throw new Error(`'${g.kod}': aynı kural KARMA içinde birden fazla kez kullanılamaz.`);
    }
  } else if (bilesenler.length > 0) {
    throw new Error(
      `'${g.kod}': karma bileşenler yalnızca KARMA paylaşımında tanımlanır, ` +
        `kural '${g.paylasimKurali}'.`,
    );
  }
}

export function mockGiderTuruEkle(dto: MockGiderTuruGirdisi): void {
  const liste = giderTuruListesi();
  const kod = dto.kod.trim().toLocaleUpperCase('tr');
  giderTuruDogrulaMock({ ...dto, kod });
  if (liste.some((g) => g.kod === kod)) {
    throw new Error(`'${kod}' kodlu gider türü zaten tanımlı.`);
  }
  liste.push({
    id: `gt-yeni-${kod}`,
    kod,
    ad: dto.ad.trim(),
    paylasimKurali: dto.paylasimKurali,
    sorumlulukTipi: dto.sorumlulukTipi,
    kuralKaynagi: dto.kuralKaynagi,
    kaynakReferansi: dto.kaynakReferansi?.trim() ?? null,
    karmaBilesenler: dto.paylasimKurali === 'KARMA' ? (dto.karmaBilesenler ?? []) : null,
    malikPaylasimi: dto.malikPaylasimi ?? 'HISSE_ORANI',
    aktifMi: dto.aktifMi ?? true,
    ozelKuralMi: dto.kuralKaynagi !== 'KMK_VARSAYILAN',
  });
  liste.sort((a, b) => a.kod.localeCompare(b.kod, 'tr'));
}

export function mockGiderTuruGuncelle(
  id: string,
  dto: Partial<MockGiderTuruGirdisi>,
): void {
  const liste = giderTuruListesi();
  const i = liste.findIndex((g) => g.id === id);
  if (i < 0) throw new Error(`Gider türü bulunamadı: ${id}`);
  const mevcut = liste[i] as MockGiderTuru;

  const birlesik: MockGiderTuruGirdisi = {
    kod: mevcut.kod,
    ad: dto.ad ?? mevcut.ad,
    paylasimKurali: dto.paylasimKurali ?? mevcut.paylasimKurali,
    sorumlulukTipi: dto.sorumlulukTipi ?? mevcut.sorumlulukTipi,
    kuralKaynagi: dto.kuralKaynagi ?? mevcut.kuralKaynagi,
    ...(dto.kaynakReferansi ?? mevcut.kaynakReferansi
      ? { kaynakReferansi: dto.kaynakReferansi ?? mevcut.kaynakReferansi ?? '' }
      : {}),
    ...((dto.karmaBilesenler ?? mevcut.karmaBilesenler)
      ? { karmaBilesenler: dto.karmaBilesenler ?? mevcut.karmaBilesenler ?? [] }
      : {}),
  };
  giderTuruDogrulaMock(birlesik);

  const yeniKural = birlesik.paylasimKurali;
  liste[i] = {
    ...mevcut,
    ad: birlesik.ad,
    paylasimKurali: yeniKural,
    sorumlulukTipi: birlesik.sorumlulukTipi,
    kuralKaynagi: birlesik.kuralKaynagi,
    kaynakReferansi: birlesik.kaynakReferansi ?? null,
    // KARMA'dan cikildiginda bilesenler TEMIZLENIR — sunucu tarafi da boyle.
    karmaBilesenler: yeniKural === 'KARMA' ? (birlesik.karmaBilesenler ?? []) : null,
    ...(dto.malikPaylasimi === undefined ? {} : { malikPaylasimi: dto.malikPaylasimi }),
    ...(dto.aktifMi === undefined ? {} : { aktifMi: dto.aktifMi }),
    ozelKuralMi: birlesik.kuralKaynagi !== 'KMK_VARSAYILAN',
  };
}

export function mockGiderTuruSil(id: string): void {
  const liste = giderTuruListesi();
  const i = liste.findIndex((g) => g.id === id);
  if (i < 0) throw new Error(`Gider türü bulunamadı: ${id}`);
  // Kayit SILINMEZ, pasife alinir: gecmis tahakkuklar bu ture baglidir.
  liste[i] = { ...(liste[i] as MockGiderTuru), aktifMi: false };
}

/* ---------------------------- Konut çalışanları ---------------------------- */

export interface MockSertifika {
  readonly id: string;
  readonly ad: string;
  readonly kurum: string | null;
  readonly belgeNo: string | null;
  readonly verilisTarihi: string;
  readonly gecerlilikBitisi: string | null;
  readonly suresiDolduMu: boolean;
}

export interface MockZimmet {
  readonly id: string;
  readonly ad: string;
  readonly seriNo: string | null;
  readonly adet: number;
  readonly zimmetTarihi: string;
  readonly iadeTarihi: string | null;
  readonly acikMi: boolean;
  readonly notlar: string | null;
}

/** Konut çalışanı satırı — gerçek uçla (`CalisanSatiri`) aynı şekil. */
export interface MockKonutCalisani {
  readonly id: string;
  readonly apartmanId: string | null;
  readonly apartmanAdi: string | null;
  readonly ad: string;
  readonly soyad: string;
  readonly adSoyad: string;
  readonly gorev: string;
  readonly departman: string | null;
  readonly telefon: string | null;
  readonly eposta: string | null;
  readonly tcKimlikNo: string | null;
  readonly sgkNo: string | null;
  readonly iseGirisTarihi: string;
  readonly istenAyrilisTarihi: string | null;
  readonly vardiya: string;
  readonly durum: string;
  readonly notlar: string | null;
  readonly sertifikalar: readonly MockSertifika[];
  readonly zimmetler: readonly MockZimmet[];
  readonly acikZimmetSayisi: number;
  readonly suresiDolanSertifikaSayisi: number;
}

const mockCalisanlarTaban: readonly MockKonutCalisani[] = [
  {
    id: 'kc-1', apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı',
    ad: 'Ahmet', soyad: 'Yıldız', adSoyad: 'Ahmet Yıldız',
    gorev: 'GUVENLIK', departman: 'Güvenlik Amirliği',
    telefon: '05321112233', eposta: 'ahmet@site.test',
    tcKimlikNo: null, sgkNo: '1234567890123',
    iseGirisTarihi: '2025-03-01', istenAyrilisTarihi: null,
    vardiya: 'GECE', durum: 'AKTIF', notlar: null,
    sertifikalar: [
      {
        id: 'srt-1', ad: 'Özel Güvenlik Kimlik Kartı',
        kurum: 'Emniyet Genel Müdürlüğü', belgeNo: 'OG-2021-4471',
        verilisTarihi: '2021-04-01', gecerlilikBitisi: '2026-04-01',
        // Süresi DOLMUŞ — ekranın uyarı gösterdiği doğrulanabilsin diye.
        suresiDolduMu: true,
      },
    ],
    zimmetler: [
      {
        id: 'zmt-1', ad: 'Telsiz', seriNo: 'TLS-0042', adet: 1,
        zimmetTarihi: '2025-03-01', iadeTarihi: null, acikMi: true, notlar: null,
      },
    ],
    acikZimmetSayisi: 1, suresiDolanSertifikaSayisi: 1,
  },
  {
    id: 'kc-2', apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı',
    ad: 'Fatma', soyad: 'Kaya', adSoyad: 'Fatma Kaya',
    gorev: 'TEMIZLIK', departman: null,
    telefon: '05334445566', eposta: null,
    tcKimlikNo: null, sgkNo: null,
    iseGirisTarihi: '2024-09-15', istenAyrilisTarihi: null,
    vardiya: 'GUNDUZ', durum: 'AKTIF', notlar: null,
    sertifikalar: [], zimmetler: [],
    acikZimmetSayisi: 0, suresiDolanSertifikaSayisi: 0,
  },
  {
    id: 'kc-3', apartmanId: null, apartmanAdi: null,
    ad: 'Mehmet', soyad: 'Demir', adSoyad: 'Mehmet Demir',
    gorev: 'SITE_MUDURU', departman: 'Yönetim',
    telefon: '05327778899', eposta: 'mudur@site.test',
    tcKimlikNo: null, sgkNo: '9876543210987',
    iseGirisTarihi: '2023-01-02', istenAyrilisTarihi: '2026-06-30',
    vardiya: 'TAM_GUN', durum: 'PASIF', notlar: 'İstifa etti',
    sertifikalar: [], zimmetler: [],
    acikZimmetSayisi: 0, suresiDolanSertifikaSayisi: 0,
  },
];

let calisanOrtusu: MockKonutCalisani[] | null = null;

export function mockCalisanlariOku(
  suzgec: { gorev?: string; durum?: string; arama?: string } = {},
): readonly MockKonutCalisani[] {
  const liste = calisanOrtusu ?? mockCalisanlarTaban;
  const q = suzgec.arama?.trim().toLocaleLowerCase('tr') ?? '';
  return liste.filter(
    (c) =>
      (suzgec.gorev === undefined || c.gorev === suzgec.gorev) &&
      (suzgec.durum === undefined || c.durum === suzgec.durum) &&
      (q === '' ||
        c.adSoyad.toLocaleLowerCase('tr').includes(q) ||
        (c.departman ?? '').toLocaleLowerCase('tr').includes(q)),
  );
}

function calisanListesi(): MockKonutCalisani[] {
  return calisanOrtusu ?? (calisanOrtusu = [...mockCalisanlarTaban]);
}

export interface MockCalisanGirdisi {
  readonly ad: string;
  readonly soyad: string;
  readonly gorev: string;
  readonly departman?: string;
  readonly telefon?: string;
  readonly eposta?: string;
  readonly tcKimlikNo?: string;
  readonly sgkNo?: string;
  readonly iseGirisTarihi: string;
  readonly vardiya?: string;
  readonly notlar?: string;
}

export function mockCalisanEkle(dto: MockCalisanGirdisi): void {
  const liste = calisanListesi();
  // Ayni TC ile AKTIF ikinci kayit bordroyu ikiye katlar — sunucu da reddeder.
  if (dto.tcKimlikNo !== undefined && dto.tcKimlikNo !== '') {
    const cakisan = liste.find(
      (c) => c.tcKimlikNo === dto.tcKimlikNo && c.istenAyrilisTarihi === null,
    );
    if (cakisan) {
      throw new Error(
        `Bu TC kimlik numarasıyla aktif bir personel kaydı var: ${cakisan.adSoyad}.`,
      );
    }
  }
  liste.unshift({
    id: `kc-yeni-${liste.length + 1}`,
    apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı',
    ad: dto.ad.trim(), soyad: dto.soyad.trim(),
    adSoyad: `${dto.ad.trim()} ${dto.soyad.trim()}`,
    gorev: dto.gorev,
    departman: dto.departman?.trim() ?? null,
    telefon: dto.telefon?.trim() ?? null,
    eposta: dto.eposta?.trim() ?? null,
    tcKimlikNo: dto.tcKimlikNo ?? null,
    sgkNo: dto.sgkNo?.trim() ?? null,
    iseGirisTarihi: dto.iseGirisTarihi,
    istenAyrilisTarihi: null,
    vardiya: dto.vardiya ?? 'GUNDUZ',
    durum: 'AKTIF',
    notlar: dto.notlar?.trim() ?? null,
    sertifikalar: [], zimmetler: [],
    acikZimmetSayisi: 0, suresiDolanSertifikaSayisi: 0,
  });
}

/** İşten ayrılış — kayıt KAPANIR, silinmez. Durum aynı anda PASIF olur. */
export function mockCalisanAyril(id: string, tarih: string): void {
  const liste = calisanListesi();
  const i = liste.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`Personel bulunamadı: ${id}`);
  const mevcut = liste[i] as MockKonutCalisani;
  if (mevcut.istenAyrilisTarihi !== null) {
    throw new Error(`${mevcut.adSoyad} ${mevcut.istenAyrilisTarihi} tarihinde zaten ayrılmış.`);
  }
  if (tarih < mevcut.iseGirisTarihi) {
    throw new Error(
      `Ayrılış (${tarih}) işe giriş tarihinden (${mevcut.iseGirisTarihi}) önce olamaz.`,
    );
  }
  liste[i] = { ...mevcut, istenAyrilisTarihi: tarih, durum: 'PASIF' };
}

/** Arsa payı raporu — gerçek uçla (`ArsaPayiRaporu`) aynı şekil. */
export interface MockArsaPayiRaporu {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
  readonly bolumSayisi: number;
  readonly okunamayanBolumler: readonly string[];
}

export interface MockArsaPayiSatiri {
  readonly bolumId: string;
  readonly arsaPayiPay: string;
  readonly arsaPayiPayda: string;
}

/**
 * Arsa paylarını TOPLU düzeltir — KMK md. 3.
 *
 * İşlem SONUNDAKİ toplam hesaplanır: gönderilen satırlar + DOKUNULMAYAN
 * bölümler. Tamı etmiyorsa hiçbir satır yazılmaz; sunucu da böyle davranır.
 * Tek bölümün payını değiştirmeye izin vermek binanın toplamını sessizce
 * bozar — bu yüzden `PATCH /bolumler/:id` arsa payına dokunmaz.
 */
export function mockArsaPayiDuzelt(satirlar: readonly MockArsaPayiSatiri[]): number {
  const liste = bolumListesi();
  const harita = new Map(satirlar.map((s) => [s.bolumId, s]));

  for (const s of satirlar) {
    if (!liste.some((b) => b.id === s.bolumId)) {
      throw new Error(`Bölüm bulunamadı: ${s.bolumId}`);
    }
  }

  // Islem SONUNDAKI toplam — dokunulmayanlar da dahil.
  const toplam = liste.reduce(
    (acc, b) => {
      const yeni = harita.get(b.id);
      const ham = yeni === undefined
        ? b.arsaPayi
        : `${yeni.arsaPayiPay}/${yeni.arsaPayiPayda}`;
      const parcalar = ham.split('/');
      const pay = BigInt(parcalar[0] ?? '0');
      const payda = BigInt(parcalar[1] ?? '1');
      if (payda === 0n) return acc;
      return {
        pay: acc.pay * payda + pay * acc.payda,
        payda: acc.payda * payda,
      };
    },
    { pay: 0n, payda: 1n },
  );

  if (toplam.pay !== toplam.payda) {
    throw new Error(
      'Arsa payı toplamı tamı etmiyor; hiçbir satır yazılmadı (KMK md. 3).',
    );
  }

  for (const s of satirlar) {
    const i = liste.findIndex((b) => b.id === s.bolumId);
    liste[i] = {
      ...(liste[i] as MockBolum),
      arsaPayi: `${s.arsaPayiPay}/${s.arsaPayiPayda}`,
    };
  }
  return satirlar.length;
}

export function mockSakinCikis(bolumId: string, sakinId: string, cikisTarihi: string): void {
  const liste = sakinOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((s) => s.id === sakinId);
  if (i < 0) throw new Error(`Sakin kaydı bulunamadı: ${sakinId}`);
  liste[i] = { ...(liste[i] as MockSakin), cikisTarihi, gecerliMi: false };
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
