# 04 — ÇAKIŞMA KAYDI

**Referans belge:** `BNOS-Apartman-Mimari-Karar-Kaydi-v1.1` · KİLİTLİ
**Kayıt sürümü:** 2.1 — Faz 0 kararlarıyla güncellendi
**Tarih:** 26 Temmuz 2026
**Önceki sürüm:** 1.0 (ADR v0.1 temelli) — **geçersiz**
**Durum:** aktif çakışma **yok** — sekizi de ADR-0001…ADR-0005 ile karara bağlandı

---

## 0. Bu belgenin kapsamı

`03-EKSIKLER-BACKLOG.md` **eksiklikleri** kaydeder — olması gerekip olmayan şeyleri. Bu belge **çakışmaları** kaydeder: iki kaynağın aynı konuda **farklı ve birbiriyle bağdaşmayan** şey söylediği noktaları.

Ayrım pratiktir. Eksiklik yazılarak kapanır. Çakışma yalnızca **bir tarafın feragat etmesiyle** kapanır ve hangi tarafın feragat ettiği kayda geçmezse aynı tartışma her sprint'te yeniden açılır. ADR'nin varlık nedeni budur: *"her yeni sohbette bu kararların tekrar tartışılmasını önlemek."*

### Öncelik hiyerarşisi

```text
1. ADR v1.1                      ← KİLİTLİ · üstün
2. ADR v1.0 (§13–§30)            ← KİLİTLİ · üstün (metin eksik, bkz. K-1)
3. ADR v0.1 (§1–§12)             ← v1.0/v1.1 tarafından değiştirilmediği ölçüde yürürlükte
4. BNOS BRM / ERAM standardı     ← platform kısıtı
5. Modül spesifikasyonları       ← ADR'ye tabi
6. Prototipler                   ← tasarım referansı, sözleşme değil
7. Roadmap V22–V34               ← tarihsel referans
```

**Kural:** Çakışmada üst sıradaki kaynak kazanır. İstisna yalnızca alt kaynağın üst kaynağın **bilmediği bir kısıt** taşıdığı durumdur (örn. bir mevzuat gereği) — bu durumda çakışma ADR'ye yeni madde önerisi olarak yükseltilir, sessizce çözülmez.

---

## 1. Aktif çakışmalar

### Ç-1 · Muhasebe derinliği

| | |
|---|---|
| **Taraf A — ADR §3** | v1 hedefi KMK'ya uygun **işletme defteri.** Veri modeli şema değişikliği olmadan çift tarafa genişleyebilmeli |
| **Taraf B — `07-Finance-Spec` 6.2 / 8.2** | `JournalEntry` + `JournalLine` (debit/credit) · `FinancialAccount.type(asset\|liability\|equity\|income\|expense)` · `GET /trial-balance` (mizan) · iş kuralı 1: *"Double-entry always balances"* |
| **Çakışmanın niteliği** | Kısmi. Şema düzeyinde çakışma **yoktur** — çiftli satır yapısı §3'ün genişleme kısıtının tam olarak gerektirdiği şeydir. Çakışma **v1'de kullanıcıya açılan yüzeylerdedir:** doğrudan yevmiye girişi, mizan ve büyük defter |
| **Karar** | ✅ **ÇÖZÜLDÜ — [ADR-0003](../adr/log/0003-muhasebe-cift-tarafli.md).** Taraf B kazandı: çift taraflı muhasebe mimarisiyle devam edilir. §3'ün işletme defteri hedefi değiştirilmiştir |
| **Uygulama** | Feature flag yaklaşımı terk edildi. `JournalEntry` + `JournalLine` kayıt kaynağıdır. **İşletme defteri türetilmiş rapordur** ve defterle mutabakatı test edilir (KMK m.36 yükümlülüğü devam eder) |
| **Gerekçe** | §3'ün asıl kaygısı derinlik değil geri dönülemezlikti. Baştan çift taraflı kurmak, "sonradan genişleme" sorununu tamamen ortadan kaldırır. Ayrıca borç = alacak yapısal doğrulaması, işletme defterinde bulunmayan bir denetim güvencesi verir |
| **Bağlayıcı koşullar** | ADR-0003 Koşul 1–4: işletme defteri raporu kaybolmaz · kullanıcıya çift taraflılık dayatılmaz · hesap planı KMK bağlamına göre kurulur · performans önbellekle değil özet tabloyla çözülür |
| **Kayıt notu** | §41 bu çakışmayı zaten adıyla anmıştır ve ADR'nin dörde ayrılma gerekçesi olarak gösterilmiştir. Bu, çakışmanın **tespit edilip düzeltilmediğinin** kaydıdır |
| **Backlog** | K-3 |

### Ç-2 · Tenant sınırı ve kapsam modeli

| | |
|---|---|
| **Taraf A — ADR §2 / §11** | Tek veritabanı + `tenant_id` + PostgreSQL RLS. **Her tenant = bir apartman.** İzolasyon uygulama katmanına bırakılmaz, veritabanı zorlar. v1 = yalnızca Apartman |
| **Taraf B — `01-Dashboard-Spec` 6.4 / 6.6 / STEP 7** | `scope: portfolio \| group \| site \| block` · *"Portfolio aggregates exclude estates the user cannot access"* · `dashboard.scope.portfolio` yetkisi · tüm varlıklarda `estateId` |
| **Çakışmanın niteliği** | **Tam ve uzlaşmaz.** RLS altında çapraz-tenant toplama tanım gereği imkânsızdır. Bu bir `WHERE` koşulu farkı değil, iki farklı izolasyon modelidir |
| **Karar** | ✅ **ÇÖZÜLDÜ — [ADR-0002](../adr/log/0002-tenant-modeli.md).** ADR üstün. Portföy ve grup kapsamı v1'den çıkarıldı |
| **Uygulama** | `estateId` → `tenant_id`. Kapsam `tenant` (ve isteğe bağlı `blok`) ile sınırlanır. Portföy görünümleri Yönetim Şirketi modülüne devredilir |
| **Geriye dönüş yolu** | Yönetim Şirketi dikeyi geldiğinde portföy görünümü **RLS gevşetilerek değil**, ayrı bir okuma kapsamıyla çözülür: yönetim şirketi tenant'ı + apartman tenant'larından açık devir (delegation) ilişkisi. Bu yol şimdi kayda geçirilmiştir ki ileride kolay yol (RLS'i by-pass etmek) cazip görünmesin |
| **Uyarı** | Bu çözümün maliyeti reddedilmemelidir: yönetim şirketi kullanıcısı için portföy raporu, tenant başına ayrı sorgu + uygulama katmanında toplama demektir. Yavaştır. RLS'in bedeli budur ve §2 bu bedeli KVKK denetlenebilirliği karşılığında bilerek kabul etmiştir |
| **Backlog** | K-2 |

### Ç-3 · AI çalışma sırası

| | |
|---|---|
| **Taraf A — ADR §11** | *"LLM hiçbir zaman ilk çalışan bileşen değildir. Sıra: Enterprise Memory → Knowledge Graph → Business Rules Engine → AI Agent → (gerekirse) LLM"* |
| **Taraf B — `04-AI-Center-Spec` 4.2 / 6.1** | `Input → intent classification (cheap model) → permission pre-check → scope resolution → model routing → retrieval → generation`. İlk adım bir LLM'dir. Enterprise Memory ve Knowledge Graph hiçbir akışta geçmez. BRE yalnızca 4.4'te üretim **sonrası** engelleyici olarak görünür |
| **Çakışmanın niteliği** | **Tam.** Prensibin tersine çevrilmesi |
| **Karar** | ✅ **ÇÖZÜLDÜ — [ADR-0004](../adr/log/0004-ai-yurutme-sirasi.md).** ADR üstün. Tartışmaya kapalıdır — BNOS'un temel çalışma prensibidir |
| **Uygulama** | Akış §11 sırasına göre yeniden yazılır. Niyet sınıflandırması kural/anahtar sözcük tabanlı bir katmana taşınır; LLM'e yalnızca kural katmanı çözemezse düşülür. BRE üretimden **önce** izin verilen eylem uzayını belirler, sonradan engellemez |
| **Neden önemli** | Sıra yalnızca mimari zarafet meselesi değildir. BRE üretimden sonra çalıştığında sistem, bir kuralı ihlal eden öneriyi **üretmiş** olur ve sonra saklar. Üretimden önce çalıştığında o öneri hiç var olmaz. İkincisi hem ucuz hem denetlenebilirdir |
| **Kısmi uyum notu** | Taraf B'nin 4.4'teki *"Business rules are read from the rule engine, never re-implemented in prompts. The AI is a client of the rules, not an alternative to them"* ifadesi **doğrudur ve korunur.** Çakışma kuralların kullanılıp kullanılmadığında değil, **ne zaman** kullanıldığındadır |
| **Backlog** | K-4 |

### Ç-4 · Finansal veri ve önbellek

| | |
|---|---|
| **Taraf A — ADR §37** | *"Defter bakiyesi, cari hesap, borç durumu — Önbelleklenmez."* · *"Bayat finansal rakam, yavaş finansal rakamdan kötüdür"* |
| **Taraf B — `01-Dashboard-Spec` / `07-Finance-Spec` STEP 7** | Her iki `GET /summary` için *"p95 ≤ 400ms cached"*. Yüklerde alacak yaşlandırma, nakit pozisyonu, bütçe sapması |
| **Çakışmanın niteliği** | Doğrudan. Aynı veri için biri "önbelleklenmez" diyor, diğeri önbellekten servis etmeyi performans sözleşmesi yapıyor |
| **Karar** | ✅ **ÇÖZÜLDÜ — [ADR-0005](../adr/log/0005-finansal-ozet-onbellek.md).** ADR üstün |
| **Uygulama** | `GET /summary` yükü ikiye ayrılır. Önbelleklenebilir: KPI tanımları, widget yerleşimi, referans verisi, çözümlenmiş yönetim planı kuralları. Önbelleklenmeyen: bakiye, yaşlandırma, cari hesap, nakit. Finansal kısım için p95 hedefi indeks ve sorgu optimizasyonuyla karşılanır |
| **Gerilim kaydı** | Taraf B'nin performans kaygısı meşrudur ve göz ardı edilmemelidir. 25.000 bağımsız bölümde yaşlandırma sorgusu önbelleksiz kolay değildir. Çözüm önbellek değil, doğru indeksleme ve gerekirse **eşzamanlı olarak bakımı yapılan** (event ile güncellenen) bir özet tablodur — ki bu önbellek değil, kayıt kaynağının bir parçasıdır ve §37'nin yasağına girmez. Bu ayrım BFS'e yazılmalıdır, aksi halde ilk performans krizinde önbellek geri gelir |
| **Backlog** | K-5 |

### Ç-5 · Anlamsal arama sahipliği

| | |
|---|---|
| **Taraf A — ADR §38 / §11** | *"Anlamsal/vektör arama ayrı bir sistem olarak kurulmaz; Enterprise Memory'nin sorumluluğudur."* · BNOS çekirdek servisleri yeniden tasarlanmaz |
| **Taraf B — `04-AI-Center-Spec` 4.3 / 6.1 / 6.9** | Kendi Retrieval Service'i · hibrit vektör + anahtar sözcük araması · gömme (embedding) önbelleği ve geçersizleştirme |
| **Çakışmanın niteliği** | Sahiplik çakışması. İki sistem aynı işi yapar ve zamanla ayrışır |
| **Karar** | ✅ **ÇÖZÜLDÜ — [ADR-0004](../adr/log/0004-ai-yurutme-sirasi.md).** ADR üstün |
| **Uygulama** | İki port: `IMemoryQueryService` (anlamsal — BNOS Enterprise Memory) ve `ISearchProvider` (sözcük tabanlı — v1'de PostgreSQL FTS). AI Center Retrieval Service'i bu iki portun çağrı sıralayıcısına indirgenir; kendi indeksi ve gömme deposu kaldırılır |
| **Korunacak içerik** | Taraf B'nin 4.3'teki ACL-filtresi-sıralamadan-önce kuralı ve sonuç sayısı üzerinden sızıntı reddi, §38 kural 1 ile **birebir aynıdır** ve bağımsız olarak doğru bulunmuştur. Port değişiminde kaybedilmemelidir |
| **Backlog** | K-6 |

### Ç-6 · Command yanıt sözleşmesi

| | |
|---|---|
| **Taraf A — ADR §32 kural 2** | *"Command, tam okuma modeli döndürmez. `id` + durum döndürür; istemci gerekiyorsa Query çağırır. Aksi halde yazma tarafı, okuma şemasına bağımlı hale gelir"* |
| **Taraf B — Üç spec'in STEP 7 tabloları** | `POST /journal-entries` → `Entry` · `POST /payments` → `Payment + allocations` · `PUT /layouts/{id}` → `Updated layout` · `POST /alerts/{id}/acknowledge` → `Updated alert` |
| **Çakışmanın niteliği** | Sözleşme düzeyinde, yaygın |
| **Karar** | ✅ **ÇÖZÜLDÜ — BFS v1 §6.3.** ADR üstün |
| **Uygulama** | Mutasyon yanıtları `{id, status}` (gerekirse `version`) olarak düzeltilir. İstemci güncel durumu Query ucundan alır |
| **Gerilim kaydı** | Bu, istemci tarafında ek bir gidiş-dönüş demektir ve mobil ağ koşullarında hissedilir. §32 bunu bilerek kabul eder — bedel, yazma tarafının okuma şemasından bağımsızlaşmasıdır. Optimizasyon gerekirse çözüm Command'e okuma modeli eklemek değil, Query'yi hızlandırmak veya istemcide iyimser güncelleme kullanmaktır. Bu not, ilk performans şikâyetinde §32'nin sessizce delinmemesi için yazılmıştır |
| **Backlog** | Y-2 |

### Ç-7 · Sürüm planı ve numaralandırması

| | |
|---|---|
| **Taraf A — ADR v1.1 Bölüm B** | Sprint 0–16 · toplam 46 hafta · MVP Sprint 6 sonu (21 hafta) |
| **Taraf B — `BN-Yonetim-Enterprise-Release-Roadmap-V22-to-V34.md`** | Version 22 → 34 · on üç sürüm · farklı yetenek gruplaması ve sıralaması |
| **Çakışmanın niteliği** | Planlama çakışması. İki plan aynı işi farklı biçimde parçalar ve farklı sıraya koyar |
| **Karar** | ✅ **ÇÖZÜLDÜ.** ADR üstün. Roadmap tarihsel referans statüsüne alındı |
| **Uygulama** | Roadmap `docs/reference/roadmap/` altına taşınır. İçindeki yetenek envanteri (Appendix A) ve tasarım token değişiklik kaydı (Appendix B) **korunur ve DMS/BFS'e girdi olur**; sürüm sıralaması kullanılmaz |
| **Not** | Roadmap Site Yönetimi dikeyi için yazılmıştır (Ç-8). ADR planı Apartman dikeyi içindir. İkisi aynı ürünün planı değildir |
| **Backlog** | D-4 |

### Ç-8 · Ürün dikeyi

| | |
|---|---|
| **Taraf A — ADR §11** | v1 = **yalnızca Apartman Yönetimi.** Site ve Yönetim Şirketi aynı çekirdek üzerine sonra eklenir |
| **Taraf B — Tüm mevcut varlıklar** | Üç spec, üç prototip, roadmap ve Canva sayfası **BN Site Yönetimi** için üretilmiştir: `Site · Blok · Daire`, "Site Yöneticisi", tesis operasyonu, güvenlik ve temizlik modülleri, portföy görünümü |
| **Çakışmanın niteliği** | Kapsam çakışması. Mevcut varlıkların tamamı yanlış dikey için yazılmıştır |
| **Karar** | ✅ **ÇÖZÜLDÜ — [ADR-0002](../adr/log/0002-tenant-modeli.md).** ADR üstün — ancak bu, varlıkların atılması anlamına gelmez |
| **Uygulama** | Üçe ayır: **(1) Doğrudan taşınır** — `core-domain`'e ait olan her şey: talep yönetimi, belge, bildirim, duyuru, personel, tedarikçi, sözleşme, muhasebe çekirdeği, yetkilendirme duruşu, hata/boş durum disiplini, tasarım token'ları, erişilebilirlik. **(2) Uyarlanır** — `Site → Blok → Daire` hiyerarşisi `Apartman(Tenant) → Blok? → BagimsizBolum` olur. Apartmanda blok çoğu zaman tekildir; hiyerarşi korunur ama zorunlu değildir. **(3) Saklanır** — tesis operasyonu, güvenlik/temizlik modülleri, portföy: Site dikeyi başladığında kullanılmak üzere `docs/reference/site/` altına alınır |
| **Not** | §40'ın paket sınırı disiplini (`core-domain` / `apartman-domain`) tam olarak bu ayrımı mekanik hale getirmek için vardır. Ç-8'in çözümü Y-8'in uygulanmasıyla kalıcılaşır |
| **Backlog** | O-1 · Y-8 |

---

## 2. Çakışma olmadığı doğrulanan noktalar

Bu bölüm, önceki raporda çakışma sanılan veya makul olarak çakışma sanılabilecek noktaları kaydeder. Amacı, aynı incelemenin tekrar yapılmasını önlemektir.

| # | Şüphelenilen çakışma | Doğrulama sonucu |
|---|---|---|
| N-1 | §31 "Event Sourcing kullanılmaz" ↔ spec'lerin event yaklaşımı | **Çakışma yok.** Hiçbir spec Event Sourcing önermiyor; üçü de PostgreSQL ilişkisel modeli kayıt kaynağı varsayıyor. §31 ile uyumludur |
| N-2 | §33 "finansal kayıt asla silinmez" ↔ Finance spec silme davranışı | **Çakışma yok.** Finance 8.2 kural 3: *"Nothing is deleted; corrections are compensating entries referencing the original."* Birebir uyumlu |
| N-3 | §36 zamanlayıcı "dönem başına bir kez" ↔ Finance tahakkuk davranışı | **Çakışma yok.** Finance 8.3: *"one committed run per estate per period, enforced by unique constraint."* `IsCalistirma UNIQUE (is, tenant, dönem_anahtarı)` ile aynı desendir. Ayrıca `preview → commit` §36 kural 6'nın dry-run gereksinimini karşılar |
| N-4 | §35 boşluksuz numaralandırma ↔ Finance makbuz numaralandırması | **Çakışma yok.** Finance 8.3: *"Receipt: series + number unique"* ve 6.2: *"gapless per estate per year"*, iptalin numarayı yeniden kullanmaması. §35'in `BOSLUKSUZ` tanımıyla uyumlu. Eksik olan merkezî motordur (Y-4), çakışma değil |
| N-5 | §24 Agent yetki sınırı ↔ AI Center yetki modeli | **Çakışma yok.** AI Center 6.5: *"The AI holds no independent identity or elevated access. Every retrieval executes as the requesting user. There is no service account with broader reach."* §39'un birleştirmeye çalıştığı Principal deseninin doğru uygulanmış hâli |
| N-6 | §38 sonuç sayısı sızıntısı ↔ Dashboard yetkilendirme davranışı | **Çakışma yok.** Dashboard 8.2: kapsam dışı `scopeId` için `403`, *"never an empty 200 — silent filtering hides authorisation bugs."* §38 kural 1 ile aynı akıl yürütme |
| N-7 | §3 işletme defteri ↔ Finance çok para birimi modeli | **Çakışma yok.** ADR çok para birimini yasaklamaz. `Money = {amount, currency, fxRate, functionalAmount}` modeli doğrudur ve sonradan düzeltilemeyecek iki kusuru (float para, skaler para birimi) önler. v1'de kur yönetimi yüzeyinin kapatılması bir **kapsam kararıdır**, çakışma değil (O-6) |
| N-8 | §40 "genel Tesis → Birim hiyerarşisi v1'de kurulmaz" ↔ çok dikeyli mimari hedefi | **Çakışma yok.** §40 bunu açıkça reddeder ve yerine paket sınırı disiplinini koyar. Genel soyutlamanın yokluğu bir eksiklik değil, **karardır** |
| N-9 | §32 CQRS ↔ §31 Event Sourcing yok | **Çakışma yok.** CQRS ve Event Sourcing bağımsız desenlerdir. §32 zaten *"v1'de ayrım servis düzeyindedir, veritabanı düzeyinde değil"* diyerek sınırı çizer |
| N-10 | v0.1'in beş açık sorusu ↔ mevcut spec'lerin davranışı | **Çakışma yok.** Beş sorunun tamamı v1.0'da kapatılmıştır (v1.1 Bölüm D: açık madde 20 → 6). Bunları çakışma saymak v0.1'i güncel sanmaktan kaynaklanan bir hataydı ve geri çekilmiştir |

---

## 3. Yükseltilmiş çakışma — ADR'ye yeni madde önerisi gerektiren

### Y-Ç-1 · Veri Aktarım Merkezi ADR'de hiç geçmiyor

| | |
|---|---|
| **Durum** | Kullanıcı gereksinimlerinde ayrıntılı olarak tanımlanmış (Excel/CSV/PDF/Word/XML/JSON/SQL/TXT içe aktarım · OCR · kolon eşleştirme · veri temizleme · yinelenen kayıt kontrolü · doğrulama · önizleme · hata raporu · **rollback**) ancak ADR'nin hiçbir maddesinde yer almıyor |
| **Neden çakışma değil, boşluk** | ADR bunu yasaklamıyor; hiç ele almıyor. Ancak birkaç kilitli maddeyle **gerilim üretir:** §33 (rollback ↔ finansal kayıt asla silinmez), §35 (toplu içe aktarımda boşluksuz seri tahsisi), §2 (içe aktarımın tenant sınırını nasıl koruduğu), §31 (içe aktarımın hangi event'leri ürettiği) |
| **Öneri** | ADR'ye yeni bir madde olarak yükseltilmeli — §41 uyarınca artık ADR'ye yalnızca karar kaydı yazılacağı için, karar alınıp DMS ve BFS'e işlenmelidir. Özellikle **içe aktarım rollback'inin finansal kayıtlarda nasıl davrandığı** açıkça kararlaştırılmalıdır; aksi halde ilk uygulamada §33 sessizce delinir |
| **Aciliyet** | Orta. Ancak karar Sprint 3 (Finance) öncesinde alınmalıdır |
| **Backlog** | O-8 |

---

## 4. Çakışma özeti — Faz 0 sonrası

| # | Çakışma | Sonuç | Karar kaydı |
|---|---|---|---|
| Ç-1 | Muhasebe derinliği | ✅ çözüldü — **çift taraflı muhasebe** (§3 değiştirildi) | ADR-0003 |
| Ç-2 | Tenant sınırı ve kapsam | ✅ çözüldü — tenant = apartman, portföy çıkarıldı | ADR-0002 |
| Ç-3 | AI çalışma sırası | ✅ çözüldü — Memory → KG → BRE → Agent → LLM | ADR-0004 |
| Ç-4 | Finansal veri ve önbellek | ✅ çözüldü — finansal özet önbeklenmez | ADR-0005 |
| Ç-5 | Anlamsal arama sahipliği | ✅ çözüldü — iki port, tek kayıt kaynağı | ADR-0004 |
| Ç-6 | Command yanıt sözleşmesi | ✅ çözüldü — `{id, status}` | BFS v1 §6.3 |
| Ç-7 | Sürüm planı | ✅ çözüldü — roadmap tarihsel | — |
| Ç-8 | Ürün dikeyi | ✅ çözüldü — taşınır / uyarlanır / saklanır | ADR-0002 |
| Y-Ç-1 | Veri Aktarım Merkezi (boşluk) | ⏳ karar bekliyor — Sprint 3 öncesi | — |

**Aktif çakışma: 0.** Sekizinin yedisinde ADR kazandı; Ç-1'de ürün sahibi ADR §3'ü açıkça değiştirdi ve karar ADR-0003 olarak kayda geçti. Bu, "sessizce ADR aleyhine çözme" değil, usulüne uygun bir karar değişikliğidir — aradaki fark, bu kaydın varlığıdır.

---

## 5. Bu kaydın kullanımı

1. Bir geliştirici mevcut bir spec veya prototipte bu belgede kayıtlı bir davranışla karşılaştığında, **ADR tarafını uygular** ve tartışmaz.
2. Yeni bir çakışma bulunduğunda bu belgeye eklenir; sohbette veya PR yorumunda çözülmez.
3. Bir çakışmanın çözümü kod yerine ADR değişikliği gerektiriyorsa §3'teki gibi **yükseltilir** — sessizce ADR'nin aleyhine çözülmez.
4. §41 uyarınca çözülen her çakışmanın *ne olduğu* ilgili belgeye (CONSTITUTION / BFS / DMS / AIS) yazılır; bu kayıt yalnızca *neden* öyle çözüldüğünü tutar.

---

*İlgili belgeler:* `02-ADR-UYUM-RAPORU.md` · `03-EKSIKLER-BACKLOG.md` · `../BASELINE.md` · `../IMPLEMENTATION-ROADMAP.md`
