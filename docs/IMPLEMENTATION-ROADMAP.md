# IMPLEMENTATION ROADMAP

**Mimari kaynak:** `BNOS-Apartman-Mimari-Karar-Kaydi-v1.1` · KİLİTLİ
**Baseline:** `BASELINE-2026-07-26-ADR-v1.1`
**Tarih:** 26 Temmuz 2026
**Toplam plan:** 46 hafta + 2,5 hafta engel kaldırma = **48,5 hafta**
**MVP:** Sprint 6 sonu — 21 hafta (engel kaldırma sonrası)

---

## 1. Bu belgenin işlevi

ADR v1.1 Bölüm B sprint planını verir ancak sprint içeriklerini değil. Bu belge iki boşluğu doldurur:

1. **Faz 0 — Engel kaldırma.** ADR planında olmayan, `BASELINE.md` §6'daki yedi kapının kapatılması. Blok-1'den önce gelir.
2. **Sprint içerikleri.** Her sprint'in teslimatı, DoD'u ve hangi backlog kayıtlarını kapattığı.

ADR planı üstündür. Bu belge onu uygular, değiştirmez.

---

## 2. Faz haritası

```text
FAZ 0  · Engel kaldırma           2,5 hafta   🔴 ŞU ANDA BURADAYIZ
FAZ 1  · Sprint 0 — Altyapı        4 hafta     (BLOK-1 burada)
FAZ 2  · Sprint 1 — Çekirdek       4 hafta
FAZ 3  · Sprint 2–6 — MVP         13 hafta
FAZ 4  · Sprint 7–16 — Tam ürün   25 hafta
                                  ─────────
                                  48,5 hafta
```

---

## 3. FAZ 0 — Engel kaldırma (2,5 hafta)

**Amaç:** `BASELINE.md` §6'daki yedi kapıyı kapatmak. Kod yazılmaz; kararlar alınır ve standartlar yazılır.

**Çıkış ölçütü:** Yedi kapı da 🟢. `BASELINE.md` güncellenir ve "Kod tabanı ADR v1.1 ile senkronize edildi" ifadesi yazılabilir hale gelir.

| Kapı | İş | Teslimat | Efor | Bağımlılık |
|---|---|---|---|---|
| **G-1** | ADR v1.0 belgesinin sağlanması | `docs/adr/...-v1.0.md` · §13–§30 çapraz referans doğrulaması | 0,5 g* | **Mimari kurul — dış bağımlılık** |
| **G-2** | Tenant modeli kararı | Karar kaydı: `estateId → tenant_id` · portföy kapsamı v1'den çıkarıldı · gelecekteki portföy çözümünün yolu yazıldı | 3,5 g | G-1 (§30 üç kapı için) |
| **G-3** | Zaman standardı tip haritası | BFS taslak bölümü: hangi alan `DATE`, hangisi `timestamptz` · `Tenant.saat_dilimi` alanı | 1,5 g | — |
| **G-4** | Silme standardı temel kuralları | Dört soft delete alanı · kısmi unique index migration şablonu · Prisma extension tasarımı | 2 g | G-3 |
| **G-5** | Paket sınırı | `packages/` iskeleti · `dependency-cruiser` yapılandırması · CI iş akışı | 2 g | — |
| **G-6** | Önbellek anahtar sözleşmesi | `t:{tenantId}:{alan}:{kimlik}:{sürüm}` · `@bnos/cache` arayüz tasarımı · ESLint kuralı | 1,5 g | G-2 |
| **G-7** | `ISearchProvider` port tanımı | Port arayüzü · v1 adaptör sınırı (PostgreSQL FTS) · Enterprise Memory ile sınır ayrımı | 1,5 g | G-1 (§38 zaten v1.1'de) |

**Toplam: 12,5 gün.**

**Paralel başlatılacak (teknik ekip dışı):**

- **C-4 hukuki danışmanlık** — KMK emredici hükümler, genel kurul yeter sayısı, vekalet sınırları. Sprint 3'ü bloke eder, kalan süre 11 hafta. **Derhal başlatılmalıdır.**
- **O-1 kapsam kararı** — Site varlıklarının hangisinin taşınacağı, uyarlanacağı, saklanacağı (2 gün, ürün sahibi).

*\* G-1 belge mevcutsa. Değilse 5–8 gün ve Faz 0 süresi 4 haftaya çıkar.*

---

## 4. FAZ 1 — Sprint 0 · Altyapı (4 hafta)

ADR v1.1 Bölüm B'nin Sprint 0 tanımını uygular. **Blok-1 bu sprint'in ilk yarısıdır.**

### 4.1 BLOK-1 — Multi-Tenant + PostgreSQL RLS + Migration Altyapısı (2 hafta)

Faz 0 kapandıktan sonra başlayacak ilk implementasyon bloğudur. İçeriği aşağıdadır; **kod bu belge onaylanana kadar yazılmayacaktır.**

**B1.1 · Depo ve araç zinciri (2 gün)**
Monorepo (pnpm workspace veya Nx) · TypeScript sıkı mod · ESLint + Prettier · Husky + lint-staged · `packages/` sınırları (G-5'ten devralınır) · Docker Compose (PostgreSQL 16 + Redis 7) · GitHub Actions temel CI.

**B1.2 · Prisma şema temeli ve `Tenant` aggregate'i (2 gün)**
`Tenant` (kod, ad, tip `APARTMAN`, `saat_dilimi`, durum, lisans) · her tabloda `tenant_id` · G-3'ten gelen tarih tip haritasının uygulanması · G-4'ten gelen dört soft delete alanının temel modele işlenmesi.

**B1.3 · PostgreSQL RLS (3 gün)**
Her tenant-kapsamlı tabloda `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` · `SELECT/INSERT/UPDATE/DELETE` politikaları `current_setting('app.tenant_id')` üzerinden · uygulama rolünün `BYPASSRLS` yetkisi **olmaması** · migration şablonuna RLS bloğunun zorunlu hale getirilmesi.

**B1.4 · Tenant bağlamı ve Prisma Client Extension (2 gün)**
`AsyncLocalStorage` tabanlı `TenantContext` · her transaction başında `SET LOCAL app.tenant_id` · Prisma extension ile merkezî enjeksiyon · aynı extension'da soft delete varsayılan filtresi (§33 kural 2) · bağlam yoksa sorgunun **hata vermesi**, sessizce geçmemesi.

**B1.5 · Migration altyapısı (2 gün)**
Prisma Migrate iş akışı · migration şablonu (RLS bloğu + kısmi unique index kuralı gömülü) · geri alma politikası · CI'da şema sürüklenmesi (drift) kontrolü · tohum (seed) verisi.

**B1.6 · Tenant izolasyon test paketi (2 gün)**
İki tenant, çapraz okuma denemesi — **her tablo için.** §40 sözleşme testinin ilk maddesi: *"Tenant izolasyonu (RLS altında çapraz okuma reddedilir)."* Test üreteci yazılır ki her yeni tablo otomatik kapsanılsın. Bağlamsız sorgu testi. `BYPASSRLS` yetkisi olmadığının testi.

**B1.7 · Önbellek anahtar sarmalayıcısı (1 gün)**
G-6'dan gelen sözleşmenin uygulanması. `tenantId` olmadan çağrı derlenmez. ESLint kuralının etkinleştirilmesi.

**Blok-1 çıkış ölçütü**

```text
· İki tenant oluşturuluyor; hiçbiri diğerinin tek satırını okuyamıyor — test kanıtlı
· Tenant bağlamı olmadan yapılan sorgu hata veriyor
· Uygulama veritabanı rolünün BYPASSRLS yetkisi yok
· Migration şablonu RLS ve kısmi index kurallarını zorluyor
· Soft delete varsayılan filtresi merkezî; elle where eklenmiyor
· Tüm tarih kolonları G-3 haritasına uygun tiplenmiş
· Önbellek anahtarı tenantId olmadan derlenmiyor
· core-domain → apartman-domain bağımlılığı CI'da reddediliyor
```

### 4.2 Sprint 0'ın kalan içeriği (2 hafta)

| İş | ADR | Backlog | Efor |
|---|---|---|---|
| Event politikası + Outbox tablosu ve yayıncısı | §31, §29 | Y-1 | 3 g |
| CQRS iskeleti + kod üreteci | §32 | Y-2 | 2 g |
| `IIoTGateway` port tanımı | §39 | O-4 | 1 g |
| Tasarım token'larının tek kaynağa alınması | §21, §1 | O-2 | 1,5 g |
| **CONSTITUTION (tam)** | §41 | Y-9 | 1 g |
| **BFS v1 (tam)** | §41 | Y-9 | 4 g |
| **Dikey dilim** — giriş → tenant → varlık oluşturma → tüm boru hattı | v1.1 Bölüm B | — | 3 g |

**Sprint 0 uyarısı (ADR'den):** Bu sprint 4 hafta saf altyapıdır ve kullanıcıya görünen tek bir özellik üretmez. Paydaş güveni açısından gerçek bir risktir. **Önlem:** sprint, çalışan bir dikey dilimle kapanır — küçük ama uçtan uca. Böylece altyapı yazılmış değil, **kanıtlanmış** olur.

---

## 5. FAZ 2 — Sprint 1 · Çekirdek (4 hafta)

| İş | ADR | Backlog | Efor |
|---|---|---|---|
| Numaralandırma motoru (`NumaraSerisi`) | §35 | Y-4 | 3 g |
| Zamanlayıcı motoru + dağıtık kilit (`IScheduler` / BullMQ) | §36 | Y-7 | 4 g |
| Birleşik `Principal` modeli (`INSAN\|AGENT\|PLUGIN\|CIHAZ\|SISTEM`) | §39 | O-5 | 2 g |
| `SilinebilirlikPolitikasi` motoru + anonimleştirme iskeleti | §33 | Y-6 | 2 g |
| Module SDK sözleşme testi paketi | §40 | Y-8 | 3 g |
| Kimlik, kullanıcı, rol, izin modeli + yetki matrisi | §30, §10 | — | 4 g |
| Türkçe–İngilizce domain sözlüğü | — | D-3 | 1 g |
| **DMS v1** (tenant, kişi, yetki matrisi) | §41 | Y-9 | 2 g |
| **AIS v1** (BNOS port'ları, event zarfı) | §41 | Y-9 | 1 g |

---

## 6. FAZ 3 — Sprint 2–6 · MVP (13 hafta)

| Sprint | Konu | Kapatılan backlog | Süre |
|---|---|---|---|
| **2** | Apartman kurulumu · bağımsız bölüm · malik/kiracı · yönetim planı · web ve **mobil iskelet** | Y-10, Y-3 | 3 hafta |
| **3** | Muhasebe çekirdeği · hesap planı · tahakkuk · borçlandırma · cari hesap | **K-3, K-5a, Y-11, Y-12, O-6** | 3 hafta |
| **4** | Tahsilat · makbuz · banka · kasa · işletme defteri · mali raporlar | — | 3 hafta |
| **5** | Talep yönetimi · mesajlaşma · bildirim · **AI Center akış düzeltmesi** | **K-4** | 2 hafta |
| **6** | Belge yönetimi · duyuru · dashboard · **MVP kapanışı** | — | 2 hafta |

**Sprint 3 uyarısı:** C-4 hukuki danışmanlığı bu sprint'ten önce tamamlanmalıdır. Tamamlanmazsa sprint blokedir.

**MVP tanımı (Sprint 6 sonu):** Bir apartman yöneticisi sisteme girer, apartmanı kurar, bağımsız bölümleri ve sakinleri tanımlar, aidat tahakkuku çalıştırır, tahsilat kaydeder, makbuz keser, işletme defterini ve mali raporu görür. Sakin mobil uygulamadan borcunu görür, talep açar, yöneticiyle mesajlaşır.

---

## 7. FAZ 4 — Sprint 7–16 · Tam ürün (25 hafta)

| Sprint | Konu | Kapatılan backlog |
|---|---|---|
| **7** | Genel kurul · karar defteri · elektronik bildirim | (C-6 gerekli) |
| **8** | Gider yönetimi · tedarikçi · sözleşme · onay akışı | — |
| **9** | Arama (`ISearchProvider` uygulaması, Türkçe FTS) · KVKK anonimleştirme · veri saklama | **K-6a, O-3, Y-6** |
| **10** | Veri Aktarım Merkezi · OCR · kolon eşleştirme · rollback | **O-8, Y-Ç-1** |
| **11** | Demirbaş · bakım · iş emri | — |
| **12** | Personel · bordro arayüzü | (C-3 gerekli) |
| **13** | Raporlama · dashboard genişletme · widget yöneticisi | — |
| **14** | Online ödeme · sanal POS · iyzico | (C-2 gerekli) |
| **15** | BNOS gerçek entegrasyonu · AI Agent'lar · Enterprise Memory / KG besleme | (C-1 gerekli) |
| **16** | Açık bankacılık · AI mutabakat · sertleştirme · üretim hazırlığı | — |

---

## 8. Her sprint için Definition of Done

ADR v1.1 Bölüm B'nin DoD listesi, mevcut DoD'a **eklenir**, yerini almaz.

```text
Mimari
· Command/Query ayrımı uygulandı (§32) — muafiyet varsa gerekçesi yazıldı
· Silme sınıfı belirlendi; soft delete varsa kısmi unique index kuruldu (§33)
· Tarih alanları DATE / timestamptz olarak doğru tiplendi (§34)
· Yeni numara serisi NumaraSerisi'ne kaydedildi; BOSLUKSUZ ise gerekçesi yazıldı (§35)
· Yeni zamanlanmış iş IsCalistirma unique kısıtıyla korundu (§36)
· Önbellek anahtarları tenantId taşıyor (§37)
· Aranabilir içerik ISearchProvider'a indekslendi; yetki filtresi sorgu içinde (§38)
· core-domain → apartman-domain bağımlılığı yok (§40)

Güvenlik ve uyum
· Tenant izolasyonu her yeni tablo için test edildi (§2, §40)
· Her mutasyon Audit Log'a yazıyor (§40)
· Her korumalı endpoint üç kapıdan geçiyor (§30)
· Yayınlanan her event standart zarfa uyuyor ve katalogda kayıtlı (§29, §31)
· Tüm kullanıcıya görünen metin i18n anahtarı (§40)

Kalite
· Build temiz · TypeScript hatası yok · linter temiz
· Birim + entegrasyon + sözleşme testleri geçiyor
· Web ve mobil aynı API'yi kullanıyor; platforma özgü iş mantığı yok

Belge
· Kararlar BFS/DMS/AIS'e işlendi; ADR'ye yalnızca karar kaydı yazıldı (§41)
```

---

## 9. Riskler

| # | Risk | Etki | Önlem |
|---|---|---|---|
| R-1 | **ADR v1.0 belgesi bulunamaz** | Faz 0 iki katına çıkar; §13–§30 yeniden karara bağlanır | Derhal aranmalı. Bulunamazsa mimari kurul toplantısı planlanmalı |
| R-2 | **C-4 hukuki süreci gecikir** | Sprint 3 bloke; MVP kayar | Faz 0 ile eş zamanlı başlat. 11 hafta tüketilmektedir |
| R-3 | **Sprint 0 paydaş güveni erozyonu** | 4 hafta görünür özellik yok | Dikey dilim ile kapat. Kanıt üret, rapor değil |
| R-4 | **RLS performans bedeli hafife alınır** | Portföy/toplu raporlarda yavaşlık | Ç-2 kaydındaki uyarı: bedel bilerek kabul edildi. Çözüm RLS'i delmek değil, indeksleme ve event ile bakımı yapılan özet tablolar |
| R-5 | **§32 CQRS ilk performans şikâyetinde delinir** | Yazma tarafı okuma şemasına bağımlı hale gelir | Ç-6 kaydındaki gerekçe kalıcıdır. Çözüm Command'e okuma modeli eklemek değil |
| R-6 | **§37 önbellek yasağı ilk performans krizinde delinir** | Bayat finansal rakam | Ç-4 kaydındaki ayrım BFS'e yazılmalı: özet tablo ≠ önbellek |
| R-7 | **Mobil geç başlar** | "İlk günden mobil" gereksinimi karşılanmaz | Sprint 2'de RN iskeleti zorunlu. Tek API, tek iş kuralı ilkesi DoD'da |
| R-8 | **Site varlıklarının yeniden kullanımı ya hepsi ya hiçbiri olarak ele alınır** | Ya değerli içerik atılır ya yanlış dikey taşınır | Ç-8'in üçlü ayrımı (taşınır / uyarlanır / saklanır) uygulanır |

---

## 10. Sonraki adım

> **Faz 0 · G-1'in kapatılması.**

ADR v1.0 belgesi depoya eklenmeden diğer altı kapının kapatılması eksik kalır — §29 ve §30 olmadan Blok-1'in dikey dilimi tanımlanamaz.

**Onay bekleyen kararlar:**

1. v1.0 belgesi mevcut mu? (G-1)
2. Portföy/grup kapsamının v1'den çıkarılması onaylanıyor mu? (G-2)
3. C-4 hukuki danışmanlık süreci başlatıldı mı?

Bu üç sorunun yanıtı alındığında Faz 0 başlar ve 2,5 hafta sonra Blok-1 implementasyonu açılır.

---

*İlgili belgeler:* `BASELINE.md` · `compliance/02-ADR-UYUM-RAPORU.md` · `compliance/03-EKSIKLER-BACKLOG.md` · `compliance/04-CAKISMA-KAYDI.md`
