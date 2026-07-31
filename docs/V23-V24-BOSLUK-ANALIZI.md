# V23 · V24 referans mimarisi — boşluk analizi

**Tarih:** 30 Temmuz 2026
**Referanslar:** [`01-v23.html`](reference/roadmap/01-v23.html) ·
[`02-v24.html`](reference/roadmap/02-v24.html) ·
[`01-temel.html`](reference/roadmap/01-temel.html) (V22 dondurulmuş taban)

Bu belge, referans dokümanları mevcut kodla **madde madde** karşılaştırır.
Amaç yeni mimari önermek değil; **neyin eksik olduğunu görünür kılmaktır.**

---

## 0. Önce bir tespit: referanslar ne türden belgeler

v23 ve v24 **ekran tasarımı değil, sürüm yol haritasıdır.** İkisi de kendi
girişinde bunu söylüyor:

> *"This is not a design concept and not a redesign proposal. It is the release
> plan of an existing enterprise SaaS platform."* — `01-temel.html` §0

Ekran envanteri **V22 "Temel"** belgesindedir; v23/v24 o tabana **eklenen**
yetenekleri anlatır. Bu yüzden karşılaştırma üç katmanlı yapıldı:

1. **V22 taban envanteri** — hangi ekranlar var sayılıyor,
2. **v23 eklemeleri** — Enterprise Polish,
3. **v24 eklemeleri** — Workflow & Orchestration.

### ⚠️ Referans ile mevcut ürün AYNI ŞEYİ MODELLEMİYOR

Bu, analizin en önemli bulgusu ve her maddeyi etkiliyor:

| | Referans (V22 tabanı) | Mevcut kod |
|---|---|---|
| Odak | **Portföy operasyonu** — görev, iş emri, bildirim, takvim, widget, AI | **KMK hak sahipliği ve muhasebe** — arsa payı, hisse, tahakkuk, borç sorumluluğu, denetim izi |
| Veri modeli | Estate → Block → Unit → Resident · Work Order · Task · Dues | Tenant → Apartman → Blok → Kat → BağımsızBölüm · Malik/Kiracı/Sakin · Borç · Yevmiye |
| Sakin kavramı | "Resident" tek kavram | Malik · Kiracı · Sakin **ayrı** (KMK md. 20/22 sorumluluk farkı) |
| Sayı ölçeği | 150 site · 25.000 sakin (tek görünüm) | Tenant başına izolasyon (ADR-0002 · RLS) |

Referansın "Toplam Site 150" KPI kartı ile mevcut mimarinin RLS izolasyonu
doğrudan çelişir. Bu çelişki **ADR-0002'de öngörülmüş** ve çözüm yolu
yazılmıştı; bu oturumda o yol uygulandı (aşağıda §1).

**Bu yüzden öneri:** referanstaki her maddeyi birebir kopyalamak yerine,
**kavramsal karşılığı** kurulmalı. Örneğin "Resident 25.000+" karşılığı
mevcut modelde "Sakin + Malik + Kiracı" üçlüsüdür ve tek sayıya indirilmesi
KMK sorumluluk ayrımını gizler.

---

## 1. Yönetim yapısı — ✅ BU OTURUMDA TAMAMLANDI

Kullanıcının zorunlu tuttuğu **Portföy Yönetim Merkezi** uygulandı.

| Gereksinim | Durum | Nerede |
|---|---|---|
| Yönetim Firması ayrı modül | ✅ | `tenant.tip = YONETIM_SIRKETI` (ADR-0009) |
| Site/Apartman Yönetimi ayrı modül | ✅ | `tenant.tip = APARTMAN \| SITE` (ADR-0008) |
| Bir firmanın çok projeyi yönetmesi | ✅ | `yonetim_delegasyonu` — açık devir (0014) |
| Her proje bağımsız yönetim bilgisi | ✅ | Her proje kendi tenant'ı; RLS izole |
| Çoklu proje desteği | ✅ | Portföy özeti proje başına sorgu + toplama |
| Firma girişte projeye YÖNLENDİRİLMEZ | ✅ | `YONETIM_SIRKETI.varsayilanPanel = '/portfoy'` |
| Kontrol merkezi göstergeleri | ✅ | `GET /portfoy/ozet` — 12 gösterge |
| Panelden proje seçimi | ✅ | `POST /portfoy/projeler/:id/gir` |
| Proje seçilince yalnızca o proje | ✅ | Jeton `tid = proje`; RLS zorlar |

**Kontrol merkezi göstergelerinin durumu:**

| İstenen | Durum |
|---|---|
| Yönetilen Site / Apartman / Toplam Proje | ✅ devir kaydından |
| Toplam Bağımsız Bölüm · Malik · Kiracı | ✅ proje başına sayım |
| Toplam Personel | ✅ |
| Tahsilat Durumu | ✅ tahakkuk/tahsil/kalan + oran |
| Kritik Uyarılar | ✅ 4 kural (sertifika · vade · bölüm yok · kurulum) |
| AI Önerileri | ⚠️ **veriden türetiliyor, model çağrısı yok** — sahte AI metni üretilmedi |
| Açık İş Emirleri | ❌ **modül yok** → `-1` döner, ekran "Modül hazır değil" gösterir |
| Bekleyen Talepler | ❌ **modül yok** → `-1` |

> Son iki gösterge için uydurma sayı üretilmedi. Sıfır basmak, "iş emri yok"
> ile "iş emri modülü yok" ayrımını gizlerdi.

### Proje seçildikten sonra görünmesi istenen modüller

| Modül | Backend | Ekran |
|---|---|---|
| Dashboard | ✅ | ✅ `/yonetim` |
| Malik | ✅ | ⚠️ yalnızca bölüm detayında (kendi sayfası yok) |
| Kiracı | ✅ | ⚠️ yalnızca bölüm detayında |
| Sakin | ✅ | ✅ `/sakin` |
| Daireler | ✅ | ✅ `/daireler` · `/bolumler` |
| Muhasebe | ✅ (yevmiye · hesap planı) | ❌ **ekran yok** |
| Aidatlar | ✅ (tahakkuk motoru) | ❌ **ekran yok** |
| Personel | ✅ | ✅ `/site-personeli` |
| Belgeler | ✅ (tam) | 🔴 **menüde link var, SAYFA YOK** |
| Teknik İşler | ❌ | ❌ |
| Güvenlik | ⚠️ kısmen (misafir · araç · zimmet) | ⚠️ `/misafirler` |
| AI Asistanı | ❌ | ❌ |

🔴 **Acil bulgu:** `components/uygulama-kabugu.tsx` menüsünde `/belgeler`
girdisi var ama `app/belgeler/` **yok** — link 404 veriyor. Eski "Kişiler"
girdisiyle **aynı hata sınıfı** (o da olmayan bir rotayı gösteriyordu ve
kaldırılmıştı). Backend Belge modülü tam çalışıyor; eksik olan yalnızca ekran.

---

## 2. Personel görev yürütme akışı — ❌ HİÇ YOK

Kullanıcının listelediği akış, mevcut `site_personeli` modülünde **yok**.
Ayrımı görmek önemli:

| Var olan | İstenen |
|---|---|
| **KADRO kaydı**: kimlik · görev · departman · SGK · vardiya · sertifika · zimmet · işe giriş/çıkış | **GÖREV YÜRÜTME**: görev tanımı · plan · oturum · fotoğraf · konum · onay |

| Gereksinim | Durum | Not |
|---|---|---|
| Personel kartı | ✅ | `/site-personeli` |
| Görev tanımları | ❌ | yeni varlık: `gorev_tanimi` |
| Günlük görev planı | ❌ | yeni varlık: `gorev_plani` |
| Haftalık görev planı | ❌ | aynı varlığın haftalık görünümü |
| Vardiya | ⚠️ | `site_personeli.vardiya` **statik alan**; vardiya ÇİZELGESİ yok |
| Devam durumu | ❌ | `puantaj` — v23'te "personel puantaj" raporu olarak geçiyor |
| Göreve Başla / Mola / Devam / Sonlandır | ❌ | yeni varlık: `gorev_oturumu` + durum makinesi |
| Görev öncesi / sonrası fotoğraf | ❌ | **altyapı HAZIR**: `nesne-deposu.service.ts` önimzalı URL |
| Görev sırasında not | ❌ | `gorev_oturumu_notu` |
| Açıklama | ❌ | |
| GPS konumu (altyapı) | ❌ | referanslarda **GPS geçmiyor**; `geofence`/`check-in` **v29-v31**'de |
| QR/NFC doğrulama (altyapı) | ❌ | QR **v27**'de geçiyor; NFC hiç geçmiyor |
| Yapılan / yapılmayan işler | ❌ | plan ile oturum karşılaştırması |
| Yönetici onayı | ❌ | v24'ün Onay Akışı ile aynı desen |

**Uyarı — sıralama:** bu akış v24'ün **Approval Workflow** ve **SLA** desenine
dayanır. Onay/SLA altyapısı kurulmadan görev onayını tek modüle gömmek, v24
geldiğinde ikinci bir onay mekanizması doğurur. v24 belgesi bunu açıkça
söylüyor: *"AI needs processes to accelerate and analytics needs process data
to measure"* — yani sıra **workflow → onay → görev akışı**.

**Uyarı — KVKK:** GPS konumu ve fotoğraf, personelin **sürekli izlenmesi**
anlamına gelebilir. Referansın Definition of Done'ı her sürüm için
*"KVKK data-processing record updated"* şartı koyuyor. Konum toplama
başlamadan önce aydınlatma metni ve saklama süresi tanımlanmalı; aksi hâlde
teknik olarak çalışan ama hukuken kullanılamayan bir özellik olur.

---

## 3. V23 — Enterprise Polish · 15 bölüm

| # | Bölüm | Durum | Not |
|---|---|---|---|
| 2 | Widget Framework (kayıt defteri) | ❌ | Widget kavramı hiç yok |
| 2 | Saved Views / Kayıtlı Görünümler | ❌ | Süzgeçler var, kaydedilmiyor |
| 2 | Command Palette (Ctrl+K) | ❌ | |
| 2 | Multi-estate Scope Selector | ✅ | **Portföy Merkezi bunun karşılığı** |
| 2 | Bulk Actions | ⚠️ | `bolumTopluOlustur` · `arsaPayiDuzelt` var; genel çoklu seçim yok |
| 2 | Notification digest | ❌ | Bildirim modülü yok |
| 3 | Density modes | ✅ | `YogunlukAnahtari` |
| 3 | Tam durum kapsaması (boş/yükleniyor/hata) | ✅ | `components/durumlar.tsx` |
| 3 | Sticky header · kolon boyut/görünürlük | ⚠️ | `components/tablo` var; kolon denetimi yok |
| 3 | Breadcrumbs | ✅ | `kirinti-yolu.tsx` |
| 3 | Inline validation + autosave | ⚠️ | Doğrulama var, **autosave yok** (bilinçli: finansal formda tehlikeli) |
| 3 | Klavye modeli · kısayol yardımı | ⚠️ | Odak halkaları var; kısayol sayfası yok |
| 4 | Sürükle-bırak pano düzeni | ❌ | |
| 4 | Karşılaştırma modu (grafik) | ❌ | |
| 4 | KPI trend + hedef + sparkline | ❌ | |
| 4 | Drill-through | ⚠️ | Bazı kartlar tıklanabilir; sistematik değil |
| 4 | Zaman aralığı denetimi | ❌ | |
| 4 | "My Day" widget | ❌ | |
| 5 | AI bağlam farkındalığı · özet · kaynak | ❌ | AI modülü yok |
| 6 | Rapor kütüphanesi (~20 rapor) | ❌ | |
| 6 | XLSX/CSV/PDF her yerde | ⚠️ | CSV içe aktarma var; **çıktı kütüphanesi kararı bekliyor** |
| 6 | Zamanlanmış e-posta | ❌ | |
| 7 | 13 aylık trend temeli | ❌ | |
| 7 | Kohort karşılaştırma | ⚠️ | Portföy özeti ilk adım |
| 7 | Veri sözlüğü | ❌ | |
| 8 | Tekrarlayan görevler | ❌ | `is_calistirma` altyapısı var, görev yok |
| 8 | Hatırlatma kuralları | ❌ | |
| 8 | Otomatik atama | ❌ | |
| 9 | Rol & izin matrisi | ✅ | `roller.ts` · `izinler.ts` · Üç Kapı |
| 9 | Audit log (değişmez, dışa aktarılabilir) | ✅ | Hash zincirli; UPDATE/DELETE trigger reddi |
| 9 | Kullanıcı yaşam döngüsü (toplu davet vb.) | ❌ | |
| 9 | Tenant ayar konsolu | ⚠️ | `tenant` alanları var; konsol yok |
| 9 | Feature flag konsolu | ❌ | |
| 10 | Portföy özet kartı | ✅ | **Bu oturumda** |
| 10 | İstisna listesi (en sapan 5 proje) | ⚠️ | Kritik uyarılar ilk adım; sıralama yok |
| 10 | Haftalık yönetici e-postası | ❌ | |
| 11 | Responsive denetim (360/390/768) | ⚠️ | Responsive yazıldı, ölçülmedi |
| 11 | Bottom-sheet · 44px dokunma · pull-to-refresh | ❌ | |
| 12 | MFA (TOTP+SMS) | ❌ | |
| 12 | Oturum yönetimi · cihaz listesi | ⚠️ | Refresh var; **iptal/rotasyon YOK** (`jti` üretiliyor, saklanmıyor); cihaz listesi yok |
| 12 | Şifre politikası · sızıntı denetimi | ⚠️ | **scrypt** hash var (Argon2 DEĞİL — aşağıdaki düzeltmeye bakın); politika yok |
| 12 | Kimlik uçlarında hız sınırı | ⚠️ | **Uca özel sınır VAR** (`0f5d7c1`); genel throttle yok, hesap kilidi yok — aşağıdaki düzeltmeye bakın |
| 12 | KVKK altyapısı (envanter · saklama · aydınlatma) | ⚠️ | Saklama süreleri belge modülünde var; envanter/aydınlatma yok |
| 13 | Build pipeline · code splitting · sanallaştırma | ⚠️ | Next.js derliyor; liste sanallaştırma yok |
| 13 | `prefers-reduced-motion` | ✅ | |

### ⚠️ §12 satırlarında iki DÜZELTME (31 Temmuz 2026)

Bu belgenin ilk yazımında güvenlik satırlarındaki iki tespit **koda
bakılmadan** yazılmıştı. İkisi de yanlıştı ve ikisi de plan kararını etkiler:

**1. "Argon2 hash var" → HAYIR, scrypt.**

`backend/src/common/security/sifre.ts` `node:crypto` scrypt kullanır ve
dosyanın kendi başlığı bunu **bilinçli bir tercih** olarak yazar: bcrypt/argon2
native derleme gerektiren bir bağımlılık ekler, scrypt Node çekirdeğindedir
(ADR-0007 ile aynı gerekçe).

Bu bir isim yanlışı değil, **planlama hatası kaynağıdır**: "Şifre politikası"
işi Argon2 varsayımıyla boyutlandırılırsa yanlış parametre ekseninde
(memory/time/parallelism) çalışılır. scrypt'in ekseni `N · r · p`'dir ve mevcut
değer `N=2^17, r=8` — **istek başına ≈134 MB**. Politika yazarken bu maliyet
hesaba katılmalıdır.

**2. "Genel throttle var; uca özel kilit yok" → TAM TERSİ.**

Yazıldığı sırada depoda **hiçbir hız sınırı yoktu** (31 Temmuz denetimi,
SESSION_SUMMARY §3.F P0-3: `throttle|rate-limit` araması 0 sonuç). Bugün ise
durum satırın söylediğinin tersidir:

| | Belgenin dediği | Gerçek (`0f5d7c1` sonrası) |
|---|---|---|
| Genel throttle | var | **yok** (bilinçli — işaretsiz uç sınırlanmaz) |
| Uca özel sınır | yok | **var** — `/oturum/giris` IP 20 · e-posta 5 / 5 dk |

⚠️  **"Hız sınırı" ile "hesap kilidi" AYNI ŞEY DEĞİLDİR** ve v23 §12'nin
istediği ikisidir. Bugün yapılan hız sınırıdır: pencere dolunca 429 döner ve
pencere kayınca kendiliğinden açılır. Hesap kilidi ise başarısız denemelerden
sonra hesapta **kalıcı durum** bırakır ve açılması yönetici ya da doğrulanmış
bir akış ister. Kilit **HÂLÂ YOK**; bu satır kapanmış sayılmamalıdır.

⚠️  Hız sınırı **hızı** sınırlar, **eşzamanlılığı** değil: en kötü durumda 20
eşzamanlı scrypt ≈ 2,7 GB. Kalan boşluk SESSION_SUMMARY §3.H'de yazılıdır.

**Ders:** bu iki satır, belgenin kendi §6 kuralına (*"referans ile mevcut kodu
madde madde karşılaştır"*) uymadan yazılmış. Durum sütunu kodla
doğrulanmadığında, boşluk analizinin kendisi boşluk üretir — üstelik "analiz
yapıldı" görüntüsü altında.

---

## 4. V24 — Workflow & Orchestration · 15 bölüm

Bu sürümün **tamamı eksik.** Mevcut kodda karşılığı olan tek şey `outbox`
(olay yayını) ve `is_calistirma` (zamanlanmış iş) altyapısıdır — ikisi de
v24'ün *substrate*'i, kendisi değil.

| # | Bölüm | Durum |
|---|---|---|
| 2 | Workflow Center / İş Akışı Merkezi | ❌ |
| 2 | Automation Builder (tetikleyici→koşul→eylem) | ❌ |
| 2 | Approval Workflow (eşikli · vekilli · paralel) | ❌ |
| 2 | Notification Center (kanal · tercih · teslim) | ❌ |
| 2 | Unified Inbox / İşlem Kutusu | ❌ |
| 2 | SLA yönetimi | ❌ |
| 2 | Süreç şablonları | ❌ |
| 3 | Aşama zaman çizelgesi · @mention · yorum | ❌ |
| 4 | Yeni widget'lar (bekleyen onay · SLA riski) | ❌ |
| 5 | AI triyaj · mükerrer tespiti · taslak üretimi | ❌ |
| 6 | Süreç performansı · onay denetimi · SLA raporu | ❌ |
| 7 | Darboğaz · iş yükü dağılımı · ilk seferde çözüm | ❌ |
| 8 | Otomasyon kütüphanesi (aidat hatırlatma merdiveni) | ❌ |
| 9 | Workflow tasarımcı izinleri · sandbox · sürümleme | ❌ |
| 10 | Yönetici onay kuyruğu · yönetişim görünümü | ❌ |
| 11 | Push mimarisi · mobil onay akışı | ❌ |
| 12 | **Görevler ayrılığı** (talep eden ≠ onaylayan) | ❌ |
| 12 | Dijital onay kaydı (zaman · IP · cihaz) | ⚠️ Audit kaydı bunları taşıyor; onay kaydı yok |
| 13 | Asenkron kuyruk · olay güdümlü mimari | ⚠️ Outbox var, tüketici yok |

> v24'ün **§12 Segregation of duties** maddesi mevcut mimariyle özellikle
> uyumlu: Üç Kapı ve izin matrisi hazır zemin. Onay akışı geldiğinde
> "talep eden onaylayamaz" kuralı `PermissionGuard` düzeyinde uygulanabilir.

---

## 5. Öncelik önerisi

Referansın kendi sıralaması **v23 → v24**'tür ve gerekçesi yazılı:
*"V23 buys the structural capacity that every release from V24 to V34 will
consume."* Buna ve mevcut boşluklara göre:

1. 🔴 **`/belgeler` ekranı** — menüde ölü link var, backend tam. En düşük
   maliyet, en görünür kazanç.
2. 🔴 **Aidat/Tahakkuk ekranı (Tahakkuk Sihirbazı)** — sistemin para üreten
   tek akışı; backend önizlemeli çalışıyor, ekranı yok. Zaten sıradaki görevdi.
3. **Muhasebe ekranı** — yevmiye ve hesap planı backend'de var.
4. **Malik / Kiracı için ayrı liste ekranı** — bugün yalnızca bölüm detayında.
5. **v24 iskeleti: İş Emri + Onay Akışı + Bildirim Merkezi** — "Teknik İşler",
   "Açık İş Emirleri" ve personel görev onayının **ortak** temeli. Üçünü ayrı
   ayrı kurmak üç farklı onay mekanizması doğurur.
6. **Personel görev yürütme akışı** — (5) üzerine kurulur. GPS/QR öncesinde
   KVKK aydınlatma ve saklama süresi tanımlanmalı.
7. **v23 pano derinliği** — widget kayıt defteri, kayıtlı görünüm, komut
   paleti, KPI trend.

### ⚠️ Bu sıralama ÖZELLİK sıralamasıdır — önünde bir PLATFORM maddesi var

31 Temmuz altyapı denetimi (SESSION_SUMMARY §3.F), bu listedeki hiçbir maddenin
görmediği bir açık buldu ve **yukarıdaki 1. maddenin önüne geçer**:

> **`yalnizcaKendiVerisi` uygulanmıyor.** `RolTanimi.yalnizcaKendiVerisi` ve
> `KENDI_VERISI_KISITLI` tanımlı ama **hiçbir yerde okunmuyor**. Bugün
> `MALIK`/`KIRACI`/`SAKIN` rolündeki bir kullanıcı, taşıdığı
> `KISI_GORUNTULE` + `BOLUM_GORUNTULE` izinleriyle `GET /kisiler` ve
> `GET /bolumler` uçlarından **tüm sitenin listesini** çekebiliyor. README:151
> bunun tersini iddia ediyor. KVKK açığıdır.

⚠️  **Sıralama gerekçesi:** bu listedeki maddeler ekran ekler; ekranlar aynı
okuma uçlarını kullanır. Yetki kısıtı konmadan eklenen her ekran, açığın
yüzeyini **büyütür** — sonra hepsini birden geri gitmek gerekir. Kısıt önce
konursa yeni ekranlar doğduğu anda doğru davranır.

⚠️  Bu iki belge **AYNI ÜRÜNÜN farklı eksenleridir** ve ayrı ayrı okunursa
çelişirler: burası *"hangi özellik eksik"*, §3.F *"var olan ne kadar sağlam"*
sorusunu yanıtlar. Örtüştükleri yerler var — v24 §13 satırındaki
*"Outbox var, tüketici yok"* ile §3.F'nin kuyruk bulgusu **aynı boşluktur**.
Birini kapatıp ötekini güncellememek, kapanmış bir maddeyi açık göstermeye
devam eder (yukarıdaki §12 düzeltmelerinin sebebi tam olarak budur).

---

## 6. Bu analizde uyulan kurallar

- Referans dosyalar **referans mimari** kabul edildi.
- Mevcut yapı **bozulmadı**; hiçbir ekran yeniden tasarlanmadı.
- **Yeni mimari kurulmadı.** Portföy Merkezi bile yeni bir tasarım değil:
  [ADR-0002](adr/log/0002-tenant-modeli.md)'nin *yazılı* çözüm yolunun
  (yönetim şirketi tenant'ı + açık devir) uygulanmasıdır.
- İsimlendirme ve hiyerarşi mevcut projeyle uyumlu tutuldu.
- Karşılığı olmayan gösterge için **uydurma veri üretilmedi** (`-1` = modül yok).
