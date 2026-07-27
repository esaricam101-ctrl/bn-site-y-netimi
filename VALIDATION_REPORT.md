# VALIDATION REPORT — Faz 0 + Blok-1

**Proje:** BNOS Apartman Yönetimi Modülü
**Tarih:** 26 Temmuz 2026
**Kapsam:** Faz 0 çıkış kriterleri + Blok-1 tamamlama
**Sonuç:** ✅ Çalıştırılabilen tüm doğrulamalar yeşil · Faz 0 kapatıldı

> **Güncelleme — 27 Temmuz 2026 (DEVLOG Oturum 2).** §5'te "External Dependency
> Required" diye listelenen beş kalemden **dördü kapandı** (§5.1, §5.2, §5.3,
> §5.5). Yalnızca **§5.4 (PostgreSQL) açıktır** ve Blok-1'in kapanmasını
> engelleyen tek teknik kalemdir. Kapanan üç doğrulama ilk koşularında **dört
> gerçek kusur** buldu; her biri ilgili alt bölümde kayıtlıdır.

---

## 1. Yönetici özeti

| | |
|---|---|
| Çalıştırılan doğrulama | 7 zincir adımı + 12 negatif test + belge lint |
| Çalıştırılamayan doğrulama | 5 kalem — hepsi §5'te "External Dependency Required" olarak listeli |
| Bulunan hata | 9 |
| Düzeltilen hata | 9 |
| Kalan hata | 0 |
| Blok-1 için engel | Yok |

**Oturum 2 sonrası (27 Temmuz 2026):**

| | |
|---|---|
| Çalıştırılamayan doğrulama | **1 kalem** — yalnızca §5.4 (PostgreSQL) |
| Kapanan doğrulamaların bulduğu kusur | 4 |
| Düzeltilen | 4 |
| Blok-1 için engel | **§5.4** — RLS'in çalışma zamanı kanıtı alınmadan Blok-1 kapatılmamalıdır |

Faz 0 çıkış kriterleri karşılandı. Blok-1 implementasyonu başlatılabilir.

---

## 2. Çalıştırılan doğrulamalar

### 2.1 Doğrulama zinciri

```text
============================================================
FAZ 0 BUILD VERIFICATION
============================================================
  GECTI      Workspace baglantilari
  GECTI      TypeScript derleme (tsc -b)
  GECTI      Paket siniri (ADR v1.1 §40)
  GECTI      Onbellek anahtari (ADR-0005 · §37)
  GECTI      Yapilandirma tutarliligi
  GECTI      Birim testleri (node:test)
============================================================
Tum kontroller yesil.
```

Komut: `pnpm verify` → `node scripts/verify.mjs`

### 2.2 Adım adım sonuçlar

| # | Doğrulama | Araç | Sonuç |
|---|---|---|---|
| 1 | Workspace bağlantıları | `scripts/link-workspace.mjs` | ✅ 6 paket → `node_modules/@bnos/` |
| 2 | TypeScript Project References | `tsc -b` · TypeScript 5.9.3 | ✅ 6 paket, 0 hata |
| 3 | Temiz derleme (`dist` silinip yeniden) | `tsc -b` | ✅ TS6305 yok |
| 4 | Artımlı derleme (no-op) | `tsc -b` | ✅ TS6377 yok |
| 5 | Paket sınırı | `scripts/boundary.mjs` | ✅ 83 dosya, 5 kural, 0 ihlal |
| 6 | Önbellek anahtarı | `scripts/cache-key-scan.mjs` | ✅ 85 dosya, 0 ihlal |
| 7 | Yapılandırma tutarlılığı | `scripts/config-check.mjs` | ✅ 20 JSON · 4 YAML · roller · path hedefleri |
| 8 | Test derlemesi (framework bağımsız modüller) | `tsc -p tests/tsconfig.json` | ✅ 0 hata |
| 9 | Birim testleri | `node --test` | ✅ **57/57** |
| 10 | Negatif testler | `scripts/negative-tests.sh` | ✅ **12/12** |
| 10 | Belge lint | `markdownlint-cli2` | ✅ 22 dosya, 0 hata |

### 2.3 Paket sınırı — kural başına kapsam

Boş eşleşme koruması aktif. Her kural en az bir dosyaya uygulanıyor:

```text
Paket siniri: 83 dosya tarandi, 5 kural uygulandi.
    8 dosya  core-domain-apartman-domaine-bagimli-olamaz
   11 dosya  kernel-yaprak-pakettir
   13 dosya  domain-katmani-framework-bilmez
    8 dosya  bnos-client-domain-bilmez
    1 dosya  ui-tokens-yaprak-pakettir

Ihlal yok.
```

Bir kural sıfır dosyayla eşleşirse çıkış kodu **1** olur ve yapılandırma hatası raporlanır. Gerekçesi §4.2'de.

### 2.4 Birim testi dağılımı

| Dosya | Test | Kapsam |
|---|---|---|
| `tests/unit/shared-kernel.smoke.mjs` | 19 | Para aritmetiği, dağıtım, zaman, önbellek politikası, tenant, principal, silme |
| `tests/unit/domain.smoke.mjs` | 31 | Tenant kuralları, event kataloğu, numaralandırma, yetki matrisi, gider eksenleri, arsa payı, paylaştırma, borç zinciri, module manifest, UI token'ları |
| `tests/unit/guvenlik.smoke.mjs` | 7 | scrypt özetleme, tuz benzersizliği, Unicode normalizasyonu, bozuk biçim toleransı, maliyet yükseltme, tohum kimlik bilgisi |
| **Toplam** | **57** | |

---

## 3. Negatif testler — yeşilin anlamı doğrulandı

Hiçbir şey denetlemeyen bir kontrol de yeşil yanar. Her denetleyiciye kasıtlı ihlal enjekte edildi, yakalandığı doğrulandı, değişiklik geri alındı.

Komut: `pnpm test:negative` → `bash scripts/negative-tests.sh`

| # | Enjekte edilen ihlal | Denetleyici | Sonuç |
|---|---|---|---|
| N-1 | `const x: number = "y"` | `tsc` | ✅ TS2322 |
| N-2 | `core-domain` → `@bnos/apartman-domain` | `boundary.mjs` | ✅ exit 1 |
| N-3 | `kernel` → `@bnos/core-domain` | `boundary.mjs` | ✅ exit 1 |
| N-4 | `apartman-domain` → `@prisma/client` | `boundary.mjs` | ✅ exit 1 |
| N-5 | Kural desenini olmayan klasöre yönlendir | `boundary.mjs` | ✅ boş eşleşme koruması |
| N-6 | `redis.get('bakiye:daire-3')` | `cache-key-scan.mjs` | ✅ ADR-0005 ihlali |
| N-7 | `redis.get('kullanici:izinler')` | `cache-key-scan.mjs` | ✅ tenantId eksik |
| N-8 | `NOBYPASSRLS` → `BYPASSRLS` | `config-check.mjs` | ✅ 3 ayrı hata |
| N-9 | `ci.yml`'e bozuk YAML | `config-check.mjs` | ✅ sözdizimi hatası |
| N-10 | Katalogda olmayan event üret | `core-domain` | ✅ `DogrulamaHatasi` |
| N-11 | Yanlış parola ile doğrulama | `sifre.ts` | ✅ reddedildi |
| N-12 | Tohum özetini boz | `sifre.ts` | ✅ doğrulanmadı |

**12 geçti, 0 yakalanmadı.**

---

## 4. Bulunan ve düzeltilen hatalar

| # | Hata | Nasıl bulundu | Düzeltme |
|---|---|---|---|
| 1 | `baseUrl` TypeScript 7.0'da kaldırılıyor (TS5101) | `tsc -b` | `baseUrl` kaldırıldı |
| 2 | `paths` göreli olmadan `baseUrl`siz çözülmüyor (TS5090) | `tsc -b` | Hedefler `./shared/...` biçimine çevrildi |
| 3 | **`decimal.js` `Money`'nin genel API'sine sızıyordu** | Kurulum hatası → tasarım incelemesi | Ölçeklenmiş `bigint` — **ADR-0007** |
| 4 | `config-check.mjs` SQL yorumundaki `BYPASSRLS` kelimesini ihlal sanıyordu | Kendi doğrulayıcısı | Yorum satırları taramadan önce ayıklanıyor |
| 5 | `node --test` dizin argümanı kabul etmiyor | `verify.mjs` | Test dosyaları açıkça sayılıyor |
| 6 | 28 kod bloğunda dil yok, 6 liste ve 1 fence boşluksuz | `markdownlint-cli2` | Otomatik düzeltildi |
| 7 | Derlenmiş JS `@bnos/*` paketlerini çözemiyordu | `node --test` | `scripts/link-workspace.mjs` |
| 8 | **`boundary.mjs` hiçbir dosyayla eşleşmiyordu** | Negatif test N-2 | Yol desenleri düzeltildi + boş eşleşme koruması |
| 9 | Ortak `tsBuildInfoFile` çakışması (TS6377) | `tsc -b` | Paket başına ayrı build-info |

### 4.1 Hata 3 — bu doğrulamanın asıl kazancı

`decimal.js` kurulamadı. Bir ortam engeli olarak bırakılabilirdi; incelendiğinde tasarım kusuru olduğu görüldü.

`shared/kernel` bağımlılık grafiğinin en altındaki pakettir. `Money.tutar: Decimal` üçüncü taraf bir sınıfı **her tüketicinin genel API'sine** sızdırıyordu — bir borç, bir tahakkuk satırı, bir DTO, hepsi o kütüphanenin sürüm kararlarına bağlanıyordu. Kütüphaneyi değiştirmek sistem çapında kırıcı değişiklik olurdu.

Para artık ölçeklenmiş `bigint`. Ölçek 4, `numeric(18,4)` ile birebir. `shared/kernel`'in çalışma zamanı bağımlılığı **sıfır**. Karar: [`docs/adr/log/0007-para-tipi-bigint.md`](docs/adr/log/0007-para-tipi-bigint.md)

Test kanıtı: `0.1 + 0.2 = 0.3000` ve `dagit()` 100 TL'yi üçe böldüğünde payların toplamı tam 100.

### 4.2 Hata 8 — sessizce devre dışı kalan denetleyici

Proje `packages/` yapısından `shared/` yapısına taşındığında `boundary.mjs` içindeki yol desenleri güncellenmedi. Kurallar `^packages/core-domain/` arıyordu; dosyalar `shared/core-domain/` altındaydı.

Sonuç: **denetleyici hiçbir dosyayla eşleşmedi ve bu yüzden "İhlal yok" dedi.** Üç tur boyunca yeşil yandı ve hiçbir şey denetlemedi.

Yakalanma biçimi kritik: pozitif çalıştırma bunu asla göstermezdi. Kasıtlı ihlal enjekte edildiğinde (N-2) yakalanmadığı görüldü.

İki düzeltme yapıldı:

1. Yol desenleri düzeltildi; kural sayısı 3'ten 5'e çıkarıldı.
2. **Boş eşleşme koruması** eklendi — bir kural sıfır dosyayla eşleşiyorsa bu başarı değil yapılandırma hatasıdır ve çıkış kodu 1 verir. Çıktı artık her kuralın kaç dosyaya uygulandığını raporlar.

Bu sınıf hata bir daha sessiz kalamaz.

### 4.3 Hata 9 — TS6377 kalıcı çözümü

`tsBuildInfoFile: './dist/.tsbuildinfo'` **`tsconfig.base.json`'a** konmuştu. Göreli yol, `extends` eden her paket için kök dizine çözüldü; altı paket aynı dosyaya yazmaya çalıştı.

**Kalıcı çözüm:**

- Ayar `tsconfig.base.json`'dan **kaldırıldı** — ortak build-info dosyası yok.
- Her paketin kendi `tsconfig.json`'ına yazıldı: `shared/<paket>/dist/.tsbuildinfo`.

Build-info dosyasının `dist/` **içinde** olması ikinci bir sorunu da çözer: `rm -rf dist` yapıldığında derleme durumu da silinir, dolayısıyla TS6305 ("output file has not been built from source file") oluşmaz.

Doğrulama:

```text
=== temiz derleme ===            OK
=== artimli derleme (no-op) ===  OK
=== dist silinip tekrar ===      OK — TS6305 YOK

shared/apartman-domain/dist/.tsbuildinfo
shared/bnos-client/dist/.tsbuildinfo
shared/core-domain/dist/.tsbuildinfo
shared/kernel/dist/.tsbuildinfo
shared/module-sdk/dist/.tsbuildinfo
shared/ui-tokens/dist/.tsbuildinfo
```

---

## 5. External Dependency Required

Aşağıdaki doğrulamalar Faz 0 ortamında **çalıştırılamadı**. Her biri için engel, telafi ve doğrulanacağı an açıkça belirtilmiştir.

**Durum (27 Temmuz 2026):** §5.1, §5.2, §5.3 ve §5.5 kapandı. §5.4 açıktır.

### 5.1 `pnpm install` — ✅ **KAPANDI** (2026-07-27, DEVLOG Oturum 1)

| | |
|---|---|
| **Engel** | ~~Paket kayıt sunucusuna erişim yok — `npm ping` → HTTP 403~~ — bu ortamda registry erişimi çalışıyor |
| **Sonuç** | 1398 paket kuruldu; 11 workspace projesinin tamamı. `pnpm-lock.yaml` ilk kez üretildi. |
| **Sapma** | Beklendiği gibi düşük. Kurulum yalnızca `prisma generate`'in daha önce hiç koşamamış olması nedeniyle bir şema hatası ortaya çıkardı (8 enum tek satıra sıkışmıştı) — DEVLOG Oturum 1 §1.4. |

### 5.1b `@types/node` — ✅ **KAPANDI** (2026-07-27, DEVLOG Oturum 1)

| | |
|---|---|
| **Engel** | ~~Aynı — paket kayıt sunucusuna erişim yok~~ — kuruldu |
| **Sonuç** | `pnpm verify` zincirinin "Test derlemesi" adımı gerçek tiplerle 0 hata veriyor. |
| **Kalan telafi** | `tests/types/node-min.d.ts` hâlâ mevcuttur ve `tests/tsconfig.json` tarafından kullanılır. Bağımlılıksız katmanın çevrimdışı çalışabilmesi için **kasıtlı olarak korunmuştur** (§6). Üretim derlemesinde kullanılmaz. |

### 5.2 ESLint — ✅ **KAPANDI** (2026-07-27, DEVLOG Oturum 2)

| | |
|---|---|
| **Engel** | ~~`eslint@^9` ve `typescript-eslint@^8` kurulamadı~~ — kuruldu |
| **Sonuç** | İlk koşuda **44 hata**; hepsi giderildi, şu an **0 hata**. |
| **Doğrulandı** | `require-tenant-cache-key` kuralı AST düzeyinde çalışıyor; `no-restricted-syntax` para-float yasağı yükleniyor. |
| **Bulduğu gerçek kusur** | `problem-details.filter.ts` içinde `String(unknown)` zorlaması — nesne taşıyan bir `HttpException` gövdesi, kullanıcıya dönen RFC 7807 `detail` alanına `"[object Object]"` olarak yazılabiliyordu (BFS v1 §12 ihlali). |
| **Kural kapsamı notu** | Kural AST tabanlıdır ve markalı tipi göremez. `OnbellekServisi` imzaları **zaten** `OnbellekAnahtari` alır — ham string derlenmez. Üç çağrı gerekçeli `eslint-disable` ile işaretlendi; kural gevşetilmedi. Kuralın kapsamı ile tip sisteminin kapsamı farklıdır. |

### 5.3 dependency-cruiser — ✅ **KAPANDI** (2026-07-27, DEVLOG Oturum 2)

| | |
|---|---|
| **Engel** | ~~`dependency-cruiser@^16` kurulamadı~~ — kuruldu |
| **Sonuç** | 244 modül, 422 bağımlılık, **0 ihlal**. |
| **Bulduğu gerçek kusur** | Bir **dairesel bağımlılık**: `common/decorators/index.ts` → `current-user.decorator.ts` → `index.ts`. `CurrentUser`, `AktifPrincipal`'ın iki satırlık takma adıydı; tek kullanıcısı olan `tenant.controller.ts` kod tabanının kendi adına geçirildi ve shim silindi. |
| **Kanıtlanan tasarım kararı** | §6'daki iki katmanlı doğrulamanın **ikinci katmanının gerçek getirisi budur**: dairesel bağımlılık tespiti `boundary.mjs`'de yoktur ve bu ihlali yalnızca dependency-cruiser görebilirdi. Aşağıdaki "Sınır" satırı bir varsayım değil, gerçekleşmiş bir olaydır. |
| **Sınır** | Dairesel bağımlılık tespiti bağımlılıksız betikte **yoktur** — yalnızca dependency-cruiser sağlar. |

### 5.4 PostgreSQL gerektiren sözleşme testleri — ⛔ **AÇIK** (tek kalan kalem)

| | |
|---|---|
| **Engel** | Docker kurulu **değil**; WSL çekirdeği var ancak kurulu dağıtım yok. `docker compose up -d postgres redis minio` çalışmaz. (27 Temmuz 2026 itibarıyla doğrulandı.) |
| **Doğrulanamayan** | CT-01 (RLS tenant izolasyonu), CT-06 (kısmi unique index, audit değiştirilemezliği), CT-11 (`BYPASSRLS` yetkisi) |
| **Yazılmış testler** | `backend/test/contract/rls-izolasyon.spec.ts` · `silme-standardi.spec.ts` · `oturum.spec.ts` · `numaralandirma.spec.ts` |
| **Hazırlık durumu** | Testler **koşmaya hazırdır.** Oturum 2'de tip hataları temizlendi: `rls-izolasyon.spec.ts` içindeki `tx: any` gerçek `Prisma.TransactionClient` ile değiştirildi — `any` iken `tx.kisi` yazım hatası derlemeden geçer ve CT-01 hiçbir şey doğrulamadan yeşil yanardı. `vitest` kurulu ve Windows'ta alias çözümlemesi düzeltilmiş durumda. |
| **Telafi** | RLS politikaları, kısmi unique index'ler ve CHECK kısıtları migration SQL'ine yazıldı ve gözden geçirildi. `config-check.mjs` rol tanımının `NOBYPASSRLS` taşıdığını **statik olarak** doğrular (N-8). Bu, çalışma zamanı izolasyon kanıtının yerine geçmez. |
| **Ne zaman doğrulanacak** | Docker Desktop + bir WSL dağıtımı kurulur kurulmaz: `pnpm db:up && pnpm db:migrate && pnpm db:seed`, ardından CT-01 ve CT-11 |
| **Risk** | **Orta.** RLS'in gerçekten çalıştığı çalışma zamanında kanıtlanmadan Blok-1'in ilerisine geçilmemelidir. §5.5'in gösterdiği gibi, **hiç koşmamış bir test yeşil sayılamaz** — CT-12 ilk koştuğunda 2/5 başarısızdı. |

### 5.5 Vitest — ✅ **KAPANDI** (2026-07-27, DEVLOG Oturum 2)

| | |
|---|---|
| **Engel** | ~~`vitest@^2.1` kurulamadı~~ — kuruldu |
| **Sonuç** | CT-12 (`ai-sirasi.spec.ts`) koştu: **5/5 geçti** — ancak ilk koşuda **2/5 başarısızdı** ve iki gerçek kusur ortaya çıkardı. |
| **Bulduğu gerçek kusur 1** | **`AI-001` kuralı hiçbir zaman tetiklenemiyordu.** ADR-0004'ün başlık kuralı `kayit.yaz`/`odeme.yurut`/`tahakkuk.isle` eylemlerini engelliyordu, ama boru hattının tek çağrı noktası yalnızca `oneri.uret` veya `okuma` talep ediyordu — kesişim boş. Kural ölü koddu; bir AGENT principal'ı için LLM gerçekten çağrılıyordu. `EYLEM_ONERISI` artık yazma sınıfını da beyan eder. |
| **Bulduğu gerçek kusur 2** | **Deterministik niyet sınıflandırması Türkçe metinde çalışmıyordu.** Desenler ASCII (`olustur`), girdi Türkçe (`oluştur`). Eşleşme olmayınca istek LLM'e düşüyordu — yani "LLM hiçbir zaman ilk bileşen değildir" güvencesini koruyan katman, Türkçe bir üründe sessizce devre dışıydı. Karşılaştırma artık ASCII'ye katlanır. |
| **Düzeltilen telafi iddiası** | Bu tablonun önceki hâli, telafi olarak *"AI sırası davranışı `tests/unit/domain.smoke.mjs` içinde kısmen kapsanmıştır"* diyordu. **Bu doğru değildi:** birim testlerinde `niyetiCoz`, `BnosAiPipeline` veya `bnos-client` geçen tek satır yoktur. AI boru hattının hiç test kapsamı olmamıştı — ve kapsam gelir gelmez iki kusur çıktı. |

> **Ders:** Gerçek olmayan bir telafi, gerçek bir boşluğu gizler. §5'teki her
> "Telafi" satırı, iddia ettiği kapsamın var olduğu **doğrulanarak** yazılmalıdır.

### 5.6 GitHub Actions — ⚠️ **kısmen açık**

| | |
|---|---|
| **Engel** | İş akışları yerelde çalıştırılamaz |
| **Telafi** | `ci.yml` ve `dependency-boundary.yml` YAML sözdizimi `config-check.mjs` tarafından doğrulandı (N-9). İş akışları `pnpm verify` zinciriyle hizalandı; bağımlılıksız doğrulama CI'ın **ilk** işidir. |
| **Durum (27 Temmuz 2026)** | Depo `origin`'e (GitHub) push edilmiş durumda, dolayısıyla iş akışları tetiklenmiş olmalıdır. **Ancak koşum sonucu bu ortamdan doğrulanamadı** — `gh` CLI kurulu değil. CI'ın gerçekten yeşil olduğu GitHub arayüzünden teyit edilmelidir. |
| **Ne zaman doğrulanacak** | `gh run list` ya da GitHub Actions sekmesi |

---

## 6. Kalıcı sonuç — iki katmanlı doğrulama

Yukarıdaki telafiler geçici çözüm olarak başladı; kalıcı bir ikinci savunma katmanına dönüştü.

| Katman | Araç | Rol |
|---|---|---|
| **Asıl kaynak** | ESLint · dependency-cruiser · vitest | AST tabanlı, kesin analiz |
| **Taban garanti** | `scripts/*.mjs` | Bağımlılık kurulumu **başarısız olsa bile** mimari kuralları doğrular |

`scripts/` betikleri CI'ın ilk işidir. İkisi aynı kuralı uygular; biri diğerinin yerine geçmez.

Bu tasarım kararının değeri Faz 0'da somut olarak kanıtlandı: hata 8 (sessizce devre dışı kalan denetleyici), yalnızca bağımlılıksız katmanın negatif testleri sayesinde yakalandı.

**Oturum 2 — ters yönde kanıt.** Faz 0, taban katmanın asıl kaynağı yakaladığı
bir vaka üretmişti. Asıl kaynak katmanı ilk kez koştuğunda ise taban katmanın
**göremeyeceği** dört kusur çıktı:

| Kusur | Yalnızca hangi araç görebilirdi | Neden taban katman göremezdi |
|---|---|---|
| Dairesel bağımlılık | dependency-cruiser | `boundary.mjs` grafik kurmaz, yalnızca import desenlerini eşler |
| `String(unknown)` → `[object Object]` | ESLint (tip-farkında) | Tip bilgisi gerektirir; regex taraması ifade tipini bilemez |
| `AI-001` erişilemezliği | vitest (çalışma zamanı) | Statik olarak kural da çağrı noktası da geçerlidir; ihlal ancak **kesişimin boş olmasıyla** ortaya çıkar |
| Türkçe niyet eşleşmemesi | vitest (çalışma zamanı) | Desen de girdi de tek başına doğrudur; hata yalnızca koşarken görünür |

İki katman **simetriktir**: ne biri diğerinin yerine geçer ne de biri diğerini
gereksizleştirir. Faz 0'da taban katman kazandı, Oturum 2'de asıl kaynak katmanı.

---

## 6.5 Blok-1 tamamlama

Blok-1 kapsamının çoğu Faz 0 kod tabanıyla birlikte teslim edilmişti. Envanter çıkarıldığında **iki gerçek boşluk** bulundu ve kapatıldı.

### 6.5.1 Faz 0 ile gelmiş olanlar

| Kalem | Konum |
|---|---|
| Prisma şema temeli | `database/prisma/schema.prisma` (419 satır) |
| RLS politikaları | `database/prisma/migrations/0001_init/migration.sql` (148 satır) |
| TenantContext | `backend/src/common/context/request-context.ts` · `prisma.service.ts` |
| Migration altyapısı | `database/` · `docker-compose.yml` · `init/` |
| İzolasyon test paketi | `backend/test/contract/rls-izolasyon.spec.ts` |
| Üç kapı | `backend/src/common/guards/` |
| Outbox | `backend/src/common/outbox/` |

### 6.5.2 Bulunan ve kapatılan boşluklar

**Boşluk 1 — Oturum modülü yoktu.**
Frontend `/oturum/giris` çağırıyordu ama backend'de böyle bir uç yoktu. `AuthGuard` (Kapı 1) belirteci doğruluyordu, fakat belirteci **üreten** hiçbir şey yoktu. Sistem giriş yapılamaz durumdaydı.

Eklendi: `backend/src/modules/oturum/` — giriş, yenileme, rol bazlı panel yönlendirmesi. Dört güvenlik kuralı uygulandı:

1. Hatalı e-posta ile hatalı şifre **ayırt edilmez** (kullanıcı sayımını önler).
2. Kullanıcı bulunmasa bile şifre doğrulaması **çalıştırılır** (zamanlama sızıntısını önler) — bunun için kukla özet kullanılır.
3. Tenant kimliği **yalnızca** token claim'inden okunur; istek gövdesinden asla.
4. Yenilemede izinler **veritabanından tazelenir**, eski belirteçten kopyalanmaz.

**Boşluk 2 — Numara tahsis servisi yoktu.**
`core-domain` seri kataloğunu ve biçimlendirmeyi taşıyordu ama tahsis mekanizması yoktu. ADR v1.1 §35'in ayrımı uygulanmamıştı.

Eklendi: `backend/src/common/numbering/numara.service.ts`. BOŞLUKSUZ seriler `pg_advisory_xact_lock` + sayaç tablosu kullanır; PostgreSQL SEQUENCE **kullanılmaz** çünkü sequence rollback'te geri sarmaz ve makbuz serisinde boşluk bırakır. BOŞLUKLU seriler kilitsiz ilerler.

### 6.5.3 Şifre özetleme kararı

Tohum verisindeki bcrypt özeti **doğrulanamaz bir yer tutucuydu** — kimse onunla giriş yapamazdı.

bcrypt ve argon2 native derleme gerektirir. `node:crypto` içindeki **scrypt** seçildi: bellek-zor bir KDF'dir, GPU ile paralel denemeyi pahalı kılar ve native bağımlılık eklemez. Gerekçe ADR-0007 ile aynı çizgidedir.

Mantık `backend/src/common/security/sifre.ts` içinde **framework bağımsız saf fonksiyonlar** olarak durur; `sifre.service.ts` ince bir enjekte edilebilir sarmalayıcıdır. Bu ayrım sayesinde şifre doğrulaması NestJS kurulumu olmadan çevrimdışı test edilebiliyor (7 test).

Tohum özeti gerçek scrypt ile üretildi ve `bnos1234` parolasıyla eşleştiği **test edilerek** doğrulandı.

### 6.5.4 Sözleşme testi kataloğu genişletildi

12 → **14 madde**, 10 → **12 kritik**. Eklenenler:

| Kod | Test |
|---|---|
| CT-13 | BOŞLUKSUZ numara serisi eşzamanlı tahsiste boşluk bırakmaz |
| CT-14 | Hatalı e-posta ile hatalı şifre ayırt edilmez |

Yeni sözleşme testi dosyaları: `backend/test/contract/oturum.spec.ts` · `numaralandirma.spec.ts` (PostgreSQL gerektirir — §5.4).

---

## 7. Faz 0 çıkış kriterleri

| # | Kriter | Durum |
|---|---|---|
| 1 | TS6377 kalıcı olarak çözüldü; ortak build-info yok | ✅ §4.3 |
| 2 | Tam build zinciri çalıştı (Project References, boundary, negatif, verify) | ✅ §2, §3 |
| 3 | Boundary denetleyicisi doğrulandı; boş eşleşme koruması aktif; kural başına dosya sayısı raporlanıyor | ✅ §2.3, N-5 |
| 4 | Çevrimdışı çalıştırılabilen tüm testler koştu | ✅ 57 birim + 12 negatif + 25 belge |
| 5 | Çalıştırılamayan doğrulamalar açıkça listelendi | ✅ §5 |
| 6 | Çalışan proje kodu üretildi | ✅ §8 |

**Faz 0 kapatıldı.**

---

## 8. Teslimat envanteri

| Klasör | İçerik | Dosya |
|---|---|---|
| `backend/` | NestJS API — üç kapı, CQRS, outbox, audit, Prisma | 30 TS |
| `frontend/web/` | Next.js 14 — App Router, next-intl, Tailwind | 9 |
| `frontend/mobile/` | React Native (Expo) iskeleti | 5 |
| `shared/` | 6 paket — kernel · core-domain · apartman-domain · bnos-client · module-sdk · ui-tokens | 28 TS |
| `database/` | Prisma şeması (419 satır), RLS migration'ı (148 satır), tohum verisi, init SQL | 7 |
| `scripts/` | 6 betik — verify · boundary · cache-key · config · link-workspace · negative-tests | 6 |
| `infrastructure/` | Dockerfile'lar, CI kopyaları, k8s | 4 |
| `docs/` | ADR kayıtları, BFS v1, AIS v1, uyum raporları, bu rapor | 23 MD |
| `tests/unit/` | node:test duman testleri | 2 |
| `tools/eslint-rules/` | Özel önbellek anahtarı kuralı | 2 |

Kök: `package.json` · `pnpm-workspace.yaml` · `tsconfig.json` · `tsconfig.base.json` · `docker-compose.yml` · `README.md` · `.env.example` · `.dependency-cruiser.cjs` · `eslint.config.js` · `.markdownlint-cli2.jsonc` · `.gitignore`

---

## 9. Blok-1'e devir notu

**İlk iş (B1.1) — ✅ tamamlandı (DEVLOG Oturum 1–2).** `pnpm install` →
`prisma generate` → `pnpm lint` → `pnpm test` zinciri yeşil. §5'teki beş
kalemin **dördü** burada kapandı; beşincisi (§5.4) Docker'a bağlıdır ve
ağ erişimiyle çözülmez. Kapanan üç doğrulama dört gerçek kusur buldu.

**İkinci iş (B1.5) — açık, tek engel.** PostgreSQL ayağa kalkar kalkmaz CT-01 ve CT-11 koşulmalıdır. RLS'in çalışma zamanında gerçekten izole ettiği kanıtlanmadan Blok-1'in ilerisine geçilmemelidir — bu, §5.4'te orta risk olarak işaretlenmiştir.

**Tek gerçek engel (teknik değil):** C-4 — KMK emredici hükümler, genel kurul yeter sayısı ve vekalet sınırları. Sprint 3'ü bloke ediyor ve 11 haftalık pencere tüketiliyor. Hukuki görüş gerektirir.
