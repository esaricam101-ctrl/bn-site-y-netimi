# FAZ 0 — DURUM RAPORU

**Tarih:** 26 Temmuz 2026
**Statü:** ✅ **TAMAMLANDI**
**Baseline:** `BASELINE-2026-07-26-ADR-v1.1` → güncellendi
**Sonraki adım:** Blok-1 · Multi-Tenant + PostgreSQL RLS + Migration Altyapısı

---

## 1. Alınan kararlar

Ürün sahibi ve mimari kurul tarafından beş karar verildi; hepsi ADR günlüğüne kaydedildi.

| Karar | Konu | Kapattığı çakışma / engel |
|---|---|---|
| [ADR-0001](adr/log/0001-adr-surum-hiyerarsisi.md) | ADR v1.1 tek geçerli kaynak; v1.0 ve v0.1 tarihsel | K-1 · 19 "doğrulanamadı" kaydı |
| [ADR-0002](adr/log/0002-tenant-modeli.md) | tenant = apartman; portfolio/group/site uygulanmaz | K-2 · Ç-2 |
| [ADR-0003](adr/log/0003-muhasebe-cift-tarafli.md) | Çift taraflı muhasebe mimarisi | K-3 · Ç-1 |
| [ADR-0004](adr/log/0004-ai-yurutme-sirasi.md) | Memory → KG → BRE → Agent → LLM | K-4 · K-6 · Ç-3 · Ç-5 |
| [ADR-0005](adr/log/0005-finansal-ozet-onbellek.md) | Finansal özetler önbelleklenmez | K-5 · Ç-4 |
| [ADR-0006](adr/log/0006-uc-kapi.md) | Üç kapı yeniden tanımlandı: Kimlik → Kiracı → İzin | ADR-0001'in ürettiği §30 boşluğu |
| [ADR-0007](adr/log/0007-para-tipi-bigint.md) | Para = ölçeklenmiş `bigint`, harici ondalık kütüphanesi yok | Build Verification'da bulunan API sızıntısı |

---

## 2. Kapanan kapılar

| Kapı | Durum | Teslimat |
|---|---|---|
| **G-1** · ADR sürüm hiyerarşisi | 🟢 | ADR-0001. §29 ve §30 boşlukları AIS v1 §4 ve ADR-0006 ile dolduruldu |
| **G-2** · Tenant modeli | 🟢 | ADR-0002 · BFS v1 §2 · `TenantContext` tipi |
| **G-3** · Zaman standardı | 🟢 | BFS v1 §4 · `temporal.ts` — `An` / `TakvimTarihi` tip düzeyinde ayrık |
| **G-4** · Silme standardı | 🟢 | BFS v1 §5 · `soft-delete.ts` · `kismiUniqueIndex()` üreteci |
| **G-5** · Paket sınırı | 🟢 | `.dependency-cruiser.cjs` · `dependency-boundary.yml` · altı paket iskeleti |
| **G-6** · Önbellek anahtarı | 🟢 | BFS v1 §7 · `cache-key.ts` · `bnos/require-tenant-cache-key` lint kuralı |
| **G-7** · `ISearchProvider` | 🟢 | AIS v1 §5 · `search-provider.port.ts` |

**Yedi kapının tamamı kapandı.**

---

## 3. Teslim edilen artefaktlar

### 3.1 Belgeler

```text
docs/adr/log/0001 … 0006          Altı karar kaydı (append-only)
docs/bfs/BFS-v1.md                Teknik standartlar — 16 bölüm
docs/ais/AIS-v1.md                Port ve entegrasyon sözleşmeleri — 10 bölüm
```

### 3.2 Zorlama mekanizmaları

Standartların belgede kalmaması için üç katmanda zorlama kuruldu.

| Standart | Zorlama | Nerede |
|---|---|---|
| Paket sınırı (§40) | CI iş akışı — ihlal PR'ı bloke eder | `.github/workflows/dependency-boundary.yml` |
| Önbellek anahtarı (§37) | Tip düzeyi + ESLint kuralı | `cache-key.ts` · `tools/eslint-rules/` |
| Finansal önbellek yasağı | Çalışma zamanı hatası — yasaklı alan listesi | `cache-key.ts` `YASAKLI_ALANLAR` |
| Zaman ayrımı (§34) | Markalı tipler — `TakvimTarihi` bir `Date` değildir | `temporal.ts` |
| Tenant kimliği (§2) | Markalı tip — ham string geçemez | `tenant-context.ts` |
| Para float yasağı (§11) | `no-restricted-syntax` lint kuralı | `eslint.config.js` |
| Finansal kayıt silinmezliği (§33) | Çalışma zamanı hatası | `soft-delete.ts` |
| `BYPASSRLS` yasağı (§2) | Rol tanımı `NOBYPASSRLS` + sözleşme testi | `docker/init/01-roles.sql` |

**Tasarım ilkesi:** Bir standart yalnızca belgede yazılıysa ihlal edilir. Derleme zamanında ya da CI'da zorlanmayan kural, kural değil temennidir.

### 3.3 Altyapı

```text
package.json · pnpm-workspace.yaml · tsconfig.base.json
eslint.config.js · .dependency-cruiser.cjs
.github/workflows/ci.yml · dependency-boundary.yml
docker/docker-compose.yml · docker/init/01-roles.sql
packages/shared-kernel   (11 kaynak dosyası — dolu)
packages/core-domain · apartman-domain · bnos-client · module-sdk · ui-tokens  (iskelet)
```

---

## 4. Uygulamayı engelleyen kalan eksikler

Talimat gereği yalnızca **gerçekten engelleyenler** listelenmiştir.

### 4.1 Blok-1'i engelleyen

**Yok.** Build Verification yeşil; Blok-1 implementasyonu başlatılabilir.

### 4.2 Sonraki sprint'leri engelleyen — biri kritik

| # | Engel | Bloke ettiği | Neden teknik ekip çözemez |
|---|---|---|---|
| **E-1** | **C-4 · KMK emredici hükümler · genel kurul yeter sayısı · vekalet sınırları** | **Sprint 3** (11 hafta) | Hukuki görüş gerektirir. Yanlış yeter sayısı, alınan genel kurul kararlarını geçersiz kılar; sonradan düzeltilemez |
| E-2 | C-6 · İYS / ticari elektronik ileti kapsamı | Sprint 7 | Mevzuat yorumu. Yanlış kapsam idari yaptırım üretir |
| E-3 | C-2 · iyzico submerchant sözleşmesi | Sprint 14 | Ticari sözleşme süreci |
| E-4 | C-1 · BNOS gerçek servis endpoint'leri ve SDK | Sprint 15 | Platform ekibi teslimatı |
| E-5 | C-3 · Personel performans analitiği · KVKK | Sprint 15 çıktısı | Hukuki görüş |

**E-1 dışındakiler zamanında başlatılırsa risk üretmez.** E-1'in penceresi şu anda tüketilmektedir ve Faz 0 ile paralel başlatılmalıydı.

### 4.3 Engel olmayan, implementasyon sırasında çözülecek

Talimat gereği bu maddeler rapor edilmiyor, backlog'da bekliyor: i18n taşıması, frontend/mobil taşıma, gider sınıflandırması üç eksen, borç sorumluluk zinciri, numaralandırma motoru, zamanlayıcı motoru, Türkçe FTS, Veri Aktarım Merkezi, tema, terminoloji sözlüğü.

Tümü `compliance/03-EKSIKLER-BACKLOG.md` içinde sprint'lere atanmıştır.

---

## 5. Build Verification

Faz 0, kontroller yeşil olmadan kapatılmadı. Aşağıdakiler **çalıştırıldı**, yazılmadı.

### 5.1 Çalıştırılan kontroller

```text
============================================================
FAZ 0 BUILD VERIFICATION
============================================================
  GECTI      TypeScript derleme (tsc -b)
  GECTI      Paket siniri (ADR v1.1 §40)
  GECTI      Onbellek anahtari (ADR-0005 · §37)
  GECTI      Yapilandirma tutarliligi
  GECTI      Birim testleri (node:test)
============================================================
Tum kontroller yesil.
```

| Kontrol | Araç | Sonuç |
|---|---|---|
| Derleme | `tsc -b` · TypeScript 6.0.3 | ✅ 6 shared paketi derlendi, `dist/` üretildi, 0 hata |
| Tip denetimi | `tsc --noEmit` | ✅ 11 kaynak dosyası, 0 hata |
| Birim testleri | `node --test` | ✅ **49/49 geçti** |
| Paket sınırı | `scripts/boundary.mjs` | ✅ 82 dosya, 3 kural, 0 ihlal |
| Önbellek anahtarı | `scripts/cache-key-scan.mjs` | ✅ 84 dosya, 0 ihlal |
| Yapılandırma | `scripts/config-check.mjs` | ✅ 20 JSON · 4 YAML · roller · path hedefleri |
| Belge lint | `markdownlint-cli2` | ✅ 22 dosya, 0 hata |

### 5.2 Negatif testler — denetleyicilerin gerçekten yakaladığı kanıtlandı

Yeşil bir kontrol, hiçbir şey kontrol etmiyorsa anlamsızdır. Her denetleyiciye kasıtlı ihlal enjekte edildi ve yakaladığı doğrulandıktan sonra geri alındı.

| Enjekte edilen ihlal | Denetleyici | Sonuç |
|---|---|---|
| `const hata: number = "string"` | `tsc` | ✅ TS2322 verdi |
| `core-domain` → `@bnos/apartman-domain` importu | `scripts/boundary.mjs` | ✅ exit 1, kural adı ve gerekçeyle |
| `redis.get('bakiye:daire-3')` | `cache-key-scan.mjs` | ✅ ADR-0005 ihlali olarak yakalandı |
| `redis.get('kullanici:izinler')` | `cache-key-scan.mjs` | ✅ `tenantId` eksikliği yakalandı |
| `NOBYPASSRLS` → `BYPASSRLS` | `config-check.mjs` | ✅ üç ayrı hata verdi |

### 5.3 Bulunan ve düzeltilen hatalar

| # | Hata | Nasıl bulundu | Düzeltme |
|---|---|---|---|
| 1 | `baseUrl` TypeScript 7.0'da kaldırılıyor (TS5101) | `tsc -b` | `paths` göreli hale getirildi, `baseUrl` kaldırıldı |
| 2 | `paths` göreli olmadan `baseUrl`siz çalışmıyor (TS5090) | `tsc -b` | Hedefler `./packages/...` biçimine çevrildi |
| 3 | **`decimal.js` `Money`'nin genel API'sine sızıyordu** | Kurulum başarısızlığı, ardından tasarım incelemesi | Ölçeklenmiş `bigint` — **ADR-0007** |
| 4 | `config-check.mjs` SQL yorumundaki `BYPASSRLS` kelimesini ihlal sanıyordu | Kendi doğrulayıcısı | Yorum satırları taramadan önce ayıklanıyor |
| 5 | `node --test` dizin argümanı kabul etmiyor | `verify.mjs` | Test dosyaları açıkça sayılıyor |
| 6 | 28 kod bloğunda dil belirtilmemiş, 6 liste ve 1 fence boşluksuz | `markdownlint-cli2` | Otomatik düzeltildi |
| 7 | Derlenmiş JS `@bnos/*` paketlerini çözemiyordu (workspace bağlantısı yok) | `node --test` | `scripts/link-workspace.mjs` — pnpm'in kurduğu bağlantıyı çevrimdışı kurar |

**Düzeltme 3, bu doğrulamanın asıl kazancıdır.** Kurulum hatası olarak başladı, tasarım kusuru olarak bitti: `shared-kernel` bağımlılık grafiğinin en altındaki pakettir ve `Money.tutar: Decimal` üçüncü taraf bir sınıfı her tüketicinin genel API'sine sızdırıyordu. Kütüphaneyi değiştirmek sistem çapında kırıcı değişiklik olurdu. Şimdi dış imza yalnızca `bigint` ve `string` içeriyor.

### 5.4 Çalıştırılamayan kontroller ve neden

| Kontrol | Neden | Telafi |
|---|---|---|
| `pnpm install` | Paket kayıt sunucusuna erişim yok (HTTP 403) | Çalışma zamanı bağımlılığı **sıfıra indirildi** (ADR-0007); `tsc` yerel kurulumdan çalıştırıldı |
| `eslint` | Kurulamadı | Aynı kuralın bağımlılıksız karşılığı yazıldı (`cache-key-scan.mjs`) ve **negatif testle doğrulandı.** ESLint kural modülü yüklenip şekli denetlendi |
| `dependency-cruiser` | Kurulamadı | Aynı kuralın bağımlılıksız karşılığı yazıldı (`boundary.mjs`) ve **negatif testle doğrulandı** |
| Entegrasyon / sözleşme testleri | PostgreSQL ve Redis konteynerleri başlatılamadı | Blok-1'in kapsamı; henüz veritabanı şeması yok |
| GitHub Actions | Yerelde çalıştırılamaz | YAML sözdizimi doğrulandı; iş akışları `pnpm verify` zinciriyle hizalandı |

**Kalıcı sonuç:** Bu telafiler geçici çözüm değil, kalıcı bir ikinci savunma katmanı oldu. `scripts/` betikleri CI'ın **ilk** işidir ve bağımlılık kurulumu başarısız olsa bile mimari kuralları doğrular. ESLint ve dependency-cruiser daha kesin analiz yapar ve asıl kaynaktır; ikisi birlikte çalışır.

### 5.5 Blok-1'in ilk adımı

Ağ erişimi olan ortamda ilk iş: `pnpm install` → `pnpm lint` → `pnpm test` yeşil alınması. Beklenen sapma düşüktür (çalışma zamanı bağımlılığı yok, geliştirme bağımlılıkları standart), ancak **doğrulanmadan Blok-1 kodu yazılmayacaktır.**

---

## 6. Blok-1 kapsamı

Faz 0 kapandığına göre Blok-1 aşağıdaki sırayla yazılacaktır.

| # | İş | Süre |
|---|---|---|
| B1.1 | `pnpm install` · ESLint ve dependency-cruiser ile tam zincirin yeşil alınması | 1 g |
| B1.2 | Prisma şema temeli · `Tenant` aggregate · tarih tipleri · soft delete alanları | 2 g |
| B1.3 | PostgreSQL RLS politikaları · `FORCE ROW LEVEL SECURITY` · migration şablonu | 3 g |
| B1.4 | `TenantContext` + Prisma Client Extension · `SET LOCAL app.tenant_id` · soft delete filtresi | 2 g |
| B1.5 | Migration altyapısı · şema sürüklenmesi kontrolü · tohum verisi | 2 g |
| B1.6 | Tenant izolasyon test paketi (üretilen) · `BYPASSRLS` testi · bağlamsız sorgu testi | 2 g |
| B1.7 | Üç kapı guard zinciri (ADR-0006) · Outbox tablosu ve yazıcısı | 2 g |

**Toplam: 15 gün ≈ 3 hafta.**

### Çıkış ölçütü

```text
· İki tenant oluşturuluyor; hiçbiri diğerinin tek satırını okuyamıyor — test kanıtlı
· Tenant bağlamı olmadan yapılan sorgu hata veriyor
· Uygulama veritabanı rolünün BYPASSRLS yetkisi yok — test kanıtlı
· Migration şablonu RLS ve kısmi unique index kurallarını zorluyor
· Soft delete varsayılan filtresi merkezî; elle where eklenmiyor
· Tüm tarih kolonları BFS v1 §4.1 haritasına uygun tiplenmiş
· Önbellek anahtarı tenantId olmadan derlenmiyor
· core-domain → apartman-domain bağımlılığı CI'da reddediliyor
· Üç kapı zinciri çalışıyor ve Audit Log'a yazıyor
· Event outbox'a domain yazmasıyla aynı transaction içinde yazılıyor
```

---

*İlgili belgeler:* [`BASELINE.md`](BASELINE.md) · [`bfs/BFS-v1.md`](bfs/BFS-v1.md) · [`ais/AIS-v1.md`](ais/AIS-v1.md) · [`compliance/03-EKSIKLER-BACKLOG.md`](compliance/03-EKSIKLER-BACKLOG.md)
