# 02 — ADR UYUM RAPORU

**Referans belge:** `BNOS-Apartman-Mimari-Karar-Kaydi-v1.1` · KİLİTLİ · Yürürlük 26 Temmuz 2026
**Rapor sürümü:** 2.0 — v1.1 temelinde tam yeniden üretim
**Rapor tarihi:** 26 Temmuz 2026
**Önceki sürüm:** 1.0 (ADR v0.1 temelli) — **geçersiz, arşivlendi**
**Kapsam:** Proje bilgi tabanındaki tüm varlıklar (39 dosya)
**Statüsü:** Kod değişikliği yapılmadan tamamlandı

---

## 0. Bu raporun neyi değiştirdiği

Önceki uyum raporu ADR **v0.1** (§1–§12) temelinde üretilmişti. v0.1 yalnızca on iki maddeden oluşur ve v1.0 ile v1.1'de gelen otuz maddeyi içermez. Bunun iki sonucu oldu:

1. **Yanlış pozitifler** — v0.1'in "Açık Kalan Sorular" bölümündeki beş soru (mahsup sırası, malike aktarım gün sayısı, avans sistemi, genel kurul kapsamı, KMK m.22 takibi) uyumsuzluk olarak raporlanmıştı. Bunların tamamı v1.0'da §6, §7, §8, §15 ile **kapatılmıştır**. v1.1 Bölüm D bunu açıkça kaydeder: *açık madde 20 → 6*. Bu beş madde bu rapordan kaldırılmıştır.
2. **Yanlış negatifler** — v0.1'de bulunmayan §31–§41 hiç denetlenmemişti. On bir maddelik bu blok, projenin en çok yazma yoluna dokunan altyapı kararlarını içerir ve raporun ağırlık merkezi artık buradadır.

Geri çekilen maddelerin tam listesi §6'dadır.

---

## 1. Denetlenen varlık envanteri

| # | Varlık | Tür | Satır/Boyut | Denetim durumu |
|---|---|---|---|---|
| 1 | `BNOS-Apartman-Mimari-Karar-Kaydi-v1_1__1_.md` | ADR — yürürlükte | 408 satır | Referans |
| 2 | `BNOS-Apartman-Mimari-Karar-Kaydi.md` | ADR v0.1 — tarihsel | 205 satır | Referans (§1–§12) |
| 3 | `01-Dashboard-Spec-STEP-1-8.md` | Modül spesifikasyonu | 56 KB | Tam denetim |
| 4 | `04-AI-Center-Spec-STEP-1-9.md` | Modül spesifikasyonu | 63 KB | Tam denetim |
| 5 | `07-Finance-Spec-STEP-1-8.md` | Modül spesifikasyonu | 65 KB | Tam denetim |
| 6 | `03-Dashboard-Validation-STEP-10-11.md` | Doğrulama raporu | 15 KB | Tam denetim |
| 7 | `06-AI-Center-Validation-STEP-11-12.md` | Doğrulama raporu | 17 KB | Tam denetim |
| 8 | `09-Finance-Validation-STEP-10-11.md` | Doğrulama raporu | 16 KB | Tam denetim |
| 9 | `bn-dashboard.html` | Statik prototip | 1.161 satır | Tam denetim |
| 10 | `bn-finance.html` | Statik prototip | 1.451 satır | Tam denetim |
| 11 | `bn-ai-center.html` | Statik prototip | 1.420 satır | Tam denetim |
| 12 | `bn-dashboard_min.html` | Prototip türevi | 93 KB | Yüzeysel — 9'un varyantı |
| 13–34 | `00-temel.html` … `13-ekler.html`, `01-v23.html` … `12-v34.html` | Roadmap sunum sayfaları | 22 dosya | Yüzeysel — teslimat değil |
| 35 | `BN-Yonetim-Enterprise-Release-Roadmap-V22-to-V34.md` | Sürüm yol haritası | 112 KB | Tam denetim |
| 36 | `BN-Yonetim-Roadmap-V22-V34.html` | 35'in HTML sunumu | 194 KB | Yüzeysel |
| 37 | `bn_yönetim_için_canva_kod_da_hazırlanmış_...` | Canva dışa aktarımı (pazarlama sayfası) | 33 KB | Yüzeysel — ürün kodu değil |
| 38 | `brm_bnos-_alt_yapı.docx` | BNOS BRM / ERAM standardı | 20 KB | Referans |
| 39 | `SİTE_TESİS_EL_KİTABI.docx`, `2__KİTAP_EK_2__CİLT.docx` | Alan bilgisi | 377 KB | Referans |

### 1.1 En önemli tek bulgu — çalıştırılabilir kod tabanı yoktur

Denetim, projede **tek satır NestJS, Prisma, PostgreSQL, Next.js veya React Native kodu bulunmadığını** doğrulamıştır. `package.json`, `schema.prisma`, `nest-cli.json`, migration klasörü, test dosyası, Dockerfile veya GitHub Actions iş akışı yoktur.

Bu bir kusur değildir; ADR v0.1 §1 bunu zaten kaydeder: *"Mevcut çalışan kod tabanı yoktur. Modül sıfırdan geliştirilecektir."*

**Raporun okunma biçimi buna bağlıdır.** Aşağıdaki uyumsuzluklar çalışan koddaki hatalar değil, **tasarım varlıklarındaki (spec + prototip) yön hatalarıdır.** Kod yazılmadan düzeltilmeleri ucuzdur; yazıldıktan sonra düzeltilmeleri her yazma yoluna dokunmayı gerektirir. §31–§41'in Sprint 0 ve 1'e yerleştirilme gerekçesi tam olarak budur.

---

## 2. Madde madde uyum tablosu

Gösterim: ✅ uyumlu · ⚠️ kısmi · ❌ uyumsuz · 🚫 doğrulanamadı (kaynak metin yok) · ➖ kapsam dışı (henüz teslimat beklenmiyor)

### 2.1 §1–§12 — ADR v0.1'den yürürlükte

| Madde | Konu | Durum | Bulgu |
|---|---|---|---|
| §1 | Teknoloji yığını | ❌ | Prototipler vanilla HTML/CSS/JS tek dosya. Hedef Next.js + React. Mobil tarafta hiçbir varlık yok. → **Y-10** |
| §2 | Multi-tenancy · RLS | ❌ | Spec'ler `estateId` ve `scope: portfolio\|group\|site\|block` kullanıyor; portföy geneli toplama var. RLS hiçbir belgede geçmiyor. → **K-2** |
| §3 | Muhasebe derinliği | ❌ | Finance spec çift taraflı defter kuruyor (JournalEntry/JournalLine, debit/credit, mizan). ADR v1 = işletme defteri. → **K-3** |
| §4 | Gider sınıflandırması | ⚠️ | Finance `apportionmentRule(equal\|arsa_payi\|m2\|unit_type\|mixed)` — Eksen 1 kısmen var. Eksen 2 (MALİKE_AİT / KULLANANA_AİT) ve Eksen 3 (kaynak) **yok**. → **Y-11** |
| §5 | Borç sorumluluğu | ⚠️ | `Receivable → Daire` doğru; `AssessmentLine.liablePartyId` var. Ancak sıralı `BorcSorumlusu[]` zinciri ve SNAPSHOT kuralı modellenmemiş. → **Y-12** |
| §6 | Borcun malike aktarımı | 🚫 | v1.0 §6 metni bilgi tabanında yok. Finance spec "ownership change transfers liability per policy" diyor — politika tanımsız. → **K-1** |
| §7 | Ödeme mahsup sırası | ⚠️ | `FinancePolicy.allocationOrder` alanı var, sıra tanımsız. v1.0 §7 metni yok. → **K-1** |
| §8 | Gecikme faizi | ⚠️ | "Interest is computed, never entered" ✅. Oran/baz `FinancePolicy` üzerinde ✅. Ancak gecikme günü hesabının takvim tabanı belirsiz → §34 ile birleşik risk. → **Y-5** |
| §9 | Para akışı · ödeme hatları | 🚫 | v0.1'de Hat A / Hat B var; v1.0 güncellemesi yok. Finance spec ödeme kanallarını sayıyor ama para akışı hattını tanımlamıyor. |
| §10 | KVKK | ✅ | Üç spec de sunucu tarafı yetkilendirme, satır düzeyi kapsamlandırma, "403 döner, filtrelenmiş 200 dönmez", personel özel nitelikli veri erişilemezliği ve denetim kaydı kuralını doğru kuruyor. **Korunacak.** |
| §11 | Kapsam sınırı · AI sırası | ❌ | İki ihlal: (a) tüm varlıklar Site Yönetimi dikeyi için üretilmiş, v1 yalnızca Apartman → **O-1**; (b) AI Center karar akışı LLM ile başlıyor → **K-4** |
| §12 | Doküman üretim sırası | ❌ | Sıra `0. BNOS Core Service Contracts → 1. Veri Modeli → 2. Yetki Matrisi → 3. İş Kuralları → 4. API Sözleşmesi`. Mevcut spec'ler bu sırayı izlemiyor; modül başına birleşik STEP 1–9 belgesi üretilmiş ve BNOS sözleşmeleri hiç yazılmamış. → **Y-9** |

### 2.2 §13–§30 — ADR v1.0'dan yürürlükte

| Madde | Konu | Durum | Bulgu |
|---|---|---|---|
| §13–§30 | Kurulum · Yönetim planı · Genel kurul · İmza · Bildirim · AI raporlama · Dashboard · Lisanslama · Tema · BNOS stratejisi · Prototip · Agent sınırları · Offline · API sürümleme · Plugin/SDK · Feature flags · Event bus · Üç kapı | 🚫 | **On sekiz maddenin metni proje bilgi tabanında yoktur.** v1.1 başlığı bu maddelerin "aynen yürürlükte" olduğunu ve tekrarlanmadığını beyan eder, ancak v1.0 belgesi yüklenmemiştir. Uyum denetimi yapılamaz. → **K-1** |

**Blok-1'i doğrudan bloke eden iki madde bu blokun içindedir:** §29 (Event bus / outbox) ve §30 (Üç kapı). İkisi de v1.1'in Sprint 0 teslimat listesinde yer alır ve dikey dilimin zorunlu parçasıdır.

Kısmî çıkarım mümkün olan iki nokta:

- §24 (Agent sınırları) — AI Center 6.5 *"The AI holds no independent identity or elevated access; every retrieval executes as the requesting user"* diyor. §39'da atıf yapılan "yetkisi çağıran kullanıcının alt kümesi" kuralıyla **uyumlu görünüyor.** Doğrulama §24 metni geldiğinde tamamlanacak.
- §23 (Prototip) — üç prototip mevcut ve nitelikli. Ancak §23'ün prototipe hangi statüyü verdiği bilinmiyor (referans mi, dondurulmuş sözleşme mi).

### 2.3 §31–§41 — ADR v1.1 ile eklendi

| Madde | Konu | Durum | Bulgu |
|---|---|---|---|
| §31 | Event Sourcing kullanılmaz | ✅ | Hiçbir spec Event Sourcing önermiyor; PostgreSQL ilişkisel model varsayılıyor. **Çakışma yok.** Outbox henüz yok ama bu §29 kapsamındadır. |
| §32 | CQRS — Command/Query ayrımı | ❌ | Hiçbir spec'te ayrım yok. Ayrıca doğrudan kural ihlali: `POST /journal-entries` → "Entry", `POST /payments` → "Payment + allocations" tam okuma modeli döndürüyor. §32 kural 2: Command yalnızca `id` + durum döndürür. → **Y-2** |
| §33 | Silme standardı | ⚠️ | Finansal sınıf ✅ — Finance 8.2/3 *"Nothing is deleted; corrections are compensating entries"*, JournalEntry `never deleted`. Ana veri sınıfı ❌ — soft delete alanları, kısmi unique index, `SilinebilirlikPolitikasi` yok. Belge sınıfı ⚠️ — `Budget.version/previousVersionId` var, genel belge versiyonlama yok. Anonimleştirme ❌. → **Y-6** |
| §34 | Zaman standardı | ❌ | Hiçbir spec'te `DATE` / `timestamptz` ayrımı yok. `dueDate`, `valueDate`, `paymentDate`, `startDate/endDate`, `periodStart/End`, `effectiveFrom` tipsiz. API'de ISO 8601/UTC beyanı yok. Tenant `saat_dilimi` ayarı yok. → **Y-5** |
| §35 | Numaralandırma motoru | ⚠️ | Finance'ta `Receipt` *"gapless per estate per year"* ✅ ve `FinancePolicy.numberingSeries[]` ✅. Ancak merkezî `NumaraSerisi` motoru, BOSLUKSUZ/BOSLUKLU ayrımı, advisory lock kuralı ve `SEQUENCE` yasağı yok. Talep No / Belge No / İş Emri No serileri tanımsız. → **Y-4** |
| §36 | Zamanlayıcı standardı | ⚠️ | Zamanlanmış işler içerik olarak var (tahakkuk, faiz işletme, hatırlatma, rapor). Finance'ta `preview → commit` iki fazlı tahakkuk **§36 kural 6'nın dry-run gereksinimini karşılıyor** ✅ ve *"one committed run per estate per period, enforced by unique constraint"* **`IsCalistirma` unique kısıtının muadili** ✅. Eksik: `IScheduler` portu, dağıtık kilit, kaçırılan çalıştırma politikası, tenant saat dilimi tetikleme, ölü mektup kuyruğu. → **Y-7** |
| §37 | Önbellek stratejisi | ❌ | **Doğrudan ihlal.** Dashboard `GET /summary` *"p95 ≤ 400ms served from cache"* ve Finance `GET /summary` *"p95 ≤ 400ms cached"*. Bu uçların yükünde alacak yaşlandırma, nakit ve bütçe sapması var. §37: *defter bakiyesi, cari hesap, borç durumu — önbelleklenmez.* Ayrıca `t:{tenantId}:{alan}:{kimlik}:{sürüm}` anahtar sözleşmesi ve lint kuralı hiçbir yerde yok. → **K-5** |
| §38 | Arama stratejisi | ❌ | `ISearchProvider` portu yok. AI Center kendi Retrieval Service'ini + hybrid vektör aramasını kuruyor — §38 anlamsal aramanın Enterprise Memory sorumluluğu olduğunu ve ayrı sistem kurulmayacağını söylüyor. **Olumlu:** AI Center 4.3 ACL filtresini sıralamadan **önce** uyguluyor ve Dashboard 8.2 sonuç sayısı üzerinden sızıntıyı reddediyor — §38 kural 1 ile **tam uyumlu.** Türkçe FTS yapılandırması yok. → **K-6 / O-3** |
| §39 | IoT ağ geçidi | ❌ | `IIoTGateway` portu yok. Birleşik `Principal` modeli (INSAN\|AGENT\|PLUGIN\|CIHAZ\|SISTEM) yok. v1 kapsamı yalnızca port olduğu için efor düşük. → **O-4 / O-5** |
| §40 | BNOS Module SDK | ❌ | `ModuleManifest` yok. Sözleşme testi paketi yok. **`core-domain` / `apartman-domain` paket sınırı yok** — prototipler tek dosya monolittir. Sözleşme testlerinden ikisi bugün kesin başarısız: i18n (prototiplerde **sıfır** i18n anahtarı, tüm metin sabit Türkçe) ve tenant izolasyonu. → **Y-3 / Y-8** |
| §41 | Belge mimarisi | ❌ | CONSTITUTION, BFS, DMS, AIS belgelerinin hiçbiri mevcut değil. Mevcut spec'ler dört belgeye dağıtılmamış birleşik modül belgeleridir ve tek kaynak kuralını ihlal eder (yetki matrisi hem Dashboard hem Finance spec'inde ayrı ayrı tanımlı). → **Y-9** |

---

## 3. Uyumsuzluk özeti

| Seviye | Adet | Blok-1'i bloke eden |
|---|---|---|
| **Kritik** | 6 | 4 |
| **Yüksek** | 12 | 3 |
| **Orta** | 8 | 0 |
| **Düşük** | 5 | 0 |
| **Toplam** | **31** | **7** |

Tam kayıtlar `03-EKSIKLER-BACKLOG.md` içindedir. Aşağıda yalnızca kritik altı madde tam olarak açılmıştır.

---

## 4. Kritik uyumsuzluklar

### K-1 · ADR v1.0 (§13–§30) metni proje bilgi tabanında yok

| Alan | İçerik |
|---|---|
| **İlgili ADR maddesi** | v1.1 başlık bloğu: *"Bu belge v1.0'ın devamıdır. §1–§30 aynen yürürlüktedir ve burada tekrarlanmamıştır."* |
| **Etkilenen dosyalar** | `docs/adr/` (eksik belge) · dolaylı olarak tüm spec ve doğrulama belgeleri |
| **Etki** | On sekiz kilitli kararın metni yok. Bunlardan **§29 (Event bus / outbox)** ve **§30 (Üç kapı)** v1.1'in Sprint 0 dikey dilim tanımında açıkça sayılır; ikisi de Blok-1'in girdisidir. §26 (API sürümleme) ve §28 (Feature flags) Blok-1'in hemen ardından gelir. §21 (Tema) ve §25 (Offline) frontend baseline'ını belirler. |
| **Çözüm yöntemi** | v1.0 belgesini `docs/adr/BNOS-Apartman-Mimari-Karar-Kaydi-v1.0.md` olarak depoya ekle. Alternatifi yoktur — §13–§30 yeniden türetilemez, çünkü bunlar *kararlardır*, çıkarımlar değil. |
| **Tahmini efor** | Belge mevcutsa 0,5 gün (aktarım + çapraz referans doğrulama). Mevcut değilse §13–§30'un yeniden karara bağlanması: 5–8 gün mimari kurul çalışması. |
| **Blok-1'i bloke eder** | **EVET** — §29 ve §30 nedeniyle |

### K-2 · Tenant modeli çelişkisi: `estate` + portföy kapsamı ↔ `tenant` + RLS

| Alan | İçerik |
|---|---|
| **İlgili ADR maddesi** | §2 (Multi-tenancy · RLS) · §11 (Kapsam sınırı) |
| **Etkilenen dosyalar** | `01-Dashboard-Spec-STEP-1-8.md` (6.1–6.6, STEP 7 uçları 1/2/5/6/10/21/24) · `07-Finance-Spec-STEP-1-8.md` (6.2 tüm varlıklar `estateId` taşır, 6.5, STEP 7 tümü) · `04-AI-Center-Spec-STEP-1-9.md` (6.3 "portfolio benchmarks", 7.1 `AIDocument.estateId`) · `bn-dashboard.html` (portföy başlıkları ve kapsam seçici) |
| **Etki** | Dashboard `scope: portfolio \| group \| site \| block` tanımlar ve *"Portfolio aggregates exclude estates the user cannot access"* der. §2 ise her tenant'ı bir apartman olarak tanımlar ve izolasyonu veritabanına zorlatır. **RLS altında çapraz-tenant toplama tanım gereği imkânsızdır.** Bu, `WHERE` koşuluyla çözülebilecek bir fark değildir; iki farklı izolasyon modelidir. Şema `tenant_id` yerine `estate_id` üzerine kurulursa Blok-1'in tamamı yanlış eksende inşa edilir. |
| **Çözüm yöntemi** | Üç adım: **(1)** `estateId` → `tenant_id` yeniden adlandırması, spec ve prototip genelinde. **(2)** Portföy/grup kapsamının v1'den çıkarılması — bu bir Yönetim Şirketi yeteneğidir ve §11 uyarınca v1 kapsamı dışındadır. **(3)** Portföy görünümlerinin gelecekte nasıl çözüleceğinin şimdiden kayda geçirilmesi: RLS'i gevşetmek değil, ayrı bir *okuma kapsamı* (yönetim şirketi tenant'ı + açık devir ilişkisi) — aksi halde ikinci dikey başladığında baskı RLS üzerinde birikir. |
| **Tahmini efor** | Spec düzeltmesi 2 gün · kapsam kararı 0,5 gün (mimari kurul) · prototip metin/etiket düzeltmesi 1 gün. **Toplam 3,5 gün.** Blok-1'den sonra yapılırsa şema + migration + RLS politikaları + test yeniden yazımı: 8–12 gün. |
| **Blok-1'i bloke eder** | **EVET** — Blok-1'in birincil konusu budur |

### K-3 · Muhasebe derinliği çelişkisi: çift taraflı defter ↔ işletme defteri

| Alan | İçerik |
|---|---|
| **İlgili ADR maddesi** | §3 (Muhasebe derinliği) · §41 bu çelişkiyi adıyla anar: *"ADR 'işletme defteri' derken Finance spec çift taraflı defter kurmuştu"* |
| **Etkilenen dosyalar** | `07-Finance-Spec-STEP-1-8.md` (6.2 `JournalEntry`/`JournalLine`/`FinancialAccount.type(asset\|liability\|equity\|income\|expense)`, 6.4, 8.1, 8.2 kural 1, 8.4, STEP 7 uçları 3/4/5) · `bn-finance.html` (mizan ve yevmiye yüzeyleri) · `09-Finance-Validation-STEP-10-11.md` |
| **Etki** | Finance spec `POST /journal-entries`, `GET /trial-balance` (mizan) ve *"Double-entry always balances"* kuralını iş kuralı olarak kurar. ADR §3 v1 hedefini KMK'ya uygun **işletme defteri** olarak kilitler. §41 çelişkiyi tespit etmiş ancak Finance spec düzeltilmemiştir. **Nüans önemlidir:** §3 aynı zamanda veri modelinin *şema değişikliği olmadan* çift tarafa genişleyebilmesini şart koşar — yani borç/alacak çiftli satır yapısı **doğrudur ve korunmalıdır.** Çelişki şemada değil, **v1'de hangi yüzeylerin açık olduğundadır.** |
| **Çözüm yöntemi** | Şemayı koru (`JournalEntry`/`JournalLine` çiftli satır yapısı §3'ün genişleme kısıtını tam olarak karşılar). v1'de kapat: `POST /journal-entries` (doğrudan yevmiye girişi), `GET /trial-balance` (mizan), büyük defter yüzeyi. Bunları `ACCOUNTING_DOUBLE_ENTRY` feature flag'i arkasına al. v1'de defter kayıtları yalnızca **sistem tarafından** (tahakkuk, tahsilat, gider, banka) üretilir; kullanıcıya işletme defteri ve KMK mali raporları gösterilir. Flag'in varlığı §3'ün "genişleyebilmelidir" şartını kanıtlar hale gelir. |
| **Tahmini efor** | Spec düzeltmesi 1,5 gün · feature flag tasarımı 0,5 gün · prototip yüzey ayıklaması 1 gün. **Toplam 3 gün.** |
| **Blok-1'i bloke eder** | **HAYIR** — ancak Sprint 3 (Finance şeması) öncesi kapatılmalıdır |

### K-4 · AI karar akışı BNOS sırasını ihlal ediyor

| Alan | İçerik |
|---|---|
| **İlgili ADR maddesi** | §11 (*"LLM hiçbir zaman ilk çalışan bileşen değildir. Sıra: Enterprise Memory → Knowledge Graph → Business Rules Engine → AI Agent → (gerekirse) LLM"*) · §24 · §38 |
| **Etkilenen dosyalar** | `04-AI-Center-Spec-STEP-1-9.md` (4.2 AI decision flow, 4.3 knowledge retrieval flow, 6.1 AI services, 6.8 LLM usage strategy) · `bn-ai-center.html` · `06-AI-Center-Validation-STEP-11-12.md` |
| **Etki** | Spec'teki akış: `Input → intent classification (cheap model) → permission pre-check → scope resolution → model routing → retrieval → generation`. **İlk adım bir LLM'dir.** Ayrıca 6.1'de Retrieval Service kendi hibrit vektör aramasını kurar; Enterprise Memory ve Knowledge Graph hiçbir akışta adı geçmez. Business Rules Engine yalnızca 4.4'te *üretim sonrası* engelleyici olarak görünür — §11'de ise üretimden **önce** gelir. Bu, BNOS'un temel çalışma prensibinin tersine çevrilmesidir ve mimari uyumluluk açısından tek başına yeterli bir ret gerekçesidir. |
| **Çözüm yöntemi** | Akışı §11 sırasına göre yeniden yaz: `Girdi → Enterprise Memory (IMemoryQueryService: bağlam, geçmiş, tercih) → Knowledge Graph (varlık çözümleme, ilişki genişletme) → Business Rules Engine (izin verilen eylem uzayı ve kısıtlar) → AI Agent (görev planı) → LLM (yalnızca doğal dil üretimi için, ve yalnızca gerekliyse)`. Niyet sınıflandırması LLM'den önce kural/anahtar sözcük tabanlı bir katmana taşınır; LLM'e yalnızca kural katmanı çözemezse düşülür. Retrieval Service kaldırılır, yerine `IMemoryQueryService` (anlamsal) + `ISearchProvider` (sözcük tabanlı, §38) çağrısı geçer. |
| **Tahmini efor** | Spec yeniden yazımı (4.2, 4.3, 6.1, 6.8) 3 gün · prototip akış diyagramı 0,5 gün · BNOS port sözleşmelerinin AIS'e yazımı 2 gün. **Toplam 5,5 gün.** |
| **Blok-1'i bloke eder** | **HAYIR** — Sprint 5 (AI) öncesi kapatılmalıdır. Ancak §38 portu Sprint 0 teslimatıdır. |

### K-5 · Finansal bakiyeler önbelleklenmiş uçlardan servis ediliyor

| Alan | İçerik |
|---|---|
| **İlgili ADR maddesi** | §37 (*"Defter bakiyesi, cari hesap, borç durumu — Önbelleklenmez"* · *"Bayat finansal rakam, yavaş finansal rakamdan kötüdür"*) · §2 (önbellek anahtarında tenant izolasyonu) |
| **Etkilenen dosyalar** | `01-Dashboard-Spec-STEP-1-8.md` (STEP 7 performans sözleşmesi, uç 1 ve 19) · `07-Finance-Spec-STEP-1-8.md` (STEP 7 performans sözleşmesi, uç 1) · `04-AI-Center-Spec-STEP-1-9.md` (6.9 caching strategy) |
| **Etki** | İki ayrı ihlal. **(a) Yasak içerik önbellekleniyor:** her iki `GET /summary` ucu da *"p95 ≤ 400ms cached"* taahhüdü verir ve yüklerinde alacak yaşlandırma, nakit pozisyonu ve bütçe sapması bulunur. Bir yöneticinin tahsilat yaptıktan sonra eski bakiyeyi görmesi, sistemin güvenilirliğini tek seferde bitiren türden bir hatadır. **(b) Anahtar sözleşmesi yok:** `t:{tenantId}:{alan}:{kimlik}:{sürüm}` biçimi ve onu zorlayacak lint kuralı hiçbir belgede tanımlı değil. §37 bunu açıkça *veri sızıntısı* olarak niteler — RLS önbelleği korumaz. |
| **Çözüm yöntemi** | **(a)** `GET /summary` yüklerini ikiye ayır: önbelleklenebilir kısım (KPI tanımları, widget yerleşimi, referans verisi, çözümlenmiş yönetim planı kuralları) ve önbelleklenmeyen kısım (bakiye, yaşlandırma, cari hesap, nakit). Performans sözleşmesini buna göre yeniden yaz — finansal kısım için p95 hedefi indeks ve sorgu optimizasyonuyla karşılanır, önbellekle değil. **(b)** Anahtar biçimini BFS'e yaz, `@bnos/cache` sarmalayıcısını `tenantId` olmadan çağrı kabul etmeyecek şekilde tasarla ve ESLint kuralını Sprint 0'da ekle. |
| **Tahmini efor** | Yük ayrıştırma tasarımı 1 gün · spec düzeltmesi 1 gün · anahtar sözleşmesi + lint kuralı 1,5 gün. **Toplam 3,5 gün.** |
| **Blok-1'i bloke eder** | **EVET** — kısmen. Anahtar sözleşmesi ve lint kuralı Sprint 0 teslimatıdır ve Blok-1'in dikey diliminde kullanılacaktır. Yük ayrıştırması Sprint 3'e ertelenebilir. |

### K-6 · Arama ve anlamsal erişim iki ayrı sistem olarak kuruluyor

| Alan | İçerik |
|---|---|
| **İlgili ADR maddesi** | §38 (*"Anlamsal/vektör arama ayrı bir sistem olarak kurulmaz; Enterprise Memory'nin sorumluluğudur"*) · §11 (BNOS çekirdek servisleri yeniden geliştirilmez) |
| **Etkilenen dosyalar** | `04-AI-Center-Spec-STEP-1-9.md` (4.3, 6.1 Retrieval Service, 6.3 knowledge sources, 6.9 embedding cache) · `01-Dashboard-Spec-STEP-1-8.md` (STEP 7 uç 22 `GET /search`) |
| **Etki** | AI Center kendi gömme (embedding), hibrit arama ve gömme önbelleği katmanını kurar. Bu, ADR §11'in *"BNOS çekirdek servisleri yeniden tasarlanmayacaktır"* kuralının doğrudan ihlalidir ve Enterprise Memory ile kalıcı olarak iki farklı bilgi kaynağı üretir — hangisinin doğru olduğu sorusu ilk tutarsızlıkta ortaya çıkar. Dashboard `GET /search` de üçüncü bir arama yolu açar. |
| **Çözüm yöntemi** | İki portluk net bir sınır çiz: **`IMemoryQueryService`** (BNOS Enterprise Memory — anlamsal, vektör, bağlam) ve **`ISearchProvider`** (§38 — sözcük tabanlı, v1'de PostgreSQL FTS adaptörü). AI Center'daki Retrieval Service'i bu iki portun **çağrı sıralayıcısı** haline indirge; kendi indeks ve gömme deposunu kaldır. Dashboard `GET /search` `ISearchProvider`'a bağlanır. **Korunacak olan:** AI Center 4.3'ün ACL-filtresi-sıralamadan-önce kuralı ve sonuç sayısı sızıntısı reddi — bu §38 kural 1 ile birebir örtüşür ve iyi yazılmıştır; port değişiminde kaybedilmemelidir. |
| **Tahmini efor** | Port sözleşmeleri 1,5 gün · AI Center spec düzeltmesi 2 gün · Türkçe FTS yapılandırma araştırması + `unaccent` doğrulaması 1 gün (Sprint 9'a ait, burada yalnızca port). **Toplam 3,5 gün** (Türkçe FTS hariç). |
| **Blok-1'i bloke eder** | **EVET** — kısmen. `ISearchProvider` portunun tanımı v1.1'de Sprint 0 teslimatıdır. Uygulama Sprint 9'dur. |

---

## 5. Uyumlu bulunan ve korunması gereken varlıklar

Bu bölüm rapordaki en değerli kısımdır. Aşağıdakiler ADR ile uyumludur, iyi yazılmıştır ve **yeniden yazılmamalıdır** — kullanıcının açık talimatı olan yeniden kullanım önceliği burada uygulanır.

| # | Varlık | Uyumlu olduğu madde | Neden korunmalı |
|---|---|---|---|
| 1 | Yetkilendirme duruşu — sunucu tarafı zorlama, kapsam dışı `estateId` için `403` (filtrelenmiş `200` değil), istemci gizlemesinin güvenlik sınırı olmadığının açıkça yazılması | §10, §30 | Üç spec'te de tutarlı. "Sessiz filtreleme yetkilendirme hatalarını gizler" tespiti doğrudur ve nadiren bu netlikte yazılır |
| 2 | ACL filtresinin sıralamadan **önce** uygulanması ve sonuç sayısı üzerinden bilgi sızıntısının reddi | §38 kural 1 | §38'in yazdığı kuralla birebir aynı. Bağımsız olarak aynı sonuca varılmış |
| 3 | AI'ın bağımsız kimliği ve yükseltilmiş erişimi olmaması; her erişimin çağıran kullanıcı olarak yürütülmesi | §24, §39 Principal deseni | §39'un birleştirmeye çalıştığı desenin doğru uygulanmış hali |
| 4 | "AI asla kayıt atmaz / asla otomatik yürütmez; adı geçen bir insan işler" | §11, §24 | Karar her zaman yöneticiye aittir ilkesinin somut karşılığı |
| 5 | Finansal kayıtların silinmemesi, düzeltmenin ters kayıtla yapılması | §33 finansal sınıf | §33'ün ilk satırıyla birebir uyumlu |
| 6 | Tahakkukun iki fazlı olması (`preview → commit`) ve dönem başına tek işlenmiş çalıştırmanın **unique constraint** ile zorlanması | §36 kural 1 ve 6 | `IsCalistirma UNIQUE (is, tenant, dönem_anahtarı)` ve dry-run gereksiniminin muadili. Bağımsız olarak bulunmuş |
| 7 | Makbuz numarasının boşluksuz olması, iptalin ayrı kayıt üretmesi, numaranın yeniden kullanılmaması | §35 BOSLUKSUZ | Doğru seri, doğru gerekçeyle boşluksuz seçilmiş |
| 8 | Paranın `decimal`, asla `float` olması; para biriminin ilk günden alanda bulunması | (ADR yasaklamıyor, mali doğruluk gereği) | *"Kayan noktalı para ve skaler para birimi kolonları, sonradan tam migration olmadan düzeltilemeyecek iki kusurdur"* — doğru ve geri dönülemez bir karar |
| 9 | Görevler ayrılığı: talep edenin kendi talebini onaylayamaması, vekaletin asıl onaylayanın limitine tabi olması, onay yetkisinin **karar anında** kontrol edilmesi | §30 (kısmi doğrulama) | Doğru zamanlama tespiti. "İzinler talep ile karar arasında değişebilir" gerekçesi nadir görülür |
| 10 | Erişilebilirlik altyapısı — `skip` bağlantısı, `aria-live` bölgeleri, `:focus-visible`, `prefers-reduced-motion`, yoğunluk (density) token'ı | §21 (doğrulanamadı, ancak kayıpsız korunmalı) | Prototiplerde çalışır durumda. Next.js'e taşınırken kaybedilmemeli |
| 11 | Tasarım token seti — `--primary`, `--grad`, `--glass-bg`, 4px aralık ölçeği, yoğunluk anahtarı | §21 (doğrulanamadı) | CSS özel değişkenleri olarak yazılmış; Tailwind tema yapılandırmasına ve React Native tema nesnesine **mekanik olarak** dönüştürülebilir |
| 12 | Hata ve boş durum disiplini — *"Bu modülde hiçbir hata mesajı yalnızca 'Bir hata oluştu' değildir"*, her hatada korelasyon kimliği ve tek net sonraki eylem | §30, BFS hata yönetimi | Doğrudan BFS'e taşınacak kalitede |
| 13 | Kısmi dönem karşılaştırması uyarısı ve %100'ü aşan tahsilat oranının **reddedilmeyip açıklanması** | İş kuralı doğruluğu | Her yıl dönem sonunda yanlış alarm üretecek naif bir doğrulamanın önceden yakalanmış olması |
| 14 | Üretimin tahminden ayrılması — *"Bir üretken model asla bir tahmin rakamının kaynağı olamaz"* | §11, §18 (doğrulanamadı) | LLM'in sayısal otorite olarak kullanılmasını yapısal olarak engelliyor |
| 15 | Prompt injection savunması — alınan içeriğin veri olarak işlenmesi, asla talimat olarak işlenmemesi | §24, §27 | Sakin tarafından girilen metin ve yüklenen belge AI'a girdiğinde tek gerçek savunma budur |

**Karar:** Bu on beş kalem, düzeltme çalışmasında **girdi** olarak alınır. Spec'ler yeniden yazılırken bunlar taşınır; sıfırdan üretilmez.

---

## 6. Geri çekilen bulgular — v0.1 kaynaklı yanlış pozitifler

Aşağıdaki maddeler önceki raporda uyumsuzluk olarak listelenmişti. ADR v1.1 (ve atıfta bulunduğu v1.0) bunları çözmüştür veya kapsam dışına almıştır. **Tamamı geri çekilmiştir.**

| # | Geri çekilen bulgu | Neden geçersiz |
|---|---|---|
| G-1 | "Ödeme mahsup sırası tanımsız — açık soru" | v0.1'in açık sorusuydu; v1.0 §7 ile kilitlendi. Kalan sorun mahsup sırasının *bilinmemesi* değil, v1.0 metninin *elimizde olmaması*dır → K-1'e devredildi |
| G-2 | "Malike otomatik aktarım gün sayısı belirsiz" | v1.0 §6 ile kilitlendi. → K-1 |
| G-3 | "Avans sistemi (KMK md. 20) v1'de var mı belirsiz" | v1.0'da karara bağlandı (açık madde 20 → 6). → K-1 |
| G-4 | "Genel kurul / karar defteri kapsam dışı mı belirsiz" | v1.0 §15 ile kapsama alındı; v1.1 §31 karar defterini append-only hash zincirli tablo olarak tanımlar. **Çözülmüştür** |
| G-5 | "KMK md. 22 kiracı sorumluluk sınırı takip edilecek mi belirsiz" | v1.0'da karara bağlandı; Finance spec *"Debt attaches to the unit"* ile uyumlu davranıyor. **Çözülmüştür** |
| G-6 | "Event Sourcing kullanılıp kullanılmayacağı belirsiz — mimari risk" | §31 ile kesin karara bağlandı: **kullanılmaz.** Hiçbir spec Event Sourcing önermiyor. **Çakışma yoktur** |
| G-7 | "Genel `Tesis → Birim` soyutlaması eksik — çok dikeyli yapı kurulmamış" | §40 bunu açıkça **reddeder**: *"Genel `Tesis → Birim` hiyerarşisi v1'de kurulmaz."* Yerine paket sınırı disiplini gelir. Eksiklik değil, **karardır** |
| G-8 | "Okuma veritabanı / projeksiyon katmanı yok" | §32: *"v1'de ayrım servis düzeyindedir, veritabanı düzeyinde değil."* Kapsam dışıdır |
| G-9 | "Belge sürüm yönetimi eksik" | §33 belge sınıfı için versiyon + arşiv gerektirir; Finance'ta `Budget.version/previousVersionId` mevcut. Kısmi karşılık var → Y-6'ya indirgendi (Kritik değil) |
| G-10 | "Çok para birimi desteği gereksiz karmaşıklık" | ADR bunu yasaklamaz ve `functionalAmount` yaklaşımı doğrudur. Kapsam kararı olarak O-7'ye indirgendi (uyumsuzluk değil) |

---

## 7. Sonuç ve karar

### Şu kritik uyumsuzluklar giderilmeden geliştirmeye başlanmamalıdır.

Kod tabanı ADR v1.1 ile **senkronize değildir.** Blok-1 (Multi-Tenant + PostgreSQL RLS + Migration Altyapısı) implementasyonuna bu haliyle başlanması, mimarinin yanlış eksende çivilenmesiyle sonuçlanır.

**Blok-1'i bloke eden yedi madde:**

| # | Madde | Neden bloke ediyor | Efor |
|---|---|---|---|
| **K-1** | v1.0 §13–§30 metni yok | §29 (outbox) ve §30 (üç kapı) Blok-1 dikey diliminin zorunlu parçası | 0,5 gün (belge varsa) |
| **K-2** | `estate` + portföy ↔ `tenant` + RLS | Blok-1'in birincil konusu. Yanlış eksende şema = tam yeniden yazım | 3,5 gün |
| **K-5b** | Önbellek anahtar sözleşmesi + lint kuralı yok | Sprint 0 teslimatı; dikey dilim bunu kullanacak | 1,5 gün |
| **K-6b** | `ISearchProvider` portu yok | Sprint 0 teslimatı | 1,5 gün |
| **Y-8** | `core-domain` / `apartman-domain` paket sınırı yok | Sprint 0 teslimatı; CI bağımlılık kontrolü Blok-1 ile birlikte kurulur | 2 gün |
| **Y-5** | Zaman standardı (DATE / timestamptz) tanımsız | İlk migration tarih kolonlarını yazacak. Sonradan tip değişimi = veri migrasyonu | 1,5 gün |
| **Y-6** | Soft delete alanları + kısmi unique index kuralı yok | İlk migration'da tablolara girmeli. Sonradan eklemek her tabloya dokunmaktır | 2 gün |

**Toplam engel kaldırma eforu: 12,5 gün** (K-1 belgesinin mevcut olduğu varsayımıyla) — yaklaşık 2,5 hafta, bir kişilik çalışma.

Bu, v1.1'in Sprint 0'a eklediği 1 haftalık uzatmayla aynı büyüklük mertebesindedir ve plan içinde soğurulabilir.

**Bloke etmeyen ancak kendi sprint'lerinden önce kapatılması gereken kritik maddeler:** K-3 (Sprint 3'ten önce), K-4 (Sprint 5'ten önce), K-5a (Sprint 3'ten önce), K-6a (Sprint 9'dan önce).

### Tek gerçek dış bağımlılık

**K-1 çözülemezse hiçbir şey ilerlemez.** v1.0 belgesi ya depoya eklenmeli ya da §13–§30 yeniden karara bağlanmalıdır. Bu, tek kişilik teknik çalışmayla aşılabilecek bir engel değildir; mimari kurul kararı gerektirir.

### Ek uyarı — C-4 açık maddesi

ADR Bölüm C, **C-4** (KMK emredici hükümler · genel kurul yeter sayısı · vekalet sınırları) için *"kalan süre 11 hafta, paralel başlatılmalıdır"* der. Bu rapor tarihinde o süre **başlamıştır ve tüketilmektedir.** Hukuki danışmanlık süreci Blok-1 ile eş zamanlı başlatılmazsa Sprint 3 blokeye girer. Bu bir teknik borç değil, **takvim riskidir.**

---

## 8. Onay bloğu

| Rol | Karar | Tarih | İmza |
|---|---|---|---|
| Mimari kurul | K-1 için v1.0 belgesinin sağlanması · K-2 kapsam kararı | | |
| Baş mimar | Blok-1 öncesi engel kaldırma planının onayı | | |
| Ürün sahibi | K-2 portföy kapsamının v1'den çıkarılmasının onayı | | |

**Onay alınmadan Blok-1 implementasyonu başlatılmayacaktır.**

---

*İlgili belgeler:* `03-EKSIKLER-BACKLOG.md` · `04-CAKISMA-KAYDI.md` · `../BASELINE.md` · `../IMPLEMENTATION-ROADMAP.md`
