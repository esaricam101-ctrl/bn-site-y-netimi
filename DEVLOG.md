# DEVLOG

Oturum bazlı geliştirme günlüğü. En yeni oturum en üsttedir.

Bu dosya **ne yapıldığını** ve **nereden devam edileceğini** kaydeder. Mimari
kararlar buraya yazılmaz — onların yeri [`docs/adr/log/`](docs/adr/log/).

---

## 2026-07-28 · Oturum 6 — Blok modülü ve tenant sızıntısı düzeltmesi

**Kapsam:** `Blok` modülü · Oturum 4'te girilen bir kusurun kapatılması
**Sonuç:** `blokId` artık kullanılabilir ve tenant doğrulamalı · 259 modül
**Önceki durum:** Oturum 5 — bölüm, ilişki hazır; blok referansı boşta

### 1. Yapılan işler

#### 1.1 İki kusur birlikte

Oturum 4'te `BolumOlusturDto` bir `blokId` alanı kabul ediyordu. Ancak:

1. **Blok oluşturmanın hiçbir yolu yoktu.** `Blok` modeli şemada vardı,
   `BagimsizBolum.blokId` ona işaret ediyordu, ama modül yazılmamıştı. Alan
   pratikte doldurulamıyordu.
2. **`blokId` doğrulanmıyordu.** Gelen değer olduğu gibi yazılıyordu.

İkincisi bir **tenant izolasyon açığıdır.** Yabancı anahtar kısıtı bunu
yakalamaz: PostgreSQL referans bütünlüğü tetikleyicileri tablo sahibi
yetkisiyle çalışır ve **RLS'i baypas eder.** Başka bir tenant'ın blok kimliği
gönderilseydi FK kontrolü geçer, kayıt yazılır ve bölüm, o tenant'ın hiç
göremeyeceği bir bloğa bağlanırdı.

RLS'in kapsamadığı bu yüzey uygulama katmanında kapatıldı: `blokId` verilmişse
bloğun **aynı tenant'a ait olduğu** doğrulanır.

#### 1.2 Blok modülü

| Uç | İzin | İşlev |
|---|---|---|
| `POST /bloklar` | `bolum.manage` | Blok oluştur (ad tenant içinde tekil) |
| `GET /bloklar` | `bolum.view` | Blokları bölüm sayısıyla listele |
| `DELETE /bloklar/:id` | `bolum.manage` | Soft delete, gerekçe zorunlu |

Bölümü olan blok silinemez: silinirse bölümler sahipsiz bir kimliğe işaret eder
ve mükerrer kapı no kontrolü — blok bazlıdır — anlamını yitirir.

Blok listesi **sayfalanmaz**. Bir apartmanda blok sayısı doğası gereği küçüktür
(tipik olarak 1–10); cursor sayfalama burada gereksiz karmaşıklık olurdu.
`kisi` ve `bolum` şablonundan bilinçli sapmadır.

#### 1.3 Event kataloğu

`apartman.blok.olusturuldu` ve `.silindi` eklendi (katalog 9 → 11). Birim testi
artık `apartman.` dikeyinin **altı** event'ini ve üç sahip modülü birlikte
doğrular; tek tek eklemek yerine dikeyin bütünü sabitlendi.

### 2. Değiştirilen dosyalar

| Dosya | Değişiklik | Sınıf |
|---|---|---|
| `backend/src/modules/blok/` | **YENİ** — 5 dosya | Özellik |
| `backend/src/modules/bolum/bolum.command.service.ts` | `blokId` tenant doğrulaması | **Güvenlik** |
| `shared/core-domain/src/outbox/domain-event.ts` | İki event kaydı | Sözleşme |
| `backend/src/app.module.ts` | `BlokModule` kaydı | Bağlama |
| `tests/unit/domain.smoke.mjs` | Apartman dikeyi event kapsamı genişletildi | Test |

### 3. Bu oturumda çalıştırılmayanlar

- Blok uçları ve `blokId` doğrulaması — PostgreSQL gerektirir (TODO-3).
  **Çapraz tenant blokId denemesinin gerçekten reddedildiği çalışma zamanında
  kanıtlanmadı**; bu, sözleşme testi yazılması gereken bir izolasyon
  senaryosudur.

---

## 2026-07-28 · Oturum 5 — Bölüm ilişkisi (malik / kiracı)

**Kapsam:** `BolumIliskisi` modülü · zaman çakışması invaryantı · DATE dönüşümü
**Sonuç:** Kişi ↔ bölüm bağı kuruldu · 68 birim testi (58 → 68)
**Önceki durum:** Oturum 4 — bölüm ve kişi vardı, aralarında bağ yoktu

### 1. Yapılan işler

#### 1.1 Eksik halka

`borcSorumlulariniCoz()` — malik/kiracı borç zincirini çözen fonksiyon —
domain'de yazılıydı ve `readonly BolumIliskisi[]` bekliyordu. Ancak bu ilişkiyi
**oluşturan hiçbir uygulama kodu yoktu**; fonksiyonu besleyecek veri hiçbir
zaman üretilemiyordu. Bölümler ve kişiler vardı, aralarındaki bağ yoktu.

Eklendi: [`backend/src/modules/iliski/`](backend/src/modules/iliski/).

| Uç | İzin | İşlev |
|---|---|---|
| `POST /bolumler/:bolumId/iliskiler` | `bolum.manage` | Malik/kiracı bağla |
| `GET /bolumler/:bolumId/iliskiler?tarih=` | `bolum.view` | Geçmiş; `tarih` ile o gün geçerli olanlar |
| `PATCH /bolumler/:bolumId/iliskiler/:id/sonlandir` | `bolum.manage` | Bitiş tarihi ver |

**Silme ucu bilinçli olarak yoktur.** Borç sorumluluğu borcun oluştuğu anda
çözülüp kayda yazılır (snapshot). Geçmiş bir ilişkiyi silmek o snapshot'ın
dayanağını yok eder ve *"bu borç neden bu kişide?"* sorusu cevapsız kalır.
Kiracı taşındığında ilişki `bitis` alır, yok edilmez.

#### 1.2 Sessizce yanlış kişiye borç yazan çakışma

`borcSorumlulariniCoz` geçerli ilişkiler arasından `.find(rol === 'MALIK')` ile
**tek** kayıt seçer. İki malik kaydı aynı tarihte geçerliyse dizideki ilki
seçilir, diğeri sessizce yok sayılır — borç yanlış kişiye yazılır ve hiçbir hata
fırlatılmaz. Çözümleme tarafında savunma yoktur; kural yazma anında zorlanmak
zorundadır.

Eklendi: `iliskiyiDogrula()` (apartman-domain). Bir bölümde aynı anda en fazla
bir malik ve en fazla bir kiracı bulunur; farklı roller serbestçe örtüşür —
kiracılı bir bölümün maliki de vardır.

Kuralın **neden** var olduğunu sabitleyen bir test yazıldı: çakışan iki malik
verilip `borcSorumlulariniCoz` çağrılıyor, ikinci malikin kaybolduğu
gösteriliyor, ardından aynı verinin `iliskiyiDogrula` tarafından reddedildiği
doğrulanıyor. Kural silinirse test, neyin bozulacağını anlatır.

Kalan risk: kontrol ile yazma arasında dar bir yarış penceresi vardır. Kalıcı
çözüm örtüşme dışlayan bir constraint'tir (PostgreSQL `EXCLUDE USING gist`) ve
migration gerektirir — TODO-3'e yazıldı.

#### 1.3 DATE dönüşümü kernel'e taşındı

İlişkiler `@db.Date` kolonları taşır. Prisma bunları UTC gece yarısına oturmuş
`Date` olarak döndürür; **yerel** bileşenlerle (`getFullYear`/`getMonth`/
`getDate`) tarih üretmek negatif offsetli bir sunucuda her tarihi bir gün geri
kaydırır (`2026-01-01` → `2025-12-31`). Hata sessizdir ve yalnızca sunucunun
saat dilimi değiştiğinde ortaya çıkar; o noktada vade tarihi, ilişki başlangıcı
ve gecikme günü sayısı **birlikte** kayar.

Dönüşüm önce `backend/src/common/time/` altına yazıldı, sonra
[`shared/kernel/src/time/temporal.ts`](shared/kernel/src/time/temporal.ts)
içine taşındı: `takvimTarihiniOku` · `takvimTarihiniOkuVeyaNull` ·
`takvimTarihiniYaz`. Gerekçe iki katlı —

1. **Kavramsal yer.** Dönüşüm Prisma'ya özgü değildir; `Date` ↔ `TakvimTarihi`
   çevirisi zaten `temporal.ts`'in konusudur ve `tenantTakvimGunu` ile aynı
   ailedendir.
2. **Test edilebilirlik.** Backend altındayken çevrimdışı test edilemiyordu:
   derlenen CJS modül `require('@bnos/kernel')` yapıyor, kernel ise ESM-only
   (`exports` haritasında `require` koşulu yok) → `ERR_PACKAGE_PATH_NOT_EXPORTED`.
   Kernel içinde ise mevcut duman testi altyapısı doğrudan kapsıyor.

Dört test eklendi; biri dönüşümü `UTC`, `America/New_York`, `Asia/Tokyo` ve
`Pacific/Kiritimati` altında koşarak saat diliminden bağımsızlığı kanıtlıyor.

#### 1.4 Event kataloğu

`apartman.bolum_iliskisi.kuruldu` ve `.sonlandirildi` eklendi (katalog 7 → 9).
Çalışma zamanında kabul edildikleri doğrulandı.

### 2. Değiştirilen dosyalar

| Dosya | Değişiklik | Sınıf |
|---|---|---|
| `backend/src/modules/iliski/` | **YENİ** — 5 dosya | Özellik |
| `shared/apartman-domain/src/borc/borc-sorumlusu.ts` | `iliskiyiDogrula()`; `tarihtekiIliskiler` dışa açıldı | **Invaryant** |
| `shared/kernel/src/time/temporal.ts` | Üç DATE dönüşüm fonksiyonu | Sözleşme |
| `shared/core-domain/src/outbox/domain-event.ts` | İki event kaydı | Sözleşme |
| `backend/src/app.module.ts` | `IliskiModule` kaydı | Bağlama |
| `tests/unit/domain.smoke.mjs` | 6 çakışma testi | Test |
| `tests/unit/shared-kernel.smoke.mjs` | 4 DATE dönüşüm testi | Test |

### 3. Bu oturumda çalıştırılmayanlar

- Modülün uçtan uca davranışı — PostgreSQL gerektirir (TODO-3). Çakışma kuralı
  ve DATE dönüşümü **birim düzeyinde kanıtlıdır**; HTTP uçları gerçek bir
  veritabanına karşı hiç çağrılmadı.

---

## 2026-07-27 · Oturum 4 — Bağımsız Bölüm modülü

**Kapsam:** Apartman yönetimi çekirdek varlığı · Blok-1 dikey dilimi
**Sonuç:** `BolumModule` HTTP yüzeyine bağlandı · 58 birim · 14 negatif test
**Önceki durum:** Oturum 3 — belgeler tutarlı, kod tarafı `kisi`/`oturum`/`tenant` ile sınırlı

### 1. Yapılan işler

#### 1.1 Eksik olan neydi

`backend/src/modules/` altında `health`, `kisi`, `oturum`, `tenant` vardı.
Apartman yönetiminin **çekirdek varlığı** olan bağımsız bölüm (daire) yoktu:
domain aggregate'i ([`bagimsiz-bolum.ts`](shared/apartman-domain/src/bolum/bagimsiz-bolum.ts))
ve Prisma modeli yazılmıştı, HTTP ve kalıcılık yüzeyi yoktu. TODO-1'in Tenant
için olduğu durumun aynısı.

Eklendi: [`backend/src/modules/bolum/`](backend/src/modules/bolum/) — `kisi`
modülü birebir şablon alındı (CQRS ayrımı, cursor sayfalama, üç kapı
dekoratörleri, audit + outbox).

| Uç | İzin | İşlev |
|---|---|---|
| `POST /bolumler` | `bolum.manage` | Bağımsız bölüm oluştur |
| `GET /bolumler` | `bolum.view` | Cursor sayfalamalı liste |
| `GET /bolumler/arsa-payi-durumu` | `bolum.view` | KMK md. 3 denetimi |
| `DELETE /bolumler/:id` | `bolum.manage` | Soft delete, gerekçe zorunlu |

`bolum.view` / `bolum.manage` izinleri katalogda **zaten** tanımlıydı; modül
yazılmadığı için kullanılmıyorlardı.

#### 1.2 KMK md. 3 kuralı test ediliyordu ama zorlanmıyordu

`arsaPaylariniDogrula()` — arsa paylarının toplamının tamı etmesi kuralı —
`apartman-domain` içinde tanımlıydı ve birim testi vardı (`domain.smoke.mjs`),
ancak **hiçbir uygulama kodu çağırmıyordu.** Kural belgede ve testte vardı,
çalışan sistemde yoktu.

Bu, Oturum 2'de `AI-001` kuralında görülen kusurun aynı sınıfı: kural yazılmış,
erişilebilir yere bağlanmamış. Toplam 1'den sapıyorsa yönetim planı hatalıdır ve
tahakkuk çalıştırılmamalıdır — artık `GET /bolumler/arsa-payi-durumu` bunu
raporlar.

Rapor, aggregate olarak yeniden kurulamayan kayıtları **sessizce atlamaz**;
atlarsa toplam yanlış çıkar ve rapor yalan söyler. Bu kayıtlar
`okunamayanBolumler` alanında adlarıyla döner ve `gecerli` false olur.

#### 1.3 Arsa payı JSON'da metin taşınır

DTO `arsaPayiPay` / `arsaPayiPayda` alanlarını **metin** olarak alır, `number`
olarak değil. JSON `number` çift duyarlıklı float'tır; 1/3 gibi paylarda yuvarlama
hatası doğurur ve payların toplamı KMK md. 3'ün şart koştuğu tamı tutmaz.
Sunucuda `BigInt`'e çevrilir; veritabanında da `BigInt`'tir. Gerekçe ADR-0007
(para = ölçeklenmiş `bigint`) ile aynı çizgidedir.

#### 1.4 Doğrulama domain'de kalır, serviste tekrarlanmaz

`BolumCommandService.olustur()` önce `BagimsizBolum.olustur()` çağırır; geçersiz
ölçü ya da arsa payı veritabanına **hiç ulaşmaz**. Net/brüt m² ilişkisi ve arsa
payı sınırları serviste yeniden yazılmadı — kural iki yerde yazılırsa biri eskir.

Silme kuralı: bölüm ANA_VERİ sınıfındadır, gerekçe zorunludur ve **açık borcu
olan bölüm silinemez**. Borç bölüme bağlıdır, kişiye değil (ADR v1.1 §5); açık
borçlu bölüm silinirse borç sahipsiz kalır.

#### 1.5 Event kataloğu genişletildi

`apartman.bagimsiz_bolum.olusturuldu` ve `.silindi` eklendi. Dikey **`core`
değil `apartman`**: bağımsız bölüm `apartman-domain` paketindedir ve paket
sınırı (BFS v1 §1.3) bu ayrımı zaten zorlar.

Katalog kaydı çalışma zamanında doğrulandı: iki yeni event kabul ediliyor,
kayıtsız bir üçüncüsü (`.guncellendi`) hâlâ reddediliyor. Birim testi eklendi
(57 → 58) — katalogdan düşerlerse outbox yazımı çalışma zamanında patlar,
derlemede değil.

#### 1.6 Kendi bağlantı denetleyicimde yanlış pozitif

Oturum 3'te eklenen `link-check.mjs`, satır içi kod ve kod bloklarını
atlamıyordu. DEVLOG'un kendisi — markdownlint'in ne yakalamadığını anlatırken —
örnek olarak kırık bir bağlantı **gösteriyordu**; denetleyici bunu gerçek
bağlantı sanıp `pnpm lint:md` zincirini kırmızıya düşürdü.

Düzeltildi: fenced blok ve satır içi kod, satır sayısı korunarak boşaltılır.
**N-14 negatif testi eklendi** (13 → 14): kod bloğundaki bağlantı yanlış pozitif
üretmemelidir. Her şeyi işaretleyen bir denetleyici, hiçbir şeyi işaretlemeyen
kadar bozuktur — N-5'in (boş eşleşme koruması) ters yönü.

### 2. Değiştirilen dosyalar

| Dosya | Değişiklik | Sınıf |
|---|---|---|
| `backend/src/modules/bolum/` | **YENİ** — 5 dosya (module, controller, command, query, dto) | Özellik |
| `backend/src/app.module.ts` | `BolumModule` kaydı | Bağlama |
| `shared/core-domain/src/outbox/domain-event.ts` | İki event katalog kaydı | Sözleşme |
| `tests/unit/domain.smoke.mjs` | Bölüm event kapsamı (57 → 58) | Test |
| `scripts/link-check.mjs` | Kod bloğu / satır içi kod atlanır | Düzeltme |
| `scripts/negative-tests.sh` | N-14 (13 → 14) | Zorlama |

### 3. Bu oturumda çalıştırılmayanlar

- Modülün uçtan uca davranışı — PostgreSQL gerektirir (TODO-3). Derleme, lint,
  paket sınırı ve dairesel bağımlılık denetimlerinden geçti; **HTTP uçları
  gerçek bir veritabanına karşı hiç çağrılmadı.**
- `pnpm test:contract` · `pnpm dev`.

---

## 2026-07-27 · Oturum 3 — Belge tutarlılığı ve bağlantı denetimi

**Kapsam:** TODO-6 · `VALIDATION_REPORT.md` güncellemesi
**Sonuç:** Belge doğrulaması zorlanır hale geldi · 13 negatif test (12 → 13)
**Önceki durum:** Oturum 2 — kod tarafı yeşil, belgeler Faz 0'da kalmıştı

### 1. Yapılan işler

#### 1.1 TODO-6'daki her iddia önce doğrulandı

Belgeye güvenilmedi; dört iddianın dördü de kaynaktan teyit edildi ve düzeltildi.

| İddia | Doğrulama | Düzeltme |
|---|---|---|
| README'de iki kırık ADR bağlantısı | Dosya adları karşılaştırıldı | `0003-muhasebe-cift-tarafli.md` · `0005-finansal-ozet-onbellek.md` |
| `FAZ-0-DURUM.md` bayat yollar | `docker-compose.yml` kökte, `database/init/` gerçek | `docker/…` → gerçek yollar; `packages/shared-kernel` → `shared/kernel` |
| Aynı belge "0001 … 0006" diyor | `ls docs/adr/log/` → 7 ADR | "0001 … 0007 · Yedi karar kaydı" |
| TypeScript 6.0.3 iddiası | Kurulu sürüm 5.9.3, `package.json` `^5.6.0` | 5.9.3 yazıldı |

Sayım tutarsızlığı da giderildi: §7 kriter 4 "49 birim + 10 negatif + 22 belge"
diyordu; gerçek değerler **57 + 12 + 25**.

#### 1.2 Kırık bağlantı sınıfı artık zorlanıyor

TODO-6'nın kalemleri tek tek düzeltilebilirdi; ancak aynı sınıf hata bu depoda
**iki kez** gerçekleşti. `markdownlint` biçimi denetler, **hedefi denetlemez** —
`[0003](docs/adr/log/olmayan-dosya.md)` biçimsel olarak kusursuzdur.

Eklendi: [`scripts/link-check.mjs`](scripts/link-check.mjs). Diğer
`scripts/*.mjs` ile aynı sözleşmeyi izler — `fileURLToPath` ile kök hesabı, boş
tarama koruması, ihlalde çıkış kodu 1. `pnpm lint:md` artık markdownlint'ten
sonra bunu da koşar; ayrıca `pnpm verify:links` olarak tek başına çağrılabilir.

**N-13 negatif testi eklendi** (12 → 13). Denetleyicinin gerçekten yakaladığı,
kasıtlı kırık bağlantı enjekte edilerek kanıtlandı — projenin kendi kuralı:
*hiçbir şey denetlemeyen bir kontrol de yeşil yanar.*

#### 1.3 Çift kopya sorunu: soyut bir risk değil, gerçekleşmiş bir hata

`VALIDATION_REPORT.md` kökte ve `docs/` altında byte-eş duruyordu. Yeni
denetleyici ilk koşusunda bunun somut sonucunu buldu: belge içindeki
`adr/log/0007-para-tipi-bigint.md` göreli bağlantısı, **iki farklı dizin
derinliğinde aynı anda doğru olamaz**. Kopyaların birinde her zaman kırıktı.

Kanıt niteliğinde olan: hiçbir belge `docs/` kopyasına bağlanmıyordu — README ve
DEVLOG dahil tüm gelen bağlantılar kök kopyaya gidiyor. Kopya yetimdi.

`docs/VALIDATION_REPORT.md` bir **yönlendirme belgesine** indirgendi; kök kopya
tek kaynaktır ve bağlantısı `docs/adr/log/…` olarak düzeltildi.

#### 1.4 `VALIDATION_REPORT.md` Oturum 1–2 gerçekliğine güncellendi

§5'in beş kaleminden dördü (§5.1, §5.1b, §5.2, §5.3, §5.5) **kapandı** olarak
işaretlendi; her birine ne bulduğu yazıldı. §5.4 tek açık kalem olarak öne
çıkarıldı. §5.6 (GitHub Actions) **kısmen açık**: depo push edilmiş durumda,
ancak `gh` kurulu olmadığı için CI'ın gerçekten yeşil olduğu bu ortamdan
doğrulanamadı — bu açıkça yazıldı, varsayılmadı.

§6'ya ters yönde kanıt eklendi: Faz 0'da taban katman asıl kaynağı yakalamıştı;
Oturum 2'de asıl kaynak katmanı, taban katmanın **göremeyeceği** dört kusur
buldu. İki katman simetriktir.

#### 1.5 Küçük temizlik

`frontend/web/{app,components,lib,messages,public}` — PowerShell'de genişlemeyen
brace-expansion artığı, boş klasör olarak duruyordu. Gerçek klasörlerin beşi de
ayrıca mevcut olduğu için silindi.

### 2. Değiştirilen dosyalar

| Dosya | Değişiklik | Sınıf |
|---|---|---|
| `scripts/link-check.mjs` | **YENİ** — bağlantı denetleyicisi | Zorlama |
| `scripts/negative-tests.sh` | N-13 eklendi | Zorlama |
| `package.json` | `verify:links`; `lint:md` zincire bağlandı | Zorlama |
| `docs/VALIDATION_REPORT.md` | Byte-eş kopya → yönlendirme belgesi | Belge |
| `VALIDATION_REPORT.md` | §1, §5.1–§5.6, §6, §9 güncellendi; sayımlar ve ADR bağlantısı düzeltildi | Belge |
| `README.md` | İki kırık ADR bağlantısı | Belge |
| `docs/FAZ-0-DURUM.md` | Bayat yollar, ADR sayısı | Belge |
| `frontend/web/{app,…}/` | **SİLİNDİ** — brace-expansion artığı | Temizlik |

### 3. Bu oturumda çalıştırılmayanlar

- `pnpm test:contract` — PostgreSQL gerektirir (TODO-3).
- CI koşum sonucu — `gh` kurulu değil.

---

## 2026-07-27 · Oturum 2 — Doğrulama katmanının kapatılması

**Kapsam:** TODO-1 doğrulaması · TODO-2 · TODO-4 · `VALIDATION_REPORT.md` §5.2, §5.3, §5.5
**Sonuç:** Derlenen 9 paketin 9'u yeşil · ESLint 0 hata · CT-12 yeşil · 12/12 negatif test
**Önceki durum:** Oturum 1 — build TODO-1 ile bloke, ESLint 44 hata, üç doğrulama hiç koşmamış

### 1. Yapılan işler

#### 1.1 Kapanan doğrulamalar

| Doğrulama | Rapordaki madde | Oturum 1 | Oturum 2 |
|---|---|---|---|
| `pnpm -r build` | — | 8/9 | ✅ **9/9** |
| ESLint | §5.2 | ❌ 44 hata | ✅ **0 hata** |
| dependency-cruiser | §5.3 | ✅ 0 ihlal | ✅ 0 ihlal (1 bulundu, düzeltildi) |
| **vitest — CT-12** | §5.5 | ⛔ koşulmadı | ✅ **5/5** |
| Negatif testler | — | ⛔ `bash` yok | ✅ **12/12** |
| Birim testleri | — | ✅ 57/57 | ✅ 57/57 |
| `pnpm verify` | — | ✅ 7 adım | ✅ 7 adım |

`VALIDATION_REPORT.md` §5'teki beş kalemden **dördü kapandı**. Yalnızca §5.4
(PostgreSQL) açık — Docker hâlâ kurulu değil.

#### 1.2 Üç doğrulama ilk kez koştuğunda dört gerçek kusur buldu

Hiçbiri Oturum 1'in bağımlılıksız katmanınca yakalanamazdı; üçü ancak
**AST/çalışma zamanı** analiziyle görülebilir.

**Kusur 1 — `AI-001` kuralı hiçbir zaman tetiklenemiyordu.** (vitest · CT-12)

ADR-0004'ün başlık kuralı — *"AI ajanları kayıt atamaz; öneri üretir ve adı
geçen bir insan işler"* — `kayit.yaz`, `odeme.yurut`, `tahakkuk.isle`
eylemlerini engelliyordu. Ancak boru hattının tek çağrı noktası
([`ai-pipeline.ts`](shared/bnos-client/src/ai-pipeline.ts)) yalnızca
`oneri.uret` veya `okuma` talep ediyordu. Kesişim **boş**: kural ölü koddu ve
bir AGENT principal'ı için LLM gerçekten çağrılıyordu.

`EYLEM_ONERISI` niyeti artık yazma sınıfını da açıkça beyan eder
(`['oneri.uret', 'kayit.yaz']`), böylece BRE **üretimden önce** karar verebilir.
Kural verisi değişmedi; eksik olan boru hattının beyanıydı.

**Kusur 2 — deterministik niyet sınıflandırması Türkçe metinde çalışmıyordu.**
(vitest · CT-12)

Desenler ASCII yazılmıştı (`olustur`), girdi ise Türkçeydi (`oluştur`).
Eşleşme olmayınca sınıflandırma `BILINMIYOR` dönüyor ve istek **LLM'e
düşüyordu** — yani ADR-0004'ün "LLM hiçbir zaman ilk bileşen değildir"
güvencesini koruyan deterministik katman, Türkçe bir üründe sessizce devre
dışıydı. Karşılaştırma artık NFD ayrıştırma + birleşik işaret atma + `ı`
eşlemesiyle ASCII'ye katlanarak yapılır.

Bu iki kusur birbirini gizliyordu: kusur 2 niyeti `BILINMIYOR` yaptığı için
kusur 1'in yol açtığı yazma talebi hiç oluşmuyordu.

**Kusur 3 — dairesel bağımlılık.** (dependency-cruiser)

`decorators/index.ts` → `current-user.decorator.ts` → `decorators/index.ts`.
`CurrentUser`, `AktifPrincipal`'ın iki satırlık takma adıydı; yalnızca
`tenant.controller.ts` bu adı kullanıyordu, kod tabanının geri kalanı
`AktifPrincipal` diyordu. Controller kod tabanının kendi adına geçirildi, shim
dosyası kaldırıldı. Döngü de çift isim de gitti.

Bu, `boundary.mjs`'in **yapamadığı** analizdir — §5.3 bunu açıkça
"bağımlılıksız betikte yoktur" diye kaydetmişti. İlk gerçek getirisi budur.

**Kusur 4 — hata gövdesi `[object Object]` sızdırabiliyordu.** (ESLint
`no-base-to-string`)

[`problem-details.filter.ts`](backend/src/common/errors/problem-details.filter.ts)
`String(govde['mesaj'] ?? …)` yazıyordu; `govde` alanları `unknown`. Nesne
taşıyan bir `HttpException` gövdesi, kullanıcıya dönen RFC 7807 `detail`
alanına `"[object Object]"` olarak yazılırdı — BFS v1 §12'nin "tek net sonraki
eylem" kuralının sessiz ihlali. Artık yalnızca gerçek metin kabul edilir,
gerisi geri düşüşe bırakılır.

#### 1.3 ESLint 44 → 0

| Sınıf | Adet | Çözüm |
|---|---|---|
| `bnos/require-tenant-cache-key` yanlış pozitifi | 3 | Kural değil kod işaretlendi — aşağıya bakınız |
| Sözleşme testlerinde `any` | 28 | Gerçek tipler verildi — aşağıya bakınız |
| Parse hatası (tsconfig dışı dosyalar) | 5 | Araç dosyaları için tip-farkında lint kapatıldı |
| `no-unnecessary-type-assertion` | 3 | Assertion'lar kaldırıldı |
| `no-unsafe-*` (i18n dinamik import) | 2 | `MesajAgaci` tipi tanımlandı |
| İlk koşuda görünmeyenler (parse hatası ardında saklıydı) | 3 | `no-base-to-string` (2), `consistent-type-imports` (1) |

**Önbellek anahtarı kuralı (TODO-2'nin mimari kısmı).** Kural AST tabanlıdır ve
markalı tipi göremez; `OnbellekServisi` imzaları **zaten** `OnbellekAnahtari`
alır, ham string geçmek derlenmez. Zorlama tip düzeyinde yapıldığı için üç çağrı
gerekçeli `eslint-disable-next-line` ile işaretlendi. Kuralı gevşetmek, gerçek
ihlalleri de kaçırmasına yol açardı; kod değiştirmek ise markalı tipin sağladığı
garantiyi tekrarlamak olurdu. ADR gerektirecek bir sapma değildir — kuralın
kapsamı ile tip sisteminin kapsamı farklıdır.

**Sözleşme testlerindeki `any`.** Yalnızca susturmak yerine gerçek tipler
verildi: `getHttpServer()` → `node:http` `Server`, yanıt gövdeleri için
`GirisYaniti`/`HataYaniti` arayüzleri, `tx: any` → `Prisma.TransactionClient`.
Sonuncusu önemlidir: `any` iken `tx.kisi` yazım hatası derlemeden geçer ve
CT-01 hiçbir şey doğrulamadan yeşil yanardı.

#### 1.4 `vitest.config.ts` — Oturum 1 kök nedeninin altıncı kopyası

Alias'lar `new URL(...).pathname` ile hesaplanıyordu; Windows'ta bu `/C:/...`
döndürür. Oturum 1'de dört `scripts/*.mjs` dosyasında düzeltilen hatanın aynısı
burada duruyordu ve CT-12'nin `@bnos/*` import'larını çözmesini engelliyordu.
`fileURLToPath`'e çevrildi.

#### 1.5 Belgelenmiş bir telafinin gerçek olmadığı görüldü

`VALIDATION_REPORT.md` §5.5, CT-12'nin telafisi olarak *"AI sırası davranışı
`tests/unit/domain.smoke.mjs` içinde `node:test` ile kısmen kapsanmıştır"*
diyor. Birim testlerinde `niyetiCoz`, `BnosAiPipeline` veya `bnos-client`
geçen **tek bir satır yoktur**. AI boru hattının bu oturuma kadar hiç test
kapsamı olmamıştı — ve kapsam gelir gelmez iki kusur çıktı.

### 2. Değiştirilen dosyalar

| Dosya | Değişiklik | Sınıf |
|---|---|---|
| `shared/bnos-client/src/ai-pipeline.ts` | ASCII katlama; `EYLEM_ONERISI` yazma sınıfını beyan eder | **Davranış** |
| `backend/src/common/errors/problem-details.filter.ts` | `metinVeyaYok()`; `String()` zorlaması kaldırıldı | **Davranış** |
| `backend/src/modules/tenant/tenant.controller.ts` | `CurrentUser` → `AktifPrincipal` | Yapı |
| `backend/src/common/decorators/index.ts` | Shim re-export'u kaldırıldı | Yapı |
| `backend/src/common/decorators/current-user.decorator.ts` | **SİLİNDİ** — dairesel bağımlılık | Yapı |
| `backend/src/common/prisma/cache.service.ts` | 3 gerekçeli `eslint-disable` | Lint |
| `backend/src/modules/tenant/tenant.command.service.ts` | Gereksiz assertion'lar kaldırıldı | Tip |
| `backend/src/modules/tenant/tenant.query.service.ts` | Kullanılmayan `_principal` gerekçelendirildi | Lint |
| `backend/src/common/context/correlation.interceptor.ts` | Gereksiz assertion kaldırıldı | Tip |
| `backend/test/contract/oturum.spec.ts` | `Server` + gövde arayüzleri | Test tipi |
| `backend/test/contract/rls-izolasyon.spec.ts` | `Prisma.TransactionClient` | Test tipi |
| `backend/vitest.config.ts` | `fileURLToPath` | Windows uyumu |
| `frontend/web/lib/i18n.ts` | `MesajAgaci` tipi | Tip |
| `eslint.config.js` | `tests/.derleme` ignore; araç dosyaları için tip denetimi kapalı | Lint yapılandırması |

`tenant.command.service.ts`'deki assertion'lar yalnızca gereksiz değil,
**yanlıştı**: `kayit.tip as 'APARTMAN'` bir SITE kaydını da APARTMAN olarak
tipliyordu. Prisma enum'ları `TenantTipi`/`TenantDurumu` union'larıyla birebir
örtüştüğü için assertion'sız hâli hem derleniyor hem doğruyu söylüyor.

### 3. Bu oturumda çalıştırılmayanlar

- `pnpm test:contract` — PostgreSQL gerektirir (TODO-3).
- `pnpm lint:md` — belge lint.
- `pnpm dev` — backend artık derlendiği için başlatılabilir; denenmedi.

---

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

> **Oturum 2 düzeltmesi:** Buradaki "10 paketten 9'u" ifadesi `@bnos/mobile`'ı da
> sayıyordu; o pakette `build` script'i yoktur. Doğru sayı 9 derlenen paketin
> 8'idir.

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

### ~~TODO-1~~ · `TenantModule` ve `TenantController` — **KAPANDI (Oturum 2)**

Modül, controller ve DTO'lar yazıldı; `pnpm -r build` tümüyle yeşil. Controller
`AktifPrincipal` ve `RequirePermission` dekoratörlerini `kisi` şablonuyla aynı
biçimde kullanır. Oturum 2, eklenen kodda bir dairesel bağımlılık ve iki
gereksiz tip assertion'ı temizledi.

### ~~TODO-2~~ · ESLint 44 hata — **KAPANDI (Oturum 2)**

44 → 0. Dağılım ve gerekçeler Oturum 2 §1.3'te. Mimari karar gerektiren tek
kalem olan `bnos/require-tenant-cache-key`, kural gevşetilmeden çözüldü:
`OnbellekServisi` imzaları markalı tip zorladığı için üç çağrı gerekçeli
`eslint-disable` ile işaretlendi. Ayrı bir ADR gerektirmez.

### TODO-3 · Docker + PostgreSQL — RLS'in çalışma zamanı kanıtı

**Öncelik: yüksek.** `VALIDATION_REPORT.md` §5.4'te **orta risk** olarak işaretli.

Docker kurulu değil; WSL çekirdeği var ama kurulu dağıtım yok. Kurulmadan
`docker compose up -d postgres redis minio` çalışmaz, dolayısıyla:

- **CT-01** — tenant izolasyonu, RLS altında çapraz okuma reddedilir
- **CT-11** — uygulama rolünün `BYPASSRLS` yetkisi yok
- **CT-06** — kısmi unique index, audit değiştirilemezliği

koşulamıyor. Devir notu bunu açıkça şarta bağlıyor: *"RLS'in gerçekten izole
ettiği kanıtlanmadan Blok-1'in ilerisine geçilmemelidir."*

**Docker'ı bekleyen test borcu** (Docker kurulduğunda sırayla koşulacaklar):

| Test | Kaynak | Durum |
|---|---|---|
| CT-01 · tenant izolasyonu | `rls-izolasyon.spec.ts` | Yazılmış, tipleri temiz (Oturum 2) |
| CT-11 · `BYPASSRLS` yetkisi yok | `rls-izolasyon.spec.ts` | Yazılmış |
| CT-06 · kısmi unique index, audit değişmezliği | `silme-standardi.spec.ts` | Yazılmış |
| CT-04 · üç kapı | `oturum.spec.ts` | Yazılmış, tipleri temiz (Oturum 2) |
| CT-13/CT-14 · numaralandırma, kullanıcı sayımı | `numaralandirma.spec.ts` · `oturum.spec.ts` | Yazılmış |
| **Bölüm modülü uçtan uca** | **YAZILMADI** | Oturum 4'te eklenen 4 uç hiç çağrılmadı |
| **İlişki modülü uçtan uca** | **YAZILMADI** | Oturum 5'te eklenen 3 uç hiç çağrılmadı |
| **Çapraz tenant `blokId` reddi** | **YAZILMADI** | Oturum 6 · RLS'in kapsamadığı yüzey — aşağıya bakınız |

Son satır bu oturumun bıraktığı borçtur: `BolumModule` derleme, lint, paket
sınırı ve dairesel bağımlılık denetimlerinden geçti, ancak **gerçek bir
veritabanına karşı hiç çalıştırılmadı.** Özellikle doğrulanmamış olanlar:

- Soft delete uzantısının bölüm listesini de merkezî filtrelediği
- Açık borçlu bölümün gerçekten silinemediği (`Borc` ilişkisi üzerinden)
- Aynı blokta mükerrer kapı no kontrolünün çalıştığı — bu kontrolün DB
  kısıtı **yoktur**, dar bir yarış penceresi taşır (kalıcı çözüm:
  `(tenant_id, blok_id, kapi_no)` kısmi unique index, migration gerektirir)
- `arsa-payi-durumu` ucunun gerçek veride doğru toplam ürettiği
- **(Oturum 5)** Malik/kiracı çakışma kuralının eşzamanlı istekte de tuttuğu.
  Kural birim düzeyinde kanıtlıdır ancak DB kısıtı **yoktur**; kalıcı çözüm
  `EXCLUDE USING gist` ile örtüşme dışlayan bir constraint'tir ve migration
  gerektirir. Yarış kazanılırsa iki geçerli malik oluşur ve borç sessizce
  yanlış kişiye yazılır
- **(Oturum 6) Çapraz tenant `blokId` reddi — RLS'in kapsamadığı yüzey.**
  PostgreSQL referans bütünlüğü tetikleyicileri tablo sahibi yetkisiyle çalışır
  ve **RLS'i baypas eder**; yabancı anahtar kısıtı çapraz tenant referansı
  yakalamaz. Koruma yalnızca uygulama katmanındadır. Bu, CT-01'in kapsamadığı
  bir izolasyon senaryosudur ve **kendi sözleşme testini hak eder**: tenant A'nın
  bölümü, tenant B'nin blok kimliğiyle oluşturulmaya çalışıldığında reddedilmeli.

  Bugün uygulama katmanında doğrulanan referanslar: `BagimsizBolum.blokId`
  (Oturum 6), `BolumIliskisi.bolumId` ve `BolumIliskisi.kisiId` (Oturum 5).
  **Kural genel olmalıdır:** tenant sınırını aşan her yabancı anahtar, yazılmadan
  önce sahiplik açısından doğrulanmalıdır. Sonraki modüller (`Borc.bolumId`,
  `BorcSorumlusu.kisiId`, `YevmiyeSatiri.hesapId`) aynı kontrolü taşımak
  zorundadır; unutulursa hata sessizdir

Oturum 2'nin dersi burada geçerlidir: **hiç koşmamış bir test yeşil sayılamaz** —
CT-12 ilk koştuğunda 2/5 başarısızdı.

### TODO-4 · `bash` PATH'e alınmalı — **kısmen kapandı (Oturum 2)**

**Öncelik: düşük.** 12 negatif test Oturum 2'de Git Bash ile doğrudan koşuldu ve
**12/12 geçti**; denetleyicilerin gerçekten denetlediği kanıtlandı. Ancak
`C:\Program Files\Git\bin\bash.exe` hâlâ `PATH`'te değil, dolayısıyla PowerShell
üzerinden `pnpm test:negative` ve `pnpm setup` çalışmıyor. Koşum komutu:

```bash
TSC="$PWD/node_modules/.bin/tsc" bash scripts/negative-tests.sh
```

`TSC` değişkeni gerekir: betik varsayılan olarak `tsc` çağırır, o da `PATH`'te
değildir.

**Küçük kusur:** N-1 testi `shared/kernel/src/__neg.ts` dosyasını silerken
derlenmiş çıktısını (`shared/kernel/dist/__neg.*`) bırakıyor. `dist/`
`.gitignore` kapsamındadır, dolayısıyla depoyu kirletmez; yine de betik
kendi artığını temizlemelidir.

### ~~TODO-5~~ · Sürüm kontrolü — **KAPANDI**

Proje artık bir git deposu (`master`, `origin` tanımlı).

### TODO-6 · Belge tutarsızlıkları

**Öncelik: düşük.** Oturum 1 analizinde tespit edilenler:

**Oturum 3'te kapatılanlar** — ✅ README'deki iki kırık ADR bağlantısı ·
✅ `FAZ-0-DURUM.md` bayat yolları ve ADR sayısı · ✅ `VALIDATION_REPORT.md`
sayım tutarsızlığı, TypeScript sürümü ve §5.5 telafi iddiası ·
✅ `VALIDATION_REPORT.md` çift kopyası · ✅ brace-expansion artığı.

Kırık bağlantı sınıfı artık [`scripts/link-check.mjs`](scripts/link-check.mjs)
ile zorlanıyor ve N-13 negatif testiyle kanıtlanıyor — tek tek düzeltmek yerine
sınıfın tamamı kapatıldı.

**Açık kalanlar:**

- `.github/workflows/*` ile `infrastructure/github/workflows/*` **byte-eş**.
  GitHub yalnızca `.github/` altını okur; `infrastructure/` kopyası ölüdür ve
  sessizce ayrışabilir. README `infrastructure/` dizinini listelediği için
  kopyanın bir dağıtım/arşiv amacı olup olmadığı belirsizdir — **sahibine
  sorulmalı**, körlemesine silinmemeli. (Oturum 3'te bilinçli olarak
  dokunulmadı.)
- Spesifikasyon belgelerinde yaygın `packages/` referansları:
  `docs/bfs/BFS-v1.md`, `docs/ais/AIS-v1.md`, `docs/BASELINE.md`,
  `docs/IMPLEMENTATION-ROADMAP.md`, `docs/compliance/03-EKSIKLER-BACKLOG.md`.
  Proje `packages/` → `shared/` taşındı ama bu belgeler güncellenmedi.
  **Bunlar sürümlenmiş standart belgeleridir** (BFS v1, AIS v1) ve
  `docs/adr/log/0007` **append-only karar günlüğüdür** — sessizce yeniden
  yazılmaları kaydı bozar. Düzeltme yerine bir "yol sözlüğü" eki ya da yeni
  sürüm (BFS v1.1) uygun olabilir; bu bir karardır, düzeltme değil.
- Boş klasörler: `backend/test/integration/`, `frontend/web/components/`,
  `frontend/web/public/`, `infrastructure/k8s/` (sonuncusu README'de listeli).
  Git boş klasör izlemez; bunlar yalnızca yerel dosya sisteminde vardır.
  Yer tutucu oldukları için bırakıldı.

### TODO-7 · Engelleyici, teknik olmayan — C-4 hukuki görüş

**Öncelik: kritik, ancak teknik ekip çözemez.** KMK emredici hükümler, genel kurul
yeter sayısı ve vekalet sınırları. Sprint 3'ü bloke ediyor; 11 haftalık pencere
tüketiliyor. Faz 0 ile paralel başlatılmalıydı.

---

## Next Session

**Başlangıç noktası:** Veritabanı gerektirmeyen her doğrulama yeşil. Build 9/9
(`@bnos/mobile`'ın build script'i yoktur), ESLint 0, dependency-cruiser 0 ihlal
(259 modül), **68 birim + 14 negatif** + 5 CT-12 testi geçiyor; belge lint ve
bağlantı denetimi 0 hata. **Tek açık teknik engel TODO-3'tür (Docker).**

Modüller: `health` · `oturum` · `tenant` · `kisi` · `bolum` (Oturum 4) ·
`iliski` (Oturum 5) · **`blok`** (Oturum 6).

Zincirin bugünkü hâli: giriş → tenant → kişi → blok → bölüm → malik/kiracı
ilişkisi.

**Sıradaki halka şema değişikliği gerektiriyor.** `paylastir.ts` ve
`borcSorumlulariniCoz()` domain'de hazır ve artık besleyecek verisi de var;
ancak `GiderTuru` ve `Tahakkuk` için **Prisma modeli yoktur**. `Borc` yalnızca
`giderTuruKodu` metnini taşır, karşılığında tablo bulunmaz — dolayısıyla
yönetim planı / genel kurul kaynaklı override'lar saklanamaz.

Bu, migration yazmayı gerektirir; migration ise PostgreSQL olmadan üretilemez ve
doğrulanamaz (her migration RLS bloğu taşımak zorundadır). **Bu yüzden gider ve
tahakkuk halkası TODO-3'e bağlıdır** ve Docker kurulmadan başlanmamalıdır.

### Ortamı geri kazanma

Yeni bir terminalde `pnpm` görünmüyorsa terminali kapatıp açın — `PATH` girdisi
kullanıcı registry'sine yazıldı, halihazırda açık süreçler eski ortamı miras alır.

```bash
pnpm --version   # 9.12.0 beklenir
pnpm verify      # 7 adım, tümü GECTI beklenir
pnpm -r build    # 9 paket, hepsi Done beklenir
pnpm lint        # 0 hata beklenir
pnpm lint:md     # markdownlint 0 + kırık bağlantı 0 beklenir
```

`bash` `PATH`'te olmadığı için negatif testler şu komutla koşulur:

```bash
TSC="$PWD/node_modules/.bin/tsc" bash scripts/negative-tests.sh   # 14/14
```

### Önerilen sıra

1. **TODO-3 — tek gerçek engel.** Docker Desktop + bir WSL dağıtımı kurulduktan
   sonra `pnpm db:up && pnpm db:migrate && pnpm db:seed`, ardından TODO-3'teki
   test borcu tablosu baştan sona koşulmalı. Sözleşme testlerinin tip hataları
   Oturum 2'de temizlendi; PostgreSQL ayağa kalkar kalkmaz koşabilir durumdalar.
   **Blok-1 bundan önce kapatılmış sayılmamalıdır.**

   Öncelikli yeni borç: **`bolum` modülü için sözleşme testi yazılmalı.**
   Oturum 4'te eklenen dört uç gerçek veritabanına karşı hiç çağrılmadı;
   özellikle mükerrer kapı no kontrolünün DB kısıtı yoktur ve yarış penceresi
   taşır.
2. **Oturum 2'nin iki davranış değişikliği gözden geçirilmeli.** Her ikisi de
   ADR-0004 uyumunu geri getirir ancak boru hattı davranışını değiştirir:
   `EYLEM_ONERISI` artık `kayit.yaz` talep eder (AI-001 tetiklenebilir hale
   geldi) ve niyet eşleştirmesi ASCII'ye katlanır. İkincisi daha çok isteği
   deterministik katmanda tutar — LLM'e düşen istek oranının azalması beklenir.
3. **CI'ın gerçekten yeşil olduğu teyit edilmeli.** Depo `origin`'e push
   edilmiş durumda ancak koşum sonucu doğrulanmadı — `gh` kurulu değil
   (`VALIDATION_REPORT.md` §5.6). GitHub Actions sekmesinden bakılmalı.

   `link-check.mjs` CI'a **zaten bağlıdır**: `ci.yml` `belge` işi
   `pnpm lint:md` çağırır, o da markdownlint'ten sonra betiği koşar.
   Mimari olarak daha doğru yeri `mimari` işidir — betik bağımlılıksızdır ve
   o iş `pnpm install` beklemeden koşar (§6 tasarımı: *bağımlılıksız doğrulama
   CI'ın ilk işidir*). Taşınmadı, çünkü `.github/workflows/*` ile
   `infrastructure/github/workflows/*` byte-eştir; yalnızca birini düzenlemek
   TODO-6'da ertelenen ayrışmayı başlatırdı. Kopya sorunu çözülünce taşınmalı.
4. **`pnpm dev` denenmeli.** Backend ilk kez derleniyor; uçtan uca çalıştığı
   henüz görülmedi. Redis ve PostgreSQL gerekeceği için TODO-3'e bağlıdır.
5. **TODO-6** — belge tutarsızlıkları; ucuz ve birikiyor.

### Dikkat edilecekler

- `database/prisma/schema.prisma` Oturum 1'de biçimsel olarak değişti. Enum
  değerleri aynıdır; `migration.sql` ile karşılaştırırken bunu göz önünde tutun.
- `scripts/*.mjs` **ve** `backend/vitest.config.ts` artık Windows'ta çalışıyor.
  POSIX davranışı korundu (junction yalnızca `win32`'de, göreli symlink diğer
  platformlarda). `new URL(...).pathname` kalıbı bu kod tabanında altı kez
  tekrarlanmıştı — yeni bir dosyada görülürse aynı hatadır.
- `.env` gerçek bir rastgele `JWT_SECRET` taşıyor ve `.gitignore` kapsamındadır;
  depoya girmemelidir.
- **`CurrentUser` dekoratörü artık yoktur.** Tek ad `AktifPrincipal`'dır. Yeni
  controller'lar `../../common/decorators` barrel'ından import etmelidir; bir
  alias dosyası eklemek dairesel bağımlılık üretir (Oturum 2, kusur 3).
- ESLint araç dosyalarını (`eslint.config.js`, `tools/eslint-rules/*.js`,
  `*.cjs`, `vitest.config.ts`) tip denetimi olmadan lint eder. Bu dosyalara
  uygulama kodu taşınmamalıdır — tip-farkında kurallar orada koşmaz.

---

*İlgili belgeler:* [`README.md`](README.md) · [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) · [`docs/FAZ-0-DURUM.md`](docs/FAZ-0-DURUM.md) · [`docs/IMPLEMENTATION-ROADMAP.md`](docs/IMPLEMENTATION-ROADMAP.md)
