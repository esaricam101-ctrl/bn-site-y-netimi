# ADR-0016 · Virman — üç ayrı tür

**Tarih:** 2 Ağustos 2026
**Statü:** 🟡 TASLAK — **KARAR YOK**
**Öneren:** —
**Onaylayan:** —
**İşlendiği belge:** —
**İlgili:** [ADR-0003](0003-muhasebe-cift-tarafli.md) (çift taraflı kayıt) ·
[ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) (cari = bağımsız bölüm) ·
[ADR-0015](ADR-0015-yil-sonu-kapanisi.md) (dönem kapanışı)

> ⚠️ Bu dosya bilinçli olarak **eksiktir**. Karar birlikte verilecek; o zamana
> kadar buraya tercih yazılmaz. Yalnızca **mevcut durum** (dosya + satır) ve
> **cevaplanacak sorular** vardır.

## Neden üç ayrı bölüm

"Virman" tek bir özellik değildir. Üçü **farklı varlığa dokunur, farklı kurala
tabidir ve farklı riski taşır**:

| | Ne taşınır | Hangi varlık | Asıl risk |
|---|---|---|---|
| **A · Kasa/banka virmanı** | fon | `BankaHesabi` · kasa hesabı | paranın yarısının deftere girmesi |
| **B · Hesap virmanı** | muhasebe kaydı | `Hesap` · `YevmiyeFisi` | düzeltmenin iz bırakmadan yapılması |
| **C · Cari virman** | borç/alacak | bölüm carisi · `BorcSorumlusu` | borcun sahibini sessizce değiştirmek |
| **D · Kalem bazlı tahsis** | tahsilatın dağılımı | `Tahsilat` · `TahsisSatiri` | paranın yanlış kaleme sayılması |

⚠️ **D bir virman DEĞİLDİR** ve bilerek bu ADR'de tutulur: incelenen üründe
aynı ekranda göründüğü için virman sanılıyor. Aslında tek kişinin/dairenin
kalemleri arasında **tahsis**tir — hiçbir bakiye bir cariden ötekine geçmez.
Ayrımın kaybolması, C'nin (gerçek cari virman) yanlışlıkla "zaten var" diye
kapatılmasına yol açardı.

Tek ekranda toplanırsa üç farklı kural tek doğrulama akışına sıkışır ve
en gevşeği ötekileri belirler.

---

## Mevcut durum — taranmış, tahmin değil

### Varlıklar

- **`BankaHesabi`** ([schema.prisma:2108](../../../database/prisma/schema.prisma#L2108)) —
  `muhasebeHesapId` **zorunlu**, `paraBirimi` (varsayılan `TRY`),
  `acilisBakiyesi`, `aktif`.
- **Kasa ayrı bir varlık DEĞİLDİR.** Hesap planındaki bir hesaptır:
  `MuhasebeParametresi.varsayilanKasaHesapId`
  ([schema.prisma:908](../../../database/prisma/schema.prisma#L908)).
- **Ayrı `Cari` tablosu YOKTUR** — ADR-0010 uygulanmış. Kişi ekstresi bir
  görünümdür ([makbuz.query.service.ts:84](../../../backend/src/modules/tahsilat/makbuz.query.service.ts#L84)).

### Yazılmış olanlar

| Yetenek | Durum | Yer |
|---|---|---|
| Banka↔banka virman | ✅ var | `POST /banka/virman` · [hareket.command.service.ts:256](../../../backend/src/modules/banka/hareket.command.service.ts#L256) |
| Elle yevmiye fişi | ✅ var | `POST /muhasebe/fisler` → `PATCH /fisler/:id/isle` |
| Ters kayıt (storno) | ✅ var | `POST /muhasebe/fisler/:id/storno` · [fis.command.service.ts:263](../../../backend/src/modules/muhasebe/fis.command.service.ts#L263) |
| Dönem kilidi | ✅ var | `MuhasebeDonemi.durum`, kapalı döneme fiş işlenemez ([fis.command.service.ts:227](../../../backend/src/modules/muhasebe/fis.command.service.ts#L227)) |
| Kasa↔banka virman | ❌ **yok** | — |
| Hesap virmanı (B) | ❌ yok | — |
| Cari virman (C) | ❌ yok | — |

---

## ORTAK · VİRMAN GEREKÇESİ — sebep kodu + açıklama

### Mevcut durum: serbest metin VAR, sebep kodu YOK

| Alan | Durum | Yer |
|---|---|---|
| `YevmiyeFisi.aciklama` | **zorunlu** serbest metin | [schema.prisma](../../../database/prisma/schema.prisma) `model YevmiyeFisi` |
| `YevmiyeSatiri.aciklama` | **isteğe bağlı** serbest metin | `model YevmiyeSatiri` |
| `BankaHareketi.aciklama` | **zorunlu** serbest metin | `model BankaHareketi` |
| **sebep kodu** | ❌ **hiçbirinde yok** | — |

### İkisi farklı iştir

- **Açıklama → insana bilgi:** *"İSTANBUL ANADOLU 4. İCRA 14189"*
- **Sebep kodu → sisteme bilgi:** `ICRA_TAHSILAT_DAGITIMI`

Serbest metin ikinci işi göremez. Bir alan iki işi birden yapıyor görünürse,
göremediği iş **yapılmış sanılır**.

### Öneri (karar ürün sahibinde): virman fişinde ÜÇÜ BİRDEN

1. **`sebepKodu`** — **zorunlu**, seçim listesinden
2. **`aciklama`** — **zorunlu**, serbest metin (somut olay)
3. **satır bazında açıklama** — isteğe bağlı (alan zaten var)

**Sebep kodu neden gerekli:**

- **Raporlanabilir.** *"Bu yıl kaç düzeltme virmanı yapıldı"* sorusu serbest
  metinle cevaplanamaz.
- **Kural bağlanabilir.** Sebebe göre farklı kısıt: icra dağıtımında hukuki
  mahsup sırası zorunlu, yanlış daire düzeltmesinde ek onay gibi. Serbest
  metne kural bağlanamaz.
- **Denetimde savunulur.** Metni yazan kişi ayrılmış olabilir; kod kalır.
- **Yazım varyasyonundan etkilenmez.** `referans_norm` dersinin aynısı
  (ADR-0014 §2b): `FT-2026-001` ile `ft 2026 001` ham metinde iki ayrı
  değerdi ve aynı faturayı iki kez tahakkuk ettirmeye izin veriyordu.

### ★ Sebep kodları VERİDİR — enum'a gömülmez (R6)

Her virman türü **kendi geçerli sebep listesini taşır**. Cari virmanda
"kasa transferi" seçilememelidir.

Bu, gider türü sınıflandırmasıyla aynı desendir (ADR-0014 §2b): kural veri
olarak durur, motor hiçbir kodu bilmez. Enum'a gömülseydi yeni bir sebep
eklemek migration gerektirir ve proje bazında farklılaşamazdı.

### Başlangıç listesi önerisi — ONAY BEKLİYOR

Ürün sahibinin verdiği beş kod tabanda korunmuş, tür bazında ayrılmış ve
gerekçeli eklemeler yapılmıştır.

#### A · Kasa/banka virmanı

| Kod | Ne zaman | Neden ayrı |
|---|---|---|
| `KASA_BANKA_YATIRMA` | Kasadaki nakit bankaya yatırılır | Rutin operasyon; hiçbir hukuki kısıtı yok |
| `BANKA_HESAPLARI_ARASI` | Aynı amaçlı iki hesap arası (konsolidasyon, vadeli↔vadesiz) | Amaç değişmiyor; serbest |
| `FON_TRANSFERI` | **Amaç değiştiren** transfer (işletme ↔ yenileme fonu) | ⚠️ **C-4 hukuki görüşe bağlı.** Kural buna bağlanacak; ilk ikisiyle aynı koda konulsaydı kısıt meşru transferleri de vururdu |

> **Eklenme gerekçesi (`KASA_BANKA_YATIRMA`, `BANKA_HESAPLARI_ARASI`):**
> ürün sahibinin listesinde yalnızca `FON_TRANSFERI` vardı. Üçü tek koda
> girseydi, KMK md. 72 kısıtı kasadan bankaya para yatırmayı da bloklardı.
> Kısıt bağlanabilir olsun diye ayrıldılar.

#### B · Hesap virmanı (muhasebe düzeltmesi)

| Kod | Ne zaman | Neden ayrı |
|---|---|---|
| `HESAP_DUZELTMESI` | Tutar yanlış hesaba yazılmış | **HATA** düzeltmesi |
| `SINIFLANDIRMA_DEGISIKLIGI` | Kayıt doğruydu, sınıflandırma sonradan değişti (genel kurul kararı, gider türü yeniden belirlendi) | **KARAR** gereği. Denetimde hatayla aynı savunulmaz: biri kusur, öteki yetkiye dayalı |

#### C · Cari virman (kişi/daire arası)

| Kod | Ne zaman | Neden ayrı |
|---|---|---|
| `YANLIS_DAIRE_DUZELTMESI` | Tahsilat/borç yanlış daireye yazılmış | Ürün sahibi listesinden |
| `ICRA_TAHSILAT_DAGITIMI` | İcra dosyasından gelen tahsilatın borçlara dağıtılması | Ürün sahibi listesinden; hukuki mahsup sırası kuralı buna bağlanacak |
| `HISSE_DUZELTMESI` | Hisseli mülkiyette paylar yanlış bölünmüş | Ürün sahibi listesinden |
| `MUKERRER_TAHSILAT_DUZELTMESI` | Aynı ödeme iki kez kaydedilmiş | **Ekleme.** Mükerrer tahakkuk ölçülmüş ve kapatılmıştı (ADR-0014); tahsilat tarafında aynı sınıf hata mümkündür ve düzeltmesi cari virmandır |

#### Bilinçli olarak LİSTEYE ALINMAYANLAR

- **`AVANS_MAHSUBU`** — avans bugün **desteklenmiyor**: tahsis motoru
  *"EKSİK tahsis reddedilir ve avans desteklenmediği söylenir"* diyor.
  Olmayan bir özelliğe kod açmak, o özelliğin var olduğu izlenimini verir.
- **`DAIRE_DEVRI_BORC_AKTARIMI`** — §C'deki *"borcun SAHİBİNİ mi
  SORUMLUSUNU mu değiştiriyoruz"* sorusu çözülmeden açılmamalı. Açılırsa
  kararı kod önceden vermiş olur.

#### Açık soru: `DIGER` kodu olmalı mı?

İki yönde de sessiz hata var:

- **Olmazsa:** kullanıcı en yakın yanlış kodu seçer; veri **yanlış** olur ve
  bu, boş olmasından kötüdür.
- **Olursa:** herkes `DIGER` seçer; kod alanı boş bir alandan farksız kalır.

Öneri: **başlangıçta `DIGER` YOK**, ama liste veri olduğu için proje bazında
genişletilebilir; kullanıcının "uygun kod yok" dediği durumlar izlenip liste
büyütülür. Karar ürün sahibinde.

### ★ İLERİSİ İÇİN — icra dosya numarası bugün GEÇİCİ KÖPRÜ

Sebep kodu `ICRA_TAHSILAT_DAGITIMI` olduğunda açıklamaya elle yazılan dosya
numarası (*"İSTANBUL ANADOLU 4. İCRA 14189"*) bir gün **gerçek bir icra takibi
kaydına bağlanmalıdır**.

Bu, `tahakkuk_calismasi.referans` ile birebir aynı durumdur (ADR-0014):
bugün serbest metin bir iş anahtarı, yarın yabancı anahtar. Aynı iki kural
geçerlidir:

1. İcra takibi varlığı eklendiğinde alan **kayda bağlanmalı**, serbest metin
   olmaktan çıkmalıdır.
2. **Mevcut serbest metin değerleri göç ettirilmeli**; karşılığı bulunamayanlar
   sessizce atılmaz, insan gözüne getirilir.

---

## A · KASA/BANKA VİRMANI — fon transferi

Kasadan bankaya, banka hesapları arası, işletme hesabından yenileme fonu
hesabına.

### Bugün ne yapıyor

`POST /banka/virman` **iki `BankaHareketi`** üretir (ÇIKIŞ + GİRİŞ),
`karsiHareketId` ile karşılıklı bağlar, ve **hiç yevmiye fişi üretmez**.
Fişler sonradan, hareket başına ayrı ayrı `muhasebelestir` çağrısıyla oluşur
([:368](../../../backend/src/modules/banka/hareket.command.service.ts#L368)).

Farklı para birimi **reddediliyor** — gerekçesi kodda yazılı: *"Farklı para
birimi arasındaki transfer bir KUR İŞLEMİDİR ve iki ayrı hareket + kur farkı
kaydı gerektirir"* ([:294](../../../backend/src/modules/banka/hareket.command.service.ts#L294)).

### ★ AÇIK HATA — virmanın bir bacağı deftere girip diğeri girmeyebilir

İki bacak **birbirinden bağımsız** muhasebeleşebilir. Biri muhasebeleştirilip
diğeri unutulursa:

- defterde yalnızca çıkış görünür → **para kaybolmuş görünür**
- ya da yalnızca giriş görünür → **kaynağı olmayan para**
- her iki hâlde **mizan tutmaz**

Bugün bunu engelleyen hiçbir kısıt yok: `muhasebelestir` tek bir hareketi alır
ve karşı bacağın durumuna bakmaz. Bu, mükerrer tahakkukla (ADR-0014) aynı
sınıf mali veri bozulmasıdır — farkı, oradaki fazla kayıt, buradaki **eksik**
kayıttır.

**Öneri (karar ürün sahibinde): virman ANINDA TEK FİŞ üretsin.**

Gerekçe:

1. **Virman, karşı hesabı BİLİNEN tek hareket tipidir.** `muhasebelestir`'in
   "karşı hesabı çağırandan al" gerekçesi — aynı para girişi aidat da olabilir
   kira da — virmanda geçerli **değildir**: karşı taraf hedef hesabın
   muhasebe karşılığıdır ve `BankaHesabi.muhasebeHesapId` zaten **zorunludur**.
   Yani sistem sormadan bilir.
2. **Atomiklik tek fişle kurgudan gelir.** İki ayrı fişte, biri yazılıp öteki
   yazılamazsa mizan geçici olarak bile tutmaz.
3. **Geri alma da tek adım olur.** İki fiş olsaydı biri stornolanıp öteki
   kalabilirdi — aynı hatanın kopyası.

Bu önerinin **bedeli açıkça yazılmalıdır**: virman artık fiş ürettiği için
**dönem kilidine tabi olur** — kapalı döneme virman yapılamaz. Bugün virman
fiş üretmediği için bu kontrol yoktur; yani bu bir davranış değişikliğidir.

### Cevaplanacak sorular

1. **Tek yevmiye fişi mi, iki ayrı hareket mi?**
   Hareketler zaten iki (banka gerçeği iki hesapta ayrı görünür). Soru
   defter tarafıdır: tek fiş mi, iki fiş mi, yoksa bugünkü gibi hiç mi?
   Yukarıdaki öneri "tek fiş" diyor; karar verilmedi.

2. **Farklı para birimi olabilir mi?**
   Bugün reddediliyor ve gerekçesi sağlam. İleride çoklu para birimi
   gerekirse bu bir virman değil **kur işlemi** olarak ayrı modellenmeli mi?

3. **Transfer masrafı nasıl kaydedilir?**
   Bugün virman yalnızca tutarı taşıyor; `MASRAF` ayrı bir `islemTipi` ama
   virmana bağlanmıyor. Masraf virmanın parçası mı (üçüncü bacak), yoksa
   ayrı bir hareket mi? Kaynak hesaptan mı düşer, hedeften mi?

4. **★ Yenileme fonu hesabından işletme hesabına aktarım meşru mu?**
   **HUKUK SORUSUDUR — burada cevaplanmaz.** KMK md. 72 uyarınca yenileme
   fonu amaca özgüdür. `SESSION_SUMMARY` §3.E'deki **C-4 hukuki görüş**
   listesine eklendi. Alt sorular:
   - Fondan harcama hangi karar/onayla yapılabilir?
   - Fon hesabından işletme hesabına aktarım sistemde **engellenmeli** mi,
     yoksa **uyarı + gerekçe** ile izin mi verilmeli?
   - Ters yön (işletmeden fona) serbest mi?

   ⚠️ Hukuki cevap gelmeden bu yola teknik kısıt konulmamalıdır: yanlış
   yönde katı bir kural meşru bir işlemi bloklar, gevşek bir kural fonun
   amaç dışı kullanımını sessizleştirir.

5. **★ KASA ↔ BANKA YOLU YOK — hangi modelle açılacak?**
   Kasa bir **hesap**, banka hesabı bir **varlık**; iki farklı seviye. Bugün
   kasadan bankaya para yatırma modellenemiyor. Seçenekler (hiçbiri
   seçilmedi):
   - Kasayı da bir varlık yapmak (`KasaHesabi`) — sayım, devir, kasiyer
     sorumluluğu gibi kavramlar açılır; en pahalı ama en doğru olabilir.
   - Virman bacaklarının **ya `BankaHesabi` ya `Hesap`** olabilmesi —
     ucuz ama iki bacağın tipi ayrışır, doğrulama karmaşıklaşır.
   - Kasayı özel bir "banka" altında `BankaHesabi` olarak tutmak — en ucuz,
     ama kasa banka değildir; IBAN, şube, ekstre alanları anlamsız kalır.

6. **Mevcut fişsiz virmanlara ne olacak?**
   Bugüne kadar yazılmış virmanlar fiş üretmedi. Karar hangi yönde olursa
   olsun, geçmiş kayıtlar için bir geri doldurma mı yapılacak, yoksa
   yalnızca bundan sonrası mı kapsanacak?

---

## B · HESAP VİRMANI — muhasebe düzeltmesi

Yanlış hesaba yazılmış bir tutarın doğru hesaba taşınması.

> ⛔ **Tarif ve soru listesi ürün sahibinden BEKLENİYOR.** Aşağıdakiler
> yalnızca taramadan çıkan ve bu bölümü şekillendirecek olgulardır — soru
> değil, girdi.

Taramadan çıkan girdiler:

- **Storno zaten var** ve ilke net: *"Hatalı fiş TERS KAYIT ile düzeltilir:
  iki kayıt da defterde kalır"*
  ([fis.command.service.ts:5](../../../backend/src/modules/muhasebe/fis.command.service.ts#L5)).
  İşlenmiş fiş değiştirilemez.
- Dolayısıyla ilk soru şu olmalı: **hesap virmanı storno'dan farklı bir şey
  midir?** Storno hatalı fişi tümüyle ters çevirir; hesap virmanı yalnızca
  bir satırın hesabını değiştirir. İkisi aynı ihtiyacın iki biçimi mi, yoksa
  ayrı işlemler mi?
- Elle fiş girişi zaten mümkün (`POST /muhasebe/fisler`), yani düzeltme
  bugün **elle fiş yazarak** yapılabiliyor. Ayrı bir "hesap virmanı" işlemi
  neyi ekler — kolaylık mı, denetlenebilirlik mi?

---

## C · CARİ VİRMAN — kişi/daire arası

Borç/alacağın bir cariden başkasına aktarılması.

> ⛔ **Tarif ve soru listesi ürün sahibinden BEKLENİYOR.**

### ★ ADR-0010 ile gerilim — karar öncesi çözülmeli

ADR-0010 (kabul edilmiş): *"Cari hesabın birimi `bagimsiz_bolum`dur. **Kişi
bazlı cari tablosu AÇILMAZ.**"* Kişi ekstresi bir **görünümdür**, ayrı defter
değildir.

"Kişi/daire arası cari virman" bu kararla doğrudan kesişir:

- **Daire → daire** aktarım ADR-0010'la uyumludur; cari birimi zaten dairedir.
- **Kişi → kişi** aktarım ise ADR-0010'un açıkça reddettiği şeyi gerektirir:
  kişinin kendi bakiyesi olmalıdır ki devredilebilsin. Bugün kişinin bakiyesi
  yoktur — `borc_sorumlusu` üzerinden **türetilir**.

Dolayısıyla bu bölümün ilk sorusu teknik değil kavramsaldır: **kişi/daire
arası virman, borcun SAHİBİNİ mi değiştiriyor, yoksa SORUMLUSUNU mu?**

- Sorumluyu değiştirmek `borc_sorumlusu` snapshot'ına dokunur — ve o snapshot
  bilinçli olarak **tarihseldir**: kiracı taşınınca geçmiş borç eski kiracıda
  kalır. Sessizce değiştirilirse geçmiş ekstreler değişir.
- Sahibi değiştirmek cari birimini değiştirmek demektir; ADR-0010 buna izin
  vermez.

Somut örnek — daire devri: yeni malik eski malikin borcunu devralır mı?
KMK md. 22 müteselsil sorumluluk der, ama bu **borcun sahibinin değişmesi**
değildir. Bu ayrım netleşmeden model kurulamaz.

### KARŞILAŞTIRMA: kişi bazlı cari ile daire bazlı cari

İncelenen ürün kişi bazlı cari tutuyor ve **kişiden kişiye bakiye aktarımına**
izin veriyor. BNOS'ta ADR-0010 ile **aksi** karar verildi: cari = bağımsız bölüm.

**★ Bu ekran ADR-0010'un gerekçesini GÜÇLENDİRİYOR — değiştirmiyor.**

Senaryo: kiracı taşındı, geçmiş borcu var. Kişi bazlı bir sistemde o borç
kişide durur ve virmanla başkasına aktarılabilir. Aktarıldığı anda:

- **Geçmiş ekstre değişir.**
- **Tebligat delili dayanaksız kalır** — kime tebliğ edildiği ile kimin
  borçlu göründüğü uyuşmaz.
- **İcra takibi çöker.**

BNOS modelinde borç **daireye** bağlıdır; kimin sorumlu olduğu **döneme**
bağlıdır ve **tarihseldir** (`borc_sorumlusu` snapshot'ı). Bu, aylardır
korunan ilkeyle tutarlıdır: kiracı Mart'ta taşınırsa Şubat borcu eski
kiracıda kalır.

**★ Bu bir kısıt değil, ÜRÜN ÖZELLİĞİDİR:**

> **Borcun kime ait olduğu sonradan değiştirilemez.**

İcra takibi yapan bir yönetim için bu gerçek bir güvencedir ve rakiplerden
savunulabilir bir farktır. "Yapamıyoruz" değil, "bilerek yapmıyoruz" —
gerekçesi mahkemede anlatılabilir olandır.

### Karşılanması gereken ihtiyaç — reddetmiyoruz, farklı çözüyoruz

Kişi bazlı virmanı reddetmek **ihtiyacı ortadan kaldırmıyor**. Gerçek senaryo:
bir kişiden gelen **toplu tahsilatın kalemlere dağıtılması** (icra, aidat,
doğalgaz, su…).

Bu BNOS modelinde de mümkündür: kişiden kişiye aktarım yok, **tek dairenin
borç kalemleri arasında tahsis** var. Bu, D bölümünün konusudur.

---

## D · KALEM BAZLI TAHSİS — tek kişinin/dairenin kalemleri arası

İncelenen ekranda "Hesap Türü: Kişi" ile görülen satırlar **kişiden kişiye
aktarım değildir**: tüm satırlar aynı kişi, aynı daire; değişen yalnızca
**kategoridir**. Yani tek kişinin kalemleri arasında tahsis.

### ★ DOĞRULAMA SONUCU: BU YETENEK ZATEN VAR — eksik değil

Soru şuydu: *bir tahsilatı birden çok borç kalemine ELLE dağıtma yolu var mı,
yoksa yalnızca otomatik FIFO mu?*

**Elle dağıtım ASIL YOLDUR; otomatik FIFO yalnızca bir öneridir.**

| Bulgu | Kanıt |
|---|---|
| Tahsilat **zorunlu** olarak bir tahsis **dizisi** alır | `TahsilatEkleDto.tahsisler!: TahsisDto[]` — [tahsilat.dto.ts](../../../backend/src/modules/tahsilat/dto/tahsilat.dto.ts) |
| Her tahsis satırı: hangi borç, hangi pay, ne kadar | `TahsisDto { borcId, borcSorumlusuId?, tutar }` |
| Tahsis toplamı tahsilata **eşit olmak zorunda** | `POST /tahsilat` açıklaması: *"Eksik olsaydı paranın bir kısmı hiçbir borca sayılmaz… kasada duran ama defterde olmayan para"* |
| Otomatik FIFO **hiçbir şey yazmaz** | `POST /tahsilat/tahsis-onerisi` — *"Otomatik tahsis önerisi — HİÇBİR ŞEY YAZMAZ"* ([tahsilat.controller.ts:125](../../../backend/src/modules/tahsilat/tahsilat.controller.ts#L125)) |
| Öneri **kişi bazlı** daraltılabilir | `tahsisOnerisi(tutar, bolumId, principal, kisiId?)` ([makbuz.query.service.ts:378](../../../backend/src/modules/tahsilat/makbuz.query.service.ts#L378)) |
| Hisseli mülkiyette **pay bazında** tahsis | `borcSorumlusuId` — *"bir malik kendi payını ödediğinde ötekilerin borcu AÇIK kalmalıdır"* |
| Tahsis **tek daireye kilitli DEĞİL** | Borçlar yalnızca `id` + `tenantId` ile okunur; bölüm süzmesi yok ([tahsilat.command.service.ts:78](../../../backend/src/modules/tahsilat/tahsilat.command.service.ts#L78)) — aynı kişinin farklı dairelerindeki borçlar tek tahsilatla kapatılabilir |

Yani D bölümünün işi bu motoru **yazmak değildir**. Motor var, kuralları
sıkı ve gerekçeleri yazılı.

### D'nin gerçek işi

> **D bölümünün eksiği motor değil, ARAYÜZDÜR. Yetenek API'de mevcut,
> kullanıcı erişemiyor.**

#### 1. Ekran yok — demoda gösterilecek olan bu

Bir tahsilatı kalemlere dağıtan ekran. Motor hazır; eksik olan tek şey
kullanıcının ona ulaşabilmesi.

#### 2. AVANS — reddetme KORUNUYOR, bilinçli karar

Mevcut davranış (borcu aşan ödeme reddedilir) **doğrudur**. Gerekçe burada
yazılıdır ki ileride *"neden avans yok"* sorusu cevaplı olsun:

Avans kabul edilirse para defterde durur ama **hangi borca ait olduğu
belirsizdir**. Gelecek dönem tahakkuku geldiğinde otomatik mi kapatacak,
elle mi — ikisi de sorunludur:

- **Otomatikse** borçlunun beyan hakkı çiğnenir (TBK md. 101: borçlu hangi
  borcunu ödediğini beyan eder).
- **Elleyse** unutulur ve sakin *"ödedim ama borçlu görünüyorum"* der.

**İhtiyaç gerçektir ama karşılığı avans değildir.** Sakin yıllık peşin
ödemek istiyorsa sıra şudur: **önce ileri dönem tahakkuku oluşturulur, sonra
tahsil edilir.** Borçsuz para kabul edilmez.

> **★ DOĞRULANDI — ileri dönem tahakkuku BUGÜN MÜMKÜN.**
>
> Tahakkuk motorunda gelecek dönemi engelleyen hiçbir kural yoktur. Tek tarih
> kuralı `vade >= donem`'dir
> ([tahakkuk.command.service.ts:104](../../../backend/src/modules/tahakkuk/tahakkuk.command.service.ts#L104));
> `bugun()` ile karşılaştırma yapılmaz. Dönem kilidi yalnızca **KAPALI**
> (geçmiş) dönemleri engeller, ileriye dönük bir sınır yoktur.
>
> Ampirik kanıt: ölçüm turlarında `2026-09`, `2026-10`, `2027-01` dönemleri
> için tahakkuk koşturuldu ve hepsi `201` döndü.
>
> Yani "önce tahakkuk, sonra tahsilat" sırası bugün uygulanabilir — yeni
> yetenek gerekmiyor. Açık kalan: bu **bilinçli** mi, yoksa henüz
> düşünülmemiş bir serbestlik mi? İleri dönem tahakkukuna bir üst sınır
> (örneğin içinde bulunulan mali yıl) gerekir mi?

#### 3. Kişinin TÜM daireleri — gerçek eksik, ama dikkatli açılmalı

`GET /tahsilat/borclar/:bolumId` **daire** bazlıdır; `tahsisOnerisi`
`kisiId` ile daraltabiliyor ama `bolumId`'yi hâlâ **zorunlu** istiyor.
Birden çok dairesi olan kişinin tüm açık borçlarını veren uç **yoktur**.
Tahsis motoru bunu destekliyor, **sorgu tarafı desteklemiyor**.

> ⚠️ **TUZAK: `bolumId` zorunluluğunu kaldırmak KAPSAM KISITINI GEVŞETME
> riski taşır.** Kişinin farklı **projelerde** daireleri olabilir. Yeni uç,
> RLS'in izin verdiğinden **fazlasını döndürmemelidir** — satır kapsamı
> (ADR-0011) tam da bu sınıf sızıntı için kurulmuştu.

Cevaplanacak sorular:

- Uç **proje bazlı** mı kalmalı (`tenantId` zaten kapsamda), yoksa **çok
  projeli** görünüm gerekli mi?
- Çok projeli ise **hangi rol** görebilir? Yönetim firması kullanıcısı,
  mandası olan projelerde görebilir mi (ADR-0009 açık devir)?
- Tek bir tahsilat **farklı projelerin** borçlarına tahsis edilebilir mi?

  > **★ Ön değerlendirme: HAYIR.** Her proje ayrı bütçedir ve para fiziksel
  > olarak farklı hesaplara girer; bir projenin kasasından ötekinin borcunu
  > kapatmak iki projenin defterini birbirine karıştırır. Ayrıca tahsilat
  > `tenantId` bağlamında yazılır — çok projeli tahsis, tenant izolasyonunun
  > kendisini delerdi (ADR-0002). **Doğrulanması gereken:** bu yalnızca
  > teknik bir sonuç mu, yoksa muhasebe/hukuk açısından da zorunlu mu?

#### 4. Kategori gruplaması — ARAYÜZ KARARI, ADR konusu değil

İncelenen üründe satırlar "kategori"ye göre ayrışıyor; BNOS'ta karşılığı
`giderTuruKodu`dur. Gruplama biçimi **demo ekranı tasarımında** ele
alınacaktır; burada karara bağlanmaz.

---

## TASARIM DERSLERİ — incelenen ürün ekranlarından

Bunlar **gözlemlerdir**; hangisinin uygulanacağı karar konusudur.

### a) Denge kontrolü ekranın MERKEZİNDE olmalı

Borç toplamı = alacak toplamı, **fark görünür**, sıfır olmadan kaydedilemez.

**Bizde bu ZATEN KURALDIR** — tahsis toplamı tahsilat tutarına eşit olmak
zorunda; eşit değilse istek reddedilir. Eksik olan, kuralın **ekranda
görünür** olmasıdır: kullanıcı farkı kaydetmeye çalışırken değil, **yazarken**
görmelidir.

### b) Virman = ÇOK SATIRLI FİŞ, "A'dan B'ye" değil

★ Bu gözlem, §A'daki **tek fiş** önerisiyle bağımsız olarak **aynı sonuca
varıyor** — doğrulama kanıtı olarak not düşülür. İki bacağı ayrı fişlere
bölmek yalnızca bizim modelimizde değil, yerleşik uygulamada da yanlış
sayılıyor.

### c) ÜÇ AYRI ZAMAN — biri eksik

| Zaman | Ne işe yarar | Bizde |
|---|---|---|
| **Muhasebe tarihi** | Dönem kilidi buna bakar | ✅ `YevmiyeFisi.tarih` (DATE) |
| **Belge tarihi** | Dayanağın kendi tarihi (fatura, karar, dekont) | ❌ **YOK** |
| **İşlem/kayıt anı** | Kaydın ne zaman girildiği | ✅ `olusturulmaTarihi` · `islenmeAni` |

> **★ BULGU: belge tarihi alanı yok.** `YevmiyeFisi`'nde `fisNo`, `tarih`,
> `kaynakTipi`/`kaynakId` var; dayanak belgenin **kendi tarihi ve numarası**
> tutulmuyor. Geçen ayın faturası bu ay kaydedilirse ikisi ayrışır ve bugün
> bu ayrım **kaydedilemiyor**.
>
> Bu, `referans` ve icra dosya numarasıyla aynı ailedendir: dayanak bilgisi
> serbest metne (`aciklama`) sıkışıyor. Açık soru: belge tarihi + belge no
> ayrı alanlar mı olmalı, yoksa gelecekteki bir belge varlığına bağ mı?

### d) TASLAK — virman taslak olabilmeli mi?

`YevmiyeFisi.durum` varsayılanı zaten `TASLAK`'tır ve `taslakMizanaGirer`
varsayılanı `false`'dur: **taslak fiş mizana girmez.**

- **Taslak lehine:** yarım kalan iş kaybolmaz.
- **Taslak aleyhine:** taslakta kalan virman bakiyeyi etkilemez, yönetici
  *"yaptım"* sanır — **sessiz hata sınıfı**.

> **Öneri (karar ürün sahibinde): virman TASLAK kalabilsin, ama taslak olduğu
> ekranda ve listede AGRESİF biçimde görünsün.**
>
> Gerekçe: taslağı yasaklamak yarım işi kaybettirir ve kullanıcı aynı işi
> baştan yapar. Asıl risk taslağın **görünmez** olmasıdır, var olması değil.
> Somut öneri: virman listesinde taslak satırlar ayrı renkte ve "işlenmemiş"
> rozetiyle, **varsayılan süzgeçte görünür** (gizli değil); ayrıca yönetici
> panelinde "işlenmemiş fiş" sayacı.
>
> ⚠️ Karşı görüş kayda geçsin: taslak hiç olmasaydı bu sessiz hata sınıfı
> **kurgudan** kalkardı. Görünürlüğe dayanan çözüm, disipline dayanır —
> bu depoda üç kez gördük ki disiplin tek başına yetmiyor.

### e) Sebep kodu

İncelenen ekranlarda yalnızca serbest açıklama var, sebep kodu **yok**.
Bizim önerimiz ve gerekçesi yukarıdaki **"ORTAK · VİRMAN GEREKÇESİ"**
bölümündedir: `sebepKodu` zorunlu, kodlar **veri**, her tür kendi geçerli
listesini taşır (R6).

### f) Virman ARANABİLİR KAYITTIR

Liste kolonları: evrak no · tarih · satır sayısı · borç · alacak ·
borçlu/alacaklı hesap · açıklama.

> **★ Açık soru: çok satırlı fişte "borçlu hesap" kolonu nasıl tekilleşir?**
>
> Üç seçenek görülüyor, hiçbiri seçilmedi:
>
> 1. **Tekilleştirme.** Tek borçlu hesap varsa adı, birden fazlaysa
>    *"3 hesap"*. Basit; ama en sık aranan bilgi çoklu fişte kaybolur.
> 2. **Baskın hesap.** En büyük tutarlı hesap, yanında `+2`. Okunur; ama
>    "baskın" kavramı uydurmadır ve yanıltabilir.
> 3. **Satır bazlı liste.** Arama sonucu fiş değil **satır** döndürür; aynı
>    fiş birden çok satırla görünür. Arama doğru çalışır; ama "kaç virman
>    yapıldı" sorusu kolonlardan okunamaz.
>
> Bu bir arayüz kararı gibi görünse de **veri modelini etkiler**: (3)
> seçilirse listeleme ucu satır bazlı bir sorgu ister. Bu yüzden ADR'de
> tutuldu.

---

## Karar

**Verilmedi.**

## Gerekçe

**Yazılmadı.**
