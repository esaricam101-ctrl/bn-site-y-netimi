# Referans envanteri ve arayüz durumu

**Tarih:** 3 Ağustos 2026
**Yöntem:** dosyalar okundu, uçlar sayıldı. Çıkarılamayan yerlere
**"bilinmiyor"** yazıldı.

> ⚠️ Bu belge önce `V23-ENVANTER.md` adıyla yazılmıştı. **Ad yanıltıcıydı:**
> içerik yalnızca V23'e ait değil, birden çok sürümün referanslarını kapsıyor.
> Yeniden adlandırıldı.

---

## 0. ★ SÜRÜM AYRIMI — hangi dosya hangi sürüm

Bu ayrım yapılmadan envanter okunursa **yanlış referansa bakılır.** Dört ayrı
şey var:

| Kategori | Dosya | Sürüm | Ne işe yarar |
|---|---|---|---|
| **Tanıtım sitesi** | `docs/reference/marketing/canva-export-landing-page.html` | **V23** | Pazarlama sayfası — **yönetim paneli DEĞİL** |
| **Sürüm yol haritası** | `docs/reference/roadmap/*.html` (20 dosya) | V22-V34 | Sürüm planı; ekran envanteri değil |
| **Panel prototipleri** | `docs/reference/prototypes/*.html` (3 dosya) | **bilinmiyor** | §0.2 |
| **Sekme haritası** | ⛔ **depoda YOK** | **V16** | §1 — sabit kayıt |

### 0.1 · V23 = tanıtım sitesi, panel değil

İlk yazımda *"V23 bir sürüm yol haritasıdır"* demiştim. **Eksikti.** Paylaşılan
V23 dosyası bir **tanıtım sitesidir**; içinde sekme haritası yoktur, landing
page bölümleri vardır.

**Doğrulandı** (`canva-export-landing-page.html`, ham sayım):

| Bölüm | Eşleşme |
|---|---|
| Platform · Modüller · AI Center · Fiyatlandırma · Referanslar · Blog | 3 · 2 · 2 · 2 · 2 · 3 |

### 0.2 · ⚠️ AD ÇAKIŞMASI — depodaki `bn-dashboard.html`, V16 prototipi DEĞİL

*"V16 prototipi (bn-dashboard) projede ekli değildir, dosya depoda
aranmasın"* denildi. **Doğru — ama depoda AYNI ADLA BAŞKA bir dosya var** ve
önceki turda yanlışlıkla o okundu.

Ölçüm ikisinin farklı olduğunu kesinleştiriyor. V16'nın 13 sekmesi ve 6 menü
grubu depodaki dosyada **arandı, bulunamadı**:

| Aranan | `prototypes/bn-dashboard.html` içinde |
|---|---|
| Sakinler · Bloklar · Daireler · Raporlar · Belgeler · Foto | **0 · 0 · 0 · 0 · 0 · 0** |
| Yapı Yönetimi · Güvenlik & Teknik · İş Yönetimi · Doküman & Medya · Analiz & Raporlar | **0 · 0 · 0 · 0 · 0** |

Depodaki dosyanın gerçek içeriği bir **operasyon panosudur**: Açık İş
Emirleri · Vardiya Kapsamı · Temizlik · Şikâyet Temaları · Widget Kataloğu ·
Tedarikçi Performansı.

> ★ **Sonraki oturum için uyarı:** `bn-dashboard.html` adını görüp *"V16
> prototipi burada"* sanmayın. **Aynı ad, farklı belge.** V16 depoda yoktur.

`bn-finance.html` ve `bn-ai-center.html`'in hangi sürüme ait olduğu
**bilinmiyor** — dosyalarda sürüm etiketi yok.

---

## 1. ★ SEKME HARİTASI (V16) — SABİT KAYIT

> ⚠️ **BU BÖLÜM DOSYADAN DOĞRULANAMAZ.** V16 prototipi depoda yoktur; harita
> ürün sahibinin paylaştığı kod üzerinden çıkarılmıştır. İleride dosyaya
> dönüp doğrulama **yapılamaz**. Değişiklik gerekirse ürün sahibinden
> **yeniden istenir.**

### 1.1 · Site detay sekme deseni — 13 sekme

> Genel · İletişim · Bloklar · Daireler · Sakinler · Personel · Otopark ·
> Teknik · Belgeler · Foto · Görevler · AI · Raporlar

★ **Apartman modülünde sekmeler AZALIR ve MUHASEBE sekmesi EKLENİR.**
Hangilerinin düşeceği kararı **verilmedi**.

### 1.2 · Sol menü gruplaması — 6 başlık, 40 öğe

> Yapı Yönetimi · Güvenlik & Teknik · İş Yönetimi · Doküman & Medya ·
> Analiz & Raporlar · Sistem

⚠️ 40 öğenin **tek tek listesi elde yok** — yalnızca grup başlıkları var.
Bugünkü menü (`uygulama-kabugu.tsx`) **11 öğe ve gruplamasız**.

### 1.3 · Yönetim firması dashboard (Portal 1 referansı)

Menü üst bloğu:

> Dashboard · Site Detayları · Site Listesi · Yeni Site · Devam Eden ·
> Tamamlanan · Arşivlenen

**8 KPI kartı** + site listesi **kart düzeni**.

### 1.4 · ⛔ ÇELİŞENLER ALINMAZ — ürün sahibi kararı

| Referansta | Neden alınmaz |
|---|---|
| **"Blok Yönetimi"** terimi | BFS v1 §13.1 bağlayıcı: "blok" yalnızca site içindeki yapı birimidir; tek yapının yönetimi **apartman yönetimidir** |
| **`Resident` tek kavramı** | Malik · Kiracı · Sakin **ayrıdır** (KMK md. 20/22 sorumluluk farkı) |
| Malik/Kiracı ayrımının olmaması | aynı sebep |

> ★ **Uyarlanan YERLEŞİM ve DESENDİR, veri modeli değil.**

---

## 2. `frontend/web` — tek gerçek arayüz

Depoda **tek frontend vardır.** Prototipler ve tanıtım sitesi statik HTML'dir;
çalışan ikinci bir uygulama yoktur — *"hangisi devam edecek"* sorusu düşer.

| | |
|---|---|
| Teknoloji | **Next.js** (app router), TypeScript, Tailwind, `next-intl` |
| Dosya | 54 `.ts`/`.tsx` (node_modules ve `.next` hariç) |
| Rota | **17 sayfa** |

### Menü — 11 öğe, gruplama yok

| # | Yol | Sayfa |
|---|---|---|
| 1 | `/yonetim` — Genel Bakış | ✅ |
| 2-5 | `/apartmanlar` · `/bloklar` · `/katlar` · `/bolumler` | ✅ |
| 6-8 | `/site-personeli` · `/daire-gorevlileri` · `/misafirler` | ✅ |
| 9-10 | `/gider-turleri` · `/muhasebe` | ✅ |
| 11 | `/belgeler` | ⛔ **SAYFA YOK → 404** |

Menüde olmayan ama var olan rotalar: `/portfoy` · `/sakin` · `/iletisim` ·
`/daireler/[bolumId]` · `/giris`.

### Muhasebe sekmesi — altı sekme, hepsi API'ye bağlı

| Sekme | Uç |
|---|---|
| Fişler (işle · storno) | `GET/PATCH/POST /muhasebe/fisler…` |
| Hesap Planı | `GET /muhasebe/hesaplar` |
| Defterler (**yalnızca yevmiye**) | `GET /muhasebe/defterler/yevmiye` |
| Mizan (+ denksizlik uyarısı) | `GET /muhasebe/dokumler/mizan` |
| Makbuzlar (+ kontrol mutabakatı rozeti) | `GET/POST /makbuzlar…` |
| Dönem (numaralandır · açılış · yansıtma · kapat) | `POST /muhasebe/donemler/:id/…` |

Sayfanın kendi notu: *"MOCK YOKTUR… uydurma bir mizan gerçek bir mizan gibi
görünür ve karar dayanağı sanılabilir."*

---

## 3. ★ MOCK VARSAYILAN AÇIK — ölçüm BEKLİYOR

`lib/servis.ts:38`:

```ts
export const MOCK_AKTIF = (process.env['NEXT_PUBLIC_MOCK'] ?? '1') !== '0';
```

⚠️ Varsayılan `'1'`; `.env` ve `.env.example` içinde `NEXT_PUBLIC_MOCK`
**hiç geçmiyor**. Yani bugün ekranların çoğu **sahte veriyle** çalışıyor.

| Servis bloğu | Mock |
|---|---|
| `servis` (apartman · blok · kat · bölüm · malik · kiracı · sakin · kişi · misafir · personel · gider türü · portföy) | **EVET** |
| `muhasebe` · `makbuzlar` | **HAYIR** — blokta 0 `MOCK_AKTIF` eşleşmesi |
| `iletisim` | bilinmiyor |

> ★ **BEKLEYEN ÖLÇÜM — en öncelikli iş:** varsayılan `'0'` yapılınca hangi
> ekranlar kırılır? Yeni yazılacak her ekranı etkiler. **Henüz ölçülmedi.**

---

## 4. Backend'de hazır ama ekranı olmayan uçlar

**Backend 206 uç · frontend `servis.ts` 66 yol.**

### Ekranı HİÇ olmayan modüller

| Modül | Uç (yaklaşık) |
|---|---|
| **Banka** — hesap · şube · POS · hareket · ekstre · mutabakat · çek/senet · virman | ~30 |
| **Tahakkuk** | 3 |
| **Virman** (`POST /virman`) | 1 |
| **Sayaç** · **Araç** · **Geri alma** · **Kişi** | 6 · 3 · 3 · 3 |
| **Belge** — menüde var, sayfa yok | 12 |

### Servis var, ekran yok

`GET /makbuzlar/rapor/yaslandirma` · `GET /muhasebe/defterler/kasa`

### Ne servis ne ekran

`GET /muhasebe/defterler/muavin/:hesapId` · `GET /makbuzlar/cari/:bolumId`
(**cari ekstre**) · `GET /makbuzlar/borclar/:bolumId` ·
`POST /makbuzlar` (**tahsilat kaydı**) · `POST /makbuzlar/tahsis-onerisi` ·
`POST /tahakkuk/calistir` · `POST /tahakkuk/calismalar/:id/muhasebelestir` ·
`GET/PATCH /muhasebe/parametreler`

★ **En ağır boşluk:** para giren yol (`POST /makbuzlar`) ve para doğuran yol
(`POST /tahakkuk/calistir`) **arayüzsüz.** Kullanıcı ekrandan ne borç
yaratabiliyor ne tahsilat kaydedebiliyor — yalnızca sonuçlarını okuyabiliyor.

---

## 5. Görsel dil

`frontend/web/app/globals.css` ile prototipler **aynı paleti** kullanıyor —
aktarım geçmişte yapılmış:

| Token | Koyu | Açık |
|---|---|---|
| `--primary` · `--secondary` | `#0E7490` · `#2563EB` | aynı |
| `--dark` · `--darker` | `#0F172A` · `#060B14` | `#F1F5F9` · `#FFFFFF` |
| `--success` · `--warn` · `--crit` · `--info` | `#10B981` · `#F59E0B` · `#EF4444` · `#38BDF8` | koyulaştırılmış |

Ölçüler: `--r: 14px` · `--rs: 10px` · `--pad/--cardpad: 20px` ·
`--rowh: 44px` · `--fz: 14px`. Prototipte font `DM Sans`; `layout.tsx` içinde
font tanımı **bulunamadı** — kullanılan font **bilinmiyor**.

Yeniden kullanılacak bileşenler: `components/sekmeler.tsx` ·
`components/tablo/` · `components/durumlar.tsx` · `components/bildirim.tsx` ·
`components/istatistik-karti.tsx` · `components/uygulama-kabugu.tsx`.

---

## 6. ★ MUHASEBE — HİÇBİR SÜRÜMDE YOK

Apartman modülü planının dayanağı budur:

| Kaynak | Muhasebe ekranı |
|---|---|
| **V16 prototipi** (sekme haritası) | ⛔ 13 sekme arasında muhasebe **yok** |
| **V23 tanıtım sitesi** | ⛔ landing page; ekran içermiyor |
| `bn-finance.html` (sürüm bilinmiyor) | ✅ var ama **kurumsal ölçek** — §6.1 |

**Referans: Apsis demosu + Natal Apartmanı gelir-gider formatı.**

⚠️ **İkisi de depoda YOK.** `docs/` altında `Natal` için 0 eşleşme; Apsis
demosu da dosya olarak yok. Ekran yazılmadan önce bu iki referans depoya
alınmalı — aksi hâlde doğrulanamayan referanslar olarak kalır.

### 6.1 · `bn-finance.html` neden apartman için kullanılamaz

**30 bölüm · 11 görünüm**, ölçeği kurumsal:

> Alacak Yaşlandırma · Aylık Aidat Tahsilatı · Banka Hesapları · Banka
> Mutabakatı · Borçlar (Vade) · **Bütçe Sapması** · Daire Hesap Ekstresi ·
> Dönem Kapanış Kontrol Listesi · **e-Belge Durumu** · Finansal Denetim
> Kaydı · Finansal Politika · Gecikme Tazminatı · **IBAN Değişikliği · Çift
> Onay** · **İşletme Projesi 2026** · Karar Bekleyenler · **KDV Pozisyonu** ·
> Makbuz Serisi · Onay Bekleyen Harcamalar · Sözleşmeler · **Stopaj ve
> Tevkifat** · Tahakkuk Üretimi · Tahsilat Kanalları · Tedarikçi Kayıtları ·
> **Üç Yönlü Eşleştirme** · Yasal Takip · Yasal ve Yönetim Raporları ·
> Yenileme Fonu · **Yevmiye Kaydı** · Yükümlülük Takvimi · **13 Haftalık Nakit
> Projeksiyonu**

Koyu yazılanlar apartman ölçeğinde **hiç bulunmayan** kavramlardır. Prototip
kendi kapsamını da yazıyor:

> *"Kurumun kendi kurumlar vergisi ve beyannameleri harici muhasebe paketine
> aittir; bu modül **site** işletme defterini tutar."*

### 6.2 · Apartman modülü — SIFIRDAN yazılacak

Kapsam ([APARTMAN-SITE-AYRIMI §2.1](APARTMAN-SITE-AYRIMI.md)): `BASIT`
derinlik · yalnızca kasa + banka · gider fişinden hesap seç, tutar yaz ·
hesap planı/yevmiye/mizan **yok** · çıktı gelir-gider dökümü.

**Ham arama sonucu:**

| Kaynak | `apartman` · `basit` · `gelir-gider` · `kasa devri` · `aidat listesi` |
|---|---|
| 3 prototip | **0 eşleşme** (yalnızca `bn-finance`'ta *"işletme defteri"* 1 kez, o da **site** için) |
| 20 roadmap HTML | `apartman` · `basit muhasebe` · `single-entry` · `cash book` → **0**. `gelir-gider` 4 kez ama hepsi **kurumsal raporlama paketinin bir kalemi** (V26 · V28) |

★ **İki yanıltıcı kelime kontrol edildi ve elendi:**

| Kelime | Sanılan | Gerçek |
|---|---|---|
| `lightweight` (v31) | hafif ürün katmanı | *"lightweight custom **objects**"* — özel alan özelliği |
| `segment` (18 kez) | müşteri segmenti | *"audience **segmentation**"* — iletişim hedef kitlesi |

Roadmap'te **"küçük/basit müşteri katmanı" kavramı hiç yok.**

### 6.3 · ★ NÜANS — kavram adı örtüşmesi uyarlanabilirlik DEĞİLDİR

`bn-finance`'taki beş bölüm adı apartman modülünde de karşılığı olan
kavramlardır: *Daire Hesap Ekstresi · Aylık Aidat Tahsilatı · Alacak
Yaşlandırma · Makbuz Serisi · Banka Hesapları.*

⚠️ Bu "uyarlanacak ekran var" demek **değil**: kurumsal ekranın içindeler ve
çevrelerindeki KDV/stopaj/üç yönlü eşleştirme bağlamından koparılamıyorlar ·
statik HTML, taşınacak kod yok · veri modeli farklı.

Bu adlar **kontrol listesi** olarak değerli, tasarım kaynağı olarak değil.

---

## 7. Site muhasebe sekmesini tamamlamak için ne gerekiyor

Muhasebe sekmesi **okuma tarafında tam**, **yazma tarafında boş.**

| Eksik | Neden |
|---|---|
| **Tahsilat kaydı** (`POST /makbuzlar`) | Para giren yol |
| **Tahakkuk çalıştırma** | Para doğuran yol; önizleme ucu (`onizleme: true`) hazır |
| **Cari ekstre** (`/makbuzlar/cari/:bolumId`) | Borçluyla konuşurken bakılan ekran |
| **Kasa/banka defteri sekmesi** | Servis yazılı, sekme yok |
| **Muhasebe parametreleri** | Kurulum bugün yalnızca tohumla yapılabiliyor |
| **Virman ekranı** | Çekirdek uygulandı, arayüzü yok |

### Önerilen sıra

1. **Muhasebe parametreleri** — en küçük iş, ötekilerin ön koşulu: kontrol
   hesabı/kasa hesabı seçilmeden tahsilat muhasebeleşmiyor (ölçüldü).
2. **Tahakkuk çalıştırma** — para doğuran yol.
3. **Tahsilat kaydı + cari ekstre** — **birlikte**; ayrılırsa tahsilatın hangi
   borca sayıldığı arada doğrulanamaz.
4. **Kasa/banka defteri sekmesi** — küçük ekleme.
5. **Virman ekranı.**

★ Sıradan önce: **mock ölçümü** (§3) ve `/belgeler` menü öğesinin ne olacağı.

---

⚠️ Bu belge **envanterdir**, plan değildir. Modül planı birlikte kurulacak.
