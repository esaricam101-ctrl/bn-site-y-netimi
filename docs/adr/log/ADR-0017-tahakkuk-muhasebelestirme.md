# ADR-0017 · Tahakkukun muhasebeleştirilmesi

**Tarih:** 2 Ağustos 2026
**Statü:** 🟡 TASLAK — **KARAR YOK**
**Öneren:** —
**Onaylayan:** —
**İlgili:** [ADR-0003](0003-muhasebe-cift-tarafli.md) (çift taraflı kayıt) ·
[ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) (cari = bağımsız bölüm) ·
[ADR-0014](0014-mukerrer-tahakkuk-korumasi.md) (mükerrer koruması) ·
[ADR-0016](ADR-0016-virman.md) (virman — bu karardan SONRA)

> ⚠️ Bu dosya bilinçli olarak **eksiktir**. Yalnızca **ölçülmüş mevcut durum**
> ve **cevaplanacak sorular** vardır; tercih yazılmaz.

---

## 0 · Neden bu ADR açıldı

**Tahakkuk deftere hiç düşmüyor.** Ölçüldü:

```text
borc tablosu             : 36 satır  (Güzel Apartmanı, 3 dönem)
yevmiye_fisi             :  0 satır
GET /makbuzlar/rapor/kontrol-mutabakati
  {"yardimciDefterToplami":"23400.0000","kontrolHesabiKodu":"120",
   "kontrolHesabiBakiyesi":"0.0000","fark":"23400.0000","mutabikMi":false}
```

`mutabikMi:false` bir **veri sorunu değildir**. Yapısal:

- `Borc` modelinde `yevmiyeFisiId` **yok** — `Tahsilat` (schema:2530) ve
  `BankaHareketi` (schema:2258) alanı taşır, `Borc` (schema:1129-1164)
  taşımaz.
- Tahakkuk modülünde `muhasebelestir` ucu **yok**
  (`tahakkuk.controller.ts` → `calistir` · `borclar` · `donemler`).

Sonuç: 120 kontrol hesabı **hiçbir projede** borçlanamaz. Mutabakat raporu her
kurulumda `false` döner. ADR-0003'teki çift taraflı kayıt kararı, kayıt
sisteminin **ana işlem türü** için uygulanmamış durumdadır.

⚠️ Bu ADR virmandan (ADR-0016) ÖNCE karara bağlanmalıdır: virman deftere fiş
yazacak; zaten mutabık olmayan bir deftere yeni fiş eklemek, sonra ikisini
birlikte düzeltmek demektir.

---

## 1 · Mevcut desen — tahsilat nasıl muhasebeleşiyor

`tahsilat.command.service.ts:358-436`. **Mekanizma olarak tekrar edilebilir:**

| Adım | Nasıl |
|---|---|
| Borç tarafı | `borcTarafiHesabi()` · NAKİT → `varsayilanKasaHesapId`; BANKA/POS → hareketin banka hesabı, yoksa `varsayilanBankaHesapId` |
| Alacak tarafı | `cariKontrolHesabi()` · `ozellik = CARI_KONTROL` |
| Fiş | `fis.ekleIslemde(tx, {...}, principal, baglam)` · `fisTuru:'TAHSILAT'` · `kaynakTipi:'TAHSILAT'` · `kaynakId` |
| Mükerrer | `yevmiyeFisiId !== null` → `IsKuraliIhlali`; düzeltme **storno** ile |
| İptal | `durum === 'IPTAL'` → reddedilir |
| Tanımsızlık | ÇEK · SENET · MAHSUP için hesap yok → **açıkça reddedilir**, tahmin edilmez |

Son satır bu ADR için önemli: ürün, karşılığı tanımsız olduğunda **rastgele
hesap seçmiyor, duruyor.** Tahakkuk tarafında da aynı disiplin beklenir.

---

## 2 · Neden mevcut desenin tekrarı DEĞİL — üç yeni karar

### S1 · Gider türü ile muhasebe hesabı arasında bağ YOK

`GiderTuru` (schema:726-777) hiçbir hesap alanı taşımıyor. Emsal tam tersini
yapıyor:

```prisma
/// Muhasebe karşılığı — ZORUNLU (üstteki not).
muhasebeHesapId String @map("muhasebe_hesap_id") @db.Uuid   // BankaHesabi:2114
```

Yani ürün "işletme varlığı → muhasebe hesabı" bağını **başka yerde zorunlu
kılmış**, gider türünde hiç kurmamış.

Tahsilatta karşı hesap **tek ve sabit** olduğu için soru çıkmıyordu. Tahakkukta
çıkıyor: aidat geliri ile su geliri aynı satırda toplanırsa gelir tablosu
"aidat 23.400" der ve neyin ne kadar olduğu kaybolur.

**Cevaplanacak:**

- (a) `GiderTuru.gelirHesapId` — tür başına hesap. `BankaHesabi` emsaliyle
  birebir. Zorunlu mu, boş bırakılabilir mi?
- (b) `MuhasebeParametresi.varsayilanAidatGelirHesapId` — tek hesap, bütün
  türler oraya. Basit; gelir kırılımı yok.
- (c) İkisi birden: türde varsa o, yoksa varsayılan.
- ⛔ Hesap **kodundan** türetme (`600` varsay) — §33 kural 3 gereği yasak;
  CT-20/§H.4'te aynı gerekçeyle bir migration bu yüzden yazılmadı.

★ Boş bırakılabilir seçilirse ikinci soru doğar: karşılığı olmayan bir gider
türü tahakkuk ederse **muhasebeleşme reddedilir mi, atlanır mı?** Atlanırsa
sessiz boşluk üretilir — bugün kapatılan sınıfın aynısı.

### S2 · Alacak tarafı GELİR mi?

Tohumun hesap planında `600 Aidat Gelirleri` var, yani ürün bugün **gelir
sayıyor**. Ama KMK'da yönetim kâr amacı gütmez; ortak gider tahakkuku bir
**avans/fon** olarak da tutulabilir (`340 Alınan Avanslar` planda mevcut).

Bu **muhasebe politikası kararıdır**, teknik değil. Yanlış seçim gelir
tablosunu ve dönem kâr/zararını baştan yanlış kurar.

**Cevaplanacak:** tahakkuk `120 borç / 6xx gelir` mi, `120 borç / 34x avans`
mı? (C-4 hukuki görüş listesine bağlanabilir.)

### S3 · Fiş granülerliği — çalışma başına mı, borç başına mı?

Bir tahakkuk çalışması 12 bölümde 12 borç üretiyor; ölçülmüş perf fikstüründe
**5.000**. İki uç:

| | Fiş sayısı (5.000 bölüm) | Sonuç |
|---|---|---|
| Çalışma başına TEK fiş | 1 | Yevmiye okunabilir; bölüm kırılımı yardımcı defterde kalır — ADR-0010'un kontrol hesabı mantığıyla uyumlu |
| Borç başına fiş | 5.000 | Yevmiye defteri tek tahakkukta 5.000 satır; kontrol hesabı yine aynı toplam |

★ Ara seçenek: tek fiş, ama **gider türü başına satır** (gelir kırılımı fişin
içinde durur). S1(a) seçilirse bu doğal düşer.

**Cevaplanacak:** hangisi? Ve fiş tarihi `tahakkukDonemi` mi `vadeTarihi` mi?
(Vade seçilirse gider ile gelir farklı döneme düşebilir.)

---

## 3 · Şema etkisi (karar sonrası)

| Değişiklik | Neden |
|---|---|
| `Borc.yevmiyeFisiId String?` | Muhasebeleşti mi — mükerrer koruması buradan okunur (`Tahsilat` ile birebir) |
| `FisTuru` enum'una `TAHAKKUK` | Bugün yok. `fisTuru` dönem kapanışı ve raporların dayanağı; `MAHSUP`'a sıkıştırılırsa tahakkuk fişi raporda ayırt edilemez |
| S1'e göre `GiderTuru.gelirHesapId` **veya** `MuhasebeParametresi.*` | Karşı hesap |

⚠️ `kaynakTipi` serbest metindir (`VarChar(40)`, schema:985) — enum değişikliği
gerekmez.

---

## 4 · Mevcut borçlar ne olacak — ÖNERİ, karar sizde

36 borç (demo) ve gerçek kurulumlarda var olan borçlar bugün fişsiz.

**Öneri: geriye dönük OTOMATİK muhasebeleştirme YAPILMASIN.**

Gerekçe — CT-20/§H.4'teki ile aynı sınıf:

- Fişin **tarihi** bir karardır. Geçmiş tahakkuku bugünün tarihiyle yazmak
  dönem hareketini bozar; kendi tarihiyle yazmak **kapalı döneme fiş yazmak**
  olur ve ADR-0003'ün en temel yasağını çiğner.
- Karşı hesap S1/S2 kararına bağlıdır; migration bunu **varsayarsa** yanlış
  hesaba toplu kayıt üretir ve düzeltmesi 5.000 storno demektir.
- Sessiz bozulma, işaretsiz kalmaktan kötüdür.

**Bunun yerine:** açık dönemdeki fişsiz borçları listeleyen bir uç/ekran +
yöneticinin **görerek** çalıştırdığı toplu muhasebeleştirme. Kapalı dönemdeki
fişsiz borçlar için hiçbir şey yapılmaz; rapor onları ayrıca gösterir.

★ Tohum bu karardan bağımsızdır: `db:reset` ile yeniden kurulduğu için geriye
dönük soru doğurmaz.

---

## 5 · Dış hukuk/muhasebe araştırması — 2 Ağustos 2026

Ürün sahibi tarafından bir araştırma raporu sağlandı. Aşağısı **raporun
söylediğidir**; hangi soruyu kapattığı ve hangisini kapatmadığı ayrı ayrı
işaretlenmiştir.

### 5.1 · Çerçeve — bu ADR'nin zeminini değiştiriyor

> Apartman/site yönetimlerinin **tüzel kişiliği ve gelir/kurumlar vergisi
> mükellefiyeti yoktur.** Kanunen zorunlu tek defter KMK md. 32 karar defteri
> (noter tasdikli); md. 41 denetim defteri. **Çift taraflı bilanço esaslı
> muhasebe kanunen zorunlu değildir**; işletme hesabı esası yeterlidir.

★ Bu, ADR-0003'ün (çift taraflı muhasebe) **yanlış olduğu anlamına gelmez** —
ürünün tercihi olduğu anlamına gelir. Sonucu şudur: *"mevzuat böyle emrediyor"*
diye savunulan hiçbir kısıt bu alanda **kanuni zorunluluk olarak yazılamaz.**
Kısıtlar ürün kararı olarak gerekçelendirilmelidir.

### 5.2 · S2 (gelir mi avans mı) — KAPANMADI, ama ağırlık avanstan yana

Rapor: KMK md. 20 aidatı *"toplanacak avans"* olarak adlandırır; yönetim kâr
amacı gütmez; TDHP karşılığı **349 Alınan Diğer Avanslar**'dır. Gelir yaklaşımı
*"aidatın avans niteliğiyle çelişir ve teorik olarak tercih edilmemelidir."*

⛔ **Ama rapor kendi sınırını da söylüyor:** hesap-kodu düzeyinde bağlayıcı
mevzuat, TÜRMOB tebliği veya yerleşik içtihat **bulunamamıştır**; literatür
boşluğu vardır ve **kesin tercih için SMMM görüşü gerekir.**

Bu yüzden burada karar YAZILMIYOR. Karara bağlanacak olan:

- (i) 349 (avans) — KMK md. 20 lafzıyla tutarlı, raporun önerdiği
- (ii) 600/602 (gelir) — bugünkü hesap planının varsaydığı
- (iii) **Tenant ayarı** — hangisinin kullanılacağı `MuhasebeParametresi`'nden
  okunur. §33 kural 3 ile en tutarlı olan budur: politika koda gömülmez.

★ (iii) seçilirse S1 ve S2 tek mekanizmada birleşir ve iki farklı muhasebe
görüşü aynı üründe barınır. Maliyeti: yıl sonu davranışı ikiye ayrılır — avans
bakiyesinin **ne olacağı** ile gelir bakiyesinin **ne olacağı** aynı şey
değildir.

> ⚠️ **YANLIŞ ÇIKARIM UYARISI — "kâr/zarar yapısal olarak sıfırdır" DEĞİLDİR.**
>
> Aidat **tahmini bütçeye** göre belirlenir. Gerçek giderler tahmini tutmaz:
> tasarrufla artı, beklenmedik masrafla eksi verir. Dönem sonunda **toplanan
> avans ile harcanan gider EŞİT DEĞİLDİR ve eşit olması beklenemez.**
>
> Bu fark kâr/zarar değildir — yönetim kâr amacı gütmez — **ama muhasebede bir
> yere düşmek ZORUNDADIR.** Avans yaklaşımı bu farkı ortadan kaldırmaz, yalnızca
> nereye düşeceğini değiştirir.
>
> Farkın nereye düşeceği **bu ADR'nin değil, ADR-0015'in konusudur** ve orada
> açık soru olarak durur.

ADR-0015'in (yıl sonu kapanışı) açık soruları bu seçime bağlanır.

### 5.3 · S3 (fiş granülerliği) — RAPOR CEVAPLIYOR

> *"TDHP mantığı uygulandığında toplu tahakkuk yevmiyede **tek satır (toplam)**
> olarak, daire kırılımı ise **yardımcı defterde (cari/muavin)** izlenir; toplam
> mizanla cari bakiyeler mutabık tutulur."*

Bu, §2/S3'teki *"çalışma başına TEK fiş"* seçeneğidir ve **ADR-0010 ile birebir
örtüşür** (cari = bağımsız bölüm yardımcı defteri, 120 kontrol hesabı). Ayrıca
5.000 bölümde 5.000 fiş üretme seçeneğini de eler.

★ Kalan alt soru: fiş tarihi `tahakkukDonemi` mi `vadeTarihi` mi. Rapor bunu
konuşmuyor.

### 5.4 · S1 (gider türü ↔ hesap bağı) — rapor yönü destekliyor

> *"Standart zorunlu bir eşleşme yoktur; her yönetim/yazılım kendi gider
> kalemlerini kurar."* Giderler yönetim üretim yapmadığından **770 Genel
> Yönetim Giderleri** altında alt hesaplarda toplanır.

Yani eşleşme **veridir**, kodda sabit değildir — §33 kural 3 ile aynı yön.
Seçenek (a)/(c) (tür başına hesap alanı) bu bulguyla uyumlu; kodu varsayan
türetme elenir. Karar hâlâ verilmedi.

### 5.5 · ★ Raporun BİZİM belgemizi çürüttüğü iki nokta — düzeltildi

**(1) KMK md. 72 yanlış atıf.** ADR-0016 (satır 127 ve 248-249) ve
`SESSION_SUMMARY` §3.E, yenileme fonunun amaca özgülüğünü **KMK md. 72**'ye
bağlıyordu. Rapor:

> *"Dikkat — KMK md. 72 'yenileme fonu'nu değil, **toplu yapılarda ortak
> giderlere katılmayı** düzenler."*

Atıf yanlıştı; düzeltildi. Hukuk sorusunun kendisi (fondan işletmeye aktarım
meşru mu) **geçerliliğini koruyor**, yalnızca dayanağı yanlış gösterilmişti.

**(2) `500 Yenileme Fonu` hesabının tipi.** Tohumun hesap planında `OZKAYNAK`
olarak tanımlı. Rapor:

> *"...niteliği itibarıyla kat maliklerine ait, **iade edilebilir bir
> borç/emanet**tir... özkaynak benzeri bir fon (549 mantığı) yerine
> **alacaklı/emanet karakterli** bir fon hesabında gösterilmesi niteliğe daha
> uygundur."*

Ayrıca rapor bunu VUK md. 328'deki teknik "yenileme fonu" ile karıştırmamayı
ayrıca uyarıyor. ⚠️ Tohumdaki tip **bu ADR karara bağlanana kadar
DEĞİŞTİRİLMEDİ**: hesap tipi bakiye yönünü ve mizanı etkiler, S2 kararıyla
birlikte verilmelidir. Yol haritasına madde olarak yazıldı.

### 5.6 · Bu ADR'nin dışında kalan, ama rapordan çıkan üç iş

| Bulgu | Ürün durumu | Nereye |
|---|---|---|
| **Aidat artış tavanı (YDO)** — 7 Mayıs 2026 düzenlemesi, KMK md. 35/37; yönetici YDO üstü artış yapamaz, genel kurul onayı şart, geçici işletme projesi en fazla 3 ay | `IsletmeProjesi` diye bir model **YOK** (şemada 0 eşleşme); tavan kavramı hiç yok | Yol haritası — yeni özellik |
| **Gecikme tazminatı aylık %5** (5711 ile %10'dan indirildi) | Oran doğru biliniyor (`portfoy.service.ts:484`) ama yalnızca **öneri metni**; hesaplayan motor yok | Yol haritası — açık |
| **Vergisel tetikleyiciler** (dışarıdan yönetim şirketi · ortak alan kira/reklam · sosyal tesis · SMMM/personel stopajı) | Ürün bu eşiklerin hiçbirini tanımıyor | C-4 hukuki görüş listesi |

---

## 6 · ★ TAHAKKUKUN DAYANAĞI — bugün YOK

Bu, ölçülen en ağır boşluktur ve muhasebeleştirmeden önce **kavram olarak**
yerine oturmalıdır (uygulaması ayrı iştir, ayrı ADR).

### 6.1 · Dayanak iki tarafta da var, biçimi farklı

| | Dayanak | Nasıl kurulur |
|---|---|---|
| **SITE** | **İşletme projesi** | Yazılı bütçe, kalem kalem. KMK md. 37: tebliğ → **7 gün itiraz** → kesinleşme |
| **APARTMAN** | **Kat malikleri kurulu kararı** | Tutar doğrudan kararlaştırılır, **karar defterine** yazılır (KMK md. 32) |

★ **KANUN İKİSİNİ EŞDEĞER TUTAR.** Usulüne uygun kesinleşen işletme projesi
**VEYA** kat malikleri kurulunun işletme giderlerine ilişkin kararları,
noterlikçe hazırlanmış **borç senedi kadar güçlüdür** (İİK md. 68 dayanağı).
İcra takibinde ikisi de kullanılabilir.

### 6.2 · Bugünkü durum — zincir dayanaksız

`TahakkukCalistirDto` (`tahakkuk/dto/tahakkuk.dto.ts:50-82`) şunları alıyor:
`giderTuruKodu` · `toplamTutar` · `donem` · `vadeTarihi` · `hedefBlokId` ·
`bolumGirdileri`. **Dayanağa dair hiçbir alan yok.**

Yani bugün: tutar **serbest giriliyor**; hangi bütçeye dayandığı, hangi kararla
onaylandığı, tebliğ edilip edilmediği, kesinleşip kesinleşmediği **hiçbir yerde
kayıtlı değil.**

Sonucu tahakkukla sınırlı değildir — **zincirin tamamı dayanaksız kalır:**

```text
dayanak → tebliğ → 7 gün itiraz → kesinleşme → İİK md. 68 → icra takibi
```

Kesinleşmemiş işletme projesi icra takibinde dayanak olmaz. Ürün bugün bu
zincirin **ilk halkasını** tutmuyor.

`IsletmeProjesi` diye bir model şemada **yok** (0 eşleşme).

### 6.3 · Model önerisi — TEK KAVRAM, İKİ TİP

Öneri: `TahakkukDayanagi`, `tip: ISLETME_PROJESI | KURUL_KARARI`. **Ayrı iki
varlık olmasın.**

**Neden tek kavram — ölçüt "ortak alan ne kadar":**

Ortak olan (her iki tipte de aynı): kimlik · dönem · **karar tarihi ve karar
defteri referansı** · durum · tahakkukla bağ · denetim izi · RLS · tenant.
Ayrışan yalnızca iki şey: tebliğ/kesinleşme alanları (site tarafında zorunlu) ve
bütçe kalemleri ↔ doğrudan tutar.

Belirleyici gerekçe **ortak alan sayısı değil, ORTAK DAVRANIŞ**: tahakkuk her
iki tipe de aynı şekilde bağlanır ve icra zinciri her iki tipi de aynı şekilde
kullanır (İİK md. 68 ikisini eşdeğer tutuyor). İki ayrı varlık olsaydı:

- `TahakkukCalismasi` iki ayrı isteğe bağlı yabancı anahtar taşırdı ve
  "ikisi de dolu" / "ikisi de boş" durumları **veritabanında mümkün** olurdu;
- icra/tebligat tarafı her yerde iki dal yazardı ve biri düzeltildiğinde öteki
  **sessizce eski davranmaya** devam ederdi — ADR-0016'daki `GiderTuruGrubu`
  gerekçesinin aynısı (simetriyi elle sürdürmek);
- tenant tipi değişen bir projede (apartman → site) geçmiş dayanaklar **başka
  bir tabloda** kalırdı.

**Tipe göre zorunluluk farkı, ayrı tablo değil KISIT ile kurulur** —
`GiderTuru.tahakkukSikligi`'nde (0027) uygulanan desenin aynısı:

```text
CHECK (tip <> 'ISLETME_PROJESI' OR teblig_tarihi IS NOT NULL)   -- örnek
CHECK (tip <> 'KURUL_KARARI'    OR sabit_tutar   IS NOT NULL)
```

**Önerilen alanlar** (ürün sahibinin taslağı + üç ekleme):

| Alan | Not |
|---|---|
| `id` · `tenantId` | |
| `tip` | `ISLETME_PROJESI \| KURUL_KARARI` |
| `donem` | Hangi yıl/dönem için |
| `kararTarihi` · `kararNo` | Karar defteri referansı — **her iki tipte de** |
| `tebligTarihi?` · `kesinlesmeTarihi?` | Site tarafında zorunlu (CHECK) |
| `durum` | `TASLAK \| TEBLIG_EDILDI \| KESINLESTI \| ITIRAZ_VAR` |
| `kalemler[]?` | Bütçe kalemleri (site) |
| `sabitTutar?` | Doğrudan tutar (apartman) |
| ★ `gecerlilikBaslangic` · `gecerlilikBitis` | **EKLEME.** Geçici işletme projesi **en fazla 3 ay** geçerlidir (KMK md. 35/37, 7 Mayıs 2026). Süre alanı olmadan bu kural yazılamaz |
| ★ `gecici` (boolean) | **EKLEME.** Yöneticinin tek başına hazırladığı geçici proje ile genel kurulca onaylanmış proje aynı şey değildir |
| ★ `oncekiDayanakId?` | **EKLEME.** İtiraz sonrası düzeltilen proje, öncekinin **yerine geçer**; zincir kaybolmamalı |

⚠️ `durum` alanı ile tarih alanları **aynı bilgiyi iki kez** taşıyor
(`KESINLESTI` ↔ `kesinlesmeTarihi`). Türetilmiş mi, bağımsız mı — kararla
birlikte netleşmeli; ikisi bağımsız yazılabilirse biri güncellenmediğinde durum
**sessizce yanlış** olur.

### 6.4 · Bu ADR'ye etkisi

`TahakkukCalismasi` ileride `dayanakId` taşıyacak ve **KESINLESTI olmayan
dayanağa tahakkuk yasaklanacaktır.** Tahakkuk muhasebeleştirmesi bugün
yazılırken bu bağ **kurulmayacak** ama fişin açıklaması ve `kaynakTipi` bu bağ
geldiğinde kırılmayacak biçimde tasarlanacaktır.

★ `TahakkukDayanagi` **bu turda UYGULANMAZ** — ayrı iş, ayrı ADR.

---

## 7 · Bu ADR karara bağlanmadan yapılmayacaklar

- Virman uygulaması (ADR-0016) — deftere yazan ikinci mekanizma
- `kontrol-mutabakati` raporunun eşiğe bağlanması — bugün her projede `false`
- Tohuma **elle yevmiye fişi yazmak** ⛔ ürünün yapamadığı bir şeyi demoda
  göstermek olurdu; ayrıca yalnızca tahsilatı muhasebeleştirmek 120'yi
  alacaklandırıp farkı **büyütür**
