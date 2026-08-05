# ADR-0017 · Tahakkukun muhasebeleştirilmesi

**Kapsam:** [SITE] — Tahakkukun deftere gecirilmesi CIFT_TARAFLI derinlik gerektirir.
**Tarih:** 2 Ağustos 2026
**Statü:** 🟢 **KARARA BAĞLANDI** (2 Ağustos 2026)
**Öneren:** —
**Onaylayan:** Ürün sahibi
**İlgili:** [ADR-0003](0003-muhasebe-cift-tarafli.md) (çift taraflı kayıt) ·
[ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) (cari = bağımsız bölüm) ·
[ADR-0014](0014-mukerrer-tahakkuk-korumasi.md) (mükerrer koruması) ·
[ADR-0016](ADR-0016-virman.md) (virman — bu karardan SONRA)

> ⚠️ **OKUMA SIRASI:** §0-§6 kararın **gerekçesidir** ve karar anındaki
> bilgiyi olduğu gibi korur — sorular oradan silinmedi. **Kararlar §7'dedir.**
> §2'deki "cevaplanacak" ibareleri o soruların hangi bilgiyle sorulduğunu
> gösterir; cevapları §7'de.

---

> ## ⚠️ KAPSAM: BU ADR YALNIZCA `CIFT_TARAFLI` MUHASEBE İÇİNDİR
>
> Muhasebe derinliği **projenin ayarıdır**, tipinden türetilmez
> (`MuhasebeParametresi.muhasebeDerinligi` — bkz.
> [APARTMAN-SITE-AYRIMI §2.1](../../APARTMAN-SITE-AYRIMI.md)). Varsayılanı
> kurulumda `Tenant.tip`'ten gelir: `SITE → CIFT_TARAFLI`,
> `APARTMAN → BASIT`.
>
> `BASIT` derinlikte hesap planı, yevmiye fişi ve mizan **yoktur** ve bu bir
> eksiklik DEĞİLDİR. Bu yüzden burada karara bağlanan her şey —
> `muhasebelestir` ucu, kontrol mutabakatı, `GiderTuru.muhasebeHesapId` — o
> projelerde **aranmaz**:
>
> - `BASIT` projede `muhasebelestir` → **422 + açıklama** (sessiz sonuç değil)
> - `BASIT` projede `kontrol-mutabakati` → **422** (`mutabikMi: null` değil)
>
> ⚠️ **TAHAKKUK VE ALACAK TAKİBİ İKİ TARAFTA DA VARDIR.** Fark yalnızca
> deftere düşüp düşmemesidir. "Apartman muhasebe yapmaz" denemez — apartman
> **çift taraflı kayıt** yapmaz.

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

#### ★ ÇELİŞKİ KARARI — `durum` TÜRETİLİR, bağımsız yazılamaz

`durum` ile tarih alanları aynı bilgiyi iki kez taşıyordu. **Karar: tarihler
gerçektir, `durum` onlardan HESAPLANIR.**

```text
kesinlesmeTarihi dolu                    → KESINLESTI
tebligTarihi dolu, kesinleşme yok        → TEBLIG_EDILDI
hiçbiri yok                              → TASLAK
```

**Gerekçe:** iki kaynak varsa biri güncellenmez ve **sessizce yalan söyler.**
Bu, aynı turda üç kez kapatılan sınıfın tam olarak kendisidir:

- `borc.odenen` elle yazılıyordu, tahsis satırları boştu → borç ödenmiş
  görünüyordu (SESSION_SUMMARY §I.2)
- hesap `ozellik`i işaretsizdi, defter `200 · []` dönüyordu (§H.1)
- CT-20 test (2) `p?.alan` yüzünden yanlış sebeple yeşildi (§H.6)

⚠️ Uygulama notu: `ITIRAZ_VAR` bu üçlüden türetilemez — itiraz **ayrı bir
olgudur**, tarihten çıkmaz. Ya kendi tarihini taşır (`itirazTarihi`) ve durum
dörtlüden türetilir, ya da itiraz ayrı bir kayıt olur. `TahakkukDayanagi`
uygulanırken çözülecek; bu ADR'nin kapsamı dışında.

### 6.4 · Bu ADR'ye etkisi

`TahakkukCalismasi` ileride `dayanakId` taşıyacak ve **KESINLESTI olmayan
dayanağa tahakkuk yasaklanacaktır.** Tahakkuk muhasebeleştirmesi bugün
yazılırken bu bağ **kurulmayacak** ama fişin açıklaması ve `kaynakTipi` bu bağ
geldiğinde kırılmayacak biçimde tasarlanacaktır.

★ `TahakkukDayanagi` **bu turda UYGULANMAZ** — ayrı iş, ayrı ADR.

---

## 7 · KARARLAR

### K1 · Karşı hesap — `GiderTuru.muhasebeHesapId` (S1 + S2 birlikte)

Gider türü **zorunlu** bir muhasebe hesabı taşır. `BankaHesabi.muhasebeHesapId`
emsalinin birebir aynısı.

★ **Bu tek alan S2'yi de çözer ve ürün 600 ↔ 349 tartışmasında TARAF TUTMAZ.**
Hesabın niteliğini **hesap planı** belirler: tenant `349`u gösterirse avans
yaklaşımı, `600`ü gösterirse gelir yaklaşımı yürür. §33 kural 3: politika koda
gömülmez, veridir. Dış araştırma da bunu destekliyor — *"standart zorunlu bir
eşleşme yoktur; her yönetim kendi gider kalemlerini kurar"* (§5.4).

⚠️ **Alan ZORUNLU.** Boş bırakılabilir olsaydı, karşılığı olmayan bir türün
tahakkuku ya sessizce muhasebeleşmezdi ya da rastgele bir hesaba yazılırdı —
ikisi de bu turda kapatılan sessiz boşluk sınıfı.

⚠️ Ad `gelirHesapId` **değil** `muhasebeHesapId` seçildi: `349` bir gelir hesabı
değildir ve alan adı bir muhasebe görüşünü dayatmamalıdır.

### K2 · Borç tarafı — `CARI_KONTROL`

Tahsilatın alacak tarafı neyse (`cariKontrolHesabi()`), tahakkukun borç tarafı
odur. Fiş: **borç `CARI_KONTROL` / alacak `giderTuru.muhasebeHesapId`**.
Tahsilat bunun tersini yazar; ikisi birlikte cari hesabı açıp kapatır.

### K3 · Granülerlik — çalışma başına TEK fiş

Dış araştırma (§5.3) ve ADR-0010 aynı yeri gösteriyor: yevmiyede toplam, daire
kırılımı yardımcı defterde. 5.000 bölümde **1 fiş**, 5.000 değil.

Fiş tarihi: **`tahakkukDonemi`**. Vade seçilseydi gider ile karşılığı farklı
döneme düşebilirdi.

⚠️ Fişin satır sayısı bölüm sayısına değil, çalışmadaki **gider türü sayısına**
bağlıdır. Bir çalışma tek gider türü işlediğinden bugün daima 2 satır.

### K4 · `500 Yenileme Fonu` → `BORC`

Tip `OZKAYNAK`tan `BORC`a çevrilir. Fon kat maliklerine ait **iade edilebilir
emanettir**, özkaynak değil (§5.5). VUK md. 328'in teknik "yenileme fonu"yla
karıştırılmaz.

### K5 · `FisTuru.TAHAKKUK`

Yeni enum değeri. `MAHSUP`a sıkıştırılsaydı dönem kapanışı ve raporlar tahakkuk
fişini ayırt edemezdi.

### K6 · Geriye dönük muhasebeleştirme YAPILMAZ

Var olan fişsiz borçlar için otomatik toplu kayıt üretilmez (§4'teki gerekçe
aynen geçerli). Muhasebeleştirme **çalışma bazında, elle tetiklenir**.

### ★ K6b · Fiş bağı `TahakkukCalismasi`'ndadır, `Borc`'ta DEĞİL

⚠️ **Bu, uygulama talimatından bilinçli bir SAPMADIR ve gerekçesi ürün
sahibinin az önce `durum` için verdiği kararın aynısıdır.**

Talimat `Borc.yevmiyeFisiId` diyordu. Ama K3 uyarınca **çalışma başına tek fiş**
vardır; bir çalışmanın bütün borçları aynı fişe bağlıdır. `Borc.yevmiyeFisiId`
eklenirse:

- aynı bilgi **iki kaynakta** durur (`borc.calismaId → calisma.yevmiyeFisiId`
  zaten cevabı veriyor);
- 5.000 borçlu bir çalışmada 5.000 satır güncellenir, biri düşerse **borçların
  bir kısmı muhasebeleşmiş görünür**;
- mükerrer koruması hangi alandan okunacağı belirsiz kalır.

> *"İki kaynak varsa biri güncellenmez ve sessizce yalan söyler."*

Bu yüzden alan **`TahakkukCalismasi.yevmiyeFisiId`**'dir. Bir borcun
muhasebeleşip muhasebeleşmediği çalışması üzerinden **türetilir**.

★ İleride bir borç tek başına deftere girerse (virman · yıl sonu farkı) o kayıt
kendi fişini üretir ve **kendi varlığına** bağlanır; `Borc`'a fiş alanı o zaman
da eklenmez.

### K7 · Dağıtım yöntemi — türde varsayılan, tahakkukta ezilebilir

`GiderTuru.paylasimKurali` **varsayılan** kalır.
`TahakkukCalistirDto.paylasimKurali` **isteğe bağlı ezme** olarak eklenir.

**★ HUKUKİ DAYANAK — ezme neden var (KMK md. 20).**
Kanun dağıtım yöntemini emredici saymaz: *"Kat maliklerinden her biri
**aralarında başka türlü anlaşma olmadıkça**…"* Yani **yönetim planı ya da
kat malikleri kurulu kararı** dağıtım yöntemini değiştirebilir; kapıcı gideri
normalde eşit bölünür ama kurul kararıyla bir dönem arsa payına göre
dağıtılabilir.

Koda sabit tek bir kural yazmak bu esnekliği yok ederdi: ürün, kanunun
tanıdığı bir hakkı teknik bir kısıta çevirmiş olurdu. Ezmenin varlık sebebi
budur — kolaylık değil, **mevzuata uygunluk**.

⏳ **İleride:** kullanılan kuralın *dayanağı* (hangi kurul kararı, hangi
yönetim planı maddesi) `TahakkukDayanagi`'na bağlanmalıdır. Bugün ezme
yapılabiliyor ama **niçin** yapıldığı kayıt altına alınmıyor; itiraz hâlinde
"bu dönem neden arsa payına göre dağıtıldı" sorusunun belgesi yok. Şimdi
yapılmadı, `TahakkukDayanagi` işiyle birlikte ele alınacak.

**(a) Kullanılan kural `TahakkukCalismasi`'na YAZILIR — zorunlu alan.**
`kullanilanPaylasimKurali`. Ezme yapılmasa bile yazılır: *"varsayılan
kullanıldı"* ile *"ezildi"* ayrımı `paylasimKuraliEzildi` bayrağıyla görünür.

Gerekçe: geçmiş bir tahakkukun **neden öyle dağıtıldığı** cevaplanabilir
olmalıdır. Gider türü sonradan değişirse eski tahakkuk yine doğru okunur. Bu,
`borcSorumlusu.cozumlemeTarihi`'nin snapshot mantığının aynısıdır.

**(b) Ezme her kurala serbest DEĞİL.** Ölçüt: kural **ek veri** gerektiriyor mu?
Tablo `paylastir.ts:52-102`'den türetildi, varsayılmadı:

| Kural | Ağırlık nereden gelir | Ek veri? | Ezme |
|---|---|---|---|
| `ESIT` | sabit `1n` | — | ✅ serbest |
| `ARSA_PAYI` | `bolum.arsaPayiAgirligi()` | — (bölüm kaydında zorunlu) | ✅ serbest |
| `BRUT_M2` · `METREKARE` | `bolum.metrekareAgirligi()` | — | ✅ serbest |
| `NET_M2` | `bolum.netMetrekareAgirligi()` | — | ✅ serbest |
| `TUKETIM` | `girdi.tuketim` | **bölüm başına ölçüm** | ⛔ veri şart |
| `KULLANIM_BAZLI` | `girdi.kullaniyorMu` | **bölüm başına kullanım** | ⛔ veri şart |
| `SABIT_TUTAR` | `girdi.sabitAgirlik` | **bölüm başına ağırlık** | ⛔ veri şart |
| `MANUEL` | `girdi.manuelTutar` | **bölüm başına tutar** | ⛔ veri şart |
| `BLOK_BAZLI` | `secenekler.hedefBlokId` | hedef blok — **tek alan, DTO'da zaten var** | ✅ serbest |
| `KARMA` | bileşen tanımı | **`karmaBilesenler`** — türe ait, tahakkukta verilemez | ⛔ ezilemez |

★ Serbest olanların ortak yanı: ağırlık **bölüm kaydından okunur**, istekten
gelmez. `arsaPayiPay/Payda`, `brutM2`, `netM2` şemada `NOT NULL`.

⚠️ **`BLOK_BAZLI` satırı 4 Ağustos 2026'da düzeltildi.** Tabloda ⛔ yazıyordu
ama kod onu `EZILEBILIR_KURALLAR` içinde tutuyor ([`tahakkuk.dto.ts:27`]
(../../../backend/src/modules/tahakkuk/dto/tahakkuk.dto.ts)). Kodun gerekçesi
doğru: gerektirdiği veri **bölüm başına değil tek bir alandır** (`hedefBlokId`)
ve o alan DTO'da zaten mevcuttur — ölçüt "ek veri var mı" değil, "ek veri
**bölüm başına** mı" olmalıydı. Belge kodla hizalandı.

**(c) Ezme reddi 422'dir, 400 değil** ve gövde **eksik bölümleri sayar**.
Beyaz liste bilinçli olarak DTO'da değil serviste durur: `IsIn` ile
reddedilseydi cevap yalnızca *"geçersiz değer"* olurdu ve yönetici hangi
dairelerde veri eksik olduğunu tek tek denemeyle öğrenirdi.

**(c) Reddedilen ezme AÇIK HATA verir — hangi bölümlerde eksik olduğunu
sayarak.** Bugün `paylastir.ts` eksik veriyi **ilk bölümde** yakalayıp atıyor;
yönetici hatayı tek tek görüyor. Ezme yolunda **ön kontrol** eklenir ve eksik
bölümler **liste hâlinde** döner:

```text
422 · "TUKETIM dağıtımı için dönem sayaç okuması gerekli."
      sonrakiEylem: "Şu bölümlerde okuma yok: 3, 7, 11 — sayaç okumalarını
                     tamamlayın ya da varsayılan kuralla devam edin."
```

`cariKontrolHesabi()` deseninin aynısı: karşılığı yoksa **tahmin etme, dur ve
çıkış yolunu söyle.**

### K8 · Derinlik kapısı — `BASIT` projede muhasebe uçları 422 verir

`muhasebelestir` ve `kontrol-mutabakati`, `MuhasebeParametresi.muhasebeDerinligi`
`BASIT` ise **422** döner. Gerekçeler
[APARTMAN-SITE-AYRIMI §2.6](../../APARTMAN-SITE-AYRIMI.md)'da.

⚠️ **Derinlik `Principal`'a GÖMÜLMEZ**, uçta okunur. Jetona gömülseydi ayar
değiştiğinde elindeki eski jetonla gelen kullanıcı **yanlış tarafa düşerdi** ve
ayar değişimi jeton iptalini zorunlu kılardı. Okuma noktası zaten tenant başına
tek satır olan `MuhasebeParametresi`'dir; tahsilat yolu onu hâlihazırda okuyor.

### K9 · `TahakkukDayanagi` bu turda UYGULANMAZ

Ayrı iş, ayrı ADR. `TahakkukCalismasi`'na ileride `dayanakId` geleceği **yorum
olarak** yazılır; şema alanı açılmaz.

---

## 8 · Kararın kanıtı — bitişin tek ölçütü

Bu ADR, `GET /makbuzlar/rapor/kontrol-mutabakati` **`mutabikMi: true`** dönene
kadar uygulanmış sayılmaz. Ham çıktı `SESSION_SUMMARY`'ye yazılır.

⚠️ Karar öncesi engellenenlerden ikisi **hâlâ geçerlidir**:

- Tohuma elle yevmiye fişi yazmak ⛔ — tohum artık gerçek yoldan
  muhasebeleştirir, elle fiş yazmaz
- `kontrol-mutabakati` raporunun bir eşiğe bağlanması — mutabakat yeşile
  döndükten sonra ayrıca değerlendirilir
