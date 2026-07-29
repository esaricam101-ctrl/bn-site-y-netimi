/**
 * Servis katmanı — gerçek API ile mock arasında TEK anahtar.
 *
 * Sayfalar `api()` yerine buradan okur. Backend hazır olmadığında (PostgreSQL
 * kurulu değil — DEVLOG TODO-3) mock döner; hazır olduğunda tek bayrak
 * değişikliğiyle gerçeğe geçilir ve SAYFA KODU DEĞİŞMEZ.
 *
 * Bayrak `NEXT_PUBLIC_MOCK` ile kontrol edilir. Varsayılan MOCK'tur: backend
 * çalışmıyorken varsayılanın gerçek API olması, her sayfada ağ hatası
 * göstermek demektir ve arayüz geliştirilemez.
 */
import { api } from './api';
import { kesirCoz, kesirleriTopla, kesirYaz, tamiEdiyorMu, type Kesir } from './kesir';
import {
  mockAuditKayitlari, mockBolumleriOku, mockDaireKarti, mockYerlesim,
  mockArsaPayiDuzelt, mockBolumTasi, mockBolumTopluOlustur,
  mockGiderTuruEkle, mockGiderTuruGuncelle, mockGiderTurleriniOku, mockGiderTuruSil,
  mockCalisanAyril, mockCalisanEkle, mockCalisanlariOku,
  type MockCalisanGirdisi, type MockKonutCalisani,
  type MockArsaPayiRaporu, type MockArsaPayiSatiri, type MockTopluBolumSatiri,
  type MockGiderTuru, type MockGiderTuruGirdisi,
  mockApartmanEkle, mockApartmanGuncelle, mockApartmanlariOku, mockApartmanSil,
  mockBlokEkle, mockBlokGuncelle, mockBloklariOku, mockBlokSil,
  mockMalikDevret, mockMalikDuzelt, mockMalikEkle,
  mockKiraciDuzelt, mockKiraciEkle, mockKiraciTahliye,
  mockSakinCikis, mockSakinDuzelt, mockSakinEkle,
  mockKatEkle, mockKatGuncelle, mockKatlariOku, mockKatSil,
  type MockApartman, type MockAuditSatiri, type MockBlok, type MockBolum,
  type MockDaireKarti, type MockHisseRaporu, type MockKat, type MockKiraci,
  type MockMalik, type MockSakin,
  type MockYerlesimOzeti, type MockYerlesimSatiri, type SayfaliSonuc,
} from './mock/veri';

export const MOCK_AKTIF = (process.env['NEXT_PUBLIC_MOCK'] ?? '1') !== '0';

/** Mock çağrılarında gerçekçi gecikme — yükleniyor ekranları görünür olsun. */
const GECIKME_MS = 220;

function gecikmeli<T>(deger: T): Promise<T> {
  return new Promise((coz) => setTimeout(() => coz(deger), GECIKME_MS));
}

function jeton(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return sessionStorage.getItem('bnos.token') ?? undefined;
}

async function getir<T>(yol: string, mockDeger: T): Promise<T> {
  if (MOCK_AKTIF) return gecikmeli(mockDeger);
  const token = jeton();
  return api<T>(yol, { ...(token ? { token } : {}) });
}

/**
 * Yazma isteği. Mock modda `mockEtki` çalıştırılır — hiçbir şey yapmasaydı
 * kullanıcı formu doldurur, "kaydedildi" görür ve liste değişmezdi.
 *
 * Kayıt oluşturan her POST idempotency anahtarı taşır (BFS v1 §12): ağ
 * yeniden denemesi mükerrer kayıt üretmemelidir.
 */
async function gonder(
  yol: string,
  method: 'POST' | 'PATCH',
  govde: unknown,
  mockEtki: () => void,
): Promise<void> {
  if (MOCK_AKTIF) {
    mockEtki();
    await gecikmeli(null);
    return;
  }
  const token = jeton();
  await api<unknown>(yol, {
    method,
    govde,
    ...(token ? { token } : {}),
    ...(method === 'POST' ? { idempotencyKey: crypto.randomUUID() } : {}),
  });
}

/**
 * Silme isteği. Gövde taşır: soft delete gerekçesi zorunludur (BFS v1 §5.2)
 * ve denetim kaydına yazılır.
 */
async function sil(yol: string, govde: unknown, mockEtki: () => void): Promise<void> {
  if (MOCK_AKTIF) {
    mockEtki();
    await gecikmeli(null);
    return;
  }
  const token = jeton();
  await api<unknown>(yol, { method: 'DELETE', govde, ...(token ? { token } : {}) });
}

/**
 * Mock arsa payı raporu. Toplam kesir olarak hesaplanır; ondalığa çevrilmez
 * — 1/3 gibi paylarda ondalık toplam asla tamı etmez (bkz. `lib/kesir.ts`).
 */
function arsaPayiRaporuUret(): MockArsaPayiRaporu {
  const bolumler = mockBolumleriOku();
  const toplam = kesirleriTopla(
    bolumler.map((b) => kesirCoz(b.arsaPayi)).filter((k): k is Kesir => k !== null),
  );
  const gecerli = tamiEdiyorMu(toplam);
  return {
    gecerli,
    toplam: kesirYaz(toplam),
    mesaj: gecerli
      ? 'Arsa payı toplamı tamı ediyor.'
      : 'Arsa payı toplamı tamı etmiyor; yönetim planı ekiyle karşılaştırın (KMK md. 3).',
    bolumSayisi: bolumler.length,
    okunamayanBolumler: bolumler.filter((b) => kesirCoz(b.arsaPayi) === null).map((b) => b.id),
  };
}

export interface ApartmanGirdisi {
  readonly ad: string;
  readonly adres?: string;
  /** Site içindeki kısa kod. Site dışı tenant'ta boş bırakılır. */
  readonly siteIciKod?: string;
}

export interface MalikEkleGirdisi {
  readonly kisiAdi: string;
  readonly hissePay: string;
  readonly hissePayda: string;
  readonly tapuTuru: string;
  readonly tapuBaslangic: string;
  readonly tapuYevmiyeNo?: string;
}

export interface MalikDuzeltGirdisi {
  readonly tapuTuru?: string;
  readonly tapuYevmiyeNo?: string;
}

export interface KiraciEkleGirdisi {
  readonly kisiAdi: string;
  readonly baslangic: string;
  readonly bitis?: string;
  readonly sozlesmeNo?: string;
  /** Para METİN taşınır — JSON number float'tır (BFS v1 §11). */
  readonly depozito?: string;
}

export interface KiraciDuzeltGirdisi {
  readonly sozlesmeNo?: string;
  readonly depozito?: string;
  /** Uzatma/kısaltma. Tahliye edilmiş sözleşmede değiştirilemez. */
  readonly bitis?: string;
}

export interface SakinDuzeltGirdisi {
  readonly yakinlikDerecesi?: string;
  readonly girisTarihi?: string;
  readonly acilDurumKisiAdi?: string;
  readonly acilDurumTelefon?: string;
}

export interface SakinEkleGirdisi {
  readonly kisiAdi: string;
  readonly yakinlikDerecesi: string;
  readonly girisTarihi: string;
  readonly telefon?: string;
  readonly acilDurumKisiAdi?: string;
  readonly acilDurumTelefon?: string;
}

export const servis = {
  apartmanlar: (): Promise<readonly MockApartman[]> =>
    getir('/apartmanlar', mockApartmanlariOku()),

  apartmanEkle: (dto: ApartmanGirdisi): Promise<void> =>
    gonder('/apartmanlar', 'POST', dto, () => {
      mockApartmanEkle(dto.ad, dto.adres, dto.siteIciKod);
    }),

  apartmanGuncelle: (id: string, dto: ApartmanGirdisi): Promise<void> =>
    gonder(`/apartmanlar/${id}`, 'PATCH', dto, () => {
      mockApartmanGuncelle(id, dto);
    }),

  /** Soft delete — bloğu olan apartman silinemez. */
  apartmanSil: (id: string, gerekce: string): Promise<void> =>
    sil(`/apartmanlar/${id}`, { gerekce }, () => { mockApartmanSil(id); }),

  bloklar: (apartmanId?: string): Promise<readonly MockBlok[]> =>
    getir(
      `/bloklar${apartmanId === undefined ? '' : `?apartmanId=${apartmanId}`}`,
      mockBloklariOku(apartmanId),
    ),

  blokEkle: (apartmanId: string, ad: string): Promise<void> =>
    gonder('/bloklar', 'POST', { apartmanId, ad }, () => {
      mockBlokEkle(apartmanId, ad);
    }),

  /** Blok BAŞKA APARTMANA TAŞINMAZ — hiyerarşi sabittir; yalnızca ad değişir. */
  blokGuncelle: (id: string, ad: string): Promise<void> =>
    gonder(`/bloklar/${id}`, 'PATCH', { ad }, () => { mockBlokGuncelle(id, ad); }),

  /** Soft delete — bağımsız bölümü olan blok silinemez. */
  blokSil: (id: string, gerekce: string): Promise<void> =>
    sil(`/bloklar/${id}`, { gerekce }, () => { mockBlokSil(id); }),

  katlar: (blokId: string): Promise<readonly MockKat[]> =>
    getir(`/katlar?blokId=${blokId}`, mockKatlariOku(blokId)),

  katEkle: (blokId: string, no: number, ad?: string): Promise<void> =>
    gonder(
      '/katlar', 'POST',
      { blokId, no, ...(ad === undefined || ad === '' ? {} : { ad }) },
      () => { mockKatEkle(blokId, no, ad); },
    ),

  /**
   * Kat düzeltme. Bölümü olan katın NUMARASI değiştirilemez — bölümlerin
   * `kat` alanı bu numaraya bağlıdır ve oluşturmada eşitliği zorlanır.
   */
  katGuncelle: (
    blokId: string, katId: string, dto: { readonly no?: number; readonly ad?: string },
  ): Promise<void> =>
    gonder(`/katlar/${katId}`, 'PATCH', dto, () => {
      mockKatGuncelle(blokId, katId, dto);
    }),

  /** Soft delete — gerekçe zorunludur (BFS v1 §5.2). */
  katSil: (blokId: string, katId: string, gerekce: string): Promise<void> =>
    sil(`/katlar/${katId}`, { gerekce }, () => { mockKatSil(blokId, katId); }),

  /**
   * Bölümler. Gerçek uç cursor sayfalama döner (`{ kayitlar, sonrakiImlec }`);
   * mock tarafında tüm liste tek seferde gelir — sayfalama arayüzü mock'la
   * test edilemez, bu bilinçli bir sınırdır.
   */
  bolumler: (suzgec: { readonly blokId?: string; readonly katId?: string } = {}):
  Promise<SayfaliSonuc<MockBolum>> => {
    const parametre = new URLSearchParams();
    if (suzgec.blokId !== undefined) parametre.set('blokId', suzgec.blokId);
    if (suzgec.katId !== undefined) parametre.set('katId', suzgec.katId);
    const sorgu = parametre.toString();

    const kayitlar = mockBolumleriOku().filter(
      (b) =>
        (suzgec.blokId === undefined || b.blokId === suzgec.blokId) &&
        (suzgec.katId === undefined || b.katId === suzgec.katId),
    );

    // Mock tek sayfa doner; sayfalama arayuzu mock'la test EDILEMEZ. Zarf
    // gercek ucla ayni oldugu icin bayrak kapaninca sayfa kodu degismez.
    return getir(`/bolumler${sorgu === '' ? '' : `?${sorgu}`}`, {
      kayitlar, sonrakiImlec: null,
    });
  },

  /**
   * Toplu bölüm oluşturma — CSV içe aktarmanın hedefi.
   *
   * TEK İŞLEMDİR: bir satır geçersizse hiçbiri yazılmaz. Yarım girilmiş bir
   * kat, arsa payı toplamını da yarım bırakır ve neyin eksik olduğu görünmez.
   * Arsa payı TOPLAMI burada denetlenmez; bina parça parça girilirken toplam
   * doğal olarak 1'in altındadır (KMK md. 3 tamlığı ayrı uçla denetlenir).
   */
  bolumTopluOlustur: (
    blokId: string, katId: string | null, kat: number,
    bolumler: readonly MockTopluBolumSatiri[],
  ): Promise<void> =>
    gonder(
      '/bolumler/toplu', 'POST',
      { blokId, ...(katId === null ? {} : { katId }), kat, bolumler },
      () => { mockBolumTopluOlustur(blokId, katId, kat, bolumler); },
    ),

  // --- Konut çalışanları (personel) ---

  konutCalisanlari: (
    suzgec: { gorev?: string; durum?: string; arama?: string } = {},
  ): Promise<readonly MockKonutCalisani[]> => {
    const p = new URLSearchParams();
    if (suzgec.gorev !== undefined) p.set('gorev', suzgec.gorev);
    if (suzgec.durum !== undefined) p.set('durum', suzgec.durum);
    if (suzgec.arama !== undefined) p.set('arama', suzgec.arama);
    const sorgu = p.toString();
    return getir(
      `/konut-calisanlari${sorgu === '' ? '' : `?${sorgu}`}`,
      mockCalisanlariOku(suzgec),
    );
  },

  calisanEkle: (dto: MockCalisanGirdisi): Promise<void> =>
    gonder('/konut-calisanlari', 'POST', dto, () => { mockCalisanEkle(dto); }),

  /** İşten ayrılış — kayıt KAPANIR, silinmez. */
  calisanAyril: (
    id: string, istenAyrilisTarihi: string, gerekce: string,
  ): Promise<void> =>
    gonder(
      `/konut-calisanlari/${id}/ayril`, 'PATCH',
      { istenAyrilisTarihi, gerekce },
      () => { mockCalisanAyril(id, istenAyrilisTarihi); },
    ),

  // --- Gider türleri (aidat kuralları — KMK md. 20) ---

  giderTurleri: (yalnizcaAktif = false): Promise<readonly MockGiderTuru[]> =>
    getir(
      `/gider-turleri${yalnizcaAktif ? '?yalnizcaAktif=true' : ''}`,
      mockGiderTurleriniOku(yalnizcaAktif),
    ),

  giderTuruEkle: (dto: MockGiderTuruGirdisi): Promise<void> =>
    gonder('/gider-turleri', 'POST', dto, () => { mockGiderTuruEkle(dto); }),

  /** `kod` DEĞİŞTİRİLEMEZ — geçmiş tahakkuklar bu kodla ilişkilendirilir. */
  giderTuruGuncelle: (
    id: string, dto: Partial<MockGiderTuruGirdisi>,
  ): Promise<void> =>
    gonder(`/gider-turleri/${id}`, 'PATCH', dto, () => { mockGiderTuruGuncelle(id, dto); }),

  /** Arşivleme — kayıt silinmez, pasife alınır. */
  giderTuruSil: (id: string, gerekce: string): Promise<void> =>
    sil(`/gider-turleri/${id}`, { gerekce }, () => { mockGiderTuruSil(id); }),

  /**
   * Arsa payı toplamı denetimi — KMK md. 3.
   *
   * Mock tarafında toplam BURADA hesaplanmaz; hesap `mockArsaPayiDuzelt`
   * içindeki kesir aritmetiğiyle aynı olmalı diye tek yerde toplanır ve
   * rapor da oradan türetilir (bkz. `arsaPayiRaporuUret`).
   */
  arsaPayiDurumu: (): Promise<MockArsaPayiRaporu> =>
    getir('/bolumler/arsa-payi-durumu', arsaPayiRaporuUret()),

  /**
   * Arsa paylarını TOPLU düzeltir. Tek bölümün payını değiştirmek binanın
   * toplamını sessizce bozar; bu yüzden tekil güncelleme arsa payına
   * dokunmaz. Toplam tamı etmiyorsa hiçbir satır yazılmaz.
   */
  arsaPayiDuzelt: (
    satirlar: readonly MockArsaPayiSatiri[], gerekce: string,
  ): Promise<void> =>
    gonder('/bolumler/arsa-payi-duzelt', 'POST', { satirlar, gerekce }, () => {
      mockArsaPayiDuzelt(satirlar);
    }),

  /** Toplu taşıma. Gerekçe zorunlu — hiyerarşi değişikliği denetime yazılır. */
  bolumTasi: (
    bolumIdler: readonly string[], hedefBlokId: string,
    hedefKatId: string | null, gerekce: string,
  ): Promise<void> =>
    gonder(
      '/bolumler/tasi', 'POST',
      {
        bolumIdler, hedefBlokId,
        ...(hedefKatId === null ? {} : { hedefKatId }),
        gerekce,
      },
      () => { mockBolumTasi(bolumIdler, hedefBlokId, hedefKatId); },
    ),

  yerlesimOzeti: (): Promise<MockYerlesimOzeti> =>
    getir('/bolumler/yerlesim-ozeti', mockYerlesim),

  /** Daire kartı — malik · hisse · kiracı · sakin tek çağrıda. */
  daireKarti: async (bolumId: string): Promise<MockDaireKarti> => {
    const mock = mockDaireKarti(bolumId);
    if (MOCK_AKTIF) {
      if (mock === null) throw new Error(`Bölüm bulunamadı: ${bolumId}`);
      return gecikmeli(mock);
    }
    const token = jeton();
    return api<MockDaireKarti>(`/daireler/${bolumId}/kart`, {
      ...(token ? { token } : {}),
    });
  },

  /** Denetim kayıtları — kim, ne zaman, ne yaptı. */
  auditKayitlari: (
    varlik: string,
    varlikId: string,
  ): Promise<SayfaliSonuc<MockAuditSatiri>> =>
    getir(`/audit?varlik=${varlik}&varlikId=${varlikId}`, {
      kayitlar: mockAuditKayitlari(varlikId),
      sonrakiImlec: null,
    }),

  // --- Malik yazma işlemleri ---
  // Mock modda bellek örtüsü güncellenir; kalıcılık gerçek backend'in işidir
  // ve taklit EDİLMEZ (sayfa yenilenince başlangıç durumuna döner).

  malikEkle: (bolumId: string, dto: MalikEkleGirdisi): Promise<void> =>
    gonder(`/bolumler/${bolumId}/malikler`, 'POST', dto, () => {
      mockMalikEkle(bolumId, dto);
    }),

  /** Tapu dönemini kapatır. Kayıt SİLİNMEZ — tarihçe korunur. */
  malikDevret: (bolumId: string, malikId: string, tapuBitis: string): Promise<void> =>
    gonder(
      `/bolumler/${bolumId}/malikler/${malikId}/devret`, 'PATCH', { tapuBitis },
      () => { mockMalikDevret(bolumId, malikId, tapuBitis); },
    ),

  /**
   * Yazım hatası ve vekâlet düzeltmesi. HİSSE ORANI BURADA DEĞİŞTİRİLEMEZ —
   * hisse değişikliği bir devirdir (`malikDevret` + `malikEkle`).
   */
  malikDuzelt: (
    bolumId: string,
    malikId: string,
    dto: MalikDuzeltGirdisi,
  ): Promise<void> =>
    gonder(
      `/bolumler/${bolumId}/malikler/${malikId}`, 'PATCH', dto,
      () => { mockMalikDuzelt(bolumId, malikId, dto); },
    ),

  // --- Kiracı ---

  kiraciEkle: (bolumId: string, dto: KiraciEkleGirdisi): Promise<void> =>
    gonder(`/bolumler/${bolumId}/kiracilar`, 'POST', dto, () => {
      mockKiraciEkle(bolumId, dto);
    }),

  /**
   * Sözleşme bilgisi düzeltme / uzatma.
   *
   * KİŞİ ve BAŞLANGIÇ değiştirilemez — ikisi de sözleşmenin kimliğidir.
   * Yanlış kişiye açılmış sözleşme düzeltilmez; tahliye edilip yenisi açılır.
   */
  kiraciDuzelt: (
    bolumId: string, kiraciId: string, dto: KiraciDuzeltGirdisi,
  ): Promise<void> =>
    gonder(`/bolumler/${bolumId}/kiracilar/${kiraciId}`, 'PATCH', dto, () => {
      mockKiraciDuzelt(bolumId, kiraciId, dto);
    }),

  /** Tahliye — sözleşme kapanır, kayıt SİLİNMEZ. */
  kiraciTahliye: (
    bolumId: string, kiraciId: string, tahliyeTarihi: string, tahliyeGerekcesi: string,
  ): Promise<void> =>
    gonder(
      `/bolumler/${bolumId}/kiracilar/${kiraciId}/tahliye`, 'PATCH',
      { tahliyeTarihi, tahliyeGerekcesi },
      () => { mockKiraciTahliye(bolumId, kiraciId, tahliyeTarihi, tahliyeGerekcesi); },
    ),

  // --- Sakin ---

  sakinEkle: (bolumId: string, dto: SakinEkleGirdisi): Promise<void> =>
    gonder(`/bolumler/${bolumId}/sakinler`, 'POST', dto, () => {
      mockSakinEkle(bolumId, dto);
    }),

  /** Sakin bilgisi düzeltme. KİŞİ değiştirilemez — kaydın kimliğidir. */
  sakinDuzelt: (
    bolumId: string, sakinId: string, dto: SakinDuzeltGirdisi,
  ): Promise<void> =>
    gonder(`/bolumler/${bolumId}/sakinler/${sakinId}`, 'PATCH', dto, () => {
      mockSakinDuzelt(bolumId, sakinId, dto);
    }),

  /** Çıkış — dönem kapanır, kayıt SİLİNMEZ. */
  sakinCikis: (bolumId: string, sakinId: string, cikisTarihi: string): Promise<void> =>
    gonder(
      `/bolumler/${bolumId}/sakinler/${sakinId}/cikis`, 'PATCH', { cikisTarihi },
      () => { mockSakinCikis(bolumId, sakinId, cikisTarihi); },
    ),
};

export type {
  MockApartman as Apartman,
  MockAuditSatiri as AuditSatiri,
  MockBlok as Blok,
  MockBolum as Bolum,
  MockDaireKarti as DaireKarti,
  MockGiderTuru as GiderTuru,
  MockGiderTuruGirdisi as GiderTuruGirdisi,
  MockKonutCalisani as KonutCalisani,
  MockCalisanGirdisi as CalisanGirdisi,
  MockHisseRaporu as HisseRaporu,
  MockKat as Kat,
  MockKiraci as Kiraci,
  MockMalik as Malik,
  MockSakin as Sakin,
  MockYerlesimOzeti as YerlesimOzeti,
  MockYerlesimSatiri as YerlesimSatiri,
  SayfaliSonuc,
};
