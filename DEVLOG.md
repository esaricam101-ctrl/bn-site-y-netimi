# DEVLOG

Oturum bazlı geliştirme günlüğü. En yeni oturum en üsttedir.

Bu dosya **ne yapıldığını** ve **nereden devam edileceğini** kaydeder. Mimari
kararlar buraya yazılmaz — onların yeri [`docs/adr/log/`](docs/adr/log/).

---

## 2026-07-27 · Oturum 1 — Geliştirme ortamının ayağa kaldırılması

**Kapsam:** Blok-1 adım B1.1 (araç zinciri) · kod yazımı değil, ortam hazırlığı
**Sonuç:** Ortam çalışır durumda · 10 paketten 9'u derleniyor · doğrulama zinciri yeşil
**Önceki durum:** [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) — Faz 0 + Blok-1 çevrimdışı doğrulanmış, hiçbir bağımlılık kurulamamıştı

### 1. Yapılan işler

#### 1.1 Araç zinciri kuruldu

- **pnpm 9.12.0** corepack ile kuruldu. `corepack enable` `C:\Program Files\nodejs`
  altına yazmaya çalıştığı için `EPERM` verdi (yönetici gerektirir); shim'ler
  `--install-directory %LOCALAPPDATA%\CorepackBin` ile kullanıcı dizinine kuruldu
  ve bu dizin kullanıcı `PATH`'ine eklendi.
- **PyYAML 6.0.3** kuruldu — `scripts/config-check.mjs` YAML doğrulaması için
  `python3 -c "import yaml"` çağırıyor. Python 3.14.3 zaten kuruluydu, modül yoktu.
- Ortam envanteri: Node v24.18.0 · npm 11.16.0 · git 2.55.0 · Python 3.14.3.
  **Docker kurulu değil.** `bash` yalnızca Git Bash olarak var, `PATH`'te değil.

#### 1.2 `pnpm install` — başarılı

- 1398 paket, ~3 dakika. 11 workspace projesinin tamamı kuruldu.
- `pnpm-lock.yaml` ilk kez üretildi.
- **Not:** Faz 0'da kurulumun engeli npm registry'ye erişimsizlikti (HTTP 403).
  Bu ortamda registry erişimi çalışıyor.

#### 1.3 `pnpm -r build` — 10 paketten 9'u yeşil

| Paket | Durum |
|---|---|
| `shared/kernel` · `core-domain` · `apartman-domain` · `bnos-client` · `module-sdk` · `ui-tokens` | ✅ |
| `database` (`prisma generate`) | ✅ |
| `frontend/web` (`next build`) | ✅ 5 rota, 87.3 kB ortak JS |
| `backend` (`nest build`) | ❌ TS2307 — bkz. TODO-1 |

#### 1.4 Yol boyunca beş kök neden bulundu ve düzeltildi

Hiçbiri iş mantığına dokunmadı.

1. **Prisma şeması hiç parse edilemiyordu.** 8 enum tek satıra sıkıştırılmıştı
   (`enum TenantTipi { APARTMAN SITE YONETIM_SIRKETI }`). Prisma enum değerlerinin
   ayrı satırlarda olmasını şart koşar; parser blokları sonlandıramayıp şema boyunca
   hata üretiyordu. Değer isimleri **birebir korunarak** çok satırlı biçime çevrildi.
   Bu hata hiç yakalanmamıştı çünkü `prisma` daha önce hiç kurulamamıştı.
2. **`.env` yoktu.** `.env.example`'dan üretildi; `JWT_SECRET` rastgele 57 karakterle
   dolduruldu, şablondaki yer tutucu bırakılmadı. Dosya `.gitignore` kapsamındadır.
3. **Tailwind readonly tip çakışması.** `tailwindTema` üzerindeki `as const`,
   `fontFamily.sans`'ı `readonly` tuple yapıyordu; Tailwind `Config` mutable
   `string[]` bekler. Tip `as string[]` ile gevşetildi — değerler ve diğer
   token'ların değişmezliği korundu.
4. **Doğrulama script'leri Windows'ta çalışmıyordu.** Dört script kökü
   `new URL('..', import.meta.url).pathname` ile hesaplıyordu; Windows'ta bu
   `/C:/...` döndürür ve birleştirince `C:\C:\...` oluşur. Sonuç: `boundary.mjs`
   ve `cache-key-scan.mjs` **0 dosya** tarıyordu (boş eşleşme koruması doğru
   şekilde devreye girdi), diğer ikisi `ENOENT` veriyordu. Dördü de
   `fileURLToPath` kullanacak şekilde düzeltildi. İlgi çekici olan,
   `verify.mjs`'nin bu doğru yöntemi zaten kullanıyor olmasıydı.
5. **İki ek Windows uyumsuzluğu.** `link-workspace.mjs` `'dir'` symlink kuruyordu
   (Windows'ta yönetici yetkisi ister) → junction'a çevrildi. `verify.mjs`
   `execFileSync('npx', …)` çağırıyordu (`npx` bir `.cmd`, kabuk olmadan
   çalıştırılamaz) → yerel `node_modules/typescript/bin/tsc` doğrudan çağrılıyor.

#### 1.5 İlk kez koşabilen doğrulamalar

`VALIDATION_REPORT.md` §5'te "External Dependency Required" diye listelenen
beş kalemden **üçü kapandı, biri hata verdi, biri açık kaldı**.

| Doğrulama | Rapordaki madde | Sonuç |
|---|---|---|
| `pnpm verify` — 7 adım | — | ✅ tümü yeşil |
| Birim testleri (`node:test`) | — | ✅ **57/57** — belgelenen sayıyla birebir |
| `boundary.mjs` | — | ✅ 93 dosya, 5 kural, 0 ihlal |
| `cache-key-scan.mjs` | — | ✅ 95 dosya, 0 ihlal |
| `config-check.mjs` | — | ✅ 20 JSON · 4 YAML · roller · paket adları · tsconfig |
| **dependency-cruiser** | §5.3 | ✅ **217 modül, 533 bağımlılık, 0 ihlal** |
| **ESLint** | §5.2 | ❌ **44 hata** — bkz. TODO-2 |
| PostgreSQL sözleşme testleri | §5.4 | ⛔ Docker yok — bkz. TODO-3 |

dependency-cruiser'ın, bağımsız yazılmış `boundary.mjs` ile aynı sonucu vermesi
iki katmanlı doğrulama tasarımının ilk gerçek çapraz kanıtıdır.

### 2. Değiştirilen dosyalar

| Dosya | Değişiklik | Sınıf |
|---|---|---|
| `database/prisma/schema.prisma` | 8 enum çok satırlı biçime çevrildi; değerler aynı | Sözdizimi |
| `shared/ui-tokens/src/index.ts` | `fontFamily.sans` → `as string[]` | Tip |
| `backend/test/contract/rls-izolasyon.spec.ts` | Tek jenerik anotasyon (`baglamda<unknown[]>`) | Test tipi |
| `backend/package.json` | `+ @types/supertest` | Bağımlılık |
| `scripts/boundary.mjs` | `fileURLToPath` | Windows uyumu |
| `scripts/cache-key-scan.mjs` | `fileURLToPath` | Windows uyumu |
| `scripts/config-check.mjs` | `fileURLToPath` | Windows uyumu |
| `scripts/link-workspace.mjs` | `fileURLToPath` + junction | Windows uyumu |
| `scripts/verify.mjs` | `npx` yerine yerel `tsc` | Windows uyumu |
| `.env` | **YENİ** — `.env.example`'dan, rastgele `JWT_SECRET` | Ortam |
| `pnpm-lock.yaml` · `node_modules/` | Üretildi | Ortam |
| `DEVLOG.md` | **YENİ** — bu dosya | Belge |
| `.markdownlint-cli2.jsonc` | `DEVLOG.md` lint kapsamına alındı | Belge |

**Sistem tarafı (depo dışı):** pnpm shim'leri `%LOCALAPPDATA%\CorepackBin`,
kullanıcı `PATH` girdisi, `pyyaml` Python paketi.

### 3. Bu oturumda çalıştırılmayanlar

- `pnpm test:negative` — 12 negatif test. `bash` `PATH`'te olmadığı için koşulmadı.
- `pnpm lint:md` — belge lint.
- `pnpm test:contract` — PostgreSQL gerektirir.
- `backend/test/contract/ai-sirasi.spec.ts` — **veritabanı gerektirmez**, yalnızca
  vitest gerektirir; vitest artık kurulu olduğu için koşulabilir durumda.

---

## TODO

Öncelik sırasına göre. Numaralar oturumlar arası sabittir.

### TODO-1 · `TenantModule` ve `TenantController` yok — backend build'i bloke ediyor

**Öncelik: yüksek.** Tek kalan build hatası.

[`backend/src/app.module.ts`](backend/src/app.module.ts) satır 16
`./modules/tenant/tenant.module` import ediyor ama dosya yok. Modül klasöründe
yalnızca `tenant.command.service.ts`, `tenant.query.service.ts` ve `dto/` var;
`kisi` modülünde bulunan `*.module.ts` + `*.controller.ts` çifti eksik. Tenant
özelliği hiçbir HTTP yüzeyine bağlı değil.

Bu bir kod boşluğudur, ortam sorunu değildir. Controller'ın hangi rotaları açacağı
ve `olustur` / `aktiflestir` komutlarının hangi izin dekoratörleriyle korunacağı
tasarım kararı gerektirir. `kisi` modülü birebir şablon olarak kullanılabilir.

### TODO-2 · ESLint 44 hata — özel mimari kural yanlış pozitif üretiyor

**Öncelik: yüksek** (kural kısmı) / orta (gerisi).

Hiç çalıştırılamamış olan `bnos/require-tenant-cache-key` kuralı ilk koşusunda
[`backend/src/common/prisma/cache.service.ts`](backend/src/common/prisma/cache.service.ts)
içinde 3 kez tetikliyor — ancak parametreler **zaten** markalı `OnbellekAnahtari`
tipinde. Kural yalnızca doğrudan `onbellekAnahtari(...)` çağrısını kabul ediyor,
markalı tipte bir değişkeni tanımıyor. Kuralın mı yoksa kodun mu değişeceği
mimari bir karardır.

Kalan 41 hatanın dağılımı:

- 28 hata sözleşme testlerindeki `any` kullanımından (`oturum.spec.ts` 15,
  `rls-izolasyon.spec.ts` 13).
- 6 hata `tsconfig` projesine dahil olmayan dosyaların parse edilememesinden:
  `eslint.config.js`, `tools/eslint-rules/*.js`, `backend/vitest.config.ts` ve
  **üretilmiş `tests/.derleme/` çıktısı**. Sonuncusu açıkça ESLint ignore
  listesine girmelidir — üretilmiş dosya lint edilmemeli.
- 7 hata `no-unsafe-*` ve `no-unnecessary-type-assertion` kaynaklı; 3'ü
  `--fix` ile otomatik düzelebilir.

### TODO-3 · Docker + PostgreSQL — RLS'in çalışma zamanı kanıtı

**Öncelik: yüksek.** `VALIDATION_REPORT.md` §5.4'te **orta risk** olarak işaretli.

Docker kurulu değil; WSL çekirdeği var ama kurulu dağıtım yok. Kurulmadan
`docker compose up -d postgres redis minio` çalışmaz, dolayısıyla:

- **CT-01** — tenant izolasyonu, RLS altında çapraz okuma reddedilir
- **CT-11** — uygulama rolünün `BYPASSRLS` yetkisi yok
- **CT-06** — kısmi unique index, audit değiştirilemezliği

koşulamıyor. Devir notu bunu açıkça şarta bağlıyor: *"RLS'in gerçekten izole
ettiği kanıtlanmadan Blok-1'in ilerisine geçilmemelidir."*

### TODO-4 · `bash` PATH'e alınmalı

**Öncelik: orta.** Git Bash `C:\Program Files\Git\bin\bash.exe` olarak kurulu ama
`PATH`'te değil. `pnpm test:negative` (12 negatif test) ve `pnpm setup` bu haliyle
çalışmıyor. Negatif testler, denetleyicilerin gerçekten bir şey denetlediğini
kanıtlayan katmandır — Faz 0'ın en değerli bulgusu (sessizce devre dışı kalan
`boundary.mjs`) bu katman sayesinde yakalanmıştı.

### TODO-5 · Sürüm kontrolü yok

**Öncelik: orta.** Proje bir git deposu değil. Append-only ADR günlüğü, CI iş
akışları ve `.gitignore` mevcutken sürüm kontrolü olmaması, bu oturumdaki
değişikliklerin de geri alınamaz olması demek. `git init` + ilk commit önerilir.

### TODO-6 · Belge tutarsızlıkları

**Öncelik: düşük.** Oturum 1 analizinde tespit edilenler:

- [`README.md`](README.md) satır 79 ve 81'de **iki kırık ADR bağlantısı**:
  `0003-cift-tarafli-muhasebe.md` ve `0005-finansal-onbellek-yasagi.md` diye
  bağlantı veriyor; gerçek dosyalar `0003-muhasebe-cift-tarafli.md` ve
  `0005-finansal-ozet-onbellek.md`.
- [`docs/FAZ-0-DURUM.md`](docs/FAZ-0-DURUM.md) §3.3'te bayat yollar:
  `packages/shared-kernel`, `docker/docker-compose.yml`, `docker/init/01-roles.sql`
  yazıyor; gerçekte `shared/kernel`, kök `docker-compose.yml`,
  `database/init/01-roles.sql`. Aynı belge §3.1'de "0001 … 0006" diyor, 7 ADR var.
- `VALIDATION_REPORT.md` kökte ve `docs/` altında **byte-eş kopya**. Aynı şekilde
  `.github/workflows/*` ile `infrastructure/github/workflows/*` byte-eş. Biri
  değişirse sessizce ayrışır.
- `VALIDATION_REPORT.md` §2.2 "57 birim / 12 negatif" derken §7 kriter 4
  "49 birim / 10 negatif" diyor.
- `VALIDATION_REPORT.md` derlemenin TypeScript 6.0.3 ile yapıldığını söylüyor;
  `package.json` `^5.6.0` sabitliyor ve kurulan sürüm 5.9.3.
- `frontend/web/{app,components,lib,messages,public}` — PowerShell'de genişlemeyen
  brace-expansion artığı, boş klasör olarak duruyor.
- Boş klasörler: `backend/test/integration/`, `frontend/web/components/`,
  `frontend/web/public/`, `infrastructure/k8s/` (sonuncusu README'de listeli).

### TODO-7 · Engelleyici, teknik olmayan — C-4 hukuki görüş

**Öncelik: kritik, ancak teknik ekip çözemez.** KMK emredici hükümler, genel kurul
yeter sayısı ve vekalet sınırları. Sprint 3'ü bloke ediyor; 11 haftalık pencere
tüketiliyor. Faz 0 ile paralel başlatılmalıydı.

---

## Next Session

**Başlangıç noktası:** Ortam hazır. `pnpm install` ve `pnpm verify` yeşil. Tek
build hatası TODO-1.

### Ortamı geri kazanma

Yeni bir terminalde `pnpm` görünmüyorsa terminali kapatıp açın — `PATH` girdisi
kullanıcı registry'sine yazıldı, halihazırda açık süreçler eski ortamı miras alır.

```bash
pnpm --version   # 9.12.0 beklenir
pnpm verify      # 7 adım, tümü GECTI beklenir
```

### Önerilen sıra

1. **TODO-1'e karar ver.** `TenantModule` + `TenantController` yazılacak mı?
   Yazılacaksa `kisi` modülü şablon; rotalar ve izin dekoratörleri kararlaştırılmalı.
   Bu kapanmadan `pnpm -r build` yeşile dönmez ve `pnpm dev` backend'i başlatamaz.
2. **`ai-sirasi.spec.ts` koş.** Veritabanı gerektirmez, vitest artık kurulu.
   `pnpm --filter @bnos/backend exec vitest run test/contract/ai-sirasi.spec.ts`
   AI yürütme sırasının (ADR-0004) LLM'i hiç çağırmadığını kanıtlayan casus testi
   yalnızca vitest ile koşar — §5.5 bu şekilde kapanır.
3. **TODO-4'ü kapat** (tek satır `PATH` düzenlemesi), ardından
   `pnpm test:negative` ile 12 negatif testi doğrula.
4. **TODO-2'nin kural kısmına karar ver.** `bnos/require-tenant-cache-key`
   gevşetilecek mi, yoksa `cache.service.ts` mi değişecek? Bu bir mimari karardır
   ve muhtemelen bir ADR kaydı hak eder.
5. **TODO-3.** Docker Desktop + bir WSL dağıtımı kurulduktan sonra
   `pnpm db:up && pnpm db:migrate && pnpm db:seed`, ardından CT-01 ve CT-11.
   **Blok-1 bundan önce kapatılmış sayılmamalıdır.**

### Dikkat edilecekler

- `database/prisma/schema.prisma` bu oturumda biçimsel olarak değişti. Enum
  değerleri aynıdır; `migration.sql` ile karşılaştırırken bunu göz önünde tutun.
- `scripts/*.mjs` artık Windows'ta çalışıyor. POSIX davranışı korundu
  (junction yalnızca `win32`'de, göreli symlink diğer platformlarda).
- `.env` gerçek bir rastgele `JWT_SECRET` taşıyor ve `.gitignore` kapsamındadır;
  depoya girmemelidir.

---

*İlgili belgeler:* [`README.md`](README.md) · [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) · [`docs/FAZ-0-DURUM.md`](docs/FAZ-0-DURUM.md) · [`docs/IMPLEMENTATION-ROADMAP.md`](docs/IMPLEMENTATION-ROADMAP.md)
