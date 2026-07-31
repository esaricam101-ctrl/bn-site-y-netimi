# BNOS Apartman Yönetimi Modülü

Çok kiracılı, 634 sayılı Kat Mülkiyeti Kanunu'na uyumlu, AI destekli apartman yönetim platformu. BNOS ekosisteminin Apartman dikeyidir.

**Durum:** Faz 0 + Blok-1 tamamlandı · doğrulama zinciri yeşil

---

## Hızlı başlangıç

```bash
cp .env.example .env          # JWT_SECRET değerini değiştirin
pnpm install
docker compose up -d postgres redis minio
pnpm --filter @bnos/database generate
pnpm --filter @bnos/database migrate
pnpm --filter @bnos/database seed
pnpm dev
```

Ya da tek komutla: `bash scripts/setup.sh`

| Adres | Ne |
|---|---|
| <http://localhost:3000> | Web arayüzü |
| <http://localhost:3001/api/v1/docs> | API dokümantasyonu (Swagger) |
| <http://localhost:9001> | MinIO konsolu |

Geliştirme girişi: `yonetici@guzel-apartmani.test` / `bnos1234`

Bu kimlik bilgisi gerçek scrypt özetiyle üretilmiş ve test edilerek doğrulanmıştır (`tests/unit/guvenlik.smoke.mjs`).

---

## Klasör yapısı

```text
backend/          NestJS API — üç kapı, oturum, CQRS, outbox, audit, numaralandırma
frontend/web/     Next.js 14 — App Router, next-intl, Tailwind
frontend/mobile/  React Native (Expo) iskeleti — web ile aynı token ve API
database/         Prisma şeması, RLS migration'ı, tohum verisi
shared/           Bağımsız paketler (aşağıda)
docs/             ADR kayıtları, BFS, AIS, uyum raporları
infrastructure/   Dockerfile'lar, CI kopyaları, k8s
scripts/          Bağımlılıksız doğrulama zinciri
tests/unit/       node:test duman testleri
tools/            ESLint özel kuralları
```

### shared/ — bağımlılık yönü

```text
kernel  ←  core-domain  ←  apartman-domain
   ↑           ↑
bnos-client  module-sdk        ui-tokens (bağımsız)
```

| Paket | Sorumluluk |
|---|---|
| `kernel` | Money, zaman, Principal, tenant, önbellek anahtarı, portlar. **Sıfır çalışma zamanı bağımlılığı.** |
| `core-domain` | Tenant, audit, outbox, numaralandırma, izin ve rol katalogu. Dikeyden bağımsız. |
| `apartman-domain` | KMK kuralları, arsa payı, gider eksenleri, borç sorumluluk zinciri. |
| `bnos-client` | BNOS çekirdek servis portları + AI boru hattı + yerel adaptörler. |
| `module-sdk` | ModuleManifest, yaşam döngüsü, sözleşme testi kataloğu. |
| `ui-tokens` | Web (CSS + Tailwind) ve mobil (RN tema) için **tek** tasarım kaynağı. |

`core-domain → apartman-domain` bağımlılığı CI'da iki ayrı denetleyiciyle engellenir (ADR v1.1 §40).

---

## Mimari kararlar

Karar kayıtları: [`docs/adr/log/`](docs/adr/log/)

| ADR | Karar |
|---|---|
| [0001](docs/adr/log/0001-adr-surum-hiyerarsisi.md) | ADR v1.1 tek kaynak; v1.0 tarihsel |
| [0002](docs/adr/log/0002-tenant-modeli.md) | Tenant = apartman · PostgreSQL RLS · `portfolio/group/site` yok |
| [0003](docs/adr/log/0003-muhasebe-cift-tarafli.md) | Çift taraflı defter; işletme defteri **türetilmiş rapor** (KMK m.36) |
| [0004](docs/adr/log/0004-ai-yurutme-sirasi.md) | Memory → KG → BRE → Agent → LLM. **LLM asla ilk değil** |
| [0005](docs/adr/log/0005-finansal-ozet-onbellek.md) | Finansal bakiye önbeklenmez; özet tablo kullanılır |
| [0006](docs/adr/log/0006-uc-kapi.md) | Üç kapı: Kimlik → Kiracı → İzin |
| [0007](docs/adr/log/0007-para-tipi-bigint.md) | Para = ölçeklenmiş `bigint`, harici ondalık kütüphanesi yok |

Uygulama standartları: [`docs/bfs/BFS-v1.md`](docs/bfs/BFS-v1.md) · AI standardı: [`docs/ais/AIS-v1.md`](docs/ais/AIS-v1.md)

---

## Bu kod tabanının dört ayırt edici kuralı

**1. Tenant izolasyonu veritabanında zorlanır.**
`where` koşuluna bırakılmaz. Her transaction `SET LOCAL app.tenant_id` çalıştırır; bağlam yoksa PostgreSQL sorguyu **reddeder**. Uygulama rolünün `BYPASSRLS` yetkisi yoktur.

**2. Para asla `number` değildir.**
`Money` ölçeklenmiş `bigint`'tir (ölçek 4, `numeric(18,4)`). Dağıtım farkı kaybolmaz: `dagit()` kalanı en büyük ağırlıklı paya ekler ve `Σ paylar === toplam` her koşulda test edilir.

**3. LLM hiçbir zaman ilk bileşen değildir.**
`BnosAiPipeline` sırayı yapısal olarak zorlar. Niyet sınıflandırması deterministiktir. Business Rules Engine **üretimden önce** çalışır: bir kuralı ihlal eden öneri hiç üretilmez, üretilip bastırılmaz.

**4. Borç sorumluluğu snapshot'tır.**
Sorumlular tahakkuk anında çözülür ve kayda yazılır. Kiracı Mart'ta taşınırsa Şubat borcu eski kiracıda kalır. Malik her durumda zincirdedir.

**5. Her numara boşluksuz değildir.**
Makbuz, karar, tahakkuk ve yevmiye serileri `pg_advisory_xact_lock` + sayaç tablosu kullanır — PostgreSQL SEQUENCE **kullanılmaz**, çünkü sequence rollback'te geri sarmaz ve yasal seride boşluk bırakır. Talep ve belge serileri kilitsiz ilerler; boşluksuzluğu gereksiz yere uygulamak her kaydı tek sıraya dizerdi.

---

## Doğrulama

Tam doğrulama raporu: [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) — çalıştırılan ve
çalıştırılamayan (External Dependency Required) tüm doğrulamalar listelidir.

```bash
pnpm verify         # bağımlılıksız zincir — kurulum gerektirmez
pnpm test:negative  # denetleyicilerin gerçekten çalıştığını kanıtlar (12 test)
pnpm test:unit      # 331 birim testi
pnpm verify:all     # verify + negative + belge lint
pnpm test:contract  # sözleşme testleri (PostgreSQL gerekir)
pnpm lint           # ESLint + özel önbellek anahtarı kuralı
pnpm lint:md        # belge lint
```

**Boş eşleşme koruması:** bir sınır kuralı hiçbir dosyayla eşleşmiyorsa bu başarı değil
yapılandırma hatasıdır. Faz 0'da klasör yeniden adlandırması yüzünden sessizce devre dışı
kalan bir denetleyici bu şekilde yakalandı (VALIDATION_REPORT §4.2).

`scripts/` altındaki üç denetleyici hiçbir paket kurulumu gerektirmez ve CI'ın **ilk** işidir:

| Betik | Uyguladığı kural |
|---|---|
| `boundary.mjs` | `core-domain ↛ apartman-domain` · `kernel` yaprak paket · domain framework bilmez |
| `cache-key-scan.mjs` | Önbellek anahtarı `tenantId` taşır · finansal alan önbeklenmez |
| `config-check.mjs` | JSON/YAML sözdizimi · `NOBYPASSRLS` · paket adları · `tsconfig` hedefleri |

ESLint ve dependency-cruiser AST tabanlıdır ve asıl kaynaktır. Bu betikler kuralların **bağımlılık kurulumu başarısız olsa bile** doğrulanabilmesini garanti eder. İkisi birlikte çalışır.

---

## Teknoloji

NestJS · TypeScript · Prisma · PostgreSQL 16 (RLS) · Redis · Next.js 14 · React Native (Expo) · S3 uyumlu depolama · Docker · GitHub Actions

---

## Kullanıcı rolleri

Tek giriş ekranı, rol bazlı yönlendirme. Apartman Yöneticisi · Yönetim Şirketi · YK Başkanı · YK Üyesi · Denetçi · Malik · Kiracı · Sakin · Personel.

Yetki matrisi: [`shared/core-domain/src/yetki/roller.ts`](shared/core-domain/src/yetki/roller.ts)

> 🔴 **Bu satır YANLIŞTI ve düzeltildi (31 Temmuz 2026).** Önceki hâli
> *"Malik, Kiracı ve Sakin `yalnizcaKendiVerisi` kısıtı taşır: sakinler
> birbirinin borç, iletişim ve kişisel bilgisine erişemez (KVKK)"* diyordu.
> **Kod bunu yapmıyor.**

`RolTanimi.yalnizcaKendiVerisi` ve `KENDI_VERISI_KISITLI` **tanımlıdır ama hiçbir yerde okunmaz** — backend ve frontend genelinde sıfır kullanım. Bugün `MALIK`/`KIRACI`/`SAKIN` rolündeki bir kullanıcı, taşıdığı `KISI_GORUNTULE` + `BOLUM_GORUNTULE` izinleriyle `GET /kisiler` ve `GET /bolumler` uçlarından **tenant'ın tamamını** listeleyebilir. Satır düzeyi kısıt uygulanmamıştır ve bu bir **KVKK açığıdır**.

Bayrak duruyor, yalnızca sorgu servislerine bağlanmamış; açık madde olarak [`SESSION_SUMMARY.md`](SESSION_SUMMARY.md) §3.F P0-1'de izleniyor. **Bu satır kapatılmadan uyum değerlendirmesinde dayanak alınmamalıdır.**

Denetçi salt okunurdur ve erişimi de denetlenir.

---

## Bilinen açık maddeler

| # | Konu | Etki |
|---|---|---|
| C-4 | KMK emredici hükümler, genel kurul yeter sayısı, vekalet sınırları | **Sprint 3'ü bloke ediyor.** Hukuki görüş gerektirir. |
| C-1 | BNOS çekirdek servis endpoint'leri Sprint 15'e kadar yok | Yerel adaptörler kullanılıyor; sözleşme aynı, arkası değişecek |
| O-7 | Offline desteğin hangi modülleri kapsadığı (ADR §25) | Mobil Sprint 2 kapsamını etkiliyor |

Tam liste: [`docs/IMPLEMENTATION-ROADMAP.md`](docs/IMPLEMENTATION-ROADMAP.md)

---

## Sonraki adım

Blok-1: Prisma şema temeli → RLS politikaları → TenantContext → migration altyapısı → izolasyon test paketi → üç kapı + outbox.

Durum raporu: [`docs/FAZ-0-DURUM.md`](docs/FAZ-0-DURUM.md)
