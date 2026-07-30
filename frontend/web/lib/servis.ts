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
  mockPersonelAyril, mockPersonelEkle, mockPersonelleriOku,
  type MockPersonelGirdisi, type MockSitePersoneli,
  mockPortfoyOzeti,
  mockDaireGorevlileriniOku, mockDaireGorevlisiAyril, mockDaireGorevlisiEkle,
  mockMisafirCikis, mockMisafirEkle, mockMisafirleriOku,
  type MockDaireGorevlisi, type MockMisafir,
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

/* ---------------------- Portföy Yönetim Merkezi (ADR-0009) ---------------- */

/** Kontrol merkezinde bir projenin satırı. */
export interface PortfoyProjesi {
  readonly tenantId: string;
  readonly kod: string;
  readonly ad: string;
  /** APARTMAN | SITE — site/apartman sayımı buna dayanır. */
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
  /** Özeti okunamadıysa doludur; satır YİNE gösterilir (kısmî veri). */
  readonly ozetHatasi: string | null;
}

export interface PortfoyTahsilat {
  /** Para METİN taşınır (ADR-0007): JSON number float'tır. */
  readonly tahakkuk: string;
  readonly tahsil: string;
  readonly kalan: string;
  /** BİNDE tam sayı (`847` = %84,7). */
  readonly oranBinde: number | null;
}

export interface PortfoyUyarisi {
  readonly projeTenantId: string;
  readonly projeAdi: string;
  readonly siddet: 'KRITIK' | 'UYARI';
  readonly konu: string;
  readonly mesaj: string;
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
  /** **-1** = modül henüz yok; uydurma sayı üretilmez, arayüz "Hazır değil" gösterir. */
  readonly acikIsEmri: number;
  readonly bekleyenTalep: number;
  readonly tahsilatDurumu: PortfoyTahsilat;
  readonly kritikUyarilar: readonly PortfoyUyarisi[];
  readonly aiOnerileri: readonly string[];
  readonly projeler: readonly PortfoyProjesi[];
  readonly okunamayanProjeSayisi: number;
}

export interface ProjeGirisSonucu {
  readonly accessToken: string;
  readonly projeTenantId: string;
  readonly projeAdi: string;
  readonly devirDayanagi: string;
}

/** Kişi bilgileriyle birlikte girilen araç plakası. */
export interface PlakaGirdisi {
  readonly plaka: string;
  readonly tur?: string;
  readonly marka?: string;
  readonly model?: string;
  readonly renk?: string;
  readonly otoparkYeri?: string;
}

/**
 * Formun "Kişi Bilgileri" bölümü — sunucudaki `KisiGirdisiDto` ile aynı şekil.
 *
 * `kisiId` verilirse bu nesne GÖNDERİLMEZ. TC kimlik no verilirse sunucu aynı
 * numaralı mevcut kişiyi kullanır ve MÜKERRER KAYIT AÇMAZ.
 */
export interface KisiGirdisi {
  readonly ad: string;
  readonly soyad: string;
  readonly tcKimlikNo?: string;
  readonly telefon?: string;
  readonly eposta?: string;
  readonly dogumTarihi?: string;
  readonly cinsiyet?: string;
  readonly adres?: string;
  readonly notlar?: string;
  readonly plakalar?: readonly PlakaGirdisi[];
}

/**
 * Hızlı kayıt yanıtı. `kisiOlusturulduMu` ve `tcIleEslestiMi` kullanıcıya
 * gösterilir: yeni kişi girdiğini sanırken TC eşleşmesi yüzünden mevcut bir
 * kayda bağlanmış olabilir ve hangi kayda bağlandığını görmesi gerekir.
 */
export interface HizliKayitSonucu {
  readonly id: string;
  readonly durum: string;
  readonly kisiId: string;
  readonly kisiOlusturulduMu: boolean;
  readonly tcIleEslestiMi: boolean;
  readonly plakaSayisi: number;
}

export interface MalikEkleGirdisi {
  /** Mevcut kişi. Verilmezse `kisi` bölümünden oluşturulur. */
  readonly kisiId?: string;
  readonly kisi?: KisiGirdisi;
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

/**
 * Kefil bilgisi. AYRI BİR KİŞİ KAYDI AÇILMAZ: yönetimin ortak gider alacağı
 * malike (KMK md. 20) ve kiracıya (md. 22) yönelir, kefile yönelmez.
 */
export interface KefilGirdisi {
  readonly adSoyad: string;
  readonly tcKimlikNo?: string;
  readonly telefon?: string;
  readonly adres?: string;
}

export interface KiraciEkleGirdisi {
  readonly kisiId?: string;
  readonly kisi?: KisiGirdisi;
  readonly baslangic: string;
  readonly bitis?: string;
  readonly sozlesmeNo?: string;
  /** Para METİN taşınır — JSON number float'tır (BFS v1 §11). */
  readonly depozito?: string;
  readonly kefil?: KefilGirdisi;
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
  readonly kisiId?: string;
  readonly kisi?: KisiGirdisi;
  readonly yakinlikDerecesi: string;
  readonly girisTarihi: string;
  readonly acilDurumKisiAdi?: string;
  readonly acilDurumTelefon?: string;
}

/** Daire görevlisi — işvereni MALİK/KİRACI/SAKİN olan ev hizmetleri görevlisi. */
export interface DaireGorevlisiGirdisi {
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
  readonly plakalar?: readonly PlakaGirdisi[];
  readonly gorev: string;
  readonly calismaBaslangic: string;
  readonly calismaBitis?: string;
  readonly aciklama?: string;
}

export interface MisafirGirdisi {
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
  readonly plakalar?: readonly PlakaGirdisi[];
  readonly girisTarihi: string;
  readonly cikisTarihi?: string;
  readonly ziyaretNedeni?: string;
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

  // --- Portföy Yönetim Merkezi (ADR-0009) ---
  //
  // Yönetim firması giriş yaptığında ilk açılan ekranın verisi. Özet, PROJE
  // BAŞINA ayrı sorgu + uygulama katmanında toplamadır; çapraz-tenant sorgu
  // yoktur (ADR-0002'nin kabul ettiği bedel).

  portfoyOzeti: (): Promise<PortfoyOzeti> =>
    getir('/portfoy/ozet', mockPortfoyOzeti()),

  /**
   * Projeye giriş — proje kapsamlı jeton alır ve OTURUMA YAZAR.
   *
   * Jeton `tid = proje` ve `dvr = firma` taşır; sonraki bütün istekler o
   * projenin bağlamında koşar. Firma jetonu `bnos.portfoyToken` altında
   * saklanır: portföye dönerken yeniden giriş yapmak gerekmemelidir.
   */
  projeyeGir: async (projeTenantId: string): Promise<ProjeGirisSonucu> => {
    if (MOCK_AKTIF) {
      const proje = mockPortfoyOzeti().projeler.find((p) => p.tenantId === projeTenantId);
      if (!proje) throw new Error(`Proje bulunamadı: ${projeTenantId}`);
      return gecikmeli({
        accessToken: 'mock-proje-jetonu',
        projeTenantId,
        projeAdi: proje.ad,
        devirDayanagi: proje.devirDayanagi,
      });
    }
    const token = jeton();
    const sonuc = await api<ProjeGirisSonucu>(
      `/portfoy/projeler/${projeTenantId}/gir`,
      {
        method: 'POST',
        govde: {},
        ...(token ? { token } : {}),
        idempotencyKey: crypto.randomUUID(),
      },
    );
    if (typeof window !== 'undefined') {
      // Firma jetonu KORUNUR; proje jetonu onun yerine geçer. Kaybedilirse
      // kullanıcı portföye dönmek için yeniden giriş yapmak zorunda kalır.
      const firmaJetonu = sessionStorage.getItem('bnos.token');
      if (firmaJetonu !== null && sessionStorage.getItem('bnos.portfoyToken') === null) {
        sessionStorage.setItem('bnos.portfoyToken', firmaJetonu);
      }
      sessionStorage.setItem('bnos.token', sonuc.accessToken);
      sessionStorage.setItem('bnos.projeAdi', sonuc.projeAdi);
    }
    return sonuc;
  },

  /** Portföye dön — firma jetonuna geri geçilir. */
  portfoyeDon: (): void => {
    if (typeof window === 'undefined') return;
    const firmaJetonu = sessionStorage.getItem('bnos.portfoyToken');
    if (firmaJetonu !== null) sessionStorage.setItem('bnos.token', firmaJetonu);
    sessionStorage.removeItem('bnos.portfoyToken');
    sessionStorage.removeItem('bnos.projeAdi');
  },

  // --- Site personeli (işveren YÖNETİM) ---
  //
  // ⚠️  Daire görevlisi ile KARIŞTIRILMAMALIDIR (aşağıda ayrı uç): orada
  //     işveren malik/kiracıdır ve SGK · vardiya · zimmet alanı yoktur.

  sitePersonelleri: (
    suzgec: { gorev?: string; durum?: string; arama?: string } = {},
  ): Promise<readonly MockSitePersoneli[]> => {
    const p = new URLSearchParams();
    if (suzgec.gorev !== undefined) p.set('gorev', suzgec.gorev);
    if (suzgec.durum !== undefined) p.set('durum', suzgec.durum);
    if (suzgec.arama !== undefined) p.set('arama', suzgec.arama);
    const sorgu = p.toString();
    return getir(
      `/site-personeli${sorgu === '' ? '' : `?${sorgu}`}`,
      mockPersonelleriOku(suzgec),
    );
  },

  personelEkle: (dto: MockPersonelGirdisi): Promise<void> =>
    gonder('/site-personeli', 'POST', dto, () => { mockPersonelEkle(dto); }),

  /** İşten ayrılış — kayıt KAPANIR, silinmez. */
  personelAyril: (
    id: string, istenAyrilisTarihi: string, gerekce: string,
  ): Promise<void> =>
    gonder(
      `/site-personeli/${id}/ayril`, 'PATCH',
      { istenAyrilisTarihi, gerekce },
      () => { mockPersonelAyril(id, istenAyrilisTarihi); },
    ),

  // --- Daire görevlileri (işveren MALİK / KİRACI / SAKİN) ---
  //
  // Çocuk bakıcısı · ev yardımcısı · şoför · temizlikçi. Yönetim bu kişilerin
  // İŞVERENİ DEĞİLDİR; kayıt site giriş ve güvenlik kütüğüdür. Bu yüzden
  // SGK · departman · vardiya · zimmet alanı YOKTUR.

  daireGorevlileri: (
    suzgec: { bolumId?: string; gorev?: string; durum?: string; arama?: string } = {},
  ): Promise<readonly MockDaireGorevlisi[]> => {
    const p = new URLSearchParams();
    if (suzgec.bolumId !== undefined) p.set('bolumId', suzgec.bolumId);
    if (suzgec.gorev !== undefined) p.set('gorev', suzgec.gorev);
    if (suzgec.durum !== undefined) p.set('durum', suzgec.durum);
    if (suzgec.arama !== undefined) p.set('arama', suzgec.arama);
    const sorgu = p.toString();
    return getir(
      `/daire-gorevlileri${sorgu === '' ? '' : `?${sorgu}`}`,
      mockDaireGorevlileriniOku(suzgec),
    );
  },

  daireGorevlisiEkle: (dto: DaireGorevlisiGirdisi): Promise<void> =>
    gonder('/daire-gorevlileri', 'POST', dto, () => { mockDaireGorevlisiEkle(dto); }),

  /** Hizmet ilişkisi sonlandırma — kayıt KAPANIR, araçları da kapanır. */
  daireGorevlisiAyril: (
    id: string, calismaBitis: string, gerekce: string,
  ): Promise<void> =>
    gonder(
      `/daire-gorevlileri/${id}/ayril`, 'PATCH',
      { calismaBitis, gerekce },
      () => { mockDaireGorevlisiAyril(id, calismaBitis); },
    ),

  // --- Misafirler (hak sahibi DEĞİL — `kisi` kaydı açılmaz) ---

  misafirler: (
    suzgec: { bolumId?: string; icerideMi?: boolean; arama?: string } = {},
  ): Promise<readonly MockMisafir[]> => {
    const p = new URLSearchParams();
    if (suzgec.bolumId !== undefined) p.set('bolumId', suzgec.bolumId);
    if (suzgec.icerideMi !== undefined) p.set('icerideMi', String(suzgec.icerideMi));
    if (suzgec.arama !== undefined) p.set('arama', suzgec.arama);
    const sorgu = p.toString();
    return getir(
      `/misafirler${sorgu === '' ? '' : `?${sorgu}`}`,
      mockMisafirleriOku(suzgec),
    );
  },

  misafirEkle: (dto: MisafirGirdisi): Promise<void> =>
    gonder('/misafirler', 'POST', dto, () => { mockMisafirEkle(dto); }),

  /** Çıkış — misafirin açık araç kayıtları da aynı tarihte kapanır. */
  misafirCikis: (id: string, cikisTarihi: string): Promise<void> =>
    gonder(
      `/misafirler/${id}/cikis`, 'PATCH', { cikisTarihi },
      () => { mockMisafirCikis(id, cikisTarihi); },
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
  MockSitePersoneli as SitePersoneli,
  MockPersonelGirdisi as PersonelGirdisi,
  MockDaireGorevlisi as DaireGorevlisi,
  MockMisafir as Misafir,
  MockHisseRaporu as HisseRaporu,
  MockKat as Kat,
  MockKiraci as Kiraci,
  MockMalik as Malik,
  MockSakin as Sakin,
  MockYerlesimOzeti as YerlesimOzeti,
  MockYerlesimSatiri as YerlesimSatiri,
  SayfaliSonuc,
};

/* ------------------------- Muhasebe (0015 · ADR-0003) --------------------- */
//
// Hesap planı · fişler · defterler · mizan · dönem kapanışı. Backend uçları
// `/muhasebe/*`; mock YOKTUR — muhasebe verisi uydurulamaz, sahte mizan
// gerçek bir mizan gibi görünür ve karar dayanağı olarak kullanılabilir.

export interface MuhasebeHesabi {
  readonly id: string;
  readonly kod: string;
  readonly ad: string;
  readonly tip: string;
  readonly ozellik: string;
  readonly ustHesapId: string | null;
  readonly fisKesilebilirMi: boolean;
  readonly aktif: boolean;
  readonly seviye: number;
  readonly hareketSayisi: number;
}

export interface MuhasebeFisiSatiri {
  readonly id: string;
  readonly fisNo: string;
  readonly tarih: string;
  readonly fisTuru: string;
  readonly durum: string;
  readonly aciklama: string;
  readonly yevmiyeSiraNo: number | null;
  readonly kaynakTipi: string;
  readonly satirSayisi: number;
  /** Para METİN taşınır — JSON number float'tır (ADR-0007). */
  readonly borcToplam: string;
}

export interface MizanSatiri {
  readonly hesapId: string;
  readonly kod: string;
  readonly ad: string;
  readonly tip: string;
  readonly seviye: number;
  readonly borcToplam: string;
  readonly alacakToplam: string;
  readonly borcBakiye: string;
  readonly alacakBakiye: string;
}

export interface Mizan {
  readonly baslangic: string;
  readonly bitis: string;
  readonly satirlar: readonly MizanSatiri[];
  readonly borcToplam: string;
  readonly alacakToplam: string;
  readonly borcBakiyeToplam: string;
  readonly alacakBakiyeToplam: string;
  /** false ise deftere denk olmayan fiş girmiş demektir — ekran bunu gösterir. */
  readonly denkMi: boolean;
}

export interface YevmiyeSatiri {
  readonly fisId: string;
  readonly fisNo: string;
  readonly yevmiyeSiraNo: number | null;
  readonly tarih: string;
  readonly fisTuru: string;
  readonly durum: string;
  readonly fisAciklamasi: string;
  readonly hesapKodu: string;
  readonly hesapAdi: string;
  readonly satirAciklamasi: string | null;
  readonly borc: string;
  readonly alacak: string;
  readonly kapiNo: string | null;
}

export interface MuhasebeDonemi {
  readonly id: string;
  readonly maliYil: number;
  readonly ad: string;
  readonly baslangic: string;
  readonly bitis: string;
  readonly durum: string;
  readonly acilisFisiId: string | null;
  readonly kapanisFisiId: string | null;
  readonly kapanisAni: string | null;
  readonly kapanisGerekcesi: string | null;
  readonly fisSayisi: number;
  readonly taslakFisSayisi: number;
  readonly numarasizFisSayisi: number;
}

export interface FisSatirGirdisi {
  readonly hesapId: string;
  readonly borc?: string;
  readonly alacak?: string;
  readonly aciklama?: string;
  readonly bolumId?: string;
}

export interface FisGirdisi {
  readonly tarih: string;
  readonly aciklama: string;
  readonly fisTuru?: string;
  readonly satirlar: readonly FisSatirGirdisi[];
  readonly hemenIsle?: boolean;
}

/**
 * Muhasebe servisi.
 *
 * ⚠️  MOCK YOKTUR. Öteki modüllerde mock, backend hazır olmadan arayüz
 *     geliştirmeyi sağlıyordu. Muhasebede aynı şeyi yapmak TEHLİKELİDİR:
 *     uydurma bir mizan gerçek bir mizan gibi görünür ve karar dayanağı
 *     sanılabilir. Bu yüzden uçlar doğrudan çağrılır ve backend kapalıysa
 *     ekran hata gösterir.
 */
export const muhasebe = {
  hesaplar: (
    suzgec: { arama?: string; tip?: string; ozellik?: string; yalnizcaAktif?: boolean } = {},
  ): Promise<readonly MuhasebeHesabi[]> => {
    const p = new URLSearchParams();
    if (suzgec.arama !== undefined) p.set('arama', suzgec.arama);
    if (suzgec.tip !== undefined) p.set('tip', suzgec.tip);
    if (suzgec.ozellik !== undefined) p.set('ozellik', suzgec.ozellik);
    if (suzgec.yalnizcaAktif === true) p.set('yalnizcaAktif', 'true');
    const s = p.toString();
    return api(`/muhasebe/hesaplar${s === '' ? '' : `?${s}`}`, gecerliJeton());
  },

  hesapEkle: (dto: {
    kod: string; ad: string; tip: string; ozellik?: string; ustHesapId?: string;
  }): Promise<{ id: string }> =>
    api('/muhasebe/hesaplar', {
      method: 'POST', govde: dto, idempotencyKey: crypto.randomUUID(),
      ...gecerliJeton(),
    }),

  fisler: (
    suzgec: {
      baslangic?: string; bitis?: string; fisTuru?: string; durum?: string;
      arama?: string; limit?: number;
    } = {},
  ): Promise<readonly MuhasebeFisiSatiri[]> => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(suzgec)) {
      if (v !== undefined) p.set(k, String(v));
    }
    const s = p.toString();
    return api(`/muhasebe/fisler${s === '' ? '' : `?${s}`}`, gecerliJeton());
  },

  fisEkle: (dto: FisGirdisi): Promise<{ id: string; fisNo: string }> =>
    api('/muhasebe/fisler', {
      method: 'POST', govde: dto, idempotencyKey: crypto.randomUUID(),
      ...gecerliJeton(),
    }),

  fisIsle: (id: string): Promise<{ id: string; durum: string }> =>
    api(`/muhasebe/fisler/${id}/isle`, { method: 'PATCH', govde: {}, ...gecerliJeton() }),

  fisStorno: (id: string, gerekce: string, tarih?: string): Promise<{ tersFisNo: string }> =>
    api(`/muhasebe/fisler/${id}/storno`, {
      method: 'POST',
      govde: { gerekce, ...(tarih === undefined ? {} : { tarih }) },
      idempotencyKey: crypto.randomUUID(),
      ...gecerliJeton(),
    }),

  yevmiyeDefteri: (baslangic: string, bitis: string): Promise<readonly YevmiyeSatiri[]> =>
    api(
      `/muhasebe/defterler/yevmiye?baslangic=${baslangic}&bitis=${bitis}`,
      gecerliJeton(),
    ),

  kasaDefteri: (
    baslangic: string, bitis: string, ozellik: 'KASA' | 'BANKA' = 'KASA',
  ): Promise<readonly unknown[]> =>
    api(
      `/muhasebe/defterler/kasa?baslangic=${baslangic}&bitis=${bitis}&ozellik=${ozellik}`,
      gecerliJeton(),
    ),

  mizan: (baslangic: string, bitis: string): Promise<Mizan> =>
    api(`/muhasebe/dokumler/mizan?baslangic=${baslangic}&bitis=${bitis}`, gecerliJeton()),

  donemler: (): Promise<readonly MuhasebeDonemi[]> =>
    api('/muhasebe/donemler', gecerliJeton()),

  donemAc: (dto: {
    maliYil: number; ad: string; baslangic: string; bitis: string;
  }): Promise<{ id: string }> =>
    api('/muhasebe/donemler', {
      method: 'POST', govde: dto, idempotencyKey: crypto.randomUUID(),
      ...gecerliJeton(),
    }),

  donemKapat: (
    id: string, gerekce: string,
  ): Promise<{ sonuc: string; tutar: string }> =>
    api(`/muhasebe/donemler/${id}/kapat`, {
      method: 'POST', govde: { gerekce }, idempotencyKey: crypto.randomUUID(),
      ...gecerliJeton(),
    }),

  acilisFisi: (id: string): Promise<{ satirSayisi: number }> =>
    api(`/muhasebe/donemler/${id}/acilis-fisi`, {
      method: 'POST', govde: {}, idempotencyKey: crypto.randomUUID(), ...gecerliJeton(),
    }),

  yansitmaFisi: (id: string): Promise<{ satirSayisi: number }> =>
    api(`/muhasebe/donemler/${id}/yansitma-fisi`, {
      method: 'POST', govde: {}, idempotencyKey: crypto.randomUUID(), ...gecerliJeton(),
    }),

  yevmiyeNumarala: (id: string): Promise<{ numaralananFisSayisi: number }> =>
    api(`/muhasebe/donemler/${id}/yevmiye-numarala`, {
      method: 'POST', govde: {}, idempotencyKey: crypto.randomUUID(), ...gecerliJeton(),
    }),
};

/** Oturum jetonunu istek seçeneklerine çevirir. */
function gecerliJeton(): { token?: string } {
  const t = jeton();
  return t === undefined ? {} : { token: t };
}
