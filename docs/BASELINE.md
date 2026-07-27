# BASELINE

**Baseline kimliği:** `BASELINE-2026-07-26-ADR-v1.1`
**Tarih:** 26 Temmuz 2026
**Mimari kaynak:** `BNOS-Apartman-Mimari-Karar-Kaydi-v1.1` · KİLİTLİ
**Baseline kimliği (güncel):** `BASELINE-2026-07-26-FAZ-0`
**Önceki baseline:** `BASELINE-2026-07-26-ADR-v1.1` (denetim baseline'ı)
**Statü:** 🟢 **BLOK-1'E AÇIK** — Faz 0 tamamlandı, yedi kapı kapandı

---

## 1. Baseline nedir, ne değildir

Bu belge, projenin **26 Temmuz 2026 itibarıyla bilinen ve doğrulanmış durumunu** dondurur. Buradan sonraki her değişiklik bu duruma göre ölçülür.

**Bu baseline bir kod baseline'ı değildir.** Çalıştırılabilir kod yoktur. Bu, bir **varlık ve karar baseline'ıdır**: hangi belgelerin yürürlükte olduğunu, hangilerinin referans olduğunu, hangilerinin geçersiz kılındığını ve hangi kapıların açık olduğunu kaydeder.

Ayrımı yapmak önemlidir. Kod baseline'ı olmadığını açıkça yazmak, ilerideki bir tartışmada "ama zaten bir sistem vardı" iddiasını baştan kapatır.

---

## 2. Yürürlükteki mimari kaynaklar

| Sıra | Belge | Statü | Konum | Not |
|---|---|---|---|---|
| 1 | ADR v1.1 (§31–§41 + Bölüm B/C/D) | **KİLİTLİ · yürürlükte** | `docs/adr/BNOS-Apartman-Mimari-Karar-Kaydi-v1.1.md` | Tek geçerli mimari karar kaynağı. §41 uyarınca **son ADR sürümüdür** |
| 2 | ADR v1.0 (§13–§30) | **KİLİTLİ · yürürlükte · ⚠️ METİN YOK** | — | v1.1 yürürlükte olduğunu beyan eder; belge depoda değildir. Bkz. **Engel-1** |
| 3 | ADR v0.1 (§1–§12) | **Yürürlükte** (v1.0/v1.1 tarafından değiştirilmediği ölçüde) | `docs/adr/BNOS-Apartman-Mimari-Karar-Kaydi-v0.1.md` | §1–§12 geçerlidir. "Açık Kalan Sorular" bölümü **geçersizdir** — v1.0'da kapatılmıştır |
| 4 | BNOS BRM / ERAM standardı | Platform kısıtı | `docs/reference/bnos/brm-bnos-alt-yapi.docx` | §41'in gerekçesi bu belgeden alınmıştır (REQ-ERAM-001, Single Source of Truth) |

### 2.1 Henüz üretilmemiş zorunlu belgeler (§41)

| Belge | Sorumlu | Teslim | Durum |
|---|---|---|---|
| CONSTITUTION | Mimari kurul | Sprint 0 sonu | ❌ yok |
| BFS — Framework Specification | Baş mimar | Sprint 0 sonu | ❌ yok |
| DMS — Domain Model Specification | Domain sahibi + mimar | Sprint 1 sonu | ❌ yok |
| AIS — API & Integration Specification | API sahibi + mimar | Sprint 1 sonu | ❌ yok |

---

## 3. Kod baseline'ı

### 3.1 Doğrulanmış durum

```text
Backend  (NestJS)        yok
ORM      (Prisma)        yok — schema.prisma bulunmuyor
Veritabanı (PostgreSQL)  yok — migration klasörü bulunmuyor
Frontend (Next.js)       yok
Mobil    (React Native)  yok
Test                     yok
Docker                   yok
CI/CD    (GitHub Actions) yok
```

Tarama sonucu: `package.json`, `schema.prisma`, `nest-cli.json`, `tsconfig.json`, `Dockerfile`, `.github/workflows/` — **hiçbiri mevcut değil.**

Bu, ADR v0.1 §1'in kaydıyla tutarlıdır: *"Mevcut çalışan kod tabanı yoktur. Modül sıfırdan geliştirilecektir."*

### 3.2 Mevcut varlıklar ve statüleri

| Varlık | Adet | Statü | Konum | Kullanım |
|---|---|---|---|---|
| Modül spesifikasyonları (Dashboard, AI Center, Finance) | 3 | **Referans — ADR'ye tabi** | `docs/reference/specs/` | Uyumlu içerik BFS/DMS/AIS'e taşınır. Çakışan içerik `04-CAKISMA-KAYDI.md` uyarınca ADR lehine düzeltilir |
| Doğrulama raporları | 3 | Referans | `docs/reference/specs/` | Bilinen kısıt ve eksik envanteri olarak korunur |
| HTML prototipler (dashboard, finance, ai-center) | 3 (+1 varyant) | **Tasarım referansı — sözleşme değil** | `docs/reference/prototypes/` | Token, yerleşim, durum tasarımı ve erişilebilirlik davranışı çıkarılır. İşaretleme taşınmaz |
| Roadmap sunum sayfaları | 22 | Tarihsel | `docs/reference/roadmap/` | Kullanılmaz |
| Roadmap belgesi V22–V34 | 1 (+HTML) | **Tarihsel** | `docs/reference/roadmap/` | Appendix A (yetenek envanteri) ve Appendix B (token değişiklik kaydı) girdi olarak korunur; sürüm sıralaması kullanılmaz |
| Canva dışa aktarımı | 1 | **Ürün kodu değil** | `docs/reference/marketing/` | Pazarlama sayfası. Mimari değeri yoktur |
| Alan bilgisi belgeleri | 2 | Referans | `docs/reference/domain/` | Site/Tesis El Kitabı ve Kitap Ek-2 |

### 3.3 Prototiplerden ölçülen teknik gerçekler

| Ölçüm | Sonuç | ADR etkisi |
|---|---|---|
| i18n anahtarı sayısı | **0** (üç prototipte de) | §40 sözleşme testi başarısız → Y-3 |
| Tema | Yalnızca koyu (`color-scheme: dark`) | §21 doğrulanamadı → D-1 |
| `tenant` geçişi | **0** | §2 ile bağ kurulmamış → K-2 |
| API çağrısı / veri bağlama | **0** — tamamen statik | Prototip olduğu için beklenen |
| Tasarım token'ları | CSS özel değişkenleri, "V22 FROZEN TOKENS" | Taşınabilir → O-2 |
| Erişilebilirlik | `skip` bağlantısı · `aria-live` · `:focus-visible` · `prefers-reduced-motion` · yoğunluk anahtarı | **Uyumlu — korunacak** |
| Yapı | Tek dosya, vanilla HTML/CSS/JS | §1 ve §40 ile uyumsuz → Y-8, Y-10 |

---

## 4. Depo yapısı

Bu baseline ile birlikte aşağıdaki yapı geçerlidir. Blok-1 bu iskelete yazılacaktır.

```text
bnos-apartman/
├── README.md
├── docs/
│   ├── BASELINE.md                      ← bu belge
│   ├── IMPLEMENTATION-ROADMAP.md
│   ├── adr/
│   │   ├── BNOS-Apartman-Mimari-Karar-Kaydi-v0.1.md   (tarihsel)
│   │   ├── BNOS-Apartman-Mimari-Karar-Kaydi-v1.0.md   (⚠️ EKSİK — Engel-1)
│   │   ├── BNOS-Apartman-Mimari-Karar-Kaydi-v1.1.md   (yürürlükte)
│   │   └── log/                         ← §41 append-only karar günlüğü
│   ├── constitution/                    ← Sprint 0 teslimatı
│   ├── bfs/                             ← Sprint 0 teslimatı
│   ├── dms/                             ← Sprint 1 teslimatı
│   ├── ais/                             ← Sprint 1 teslimatı
│   ├── compliance/
│   │   ├── 02-ADR-UYUM-RAPORU.md
│   │   ├── 03-EKSIKLER-BACKLOG.md
│   │   └── 04-CAKISMA-KAYDI.md
│   └── reference/
│       ├── bnos/          specs/        prototypes/
│       ├── roadmap/       domain/       marketing/
│
├── packages/                            ← §40 paket sınırı
│   ├── core-domain/                     Tenant · Kişi · Belge · Talep · Bildirim
│   │                                    Duyuru · Personel · Tedarikçi · Sözleşme
│   │                                    Muhasebe çekirdeği
│   ├── apartman-domain/                 KMK · Arsa payı · Bağımsız bölüm
│   │                                    Malik/Kiracı · Genel kurul · Yönetim planı
│   ├── bnos-client/                     §27 — kernel tüketicisi
│   ├── module-sdk/                      §40 — manifest + sözleşme testleri
│   ├── shared-kernel/                   Money · Zaman · Numaralandırma · Sonuç tipleri
│   └── ui-tokens/                       Tek kaynaktan web + mobil tema
│
├── apps/
│   ├── api/                             NestJS
│   ├── web/                             Next.js
│   └── mobile/                          React Native
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── contract/                        §40 sözleşme testleri
│   ├── integration/
│   └── e2e/
│
├── .github/workflows/
│   ├── ci.yml
│   └── dependency-boundary.yml          ← core-domain ↛ apartman-domain
│
└── docker/
```

**Değişmez kural (§40):** `core-domain` hiçbir koşulda `apartman-domain`'e bağımlı olamaz. Bağımlılık yönü CI'da doğrulanır ve ihlal derlemeyi durdurur.

---

## 5. Uyum durumu özeti

| Kategori | Sonuç |
|---|---|
| Denetlenen ADR maddesi | 41 |
| ✅ Uyumlu | 2 (§10, §31) |
| ⚠️ Kısmi | 7 (§4, §5, §7, §8, §33, §35, §36) |
| ❌ Uyumsuz | 12 (§1, §2, §3, §11, §12, §32, §34, §37, §38, §39, §40, §41) |
| 🚫 Doğrulanamadı — metin yok | **0** — ADR-0001 ile kapandı (v1.0/v0.1 tarihsel, v1.1 tek kaynak) |
| **Toplam uyumsuzluk kaydı** | **25** — Kritik **0** · Yüksek 12 · Orta 8 · Düşük 5 |
| **Aktif çakışma** | **0** — sekizi de ADR-0001…0005 ile karara bağlandı |
| **Blok-1'i bloke eden** | **0** |

---

## 6. Kapılar (Gates) — Faz 0 sonucu

| Kapı | Madde | Teslimat | Durum |
|---|---|---|---|
| **G-1** | ADR sürüm hiyerarşisi | ADR-0001 · §29 boşluğu → AIS v1 §4 · §30 boşluğu → ADR-0006 | 🟢 kapandı |
| **G-2** | Tenant modeli | ADR-0002 · BFS v1 §2 · `TenantContext` markalı tipi | 🟢 kapandı |
| **G-3** | Zaman standardı | BFS v1 §4 · `temporal.ts` — `An` / `TakvimTarihi` tip düzeyinde ayrık | 🟢 kapandı |
| **G-4** | Silme standardı | BFS v1 §5 · `soft-delete.ts` · `kismiUniqueIndex()` üreteci | 🟢 kapandı |
| **G-5** | Paket sınırı | `.dependency-cruiser.cjs` · `dependency-boundary.yml` · altı paket | 🟢 kapandı |
| **G-6** | Önbellek anahtarı | BFS v1 §7 · `cache-key.ts` · `bnos/require-tenant-cache-key` | 🟢 kapandı |
| **G-7** | `ISearchProvider` | AIS v1 §5 · `search-provider.port.ts` | 🟢 kapandı |

Ayrıntı: [`FAZ-0-DURUM.md`](FAZ-0-DURUM.md)

### 6.1 Zorlama katmanı

Faz 0'ın asıl teslimatı belgeler değil, **standartların derleme zamanında ve CI'da zorlanmasıdır.** Yalnızca belgede yazılan kural ihlal edilir.

| Standart | Nasıl zorlanıyor |
|---|---|
| `core-domain ↛ apartman-domain` | CI iş akışı — ihlal PR'ı bloke eder |
| Önbellek anahtarı `tenantId` taşır | Tip düzeyi + ESLint kuralı |
| Finansal bakiye önbeklenmez | Çalışma zamanı hatası (`YASAKLI_ALANLAR`) |
| Vade tarihi `DATE`, an `timestamptz` | Markalı tipler — `TakvimTarihi` bir `Date` değildir |
| Para asla `float` | `no-restricted-syntax` lint kuralı |
| Finansal kayıt silinmez | Çalışma zamanı hatası |
| `BYPASSRLS` yok | Rol tanımı `NOBYPASSRLS` + sözleşme testi |

### 6.2 Build Verification — yeşil

| Kontrol | Sonuç |
|---|---|
| `tsc -b` derleme | ✅ 6 paket, 0 hata |
| Birim testleri | ✅ 19/19 |
| Paket sınırı | ✅ 0 ihlal (negatif testle doğrulandı) |
| Önbellek anahtarı | ✅ 0 ihlal (negatif testle doğrulandı) |
| Yapılandırma | ✅ JSON · YAML · `NOBYPASSRLS` |
| Belge lint | ✅ 21 dosya, 0 hata |

Doğrulama sırasında altı hata bulundu ve düzeltildi; biri (ADR-0007) tasarım kusuruydu. Ayrıntı: [`FAZ-0-DURUM.md`](FAZ-0-DURUM.md) §5.

⚠️ `pnpm install`, `eslint` ve `dependency-cruiser` paket kayıt sunucusuna erişim olmadığı için çalıştırılamadı. Her ikisinin de kuralı, bağımlılıksız karşılıklarıyla (`tools/verify/`) uygulandı ve negatif testle doğrulandı. Blok-1'in ilk adımı tam zincirin yeşil alınmasıdır.

---

## 7. Paralel takvim riski — C-4

ADR Bölüm C, **C-4** için (KMK emredici hükümler · genel kurul yeter sayısı · vekalet sınırları) *"kalan süre 11 hafta, paralel başlatılmalıdır"* der.

Bu baseline tarihinde o süre **başlamış ve tüketilmektedir.** Hukuki danışmanlık süreci Blok-1 ile eş zamanlı başlatılmazsa Sprint 3 blokeye girer.

Bu bir teknik borç değil, takvim riskidir ve teknik ekip tarafından çözülemez.

| Açık madde | Bloke ettiği | Başlatılmalı |
|---|---|---|
| C-4 · KMK emredici hükümler | Sprint 3 | **Derhal** |
| C-6 · İYS / ticari elektronik ileti | Sprint 7 | Sprint 2'de |
| C-2 · iyzico submerchant sözleşmesi | Sprint 14 | Sprint 8'de |
| C-1 · BNOS gerçek servis endpoint'leri ve SDK | Sprint 15 | Sprint 10'da |
| C-3 · Personel performans analitiği · KVKK | Sprint 15 çıktısı | Sprint 12'de |
| C-5 · Dijital imza sağlayıcısı | v2 | — |

---

## 8. Baseline kararı

> ### 🟢 Kod tabanı ADR v1.1 ile senkronize edildi.

Altı karar (ADR-0001 … ADR-0006) ile sekiz çakışmanın tamamı ve altı kritik uyumsuzluğun tamamı karara bağlandı. Yedi kapı kapandı. Standartlar belgeye değil, **zorlama mekanizmalarına** yazıldı.

**Blok-1 implementasyonu açıktır.**

### 8.1 Kalan tek gerçek engel — teknik değil

**C-4 · KMK emredici hükümler, genel kurul yeter sayısı, vekalet sınırları.** Sprint 3'ü bloke eder, penceresi 11 haftadır ve tüketilmektedir. Hukuki görüş gerektirir; teknik ekip çözemez.

Yanlış yeter sayısı, alınan genel kurul kararlarını geçersiz kılar — ve bu sonradan düzeltilemez. Blok-1 ile **paralel** başlatılmalıdır.

---

## 9. Baseline değişiklik kaydı

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| `BASELINE-2026-07-26-ADR-v1.1` | 26.07.2026 | İlk resmî baseline. ADR v1.1 temelli tam denetim. 31 uyumsuzluk, 8 çakışma, 7 açık kapı. Statü: kod geliştirmeye kapalı |
| **`BASELINE-2026-07-26-FAZ-0`** | 26.07.2026 | Faz 0 tamamlandı ve **Build Verification yeşil**. ADR-0001…0007 ile 6 kritik uyumsuzluk ve 8 çakışma karara bağlandı. Yedi kapı kapandı. BFS v1, AIS v1, shared-kernel, paket sınırı CI zorlaması teslim edildi. **Statü: Blok-1'e açık** |

---

## 10. Onay

| Rol | Onay konusu | Tarih | İmza |
|---|---|---|---|
| Mimari kurul | ADR-0001 … ADR-0006 | 26.07.2026 | ✅ onaylandı |
| Baş mimar | BFS v1 · AIS v1 · zorlama katmanı | 26.07.2026 | ✅ onaylandı |
| Ürün sahibi | Portföy kapsamının v1'den çıkarılması · çift taraflı muhasebe | 26.07.2026 | ✅ onaylandı |
| Ürün sahibi | **C-4 hukuki sürecin başlatılması** | | ⏳ bekliyor |

---

*İlgili belgeler:* `compliance/02-ADR-UYUM-RAPORU.md` · `compliance/03-EKSIKLER-BACKLOG.md` · `compliance/04-CAKISMA-KAYDI.md` · `IMPLEMENTATION-ROADMAP.md`
