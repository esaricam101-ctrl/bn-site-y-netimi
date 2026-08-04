# BNOS — Tam Menü Haritası

**Amaç:** BNOS'un hedef menü ve bilgi mimarisi. Rakip analizinden çıkarılan
sektör standardı + BNOS'a özgü kararlar birlikte.

**Yöntem:** Rakip ekranları sektörün ne beklediğini gösteriyor; birebir kopya
değil, kaçınılmaz olanı yapıyoruz. BNOS'un kendi kararları (ADR'ler) ve kendi
modülleri (AI motoru, personel/iş planı, kapsam kısıtı) haritaya işlendi.

**Not:** Bu belge menü ve bilgi mimarisini tanımlar; uygulama sırasını değil.

---

## 0. GİRİŞ YAPISI

```text
Giriş ekranı
├── Site Yönetimi          → CIFT_TARAFLI muhasebe, iki kademeli gider
├── Apartman Yönetimi      → BASIT muhasebe, tek kademe
└── Yönetim Şirketi        → çok projeli, konsolide dashboard
                              içinde: site ve apartman projelerine giriş
```

**BNOS kararı (ADR-0008):** Veri sahipliği ekseni PROJE'dir. Yönetim şirketi
kiracı değil, `YonetimSozlesmesi` üzerinden erişim mandasıdır. Sözleşme
bitince canlı veri erişimi kapanır, audit kaydı silinmez.

**BNOS kararı (docs/APARTMAN-SITE-AYRIMI.md):** `muhasebeDerinligi` alanı
`Tenant.tip`'ten türetilen varsayılanla kurulur, değiştirilebilir.
`CIFT_TARAFLI → BASIT` geçişi engellidir.

---

## 1. ÖZET (Dashboard)

Yöneticinin günlük ilk baktığı ekran.

| Bileşen | İçerik |
|---|---|
| Kasa tablosu | Devir + Giren − Çıkan = Kalan, hesap bazında |
| Son gider evrakları | Tarih · Evrak No · Cari · Tutar + hızlı ekleme |
| Son gelir evrakları | Aynı yapı |
| Mali göstergeler | Tahakkuk · Tahsilat · Açık alacak (üçü ayrı) |

**★ BNOS eki — gösterge tamamlanma oranı:**
`7/15 gösterge hesaplandı · 96 kayıt tarandı` biçiminde.
Hesaplanamayan gösterge boş/sıfır gösterilmez; **neden hesaplanamadığı** yazar
("dönem sayaç okuması eksik", "muhasebe parametresi tanımsız").
Gerekçe: bu, BNOS'un temel disiplininin (varsayma, eksiği söyle) arayüz
karşılığıdır.

**★ BNOS eki — demo/gösterim bandı:**
Tohum verisiyle kurulmuş tenant'ta üstte kapatılamaz uyarı:
"Bu bir gösterim ortamıdır. Kişi adları ve tutarlar kurgudur."

⚠️ **DÜZELTME (4 Ağustos 2026) — İKİ AYRI BANT, KARIŞTIRILMAMALI.**
Bu madde ilk yazıldığında bugünkü "sahte veri modu" bandıyla aynı şey
sanılmıştı; değildir. Tetikleyicileri farklıdır:

| Bant | Tetikleyici | Anlatığı | Durum |
|---|---|---|---|
| Sahte veri modu | `NEXT_PUBLIC_MOCK=1` (arayüz) | Veri API'den GELMİYOR | **var** |
| Gösterim ortamı | Tenant tohum verisiyle kurulmuş | Veri gerçek API'den geliyor ama KURGU | **yok** |

İkincisi bugün hiç yok: `NEXT_PUBLIC_MOCK=0` iken tohumla kurulmuş bir
projeye girildiğinde gerçek API'den kurgu isimler ve tutarlar gelir ve
ekranda hiçbir uyarı çıkmaz. Sunum ile üretimi ayırt eden işaret yoktur.

Tohumla kurulmuş projeyi işaretleyecek bir alan (`Tenant.gosterimMi`
gibi) henüz **yoktur**; bant ondan önce yazılamaz — "tohumdan mı geldi"
sorusu veriye bakarak tahmin edilemez.

---

## 2. SİTE

Projenin kendisiyle ilgili her şey.

```text
Site
├── Kişiler
├── Onay Bekleyen Kişiler
├── Onay Bekleyen Kişi Güncellemeleri
├── Daireler
├── Daire Listesi
├── Rezervasyon ›
├── Stok ›
├── Demirbaş
├── Personel
├── Eğitim Formları
├── Ajanda
├── Denetim ›
├── Yapılacak İşler
├── Toplantılar
└── Teklifler
```

**★ BNOS farkı — Kişiler:**
Rakip `Resident` tek kavramı kullanıyor. BNOS'ta **Malik / Kiracı / Sakin
ayrı varlıklardır** (ADR-0010) çünkü KMK m.20 ve m.22 farklı sorumluluk
doğuruyor. Kişiler ekranı bu ayrımı gösterir; tek listede karıştırmaz.

**★ BNOS farkı — sorumluluk tarihseldir:**
`MalikDonemi` / `KiraciDonemi` ile dönem bazlı tutulur. Kişi ekranında
"bu daireyi ne zamandan beri kim kullanıyor" görülebilir. Geçmiş dönem
kaydı değiştirilemez.

**★ BNOS eki — hisseli mülkiyet:**
Bir bağımsız bölümün birden çok maliki olabilir; `borc_sorumlusu` pay
bazında tutulur, Σ pay = borç tutarı kuralı zorunludur.

**Onay akışı (rakipten alınan):** Sakin kendi bilgisini güncellediğinde
doğrudan değişmez, yönetici onayına düşer. BNOS'ta bu akış yok — eklenecek.

---

## 3. FİNANS

Günlük para işi. Her işlem arka planda Muhasebe'ye fiş üretir.

```text
Finans
├── Kişilere Göre Finansal Durum
├── Borçlandırma ve Tahsilat ›
│   ├── Borç Makbuzu
│   ├── Tahsilat Makbuzu
│   ├── Detaylı Tahsilat Girişi
│   ├── İade Makbuzu
│   ├── Devir Bakiye Girişi
│   ├── Toplu Borçlandırma
│   ├── Otomatik Borçlandırma
│   ├── Gider Dağıtımı
│   ├── Gelir Dağıtımı
│   ├── Excel ile Borç Yükleme
│   ├── Excel ile Banka Hareketleri Yükleme
│   └── Toplu Tahsilat
├── Gider ›
│   ├── Gider Faturaları
│   ├── Ödeme Makbuzları
│   └── Gider Fişi
├── Gelir ›
│   ├── Gelir Faturaları
│   ├── Tahsilat Makbuzları
│   └── Gelir Fişi
├── Banka Hareketleri
├── Tekrarlanan Evraklar
├── Açılış Fişleri ›
│   ├── Personel Açılış Fişi
│   ├── Kasa Açılış Fişi
│   ├── Cari Hesap Açılış Fişi
│   ├── Gelir Açılış Fişi
│   ├── Gider Açılış Fişi
│   └── Genel Hesap Açılış Fişleri
├── Kasa Transfer Fişi
├── Hesaplar Arası Virman
├── Virman Fişi Detayları Yönetimi
├── İcra Takibi ›
├── Çek ve Senet ›
└── İşletme Projesi
```

### BNOS'a özgü kararlar — Finans

**★ Toplu Borçlandırma — önizleme zorunlu:**
Mali kayıt geri alınamaz (ters kayıtla düzeltilir). Dağıtım daire daire
gösterilmeden yazılmaz. `POST /tahakkuk/calistir` gövdesindeki
`onizleme: true` bayrağı bunu sağlar.

**★ Dağıtım kuralı — varsayılan + ezme:**
`GiderTuru.paylasimKurali` varsayılan gelir, tahakkukta ezilebilir.
Kullanılan kural `TahakkukCalismasi`'na kaydedilir (snapshot) — geçmiş
tahakkukun neden öyle dağıtıldığı sonradan cevaplanabilir olmalı.
Ezme yalnızca ek veri gerektirmeyen kurallara serbesttir; `TUKETIM` gibi
veri gerektiren kurallar veri sağlanmadan reddedilir.

**★ Dağıtım yöntemleri:**
`ESIT · ARSA_PAYI · M2 · SAYAC · BLOK_BAZLI · DAIRE_TIPI · DAIRE_GRUBU`
Son ikisi rakipten alındı (2+1, 1+1 gibi), BNOS'ta karşılığı yoktu.

**★ Mükerrer koruması (ADR-0014):**
`DONEMSEL` gider türlerinde (proje, dönem, gider türü) benzersizdir.
`OLAY_BAZLI` türlerde referans zorunludur; referans normalleştirilmiş
(boşluk/tire temizlenmiş, büyük harf) olarak benzersizdir.

**★ Virman (ADR-0016):**
Rakip "Kasa Transfer Fişi" ve "Hesaplar Arası Virman" diye ikiye ayırmış;
BNOS'ta menüde aynı ayrım korunur ama **altta tek kavramdır**:
çok satırlı fiş, her satır bir hesap, borç toplamı = alacak toplamı.

- Taşınma virmanı `borc_sorumlusu.pay` değiştirir, **yeni borç üretmez**
- Kasa/banka virmanı yevmiye fişi üretir
- Sebep kodu ZORUNLU (rakipte yok — yalnızca serbest açıklama var)
- Taslak YOK: kaydedilirse işlenmiştir
- `FINANS_VIRMAN` ayrı izin; yevmiye giriş iznine bağlı değil

**★ Tahsis — elle dağıtım asıl yol:**
FIFO yalnızca öneridir. Borçlunun beyanı bağlayıcıdır (TBK m.101).
Bir tahsilat farklı dairelerin borçlarına dağıtılabilir; çok daireli
malik senaryosu bu yolla çalışır.

**★ Avans reddedilir:**
Borcu aşan ödeme kabul edilmez. Yıllık peşin ödeme isteniyorsa önce ileri
dönem tahakkuku oluşturulur, sonra tahsil edilir. Gerekçe: hangi borca ait
olduğu belirsiz para, mutabakatı bozar ve TBK m.101 beyan hakkını çiğner.

**★ İşletme Projesi — tahakkukun dayanağı:**
Site: işletme projesi (KMK m.37, tebliğ + 7 gün itiraz + kesinleşme)
Apartman: kat malikleri kurulu kararı
Kanun ikisini eşdeğer tutar (İİK m.68). Tek `TahakkukDayanagi` kavramı,
iki tip. Durum tarihlerden **türetilir**, bağımsız yazılmaz.

**★ Aidat artış tavanı:**
KMK m.35/37 (7 Mayıs 2026) yeniden değerleme oranı üstü artışı genel kurul
onayına bağlar. İşletme projesi onayında kontrol edilir.

**★ İcra Takibi — BNOS'ta delil zinciri:**
Rakipte icra takibi bir liste. BNOS'ta **tebligat delil zinciri** olarak
kurgulanır: belge → tebliğ → süre → kesinleşme → icra edilebilirlik.
Her bildirimin kim/ne zaman/hangi kanal kaydı tutulur; icra dosyası eki
tek tuşla üretilir (kesinleşmiş işletme projesi + tebliğ delilleri +
karar defteri örneği + borç dökümü).

---

## 4. SAYAÇ İŞLEMLERİ

```text
Sayaç İşlemleri
├── Sayaç Dağıtımları
├── Birim Fiyat Üzerinden
├── Fatura Üzerinden
├── Raporlar: Sayaç Dağıtım Makbuzları Toplu Döküm · Sayaç Paylaşım Tablosu
└── Tanımlar: Ana Sayaç · Ara Sayaçlar · Daire Sayaçları · Modemler · Parametreler
```

**★ BNOS notu — merkezi ısıtma:**
Isınma ve sıhhi sıcak su gider paylaşımı ayrı bir yönetmelikle düzenlenir;
sabit/tüketim payı oranları mevzuata bağlıdır ve `mevzuat_parametre`'den
okunur, koda gömülmez (R6).

**★ Pay ölçerli / pay ölçersiz ayrımı:**
Pay ölçerli sitede `ISITMA` (dönemsel, tüketim); pay ölçersizde `YAKIT`
(olay bazlı, her dolum ayrı). Hangisinin kullanılacağı proje ayarıdır.
İkisi aynı dönemde birlikte kullanılırsa **uyarı** verilir (engellenmez) —
ısınma gideri iki kez yansımış olabilir.

---

## 5. MUHASEBE

Defter işi. Yalnızca `CIFT_TARAFLI` derinlikteki projelerde görünür.

```text
Muhasebe
├── Muhasebe Fişi
├── Muhasebe Fişi Detayları Yönetimi
├── Hesap Planı
├── Defterler ›
│   ├── Yevmiye Defteri
│   ├── Kasa Defteri
│   └── Büyük Defter
├── Raporlar ›
│   ├── Mizan
│   ├── Muhasebe Fişleri Günlük Gruplu Döküm
│   ├── Hesap Planı Dökümü
│   ├── Standart Muavin Döküm
│   ├── Ayrıntılı Bilanço
│   ├── Gelir Tablosu
│   ├── Muhasebe Fişleri Toplu Dökümü
│   └── Gelir Gider Muavini
├── Parametreler
└── Dönem Sonu Kapanış İşlemleri
```

### BNOS'a özgü kararlar — Muhasebe

**★ BASIT derinlikte bu menü HİÇ GÖRÜNMEZ.**
Apartman tarafında yalnızca kasa + banka vardır; hesap planı, yevmiye,
mizan yoktur. Muhasebe uçları `BASIT` projede 422 döner ve sebebini yazar.

**★ Aidat avanstır, gelir değil (ADR-0017):**
Alacak tarafı `34x` (alınan avanslar), `6xx` gelir değil. KMK m.20 aidatı
"toplanacak avans" olarak adlandırır; yönetim kâr amacı gütmez.
Bu bir **ürün kararıdır**, mevzuat zorunluluğu değil — yönetimlerin tüzel
kişiliği ve vergi mükellefiyeti yoktur, TDHP zorunlu değildir.

**★ Yenileme fonu = BORÇ, özkaynak değil.**
Kat maliklerine ait, iade edilebilir yükümlülüktür. VUK m.328'deki teknik
"yenileme fonu" ile karıştırılmamalıdır.

**★ Tahakkuk anındaki görünür tuhaflık — bilinçli:**
`120 borç / 349 alacak` kaydı "henüz yatırılmamış avans" ifade eder.
Doğrudur: tahakkuk, avans yükümlülüğünün doğduğu andır; ödeme o
yükümlülüğün nakde dönmesidir.

**★ Kâr/zarar sıfır DEĞİLDİR:**
Aidat tahmini bütçeye göre belirlenir. Gerçek giderler tahmini tutmaz —
tasarrufla artı, beklenmedik cariyle eksi verir. Dönem sonunda fark oluşur
ve muhasebede bir yere düşmek zorundadır (ADR-0015 açık konusu).

**★ Fiş granülerliği:**
Toplu tahakkuk **tek yevmiye fişi** üretir; daire kırılımı yardımcı
defterde (`borc` / `borc_sorumlusu`) durur. 5.000 bölümde 5.000 fiş değil.
`FisTuru.TAHAKKUK` ayrı tür olarak tanımlıdır.

**★ Gider türü ↔ hesap eşleşmesi:**
`GiderTuru.muhasebeHesapId` alanı ile veri olarak tutulur; kod ile
türetilmez. Standart zorunlu bir eşleşme yoktur, her yönetim kendi
planını kurar. Eksikse **açık hata** verir, sessiz kalmaz.

**★ Hesap seçimi kod ile değil, ÖZELLİK ile:**
`CARI_KONTROL`, `KASA`, `BANKA`, `YANSITMA` özellikleri. `120` her
tenant'ta alıcılar hesabı olmayabilir.

---

## 6. RAPORLAR

```text
Raporlar
├── Analizler ›
│   ├── Site Ödeme Skoru
│   └── Kişi Ödeme Skoru
├── Listeler ›
│   ├── Borç Makbuzları · Birleşik Borç Makbuzu · Birleşik Tahsilat Makbuzu
│   ├── Borç Kapama Listesi · Cari Hesap Listesi · Demirbaş Envanteri
│   ├── Detaylı Borç Listesi · Dönemsel Bakiye Listesi
│   ├── Fatura Dağılım Raporu · Kategori Detaylı Bakiye Listesi
│   ├── Tahsilat Makbuzları · Tarih Aralıklı Detaylı Borç Listesi
│   ├── Vadesi Geçmiş Borçlar Listesi
│   └── Site Sakinleri Yaşlandırma · Cari Yaşlandırma
├── Ekstreler ›
│   ├── Cari Hesap Ekstresi · Kasa Ekstresi · Online Banka Hareketleri
│   └── Personel Ekstresi · Site Sakinleri Hesap Ekstresi · Genel Hesap Ekstresi
├── Dökümler ›
│   ├── Nakit Akış Raporu · Finans & Muhasebe Mali Durum
│   ├── Borçsuzluk Belgesi · Borç/Tahsilat Makbuzları Toplu Döküm
│   ├── Avukat Çıktı Formu · Bordro Dökümü · Cari Ödeme Talimatı
│   ├── Çek ve Senet Hareketleri · Denetim Raporu · Denetim Tablosu
│   ├── Gelir-Gider Raporu · İhtar Yazısı · İşletme Defteri
│   ├── İşletme Projesi Dağılım / Planlanan-Gerçekleşen / Raporu
│   └── Özet Gelir-Gider Tablosu · Gizlenmiş Evraklar
├── Grafikler
├── İletişim ›
│   ├── Adres Etiket Dökümü · Anket Raporu · Banka Ödeme Kodları
│   ├── Daire Araç Bilgileri · Daire Bilgi Formları · Daire Giriş-Çıkış
│   ├── Daire İletişim Bilgileri · Hazirun Listesi · Not Listesi
│   ├── Personel Bilgi Formu · Site İstatistikleri
│   └── Site Sakinleri Listesi · Yapılacak İşler Raporu
└── Rapor Merkezi
```

### BNOS'a özgü ekler — Raporlar

**★ Üç yönlü mutabakat raporu:**
Banka bakiyesi = defter bakiyesi = daire bazlı alt hesapların toplamı.
Üçü tutmadan ay kapanmaz. Rakipte iki yönlü mutabakat var; üçüncü ayak
(alt defter toplamı) BNOS ayrışma noktasıdır.

**★ Kapsam kısıtı raporlara da uygulanır:**
Sakin yalnızca kendi bağımsız bölümüne ait rapor alabilir. Malike
**topluklaştırılmış** mali tablo açılır (KMK denetim hakkı); kişi bazlı
borç detayı yalnızca DENETCI ve yönetim organlarına.

**★ Rapor üretimi senkron değildir:**
Büyük raporlar kuyruğa alınır, hazır olunca bildirilir. 5.000 bölümlü
projede senkron rapor üretimi proxy zaman aşımına takılır.

---

## 7. GÜVENLİK

```text
Güvenlik
├── Geçiş Kontrol Sistemi ›
├── Gönderi Takibi ›
├── Olaylar
└── Kayıp Eşya
```

**★ Ziyaretçi Giriş Çıkış — misafir ayrı modül DEĞİL:**
Tek ekran, tür seçimi ile: `MİSAFİR · SİPARİŞ · KURYE · SERVİS · DİĞER`.
Kolonlar: Giriş · Çıkış · Ziyaretçi adı · İlgili kişi · İlgili daire ·
Açıklama · Yasaklı Kişi · Onay Durumu · Durum.

**★ Ölçek uyarısı:** Rakipte 275.889 kayıt. Bu, sitede en çok veri üreten
ekrandır ve BNOS'ta hiç ölçülmemiş bir yük profilidir.

**★ Onay akışı:** Ziyaretçi girişi daire sakininin onayından geçer;
sakin portalına bildirim düşer.

**★ Yasaklı kişi listesi:** Girişte uyarı verir.

**★ KVKK:** Ziyaretçi kaydı kişisel veridir. Saklama süresi tanımlı ve
otomatik silme işi zorunludur. Biyometrik geçiş özel nitelikli veridir —
varsayılan KAPALI, açılması ayrı rıza akışı gerektirir.

---

## 8. TEKNİK

```text
Teknik
├── İş Takibi ›
│   ├── İş Takip Kayıtları · İş Takip Panosu
│   ├── Görev Dağılımları: Departmana Göre · Personele Göre
│   ├── Tanımlar: Departmanlar · Ortak Alanlar · Talep Tipleri · Parametreler
│   └── Raporlar: İş Takibi Durum Raporu
├── Asansör
└── Havuz Değerleri
```

### ★ BNOS'un rakipten ileride olduğu alan

Rakipte iş takibi var ama **saha doğrulaması yok.** BNOS planı (Blok G):

**Konum ağacı:** Proje → Blok → Kat → Alan → Bölüm → Birim.
Kendine referanslı, derinliği serbest, materialized path ile hızlı alt ağaç
sorgusu. Her konumun `giderKapsami` alanı gider dağıtımına bağlanır.
Rakipte "Ortak Alanlar" düz bir tanım listesidir.

**Fotoğraflı iş doğrulama:** İşe başla → fotoğraf, işi bitir → fotoğraf.

- Fotoğraf **konumun** fotoğrafıdır, personelin değil
- Yüz tanıma YOK (biyometrik veri rejimine girer)
- EXIF temizlenir, içerik hash'i alınır (aynı fotoğrafın tekrarı = alarm)
- Saklama süresi tanımlı (öneri 90 gün)

**Konum doğrulama:** NFC/QR fiziksel etiket birincil kanıttır.
GPS yalnızca destekleyici — tek başına görev kapatmaz (sahtelemesi kolay).
NFC okuması aktif kapsamı otomatik belirler; personel menüden site seçmez.

**Mola ve çalışma süresi:** Kayıtlar değiştirilemez; düzeltme ters kayıtla.
Bu veri iş uyuşmazlığında delildir. Personel kendi kaydını görebilir.
Faz 1'de bordro hesaplanmaz, süre kaydı dışa aktarılır.

**Çevrimdışı çalışma zorunlu:** Bodrum, otopark, sığınak, teknik odada
sinyal yoktur. Yerel kuyruk + idempotency key ile senkron.

**Personel yetkilendirme iki eksende:** konum × görev tipi.
Üst düğüm yetkisi alt ağacı kapsar. Bahçıvan asansör bakım görevini
kapatamaz.

**Yapılmayacak:** Otomatik personel puanlama/sıralama. Ölçüm ile disiplin
farklı şeylerdir; otomatik skora dayalı disiplin kararı iş hukuku
açısından savunulamaz.

---

## 9. TANIMLAR

```text
Tanımlar
├── Yapı: Adalar · Bloklar · Daire Grupları · Daire Tipleri · Tesisler
├── Hesap: Cariler · Genel Hesaplar · Kasa ve Banka Tanımı · Sözleşmeler ›
├── Gider/Gelir: Gider Grupları · Gider Tanımları · Gelir Grupları ·
│                Gelir Tanımları · Evrak Kategorileri
└── Yetki: Yetkililer · Yetki Grupları
```

**★ BNOS farkı — terminoloji (BFS v1 §13.1, bağlayıcı):**
`Blok` = yalnızca site içindeki yapı birimi
`Apartman` = tek parselli, tek yapı yönetimi
`Site` = toplu yapı
"Blok yönetimi" terimi KULLANILMAZ — site bloğuyla karışır.

**★ Daire Grupları / Daire Tipleri:**
Rakipten alındı, BNOS'ta yoktu. Dağıtım yöntemi olarak kullanılır
(2+1, 1+1 gibi).

**★ Yetki — BNOS'ta kapsam kısıtı:**
Rakipte "Yetkililer / Yetki Grupları". BNOS'ta bu **veritabanı seviyesinde**
uygulanır (ADR-0002): PostgreSQL RLS, `NOBYPASSRLS` rolü, iki eksenli
politika (tenant + kapsam). Uygulama katmanındaki `where` koşuluna
bırakılmaz.

Kapsam tipleri: `FIRMA · PROJE · KONUM · BAGIMSIZ_BOLUM`
Yetki **sürelidir**: silinmez, `bitis` doldurulur. "O tarihte kimin neye
erişimi vardı" sorusu cevaplanabilir.

**★ Gider Tanımları — BNOS ekleri:**

- `tahakkukSikligi`: `DONEMSEL | OLAY_BAZLI` (mükerrer koruması buna bağlı)
- `paylasimKurali`: varsayılan dağıtım yöntemi
- `muhasebeHesapId`: hesap eşleşmesi
- `sorumlulukTipi`: KMK m.20/22 ayrımı (malik mi kiracı mı)

---

## 10. İLETİŞİM

```text
İletişim
├── E-Posta › (Bildirim · Şablonları · Durum Raporu · Geçmişi)
├── Sms ›
├── Mobil Bildirim ›
├── Whatsapp ›
├── Posta › (Gönderi Dökümü · Listesi · Şablonları · Raporu)
├── E-Bildiri ›
├── Otomatik Bildirimler
├── Bekleyen Bildirimler
├── Tanıtım Görseli ›
└── Telefon Rehberi
```

**Otomatik bildirim örnekleri (rakipten):**
Doğum günü · Yıldönümü · Kişiye tahsilat (anında) · Aylık bakiye (ayın 1'i)
· Son ödeme günü · Son ödeme gününe 5 kala

**★ BNOS eki — akıllı hatırlatma sırası:**
Önce sessiz deneme (DBS/otomatik ödeme), sonra hatırlatma. Kalıcı ve geçici
başarısızlık ayrılır: "bakiye yetersiz" → maaş gününe yakın tekrar dene,
sakine bir şey söyleme; "talimat iptal" → tekrar deneme anlamsız, insana geç.

**★ BNOS eki — tebligat delil kaydı:**
Bildirim yalnızca gönderilmez, **delili tutulur**: kim, ne zaman, hangi
belgenin hangi versiyonunu, hangi kanaldan aldı. KMK m.37 itiraz penceresi
takip edilir, kesinleşme anı damgalanır.
Kanal seçiminde KEP değerlendirilir (delilleri senet hükmünde, 20 yıl
saklama) — KMK m.37'ye tam karşılık gelip gelmediği hukuk sorusudur.

**★ KVKK:** Ticari ileti / bilgilendirme ayrımı ve İYS yükümlülüğü
değerlendirilir. Kişi bazlı kanal izni ve opt-out kaydı tutulur.

---

## 11. WEB SİTESİ

```text
Web Sitesi
├── Web Sitesini Aç · Fotoğraf Galerisi · Duyurular · Anket
├── Ana Sayfa Ayarları · Siteye Özel Sayfalar · Site Sabit Sayfalar
└── Kullanıcı İstatistikleri · Erişim Hakları · Site Teması
```

Sakinlerin gördüğü menü: Anketler · Rezervasyon · Raporlar · İletişim ·
Kira · Size Özel · Sosyal medya bağlantıları

---

## 12. SİGORTA

Poliçe takibi, yenileme hatırlatma, hasar kaydı.

**★ BNOS notu:** Sigorta primi `OLAY_BAZLI` gider türüdür (ADR-0014).
Poliçe takvim ayına oturmaz; aynı ay ikinci poliçe meşrudur.
Referans = poliçe no.

---

## 13. ★ BNOS AI — rakipten farklı konumlanma

Rakibin AI özellikleri **girdi kolaylaştırıcıdır**: fatura fotoğrafla,
mail metni yaz, doğal dille rapor sorgula, telefon karşıla.
Değerli ama hiçbiri karar üretmez.

BNOS AI **karar vericidir** — beş kademeli zorunlu hat:

```text
Kurumsal hafıza → Bilgi grafiği → İş kuralları → Ajan muhakemesi → Dil modeli
```

"Bu dairenin aidatı ne kadar?" sorusu tahminle değil, sırayla cevaplanır:
önceki dönem kayıtları → daire/blok/proje ilişkisi → yönetim planı md. 12
(arsa payı esası) → blok + site gideri payı → sonuç + **dayanak**.

Cevabın yanında hangi maddeye, hangi karara, hangi kayda dayandığı gelir.
Denetlenebilir olmayan cevap üretilmez.

**Rakipten alınması gerekenler (girdi tarafı — BNOS'ta yok):**

- Fatura fotoğrafından gider kaydı oluşturma
- Mail / WhatsApp içeriği üretme
- Doğal dille rapor sorgulama

Bu ikisi çelişmez; farklı katmanlardır.

---

## 14. SAKİN PORTALI (Portal 3)

Rakip referansı: Yönetimcell sakin portalı.

```text
Site Sakini
├── Hesap Durumu
│   └── Sekmeler: Özet · Genel Durum · Hesap Hareketleri · Ödeme Yap
├── Talep İstek Formu    (mesajlaşma + dosya eki)
└── Bilgilerim
Yönetim
├── Duyurular
└── Yönetim Bilgileri
```

Üst şeritte kimlik: `Ad Soyad (Malik/Kiracı) · Blok · Daire`

**Özet:** Borç Durumu · Alacak Durumu · Bakiye + son hareketler
**Genel Durum:** kalem bazlı borç (Aidat · Yakıt · Elektrik · Ek Gider...)
**Hesap Hareketleri:** Tarih · Açıklama · Makbuz No · Tutar · Bakiye
(her satırda yazdırma)

### BNOS kısıtları — Sakin portalı

**★ Sakin başka bağımsız bölümün borcunu, kişi bilgisini GÖREMEZ.**
İstisna yok. RLS ile veritabanı seviyesinde uygulanır.

**★ Malike topluklaştırılmış mali tablo açılır** (KMK denetim hakkı);
kişi bazlı borç detayı yalnızca DENETCI ve yönetim organlarına.

**★ Sakin kendi KVKK haklarını portalden kullanabilir:** verilerini görme,
düzeltme talebi, iletişim izni aç/kapa, veri indirme.

**★ Virman görünürlüğü:** Sakin kendi dairesine gelen/giden aktarımı
hesap özetinde görür (şeffaflık).

---

## 15. YÖNETİM ŞİRKETİ PORTALI (Portal 1)

```text
(üst blok)
├── Dashboard · Site Detayları · Site Listesi · Yeni Site
├── Devam Eden · Tamamlanan · Arşivlenen
YAPI YÖNETİMİ
├── Bloklar · Katlar · Bağımsız Bölümler · Otopark · Ortak Alanlar · Sosyal Tesisler
GÜVENLİK & TEKNİK
└── Kamera · Giriş-Çıkış · Yangın · Asansör · Jeneratör
```

**KPI kartları:** Toplam Site · Toplam Blok · Toplam Daire · Doluluk Oranı ·
Toplam Sakin · Açık İş Emirleri · Gecikmiş Aidatlar · Teknik Uyarılar

### BNOS kararları — Yönetim şirketi

**★ Şablon kütüphanesi sahipliği:**
Firma seviyesinde görev/gider şablonları tutulur ve projelere kopyalanır.
Kütüphane FİRMAYA aittir (birikimi); projeye kopyalanan örnek ve üretilen
kayıt geçmişi PROJEYE aittir. Sözleşme bitince kütüphane firmada kalır,
proje verisi projede.

**★ Çok projeli tahsis YASAK:**
Tenant izolasyonu tek sorguda iki tenant'a izin vermez. Her proje ayrı
bütçedir; bir tahsilat farklı projelerin borçlarına dağıtılamaz.

**★ Personel çok projeli olabilir:**
Firma bahçıvanı beş sitede çalışabilir. Proje bağı `Personel` tablosunda
değil, yetki kayıtlarında tutulur.

---

## 16. ORTAK ARAYÜZ DESENLERİ

Rakipte her liste ekranı aynı iskeleti kullanıyor. BNOS'ta tek bileşen
yazılır, tüm listeler onu kullanır.

```text
Başlık + [+] (yeni kayıt)
─────────────────────────────────
[Hepsi] [+]                    ← kayıtlı görünüm sekmeleri
[Tümü][#][A][B][C]...[Z]       ← alfabetik filtre
─────────────────────────────────
☐ | Kolon1 ▽↓ | Kolon2 ▽↓ | ...
─────────────────────────────────
[Sil] [Toplu Güncelle] [Gruba Ekle]   « ‹ 1/N › »
```

Her kolonda süzgeç + sıralama. Sağ üstte gelişmiş filtre.

**Form deseni (virman/fiş ekranları):**

```text
Üst alanlar (Tarih · Belge Tarihi · Belge No)
Satır tablosu (+ Yeni Satır Ekle)
Denge göstergesi: Borç toplamı = Alacak toplamı, Bakiye Farkı
Açıklama (çok satırlı, ZORUNLU)
[Kaydet] [Kapat]
```

**★ BNOS eki — denge göstergesi kaydetmeden önce görünür.**
Kullanıcı farkı kaydetmeye çalışırken değil, yazarken görmeli.

---

## 17. UYGULANMASI GEREKENLER — BNOS'ta olmayanlar

Bu harita hedefi tanımlar. Bugün BNOS'ta eksik olanlar:

**Finans:** Açılış fişleri (tümü) · İcra takibi · Çek-senet · İşletme
projesi · Tekrarlanan evraklar · Excel yükleme · Otomatik borçlandırma ·
İade makbuzu · Devir bakiye girişi · Gider/gelir faturası

**Muhasebe:** Büyük defter · Standart muavin · Ayrıntılı bilanço · Gelir
tablosu · Gelir-gider muavini · Dönem sonu kapanış

**Raporlar:** Neredeyse tamamı (60'a yakın rapor) · Yaşlandırma raporları ·
İhtar yazısı · Avukat çıktı formu · Borçsuzluk belgesi · Hazirun listesi ·
Denetim raporu

**Site:** Onay bekleyen kişiler · Rezervasyon · Stok · Eğitim formları ·
Ajanda · Denetim · Toplantılar · Teklifler

**Sayaç:** Modül tamamı

**Güvenlik:** Modül tamamı (ziyaretçi ekranı dahil)

**Teknik:** Modül tamamı (Blok G planı)

**İletişim:** Otomatik/zamanlanmış bildirim · WhatsApp · Posta takibi ·
Şablon yönetimi

**Web Sitesi · Sigorta:** Modül tamamı

**AI:** Girdi tarafı özellikler (fatura okuma, içerik üretme, doğal dil
sorgu)

---

## 18. KAYNAKLAR

- Rakip ekran analizleri (ürün sahibi tarafından paylaşıldı)
- Yönetimcell sakin portalı (Portal 3 referansı)
- V16 prototipi — sekme deseni, menü gruplaması, firma dashboard
- Natal Apartmanı gelir-gider dökümü (apartman formatı referansı)
- BNOS ADR'leri: 0002 (RLS) · 0008 (kiracılık ekseni) · 0010 (cari birimi)
  · 0014 (mükerrer koruması) · 0015 (dönem kapanışı, açık) · 0016 (virman)
  · 0017 (tahakkuk muhasebeleştirmesi)
- docs/APARTMAN-SITE-AYRIMI.md
- BFS v1 §13.1 (terminoloji)
