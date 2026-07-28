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
  mockDaireKarti, mockKatlar, mockYerlesim,
  mockMalikDevret, mockMalikDuzelt, mockMalikEkle,
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
    getir(`/katlar?blokId=${blokId}`, mockKatlar.filter((k) => k.blokId === blokId)),

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
