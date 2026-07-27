# 03 — EKSİKLER BACKLOG

**Referans belge:** `BNOS-Apartman-Mimari-Karar-Kaydi-v1.1` · KİLİTLİ
**Backlog sürümü:** 2.0 — v1.1 temelinde tam yeniden üretim
**Tarih:** 26 Temmuz 2026
**Önceki sürüm:** 1.0 (ADR v0.1 temelli) — **geçersiz**
**Toplam kayıt:** 31 · Kritik 6 · Yüksek 12 · Orta 8 · Düşük 5

---

## 0. Sınıflandırma ölçütü

Bir maddenin seviyesi, **düzeltmenin ne kadar geç yapılırsa o kadar pahalı hale geldiğine** göre belirlenir — yalnızca ihlalin şiddetine göre değil.

| Seviye | Ölçüt |
|---|---|
| **Kritik** | Yanlış eksende inşaya yol açar. Sonradan düzeltmek şema, migration ve her yazma yolunu yeniden yazmayı gerektirir. Ya da mimari ilkenin doğrudan tersine çevrilmesidir |
| **Yüksek** | Sonradan düzeltmek çok sayıda dosyaya dokunmayı gerektirir ancak veri migrasyonu gerektirmez. Ya da ADR'nin Sprint 0/1 teslimat listesinde açıkça yer alır |
| **Orta** | Kendi sprint'inde normal maliyetle çözülür. Erken yapılmasının belirgin avantajı yoktur |
| **Düşük** | Kozmetik, terminolojik veya tekil noktada düzeltilir. Ertelenmesi risk üretmez |

`Blok-1` sütunu: madde Blok-1 (Multi-Tenant + RLS + Migration) implementasyonunu bloke ediyor mu.

---

## 1. KRİTİK — 6 kayıt

### K-1 · ADR v1.0 (§13–§30) metni proje bilgi tabanında yok

| | |
|---|---|
| **ADR maddesi** | v1.1 başlık bloğu · dolaylı olarak §13–§30 |
| **Etkilenen dosyalar** | `docs/adr/` (eksik) — tüm spec ve doğrulama belgelerinin denetlenebilirliği |
| **Belirti** | v1.1 §1–§30'un "aynen yürürlükte" olduğunu beyan eder ve tekrarlamaz; v1.0 belgesi yüklenmemiştir. On sekiz kilitli kararın metni yoktur |
| **Kritik olma nedeni** | §29 (Event bus / outbox) ve §30 (Üç kapı), v1.1'in Sprint 0 dikey dilim tanımında açıkça sayılır. İkisi de Blok-1'in girdisidir. §21 (Tema) ve §25 (Offline) frontend baseline'ını belirler |
| **Çözüm** | v1.0 belgesini `docs/adr/BNOS-Apartman-Mimari-Karar-Kaydi-v1.0.md` olarak depoya ekle. Belge yoksa §13–§30 mimari kurulda yeniden karara bağlanır |
| **Efor** | 0,5 gün (belge mevcutsa) · 5–8 gün (yeniden karar) |
| **Blok-1** | **EVET** |
| **Sahip** | Mimari kurul |

### K-2 · Tenant modeli çelişkisi — `estate` + portföy kapsamı ↔ `tenant` + RLS

| | |
|---|---|
| **ADR maddesi** | §2 · §11 |
| **Etkilenen dosyalar** | `01-Dashboard-Spec` (6.1–6.6, STEP 7 uç 1/2/5/6/10/21/24) · `07-Finance-Spec` (6.2 tüm varlıklar, 6.5, STEP 7 tümü) · `04-AI-Center-Spec` (6.3, 7.1) · `bn-dashboard.html` kapsam seçici |
| **Belirti** | `estateId` alan adı · `scope: portfolio\|group\|site\|block` · "Portfolio aggregates exclude estates the user cannot access" |
| **Kritik olma nedeni** | RLS altında çapraz-tenant toplama tanım gereği imkânsızdır. İki farklı izolasyon modeli arasında seçim yapılmadan tek satır migration yazılamaz |
| **Çözüm** | (1) `estateId` → `tenant_id` yeniden adlandırma. (2) Portföy/grup kapsamını v1'den çıkar — Yönetim Şirketi yeteneğidir, §11 uyarınca kapsam dışı. (3) Gelecekteki portföy görünümünün RLS'i gevşetmeden nasıl çözüleceğini şimdi kayda geç (yönetim şirketi tenant'ı + açık devir ilişkisi) |
| **Efor** | 3,5 gün |
| **Blok-1** | **EVET** |
| **Sahip** | Baş mimar + ürün sahibi |

### K-3 · Muhasebe derinliği çelişkisi — çift taraflı defter ↔ işletme defteri

| | |
|---|---|
| **ADR maddesi** | §3 · §41 (çelişkiyi adıyla anar) |
| **Etkilenen dosyalar** | `07-Finance-Spec` (6.2, 6.4, 8.1, 8.2 kural 1, 8.4, STEP 7 uç 3/4/5) · `bn-finance.html` · `09-Finance-Validation` |
| **Belirti** | `POST /journal-entries` · `GET /trial-balance` · *"Double-entry always balances"* iş kuralı |
| **Kritik olma nedeni** | Kullanıcıya gösterilen mali gerçekliğin tanımı. Yanlış defter modeli, tüm raporlama katmanını ve KMK uyumunu etkiler |
| **Çözüm** | **Şemayı koru** — çiftli satır yapısı §3'ün genişleme kısıtını tam karşılar. v1'de kapat: doğrudan yevmiye girişi, mizan, büyük defter. `ACCOUNTING_DOUBLE_ENTRY` feature flag'i arkasına al. v1'de defter kayıtları yalnızca sistem tarafından üretilir; kullanıcı işletme defteri ve KMK mali raporlarını görür |
| **Efor** | 3 gün |
| **Blok-1** | Hayır — Sprint 3 öncesi |
| **Sahip** | Domain sahibi (mali) |

### K-4 · AI karar akışı BNOS sırasını ihlal ediyor

| | |
|---|---|
| **ADR maddesi** | §11 · §24 · §38 |
| **Etkilenen dosyalar** | `04-AI-Center-Spec` (4.2, 4.3, 6.1, 6.8) · `bn-ai-center.html` · `06-AI-Center-Validation` |
| **Belirti** | Akış: `Input → intent classification (cheap model) → ... → retrieval`. **İlk adım LLM'dir.** Enterprise Memory ve Knowledge Graph hiçbir akışta geçmiyor. BRE yalnızca üretim *sonrası* engelleyici |
| **Kritik olma nedeni** | BNOS'un temel çalışma prensibinin tersine çevrilmesi. Tek başına yeterli bir mimari ret gerekçesi |
| **Çözüm** | Akışı §11 sırasına göre yeniden yaz: `Girdi → Enterprise Memory → Knowledge Graph → Business Rules Engine → AI Agent → (gerekirse) LLM`. Niyet sınıflandırmasını kural/anahtar sözcük katmanına taşı; LLM'e yalnızca kural katmanı çözemezse düş. Retrieval Service'i kaldır, `IMemoryQueryService` + `ISearchProvider` çağrısına indirge |
| **Efor** | 5,5 gün |
| **Blok-1** | Hayır — Sprint 5 öncesi (ancak §38 portu Sprint 0) |
| **Sahip** | AI mimarı |

### K-5 · Finansal bakiyeler önbelleklenmiş uçlardan servis ediliyor

| | |
|---|---|
| **ADR maddesi** | §37 · §2 |
| **Etkilenen dosyalar** | `01-Dashboard-Spec` (STEP 7 performans sözleşmesi, uç 1 ve 19) · `07-Finance-Spec` (STEP 7, uç 1) · `04-AI-Center-Spec` (6.9) |
| **Belirti** | **(a)** `GET /summary` — *"p95 ≤ 400ms cached"*, yükünde alacak yaşlandırma, nakit ve bütçe sapması var. **(b)** `t:{tenantId}:{alan}:{kimlik}:{sürüm}` anahtar sözleşmesi ve lint kuralı hiçbir yerde yok |
| **Kritik olma nedeni** | (a) *Bayat finansal rakam, yavaş finansal rakamdan kötüdür.* Tahsilattan sonra eski bakiye görmek güvenilirliği tek seferde bitirir. (b) §37 tenantId'siz anahtarı açıkça **veri sızıntısı** olarak niteler — RLS önbelleği korumaz |
| **Çözüm** | **(a)** `GET /summary` yükünü ikiye ayır: önbelleklenebilir (KPI tanımı, yerleşim, referans verisi, çözümlenmiş yönetim planı kuralları) ve önbelleklenmeyen (bakiye, yaşlandırma, cari hesap, nakit). Performans hedefini indeks ve sorgu optimizasyonuyla karşıla. **(b)** Anahtar biçimini BFS'e yaz, `@bnos/cache` sarmalayıcısı `tenantId` olmadan çağrı kabul etmesin, ESLint kuralını Sprint 0'da ekle |
| **Efor** | (a) 2 gün · (b) 1,5 gün |
| **Blok-1** | **(b) EVET** — Sprint 0 teslimatı · (a) Hayır, Sprint 3 |
| **Sahip** | Baş mimar |

### K-6 · Arama ve anlamsal erişim iki ayrı sistem olarak kuruluyor

| | |
|---|---|
| **ADR maddesi** | §38 · §11 |
| **Etkilenen dosyalar** | `04-AI-Center-Spec` (4.3, 6.1, 6.3, 6.9) · `01-Dashboard-Spec` (STEP 7 uç 22) |
| **Belirti** | AI Center kendi gömme, hibrit arama ve gömme önbelleği katmanını kuruyor. Dashboard `GET /search` üçüncü bir arama yolu açıyor |
| **Kritik olma nedeni** | §11'in *"BNOS çekirdek servisleri yeniden tasarlanmayacaktır"* kuralının ihlali. İki kalıcı bilgi kaynağı üretir; hangisinin doğru olduğu ilk tutarsızlıkta sorulur |
| **Çözüm** | İki portluk sınır: `IMemoryQueryService` (anlamsal, BNOS) + `ISearchProvider` (sözcük tabanlı, v1'de PostgreSQL FTS). AI Center Retrieval Service'i bu iki portun çağrı sıralayıcısına indirge. **Korunacak:** ACL-filtresi-sıralamadan-önce kuralı ve sonuç sayısı sızıntısı reddi |
| **Efor** | (port tanımı) 1,5 gün · (spec düzeltmesi) 2 gün |
| **Blok-1** | **(port) EVET** — Sprint 0 teslimatı · (uygulama) Hayır, Sprint 9 |
| **Sahip** | Baş mimar + AI mimarı |

---

## 2. YÜKSEK — 12 kayıt

### Y-1 · Event kataloğu, standart zarf ve Outbox deseni tanımsız

| | |
|---|---|
| **ADR maddesi** | §31 (*"Outbox yine de zorunludur"*) · §29 (metin yok) · §40 sözleşme testi |
| **Etkilenen dosyalar** | Üç spec de — hiçbirinde event tanımı yok |
| **Çözüm** | Standart event zarfını (kimlik, tip, sürüm, tenant, principal, korelasyon, zaman, yük) AIS v1'e yaz. Outbox tablosunu ve yayıncısını Blok-1 dikey diliminde kur. Event kataloğunu sprint başına genişlet. §31 uyarınca event **kayıt kaynağı değildir** — bu sınır açıkça yazılır |
| **Efor** | 3 gün (zarf + outbox + katalog iskeleti) |
| **Blok-1** | Kısmen — outbox dikey dilimin parçası |

### Y-2 · CQRS Command/Query ayrımı yok

| | |
|---|---|
| **ADR maddesi** | §32 |
| **Etkilenen dosyalar** | Üç spec'in STEP 7 API tabloları |
| **Belirti** | Tek servis katmanı varsayılıyor. Doğrudan kural ihlali: `POST /journal-entries` → tam `Entry`, `POST /payments` → `Payment + allocations` döndürüyor. §32 kural 2: Command yalnızca `id` + durum döndürür |
| **Çözüm** | Her aggregate için `XCommandService` / `XQueryService` üret. Kod üreticisini (generator) Sprint 0'da yaz. API sözleşmelerinde mutasyon yanıtlarını `{id, status}` olarak düzelt. Muafiyetler (il/ilçe, para birimi, sabit enum) gerekçeli listelenir |
| **Efor** | 2 gün (iskelet + üreteç) · 1 gün (spec düzeltmesi) |
| **Blok-1** | Kısmen — iskelet Sprint 0 teslimatı |

### Y-3 · i18n yok — tüm kullanıcı metni sabit Türkçe

| | |
|---|---|
| **ADR maddesi** | §40 sözleşme testi (*"Tüm kullanıcıya görünen metin i18n anahtarıdır"*) |
| **Etkilenen dosyalar** | `bn-dashboard.html` · `bn-finance.html` · `bn-ai-center.html` — üçünde de **sıfır** i18n anahtarı ölçüldü |
| **Belirti** | `>Bildirimler<`, `>Hedef tanımlı değil<`, `>Veri alınamadı<` biçiminde doğrudan gömülü metin |
| **Çözüm** | Next.js'e taşırken tüm metni `next-intl` (veya eşdeğeri) anahtarlarına çıkar. React Native tarafında aynı sözlüğü paylaş. Sözleşme testine ekle: derleme sırasında gömülü kullanıcı metni taraması |
| **Efor** | 3 gün (üç ekran) — taşıma sırasında yapılırsa marjinal maliyet ~1 gün |
| **Blok-1** | Hayır |

### Y-4 · Merkezî numaralandırma motoru yok

| | |
|---|---|
| **ADR maddesi** | §35 |
| **Etkilenen dosyalar** | `07-Finance-Spec` (6.2 `Receipt`, `FinancePolicy.numberingSeries[]`) · diğer modüllerde tanım yok |
| **Belirti** | Makbuz boşluksuz ✅ ama merkezî `NumaraSerisi`, BOSLUKSUZ/BOSLUKLU ayrımı, advisory lock kuralı ve `SEQUENCE` yasağı yok. Talep No / Belge No / İş Emri No tanımsız |
| **Çözüm** | `NumaraSerisi` motorunu Sprint 1'de kur. Boşluksuz seriler: sayaç tablosu + advisory lock, kaydın transaction'ı içinde tahsis. Boşluklu seriler: PostgreSQL `SEQUENCE`. Seri kataloğunu DMS'e yaz; her yeni seri DoD kalemidir |
| **Efor** | 3 gün |
| **Blok-1** | Hayır — Sprint 1 |

### Y-5 · Zaman standardı uygulanmamış (DATE / timestamptz ayrımı yok)

| | |
|---|---|
| **ADR maddesi** | §34 · §8 (gecikme faizi buna bağlı) |
| **Etkilenen dosyalar** | `07-Finance-Spec` 6.2 (`dueDate`, `valueDate`, `paymentDate`, `settlementDate`, `startDate/endDate`, `effectiveFrom`) · `01-Dashboard-Spec` 6.1 (`periodStart/End`, `computedAt`) · `04-AI-Center-Spec` 7.1 |
| **Belirti** | Tarih alanlarının tipi hiçbir yerde belirtilmemiş. Tenant `saat_dilimi` ayarı yok. API'de ISO 8601/UTC beyanı yok |
| **Kritik olma sınırında olma nedeni** | §34: *"Vade tarihi UTC timestamp olarak saklanırsa saat dilimi sınırında bir gün kayar... her borçlunun faizini yanlış hesaplar ve hata sessizdir."* İlk migration yanlış tiplerle yazılırsa düzeltme veri migrasyonudur |
| **Çözüm** | Tip haritasını BFS'e yaz. Vade, tahakkuk dönemi, dönem sınırları, genel kurul ve sözleşme tarihleri → `DATE`. Olay, audit, event, oturum, mesaj → `timestamptz` UTC. `Tenant.saat_dilimi` alanını Blok-1 şemasına ekle (varsayılan `Europe/Istanbul`, koda gömülmez) |
| **Efor** | 1,5 gün |
| **Blok-1** | **EVET** — ilk migration tarih kolonlarını yazacak |

### Y-6 · Silme standardı kısmen uygulanmış

| | |
|---|---|
| **ADR maddesi** | §33 |
| **Etkilenen dosyalar** | `07-Finance-Spec` 6.4, 8.2 (finansal sınıf ✅) · ana veri ve belge sınıfları için tanım yok |
| **Belirti** | Finansal kayıtlar silinmiyor ✅. Ancak `silindi_mi · silinme_tarihi · silen_kullanici · silme_gerekcesi` alanları, kısmi unique index kuralı, merkezî Prisma filtresi, `SilinebilirlikPolitikasi` ve `anonimlestir()` yok |
| **Çözüm** | Dört alanı Blok-1'de temel modele ekle. `CREATE UNIQUE INDEX ... WHERE silinme_tarihi IS NULL` kuralını migration şablonuna yaz. Varsayılan filtreyi Prisma Client Extension ile merkezîleştir. `SilinebilirlikPolitikasi`'nı Sprint 1'de veri olarak tanımla. Anonimleştirme Sprint 9 |
| **Efor** | 2 gün (Blok-1 kısmı) · 2 gün (politika motoru, Sprint 1) |
| **Blok-1** | **EVET** — alanlar ve index kuralı ilk migration'da olmalı |

### Y-7 · Zamanlayıcı standardı eksik

| | |
|---|---|
| **ADR maddesi** | §36 |
| **Etkilenen dosyalar** | `07-Finance-Spec` (tahakkuk, faiz işletme, hatırlatma) · `01-Dashboard-Spec` (rapor üretimi, widget yenileme) |
| **Belirti** | İçerik var, motor yok. Eksik: `IScheduler` portu, dağıtık kilit, kaçırılan çalıştırma politikası, tenant saat dilimi tetikleme, ölü mektup kuyruğu, yöneticiye alarm |
| **Mevcut olan (korunacak)** | Tahakkukun `preview → commit` iki fazlı olması **§36 kural 6 dry-run gereksinimini karşılıyor.** *"one committed run per estate per period, enforced by unique constraint"* **`IsCalistirma` unique kısıtının muadili** |
| **Çözüm** | `IScheduler` portu + BullMQ/Redis adaptörü. `ZamanlanmisIs` / `IsCalistirma` tablolarını `UNIQUE (is, tenant, dönem_anahtarı)` ile kur. Kaçırılan çalıştırma politikasını iş bazında tanımla — finansal işler geç çalıştırılır, asla atlanmaz |
| **Efor** | 4 gün |
| **Blok-1** | Hayır — Sprint 1 |

### Y-8 · `core-domain` / `apartman-domain` paket sınırı yok

| | |
|---|---|
| **ADR maddesi** | §40 |
| **Etkilenen dosyalar** | Depo yapısının tamamı — prototipler tek dosya monolittir |
| **Belirti** | Paket ayrımı, bağımlılık yönü kuralı ve CI kontrolü yok |
| **Çözüm** | Monorepo'yu `packages/core-domain` ve `packages/apartman-domain` olarak kur. `core-domain → apartman-domain` bağımlılığını CI'da reddet (`dependency-cruiser` veya Nx sınır kuralları). Bu tek kural, Site dikeyi başladığında çıkarmayı mekanik hale getirir |
| **Efor** | 2 gün |
| **Blok-1** | **EVET** — Blok-1 kodu doğru pakete yazılmalı |

### Y-9 · Dört belge mimarisi (§41) ve doküman sırası (§12) uygulanmamış

| | |
|---|---|
| **ADR maddesi** | §41 · §12 |
| **Etkilenen dosyalar** | Mevcut altı spec/validation belgesi · `docs/` yapısının tamamı |
| **Belirti** | CONSTITUTION, BFS, DMS, AIS'in hiçbiri yok. Mevcut spec'ler dört belgeye dağıtılmamış birleşik modül belgeleridir. Tek kaynak kuralı ihlal ediliyor — yetki matrisi hem Dashboard hem Finance spec'inde ayrı tanımlı. §12 sırasının 0. adımı (BNOS Core Service Contracts) hiç yazılmamış |
| **Çözüm** | Sprint 0 sonunda CONSTITUTION + BFS v1. Sprint 1 sonunda DMS v1 + AIS v1. Mevcut spec'lerdeki uyumlu içerik (bkz. `02-ADR-UYUM-RAPORU.md` §5, on beş kalem) bu belgelere **taşınır**, yeniden yazılmaz. Modül spec'leri arşive alınır ve tarihsel referans olur |
| **Efor** | 8 gün (CONSTITUTION 1 · BFS 4 · DMS 2 · AIS 1 — mevcut içerik taşındığı için) |
| **Blok-1** | Kısmen — CONSTITUTION ve BFS Sprint 0 teslimatı |

### Y-10 · Frontend ve mobil yığını hedefle uyumsuz

| | |
|---|---|
| **ADR maddesi** | §1 |
| **Etkilenen dosyalar** | Üç prototip · 22 roadmap HTML'i · Canva dışa aktarımı |
| **Belirti** | Prototipler vanilla HTML/CSS/JS tek dosya. Hedef Next.js + React. **React Native tarafında hiçbir varlık yok** — mobil ilk günden desteklenmesi gerekiyor |
| **Çözüm** | Prototipleri **tasarım sözleşmesi** olarak kabul et, kod olarak değil. Taşınacak olan: tasarım token'ları (CSS değişkenleri → Tailwind teması + RN tema nesnesi), yerleşim yapısı, erişilebilirlik davranışları, durum tasarımları. Yeniden yazılacak olan: işaretleme ve etkileşim. Mobil için paylaşılan tema ve API istemcisi Sprint 2'de kurulur |
| **Efor** | Token çıkarımı 1 gün · ekran başına taşıma 3–5 gün · RN temel iskelet 5 gün |
| **Blok-1** | Hayır |

### Y-11 · Gider sınıflandırması üç eksenden yalnızca biri modellenmiş

| | |
|---|---|
| **ADR maddesi** | §4 |
| **Etkilenen dosyalar** | `07-Finance-Spec` 6.2 (`FinancePolicy.apportionmentRule`) |
| **Belirti** | Eksen 1 (paylaşım kuralı) `equal\|arsa_payi\|m2\|unit_type\|mixed` olarak kısmen var — `TÜKETİM` ve `SABİT_TUTAR` eksik. **Eksen 2 (MALİKE_AİT / KULLANANA_AİT) tamamen yok. Eksen 3 (KMK_VARSAYILAN / YÖNETİM_PLANI / GENEL_KURUL_KARARI) tamamen yok** |
| **Neden önemli** | Kullanıcının açıkça talep ettiği "borç alıcısı malik mi kiracı mı" seçimi Eksen 2'dir. Bu eksen olmadan demirbaş giderinin malike, temizlik giderinin kiracıya yansıtılması modellenemez. Ayrıca Eksen 3, bir kuralın nereden geldiğini (dolayısıyla kimin değiştirebileceğini) taşır |
| **Çözüm** | `GiderTuru` varlığını üç bağımsız eksenle DMS'e yaz. Varsayılan KMK md. 20; tenant bazında yönetim planına göre override. Eksenlerin bağımsızlığını test et — bir gider hem arsa payına göre dağıtılıp hem kullanana yansıtılabilmeli |
| **Efor** | 2 gün (model) · Sprint 3 |
| **Blok-1** | Hayır |

### Y-12 · Borç sorumluluk zinciri ve SNAPSHOT kuralı modellenmemiş

| | |
|---|---|
| **ADR maddesi** | §5 |
| **Etkilenen dosyalar** | `07-Finance-Spec` 6.2 (`AssessmentLine.liablePartyId`, `Receivable`) |
| **Belirti** | `Receivable → Daire` doğru ✅ ve *"Debt attaches to the unit"* açıkça yazılmış ✅. Ancak sıralı `BorcSorumlusu[]` zinciri (Kiracı ASIL → Malik İKİNCİL) tekil `liablePartyId` alanına indirgenmiş. SNAPSHOT kuralı hiçbir yerde yazılı değil |
| **Neden önemli** | §5: *"Sorumlu kişiler borç oluşturulduğu anda çözülür ve kayda yazılır. Sorgu anında hesaplanmaz."* Tekil alan, iki sorumlunun sıralı zincirini taşıyamaz; kiracı ödemezse malike başvurma yolu modelde kaybolur |
| **Çözüm** | `BorcSorumlusu` alt varlığını sıra ve rol (`ASIL` / `IKINCIL`) ile ekle. Çözümlemeyi borç oluşturma transaction'ı içinde yap ve yaz. Sorgu anında yeniden çözümlemeyi kod düzeyinde imkânsız kıl |
| **Efor** | 2 gün · Sprint 3 |
| **Blok-1** | Hayır |

---

## 3. ORTA — 8 kayıt

| # | Madde | ADR | Etkilenen dosyalar | Çözüm | Efor | Blok-1 |
|---|---|---|---|---|---|---|
| **O-1** | Tüm varlıklar Site Yönetimi dikeyi için üretilmiş; v1 yalnızca Apartman | §11 | Üç spec · üç prototip · roadmap | Yeniden kullanım kararı: `core-domain`'e giden içerik (talep, belge, bildirim, personel, tedarikçi, muhasebe çekirdeği) doğrudan taşınır. Site'e özgü içerik (blok hiyerarşisi, portföy, tesis operasyonu) v1 kapsamından çıkarılır ve Site dikeyi için saklanır | 2 gün | Hayır |
| **O-2** | Tasarım token'ları platformlar arası paylaşılabilir biçimde değil | §21 (🚫), §1 | Üç prototip `:root` blokları | Token'ları tek kaynaktan (JSON / Style Dictionary) üret; web için CSS değişkeni + Tailwind teması, RN için tema nesnesi türet. Yoğunluk (density) anahtarı korunur | 1,5 gün | Hayır |
| **O-3** | `ISearchProvider` uygulaması ve Türkçe FTS yapılandırması yok | §38 | — | PostgreSQL `tsvector` + GIN adaptörü. §38 uyarısı: *PostgreSQL varsayılan olarak Türkçe sözlük yapılandırması getirmez.* `unaccent` + yapılandırma Sprint 9'da kurulur ve **doğrulanır** — varsayılana güvenilmez | 4 gün · Sprint 9 | Hayır |
| **O-4** | `IIoTGateway` portu tanımlı değil | §39 | — | Yalnızca port ve sınır tanımı. Üç kısıt kayda geçer: telemetri ana ilişkisel tablolara yazılmaz · telemetri domain event üretir · cihaz kimliği kullanıcı kimliği değildir | 1 gün · Sprint 0 | Hayır |
| **O-5** | Birleşik `Principal` modeli yok | §39 | `04-AI-Center-Spec` 6.5 (kısmen uyumlu) | `INSAN \| AGENT \| PLUGIN \| CIHAZ \| SISTEM` tek modelde birleştirilir. Her principal kendi kimliğiyle Audit Log'a yazar; yetkisi devraldığı kapsamın alt kümesidir | 2 gün · Sprint 1 | Hayır |
| **O-6** | Çok para birimi kapsam kararı verilmemiş | §3 | `07-Finance-Spec` 6.1, STEP 7 uç 39 | Model doğru (`amount` + `currency` + `fxRate` + `functionalAmount`) ve geri dönülemez kusurları önlüyor — **korunur.** Ancak v1'de kur yönetimi UI'ı ve `finance.fx.manage` yetkisi kapatılır; TRY sabit, kur 1. Karar DMS'e yazılır | 0,5 gün | Hayır |
| **O-7** | Offline yetenek sınırı doğrulanamıyor | §25 (🚫) | `01-Dashboard-Spec` 8.6 (*"mutations queued and replayed"*) | §25 metni geldiğinde doğrula. Kuyruğa alınan mutasyonların hangi modüllerde kabul edildiği açıkça listelenmelidir — finansal mutasyonların çevrimdışı kuyruklanması muhtemelen kapsam dışıdır | 1 gün (§25 geldikten sonra) | Hayır |
| **O-8** | Veri Aktarım Merkezi hiçbir belgede tanımlanmamış | §11 (kapsam), kullanıcı gereksinimi | — | Excel/CSV/PDF/Word/XML/JSON/SQL/TXT içe aktarım, OCR, kolon eşleştirme, veri temizleme, yinelenen kayıt kontrolü, önizleme, hata raporu, rollback. Tüm modüllerin ortak altyapısıdır — `core-domain`'e ait. Sprint ataması yapılmamış | 3 gün (tasarım) | Hayır |

---

## 4. DÜŞÜK — 5 kayıt

| # | Madde | ADR | Çözüm | Efor |
|---|---|---|---|---|
| **D-1** | Prototipler yalnızca koyu tema; açık tema yok | §21 (🚫) | §21 metni geldiğinde karar. Token yapısı iki temayı destekleyecek biçimde kurulduğu için maliyet düşük | 1 gün |
| **D-2** | API sürümleme stratejisi belgelenmemiş | §26 (🚫) | `/api/v1/...` öneki tutarlı kullanılmış. §26 metni geldiğinde uyum doğrulanır | 0,5 gün |
| **D-3** | Spec'ler İngilizce, ADR ve arayüz Türkçe | — | Türkçe–İngilizce domain sözlüğü üret (aidat, demirbaş, işletme projesi, arsa payı, gecikme tazminatı, kat malikleri kurulu). BFS'e ek olarak yazılır. AI Center 6.8 zaten böyle bir sözlük gerektiriyor | 1 gün |
| **D-4** | Roadmap V22–V34 numaralandırması ADR Sprint 0–16 / 46 hafta planıyla eşleşmiyor | §41, Bölüm B | İki plan arasında eşleme tablosu üret veya roadmap'i tarihsel referansa al. ADR planı üstündür | 0,5 gün |
| **D-5** | Canva dışa aktarımı ürün koduyla karışabilir | — | `bn_yönetim_için_canva_...` bir pazarlama sayfasıdır (Tailwind CDN + Canva SDK). `docs/reference/marketing/` altına taşı ve ürün kodu olmadığını belirt | 0,25 gün |

---

## 5. Efor özeti

| Seviye | Kayıt | Efor (gün) | Bunun Blok-1 öncesi kısmı |
|---|---|---|---|
| Kritik | 6 | 20,0 | 7,0 |
| Yüksek | 12 | 36,5 | 5,5 |
| Orta | 8 | 15,0 | 0 |
| Düşük | 5 | 3,25 | 0 |
| **Toplam** | **31** | **74,75** | **12,5** |

*Not:* K-1 için 0,5 gün (belge mevcut) varsayılmıştır. Belge yoksa toplam 5–8 gün artar ve bu süre teknik ekiple paralelleştirilemez.

Y-10 (frontend/mobil taşıma) eforu ekran sayısına bağlıdır; yukarıdaki 36,5 güne yalnızca token çıkarımı ve RN iskeleti dahildir, ekran taşımaları sprint bazında ayrıca planlanır.

---

## 6. Sprint ataması

| Sprint | Backlog kayıtları |
|---|---|
| **Blok-1 öncesi (engel kaldırma)** | K-1 · K-2 · K-5b · K-6b · Y-5 · Y-6 (Blok-1 kısmı) · Y-8 |
| **Sprint 0** | Y-1 (outbox) · Y-2 (CQRS iskeleti) · Y-9 (CONSTITUTION + BFS) · O-4 (IIoTGateway portu) · O-2 (token) |
| **Sprint 1** | Y-4 (numaralandırma) · Y-6 (politika motoru) · Y-7 (zamanlayıcı) · Y-9 (DMS + AIS) · O-5 (Principal) · D-3 (sözlük) |
| **Sprint 2** | Y-10 (RN iskeleti + ilk ekranlar) · Y-3 (i18n) |
| **Sprint 3** | K-3 · K-5a · Y-11 · Y-12 · O-6 |
| **Sprint 5** | K-4 |
| **Sprint 9** | K-6a (uygulama) · O-3 (Türkçe FTS) · Y-6 (anonimleştirme) |
| **Atanmamış** | O-1 (kapsam kararı — Blok-1 öncesi tercih edilir) · O-7 (§25 bekliyor) · O-8 (Veri Aktarım Merkezi) · D-1 · D-2 · D-4 · D-5 |

---

*İlgili belgeler:* `02-ADR-UYUM-RAPORU.md` · `04-CAKISMA-KAYDI.md` · `../BASELINE.md` · `../IMPLEMENTATION-ROADMAP.md`
