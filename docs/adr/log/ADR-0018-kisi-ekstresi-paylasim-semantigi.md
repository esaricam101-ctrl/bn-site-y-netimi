# ADR-0018 · Kişi ekstresi paylaşım semantiği

**Kapsam:** [ORTAK] — Cari ekstre her iki proje tipinde de çalışır.
**Tarih:** 6 Ağustos 2026
**Statü:** 🟠 **TASLAK — ONAY BEKLİYOR** (kod yazılmadı)
**Öneren:** —
**Onaylayan:** —
**İlgili:** [ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) (cari =
bağımsız bölüm) · [Çelişki Kaydı](../../CELISKI-KAYDI.md)

---

## 0 · Neden bu ADR açıldı

Kişi ekstresi hisseli mülkiyette **matematiksel olarak yanlış**. Ölçüldü
(canlı · Papatya Sitesi · kapı 7 · iki malik):

| | Borç | Tahsilat | Kapanış |
|---|---|---|---|
| **Bölüm** ekstresi | 6.485,00 | 4.066,00 | **2.419,00** |
| Malik A | 6.485,00 | 2.033,00 | **4.452,00** |
| Malik B | 6.485,00 | 2.033,00 | **4.452,00** |

İki kişinin kapanışı toplamı **8.904,00**, bölümünki 2.419,00.

**Kök sebep — asimetrik süzgeç** (`makbuz.query.service.ts` ·
`cariEkstreDokumu`):

- Borç tarafı `sorumlular: { some: { kisiId } }` süzgeciyle
  `borc.tutar`'ın **TAMAMINI** topluyor
- Tahsilat tarafı `borcSorumlusu.kisiId` ile kişinin **PAYINI** topluyor
- `borcSorumlusu.pay` alanı borç tarafında **hiç kullanılmıyor**
- Açılış bakiyesi de aynı asimetriyi taşıyor

Bugünkü çıktı **hiçbir okumaya göre doğru değildir**: borç tam, tahsilat
pay — ikisi arasında tutarlı bir yorum yok.

---

## 1 · Karar gerektiren çatal

Bu bir hata düzeltmesi değil, **karar gerektiren bir hatadır.** İki farklı
"doğru" var:

### OKUMA A — payına göre

Malik A: borç 3.242,50 · tahsilat 2.033,00 · kapanış 1.209,50.
**Σ kişi ekstreleri = bölüm ekstresi.** Muhasebe belgesi mantığı: ekstre
bir yardımcı defter görünümüdür, toplamı kontrol hesabına eşit olmalıdır.

### OKUMA B — müteselsil

Malik A: borç 6.485,00 · tahsilat 4.066,00 · kapanış 2.419,00 — bölümün
aynısı. Her paydaş borcun tamamından sorumludur. **İcra takibi mantığı:**
alacaklı hangi paydaşa giderse gitsin tamamını isteyebilir.

### Seçim mevzuata bağlıdır

Paylı mülkiyette ortak gider borcunda paydaşların **yönetime karşı**
sorumluluğu payı oranında mıdır, müteselsil midir? TMK'nın paydaşlar
**arası** hükmü ile KMK'nın **yönetime karşı** sorumluluk hükmü aynı şeyi
söylemiyor; içtihat tek yönlü değil.

⛔ **Bu ADR bu soruyu CEVAPLAMAZ.** Aşağıdaki §4'te açık soru olarak durur.

---

## 2 · ★ ÖLÇÜM GÖREVİN VARSAYIMLARINI ÜÇ NOKTADA ÇÜRÜTTÜ

Bunlar kod yazılmadan önce karara bağlanmalıdır; aksi hâlde yanlış
değişmez (invariant) test edilir.

### 2.1 · `pay` HİÇBİR ZAMAN NULL DEĞİL

`BorcSorumlusu.pay` şemada `Decimal(18,4)` ve **NOT NULL**:

> *"Bu kişiden istenen tutar. Hisseli mülkiyette borç maliklere BÖLÜNÜR…
> **Tek sorumlu varsa borcun tamamına eşittir.**"*

Yani *"kiracı satırında pay null ise ne olacak"* sorusu **konusuzdur**.
Null'a karşı savunma kodu yazmak, olmayan bir duruma dal açmak olurdu.

### 2.2 · ★ SORUMLULUK ZİNCİRİ TUTARI BİLİNÇLİ OLARAK ÇOĞALTIR

`borcSorumlulariniCoz` iki eksenli bir zincir kuruyor
([`borc-sorumlusu.ts:137-161`](../../../shared/apartman-domain/src/borc/borc-sorumlusu.ts)):

- `sira: ASIL` — borcu asıl yüklenen taraf
- `sira: IKINCIL` — **KMK md. 22 teminat katmanı.** Kiracı ödemezse
  başvurulacak malik zincirde her durumda durur

Ölçüldü (canlı · Papatya kapı 2 · kiracılı daire, 1.500 TL borç):

```text
Onur Bayrak  (KIRACI / ASIL     / pay 1500,0000)
Derya Tunç   (MALIK  / IKINCIL  / pay 1500,0000)
```

**İki satır da borcun TAMAMINI taşıyor.** Σ pay = 3.000 ≠ 1.500. Bu bir
hata değildir: malik borcun *yarısından* değil, **tamamından** ikincil
sorumludur.

**Bunun iki sonucu var:**

**(a) *"Payların toplamı 1 olmalı"* kuralı yanlıştır.** Yalnızca **aynı
`sira` katmanındaki** satırlar için geçerlidir (çok malikli ASIL kümesi).
Zincir katmanları arasında toplam, katman sayısı kadar katlanır.

**(b) *"Σ kişi ekstreleri = bölüm ekstresi"* değişmezi EVRENSEL
DEĞİLDİR.** Kiracılı bir bölümde kiracı (ASIL, tam tutar) ve malik
(IKINCIL, tam tutar) ayrı ayrı toplanırsa iki katı çıkar. Değişmez ancak
**ASIL katmanı üzerinden** kurulabilir.

⚠️ Görev tarifindeki CT-27 değişmezi bu hâliyle yazılırsa **kiracılı
bölümde kırmızı olur ve ürün doğru çalıştığı hâlde yanlış suçlanır.**

### 2.3 · A ve B YALNIZCA HİSSELİ MALİKTE AYRIŞIR

Kiracılı bölümde ASIL sorumlunun payı zaten borcun tamamıdır — iki okuma
**aynı sonucu** verir. Fark yalnızca **birden çok ASIL sorumlunun bulunduğu**
(hisseli mülkiyet) durumda ortaya çıkar.

★ Bu, hatanın bugüne kadar neden kaçtığını da açıklar: tek malikli ve
kiracılı bölümlerde iki okuma ayırt edilemez.

### 2.4 · ★ AYNI SORU İKİ KATMANDA FARKLI CEVAPLANMIŞ — koda gömülü

Ölçüldü ([`tahakkuk.command.service.ts:634-637`](../../../backend/src/modules/tahakkuk/tahakkuk.command.service.ts)):

```ts
const kendiPayi =
  s.sira === 'ASIL' && asilPaylari !== null && asilIndeksi >= 0
    ? asilPaylari[asilIndeksi]?.tutar ?? pay.tutar
    : pay.tutar;          // ← IKINCIL DAİMA TAM TUTAR
```

| Katman | Bugünkü davranış |
|---|---|
| `ASIL`, birden çok malik | `malikBorcunuBol` ile **payına göre** bölünür |
| `IKINCIL` | **Her satır tam tutar** — hisse hiç uygulanmaz |

Yani hisseli **ve** kiracılı bir bölümde: ASIL = kiracı (tam tutar),
IKINCIL = iki malik ve **her biri tam tutar** (750'şer değil).

⚠️ **Aynı malik ASIL'ken payına göre, IKINCIL'ken müteselsildir.** Aynı
hukuki soru iki yerde **farklı** cevaplanmış ve bu cevap **koda gömülü** —
hiçbir yerde karar olarak yazılı değil.

### 2.5 · ★ İKİNCİ SESSİZ DÜŞÜŞ — hisse kaydı eksikse müteselsile kayar

Bölüşüm yalnızca şu koşulda uygulanıyor:

```ts
asillar.length > 1 && donemHisseleri.length === asillar.length
```

Hisse kayıtlarının sayısı ASIL sorumluların sayısıyla **eşleşmezse**
(eksik tapu kaydı, yarım kalmış devir, dönem dışı hisse) `asilPaylari`
`null` kalır ve **herkes tam tutarı alır** — yani ürün **sessizce
müteselsil davranır**.

Bu, K5'in doğrulama maddesinin asıl gerekçesidir: bugün eksik veri hataya
değil, **sessizce farklı bir hukuki yoruma** düşüyor.

#### ★ TEŞHİS DÜZELTİLDİ (6 Ağustos 2026) — kusur uzunluk/kimlik değil, NÜFUS

> ⚠️ **Bu bölümün ilk hâli yanlış teşhis taşıyordu.** *"Uzunluk eşitliği
> kimlik eşitliği değildir"* deniyor ve hisse kayıtlarının ayrı bir
> kaynaktan geldiği **varsayılıyordu**. Ölçülmedi; ölçülünce çürüdü.
> Kayıt yanlış teşhis taşıyamaz — aşağısı düzeltilmiş hâlidir.

**Ölçüm:** `iliskiHaritasi` ve `hisseHaritasi` **tek bir**
`tx.malik.findMany` sonucundan kuruluyor
([`tahakkuk.command.service.ts:534`](../../../backend/src/modules/tahakkuk/tahakkuk.command.service.ts))
ve tarih süzgeçleri **birebir aynı yüklem**:

```ts
// tarihtekiIliskiler (borc-sorumlusu.ts:48)
i.baslangic <= tarih && (i.bitis === null || i.bitis >= tarih)
// donemHisseleri (tahakkuk.command.service.ts, satır içi)
h.baslangic <= donem && (h.bitis === null || h.bitis >= donem)
```

Aynı kaynak + aynı yüklem ⇒ **malik kimlik kümesi ile hisse kimlik kümesi
yapısal olarak her zaman eşittir.** *"Silinmemiş eski malik"* senaryosu
üretilemez: eski malik `Malik` tablosunda duruyorsa **hem ilişki hem
hisse** olarak görünür.

**Gerçek kusur: İKİ FARKLI NÜFUS karşılaştırılıyordu.**

Eski koşul `donemHisseleri.length === asillar.length` idi — `asillar`
**zincirin ASIL satırları**, `donemHisseleri` ise **her zaman malikler**:

| Gider türü | `asillar` | `donemHisseleri` | Sonuç |
|---|---|---|---|
| `KULLANANA_AIT` + kiracı | **1** (kiracı) | **2** (malikler) | eşit değil → `null` → **herkes tam tutar** |
| `MALIKE_AIT` | 2 (malikler) | 2 | eşit → bölüşüm çalışır |

★ **IKINCIL maliklerin tam tutar almasının sebebi budur** — ayrı bir kusur
değil, bu nüfus uyuşmazlığının doğrudan sonucu. Kiracılı her bölümde
bölüşüm **hiç çalışmıyordu**.

#### Kümelerin eşitliği bir KORUMA değil, YAPISAL DEĞİŞMEZDİR

Koddaki küme karşılaştırması kalır ama **koruma diye sayılmaz**: bugünkü
veri yolunda tetiklenemez. Yorumu bunu açıkça söyler, aksi hâlde yeşil
test listesinde görünmeyen bir kontrol zamanla **kanıtlanmış sanılır**.

⏳ **Daha temiz olan:** iki haritayı **tek fonksiyondan** üretmek —
tautoloji kodun yapısına gömülür, kontrole gerek kalmaz, garanti tip
seviyesine çıkar. Düzeltmenin kapsamını genişlettiği için **yol
haritasına** yazıldı.

#### ★ ULAŞILABİLİR OLAN KONTROL: Σ hisse = 1

K5'in asıl sorusu `Σ pay = borc.tutar` idi. **O da tautoloji çıktı:**
`dagit` ağırlıkları **toplama bölerek normalize eder** ve kalan kuruşu en
büyük paya ekler ([`money.ts:168-189`](../../../shared/kernel/src/money/money.ts));
toplam **yapısal olarak** korunur.

**Ölçülmeyen ve ulaşılabilir olan şey `Σ hisse = 1`'dir:**

| Kayıtlı hisse | Bugünkü davranış |
|---|---|
| 1/2 + 1/2 | 975 / 975 ✓ |
| 1/2 + 3/5 (toplam 1,1) | 886,36 / 1.063,64 — **Σ = 1.950, hata yok** |
| **1/1 + 1/1** (silinmemiş devir) | 975 / 975 — **hiçbir uyarı yok** |

⚠️ Son satır kritik: **yarım kalmış devirde mülkiyeti devretmiş kişi
adına borç doğuyor**, `BorcSorumlusu` snapshot'ına yazılıyor, kişi
ekstresinde çıkıyor, gecikme bildirimi listesine giriyor. Sessizce yanlış
borçlandırmaktansa **durmak** asgari doğru davranıştır.

**Karar:** `Σ hisse ≠ 1` ise tahakkuk **reddedilir**. Mesaj **bölümü,
bulunan toplamı ve kayıtlı hisseleri** söyler.

⚠️ **Tolerans `HISSE_OLCEGI` üzerinden TÜRETİLİR, sabit epsilon yoktur.**
`hisseAgirligi` `(pay × ÖLÇEK) / payda` ile bigint'e çevirir; 1/3 gibi
oranlarda kırpma artığı sorumlu sayısı kadar birim olabilir ve tolerans
buradan hesaplanır.

**Üç şart (onaylandı):**

1. **Asıl yer malik/devir YAZMA anıdır.** Tahakkuktaki kontrol **ikinci
   savunma hattıdır**. Yazma anındaki kontrol bu turun kapsamı dışıysa yol
   haritasına gider — ama niyet burada yazılıdır.
2. **Doğrulama ÖNİZLEMEYE taşınır.** Bozuk bölümler listelenir, *"işle"*
   kilitli kalır. ⛔ **Kısmi tahakkuk YOK:** bozuk bölümü atlayıp
   ötekileri işlemek **sessiz eksik borçlandırma** üretir. Çalışma zamanı
   kontrolü son kapıdır.
3. **Kontrol açılmadan önce mevcut veri TARANIR.** Düzeltme yolu olmayan
   bir kilit ürünü kilitler.

### 2.6 · ADR-0007 "hukuki parametre seti" DEĞİL

Görev tarifi açık soruyu ADR-0007'ye eklemeyi istiyor. Ölçüldü:
**ADR-0007 = "Para tipi — ölçeklenmiş bigint, harici ondalık kütüphanesi
yok"**. Hukuki parametre seti taşıyan bir ADR depoda **yok**.

★ **Öneri:** açık soru bu ADR'nin §4'ünde dursun (kararın kendi yerinde),
ADR-0010'a çapraz atıf düşülsün, ve yol haritasına satır yazılsın. Ayrı
bir "hukuki parametre seti" ADR'si açmak gerekiyorsa o ayrı bir karardır.

---

## 3 · Önerilen karar — onay bekliyor

### K1 · Semantik YAZMA ANINDA uygulanır — okuma anında parametre YOKTUR

> ⚠️ **REVİZE EDİLDİ.** İlk taslak semantiği ekstre okunurken parametreyle
> seçiyordu. O tasarım **kendi içinde çelişikti** ve K3 ile K4'ü aynı anda
> ihlal ediyordu:
>
> - K4 *"ekstre zaten yazılmış `pay`'i okur"* diyor; `MUTESELSIL` okuması
>   ise `pay`'i **yok sayıp** `borc.tutar` kullanmak demektir.
> - `MUTESELSIL` seçilseydi Σ ASIL = 2 × bölüm olur, **K3'ün değişmezi
>   kırılırdı.**
>
> Üç karar aynı anda doğru olamıyordu.

**Kök sebep:** semantik **okuma anına** konmuştu; oraya ait değil.

Şema zaten söylüyor — `BorcSorumlusu.cozumlemeTarihi`:

> *"SNAPSHOT kanıtı — sorumluluk bu tarihte çözüldü ve **DEĞİŞMEZ**."*

Okuma anında çevrilen bir anahtar **geçmişteki bütün ekstreleri geriye
dönük değiştirir**: kat malikine dün verilmiş belge bugün başka rakam
gösterir. Bu, snapshot ilkesinin doğrudan ihlalidir.

§2.3 bulgusu da aynı yeri işaret ediyor: A ve B yalnızca **birden çok
ASIL sorumlu** olduğunda ayrışıyor — yani ayrım **sorumluluk zincirinin
kurulma biçimindedir**, ekstrenin okunma biçiminde değil.

**Karar:** semantik `borcSorumlulariniCoz` / pay yazma yolunda, **tahakkuk
anında** uygulanır.

| Değer | Zincirin kurulma biçimi |
|---|---|
| `PAYINA_GORE` | Hisseli malikler ASIL katmanında `pay = tutar × hisse` |
| `MUTESELSIL` | Her malik ASIL katmanında `pay = tutar` (KİRACI/MALİK deseninin aynısı) |

**Ekstrede `paylasimSemantigi` parametresi YOKTUR — yalnızca `pay` okunur.**

**Bugünkü varsayılan: `PAYINA_GORE`.** Gerekçe keyfi değildir: mevcut
zincir müteselsilliği **zaten katman ile** ifade ediyor (ASIL/IKINCIL).
Aynı katmanda tutar çoğaltmak, aynı şeyi **ikinci bir mekanizmayla**
anlatmak olurdu. `PAYINA_GORE` modelle tutarlı olandır.

⚠️ Bu yine de **bir tercihtir, tespit değildir** — hukuk cevabı §4'te
bekliyor.

⚠️ **Değer koda gömülmez (R6).** `mevzuat_parametre` tablosu açıldığında
oraya taşınacak **aday**; tablo bugün **yok** (yol haritası · B2 taraması).
Tablo **yürürlük tarihli** olduğu için cevap değiştiğinde **ileriye dönük**
uygulanır: geçmiş tahakkuklar o günkü hukukla kalır.

#### K1'in bedeli — açıkça yazılır

Semantik yazma anında sabitlendiği için, **hukuk cevabı bugünkü
varsayılandan farklı çıkarsa geçmiş kayıtlar kendiliğinden düzelmez.**
Gereken iş:

- Etkilenen borçların `borcSorumlusu.pay` satırlarının **yeniden
  çözümlenmesi** (yalnızca hisseli mülkiyetli bölümler)
- Bu düzeltmenin **tahsis satırlarına etkisi**: bir malik kendi payını
  ödemişse ve pay değişirse ödeme fazla/eksik hâle gelir
- Kapalı dönemlerde bunun **ters kayıtla** mı yapılacağı ayrı karar

★ Okuma anına koyup *"kolayca çevrilir"* demek bu maliyeti **gizlemek**
olurdu. Maliyet gerçektir ve snapshot ilkesinin bedelidir.

#### ⚠️ MEVCUT VERİ ESKİ SEMANTİĞİ TAŞIR

Semantik yazma anına taşındığı için düzeltme **yalnızca bundan sonraki
tahakkuklara** etki eder. Veritabanındaki `BorcSorumlusu` satırları hâlâ
**kararsız mantıkla** yazılmıştır: IKINCIL malikler tam tutar taşıyor,
hisse kaydı eksik olan bölümlerde ASIL'ler de sessizce tam tutar almış
olabilir.

**İki sonucu var:**

**(1) CT-27 mevcut tohum verisiyle KIRMIZI çıkar — ve bu DOĞRU
davranıştır.** Test doğru şeyi ölçüyor, veri eskidir. ⛔ **Testi
geçirmek için test gevşetilmez**; tohum yeniden üretilir ve ölçüm yeni
veriyle yapılır.

**(2) Geçmiş kayıtlar için karar gerekir.** İki seçenek de savunulabilir:

| | Gerekçe | Bedeli |
|---|---|---|
| **Bırakılır** | `cozumlemeTarihi` snapshot ilkesiyle tutarlı: o gün öyle çözüldü | ⚠️ O gün **bilinçli bir karara göre** değil, **bir kusura göre** çözüldü. Snapshot ilkesi **kararı** korumak için vardır, hatayı değil |
| **Yeniden çözümlenir** | Doğru olan budur | Tahsis kayıtları `borcSorumlusu`'na bağlıdır (`tahsisler TahsilatTahsisi[]`). Pay değişirse **kapanmış borçlar açılabilir**, `odenen > pay` durumu doğabilir, `kapandiMi` tutarsızlaşır |

**Bugün ucuzdur:** veri geliştirme verisidir, tohum yeniden üretilir ve
sorun biter.

⛔ **İlk müşteri verisinden sonra bu maliyet ödenmez hâle gelir.**
Üretim verisi varken yeniden çözümleme **tahsisleri de etkiler** ve
kapalı dönemlerde ters kayıt gerektirir. Karar o günden önce
verilmelidir.

### K2 · Asimetri kaldırılır

Borç, tahsilat **ve açılış bakiyesi** aynı semantiği kullanır. Bugün
açılış bakiyesi de asimetriktir; yalnızca dönem içi düzeltilirse ekstre
başı ile içi çelişir.

### K3 · Değişmez ASIL katmanı üzerinden kurulur + satırda `sira` taşınır

`PAYINA_GORE` seçildiğinde:

> **Σ (ASIL sorumluların ekstreleri) = bölüm ekstresi** — borç, tahsilat,
> açılış ve kapanış için ayrı ayrı, **kuruşuna kadar**.

IKINCIL satırlar bu toplama **girmez**; teminat katmanıdır, ikinci bir
borç değil.

**Kişi ekstresi satır düzeyinde `sira` taşır** ve ekran **iki bölüm**
gösterir:

| Bölüm | İçerik | Bakiyeye etkisi |
|---|---|---|
| *Asıl sorumlu olduğunuz* | `sira = ASIL` satırları | **Yürüyen bakiye buradan** |
| *İkincil sorumlu olduğunuz* | `sira = IKINCIL` satırları | **YOK** — bilgilendirmedir |

⚠️ **Neden zorunlu:** bugünkü zincirde kiracılı bölümde malik de borcun
tamamını taşıyor. Malik kendi ekstresini istediğinde bu satır görünecek —
**etiketsiz görünürse, asıl borçlusu kiracı olan bir borcu malike kendi
borcuymuş gibi göstermiş oluruz.** İtiraz gelir ve haklı olur.

### K4 · Yuvarlama tahakkukla AYNI kuralı kullanır

Kalan kuruş **son sorumluya** yazılır — tohumun ve tahakkuk yolunun
bugünkü kuralı (`payKurus = sonMu ? kurus - dagitilan : …`). Ekstre kendi
yuvarlamasını yaparsa tahakkukla arasında kuruş farkı **birikir**.

⚠️ Ekstre **zaten yazılmış** `pay` değerlerini okur, yeniden
hesaplamaz — yuvarlama tahakkuk anında bir kez yapılmıştır. Bu, kuralın
iki yerde ayrışmasını yapısal olarak imkânsız kılar.

### K5 · Semantik HER MALİK KATMANINDA aynıdır + doğrulama

> ⚠️ **REVİZE EDİLDİ.** İlk taslak yalnızca *"aynı katmanda Σ pay =
> borç"* diyordu. §2.4 ölçümü gösterdi ki asıl sorun bu değil: **aynı
> malik ASIL'ken payına göre, IKINCIL'ken müteselsil.**

**Kural:** paylaştırma semantiği **her malik katmanında aynıdır** —
`ASIL` ya da `IKINCIL` fark etmez. Bir malik bir katmanda payına göre,
ötekinde müteselsil olamaz; **aynı hukuki soru, iki yer.**

| Semantik | Her malik katmanında |
|---|---|
| `PAYINA_GORE` | **Σ pay = `borc.tutar`** |
| `MUTESELSIL` | **Her satır = `borc.tutar`** |

**Doğrulama — sessizce geçilmez:** katman içi toplam beklenen değeri
tutmuyorsa (veri girişi hatası, yarım kalmış devir, hisse satışı) sorgu
**devam etmez**; hata döner ve mesaj **bölümü, borcu ve bulunan toplamı**
söyler.

⚠️ Bu maddenin asıl gerekçesi §2.5'tir: bugün hisse kaydı eksikse ürün
hata vermiyor, **sessizce müteselsile kayıyor.** Eksik veri bir hukuki
yorum değiştirmemelidir.

### K6 · Yanıt tipine dört alan eklenir

`CariEkstreDokumu` bugün yalnızca `bolumId` ve `daire` döndürüyor; ekran
kimin görünümünü gösterdiğini **yazamıyor**.

| Alan | Neden |
|---|---|
| `kisiId` · `kisiAdi` | Süzgeç açıkken kimin görünümü olduğu |
| `hisseOrani` | Başlıkta *"1/2 hisse"* yazabilmek için |
| `semantik` | Borç yazılırken uygulanmış olan semantik — ekran altına tek satır açıklama. ⚠️ Bir **ayar değil**, kaydın taşıdığı **olgudur** (K1) |
| satırda `payaDusen` | Tahakkukun **tam** tutarı da görünsün, kişiye düşen de |
| satırda `sira` | `ASIL` / `IKINCIL` — ekranın iki bölümü buna göre ayrılır (K3) |

★ Son madde önemli: bu ekran **en çok itiraz alacak yerdir**. Malik
*"benim borcum niye 3.242,50, tahakkuk 6.485 yazıyor"* diye sorduğunda
cevabı aynı satırda görmelidir.

---

## 4 · HUKUK ONAYI BEKLİYOR

> **Soru:** Paylı mülkiyette ortak gider borcunda paydaşların **yönetime
> karşı** sorumluluğu **payı oranında** mıdır, **müteselsil** midir?
>
> **Cevap:** *(boş)* · **Durum:** 🟠 HUKUK ONAYI BEKLİYOR
>
> **Bağlam:** TMK'nın paydaşlar arası hükmü ile KMK'nın yönetime karşı
> sorumluluk hükmü aynı şeyi söylemiyor; içtihat tek yönlü değil.
>
> ⚠️ Bugünkü varsayılan (`PAYINA_GORE`) **onaylanmamıştır** ve bir
> tercihtir, tespit değildir. Üstelik bugün **tutarsız uygulanıyor**
> (§2.4) ve eksik veride **sessizce müteselsile kayıyor** (§2.5).

★ **Sorunun kayıtlı yeri: [Hukuk Soru Seti · H-1](../../HUKUK-SORU-SETI.md).**
Bu ADR ona işaret eder; cevap oraya yazılır ve buraya taşınır.

⚠️ **Neden ayrı belge:** hukuk soruları ADR'ye konursa *"kabul edildi"*
statüsü olmayan bir ADR çıkar. Ayrıca dağınık dururlarsa **avukata
gönderilecek tek belge çıkmaz** — bugün en az beş madde birikmiş durumda.

---

## 4b · CT-27 — kanıt senaryoları

Değişmezin kendisi K3'tedir. Koşulacak senaryolar:

| # | Senaryo | Neyi kanıtlar |
|---|---|---|
| 1 | Hisseli bölüm (Papatya kapı 7, iki malik) | Ölçülen hatanın kapandığı |
| 2 | Tek malikli bölüm | Gerilemenin olmadığı |
| 3 | 1/3 hisse | Yuvarlama — kalan kuruş son sorumluya (K4) |
| 4 | Kiracı borcu olan bölüm | ASIL/IKINCIL ayrımı |
| 5 | Payları tutmayan bozuk veri | **Hata bekleniyor** (K5) |
| 6 | **Hisseli + kiracılı** | ASIL = kiracı, IKINCIL = iki malik — **K5'in yeni hâli** |
| **7a** | **Resolver:** ikincil malik satırı doğru `pay` ve `sira` ile **yazılıyor** | `df7def1`'in kanıtı — pay dağıtımı katmandan bağımsız |
| **7b** | **Ekstre:** ASIL/IKINCIL bölümleri görünüyor, yürüyen bakiye **yalnızca ASIL** | K3'ün ekran/sorgu tarafı |
| 8 | **Devir sonrası** | `cozumlemeTarihi` geçmiş sorumluluğu koruyor; yeni malik eski borcun ASIL'i **olmuyor** |
| 9 | **Hisse kaydı sayıca doğru, KİMLİKÇE yanlış** | **Hata bekleniyor** — küme eşitliği kontrolü (§2.5). Uzunluk kontrolü bunu kaçırır ve yanlış kişilerin hisseleriyle böler |

⚠️ **TEK MALİKLİ TEST TEK BAŞINA YETMEZ** — iki okuma orada aynı sonucu
verir. **Kiracılı test de yetmez** (§2.3): ayrım yalnızca **birden çok
ASIL sorumlu** varken görünür. Hatanın bugüne kadar kaçmasının sebebi
büyük ihtimalle budur.

### ★ 7 NEDEN İKİYE BÖLÜNDÜ

Senaryo 7 iki ayrı katmanı sınıyor ve **ikisi ayrı zamanlarda yazılıyor**:
resolver düzeltmesi (`df7def1`) bugün, ekstre sorgusu sonra.

⛔ **Tek ad altında yazılıp yarısı kapsanırsa**, ileride **yeşil bir
CT-27/7** K3'ün kanıtlandığını gösterir — oysa ekran tarafı hiç
sınanmamış olur. Altı ay sonra bunu kimse ayırt edemez.

> **K3 YALNIZCA 7a VE 7b BİRLİKTE YEŞİLKEN KAPANIR.**

★ **7a'nın ayırt edici iddiası:** aynı fikstür `KULLANANA_AIT` **ve**
`MALIKE_AIT` ile ayrı ayrı koşar. Kusur tam olarak bu ikisinin ayrıştığı
yerde doğdu (§2.5 — nüfus uyuşmazlığı); yan yana sınamak teşhisi **teste**
yazar, sonraki okuyucu onu ADR'den değil testten okur.

| Gider türü | ASIL | IKINCIL |
|---|---|---|
| `KULLANANA_AIT` | kiracı, `pay = 1.500` | iki malik, **750'şer** |
| `MALIKE_AIT` | iki malik, 750'şer | — |

Eski kod ikinci sütunda **1.500'er** yazıyordu; test bu sayıyı
hedeflemezse değişikliği kanıtlamaz. İddia hisse oranına göre
**parametriktir** (1/2 ve 1/3); 1/3 aynı zamanda yuvarlama artığının en
büyük paya gittiğini sınar (K4).

### ⚠️ TESTİN NEREDE YAZILABİLECEĞİ ÖLÇÜLDÜ

`borcSorumlulariniCoz` **`pay` ÜRETMEZ** — imzası
`{ kisiId, sira, rol, cozumlemeTarihi }` döndürür. Pay hesabı
`tahakkuk.command.service.ts` içindedir ve `df7def1` **yalnızca o dosyaya**
dokunmuştur (ölçüldü: 1 dosya, 74/21 satır).

⛔ Fikstür yalnızca `borcSorumlulariniCoz`'u çağırırsa **750 iddiası
kurulamaz**: test yazılır, yeşil olur, `df7def1`'i **kanıtlamaz**.

★ **Karar:** pay dağıtımı `apartman-domain` içinde **saf fonksiyona**
çıkarılır — girdisi sorumluluk zinciri + hisse kayıtları + tutar, çıktısı
`pay`'li zincir. Servis onu çağırır. Test **veritabanısız**, hızlı ve
tohumdan bağımsız olur (`tahsis-sirasi.ts` deseninin aynısı — R1 açısından
**genişletme**, yeniden yazma değil).

⏳ `Σ hisse = 1` kontrolü de **aynı saf fonksiyona** gelir; böylece
**senaryo 9 da veritabanısız** yazılabilir hâle gelir.

⚠️ Çıkarma işlemi **ayrı commit** olacak ve **davranışın değişmediği**
commit mesajında yazılı olacak; test ondan sonra biner.

---

## 5 · Alternatifler ve neden reddedildi

**"Sadece borç tarafını `pay` ile çarp, gerisine dokunma."**
Reddedildi: açılış bakiyesi asimetrik kalır ve ekstrenin başı ile içi
çelişir. Ayrıca hangi okumanın uygulandığı yine belgelenmemiş olur.

**"Kişi ekstresini tümüyle kaldır, yalnızca bölüm ekstresi kalsın."**
Reddedildi: hisseli malik kendi payını görmek zorundadır; ADR-0010 kişi
görünümünü açıkça *"aynı motorun süzgeci"* olarak tanımlamıştır.

**"Varsayılanı `MUTESELSIL` yap — icra tarafı daha güvenli."**
Reddedildi (şimdilik): Σ kişi = bölüm değişmezi kaybolur ve ekstre
yardımcı defter olmaktan çıkar. Ayrıca hukuk cevabı gelmeden *"daha
güvenli"* bir tercih yoktur; iki yönde de yanlış olabilir.

**"Semantiği okuma anında parametreyle seç — kolayca çevrilir."**
**Bu ilk taslağın kendi önerisiydi ve reddedildi.** Üç sebep:

1. **K3 ve K4 ile aynı anda doğru olamıyor** (bkz. K1 başındaki kutu).
2. **Snapshot ilkesini ihlal eder.** `cozumlemeTarihi` *"sorumluluk bu
   tarihte çözüldü ve DEĞİŞMEZ"* diyor; okuma anındaki bir anahtar
   geçmişteki bütün ekstreleri geriye dönük değiştirir. Kat malikine dün
   verilmiş belge bugün başka rakam gösterir.
3. ***"Kolayca çevrilir"* maliyeti gizler.** Cevap değişince geçmiş
   kayıtların düzeltilmesi gerekir; okuma anına koymak bu işi ortadan
   kaldırmaz, yalnızca **görünmez kılar** — ve rakam sessizce değişir.
