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

export interface Apartman {
  readonly id: string;
  readonly ad: string;
  readonly adres: string | null;
  readonly siteIciKod: string | null;
  readonly blokSayisi: number;
}

export interface Blok {
  readonly id: string;
  readonly ad: string;
  readonly apartmanId: string;
  readonly apartmanAdi: string;
  readonly katSayisi: number;
  readonly bolumSayisi: number;
}

export interface Kat {
  readonly id: string;
  readonly blokId: string;
  readonly no: number;
  readonly ad: string | null;
  readonly bolumSayisi: number;
}

export interface Bolum {
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
export interface Malik {
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

export interface HisseRaporu {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
  readonly tarih: string;
  readonly malikSayisi: number;
}

export interface Kiraci {
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

export interface Sakin {
  readonly id: string;
  readonly kisiId: string;
  readonly kisiAdi: string;
  readonly eposta: string | null;
  readonly telefon: string | null;
  readonly yakinlikDerecesi: string;
  /** `DIGER` ise kullanıcının yazdığı ifade (Amcası · Bakıcısı…). */
  readonly yakinlikAciklamasi: string | null;
  /**
   * DAYANAK — sakin kimin yakını olarak oturuyor (0021).
   *
   * ⚠️  Listede GÖSTERİLMEK ZORUNDA: "Ayşe Yılmaz · Eşi" satırı, kimin eşi
   *     olduğu yazılmazsa dört daireli bir katta hiçbir şey anlatmaz.
   */
  readonly dayanakTipi: 'MALIK' | 'KIRACI';
  readonly dayanakKisiAdi: string;
  /**
   * Dayanağın KİMLİĞİ — ikisinden tam olarak biri dolu.
   *
   * ⚠️  Yalnızca `dayanakTipi` tutulsaydı mock, malik devrinde "hangi malikin
   *     yakını" sorusunu yanıtlayamaz ve otomatik çıkışı ya hiç ya da yanlış
   *     kayıtlara uygulardı — demo, gerçek davranışın tersini gösterirdi.
   */
  readonly malikId: string | null;
  readonly kiraciId: string | null;
  readonly girisTarihi: string;
  readonly cikisTarihi: string | null;
  readonly acilDurumKisiAdi: string | null;
  readonly acilDurumTelefon: string | null;
  readonly gecerliMi: boolean;
}

/** Daire kartı — gerçek uçla (DaireKarti) aynı şekil. */
export interface DaireKarti {
  readonly bolum: Bolum;
  readonly malikler: readonly Malik[];
  readonly hisseDurumu: HisseRaporu;
  readonly kiracilar: readonly Kiraci[];
  readonly sakinler: readonly Sakin[];
  readonly tarih: string | null;
}

/** Denetim kaydı — gerçek uçla (AuditSatiri) aynı şekil. */
export interface AuditSatiri {
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

export interface YerlesimSatiri {
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

export const mockApartmanlar: readonly Apartman[] = [
  { id: APARTMAN_ID, ad: 'Güzel Apartmanı', adres: 'Bağdat Cad. No:12, Kadıköy/İstanbul', siteIciKod: null, blokSayisi: 2 },
];

export const mockBloklar: readonly Blok[] = [
  { id: BLOK_A, ad: 'A Blok', apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı', katSayisi: 4, bolumSayisi: 8 },
  { id: BLOK_B, ad: 'B Blok', apartmanId: APARTMAN_ID, apartmanAdi: 'Güzel Apartmanı', katSayisi: 3, bolumSayisi: 6 },
];

export const mockKatlar: readonly Kat[] = [
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
export const mockBolumler: readonly Bolum[] = mockKatlar.flatMap((kat, ki) =>
  [1, 2].map((sira, si): Bolum => {
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
export interface YerlesimOzeti {
  readonly bolumSayisi: number;
  readonly malikKaydiOlmayan: number;
  readonly hissesiEksikOlan: number;
  readonly kiracili: number;
  readonly bos: number;
  readonly satirlar: readonly YerlesimSatiri[];
}

const yerlesimSatirlari: readonly YerlesimSatiri[] = mockBolumler.map((b, i) => ({
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
function varsayilanMalikler(bolumId: string, i: number): Malik[] {
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

export function mockDaireKarti(bolumId: string): DaireKarti | null {
  const bolum = mockBolumler.find((b) => b.id === bolumId);
  if (bolum === undefined) return null;

  const i = mockBolumler.indexOf(bolum);
  // Yazma ortusu varsa o gecerlidir; eklenen malik kartta gorunur.
  const malikler = malikleriAl(bolumId, varsayilanMalikler(bolumId, i));
  const gecerliMalikler = malikler.filter((m) => m.gecerliMi);
  const hisseTam = gecerliMalikler.length > 0;

  const kiraciVar = i % 3 === 1;
  const varsayilanKiracilar: Kiraci[] = kiraciVar
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
  const varsayilanSakinler: Sakin[] = Array.from({ length: sakinSayisi }, (_, s) => ({
    id: `sakin-${bolumId}-${s}`,
    kisiId: `kisi-s-${i}-${s}`,
    kisiAdi: s === 0 ? 'Zeynep Demir' : 'Ali Demir',
    eposta: s === 0 ? 'zeynep@ornek.test' : null,
    telefon: '+90 532 000 00 00',
    yakinlikDerecesi: s === 0 ? 'KENDISI' : 'COCUK',
    yakinlikAciklamasi: null,
    dayanakTipi: 'MALIK' as const,
    dayanakKisiAdi: 'Zeynep Demir',
    // Tohum sakinler bölümün İLK malikine dayanır; maliksiz bölümlerde
    // (i % 5 === 0) zaten sakin üretilmez.
    malikId: `malik-${bolumId}-0`,
    kiraciId: null,
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
const malikOrtusu = new Map<string, Malik[]>();

function malikleriAl(bolumId: string, varsayilan: readonly Malik[]): Malik[] {
  const mevcut = malikOrtusu.get(bolumId);
  if (mevcut !== undefined) return mevcut;
  const kopya = [...varsayilan];
  malikOrtusu.set(bolumId, kopya);
  return kopya;
}

export interface MockKisiGirdisi {
  readonly ad: string;
  readonly soyad: string;
  readonly tcKimlikNo?: string;
  readonly telefon?: string;
  readonly eposta?: string;
  readonly dogumTarihi?: string;
  readonly cinsiyet?: string;
  readonly adres?: string;
  readonly notlar?: string;
  readonly plakalar?: readonly MockPlakaGirdisi[];
}

export interface MockPlakaGirdisi {
  readonly plaka: string;
  readonly tur?: string;
  readonly marka?: string;
  readonly model?: string;
  readonly renk?: string;
  readonly otoparkYeri?: string;
}

/**
 * Gosterilecek ad. Mock tarafinda mevcut kisi katalogu YOKTUR; bu yuzden
 * `kisiId` verildiginde adi cozemeyiz ve kimligi gosteririz. Gercek uc kisiyi
 * veritabanindan okur — bu sinir bilinclidir.
 */
export function mockKisiAdiCoz(
  dto: { readonly kisiId?: string; readonly kisi?: MockKisiGirdisi },
): string {
  if (dto.kisi !== undefined) return `${dto.kisi.ad.trim()} ${dto.kisi.soyad.trim()}`;
  if (dto.kisiId !== undefined && dto.kisiId !== '') return `(kisi ${dto.kisiId})`;
  throw new Error('Kisi secilmediyse ad ve soyad zorunludur.');
}

export interface MockMalikEkle {
  readonly kisiId?: string;
  readonly kisi?: MockKisiGirdisi;
  readonly hissePay: string;
  readonly hissePayda: string;
  readonly tapuTuru: string;
  readonly tapuBaslangic: string;
  readonly tapuYevmiyeNo?: string;
}

export function mockMalikEkle(bolumId: string, dto: MockMalikEkle): Malik {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) throw new Error(`Bölüm bulunamadı: ${bolumId}`);
  const liste = malikleriAl(bolumId, kart.malikler);

  const yeni: Malik = {
    id: `malik-${bolumId}-${liste.length}-${liste.length + 1}`,
    kisiId: `kisi-yeni-${liste.length}`,
    kisiAdi: mockKisiAdiCoz(dto),
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

export function mockMalikDevret(
  bolumId: string, malikId: string, tapuBitis: string,
): MockSakinCikisSonucu {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) throw new Error(`Bölüm bulunamadı: ${bolumId}`);
  const liste = malikleriAl(bolumId, kart.malikler);
  const i = liste.findIndex((m) => m.id === malikId);
  if (i < 0) throw new Error(`Malik kaydı bulunamadı: ${malikId}`);
  // Kayit SILINMEZ; donemi kapanir ve tarihcede kalir.
  liste[i] = { ...(liste[i] as Malik), tapuBitis, gecerliMi: false };
  return dayanakSakinleriniCikar(bolumId, { malikId }, tapuBitis);
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
  const mevcut = liste[i] as Malik;
  liste[i] = {
    ...mevcut,
    ...(dto.tapuTuru === undefined ? {} : { tapuTuru: dto.tapuTuru }),
    ...(dto.tapuYevmiyeNo === undefined ? {} : { tapuYevmiyeNo: dto.tapuYevmiyeNo }),
  };
}

/** Örtü varsa onu, yoksa hesaplanan varsayılanı döner. */
export function mockMalikleriOku(bolumId: string): readonly Malik[] | null {
  const kart = mockDaireKarti(bolumId);
  if (kart === null) return null;
  return malikleriAl(bolumId, kart.malikler);
}

// --- Kiracı ve Sakin yazma örtüleri (aynı bellek-içi mantık) ---

const kiraciOrtusu = new Map<string, Kiraci[]>();
const sakinOrtusu = new Map<string, Sakin[]>();

function kiracilariAl(bolumId: string, varsayilan: readonly Kiraci[]): Kiraci[] {
  const mevcut = kiraciOrtusu.get(bolumId);
  if (mevcut !== undefined) return mevcut;
  const kopya = [...varsayilan];
  kiraciOrtusu.set(bolumId, kopya);
  return kopya;
}

function sakinleriAl(bolumId: string, varsayilan: readonly Sakin[]): Sakin[] {
  const mevcut = sakinOrtusu.get(bolumId);
  if (mevcut !== undefined) return mevcut;
  const kopya = [...varsayilan];
  sakinOrtusu.set(bolumId, kopya);
  return kopya;
}

export interface MockKiraciEkle {
  readonly kisiId?: string;
  readonly kisi?: MockKisiGirdisi;
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
    kisiAdi: mockKisiAdiCoz(dto),
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
): MockSakinCikisSonucu {
  const liste = kiraciOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((k) => k.id === kiraciId);
  if (i < 0) throw new Error(`Kiracı kaydı bulunamadı: ${kiraciId}`);
  const mevcut = liste[i] as Kiraci;
  // Tahliye sozlesmeyi de kapatir: bitis bos kalirsa iliski suresiz gorunur
  // ve yeni kiraci eklenemez.
  liste[i] = {
    ...mevcut, tahliyeTarihi, tahliyeGerekcesi: gerekce,
    bitis: tahliyeTarihi, gecerliMi: false,
  };
  return dayanakSakinleriniCikar(bolumId, { kiraciId }, tahliyeTarihi);
}

/* ---------------- Dayanağı biten sakinlere otomatik çıkış ---------------- */

export interface MockSakinCikisSonucu {
  readonly cikarilan: number;
  readonly cikarilamayan: readonly {
    readonly sakinId: string;
    readonly kisiAdi: string;
    readonly girisTarihi: string;
    readonly gerekce: string;
  }[];
}

/**
 * Backend'deki `dayanakSakinleriniCikar` ile AYNI kuralları uygular.
 *
 * ⚠️  Mock hiçbir şey yapmasaydı demo modda kiracı tahliye edilir, ailesi
 *     listede "hâlen oturuyor" kalırdı — yani mock, ürünün YAPMADIĞI bir şeyi
 *     gösterirdi. Mock'un işi gerçeği taklit etmektir; farklı davranan bir
 *     mock, hata ayıklarken yanlış yöne bakılmasına yol açar.
 */
function dayanakSakinleriniCikar(
  bolumId: string,
  dayanak: { readonly malikId?: string; readonly kiraciId?: string },
  cikisTarihi: string,
): MockSakinCikisSonucu {
  // Kartı çağırmak, örtüsü henüz oluşmamış bölümde tohum sakinleri üretir.
  mockDaireKarti(bolumId);
  const liste = sakinOrtusu.get(bolumId) ?? [];
  const cikarilamayan: MockSakinCikisSonucu['cikarilamayan'][number][] = [];
  let cikarilan = 0;

  liste.forEach((s, i) => {
    if (s.cikisTarihi !== null) return;
    const eslesti = dayanak.malikId === undefined
      ? s.kiraciId === dayanak.kiraciId
      : s.malikId === dayanak.malikId;
    if (!eslesti) return;

    // Çıkış girişten önce yazılamaz; kayıt AÇIK bırakılır ve raporlanır.
    if (s.girisTarihi > cikisTarihi) {
      cikarilamayan.push({
        sakinId: s.id, kisiAdi: s.kisiAdi, girisTarihi: s.girisTarihi,
        gerekce:
          `Giriş tarihi (${s.girisTarihi}), dayanağın bitiş tarihinden ` +
          `(${cikisTarihi}) sonra olduğu için otomatik çıkış verilemedi; ` +
          'çıkışı elle vermeniz gerekir.',
      });
      return;
    }
    liste[i] = { ...s, cikisTarihi, gecerliMi: false };
    cikarilan += 1;
  });

  return { cikarilan, cikarilamayan };
}

export function mockKiraciDuzelt(
  bolumId: string,
  kiraciId: string,
  dto: { readonly sozlesmeNo?: string; readonly depozito?: string; readonly bitis?: string },
): void {
  const liste = kiraciOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((k) => k.id === kiraciId);
  if (i < 0) throw new Error(`Kiracı kaydı bulunamadı: ${kiraciId}`);
  const mevcut = liste[i] as Kiraci;

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
  const mevcut = liste[i] as Sakin;

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
  readonly kisiId?: string;
  readonly kisi?: MockKisiGirdisi;
  readonly yakinlikDerecesi: string;
  readonly girisTarihi: string;
  readonly telefon?: string;
  readonly acilDurumKisiAdi?: string;
  readonly acilDurumTelefon?: string;
  /** Dayanak — ikisinden TAM OLARAK biri (0021). */
  readonly malikId?: string;
  readonly kiraciId?: string;
  readonly yakinlikAciklamasi?: string;
}

export function mockSakinEkle(bolumId: string, dto: MockSakinEkle): void {
  const liste = sakinOrtusu.get(bolumId) ?? [];
  // Sakin TEKILLIGI YOKTUR — bir dairede ayni anda birden cok sakin gecerlidir.
  liste.push({
    id: `sakin-${bolumId}-${liste.length}`,
    kisiId: `kisi-s-yeni-${liste.length}`,
    kisiAdi: mockKisiAdiCoz(dto),
    eposta: null,
    telefon: dto.kisi?.telefon ?? null,
    yakinlikDerecesi: dto.yakinlikDerecesi,
    yakinlikAciklamasi: dto.yakinlikAciklamasi ?? null,
    // Mock, dayanağın ADINI çözemez (kişi kataloğu taklit edilmiyor); tipini
    // gönderilen alandan okur. Gerçek veriyi backend döndürür.
    dayanakTipi: dto.malikId !== undefined ? 'MALIK' : 'KIRACI',
    dayanakKisiAdi: '—',
    malikId: dto.malikId ?? null,
    kiraciId: dto.kiraciId ?? null,
    girisTarihi: dto.girisTarihi,
    cikisTarihi: null,
    acilDurumKisiAdi: dto.acilDurumKisiAdi ?? null,
    acilDurumTelefon: dto.acilDurumTelefon ?? null,
    gecerliMi: true,
  });
  sakinOrtusu.set(bolumId, liste);
}

// --- Apartman ve Blok yazma örtüleri ---

let apartmanOrtusu: Apartman[] | null = null;
let blokOrtusu: Blok[] | null = null;

export function mockApartmanlariOku(): readonly Apartman[] {
  apartmanOrtusu ??= [...mockApartmanlar];
  return apartmanOrtusu;
}

export function mockBloklariOku(apartmanId?: string): readonly Blok[] {
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
    ...(liste[i] as Apartman),
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
  const mevcut = liste[i] as Blok;
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
    const a = apartmanlar[ai] as Apartman;
    apartmanlar[ai] = { ...a, blokSayisi: Math.max(0, a.blokSayisi - 1) };
  }
}

// --- Kat yazma örtüsü ---

const katOrtusu = new Map<string, Kat[]>();

/** Bloğun katları — örtü varsa o geçerlidir. */
export function mockKatlariOku(blokId: string): readonly Kat[] {
  const mevcut = katOrtusu.get(blokId);
  if (mevcut !== undefined) return mevcut;
  const kopya = mockKatlar.filter((k) => k.blokId === blokId);
  katOrtusu.set(blokId, kopya);
  return kopya;
}

function katListesi(blokId: string): Kat[] {
  mockKatlariOku(blokId);
  return katOrtusu.get(blokId) as Kat[];
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
  const mevcut = liste[i] as Kat;

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

let bolumOrtusu: Bolum[] | null = null;

export function mockBolumleriOku(): readonly Bolum[] {
  return bolumOrtusu ?? mockBolumler;
}

function bolumListesi(): Bolum[] {
  return bolumOrtusu ?? (bolumOrtusu = [...mockBolumler]);
}

/** Blok ve kat sayaçlarını örtüde günceller. */
function sayaclariArtir(blokId: string, katId: string | null, artis: number): void {
  const bloklar = blokOrtusu ?? (blokOrtusu = [...mockBloklar]);
  const bi = bloklar.findIndex((b) => b.id === blokId);
  if (bi >= 0) {
    const b = bloklar[bi] as Blok;
    bloklar[bi] = { ...b, bolumSayisi: Math.max(0, b.bolumSayisi + artis) };
  }
  if (katId === null) return;
  const katlar = katOrtusu.get(blokId);
  if (katlar === undefined) return;
  const ki = katlar.findIndex((k) => k.id === katId);
  if (ki >= 0) {
    const k = katlar[ki] as Kat;
    katlar[ki] = { ...k, bolumSayisi: Math.max(0, k.bolumSayisi + artis) };
  }
}

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

/**
 * Toplu oluşturma — TEK İŞLEM. Bir satır geçersizse hiçbiri yazılmaz;
 * sunucu da böyle davranır. Yarım yazılmış kat, arsa payı toplamını da yarım
 * bırakır ve neyin eksik olduğu görünmez.
 */
export function mockBolumTopluOlustur(
  blokId: string, katId: string | null, kat: number,
  satirlar: readonly TopluBolumSatiri[],
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
    const b = liste[i] as Bolum;
    if (hedefKapilari.has(b.kapiNo.toLocaleLowerCase('tr'))) {
      throw new Error(`Hedef blokta '${b.kapiNo}' kapı numarası zaten var; hiçbiri taşınmadı.`);
    }
  }

  for (const i of tasinacak) {
    const b = liste[i] as Bolum;
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
export interface GiderTuru {
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
  /**
   * `DONEMSEL` | `OLAY_BAZLI` — mükerrer korumasının ekseni (ADR-0014).
   *
   * OLAY_BAZLI türlerde tahakkuk `referans` (fatura/karar no) ZORUNLUDUR:
   * aynı ay içinde iki ayrı sigorta poliçesi meşrudur, onları ayıran şey
   * dönem değil olayın kendisidir. Ekran bunu bilmeden formu doğru
   * kuramaz.
   */
  readonly tahakkukSikligi: string;
}

/**
 * KMK md. 20 varsayılanları — tohum verisiyle AYNI liste.
 *
 * Mock ile gerçek uç arasında fark olmaması önemlidir: arayüz mock'ta
 * çalışıp gerçekte çalışmazsa fark ancak sahada görülür.
 */
const mockGiderTurleriTaban: readonly GiderTuru[] = [
  // Beşinci alan `tahakkukSikligi` — TOHUMDAKİ DEĞERLERİN AYNISI. Mock ile
  // gerçek uç ayrışırsa arayüz burada çalışıp sahada çalışmaz.
  ['KAPICI', 'Kapıcı gideri', 'ESIT', 'KULLANANA_AIT', 'DONEMSEL'],
  ['ANA_BAKIM', 'Anagayrimenkul bakım ve onarım', 'ARSA_PAYI', 'MALIKE_AIT', 'OLAY_BAZLI'],
  ['SIGORTA', 'Bina sigortası', 'ARSA_PAYI', 'MALIKE_AIT', 'OLAY_BAZLI'],
  ['YENILEME_FONU', 'Yenileme fonu', 'ARSA_PAYI', 'MALIKE_AIT', 'DONEMSEL'],
  ['ISITMA', 'Isıtma gideri', 'TUKETIM', 'KULLANANA_AIT', 'DONEMSEL'],
  ['SU', 'Su gideri', 'TUKETIM', 'KULLANANA_AIT', 'DONEMSEL'],
  ['ASANSOR_ISLETME', 'Asansör işletme gideri', 'ESIT', 'KULLANANA_AIT', 'DONEMSEL'],
  ['ELEKTRIK_ORTAK', 'Ortak alan elektriği', 'ESIT', 'KULLANANA_AIT', 'DONEMSEL'],
  ['TEMIZLIK', 'Temizlik gideri', 'ESIT', 'KULLANANA_AIT', 'DONEMSEL'],
  ['YONETIM', 'Yönetim gideri', 'ESIT', 'KULLANANA_AIT', 'DONEMSEL'],
].map(([kod, ad, kural, sorumluluk, siklik]) => ({
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
  tahakkukSikligi: siklik as string,
}));

let giderTuruOrtusu: GiderTuru[] | null = null;

export function mockGiderTurleriniOku(yalnizcaAktif = false): readonly GiderTuru[] {
  const liste = giderTuruOrtusu ?? mockGiderTurleriTaban;
  return yalnizcaAktif ? liste.filter((g) => g.aktifMi) : liste;
}

function giderTuruListesi(): GiderTuru[] {
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
    // Veritabanı varsayılanının aynısı (`@default(DONEMSEL)`). Gider türü
    // ekleme formunda bu alan HENÜZ YOK; mock, uydurma bir değer değil
    // sunucunun yazacağı değeri taşır.
    tahakkukSikligi: 'DONEMSEL',
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
  const mevcut = liste[i] as GiderTuru;

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
  liste[i] = { ...(liste[i] as GiderTuru), aktifMi: false };
}

/* ---------------------------- Daire görevlileri ---------------------------- */

export interface Sertifika {
  readonly id: string;
  readonly ad: string;
  readonly kurum: string | null;
  readonly belgeNo: string | null;
  readonly verilisTarihi: string;
  readonly gecerlilikBitisi: string | null;
  readonly suresiDolduMu: boolean;
}

export interface Zimmet {
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
export interface SitePersoneli {
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
  readonly sertifikalar: readonly Sertifika[];
  readonly zimmetler: readonly Zimmet[];
  readonly acikZimmetSayisi: number;
  readonly suresiDolanSertifikaSayisi: number;
}

const mockPersonellerTaban: readonly SitePersoneli[] = [
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

let personelOrtusu: SitePersoneli[] | null = null;

export function mockPersonelleriOku(
  suzgec: { gorev?: string; durum?: string; arama?: string } = {},
): readonly SitePersoneli[] {
  const liste = personelOrtusu ?? mockPersonellerTaban;
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

function personelListesi(): SitePersoneli[] {
  return personelOrtusu ?? (personelOrtusu = [...mockPersonellerTaban]);
}

export interface MockPersonelGirdisi {
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

export function mockPersonelEkle(dto: MockPersonelGirdisi): void {
  const liste = personelListesi();
  // Ayni TC ile AKTIF ikinci kayit bordroyu ikiye katlar — sunucu da reddeder.
  if (dto.tcKimlikNo !== undefined && dto.tcKimlikNo !== '') {
    const cakisan = liste.find(
      (c) => c.tcKimlikNo === dto.tcKimlikNo && c.istenAyrilisTarihi === null,
    );
    if (cakisan) {
      throw new Error(
        `Bu TC kimlik numarasıyla aktif bir görevli kaydı var: ${cakisan.adSoyad}.`,
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
export function mockPersonelAyril(id: string, tarih: string): void {
  const liste = personelListesi();
  const i = liste.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`Görevli bulunamadı: ${id}`);
  const mevcut = liste[i] as SitePersoneli;
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
export interface ArsaPayiRaporu {
  readonly gecerli: boolean;
  readonly toplam: string;
  readonly mesaj: string;
  readonly bolumSayisi: number;
  readonly okunamayanBolumler: readonly string[];
}

export interface ArsaPayiSatiri {
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
export function mockArsaPayiDuzelt(satirlar: readonly ArsaPayiSatiri[]): number {
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
      ...(liste[i] as Bolum),
      arsaPayi: `${s.arsaPayiPay}/${s.arsaPayiPayda}`,
    };
  }
  return satirlar.length;
}

export function mockSakinCikis(bolumId: string, sakinId: string, cikisTarihi: string): void {
  const liste = sakinOrtusu.get(bolumId) ?? [];
  const i = liste.findIndex((s) => s.id === sakinId);
  if (i < 0) throw new Error(`Sakin kaydı bulunamadı: ${sakinId}`);
  liste[i] = { ...(liste[i] as Sakin), cikisTarihi, gecerliMi: false };
}

/** Denetim kaydı mock'u — bölüm kimliğine göre sabit üretilir. */
export function mockAuditKayitlari(varlikId: string): readonly AuditSatiri[] {
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

export const mockYerlesim: YerlesimOzeti = {
  bolumSayisi: yerlesimSatirlari.length,
  malikKaydiOlmayan: yerlesimSatirlari.filter((s) => s.malikSayisi === 0).length,
  hissesiEksikOlan: yerlesimSatirlari.filter((s) => !s.hisseTam).length,
  kiracili: yerlesimSatirlari.filter((s) => s.kiraciVarMi).length,
  bos: yerlesimSatirlari.filter((s) => s.bosMu).length,
  satirlar: yerlesimSatirlari,
};


// ===========================================================================
// DAİRE GÖREVLİSİ — işvereni MALİK / KİRACI / SAKİN olan ev hizmetleri
//
// SİTE PERSONELİ İLE KARIŞTIRILMAMALIDIR (`SitePersoneli`): orada işveren
// yönetimdir ve SGK · departman · vardiya · zimmet alanları vardır.
// ===========================================================================

export interface GorevliAraci {
  readonly id: string;
  readonly plaka: string;
  readonly tur: string;
  readonly otoparkYeri: string | null;
}

/** Gerçek uçla (`DaireGorevlisiSatiri`) aynı şekil. */
export interface DaireGorevlisi {
  readonly id: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly ad: string;
  readonly soyad: string;
  readonly adSoyad: string;
  readonly gorev: string;
  readonly isvereniTipi: string;
  readonly isverenKisiId: string | null;
  readonly isverenAdSoyad: string | null;
  readonly tcKimlikNo: string | null;
  readonly telefon: string | null;
  readonly eposta: string | null;
  readonly dogumTarihi: string | null;
  readonly cinsiyet: string;
  readonly adres: string | null;
  readonly calismaBaslangic: string;
  readonly calismaBitis: string | null;
  readonly aciklama: string | null;
  readonly notlar: string | null;
  readonly durum: string;
  readonly araclari: readonly GorevliAraci[];
}

const mockDaireGorevlileriTaban: readonly DaireGorevlisi[] = [
  {
    id: 'dg-1', bolumId: 'bolum-1', kapiNo: 'A11',
    ad: 'Elif', soyad: 'Demir', adSoyad: 'Elif Demir',
    gorev: 'COCUK_BAKICISI', isvereniTipi: 'MALIK',
    isverenKisiId: null, isverenAdSoyad: 'Ayşe Yılmaz',
    tcKimlikNo: null, telefon: '05321110099', eposta: null,
    dogumTarihi: '1990-06-02', cinsiyet: 'KADIN', adres: null,
    calismaBaslangic: '2026-02-01', calismaBitis: null,
    aciklama: 'İki çocuğa bakıyor, site giriş kartı verildi',
    notlar: null, durum: 'AKTIF',
    araclari: [],
  },
  {
    id: 'dg-2', bolumId: 'bolum-2', kapiNo: 'A12',
    ad: 'Hasan', soyad: 'Öztürk', adSoyad: 'Hasan Öztürk',
    gorev: 'SOFOR', isvereniTipi: 'KIRACI',
    isverenKisiId: null, isverenAdSoyad: null,
    tcKimlikNo: null, telefon: '05334442211', eposta: null,
    dogumTarihi: null, cinsiyet: 'ERKEK', adres: null,
    calismaBaslangic: '2025-11-15', calismaBitis: null,
    aciklama: null, notlar: null, durum: 'AKTIF',
    araclari: [
      { id: 'arac-dg-2', plaka: '34ABC123', tur: 'OTOMOBIL', otoparkYeri: null },
    ],
  },
  {
    id: 'dg-3', bolumId: 'bolum-1', kapiNo: 'A11',
    ad: 'Sevgi', soyad: 'Arslan', adSoyad: 'Sevgi Arslan',
    gorev: 'TEMIZLIK', isvereniTipi: 'MALIK',
    isverenKisiId: null, isverenAdSoyad: 'Ayşe Yılmaz',
    tcKimlikNo: null, telefon: null, eposta: null,
    dogumTarihi: null, cinsiyet: 'KADIN', adres: null,
    calismaBaslangic: '2025-01-10', calismaBitis: '2026-03-31',
    aciklama: null, notlar: 'Haftada bir geliyordu', durum: 'PASIF',
    araclari: [],
  },
];

let daireGorevlisiOrtusu: DaireGorevlisi[] | null = null;

export function mockDaireGorevlileriniOku(
  suzgec: { bolumId?: string; gorev?: string; durum?: string; arama?: string } = {},
): readonly DaireGorevlisi[] {
  const liste = daireGorevlisiOrtusu ?? mockDaireGorevlileriTaban;
  const q = suzgec.arama?.trim().toLocaleLowerCase('tr') ?? '';
  return liste.filter(
    (g) =>
      (suzgec.bolumId === undefined || g.bolumId === suzgec.bolumId) &&
      (suzgec.gorev === undefined || g.gorev === suzgec.gorev) &&
      (suzgec.durum === undefined || g.durum === suzgec.durum) &&
      (q === '' || g.adSoyad.toLocaleLowerCase('tr').includes(q)),
  );
}

function daireGorevlisiListesi(): DaireGorevlisi[] {
  return daireGorevlisiOrtusu ?? (daireGorevlisiOrtusu = [...mockDaireGorevlileriTaban]);
}

export interface MockDaireGorevlisiGirdisi {
  readonly bolumId: string;
  readonly isvereniTipi: string;
  readonly isverenKisiId?: string;
  readonly ad: string;
  readonly soyad: string;
  readonly tcKimlikNo?: string;
  readonly telefon?: string;
  readonly eposta?: string;
  readonly dogumTarihi?: string;
  readonly cinsiyet?: string;
  readonly adres?: string;
  readonly notlar?: string;
  readonly plakalar?: readonly MockPlakaGirdisi[];
  readonly gorev: string;
  readonly calismaBaslangic: string;
  readonly calismaBitis?: string;
  readonly aciklama?: string;
}

export function mockDaireGorevlisiEkle(dto: MockDaireGorevlisiGirdisi): void {
  const liste = daireGorevlisiListesi();

  // Tekillik BÖLÜM BAŞINADIR: aynı temizlik görevlisinin üç ayrı dairede
  // çalışması olağandır. Sunucu da aynı kuralı uygular.
  if (dto.tcKimlikNo !== undefined && dto.tcKimlikNo !== '') {
    const cakisan = liste.find(
      (g) =>
        g.tcKimlikNo === dto.tcKimlikNo &&
        g.bolumId === dto.bolumId &&
        g.calismaBitis === null,
    );
    if (cakisan) {
      throw new Error(
        `${cakisan.kapiNo} numaralı bölümde bu TC kimlik numarasıyla süren bir ` +
          `görevli kaydı var: ${cakisan.adSoyad}.`,
      );
    }
  }

  const bolum = mockBolumleriOku().find((b) => b.id === dto.bolumId);
  const bitis = dto.calismaBitis ?? null;

  liste.unshift({
    id: `dg-yeni-${String(liste.length + 1)}`,
    bolumId: dto.bolumId,
    kapiNo: bolum?.kapiNo ?? dto.bolumId,
    ad: dto.ad.trim(), soyad: dto.soyad.trim(),
    adSoyad: `${dto.ad.trim()} ${dto.soyad.trim()}`,
    gorev: dto.gorev,
    isvereniTipi: dto.isvereniTipi,
    isverenKisiId: dto.isverenKisiId ?? null,
    isverenAdSoyad: null,
    tcKimlikNo: dto.tcKimlikNo ?? null,
    telefon: dto.telefon?.trim() ?? null,
    eposta: dto.eposta?.trim() ?? null,
    dogumTarihi: dto.dogumTarihi ?? null,
    cinsiyet: dto.cinsiyet ?? 'BELIRTILMEMIS',
    adres: dto.adres?.trim() ?? null,
    calismaBaslangic: dto.calismaBaslangic,
    calismaBitis: bitis,
    aciklama: dto.aciklama?.trim() ?? null,
    notlar: dto.notlar?.trim() ?? null,
    // Bitiş girildiyse kayıt PASİF açılır; sunucudaki kısıt da bunu zorlar.
    durum: bitis === null ? 'AKTIF' : 'PASIF',
    araclari: (dto.plakalar ?? []).map((p, i) => ({
      id: `arac-dg-yeni-${String(i)}`,
      plaka: p.plaka.toUpperCase().replace(/[\s-]/gu, ''),
      tur: p.tur ?? 'OTOMOBIL',
      otoparkYeri: p.otoparkYeri ?? null,
    })),
  });
}

/** Çalışma sonlandırma — kayıt KAPANIR, silinmez. Araçları da kapanır. */
export function mockDaireGorevlisiAyril(id: string, tarih: string): void {
  const liste = daireGorevlisiListesi();
  const i = liste.findIndex((g) => g.id === id);
  if (i < 0) throw new Error(`Daire görevlisi bulunamadı: ${id}`);
  const mevcut = liste[i] as DaireGorevlisi;
  if (mevcut.calismaBitis !== null) {
    throw new Error(
      `${mevcut.adSoyad} için çalışma ${mevcut.calismaBitis} tarihinde zaten sonlandırılmış.`,
    );
  }
  if (tarih < mevcut.calismaBaslangic) {
    throw new Error(
      `Bitiş (${tarih}) çalışma başlangıcından (${mevcut.calismaBaslangic}) önce olamaz.`,
    );
  }
  liste[i] = { ...mevcut, calismaBitis: tarih, durum: 'PASIF' };
}

// ===========================================================================
// MİSAFİR — hak sahibi DEĞİLDİR; `kisi` kaydı açılmaz (KVKK: kısa ömürlü veri)
// ===========================================================================

export interface Misafir {
  readonly id: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly ad: string;
  readonly soyad: string;
  readonly adSoyad: string;
  readonly tcKimlikNo: string | null;
  readonly telefon: string | null;
  readonly eposta: string | null;
  readonly dogumTarihi: string | null;
  readonly cinsiyet: string;
  readonly adres: string | null;
  readonly notlar: string | null;
  readonly girisTarihi: string;
  readonly cikisTarihi: string | null;
  readonly ziyaretNedeni: string | null;
  readonly icerideMi: boolean;
  readonly araclari: readonly GorevliAraci[];
}

const mockMisafirlerTaban: readonly Misafir[] = [
  {
    id: 'ms-1', bolumId: 'bolum-1', kapiNo: 'A11',
    ad: 'Kemal', soyad: 'Aksoy', adSoyad: 'Kemal Aksoy',
    tcKimlikNo: null, telefon: '05329998877', eposta: null,
    dogumTarihi: null, cinsiyet: 'ERKEK', adres: 'Ankara Çankaya', notlar: null,
    girisTarihi: '2026-07-28', cikisTarihi: null,
    ziyaretNedeni: 'Aile ziyareti', icerideMi: true,
    araclari: [
      { id: 'arac-ms-1', plaka: '06XYZ45', tur: 'OTOMOBIL', otoparkYeri: 'M-2' },
    ],
  },
  {
    id: 'ms-2', bolumId: 'bolum-2', kapiNo: 'A12',
    ad: 'Zeynep', soyad: 'Ak', adSoyad: 'Zeynep Ak',
    tcKimlikNo: null, telefon: null, eposta: null,
    dogumTarihi: null, cinsiyet: 'KADIN', adres: null, notlar: null,
    girisTarihi: '2026-07-10', cikisTarihi: '2026-07-14',
    ziyaretNedeni: 'Tatil', icerideMi: false,
    araclari: [],
  },
];

let misafirOrtusu: Misafir[] | null = null;

export function mockMisafirleriOku(
  suzgec: { bolumId?: string; icerideMi?: boolean; arama?: string } = {},
): readonly Misafir[] {
  const liste = misafirOrtusu ?? mockMisafirlerTaban;
  const q = suzgec.arama?.trim().toLocaleLowerCase('tr') ?? '';
  return liste.filter(
    (m) =>
      (suzgec.bolumId === undefined || m.bolumId === suzgec.bolumId) &&
      (suzgec.icerideMi === undefined || m.icerideMi === suzgec.icerideMi) &&
      (q === '' ||
        m.adSoyad.toLocaleLowerCase('tr').includes(q) ||
        (m.ziyaretNedeni ?? '').toLocaleLowerCase('tr').includes(q)),
  );
}

function misafirListesi(): Misafir[] {
  return misafirOrtusu ?? (misafirOrtusu = [...mockMisafirlerTaban]);
}

export interface MockMisafirGirdisi {
  readonly bolumId: string;
  readonly ad: string;
  readonly soyad: string;
  readonly tcKimlikNo?: string;
  readonly telefon?: string;
  readonly eposta?: string;
  readonly dogumTarihi?: string;
  readonly cinsiyet?: string;
  readonly adres?: string;
  readonly notlar?: string;
  readonly plakalar?: readonly MockPlakaGirdisi[];
  readonly girisTarihi: string;
  readonly cikisTarihi?: string;
  readonly ziyaretNedeni?: string;
}

export function mockMisafirEkle(dto: MockMisafirGirdisi): void {
  const liste = misafirListesi();
  const cikis = dto.cikisTarihi ?? null;
  if (cikis !== null && cikis < dto.girisTarihi) {
    throw new Error(`Çıkış (${cikis}) giriş tarihinden (${dto.girisTarihi}) önce olamaz.`);
  }
  const bolum = mockBolumleriOku().find((b) => b.id === dto.bolumId);

  liste.unshift({
    id: `ms-yeni-${String(liste.length + 1)}`,
    bolumId: dto.bolumId,
    kapiNo: bolum?.kapiNo ?? dto.bolumId,
    ad: dto.ad.trim(), soyad: dto.soyad.trim(),
    adSoyad: `${dto.ad.trim()} ${dto.soyad.trim()}`,
    tcKimlikNo: dto.tcKimlikNo ?? null,
    telefon: dto.telefon?.trim() ?? null,
    eposta: dto.eposta?.trim() ?? null,
    dogumTarihi: dto.dogumTarihi ?? null,
    cinsiyet: dto.cinsiyet ?? 'BELIRTILMEMIS',
    adres: dto.adres?.trim() ?? null,
    notlar: dto.notlar?.trim() ?? null,
    girisTarihi: dto.girisTarihi,
    cikisTarihi: cikis,
    ziyaretNedeni: dto.ziyaretNedeni?.trim() ?? null,
    icerideMi: cikis === null,
    araclari: (dto.plakalar ?? []).map((p, i) => ({
      id: `arac-ms-yeni-${String(i)}`,
      plaka: p.plaka.toUpperCase().replace(/[\s-]/gu, ''),
      tur: p.tur ?? 'OTOMOBIL',
      otoparkYeri: p.otoparkYeri ?? null,
    })),
  });
}

/** Çıkış — misafirin açık araç kayıtları da aynı tarihte kapanır. */
export function mockMisafirCikis(id: string, tarih: string): void {
  const liste = misafirListesi();
  const i = liste.findIndex((m) => m.id === id);
  if (i < 0) throw new Error(`Misafir bulunamadı: ${id}`);
  const mevcut = liste[i] as Misafir;
  if (mevcut.cikisTarihi !== null) {
    throw new Error(`${mevcut.adSoyad} ${mevcut.cikisTarihi} tarihinde zaten çıkış yapmış.`);
  }
  if (tarih < mevcut.girisTarihi) {
    throw new Error(
      `Çıkış (${tarih}) giriş tarihinden (${mevcut.girisTarihi}) önce olamaz.`,
    );
  }
  liste[i] = { ...mevcut, cikisTarihi: tarih, icerideMi: false };
}

// ===========================================================================
// PORTFÖY YÖNETİM MERKEZİ — mock (ADR-0009)
//
// Gerçek uçla (`PortfoyOzeti`) aynı şekil. `acikIsEmri` ve `bekleyenTalep`
// **-1** döner: bu modüller henüz yok ve uydurma sayı üretilmez (BFS: sahte
// veri yasağı). Arayüz -1'i "Hazır değil" olarak gösterir.
// ===========================================================================

export interface PortfoyProjesi {
  readonly tenantId: string;
  readonly kod: string;
  readonly ad: string;
  readonly tip: string;
  readonly durum: string;
  readonly devirDayanagi: string;
  readonly devirBaslangic: string;
  readonly devirBitis: string | null;
  readonly apartmanSayisi: number;
  readonly bagimsizBolumSayisi: number;
  readonly malikSayisi: number;
  readonly kiraciSayisi: number;
  readonly sakinSayisi: number;
  readonly personelSayisi: number;
  readonly daireGorevlisiSayisi: number;
  readonly icerideMisafirSayisi: number;
  readonly ozetHatasi: string | null;
}

export interface PortfoyOzeti {
  readonly yonetimTenantId: string;
  readonly yonetimAdi: string;
  readonly projeSayisi: number;
  readonly siteSayisi: number;
  readonly apartmanSayisi: number;
  readonly toplamApartmanBinasi: number;
  readonly toplamBagimsizBolum: number;
  readonly toplamMalik: number;
  readonly toplamKiraci: number;
  readonly toplamSakin: number;
  readonly toplamPersonel: number;
  readonly toplamDaireGorevlisi: number;
  readonly icerideMisafir: number;
  readonly acikIsEmri: number;
  readonly bekleyenTalep: number;
  readonly tahsilatDurumu: {
    readonly tahakkuk: string;
    readonly tahsil: string;
    readonly kalan: string;
    readonly oranBinde: number | null;
  };
  readonly kritikUyarilar: readonly {
    readonly projeTenantId: string;
    readonly projeAdi: string;
    readonly siddet: 'KRITIK' | 'UYARI';
    readonly konu: string;
    readonly mesaj: string;
  }[];
  readonly aiOnerileri: readonly string[];
  readonly projeler: readonly PortfoyProjesi[];
  readonly okunamayanProjeSayisi: number;
}

const mockProjeler: readonly PortfoyProjesi[] = [
  {
    tenantId: 'tenant-guzel', kod: 'guzel-apartmani', ad: 'Güzel Apartmanı',
    tip: 'APARTMAN', durum: 'AKTIF',
    devirDayanagi: 'Yönetim sözleşmesi 2026/01',
    devirBaslangic: '2026-01-01', devirBitis: null,
    apartmanSayisi: 1, bagimsizBolumSayisi: 4, malikSayisi: 4,
    kiraciSayisi: 2, sakinSayisi: 5, personelSayisi: 3,
    daireGorevlisiSayisi: 2, icerideMisafirSayisi: 1, ozetHatasi: null,
  },
  {
    tenantId: 'tenant-yesil', kod: 'yesil-vadi-apartmani', ad: 'Yeşil Vadi Apartmanı',
    tip: 'APARTMAN', durum: 'AKTIF',
    devirDayanagi: 'Yönetim sözleşmesi 2026/02',
    devirBaslangic: '2026-01-01', devirBitis: null,
    apartmanSayisi: 1, bagimsizBolumSayisi: 2, malikSayisi: 2,
    kiraciSayisi: 1, sakinSayisi: 3, personelSayisi: 1,
    daireGorevlisiSayisi: 0, icerideMisafirSayisi: 0, ozetHatasi: null,
  },
  {
    tenantId: 'tenant-kuzey', kod: 'kuzey-sitesi', ad: 'Kuzey Sitesi',
    tip: 'SITE', durum: 'KURULUM',
    devirDayanagi: '2026/7 sayılı genel kurul kararı',
    devirBaslangic: '2026-07-01', devirBitis: null,
    apartmanSayisi: 3, bagimsizBolumSayisi: 0, malikSayisi: 0,
    kiraciSayisi: 0, sakinSayisi: 0, personelSayisi: 0,
    daireGorevlisiSayisi: 0, icerideMisafirSayisi: 0, ozetHatasi: null,
  },
];

export function mockPortfoyOzeti(): PortfoyOzeti {
  const t = (al: (p: PortfoyProjesi) => number): number =>
    mockProjeler.reduce((toplam, p) => toplam + al(p), 0);

  return {
    yonetimTenantId: 'tenant-bn-yonetim',
    yonetimAdi: 'BN Yönetim A.Ş.',
    projeSayisi: mockProjeler.length,
    siteSayisi: mockProjeler.filter((p) => p.tip === 'SITE').length,
    apartmanSayisi: mockProjeler.filter((p) => p.tip === 'APARTMAN').length,
    toplamApartmanBinasi: t((p) => p.apartmanSayisi),
    toplamBagimsizBolum: t((p) => p.bagimsizBolumSayisi),
    toplamMalik: t((p) => p.malikSayisi),
    toplamKiraci: t((p) => p.kiraciSayisi),
    toplamSakin: t((p) => p.sakinSayisi),
    toplamPersonel: t((p) => p.personelSayisi),
    toplamDaireGorevlisi: t((p) => p.daireGorevlisiSayisi),
    icerideMisafir: t((p) => p.icerideMisafirSayisi),
    // Modülleri yok — uydurma sayı üretilmez.
    acikIsEmri: -1,
    bekleyenTalep: -1,
    tahsilatDurumu: {
      tahakkuk: '184500.00', tahsil: '156200.00', kalan: '28300.00',
      oranBinde: 846,
    },
    kritikUyarilar: [
      {
        projeTenantId: 'tenant-kuzey', projeAdi: 'Kuzey Sitesi',
        siddet: 'UYARI', konu: 'Kurulum tamamlanmadı',
        mesaj: 'Kuzey Sitesi hâlâ KURULUM durumunda; iş işlemi yapılamaz.',
      },
      {
        projeTenantId: 'tenant-kuzey', projeAdi: 'Kuzey Sitesi',
        siddet: 'UYARI', konu: 'Bağımsız bölüm yok',
        mesaj: 'Kuzey Sitesi projesinde hiç bağımsız bölüm tanımlı değil; tahakkuk yapılamaz.',
      },
      {
        projeTenantId: 'tenant-guzel', projeAdi: 'Güzel Apartmanı',
        siddet: 'KRITIK', konu: 'Sertifika süresi doldu',
        mesaj: 'Güzel Apartmanı: 1 personelin sertifikası süresi dolmuş — süresi ' +
          'geçmiş belgeyle çalıştırmak idari yaptırım sebebidir.',
      },
    ],
    aiOnerileri: [
      '1 kritik uyarı var; en riskli projelerden başlanması önerilir.',
      '1 proje hâlâ KURULUM durumunda; aktifleştirilmeden tahakkuk yapılamaz.',
    ],
    projeler: mockProjeler,
    okunamayanProjeSayisi: 0,
  };
}
