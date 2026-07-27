/**
 * BNOS AI yurutme boru hatti — ADR-0004 · AIS v1 §3
 *
 *   Enterprise Memory -> Knowledge Graph -> Business Rules -> AI Agent -> (gerekirse) LLM
 *
 * LLM HICBIR ZAMAN ILK CALISAN BILESEN DEGILDIR.
 * Niyet siniflandirmasi deterministiktir; LLM'e yalnizca kural katmani
 * cozemedigi zaman dusulur.
 *
 * Bu sinif sirayi YAPISAL olarak zorlar: adimlar sabit sirayla calisir ve
 * LLM cagrisi yalnizca son adimda, kural katmani izin verdiyse yapilir.
 */
import type { TenantId, Principal } from '@bnos/kernel';
import type { IMemoryQueryService, BellekKaydi } from './ports/memory.port.js';
import type { IKnowledgeGraph, Dugum } from './ports/knowledge-graph.port.js';
import type { IBusinessRulesEngine, KuralDegerlendirmesi } from './ports/business-rules.port.js';

export type Niyet = 'SORU' | 'TASLAK' | 'ANALIZ' | 'EYLEM_ONERISI' | 'BILINMIYOR';

export interface AiIstegi {
  readonly tenantId: TenantId;
  readonly principal: Principal;
  readonly metin: string;
}

export interface AiSonucu {
  readonly niyet: Niyet;
  readonly niyetKaynagi: 'KURAL' | 'LLM';
  readonly bellek: readonly BellekKaydi[];
  readonly dugumler: readonly Dugum[];
  readonly kurallar: KuralDegerlendirmesi;
  readonly oneri: string | null;
  /** Her cikti kaynak kayitlara baglanir — kanitsiz cikti uretilmez. */
  readonly kanitlar: readonly string[];
  readonly llmCagrildiMi: boolean;
}

/** Deterministik niyet siniflandirma — LLM'den ONCE calisir. */
const NIYET_DESENLERI: readonly { readonly niyet: Niyet; readonly desen: RegExp }[] = [
  { niyet: 'EYLEM_ONERISI', desen: /\b(olustur|ekle|gonder|baslat|calistir|tahakkuk et)\b/i },
  { niyet: 'TASLAK', desen: /\b(yaz|tasla|metin|duyuru|bildirim hazirla)\b/i },
  { niyet: 'ANALIZ', desen: /\b(analiz|karsilastir|trend|neden|kok neden|dagilim)\b/i },
  { niyet: 'SORU', desen: /\b(ne kadar|kim|hangi|kac|nedir|ne zaman|\?)\b/i },
];

/**
 * Desenler ASCII yazilmistir, girdi ise Turkcedir. 'Tahakkuk olustur' deseni
 * 'Tahakkuk oluştur' metnini eslestiremezse siniflandirma BILINMIYOR doner ve
 * istek gereksiz yere LLM'e duser — ADR-0004'un deterministik katmani sessizce
 * devre disi kalir. Bu yuzden karsilastirma ASCII'ye katlanarak yapilir.
 *
 * NFD'ye ayristirip birlesik isaretleri atmak hem onceden birlesik 'ş' (U+015F)
 * hem de 's' + birlesik cedilla bicimini ayni sonuca goturur. 'ı' (U+0131)
 * ayrisamaz; ayrica eslenir.
 */
function asciiKatla(metin: string): string {
  return metin
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

export function niyetiCoz(metin: string): { niyet: Niyet; kaynak: 'KURAL' | 'LLM' } {
  const katlanmis = asciiKatla(metin);
  for (const { niyet, desen } of NIYET_DESENLERI) {
    if (desen.test(katlanmis)) return { niyet, kaynak: 'KURAL' };
  }
  return { niyet: 'BILINMIYOR', kaynak: 'LLM' };
}

export interface ILlmPort {
  uret(istem: string, baglam: readonly string[]): Promise<string>;
}

export class BnosAiPipeline {
  constructor(
    private readonly memory: IMemoryQueryService,
    private readonly kg: IKnowledgeGraph,
    private readonly bre: IBusinessRulesEngine,
    private readonly llm: ILlmPort | null,
  ) {}

  async calistir(istek: AiIstegi): Promise<AiSonucu> {
    // --- Adim 0: deterministik niyet (LLM DEGIL) ---
    const { niyet, kaynak } = niyetiCoz(istek.metin);

    // --- Adim 1: Enterprise Memory ---
    const bellek = await this.memory.ara({
      tenantId: istek.tenantId,
      metin: istek.metin,
      izinler: istek.principal.izinler,
      limit: 10,
    });

    // --- Adim 2: Knowledge Graph ---
    const dugumler = await this.kg.varlikCozumle(istek.tenantId, istek.metin);

    // --- Adim 3: Business Rules Engine (URETIMDEN ONCE) ---
    // EYLEM_ONERISI yalnizca metin uretmek degildir; sonunda bir kayit yazilir.
    // Istenen eylem 'oneri.uret' ile sinirli birakilirsa AI-001'in engelledigi
    // yazma eylemleri HIC talep edilmez, kural hicbir zaman tetiklenemez ve
    // "karar her zaman insana aittir" (ADR-0004) uygulanmamis olur. Yazma sinifi
    // burada acikca beyan edilir ki BRE uretimden ONCE karar verebilsin.
    const kurallar = await this.bre.degerlendir({
      tenantId: istek.tenantId,
      istenenEylemler: niyet === 'EYLEM_ONERISI' ? ['oneri.uret', 'kayit.yaz'] : ['okuma'],
      olgular: {
        principalTipi: istek.principal.tip,
        izinSayisi: istek.principal.izinler.length,
        niyet,
      },
    });

    const kanitlar = [
      ...bellek.map((b) => `memory:${b.id}`),
      ...dugumler.map((d) => `kg:${d.id}`),
    ];

    // Kural engelledi: LLM HIC CAGRILMAZ.
    if (!kurallar.izinliMi) {
      return { niyet, niyetKaynagi: kaynak, bellek, dugumler, kurallar,
               oneri: null, kanitlar, llmCagrildiMi: false };
    }

    // --- Adim 4: AI Agent — kanit yeterliyse deterministik yanit ---
    if (bellek.length > 0 && niyet !== 'TASLAK' && niyet !== 'BILINMIYOR') {
      return { niyet, niyetKaynagi: kaynak, bellek, dugumler, kurallar,
               oneri: this.deterministikOzet(bellek), kanitlar, llmCagrildiMi: false };
    }

    // --- Adim 5: LLM — yalnizca buraya kadar cozulemediyse ---
    if (!this.llm) {
      return { niyet, niyetKaynagi: kaynak, bellek, dugumler, kurallar,
               oneri: null, kanitlar, llmCagrildiMi: false };
    }
    const oneri = await this.llm.uret(istek.metin, bellek.map((b) => b.icerik));
    return { niyet, niyetKaynagi: kaynak, bellek, dugumler, kurallar,
             oneri, kanitlar, llmCagrildiMi: true };
  }

  private deterministikOzet(bellek: readonly BellekKaydi[]): string {
    return bellek.slice(0, 3).map((b) => b.icerik).join('\n');
  }
}
