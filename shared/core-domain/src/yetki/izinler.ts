/**
 * Izin katalogu — uc kapinin ucuncusu (ADR-0006 · BFS v1 §3).
 *
 * Izinler tenant'a gorelidir; Kapi 2 (Kiraci) kurulmadan degerlendirilemez.
 * Sunucu tarafinda zorlanir. Istemci gizlemesi guvenlik siniri DEGILDIR.
 */

export const IZINLER = {
  // --- Tenant ve kurulum ---
  TENANT_GORUNTULE: 'tenant.view',
  TENANT_YONET: 'tenant.manage',
  TENANT_KURULUM: 'tenant.setup',

  // --- Kisi ve sakin ---
  KISI_GORUNTULE: 'kisi.view',
  KISI_YONET: 'kisi.manage',
  KISI_ANONIMLESTIR: 'kisi.anonymize',

  // --- Bagimsiz bolum ---
  BOLUM_GORUNTULE: 'bolum.view',
  BOLUM_YONET: 'bolum.manage',

  // --- Finans (ADR-0003) ---
  FINANS_OZET: 'finance.summary.view',
  FINANS_BORCLU_DETAY: 'finance.debtor.view',
  FINANS_TAHAKKUK: 'finance.assessment.generate',
  FINANS_TAHSILAT: 'finance.collection.manage',
  FINANS_MAKBUZ: 'finance.receipt.issue',
  FINANS_DEFTER_GORUNTULE: 'finance.ledger.view',
  FINANS_YEVMIYE_GIRIS: 'finance.journal.post',
  FINANS_DONEM_KAPAT: 'finance.period.close',
  FINANS_AYAR: 'finance.settings.manage',

  // --- Talep ---
  TALEP_OLUSTUR: 'talep.create',
  TALEP_GORUNTULE: 'talep.view',
  TALEP_YONET: 'talep.manage',

  // --- Belge ---
  BELGE_GORUNTULE: 'belge.view',
  BELGE_YUKLE: 'belge.upload',

  /*
   * --- İletişim (0019) — WhatsApp · SMS · e-posta ---
   *
   * DÖRT AYRI İZİN, tek "iletisim.manage" değil. Gerekçe: bunlar farklı
   * büyüklükte risklerdir ve aynı kişiye verilmeleri gerekmez.
   *   · Tekil mesaj bir kişiye gider; yanlışsa düzeltilir.
   *   · TOPLU mesaj 400 daireye aynı anda gider ve GERİ ALINAMAZ — gönderilen
   *     mesaj geri çağrılamaz. Bu yüzden ayrı yetkidir.
   *   · BELGE PAYLAŞIMI, gizlilik seviyesi olan bir dosyayı dışarı çıkarır;
   *     mesaj göndermekten farklı bir karardır (KVKK).
   *   · ŞABLON/AYAR değişikliği bütün gelecekteki gönderimleri etkiler.
   */
  ILETI_GONDER: 'iletisim.send',
  ILETI_TOPLU_GONDER: 'iletisim.bulk.send',
  ILETI_BELGE_PAYLAS: 'iletisim.document.share',
  ILETI_AYAR: 'iletisim.settings.manage',

  // --- Denetim ---
  AUDIT_GORUNTULE: 'audit.view',

  // --- AI (ADR-0004) ---
  AI_KULLAN: 'ai.copilot.use',
  AI_ONERI_KABUL: 'ai.recommendation.accept',
} as const;

export type Izin = (typeof IZINLER)[keyof typeof IZINLER];

export const TUM_IZINLER: readonly Izin[] = Object.values(IZINLER);

const IZIN_KUMESI = new Set<string>(TUM_IZINLER);

export function gecerliIzinMi(izin: string): izin is Izin {
  return IZIN_KUMESI.has(izin);
}

/**
 * Yalnizca kendi verisini gorme kisiti tasiyan izinler (ADR v1.1 §10 KVKK).
 * Malik ve kiraci yalnizca kendi finansal verisini gorur.
 */
export const KENDI_VERISI_KISITLI: readonly Izin[] = [
  IZINLER.FINANS_OZET,
  IZINLER.KISI_GORUNTULE,
  IZINLER.BELGE_GORUNTULE,
];
