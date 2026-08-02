# Apartman ↔ Site ayrımı — verilmiş kararlar

**Son güncelleme:** 2 Ağustos 2026

> ⚠️ **BU BELGE YALNIZCA VERİLMİŞ KARARLARI İÇERİR.** Açık konular §3'te
> *listelenir*, çözülmez. Buraya tercih yazılmaz; karar ürün sahibinindir.
>
> **Neden var:** bu ayrıma tek bir çalışma oturumunda **beş kez** dönüldü. Her
> seferinde bir yönü netleşti, ötekiler bulanık kaldı ve bir sonraki turda
> yeniden tartışıldı. Dağınık karar, tartışılmış sayılmaz.

---

## 1 · Terminoloji — BAĞLAYICI

Kaynak kodda, yorumlarda, i18n değerlerinde, menü ve ekran adlarında geçerlidir.
Kuralın kendisi [BFS v1 §13.1](bfs/BFS-v1.md)'dedir; burada özeti durur.

| Kavram | Ad |
|---|---|
| Tek parselli, tek yapı | **APARTMAN** |
| Toplu yapı | **SITE** |
| Site içindeki yapı birimi | **BLOK** |

⛔ **"Blok yönetimi" terimi KULLANILMAZ** — site bloğuyla karışır. Tek yapının
yönetimi **apartman yönetimi**dir. `Blok` tablosunun kendisi doğrudur; yanlış
olan, tek yapının yönetimine "blok" demektir.

★ Dış kaynaktan alıntıda terim **çevrilir**: hukuk literatüründeki "blok
yönetimine geçiş", BNOS'ta **apartman yönetimine geçiş**tir.

`Tenant.tip` bu ayrımı zaten doğru kuruyor: `APARTMAN · SITE ·
YONETIM_SIRKETI`. Korunur.

---

## 2 · Verilmiş kararlar

### 2.1 · Muhasebe derinliği

**`MuhasebeParametresi.muhasebeDerinligi: BASIT | CIFT_TARAFLI`**

| | Kapsam |
|---|---|
| `BASIT` | Yalnızca **kasa + banka**. Gider fişinden hesap seçilir, tutar yazılır. Hesap planı, yevmiye fişi, mizan **yok**. Çıktı: gelir-gider dökümü |
| `CIFT_TARAFLI` | Hesap planı · yevmiye fişi · mizan · kontrol mutabakatı |

**Varsayılan kurulumda `Tenant.tip`'ten türetilir:** `SITE → CIFT_TARAFLI`,
`APARTMAN → BASIT`. **Sonradan değiştirilebilir.**

★ **Neden `Tenant.tip`'ten TÜRETİLMEZ, yalnızca varsayılanı ondan gelir:**
`Tenant.tip` bir **yapısal olgudur** (tek yapı / toplu yapı) ve blok, ortak
gider kapsamı gibi domain kurallarının dayanağıdır. Muhasebe derinliği ise bir
**politika tercihidir**. Büyük bir apartman çift taraflı isteyebilir, küçük bir
site basit isteyebilir; tipten türetilseydi ikisi de ifade edilemezdi.

> Politika koda gömülmez — **yapıya da gömülmez.**

★ **Neden `Tenant`'ta değil `MuhasebeParametresi`'nde:** alan yalnızca muhasebe
bağlamında anlamlıdır ve o tablo zaten *"bu proje muhasebeyi nasıl yapıyor"*
sorusunun tek yeridir (varsayılan kasa/banka/dönem kârı). `Tenant`'a konsaydı
muhasebe politikası iki tabloya dağılırdı.

★ Bu, `GiderTuru.paylasimKurali` deseninin aynısıdır: **türde varsayılan,
gerektiğinde değiştirilebilir** (ADR-0017 · K7).

### 2.2 · Tahakkuk İKİSİNDE DE var

**İkisinde de aidat tahakkuk eder ve alacak takibi yapılır.** Fark yalnızca
**deftere düşüp düşmemesidir.**

Kanıt: apartman gelir-gider dökümü örneğinde "AİDAT ALACAKLARI" bölümü vardır —
yani defter tutmayan bir apartman da alacağını takip eder.

⛔ Bu yüzden "apartman muhasebe yapmaz" denemez. Apartman **çift taraflı kayıt**
yapmaz; tahakkuk ve alacak takibi yapar.

### 2.3 · Tahakkukun dayanağı

| | Dayanak | Nasıl kurulur |
|---|---|---|
| **SITE** | **İşletme projesi** | KMK md. 37 — tebliğ → **7 gün itiraz** → kesinleşme |
| **APARTMAN** | **Kat malikleri kurulu kararı** | Tutar doğrudan kararlaştırılır, karar defterine yazılır (KMK md. 32) |

★ **KANUN İKİSİNİ EŞDEĞER TUTAR.** Usulüne uygun kesinleşen işletme projesi
**veya** kat malikleri kurulunun işletme giderlerine ilişkin kararları,
noterlikçe hazırlanmış **borç senedi kadar güçlüdür** (İİK md. 68). İcra
takibinde ikisi de kullanılabilir.

**Model kararı:** tek kavram `TahakkukDayanagi`, `tip: ISLETME_PROJESI |
KURUL_KARARI`. İki ayrı varlık **değil** — gerekçe
[ADR-0017 §6.3](adr/log/ADR-0017-tahakkuk-muhasebelestirme.md).

⚠️ **UYGULANMADI.** Ayrı iş, ayrı ADR. Bugün tahakkuk tutarı serbest giriliyor
ve dayanağı kayıtlı değil.

### 2.4 · Gider paylaşımı

| | Kademe |
|---|---|
| **SITE** | **İki kademeli** — blok gideri o bloğa, site geneli gider herkese (KMK md. 72/I) |
| **APARTMAN** | **Tek kademe** |

⚠️ Bu ayrımı taşıyan `GiderKapsami` ekseni **şemada YOK** — §3'te açık madde.
Bugün var olan: `PaylasimKurali.BLOK_BAZLI` + tahakkukta `hedefBlokId`.

### 2.5 · Modül ayrımı

Menü ve ekranlar **ayrı olabilir** — bu bir ürün kararıdır (menü sadeliği).

⛔ **MOTOR TEKTİR.** İki ayrı tahakkuk/tahsilat motoru **yazılmaz**. İki motor,
biri düzeltildiğinde ötekinin sessizce eski davranmaya devam etmesi demektir.

### 2.6 · Muhasebeleştirme uçları

| Durum | Davranış |
|---|---|
| `BASIT` projede `muhasebelestir` | **422 + açıklama** |
| `BASIT` projede `kontrol-mutabakati` | **422** |
| Derinlik `BASIT → CIFT_TARAFLI` | **serbest** |
| Derinlik `CIFT_TARAFLI → BASIT` | **engelli** |

★ **Neden ucu hiç sunmamak yetmez:** menüden kaldırmak bir görünürlük
önlemidir. Ucu doğrudan çağıran biri **sessiz sonuç almamalıdır** — bu oturumda
kapatılan sessiz boşluk sınıfının aynısı.

★ **Neden `mutabikMi: null` değil 422:** `null` dönmek *"hesaplandı ama sonuç
yok"* izlenimi verir. Bu proje o hesabı **hiç yapmıyor**; ikisi farklı şeydir.

★ **Neden geri dönüş engelli:** `BASIT → CIFT_TARAFLI` geçişte ileriye dönük
tahakkuklar deftere düşer, geçmiş fişsiz kalır — ADR-0017 K6'daki *"geriye
dönük otomatik muhasebeleştirme yapılmaz"* kararıyla aynı gerekçe. Ters yönde
ise **yazılmış fişlerin ne olacağı cevapsızdır**; cevapsız bir yol açılmaz.

---

## 3 · AÇIK — karar verilmedi

Bunlar burada **listelenir**, çözülmez.

| Konu | Durum |
|---|---|
| **`GiderKapsami` / iki kademeli paylaşım şeması** | Şemada yok; site gider ayrımı bugün ifade edilemiyor |
| **`TahakkukDayanagi` uygulaması** | Model kararı verildi (§2.3), uygulanmadı — ayrı ADR |
| **Apartman gelir-gider ekranı** | `BASIT` derinliğin çıktı formatı |
| **Yıl sonu artı/eksi bakiye** | [ADR-0015 soru 7](adr/log/ADR-0015-yil-sonu-kapanisi.md) |
| **Aidat artış tavanı (YDO)** | KMK md. 35/37, 7 Mayıs 2026; üründe hiç yok |

---

## 4 · ★ BULGU — `Principal` tenant tipini taşımıyor

**Ölçüldü.** `Principal` arayüzü ([principal.ts:12-32](../shared/kernel/src/principal/principal.ts)) şunları
taşır: `id · tip · tenantId · izinler · devraldigiPrincipalId ·
devirYonetimTenantId`. Buradaki `tip` **`PrincipalTipi`**'dir (kullanıcı/servis),
tenant tipi **değildir**.

`backend/src/modules/muhasebe` içinde `SITE`/`APARTMAN` için **0 eşleşme**.
Backend genelinde `tenant.tip` okuyan tek yer `portfoy.service.ts:426` ve orada
da yalnızca sayım için.

**Sonuç:** hiçbir uç bugün veritabanına gitmeden tenant tipini ya da muhasebe
derinliğini bilemez. Apartman kullanıcısı mizan/yevmiye/defter ekranlarının
hepsini görebiliyor; ayrım ne izinde, ne kapsamda, ne de veride var.

### Öneri — KARAR SİZDE

**Derinlik `Principal`'a GÖMÜLMESİN; her uçta okunsun ve önbelleğe alınsın.**

Gerekçe — ürün sahibinin kendi uyarısı belirleyici:

> *Token'a gömülürse derinlik değiştiğinde eski token yanlış davranır.*

Bu, kapsam değişiminde zaten yaşanmış bir desendir. Derinlik `BASIT →
CIFT_TARAFLI` değiştiğinde elinde eski jeton olan kullanıcı, jetonu dolana
kadar **muhasebe uçlarından 422 almaya devam ederdi** — ve bu 422 artık yanlış
olurdu. Jeton yenileme mecburiyeti getirmek, ayarı değiştirmeyi operasyonel bir
olaya çevirir.

**Nasıl okunacağı:**

- Okuma noktası **`MuhasebeParametresi`**'dir; kayıt zaten tenant başına **tek
  satırdır** (`tenantId` birincil anahtar) ve tahsilat yolu onu **zaten
  okuyor** (`borcTarafiHesabi()`). Yani çoğu uçta ek sorgu bile doğmaz.
- Tekrar eden okuma için ADR-0005 önbellek deseni kullanılır; anahtar tenant
  bazlıdır ve parametre güncellendiğinde **açıkça düşürülür**.

⚠️ **Alternatif de kayda geçsin:** jetona gömmek okuma maliyetini sıfırlar. Bunu
seçmek, ayar değişiminde **jetonu iptal etmeyi zorunlu** kılar. Ölçülmüş bir
performans gerekçesi olmadan bu bedel alınmamalıdır — bu turda böyle bir ölçüm
**yapılmadı**.

---

## 5 · ★ FİKSTÜR BOŞLUĞU — tohumda hiç SITE yok

**Ölçüldü.** `seed.ts` içinde `tip: 'SITE'` için **0 eşleşme**; tek değer
`tip: 'APARTMAN'` (`seed.ts:494`). Yönetim firması ayrı (`YONETIM_SIRKETI`).

**Sonucu ciddidir:** çift taraflı muhasebe, iki kademeli gider paylaşımı ve
işletme projesi zinciri **site tarafının konusudur** — ve hiçbir fikstür o
tarafı temsil etmiyor. Yani site için yazılan kod, tohum üzerinden **test
edilemiyor**.

★ Bu, "şablon siteler" işine bırakılacak bir ayrıntı değildir: site tarafına
kod yazılırken fikstürün de var olması gerekir, sonra değil.
