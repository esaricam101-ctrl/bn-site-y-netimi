# Hesap Planı Mantığı — gerçek saha planı ile BNOS karşılaştırması

**Kaynak:** ürün sahibi tarafından çözümlenen gerçek bir site hesap planı
(681 satır). Bu belge **veri aktarımı değildir**; plandan çıkarılan kurallar
ile BNOS'un bugünkü durumu karşılaştırılır.

**Yöntem:** her madde üç bölümdür — *gerçek plandaki durum* · *bizdeki durum
(ölçülmüş, kod referanslı)* · *fark ve öneri*.

⚠️ **Bu belgede kod değiştirilmedi.** Kararlar ürün sahibine aittir; sonda
"şimdi uygulanmalı" ve "karar bekliyor" ayrımı önerilir.

---

## 1. Dört kademeli hiyerarşi — hareket yalnızca en altta

### Gerçek plan

| Kademe | Hane | Adet | Hareket |
|---|---|---|---|
| Sınıf | 1 | 8 | ⛔ toplayıcı |
| Grup | 2 | 32 | ⛔ toplayıcı |
| Ana | 3 | 109 | ⛔ toplayıcı |
| Muavin | 6/7/8 | 532 | ✅ **hareket burada** |

### Bizdeki durum

Kademe **adlandırması yok** — `hesapKademesi` diye bir alan bulunmuyor.
Ama kuralın kendisi **üç ayrı mekanizmayla zaten uygulanıyor**:

1. **Ağaç yapısı var.** `Hesap.ustHesapId` özyinelemeli ilişki
   (`schema.prisma` · `HesapAgaci`). Derinlik serbest, dört kademeyle
   sınırlı değil.
2. **Hareket yasağı var ve zorlanıyor.** `Hesap.fisKesilebilirMi` alanı;
   fiş yazarken domain katmanında kontrol ediliyor:

   ```ts
   if (!s.fisKesilebilirMi) {
     throw new DogrulamaHatasi(
       `${sira}. satirdaki hesaba fis kesilemez (ara/baslik hesap).`,
       'Alt hesaplardan birini secin.',
     );
   }
   ```

   [`shared/apartman-domain/src/muhasebe/muhasebe.ts:107`](../shared/apartman-domain/src/muhasebe/muhasebe.ts)

3. **Üst hesap OTOMATİK toplayıcıya dönüyor.** Bir hesaba alt hesap
   eklendiğinde üst hesabın `fisKesilebilirMi` bayrağı `false` yapılıyor
   ([`hesap-plani.service.ts:146-149`](../backend/src/modules/muhasebe/hesap-plani.service.ts)).
   Yani "ana hesaba fiş yazılabiliyor mu" sorusunun cevabı **hayır** ve bu
   elle işaretlemeye bırakılmamış.

Ayrıca `seviye` alanı **koddan türetiliyor** (`100` → 0, `100.01` → 1) ve
arayüz girintilemede kullanıyor.

### Fark ve öneri

**Mizan bozulmuyor** — sorulan risk (üst hesaba yazılmış fişin çift
sayılması) bugün gerçekleşemez.

⚠️ **AMA BU KURALIN TESTİ YOK.** Depoda ara hesaba fiş satırı yazmayı
deneyen tek bir sözleşme testi bulamadım. `fisKesilebilirMi: false` yalnızca
CT-23'te *parametre seçimi* bağlamında kullanılıyor, fiş yazma bağlamında
değil. Kural doğru yazılmış ama **korumasız**: yarın `fisiDogrula`
değiştirilse hiçbir test kırmızı olmaz.

★ **Öneri (şimdi uygulanmalı):** negatif sözleşme testi — ana hesaba fiş
satırı yazma denemesi reddedilmeli. İstenen tam olarak buydu.

★ **`hesapKademesi` enum'u — ÖNERMİYORUM.** Gerekçe: kademe bilgisi bugün
**türetilebilir** (alt hesabı var mı → toplayıcı; kod uzunluğu → seviye).
Ayrı bir enum eklemek aynı olguyu iki yerde tutmak olur ve ikisi ıraksar —
"kademe ANA ama alt hesabı yok" gibi tutarsız kayıtlar mümkün hâle gelir.
TDHP'nin 1/2/3/6-hane düzeni bir **adlandırma geleneğidir**, veri modeli
kısıtı değil. Bizim ağacımız daha genel: dört kademeyle sınırlı değil.

Karşı görüş kayda geçsin: raporlama "grup toplamı" isterse kademe adı
gerekebilir. O zaman da koddan türetilmesi yeterli olmalı.

---

## 2. TDHP iskeleti sabit, muavin kademe projeye özgü

### Gerçek plan

Sınıf/grup/ana adları standart TDHP. Yalnızca muavin kademe projeye göre
açılıyor.

### Bizdeki durum

Tohum hesap planı **13 düz hesap** — kademe yok, `ustHesapId` hiç
kullanılmıyor ([`seed.ts` · `HESAP_PLANI`](../database/seeds/seed.ts)):

```text
100 Kasa · 102 Bankalar · 120 Aidat Alacakları · 255 Demirbaşlar
320 Tedarikçiler · 340 Alınan Avanslar · 349 Alınan Ortak Gider Avansları
500 Yenileme Fonu · 590 Dönem Net Sonucu · 600 Aidat Gelirleri
602 Gecikme Tazminatı · 770/771/772 Giderler · 781 Yansıtma
```

### Fark ve öneri

Düz plan, ağaç yapısının hiç sınanmadığı anlamına geliyor: `ustHesapId`
şemada var, tohumda kullanılmıyor, dolayısıyla otomatik toplayıcıya dönüşme
mekanizması demo veride hiç tetiklenmiyor.

★ **Öneri (karar bekliyor):** tohuma **standart TDHP iskeleti** (sınıf/grup/
ana) + projeye özgü muavinler kurulsun. Bedeli: tohum büyür, mevcut hesap
kodları değişir (`100` → `100.01` gibi) ve **hesap kodunu varsayan her yer
kırılır**.

⚠️ Bu depoda kural şudur: hesaplar `kod` ile değil `ozellik` ile bulunur
(§33 kural 3). Eğer bu kurala her yerde uyulmuşsa kod değişikliği güvenlidir
— **ama bu ölçülmeden yapılmamalı.** Ölçüm önerisi: `kod: '1` gibi sabit kod
araması yapan kaç yer var?

---

## 3. ★ Aidat 600'de, 34x'te değil — ADR-0017 ile çelişiyor

### Gerçek plan

```text
600.002 Aidat        3.701 hareket    -17.615.222 TL
34 ALINAN AVANSLAR   tek muavin       bakiye SIFIR
```

Yani avans hesabı **açılmış ama kullanılmamış**; aidat doğrudan gelir
yazılıyor.

### Bizdeki durum

ADR-0017 · K1 kararı **34x (alınan avanslar)** yönünde. Tahakkuk fişi
`120 borç / 349 alacak` yazıyor. Gerekçe KMK md. 20 lafzı: aidat
*"toplanacak avans"*tır, yönetimin kâr amacı ve tüzel kişiliği yoktur.

### Fark

**Fark bilinçlidir ve BNOS kararı savunulabilir.** Ancak sahadaki uygulama
ters yönde ve bu bir *"biz haklıyız"* meselesi değil, bir **beklenti**
meselesi: planı devralan muhasebeci aidatı `600`'de görmeyi bekler.

★ **Karar ürün sahibinde. Kod değiştirilmedi.** ADR-0017'ye bulgu olarak
işlenmesi önerilir:

> Gerçek saha uygulaması aidatı `600` gelir hesabında tutuyor. BNOS kararı
> `34x` avans yönündedir ve KMK md. 20 lafzıyla tutarlıdır. Fark
> bilinçlidir; ancak muhasebeci bu plana bakınca aidatı `600`'de görmeyi
> bekler.

Not: bu soru **ADR-0015'ten (yıl sonu farkı nereye düşer) ayrı düşünülemez.**
Aidat `600` gelir yazılırsa dönem sonucu doğal olarak kâr/zarar üretir ve
özkaynağa kapanır; `349` avans yazılırsa dönem sonu farkı ayrı bir karar
konusu olarak kalır. **İki soru tek cevaba bağlı.**

---

## 4. ★ 600 ↔ 740 aynalaması — yansıtma çifti

### Gerçek plan

11 kalem hem gelirde hem giderde açılmış: Doğalgaz · Su · Elektrik · Ortak
Alan Elektrik · Sayaç Okuma · Demirbaş · Kıdem Fonu · Doğalgaz Güvence
Bedeli…

Mantık: gider `740`'ta oluşur, sakinlere yansıtılınca `600`'de gelir olarak
kaydedilir.

### Bizdeki durum

`GiderTuru.muhasebeHesapId` **tek yön** ve adı bilinçli olarak
`gelirHesapId` değil ([`schema.prisma:38-48`](../database/prisma/schema.prisma)):

> *"Ad `gelirHesapId` DEĞİL: `349` bir gelir hesabı değildir ve alan adı
> hesabın niteliğini belirlemez — onu hesap planı belirler."*

Hesap planında `781 Gider Yansıtma Hesabı` (`ozellik: YANSITMA`) tanımlı ve
dönem sonu yansıtma fişi üretiliyor, ama **karşı hesap kullanıcının
seçimidir ve otomatik tahmin edilmiyor**.

### Öneri — istenen gerekçelendirme

**İki alan (`giderHesapId` + `gelirHesapId`) yerine `yansitilirMi` bayrağı +
tek eşleme ÖNERMİYORUM. Üçüncü bir yol öneriyorum.**

| Seçenek | Artı | Eksi |
|---|---|---|
| (a) İki ayrı alan | Açık, sorgulanabilir | `349` yolunda `gelirHesapId` **anlamsız** kalır; her gider türünde iki hesap seçtirmek kurulumu ağırlaştırır |
| (b) `yansitilirMi` bayrağı + tek eşleme | Hafif | Yansıtma **hangi** gelir hesabına gideceğini söylemez; motor tahmin etmek zorunda kalır — bu depoda yasak |
| (c) **`yansitmaHesapId` — isteğe bağlı ikinci eşleme** | Bayrak ile hesabı **tek alanda** birleştirir: dolu ise yansıtılır ve hedefi bellidir | Ek alan |

★ **(c) öneriliyor.** Gerekçe: `yansitilirMi = true` ama hedef hesap boş
durumu (b)'de mümkündür ve motoru tahmine zorlar. (c)'de böyle bir ara durum
**yoktur** — alan doluysa hem "yansıtılır" hem "nereye" bilinir. Bu, aynı
olguyu iki alanda tutmama ilkesinin (madde 1'deki kademe tartışmasının)
aynısı.

⚠️ **Ama önce daha temel bir soru var:** madde 3 çözülmeden bu alan
tasarlanamaz. Aidat `349`'da mı `600`'de mi duracak sorusu, yansıtmanın
gerekli olup olmadığını da belirler. `600` yolunda yansıtma çifti doğal;
`349` yolunda aidat zaten gelir yazılmadığı için 600↔740 aynalaması yalnızca
**aidat dışı** yansıtılan kalemler için gerekir.

★ **Karar bekliyor — madde 3'ten sonra.**

---

## 5. Cari = daire, ama metin içinde

### Gerçek plan

```text
120.0001  "ABDULLAH DEMİR (D2-122)"
```

Daire kodu hesap **adına gömülü**. Malik değişince hesap adı elle
düzeltiliyor.

### Bizdeki durum

ADR-0010: cari birim **bağımsız bölümdür**, kişi değil. Borç `bolumId`'ye
bağlanır; sorumlu kişiler `borcSorumlusu` üzerinden **ilişkiyle** çözülür ve
`cozumlemeTarihi` ile anlık görüntü alınır.

### Fark

**Bizimki kesinlikle daha iyi ve bu bir doğrulamadır.** Sahadaki yöntemin üç
kusuru var:

1. Malik değişince **hesap adı elle düzeltilir** — geçmiş kayıtlar yeni
   malikin adıyla görünmeye başlar; kim hangi dönemde borçluydu sorusu
   cevapsız kalır.
2. Hisseli mülkiyet ifade edilemez — tek ada tek hesap.
3. Kiracı/malik ayrımı (KMK md. 20 vs 22) taşınamaz.

★ **Öneri (şimdi uygulanmalı, düşük maliyet):** ADR-0010'a **saha
doğrulaması** notu eklensin. Bir kararın gerçek bir uygulamada karşılaşılan
kusuru önlediğini göstermek, kararın kendisi kadar değerlidir.

---

## 6. İşaret kuralı ve denge

### Gerçek plan

Tek kolon bakiye: **borç pozitif, alacak negatif.** Tüm hesapların toplamı
`0,00` — tam denk.

### Bizdeki durum

**Farklı gösterim:** `bakiye` her zaman pozitif metin, yön ayrı alanda —
`bakiyeYonu: 'BORC' | 'ALACAK'`
([`defter.query.service.ts:56-64`](../backend/src/modules/muhasebe/defter.query.service.ts)).
Bakiye **doğal yöne göre** işaretleniyor: `100 Kasa` borç bakiyeli çalışır,
`300 Krediler` alacak bakiyeli.

Mizan `denkMi: borcToplam.equals(alacakToplam)` alanını **yanıtta
döndürüyor** ve gizlemiyor ([`defter.query.service.ts:402`](../backend/src/modules/muhasebe/defter.query.service.ts)).

### Fark ve öneri

Gösterim farkı **kusur değil**: işaretli tek kolon ile yön+pozitif tutar
bilgi olarak denktir. Bizimki ekranda daha okunur, tek kolon dışa aktarımda
daha kolay.

⚠️ **AMA `denkMi` HİÇBİR TESTTE ÖLÇÜLMÜYOR.** Depoda `denkMi` geçen tek bir
sözleşme testi yok. Alan hesaplanıyor, yanıtta dönüyor, arayüz gösteriyor —
ve **yanlış hesaplansa kimse görmez**.

★ **Öneri (şimdi uygulanmalı):** *"toplam sıfır"* en basit bütünlük
kontrolüdür ve test olmalıdır. Tohumla kurulmuş projede mizan çekilip
`denkMi === true` ve `borcToplam === alacakToplam` ölçülsün. CT-21'in
`mutabikMi` kanıtının kardeşi.

---

## 7. `999` geçici hesap — eşleştirilememiş kalemler

### Gerçek plan

Nazım hesap, **123 hareket, -24.250 TL.** Ana hesap olduğu hâlde hareket
taşıyor — kendi kurallarının istisnası.

### Bizdeki durum

**Karşılığı yok — ve bu bilinçli görünüyor.** Eşleşmeyen banka hareketi
hiçbir yere yazılmıyor: banka ekstresi satırları `eslesmeyenSayisi` /
`kalanEslesmeyen` / `mutabikMi` alanlarıyla **eşleşmemiş olarak duruyor**
([`banka.controller.ts:454-538`](../backend/src/modules/banka/banka.controller.ts)).
Deftere giren bir "geçici" kayıt üretilmiyor.

### Fark

Bizimki **daha temiz**: eşleşmeyen hareket deftere hiç girmiyor, dolayısıyla
mizanı kirletmiyor ve "999'da ne var" sorusu doğmuyor. Sahadaki `999` hesabı
zaten kendi kuralını çiğniyor (ana hesap, hareket taşıyor) — bu bir çözüm
değil, bir kaçış kapısı.

⚠️ **Yine de bir eksiği işaret ediyor:** bizde eşleşmeyen hareket
**görünür** ama süresiz bekleyebilir. Sahada `999`'un varlığı şunu gösterir:
gerçek hayatta bazı hareketler hiçbir zaman eşleşmez ve bir yere yazılması
gerekir.

★ **Not düşüldü, şimdi yapılmayacak:** ay kapanışında eşleşmeyen hareketin
ne olacağı tanımsız. ADR-0015 (dönem kapanışı) kapsamında ele alınmalı.

---

## 8. Özkaynak hesapları sıfır

### Gerçek plan

`570 / 580 / 590 / 591` **hepsi sıfır** → dönem kapanışı hiç yapılmamış.

### Bizdeki durum

ADR-0015 (yıl sonu artı/eksi bakiye nereye düşer) **hâlâ açık**. Tohuma
4 Ağustos 2026'da `590 Dönem Net Sonucu` eklendi — ama **seçili değil**:
hesabın varlığı kapanış kuralını belirlemez.

### Fark

Bu madde bir *fark* değil, bir **teyit**: konu sahada da çözülmemiş. Yani
ADR-0015'in açık kalması bizim eksiğimiz değil, sektörün çözmediği bir
soruyu erteliyoruz.

★ Bu, kararı vermemek için gerekçe **değildir** — aksine, referans
alabileceğimiz bir uygulama olmadığını gösterir. Karar kendi
gerekçemizle verilmeli.

---

## Özet — ne şimdi, ne karar bekliyor

### ✅ Şimdi uygulanmalı (karar gerektirmez, düşük risk)

| # | İş | Gerekçe |
|---|---|---|
| 1 | **Ara hesaba fiş yazma negatif testi** | Kural doğru yazılmış ama korumasız; `fisiDogrula` değişse hiçbir test kırmızı olmaz |
| 6 | **Mizan `denkMi` / toplam-sıfır testi** | Alan hesaplanıyor ve yanıtta dönüyor ama yanlış hesaplansa kimse görmez |
| 5 | **ADR-0010'a saha doğrulama notu** | Belge işi; kararın gerçek bir kusuru önlediğini kayda geçirir |
| 3 | **ADR-0017'ye `600` bulgusunun yazılması** | Bulgu kaydı — karar değil |

### ⏳ Karar bekliyor (ürün sahibine ait)

| # | Soru | Bağımlılık |
|---|---|---|
| **3** | Aidat `349` avansta mı kalsın, `600` gelire mi taşınsın? | **ADR-0015 ile aynı cevaba bağlı** — ayrı cevaplanamaz |
| **4** | Yansıtma eşlemesi: `yansitmaHesapId` (öneri) mi, iki ayrı alan mı, bayrak mı? | **Madde 3'ten sonra** — aidat 600'e taşınırsa tasarım değişir |
| 2 | Tohum TDHP iskeletine geçsin mi? | Önce ölçüm: sabit hesap kodu varsayan kaç yer var? |
| 1 | `hesapKademesi` enum'u eklensin mi? | Öneri: **hayır**, türetilebilir olan saklanmaz |

### 📌 Not düşüldü, şimdi yapılmayacak

- **Madde 7** — ay kapanışında eşleşmeyen banka hareketinin akıbeti tanımsız;
  ADR-0015 kapsamında.
- **Madde 8** — özkaynak/kapanış zaten ADR-0015'in konusu.

### ★ Sıralama önerisi

Madde **3 → 4** zinciri en kritik olanıdır ve ADR-0015 ile birlikte tek
oturumda cevaplanmalıdır: üçü aynı sorunun farklı yüzleridir — *aidat gelir
mi avans mı, dönem farkı nereye düşer, yansıtma nasıl kaydedilir.* Ayrı ayrı
karara bağlanırsa birbiriyle çelişen üç karar çıkar.
