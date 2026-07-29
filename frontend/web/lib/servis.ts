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
import {
  mockApartmanlar, mockAuditKayitlari, mockBloklar, mockBolumler,
  mockDaireKarti, mockYerlesim,
  mockMalikDevret, mockMalikDuzelt, mockMalikEkle,
  mockKiraciEkle, mockKiraciTahliye, mockSakinCikis, mockSakinEkle,
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
    getir('/apartmanlar', mockApartmanlar),

  bloklar: (apartmanId?: string): Promise<readonly MockBlok[]> =>
    getir(
      `/bloklar${apartmanId === undefined ? '' : `?apartmanId=${apartmanId}`}`,
      apartmanId === undefined
        ? mockBloklar
        : mockBloklar.filter((b) => b.apartmanId === apartmanId),
    ),

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

    const kayitlar = mockBolumler.filter(
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
  MockHisseRaporu as HisseRaporu,
  MockKat as Kat,
  MockKiraci as Kiraci,
  MockMalik as Malik,
  MockSakin as Sakin,
  MockYerlesimOzeti as YerlesimOzeti,
  MockYerlesimSatiri as YerlesimSatiri,
  SayfaliSonuc,
};
