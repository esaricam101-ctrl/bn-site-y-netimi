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

## 5 · Bu ADR karara bağlanmadan yapılmayacaklar

- Virman uygulaması (ADR-0016) — deftere yazan ikinci mekanizma
- `kontrol-mutabakati` raporunun eşiğe bağlanması — bugün her projede `false`
- Tohuma **elle yevmiye fişi yazmak** ⛔ ürünün yapamadığı bir şeyi demoda
  göstermek olurdu; ayrıca yalnızca tahsilatı muhasebeleştirmek 120'yi
  alacaklandırıp farkı **büyütür**
