# V23 envanteri ve arayüz durumu

**Tarih:** 3 Ağustos 2026
**Yöntem:** dosyalar okundu, uçlar sayıldı. Çıkarılamayan yerlere
**"bilinmiyor"** yazıldı.

---

## 0. ★ ÖNCE EN ÖNEMLİ TESPİT — V23 bir uygulama DEĞİL

Soru *"V23 nerede duruyor, kaç dosya, React mi Next.js mi"* biçiminde
soruldu. **Cevap: V23 bir frontend değil, bir SÜRÜM YOL HARİTASI belgesidir.**

Belgenin kendi girişi bunu söylüyor:

> *"This is not a design concept and not a redesign proposal. It is the
> release plan of an existing enterprise SaaS platform."* — `01-temel.html` §0

Bu tespit zaten [`docs/V23-V24-BOSLUK-ANALIZI.md`](V23-V24-BOSLUK-ANALIZI.md)
§0'da yapılmıştı (30 Temmuz). **Depoda tek bir frontend vardır:
`frontend/web`.** §4'ün cevabı budur ve "hangisi devam edecek" sorusu
düşmektedir — seçenek yok.

### V23 ile ilgili dosyalar nerede

| Yol | Ne | Boyut |
|---|---|---|
| `docs/reference/roadmap/01-v23.html` | V23 sürüm planı | 27 KB |
| `docs/reference/roadmap/02-v23-v25.html` | V23-V25 birleşik plan | 51 KB |
| `docs/reference/roadmap/*.html` (20 dosya) | V22-V34 tüm sürümler | — |
| `docs/reference/prototypes/bn-finance.html` | **Finans & Muhasebe prototipi** | 111 KB |
| `docs/reference/prototypes/bn-dashboard.html` | Gösterge paneli prototipi | 95 KB |
| `docs/reference/prototypes/bn-ai-center.html` | AI merkezi prototipi | 110 KB |
| `docs/reference/marketing/canva-export-landing-page.html` | Tanıtım sayfası | 32 KB |

**Teknoloji:** hepsi **tek dosya HTML** — gömülü CSS + vanilla JS. React yok,
Next.js yok, derleme adımı yok. **Çalışır durumda ama statiktir:** kendi
içindeki JS ile sekme değiştirir, sahte veri gösterir; hiçbir API'ye bağlı
değildir.

**Tanıtım sitesi mi, panel mi:** ikisi de var — `marketing/` tanıtım,
`prototypes/` yönetim paneli görsel prototipi.

⚠️ **Prototiplerden menü/sekme listesi çıkarılamadı.** Ekran yapısı JS ile
çalışma anında kuruluyor; statik okumada `role="tab"` ya da `data-tab`
kalıbı yok. Görünür etiketlerden okunabilen **kavramlar** şunlar (tam liste
değil, örnekleme):

> Bütçe · Bütçe kalemi · Gerçekleşen · Gider Kalemi · Fatura ·
> **Fatura muhasebeleştirme engeli** · Arsa payı · Eşit paylaşım · Dönem sonu
> bakiye · **Bant dışı doğrulama** · **İkinci doğrulayıcı** · Komut paleti
> (Ctrl-K) · Geri al

★ Bunlardan **Bütçe · Bütçe kalemi · Gerçekleşen** üçlüsü, ADR-0017 §6'daki
**işletme projesi** kavramının prototipteki karşılığı olabilir. Doğrulanmadı.

---

## 1. `frontend/web` — tek gerçek arayüz

| | |
|---|---|
| Teknoloji | **Next.js** (app router), TypeScript, Tailwind, `next-intl` |
| Dosya | 54 `.ts`/`.tsx` (node_modules ve `.next` hariç) |
| Rota sayısı | **17 sayfa** |

### Menü — `components/uygulama-kabugu.tsx`

Menü **11 öğe**; alt menü yok, hiyerarşi tek seviye:

| # | Yol | Sayfa var mı |
|---|---|---|
| 1 | `/yonetim` — Genel Bakış | ✅ |
| 2 | `/apartmanlar` | ✅ |
| 3 | `/bloklar` | ✅ |
| 4 | `/katlar` | ✅ |
| 5 | `/bolumler` | ✅ (+ `arsa-payi`, `ice-aktar` alt rotaları) |
| 6 | `/site-personeli` | ✅ |
| 7 | `/daire-gorevlileri` | ✅ |
| 8 | `/misafirler` | ✅ |
| 9 | `/gider-turleri` | ✅ |
| 10 | `/muhasebe` | ✅ |
| 11 | `/belgeler` | ⛔ **SAYFA YOK** |

★ **BULGU: `/belgeler` menüde var ama `app/belgeler` klasörü yok.** Menüden
tıklandığında 404 gelir. Backend'de 12 belge ucu çalışıyor.

Menüde **olmayan** ama var olan rotalar: `/portfoy` · `/sakin` · `/iletisim` ·
`/daireler/[bolumId]` · `/giris`. (Portföy ayrı kabuk kullanıyor; sakin paneli
ayrı rol.)

### ★ Muhasebe sekmesi VAR — altı sekme, hepsi API'ye bağlı

`app/muhasebe/page.tsx` · tek rota, sekmeli:

| Sekme | İçerik | Uç |
|---|---|---|
| Fişler | liste · süzgeç · **işle** · **storno** | `GET/PATCH/POST /muhasebe/fisler…` |
| Hesap Planı | ağaç görünümü (girinti koddan türetiliyor) | `GET /muhasebe/hesaplar` |
| Defterler | **yalnızca yevmiye defteri** | `GET /muhasebe/defterler/yevmiye` |
| Mizan | döküm + **denksizlik uyarısı** | `GET /muhasebe/dokumler/mizan` |
| Makbuzlar | liste · detay · iptal · **kontrol mutabakatı rozeti** | `GET/POST /makbuzlar…` |
| Dönem | kart görünümü · numaralandır · açılış · yansıtma · **kapat** | `POST /muhasebe/donemler/:id/…` |

**Hiçbiri yer tutucu değil.** Sayfanın kendi başlığında yazılı:

> *"MOCK YOKTUR. Öteki modüllerde mock, backend hazır olmadan arayüz
> geliştirmeyi sağlıyordu. Muhasebede aynı şeyi yapmak TEHLİKELİDİR: uydurma
> bir mizan gerçek bir mizan gibi görünür ve karar dayanağı sanılabilir."*

---

## 2. ★ HANGİ EKRANLAR GERÇEKTEN ÇALIŞIYOR — mock varsayılan AÇIK

`lib/servis.ts:38`:

```ts
export const MOCK_AKTIF = (process.env['NEXT_PUBLIC_MOCK'] ?? '1') !== '0';
```

⚠️ **Varsayılan `'1'` — yani `NEXT_PUBLIC_MOCK=0` verilmedikçe arayüz SAHTE
VERİ ile çalışır.** `.env` ve `.env.example` dosyalarında `NEXT_PUBLIC_MOCK`
**hiç geçmiyor** (arandı, 0 eşleşme). Sonuç: bugün `pnpm dev:web`
çalıştırıldığında ekranların çoğu mock gösterir.

| Servis bloğu | Mock kullanıyor mu |
|---|---|
| `servis` (apartman · blok · kat · bölüm · malik · kiracı · sakin · kişi · misafir · personel · gider türü · portföy) | **EVET** — `MOCK_AKTIF` dallanması var |
| `muhasebe` | **HAYIR** — blokta 0 `MOCK_AKTIF` eşleşmesi |
| `makbuzlar` | **HAYIR** — blokta 0 eşleşme |
| `iletisim` | bilinmiyor — ölçülmedi |

Yani **muhasebe ve makbuzlar backend olmadan hata gösterir**, ötekiler
sahte veriyle çalışmaya devam eder.

★ Bu, bir sonraki adımın ilk teknik sorusudur: site muhasebe sekmesi
tamamlanırken **öteki ekranlar mock'ta mı kalacak?** İki mod bir arada
kaldıkça hangi ekranın gerçek veri gösterdiği kullanıcıya görünmez.

### Yer tutucu / hazır değil işaretleri

- `components/daire/sekmeler.tsx` — `hazirDegil?: boolean` alanı var:
  *"Backend'i olmayan sekmeler işaretlenir."*
- `components/daire/hazir-degil.tsx` — bu sekmeler için ayrı bileşen.
- Hangi daire sekmelerinin `hazirDegil` olduğu **ölçülmedi** (sayfa okunmadı).

---

## 3. ★ BACKEND'DE HAZIR AMA EKRANI OLMAYAN UÇLAR

**Backend toplam: 206 uç.** Frontend `servis.ts` içinde geçen yol: **66**
(20 sabit + 46 şablon). Yani uçların **büyük çoğunluğunun arayüzü yok.**

### Modül düzeyinde: ekranı HİÇ olmayanlar

| Modül | Uç sayısı (yaklaşık) | Durum |
|---|---|---|
| **Banka** (`/banka/*`) | ~30 | ⛔ rota yok. Hesap · şube · POS · hareket · ekstre · mutabakat · çek/senet · **virman** |
| **Tahakkuk** (`/tahakkuk/*`) | 3 | ⛔ rota yok — `calistir` · `borclar` · `donemler` |
| **Virman** (`POST /virman`) | 1 | ⛔ rota yok (dün uygulandı) |
| **Sayaç** (`/sayaclar/*`) | 6 | ⛔ rota yok |
| **Belge** (`/belgeler/*`) | 12 | ⛔ **menüde var, sayfa yok** |
| **Araç** (`/araclar/*`) | 3 | ⛔ rota yok |
| **Geri alma** (`/geri-alma/*`) | 3 | ⛔ rota yok |
| **Kişi** (`/kisiler`) | 3 | ⛔ rota yok — bileşenleri var (`components/kisi/`), sayfası yok |

### Muhasebe/tahsilat içinde: servis VAR, ekran YOK

Bunlar `servis.ts`'te **tanımlı ama hiçbir `.tsx` çağırmıyor** (arandı):

| Uç | Servis | Ekran |
|---|---|---|
| `GET /makbuzlar/rapor/yaslandirma` | ✅ `servis.ts:1069` | ⛔ |
| `GET /muhasebe/defterler/kasa` | ✅ `servis.ts:1132` | ⛔ |
| `GET /muhasebe/defterler/muavin/:hesapId` | ⛔ servis yok | ⛔ |
| `GET /makbuzlar/cari/:bolumId` — **cari ekstre** | ⛔ servis yok | ⛔ |
| `GET /makbuzlar/borclar/:bolumId` | ⛔ servis yok | ⛔ |
| `POST /makbuzlar` — **tahsilat kaydı** | ⛔ servis yok | ⛔ |
| `POST /makbuzlar/tahsis-onerisi` | ⛔ servis yok | ⛔ |
| `POST /tahakkuk/calistir` | ⛔ servis yok | ⛔ |
| `POST /tahakkuk/calismalar/:id/muhasebelestir` | ⛔ servis yok | ⛔ |
| `GET/PATCH /muhasebe/parametreler` | ⛔ servis yok | ⛔ |

★ **En ağır boşluk:** para giren yol (`POST /makbuzlar`) ve para doğuran yol
(`POST /tahakkuk/calistir`) **arayüzsüz**. Kullanıcı bugün ekrandan ne borç
yaratabiliyor ne tahsilat kaydedebiliyor — yalnızca sonuçlarını okuyabiliyor.

---

## 4. Görsel dil

`frontend/web/app/globals.css` ile prototipler **aynı paleti** kullanıyor —
yani yeni ekranlar için ayrıca çıkarım yapmaya gerek yok, token'lar hazır:

| Token | Koyu tema | Açık tema |
|---|---|---|
| `--primary` | `#0E7490` (teal) | aynı |
| `--secondary` | `#2563EB` (mavi) | aynı |
| `--dark` / `--darker` | `#0F172A` / `#060B14` | `#F1F5F9` / `#FFFFFF` |
| `--text` | `#E2E8F0` | `#0F172A` |
| `--success` · `--warn` · `--crit` · `--info` | `#10B981` · `#F59E0B` · `#EF4444` · `#38BDF8` | koyulaştırılmış eşdeğerleri |
| `--grad` | `linear-gradient(135deg, #0E7490, #2563EB)` | |

**Ölçüler:** `--r: 14px` · `--rs: 10px` · `--pad/--cardpad: 20px` ·
`--rowh: 44px` · `--fz: 14px`.

**Tipografi:** prototipte `DM Sans`. `frontend/web/app/layout.tsx` içinde font
tanımı **bulunamadı** — hangi fontun kullanıldığı **bilinmiyor**.

**Bileşen düzeni:** cam efekti (`.glass`, `--glass-bg`), sekme çubuğu
(`components/sekmeler.tsx`), veri tablosu (`components/tablo/veri-tablosu.tsx`)
ve süzgeç paneli hazır ve yeniden kullanılıyor.

---

## 5. ÖNERİ — site muhasebe sekmesini tamamlamak için ne gerekiyor

### Ne eksik

Muhasebe sekmesi **okuma tarafında tam**, **yazma tarafında boş**. Eksikler:

| Eksik | Neden gerekli |
|---|---|
| **Tahsilat kaydı ekranı** (`POST /makbuzlar`) | Para giren yol; bugün ekrandan tahsilat kaydedilemiyor |
| **Tahakkuk çalıştırma ekranı** | Para doğuran yol; sistemin tek gelir üreten akışı |
| **Cari ekstre ekranı** (`/makbuzlar/cari/:bolumId`) | Borçlu ile konuşurken bakılan ekran budur |
| **Kasa/banka defteri sekmesi** | Servis yazılı, sekme yok |
| **Muhasebe parametreleri ekranı** | Kurulum bugün yalnızca tohumla yapılabiliyor (CT-20 · §3.H) |
| **Virman ekranı** | Dün uygulandı, arayüzü yok |

### Sıfırdan mı, V23'ten mi

**V23'ten "uyarlanacak" ekran YOK** — prototipler statik HTML ve farklı bir
veri modeli varsayıyor (`Resident` tek kavram; bizde Malik/Kiracı/Sakin ayrı).
V23'ün katkısı **görsel dil**dir ve o zaten `globals.css`'e geçmiş durumda.

**Hepsi sıfırdan yazılacak** ama mevcut iskeletlerle: `Sekmeler` ·
`VeriTablosu` · `FiltrePaneli` · `Durumlar` · `Bildirim` hazır.

### Önerilen sıra — gerekçesiyle

1. **Muhasebe parametreleri ekranı.** En küçük iş, ve ötekilerin ön koşulu:
   kontrol hesabı/kasa hesabı seçilmeden tahsilat muhasebeleşmiyor (ölçüldü —
   §3.H). Bugün bunu yalnızca tohum yapabiliyor; elle kurulan proje çıkışsız.
2. **Tahakkuk çalıştırma.** Para doğuran yol. Önizleme ucu (`onizleme: true`)
   zaten var — sihirbaz için hazır.
3. **Tahsilat kaydı + cari ekstre.** İkisi birlikte: tahsilat girilirken hangi
   borca sayıldığı ekstrede görünmeli, ayrı sprintlere bölünürse arada
   doğrulanamaz bir durum kalır.
4. **Kasa/banka defteri sekmesi.** Küçük ekleme; servis yazılı.
5. **Virman ekranı.** Çekirdeği dün bitti, kuralları test edilmiş durumda.

★ **Sıradan önce cevaplanması gereken iki soru** (karar sizde):

- **Mock modu ne olacak?** Muhasebe API'ye bağlı, ötekiler mock. Yeni
  ekranlar API'ye bağlanacaksa `NEXT_PUBLIC_MOCK` varsayılanı `0` yapılmalı
  mı — yoksa mock'lu ekranlar kırılır mı? Ölçülmedi.
- **`/belgeler` menü öğesi** bugün 404 veriyor. Sayfa mı yazılacak, menüden
  mi kaldırılacak?

---

## 6. ★ APARTMAN MODÜLÜ — V23'ten uyarlanacak bir şey VAR MI?

**Cevap: HAYIR.** Ürün sahibinin beklentisi ölçümle **doğrulandı**. Aşağıda
kanıtlar ve iki nüans.

Apartman modülünün kapsamı ([APARTMAN-SITE-AYRIMI §2.1](APARTMAN-SITE-AYRIMI.md)):
`BASIT` derinlik · yalnızca kasa + banka · gider fişinden hesap seç, tutar yaz ·
hesap planı/yevmiye/mizan **yok** · çıktı gelir-gider dökümü.

### 6.1 · Prototiplerde bu ölçekte bir ekran YOK

`bn-finance.html` **30 bölüm · 11 görünüm** taşıyor. Tam liste:

> Alacak Yaşlandırma · Aylık Aidat Tahsilatı · Banka Hesapları · Banka
> Mutabakatı · Borçlar (Vade) · **Bütçe Sapması** · Daire Hesap Ekstresi ·
> Dönem Kapanış Kontrol Listesi · **e-Belge Durumu** · Finansal Denetim Kaydı ·
> Finansal Politika · Gecikme Tazminatı · **IBAN Değişikliği · Çift Onay** ·
> **İşletme Projesi 2026** · Karar Bekleyenler · **KDV Pozisyonu** · Makbuz
> Serisi · Onay Bekleyen Harcamalar · Sözleşmeler · **Stopaj ve Tevkifat** ·
> Tahakkuk Üretimi · Tahsilat Kanalları · Tedarikçi Kayıtları · **Üç Yönlü
> Eşleştirme** · Yasal Takip · Yasal ve Yönetim Raporları · Yenileme Fonu ·
> **Yevmiye Kaydı** · Yükümlülük Takvimi · **13 Haftalık Nakit Projeksiyonu**

Koyu yazılanlar apartman ölçeğinde **hiç bulunmayan** kavramlardır. Görünümler:
`pano · tahakkuk · tahsilat(alacak) · gider · fatura · butce · nakit · vergi ·
tedarikci · rapor · ayar`.

★ **Prototip kendi kapsamını yazıyor** ve apartman değil:

> *"Kurumun kendi kurumlar vergisi ve beyannameleri harici muhasebe paketine
> aittir; bu modül **site** işletme defterini tutar."*

`bn-dashboard.html` de operasyon panosudur (iş emri · vardiya · temizlik ·
şikâyet teması · widget kataloğu) — muhasebe ekranı içermez.

**Arama sonucu (ham):** üç prototipte `apartman` · `basit` · `gelir-gider` ·
`kasa devri` · `aidat listesi` için **0 eşleşme**; yalnızca `bn-finance`'ta
*"işletme defteri"* 1 kez geçiyor ve o da **site** için.

### 6.2 · Roadmap'te apartman/basit muhasebe bölümü YOK

20 roadmap HTML tarandı. `apartman` · `basit muhasebe` · `single-entry` ·
`cash book` · `işletme defteri` için **0 eşleşme**.

`gelir-gider` **4 kez** geçiyor ama hepsi **kurumsal raporlama paketinin bir
kalemi** olarak (V26 ve V28):

> *"Board reporting pack … faaliyet raporu, **gelir-gider tablosu**, aidat
> tahsilat özeti, iş emri performansı, demirbaş durumu."* — `04-v26.html`
>
> *"The full statutory and governance pack: **gelir-gider tablosu**, işletme
> projesi vs. gerçekleşme, borç-alacak listesi, kasa ve banka raporu, denetçi
> raporu ekleri."* — `06-v28.html`

★ **Yanıltıcı iki kelime kontrol edildi ve elendi:**

| Kelime | Nerede | Gerçek anlamı |
|---|---|---|
| `lightweight` | v31 | *"lightweight custom **objects**"* — özel alan özelliği, ürün katmanı değil |
| `segment` | v23-v33, 18 kez | *"audience **segmentation**"* — iletişim hedef kitlesi, müşteri segmenti değil |

**Yani roadmap'te "küçük/basit müşteri katmanı" diye bir kavram hiç yok.**
Hepsi tek bir kurumsal SaaS ölçeğinde yazılmış.

### 6.3 · Uyarlanabilir bileşen — V23'ten DEĞİL, kendi depomuzdan

Prototipler tek dosya HTML + vanilla JS; React bileşeni içermiyor, dolayısıyla
**kod düzeyinde alınacak bir parça yok.**

Görsel dil ise **zaten aktarılmış**: `globals.css` ile prototipler aynı
token'ları kullanıyor (`--primary: #0E7490` · `--secondary: #2563EB` ·
`--rowh: 44px` …). Yani "V23'ten uyarlama" işi **geçmişte yapılmış ve
bitmiştir.**

Apartman ekranları için yeniden kullanılacak bileşenler `frontend/web` içinde:

| Bileşen | Yol |
|---|---|
| Sekme çubuğu | `components/sekmeler.tsx` |
| Veri tablosu · süzgeç · dışa aktarım | `components/tablo/` |
| Yükleniyor · boş · hata durumları | `components/durumlar.tsx` |
| Bildirim (toast) | `components/bildirim.tsx` |
| İstatistik kartı | `components/istatistik-karti.tsx` |
| Uygulama kabuğu · kırıntı yolu | `components/uygulama-kabugu.tsx` · `kirinti-yolu.tsx` |

### 6.4 · ★ NÜANS — kavram adı örtüşmesi uyarlanabilirlik DEĞİLDİR

Dürüst olmak için: `bn-finance`'taki **beş bölüm adı** apartman modülünde de
karşılığı olan kavramlardır — *Daire Hesap Ekstresi · Aylık Aidat Tahsilatı ·
Alacak Yaşlandırma · Makbuz Serisi · Banka Hesapları*.

⚠️ **Ama bu, "uyarlanacak ekran var" anlamına gelmez.** Üç sebeple:

1. Prototipte bu bölümler **kurumsal ekranın içinde** duruyor; ayrı bir ekran
   değiller ve çevrelerindeki KDV/stopaj/üç yönlü eşleştirme bağlamından
   koparılamıyorlar.
2. Statik HTML; taşınacak kod yok.
3. **Veri modeli farklı** — prototip `Resident` tek kavramını varsayıyor,
   bizde Malik/Kiracı/Sakin ayrı (KMK md. 20/22 sorumluluk farkı,
   [V23-V24-BOSLUK-ANALIZI §0](V23-V24-BOSLUK-ANALIZI.md)).

Bu adlar bir **kontrol listesi** olarak değerlidir (*"bunları unutmayalım"*),
bir tasarım kaynağı olarak değil.

### 6.5 · SONUÇ

> **Apartman modülü SIFIRDAN yazılacaktır.** Referansı V23 değil, **Natal
> Apartmanı gelir-gider formatıdır.**

⚠️ **Natal Apartmanı belgesi depoda YOK** — `docs/` altında `Natal` için 0
eşleşme. Format bugüne kadar yalnızca sözlü olarak tarif edildi (kasa devri ·
aidat listesi · gider listesi · aidat alacakları). Ekran yazılmadan önce
belgenin kendisi depoya alınmalı; aksi hâlde "Natal formatı" doğrulanamayan
bir referans olarak kalır.

---

⚠️ Bu belge **envanterdir**, plan değildir. Modül planı birlikte kurulacak.
