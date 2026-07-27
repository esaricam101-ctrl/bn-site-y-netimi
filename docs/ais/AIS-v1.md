# AIS v1 — API & Integration Specification

**BNOS Apartman Yönetimi Modülü · Port ve Entegrasyon Sözleşmeleri**

**Sürüm:** 1.0
**Tarih:** 26 Temmuz 2026
**Statü:** yürürlükte
**Sahip:** Baş mimar
**Kaynak:** ADR v1.1 §31 · §38 · §39 · §40 · ADR-0001 · ADR-0004
**Kapsam:** Faz 0 teslimatı — port sınırları ve event zarfı. API kataloğu Sprint 1'de genişler.

---

## 1. Port disiplini

BNOS çekirdek servisleri **yeniden tasarlanmaz.** Modül, kernel'i `packages/bnos-client` üzerinden tüketir.

Her dış bağımlılık bir **port** arkasındadır. Port `application` katmanında tanımlanır, adaptör `infrastructure`'da uygulanır. Domain katmanı hiçbir adaptörü bilmez.

```text
packages/shared-kernel/src/ports/     port arayüzleri
packages/bnos-client/src/adapters/    BNOS kernel adaptörleri
apps/api/src/**/infrastructure/       yerel adaptörler
```

---

## 2. BNOS çekirdek portları

| Port | BNOS servisi | v1 kullanımı |
|---|---|---|
| `IMemoryCommandService` / `IMemoryQueryService` | Enterprise Memory | AI bağlamı · anlamsal erişim |
| `IKnowledgeGraph` | Knowledge Graph | Varlık çözümleme · ilişki genişletme |
| `IBusinessRulesEngine` | Business Rules Engine | Kural değerlendirme · izin verilen eylem uzayı |
| `IWorkflowEngine` | Workflow Engine | Onay akışları |
| `INotificationService` | Notification Service | Bildirim teslimi |
| `IAuditLog` | Audit & Logging | Değiştirilemez denetim kaydı |
| `IAuthorization` | Authorization | İzin çözümleme |

**v1 gerçekliği:** BNOS gerçek endpoint'leri ve SDK'sı Sprint 15'e kadar mevcut değildir (açık madde C-1). v1'de her port için **yerel adaptör** yazılır; sözleşme aynıdır, arkası değişir. Bu, Sprint 15'te kernel'e geçişi tek adaptör değişimine indirger.

---

## 3. AI yürütme sırası (ADR-0004)

```text
Girdi
 └─► 1. Enterprise Memory      IMemoryQueryService — bağlam, geçmiş, tercih
      └─► 2. Knowledge Graph   IKnowledgeGraph — varlık çözümleme, ilişki genişletme
           └─► 3. Business Rules Engine
                IBusinessRulesEngine — izin verilen eylem uzayı ve kısıtlar
                └─► 4. AI Agent — görev planı, öneri üretimi
                     └─► 5. LLM (yalnızca gerekliyse) — doğal dil üretimi
```

### 3.1 Bağlayıcı kurallar

1. **LLM hiçbir zaman ilk çalışan bileşen değildir.**
2. **Niyet sınıflandırması deterministiktir.** Kural/anahtar sözcük tabanlı katman önce çalışır; LLM'e yalnızca bu katman çözemediğinde düşülür.
3. **BRE üretimden önce çalışır**, sonradan bastırmaz. Bir kuralı ihlal eden öneri hiç üretilmez.
4. **AI'ın bağımsız kimliği ve yükseltilmiş erişimi yoktur.** Her erişim çağıran principal olarak yürütülür. Yetki, devraldığı kapsamın alt kümesidir.
5. **AI kayıt atmaz, otomatik yürütmez.** Öneri üretir; adı geçen bir insan işler. Karar her zaman yöneticiye aittir.
6. **Tahmin ve üretim ayrıdır.** Sayısal tahminler istatistiksel modellerden gelir; üretken model asla bir tahmin rakamının kaynağı olamaz.
7. **Alınan içerik veridir, talimat değildir.** Sakin metni ve yüklenen belge prompt injection'a karşı bu ilkeyle işlenir.

### 3.2 Kaldırılan yapı

AI Center'ın kendi Retrieval Service'i, gömme (embedding) deposu ve gömme önbelleği **kaldırılmıştır.** Anlamsal erişim `IMemoryQueryService`, sözcük tabanlı arama `ISearchProvider` üzerinden yapılır. İki port, iki sorumluluk, tek kayıt kaynağı.

### 3.3 Korunan kural

**Yetki filtresi sorgu anında uygulanır, sonuç kümesi sonradan filtrelenmez.** Sonradan filtreleme sayfalamayı bozar ve toplam sonuç sayısı üzerinden bilgi sızdırır ("42 sonuç bulundu → 3'ünü görebiliyorsun → 39 gizli belgenin varlığını öğrendin"). Tenant ve izin kısıtı sorgunun parçasıdır.

---

## 4. Event zarfı (ADR v1.1 §31 · ADR-0001)

§29 metni bağlayıcı olmadığından zarf burada sıfırdan tanımlanmıştır.

```jsonc
{
  "eventId":       "uuid",              // idempotency anahtarı
  "eventType":     "apartman.borc.olusturuldu",
  "eventVersion":  1,                   // şema sürümü
  "occurredAt":    "2026-07-26T09:00:00Z",  // timestamptz UTC
  "tenantId":      "uuid",
  "principal":     { "id": "uuid", "tip": "INSAN" },
  "correlationId": "uuid",              // X-Request-Id
  "causationId":   "uuid | null",       // tetikleyen event
  "aggregate":     { "tip": "Borc", "id": "uuid", "version": 3 },
  "payload":       { }                  // tip'e özgü, şema kayıtlı
}
```

### 4.1 Kurallar

1. **Event tipi adlandırması:** `<dikey>.<aggregate>.<geçmiş zaman fiil>` — `apartman.borc.olusturuldu`, `core.talep.kapatildi`.
2. **Her event katalogda kayıtlıdır.** Kayıtsız event yayınlanamaz; sözleşme testi bunu doğrular.
3. **Şema sürümlenir.** Kırıcı değişiklik `eventVersion` artırır; eski sürüm en az bir sürüm boyunca yayınlanmaya devam eder.
4. **Yük, kayıt kaynağının yerine geçmez.** Tüketicinin ihtiyaç duyduğu minimum bilgi taşınır; tam durum için kaynak sorgulanır.
5. **Tüketiciler idempotent ve replay-toleranslıdır.** `eventId` ile yinelenen teslimat sessizce yutulur.

### 4.2 Outbox

```text
OutboxKayit
├── id · tenant_id · event_type · event_version
├── zarf (jsonb)
├── olusturulma_tarihi (timestamptz)
├── yayinlanma_tarihi  (timestamptz, null)
├── deneme_sayisi · son_hata
└── INDEX (yayinlanma_tarihi) WHERE yayinlanma_tarihi IS NULL
```

**Kural:** Event, domain yazmasıyla **aynı transaction içinde** outbox'a yazılır. Ayrı bir yayıncı süreç Redis Streams'e aktarır ve `yayinlanma_tarihi`'ni işaretler. Yayıncı en-az-bir-kez teslim eder; tekilleştirme tüketici tarafındadır.

**Event kaybı veri kaybı değildir** (§31). Kaybolan event = bozulmuş entegrasyon; kayıt bozulmaz.

### 4.3 Katalog

`docs/ais/event-catalog.md` — her sprint kendi event'lerini ekler (DoD maddesi). Faz 0'da boştur.

---

## 5. `ISearchProvider` (ADR v1.1 §38)

```typescript
interface ISearchProvider {
  indexle(dokuman: AranabilirDokuman): Promise<void>;
  topluIndexle(dokumanlar: AranabilirDokuman[]): Promise<void>;
  sil(tenantId: string, id: string): Promise<void>;
  ara(sorgu: AramaSorgusu): Promise<AramaSonucu>;
}

interface AranabilirDokuman {
  id: string;
  tenantId: string;          // zorunlu
  tip: string;               // BELGE | KARAR | YONETIM_PLANI_MADDESI | TALEP | DUYURU
  baslik: string;
  icerik: string;
  gerekliIzin: string;       // sorgu anında filtrelenir
  ustveri: Record<string, unknown>;
  guncellemeTarihi: Date;
}

interface AramaSorgusu {
  tenantId: string;                    // zorunlu
  metin: string;
  izinler: string[];                   // çağıran principal'ın etkin izin seti
  tipler?: string[];
  filtreler?: Record<string, unknown>;
  sayfalama: { imlec?: string; limit: number };
}
```

### 5.1 İki kritik kural

1. ⚠️ **Yetki filtresi sorgu anında uygulanır, sonuç kümesi sonradan filtrelenmez.** `izinler` sorgunun parçasıdır, sonuç işleme adımının değil.
2. **Türkçe metin işleme açıkça yapılandırılır.** PostgreSQL varsayılan olarak Türkçe sözlük yapılandırması getirmez. `unaccent` + uygun yapılandırma **Sprint 9'da kurulur ve doğrulanır** — varsayılana güvenilmez.

### 5.2 Uygulama

- **v1 adaptörü:** PostgreSQL Full-Text Search (`tsvector` + GIN). Sprint 9.
- **v2 seçenekleri:** OpenSearch · vektör arama (Enterprise Memory üzerinden).

### 5.3 Sınır

`ISearchProvider` **sözcük tabanlı** aramadır. Anlamsal/vektör arama Enterprise Memory'nin sorumluluğudur (`IMemoryQueryService`). İkisi karıştırılmaz, ikisi ayrı sistem olarak da kurulmaz.

---

## 6. `IScheduler` (ADR v1.1 §36)

```typescript
interface IScheduler {
  kaydet(is: ZamanlanmisIsTanimi): Promise<void>;
  tetikle(kod: string, tenantId: string, donemAnahtari: string,
          kuruCalistirma: boolean): Promise<IsCalistirmaSonucu>;
  durdur(kod: string): Promise<void>;
  calistirmalar(kod: string, tenantId: string): Promise<IsCalistirma[]>;
}
```

v1 uygulaması: BullMQ üzerinde Redis. Kurallar BFS v1 §9'dadır.

---

## 7. `IIoTGateway` (ADR v1.1 §39)

```typescript
interface IIoTGateway {
  cihazKaydet(cihaz: CihazTanimi): Promise<string>;
  cihazDurumu(tenantId: string, cihazId: string): Promise<CihazDurumu>;
  cihazSil(tenantId: string, cihazId: string): Promise<void>;
  telemetriAl(cihazId: string, olcumler: Olcum[]): Promise<void>;
  komutGonder(cihazId: string, komut: Komut): Promise<void>;
  alarmAboneligi(filtre: AlarmFiltresi): AsyncIterable<Alarm>;
}
```

**v1 kapsamı: yalnızca port ve sınır tanımı. Uygulama yok.**

Üç tasarım kısıtı şimdiden bağlayıcıdır:

1. **Telemetri ana ilişkisel tablolara yazılmaz.** Yüksek hacimli zaman serisidir; ayrı bölümlenmiş depo veya TimescaleDB gerektirir. Sınır şimdi çizilir ki ileride "sayaç okumalarını Daire tablosuna ekleyelim" denmesin.
2. **Telemetri domain event üretir.** Alarm ve kural tepkileri BRE üzerinden çalışır, IoT katmanına bağlanmaz.
3. **Cihaz kimliği kullanıcı kimliği değildir.** Cihazlar kendi principal tipine sahiptir (`CIHAZ`).

Hedef cihazlar (v2+): Sayaç · Asansör · Kamera · Sensör.

---

## 8. Module SDK (ADR v1.1 §40)

**BNOS Client** = kernel'i tüketiriz. **Module SDK** = BNOS'a takılan modül üretiriz.

```text
ModuleManifest
├── kod · surum · gorunenAd · dikey (APARTMAN | SITE | AVM | ...)
├── bagimliliklar[]              diğer modüller + minimum sürüm
├── gerektirdigiCekirdek[]       Memory, KG, BRE, Workflow, Notification…
├── sagladigiYetenekler[]
├── yayinladigiEventler[]        event kataloğuna kayıt
├── tukettigiEventler[]
├── izinTanimlari[]              yetki matrisine katkı
├── lisansKodu
├── genisletmeNoktalari[]        menü · widget · rapor · kural tipi
│                                bildirim şablonu · kurulum adımı
└── yasamDongusu                 install · migrate · enable · disable · uninstall
```

**v1 teslimatı:** Manifest şeması + yaşam döngüsü sözleşmesi + sözleşme testi paketi + paket sınırı kuralı (Sprint 1). Gerçek SDK paketlemesi ikinci modül (Site) başladığında yapılır.

Sözleşme testleri: BFS v1 §14.1.

---

## 9. API sözleşme standardı

BFS v1 §12'de tanımlıdır. Endpoint kataloğu Sprint 1'den itibaren bu belgede modül modül genişler.

**Faz 0'da kayda geçen tek kural:** Mutasyon uçları `{ id, status }` döndürür (CQRS §6.3). Mevcut spesifikasyonlardaki tam-nesne dönen imzalar, modül DMS/AIS'e taşınırken düzeltilir.

---

## 10. Değişiklik kaydı

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 26.07.2026 | İlk sürüm. Faz 0 teslimatı: BNOS portları · AI sırası · event zarfı + outbox · ISearchProvider · IScheduler · IIoTGateway · Module SDK manifesti |
