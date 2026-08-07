# İki ADR Serisi Arasındaki İlişki — envanter ve fark analizi

**Tarih:** 6 Ağustos 2026 · **Kapsam:** `[ORTAK]`

Bu belge **karar vermez**. Envanter çıkarır, çakışmaları işaret eder,
ölçülebilenleri ölçer ve ölçülemeyenleri **ölçülemedi** diye yazar.

---

## ⛔ ÖNCE BU: SERİ B'YE ERİŞİMİM YOK

**Seri B (ADR-100…146) bu depoda BULUNMUYOR** ve claude.ai Proje
bilgisine erişemiyorum (Claude Code yalnızca depoda çalışır).

Ölçüldü:

```text
docs/adr/log/   → 0001…0018 (0012 eksik) + README
depo genelinde  → "ADR-1[0-4][0-9]" deseni: 0 eşleşme
son 24 saatte   → proje klasöründe değişen dosya: 0
```

★ **Bu, tarifin öngördüğü bulgunun kendisidir:** *"Seri B'nin bir kısmı
depoda YOK olabilir."* Ölçüm: **tamamı yok.**

**Sonucu:** aşağıdaki bölümlerde Seri B tarafı **yalnızca görev tarifinde
verilen başlıklarla** temsil edilir. Karar metinlerini görmediğim için
*"çelişiyor"* diyemem — yalnızca **"çakışma yüzeyi var, metin gerekli"**
diyebilirim. Bu ayrım her tabloda korunmuştur.

⚠️ Bu belgeyi tamamlamak için Seri B metinleri depoya konmalı
(`docs/reference/adr-platform/` gibi) ya da sohbete aktarılmalıdır.

---

## 1 · Envanter

### Seri A — depoda, ölçüldü

Konum: `docs/adr/log/` · **17 dosya** (0012 numarası **hiç kullanılmamış**)

| ADR | Kapsam | Statü | Başlık |
|---|---|---|---|
| 0001 | `[ORTAK]` | kabul edildi | ADR sürüm hiyerarşisi |
| 0002 | `[ORTAK]` | kabul edildi | Tenant modeli — tenant = apartman |
| 0003 | `[SITE]` | kabul edildi | Muhasebe mimarisi — çift taraflı defter |
| 0004 | `[ORTAK]` | kabul edildi | AI yürütme sırası |
| 0005 | `[ORTAK]` | kabul edildi | Finansal özetler önbelleklenmez |
| 0006 | `[ORTAK]` | kabul edildi *(yeniden tanımlandı)* | Üç kapı — korumalı endpoint zinciri |
| 0007 | `[ORTAK]` | kabul edildi | Para tipi — ölçeklenmiş bigint |
| 0008 | `[ORTAK]` | kabul edildi | Tenant = yönetilen yerleşke |
| 0009 | `[ORTAK]` | kabul edildi | Yönetim şirketi = tenant + açık devir |
| 0010 | `[ORTAK]` | kabul edildi | Cari hesap = bağımsız bölüm yardımcı defteri |
| 0011 | `[ORTAK]` | kabul edildi | Satır kapsamı oturum ayarıyla taşınır |
| 0013 | `[ORTAK]` | 🟡 taslak *(desen kabul)* | Toplu işlemlerin partilenmesi |
| 0014 | `[ORTAK]` | kabul edildi | Mükerrer tahakkuk koruması = veritabanı kısıtı |
| 0015 | `[SITE]` | 🟡 **KARAR YOK** | Yıl sonu kapanışı |
| 0016 | `[ORTAK]` | 🟡 **KARAR YOK** | Virman — üç ayrı tür |
| 0017 | `[SITE]` | 🟢 karara bağlandı | Tahakkukun muhasebeleştirilmesi |
| 0018 | `[ORTAK]` | 🟠 onay bekliyor | Kişi ekstresi paylaşım semantiği |

Ek olarak depoda iki toplu belge: `BNOS-Apartman-Mimari-Karar-Kaydi-v0.1`
ve `-v1.1` (§ numaralı, ADR numaralı değil).

### Seri B — depoda YOK

| ADR | Konu *(görev tarifinden)* | Depoda | Metin görüldü mü |
|---|---|---|---|
| 100–108 | Platform çekirdeği · .NET varsayımı | ❌ | ❌ |
| 103 | İş kuralları motoru | ❌ | ❌ |
| 106 · 124 | Yetkilendirme / izin | ❌ | ❌ |
| 107 | Multi-Tenant Architecture (Law 1) | ❌ | ❌ |
| 108 · 122 | Olay yönetimi / outbox | ❌ | ❌ |
| 113 | Technology Agnostic + Conformance Profile | ❌ | ❌ |
| 118 | Yönetişim — GV32 sekiz alan | ❌ | ❌ |
| 125 | Denetim kaydı / audit | ❌ | ❌ |
| 127 | Bildirim | ❌ | ❌ |
| 128 | Tenant çözümleme | ❌ | ❌ |
| 146 | İş kuralları (ikinci) | ❌ | ❌ |

İlgili raporlar da depoda **yok**: `Uyum_Denetim_Raporu_Sprint08`,
`Terim_Statu_Envanteri_Rev_1_1`, `Terminoloji_Yonetisimi_Uyum_Raporu`,
`00-FIX-RAPORU`.

---

## 2 · Kapsam çakışması

⚠️ **Sağ sütun metin görülmeden doldurulamaz.** Aşağıda Seri A'nın kararı
**ölçülmüş** olarak verilir; Seri B sütunu boştur ve *"çelişiyor mu"*
sorusu **cevaplanamaz** — tahmin edilmez.

| Konu | Seri A'daki karar (ölçüldü) | Seri B | Çelişiyor mu |
|---|---|---|---|
| **Çok kiracılılık** | ADR-0002 · PostgreSQL **RLS**, `bnos_app`/`bnos_migrator` **NOBYPASSRLS**, `app_tenant_id()` ayarsızsa **hata fırlatır**, `FORCE ROW LEVEL SECURITY`. Koruma **veri katmanında**, uygulama `where`'ine bırakılmaz | ADR-107 (Law 1) | ⏳ ölçülemedi |
| **Satır kapsamı** | ADR-0011 · RESTRICTIVE politikalar, kapsam **oturum ayarıyla** taşınır (`app.kapsam_*`), tek noktada kurulur | — | ⏳ |
| **Olay yönetimi / outbox** | Depoda `OutboxServisi` + outbox tablosu **var**; olay kodları (`tahakkuk.olusturuldu`) bildirim kurallarına bağlanıyor. **ADR'si yok** — desen kodda, kararı yazılı değil | ADR-108 · 122 | ⏳ |
| **Denetim kaydı** | `AuditServisi` + `audit_kaydi`; parametre değişikliği, virman, tahakkuk denetime yazılıyor. **ADR'si yok** | ADR-125 | ⏳ |
| **Yetkilendirme** | ADR-0006 · **Üç Kapı** (AuthGuard → TenantGuard → PermissionGuard), sıra değişmez; izinler `IZINLER` sabitinde, roller `ROLLER`de | ADR-106 · 124 | ⏳ |
| **İş kuralları motoru** | ⚠️ **Depoda YOK.** Modül manifesti `BUSINESS_RULES`'u **çekirdek bağımlılığı** olarak *bildiriyor* ama motor bu depoda değil | ADR-103 · 146 | ⏳ |
| **Bildirim** | `OtomatikBildirimKurali` + `MesajSablonu` + kanal soyutlaması; migration 0019 | ADR-127 | ⏳ |
| **Tenant çözümleme** | Jeton claim'inden (`tid`); **istemciden asla** (BFS v1 §12). `TenantGuard` tek yerde kurar | ADR-128 | ⏳ |

### ★ Yapısal gözlem — metin olmadan da söylenebilir

İki seri **farklı soyutlama düzeyinde**: Seri A *"bu modülde şu tablo şu
kısıtı taşır"* der, Seri B *"platform şu yasaya uyar"* der. Çakışma
**doğrudan çelişki** biçiminde değil, **ikisi de aynı garantiyi ayrı
mekanizmayla veriyorsa** biçiminde olur — ve o zaman soru *"hangisi
bağlayıcı"* olur, *"hangisi doğru"* değil.

⚠️ İki yerde birden **ADR'si olmayan** iki desen var (**outbox** ve
**audit**) — Seri B'de karşılıkları varsa, bizim uygulamamız
**yazısız** bir karara dayanıyor demektir. Bu, çakışmadan **daha
kırılgan** bir durumdur.

---

## 3 · Teknoloji uyuşmazlığı — ölçüldü

```text
*.cs · *.sln · *.csproj  →  0 dosya
```

`Uyum_Denetim_Raporu_Sprint08`'in tespiti **bu depoda doğrulanmıştır**:
.NET/C# varsayan bir ADR serisi, **TypeScript** bir kod tabanına
uygulanıyor.

**Sorunun cevaplanıp cevaplanmadığı ölçülemedi** — ADR-113'ün metni
depoda yok. Görev tarifindeki *"Technology Agnostic + Conformance
Profile"* başlığı **bir cevap gibi duruyor** ama bu **başlıktan çıkarım**,
ölçüm değil.

**Uygulanabilirlik** (metin olmadan yapılabilen kısım): zorlama
mekanizmalarının bizde karşılığı olup olmadığı **ancak mekanizma
listesi görüldükten sonra** söylenebilir. Bugün elimizde olan zorlama
araçları:

| Bizdeki zorlama | Nerede |
|---|---|
| `pnpm verify` — 14 kapı (tip · paket sınırı · RLS kapsamı · önbellek anahtarı · ortam sözleşmesi) | `scripts/verify.mjs` |
| Sözleşme testleri (**189**) | `backend/test/contract/` |
| Birim testleri (**352**) | `tests/unit/` |
| CI — dört iş, gerçek Linux | `.github/workflows/ci.yml` |
| RLS politikaları + `NOBYPASSRLS` rolleri | migration'lar |

⏳ Bunların Seri B'nin *Conformance Profile* kavramına nasıl eşleneceği
**metin gerektirir**.

---

## 4 · Yönetişim farkı — durum tespiti

**Seri A bugün ADR-118 / GV32 yönetişimine tabi DEĞİL.** Ölçüldü:
`docs/adr/log/README.md` kendi kayıt biçimini tanımlıyor ve alanları
şunlar:

```text
Kapsam · Tarih · Statü · Öneren · Onaylayan · İşlendiği belge ·
Kapattığı çakışma
```

GV32'nin istediği sekiz alan (*ADR Type · Primary Responsibility ·
Concern Owner · Participating Concerns · Bounded Context · Aggregate
Ownership · Domain Events · Validation Rules*) **hiçbir Seri A
ADR'sinde yok**.

⚠️ **İki serinin ayrı yönetişimi hiçbir yerde YAZILI DEĞİL.** Ne
`docs/adr/log/README.md` Seri B'den söz ediyor, ne de tersini
doğrulayabiliyorum (metin yok). Yani bugünkü durum *"iki ayrı
yönetişim"* değil, **"ilişki tanımsız"**.

★ Bu bir **karar boşluğudur**, ihlal değil: Seri A kendi kurallarına
uyuyor, yalnızca ötekinin kapsamına girip girmediği belirsiz.

---

## 5 · Terminoloji

Karşı taraf belgeleri (`Terim_Statu_Envanteri_Rev_1_1`,
`Terminoloji_Yonetisimi_Uyum_Raporu`) **depoda yok** — çelişki
**ölçülemedi**. Bizim tarafımızdaki üç kural, karşılaştırma yapılabilsin
diye burada net biçimde duruyor:

| Kural | İçerik | Nerede |
|---|---|---|
| **Terminoloji** | `Blok` = **yalnızca** site içindeki yapı birimi · `Apartman` = tek parselli tek yapı · `Site` = toplu yapı. ⛔ *"Blok yönetimi"* terimi **kullanılmaz**. Dış kaynaktan alıntıda terim **çevrilir** | BFS v1 §13.1 *(bağlayıcı)* |
| **Kapsam etiketi** | `[SITE]` · `[APARTMAN]` · `[ORTAK]`; **gerekçe zorunlu**; belirsizse `[ORTAK]` **yazılmaz, sorulur**; yalnızca **aktif** maddeler etiketlenir | `docs/adr/log/README.md` |
| **Türkçe alan adları** | Şema, DTO ve domain tipleri Türkçe (`bagimsizBolum`, `borcSorumlusu`, `paylasimKurali`) | R5 · şema geneli |

★ **Olası gerilim noktası (tahmin değil, işaret):** *Legacy Accepted*
statüsü bir terimi **korunmuş** sayıyorsa, BFS §13.1'in *"blok yönetimi
kullanılmaz"* yasağı ile karşılaşabilir. Hangi terimlerin o statüde
olduğu görülmeden söylenemez.

---

## 6 · `business_rules` bulgusu — ÖLÇÜLDÜ

> **00-FIX-RAPORU:** *"`business_rules` tablosunda `projectId` kolonu yok,
> `key` global benzersiz. Bir sitede tanımlanan kural tüm sitelerde
> değerlendiriliyor."*

### Bu depodaki durum

```text
model business_rules / IsKurali  →  YOK
şemadaki toplam model            →  59
```

★ **`business_rules` tablosu BU DEPODA HİÇ YOK.** `BUSINESS_RULES`
yalnızca **modül manifestinde bir çekirdek bağımlılığı bildirimi** olarak
geçiyor (`gerektirdigiCekirdek`) — motor **platform çekirdeğinde**, bizde
değil.

**Yani düzeltme bizim kod tabanımızda YAPILAMAZ; bizim tablomuz değil.**

### ⚠️ Ama bağımlılık bizi etkiliyor

Modül `BUSINESS_RULES` çekirdek yeteneğini **gerektirdiğini bildiriyor**.
Çekirdekteki tablo tenant kapsamsızsa, **bizim modülümüzün kuralları da
projeler arasında sızar** — kusur bizde olmasa da **sonucu bizde
görülür**.

⏳ Çekirdeğin düzeltilip düzeltilmediği **buradan ölçülemez**.

### Bizdeki en yakın karşılık TEMİZ

Aynı sınıftaki tek tablomuz `OtomatikBildirimKurali` ve **kusuru
taşımıyor**:

```prisma
tenantId String @map("tenant_id") @db.Uuid          // NOT NULL
@@unique([tenantId, olayKodu, kanal])               // tenant KAPSAMLI
```

```sql
ALTER TABLE otomatik_bildirim_kurali ENABLE ROW LEVEL SECURITY;
ALTER TABLE otomatik_bildirim_kurali FORCE  ROW LEVEL SECURITY;
CREATE POLICY otomatik_bildirim_kurali_tenant_isolation ...
```

★ Tam olarak raporun eksik dediği şey — **benzersizliğin tenant kapsamlı
olması** — bizde **var**. Bu bir tesadüf değil: ADR-0002 ve ADR-0011
bunu zorunlu kılıyor ve `verify` içindeki *"RLS politika kapsamı"* kapısı
her koşuda denetliyor.

---

## ✅ Kararlar — 6 Ağustos 2026, ürün sahibi

### 1 · İki seri AYRI KALIR — şimdilik

Seri B'nin tamamı depoda yok ve Architecture Board süreci ayrı yürüyor.
**Birleştirme kararı bu oturumda verilemez:** Seri B metinleri görülmeden
alınacak her karar **tahmine** dayanır.

> ⛔ **AMA *"ilişki tanımsız"* DURUMU KABUL EDİLEBİLİR DEĞİLDİR.**
> İki seri arasındaki sınır **YAZILI DEĞİL** ve bu **bir eksikliktir**.
> Seri B metinleri depoya alınana kadar sürer.

### 2 · Sınır — GEÇİCİ kural

Seri B metinleri gelene kadar:

| Seri | Kapsam |
|---|---|
| **A** | Apartman/site modülüne **özgü** iş kuralları ve **veri modeli** kararları |
| **B** | Platform çekirdeği · çok kiracılılık **altyapısı** · AI hattı · yönetişim |

> ⛔ **Belirsiz kalan bir konu çıkarsa KARAR VERME, SOR.**
> Örnek: **outbox ve audit** — bunlar hangi seride? *(aşağıda açık soru)*

### 3 · Seri A GV32'ye TABİ DEĞİL

**Geriye dönük metadata İSTENMİYOR.** Gerekçe kabul edildi: *Aggregate
Ownership* ve *Domain Events* bugün **doğrulanamaz**; sonradan doldurmak
**tahmin** olur.

Yeni ADR'ler için de **mevcut yedi alanlık şema** devam eder. GV32'ye
geçiş, **iki seri birleştirilirse** gündeme gelir.

---

## ⛔ AÇIK RİSK — `business_rules` bağımlılığı

> **Çekirdekteki `business_rules` tablosu tenant kapsamsızsa bizim
> modülün kuralları da sızar. Kusur bizde değil, sonucu bizde.**
> **Platform ekibine iletilmelidir.**

Modül manifesti `BUSINESS_RULES`'u **gerektirdiğini bildiriyor**
(`gerektirdigiCekirdek`); motor bu depoda değil, dolayısıyla düzeltme de
burada yapılamaz. Ama bağımlılık gerçek: çekirdek sızdırırsa **bir sitede
tanımlanan kural bütün sitelerde değerlendirilir.**

### Karşılaştırma — aynı sınıf, bizde temiz çözülmüş

| | Çekirdek `business_rules` *(rapora göre)* | Bizim `OtomatikBildirimKurali` *(ölçüldü)* |
|---|---|---|
| Tenant kolonu | ⛔ `projectId` **yok** | ✅ `tenantId` **NOT NULL** |
| Benzersizlik | ⛔ `key` **global** | ✅ `[tenantId, olayKodu, kanal]` — **tenant kapsamlı** |
| RLS | ⏳ bilinmiyor | ✅ `ENABLE` + `FORCE` + izolasyon politikası |
| Sonuç | Kural **bütün projelerde** değerlendirilir | Kural **yalnızca kendi projesinde** |

★ Bu tesadüf değil: ADR-0002 ve ADR-0011 bunu zorunlu kılıyor ve `verify`
içindeki *"RLS politika kapsamı"* kapısı **her koşuda** denetliyor.

---

## Ürün sahibine AÇIK SORU

⛔ **Cevaplanmadı — karar ürün sahibinindir.**

### ★ `outbox` ve `audit` ADR'siz — en kırılgan bulgu

İkisi de **uygulanmış** — `OutboxServisi` ile outbox tablosu, `AuditServisi`
ile `audit_kaydi` — ama **hiçbir ADR'de kayıtlı değil**.

> **Uygulanmış ama yazısız bir karar, çelişkiden KÖTÜDÜR:** çelişkide en
> az **iki yazılı kayıt** vardır ve hangisinin geçerli olduğu tartışılır;
> burada **hiç kayıt yok** — davranış yalnızca kodda durur ve gerekçesi
> kimsenin elinde değildir.

**İki seçenek:**

| | Seçenek | Artı | Eksi |
|---|---|---|---|
| **(a)** | **Seri A'ya yeni ADR** — uygulanmış davranış kayda geçsin | Boşluk **bugün** kapanır; gerekçe yazılırken kod okunur ve varsa kusur görülür | Seri B'de karşılığı çıkarsa **iki kayıt** olur ve §2'deki sınır kuralı çiğnenmiş olur (bunlar altyapı konusu, Seri B'ye daha yakın) |
| **(b)** | **Seri B'de karşılığı var mı diye beklensin** | Sınır kuralına uyar; mükerrer ADR doğmaz | ⛔ Boşluk **belirsiz süre** açık kalır — Seri B metinlerinin ne zaman geleceği bilinmiyor |

★ **Önerim: (a) ama sınırlı kapsamda.** Gerekçe: §2'nin geçici sınırı
outbox/audit'i **Seri B'ye** yakın gösteriyor, ama o sınır *"Seri B
metinleri gelene kadar"* geçerli ve metinlerin **ne zaman geleceği
bilinmiyor**. Yazısızlığın bedeli sürekli; mükerrer ADR'nin bedeli ise
**birleşme anında bir kez** ödenir ve o an zaten iki seri gözden
geçirilecektir.

⚠️ **Ama bu §2'deki *"belirsizse sor"* kuralına giriyor — karar sizin.**

---

## Ölçülemeyenler *(tahmin eklenmedi)*

Bunlar **metin görülmeden cevaplanamaz** ve tahminle doldurulmadı:

| # | Ölçülemeyen | Neden |
|---|---|---|
| §2 | Her çakışma için *"çelişiyor mu"* | Seri B karar metinleri yok — elde yalnızca **başlıklar** var |
| §3 | ADR-113'ün .NET sorusuna **cevap olup olmadığı** | Başlık *"Technology Agnostic"* diyor ama bu **başlıktan çıkarımdır**, ölçüm değil |
| §3 | Zorlama mekanizmalarının TypeScript'te **uygulanabilirliği** | *Conformance Profile*'ın ne istediği bilinmiyor |
| §5 | Terminoloji çerçevesiyle **çelişki** | *Legacy Accepted* statüsündeki terim listesi yok |
| §6 | Çekirdek `business_rules`'un **düzeltilip düzeltilmediği** | Tablo bu depoda değil; buradan görülemez |

★ **Numaralandırma çakışması YOK** — ölçüldü: `0001…0018` ile `100…146`
aralıkları kesişmiyor. Birleşme kararı verilirse **numaralar değil,
yönetişim ve kapsam** birleştirilmelidir.

---

## Bu belgeyi tamamlamak için gereken

1. **Seri B metinleri** — `docs/reference/adr-platform/` altına ya da sohbete
2. **Dört rapor** — `Uyum_Denetim_Raporu_Sprint08` · `Terim_Statu_Envanteri_Rev_1_1` · `Terminoloji_Yonetisimi_Uyum_Raporu` · `00-FIX-RAPORU`

Bunlar gelince §2'nin sağ sütunu, §3'ün uygulanabilirlik listesi ve
§5'in çelişki analizi doldurulabilir.
