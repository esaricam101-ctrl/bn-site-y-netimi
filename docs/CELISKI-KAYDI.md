# Çelişki Kaydı

Verilmiş bir kararın **başka bir kararla ya da yakında gelecek bir özellikle
çatıştığı** yerler. Bunlar hata değildir: kararlar kendi bağlamlarında
doğrudur, ama birlikte uygulanamazlar.

> **Neden ayrı belge:** yol haritası *"ne eksik"* der, ADR'ler *"ne karar
> verildi"* der. Bu belge *"hangi iki doğru birbirini kesiyor"* sorusunu
> tutar. Çatışma fark edildiği anda yazılır; çözüldüğünde ilgili ADR'ye
> taşınır ve buradan **gerekçesiyle** silinir.
>
> ⚠️ **Buraya yazılan şey bir işi engellemez.** Amaç, çatışmanın **hangi
> sprintin ilk gününde** karşımıza çıkacağını önceden bilmek — o gün karar
> vermek pahalıdır.

---

## Ç-1 · Avans reddi ↔ banka kanalı

**Durum:** açık · **Karşımıza çıkacağı an:** banka hareketi eşleştirme
sprintinin **ilk günü** · **Kapsam:** `[ORTAK]`

### Çatışan iki karar

| | Karar | Kaynak |
|---|---|---|
| A | **Avans reddedilir.** Borcu aşan ödeme kabul edilmez; hangi borca ait olduğu belirsiz para mutabakatı bozar ve TBK m.101 beyan hakkını çiğner. | [MENU-HARITASI §3](MENU-HARITASI.md) · uygulanıyor (CT-26 · 4) |
| B | **Banka hareketi reddedilemez.** Hesaba 2.000 TL yatmıştır, borç 1.900 TL'dir. Fiziksel olarak gerçekleşmiş bir para hareketine "kabul etmiyoruz" denemez. | Banka kanalı (henüz açılmadı) |

### Neden bugün sorun değil

Tahsilat ekranı **yalnızca NAKİT** kanalını açıyor. Nakitte reddetmek
mümkündür: kasiyer parayı geri verir. Karar bu kanalda **tutarlıdır**.

⚠️ **Kararın kapsamı nakitle sınırlı ve bu sınır hiçbir yerde yazılı
değildi.** Bu kaydın asıl işlevi o sınırı görünür kılmaktır.

### Karar seçenekleri — hiçbiri seçilmedi

1. **Eşleşmeyenler kuyruğu.** Fazla tutar hiçbir borca yazılmaz, ekstre
   satırı *eşleşmemiş* kalır. Bugünkü banka mutabakatı deseniyle uyumlu
   (`eslesmeyenSayisi` zaten var). Bedeli: para deftere hiç girmez, kuyruk
   büyür ve kimse kapatmazsa kalıcı olur.
2. **Avans hesabı.** Fazla tutar bir yükümlülük hesabına yazılır.
   ⚠️ **Hangi hesap olduğu açık:** `340`/`349` mü, `549` mu — bu
   [HESAP-PLANI-MANTIGI.md](HESAP-PLANI-MANTIGI.md) madde 3-4 zincirine
   bağlıdır ve o zincir `[SITE]` kapsamında **ertelendi**.
3. **Kısmi eşleştirme + bakiye askıda.** Hareketin borcu kapatan kısmı
   tahsis edilir, artan kısım askıda kalır. (1) ile (2) arası; askıdaki
   tutarın muhasebe karşılığı yine (2)'deki soruyu doğurur.

★ **Karar banka kanalı açılmadan ÖNCE verilmelidir.** Sonra verilirse
eşleşmiş hareketlerin geriye dönük düzeltilmesi gerekir.

---

## Ç-2 · Gecikme tazminatı ↔ tahsis anının kalan bakiyesi

**Durum:** açık · **Karşımıza çıkacağı an:** gecikme tazminatı motoru
yazıldığı gün · **Kapsam:** `[ORTAK]`

### Çatışmanın kaynağı

Bugün **kalan bakiye zamana bağlı değildir**: borç 1.950 TL ise dün de
bugün de 1.950 TL'dir. Tazminat girdiği anda bu değişir — **kalan sürekli
işler**.

Sonuç: ekranın hesapladığı kalan ile **kaydetme anındaki** kalan farklı
olabilir. Dünkü tahsis ekranı bugün geçersizdir ve fark sessizce eksik
tahsilat üretir.

### Kayda geçen üç alt soru

**(a) Bayat tahsis koruması.** Sunucu, istemcinin gördüğü **hesap
tarihini** de almalı; fark varsa kaydı **reddedip yenilemeli**. Sessiz
eksik tahsilatın tek engeli budur. *(Tahakkuk ekranındaki "bayat önizleme
düşer" korumasının aynı sınıfı.)*

**(b) Referans tarihi hangisi?** Bugün ekranda *"5 gün gecikmiş"* yazıyor
ve bu **BUGÜNE göre** hesaplanıyor — ölçüldü:

```ts
const simdi = bugun();
gecikmisMi: b.vadeTarihi < simdi
```

[makbuz.query.service.ts:354](../backend/src/modules/tahsilat/makbuz.query.service.ts)

⚠️ **Doğrusu tahsilat tarihidir.** Nakit makbuz sahada üç gün sonra sisteme
işlenir; geriye dönük tahsilat girildiğinde iki tarih farklı sonuç verir.
Ekrandaki bilgilendirme de tahsilat tarihine göre yazmalıdır.

★ **Bu ayrım tazminat girmeden önce netleşmeli:** sonra düzeltmek geçmiş
kayıtları etkiler.

**(c) Oran koda gömülmez (R6).** Aylık %5 biliniyor (KMK md. 20/son —
5711 ile %10'dan indirildi) ama **bilinmesi koda girmesini haklı
çıkarmaz**: yönetim planı daha düşük oran belirleyebilir; kanun **üst
sınır** koyar, taban değil. Oran yürürlük tarihli bir parametre
tablosundan okunmalıdır.

⚠️ **ÖLÇÜLDÜ: `mevzuat_parametre` TABLOSU ŞEMADA YOK.** R6 ona atıfta
bulunuyor ama tablo hiç oluşturulmamış. Yani "koda gömme" demek bugün
**yapılacak yer olmadığı** anlamına geliyor; tazminat işinin ilk adımı bu
tablodur, hesap değil.

### Mahsup önceliği — hukuk sorusu

Tazminat mı anapara mı önce kapanır? Bu **mevzuat sorusudur** ve kodda
sabit olmamalıdır.

⛔ **Sessiz belirlenme riski:** bugünkü borç kapatma sırası
(`vade → dönem → kalem kodu → id`,
[tahsis-sirasi.ts](../backend/src/modules/tahsilat/tahsis-sirasi.ts))
aynı vadedeki kalemleri **kalem koduna göre alfabetik** sıralar. Tazminat
bir kalem olarak eklenirse önceliğini **kodunun harfi** belirler ve
**CT-26 o gün yeşil kalarak yanlış şeyi korur.**

★ Tazminat kalemi eklendiğinde `tahsis-sirasi.ts` ve CT-26 **birlikte**
gözden geçirilecek.

---

## Ç-3 · İptal edilmiş makbuzun görünmezliği ↔ "mali kayıt silinmez"

**Durum:** açık · **Karşımıza çıkacağı an:** **BUGÜN ETKİN** — ileri
tarihli değil · **Kapsam:** `[ORTAK]`

### Çatışan iki karar

| | Karar | Kaynak |
|---|---|---|
| A | **İptal edilmiş makbuzların tahsisleri ekstrede YOKTUR.** | `tahsilat.controller.ts` · uygulanıyor (`tahsilat: { durum: 'GECERLI' }`) |
| B | **Mali kayıt SİLİNMEZ, ters kayıtla düzeltilir.** Fiş silme ucu yoktur ve olmayacaktır. | ADR-0003 · `muhasebe.controller.ts` başlığı |

### Somut sonuç

Aynı tarih aralığı iki kez basıldığında **farklı bakiye** çıkar ve fark
ekstrede **görünmez**:

- Denetçi ikisini yan yana koyduğunda açıklama üretemez.
- Kat malikine verilmiş bir ekstre sonradan geçersizleşir ve **neden**
  geçersizleştiği belgelenmemiş olur.
- İptal, mali kaydı fiilen **silmiş** gibi davranır — B'nin yasakladığı şey.

⚠️ Bu, Ç-1 ve Ç-2'den farklı olarak **bugün etkin bir çelişkidir**: iptal
ucu (`POST /makbuzlar/:id/iptal`) yazılmış ve çalışıyor.

### Önerilen çözüm — karar ürün sahibinde

İptal satırı ekstrede **durur**: üstü çizili ya da `İPTAL` etiketli,
**tutarı yürüyen bakiyeye etki etmez**, ve iptal işlemi **ayrı satır**
olarak görünür (ters kayıt mantığının ekstredeki karşılığı).

İsteğe bağlı *"iptalleri gizle"* anahtarı olabilir — ama **varsayılan
görünür** olmalıdır. Bugünkü davranış varsayılanı "gizli" yapmış ve
anahtarı hiç sunmamıştır.

★ Bu bir uç değişikliği gerektirir: `durum: 'GECERLI'` süzgeci
gevşetilip satıra `durum` alanı eklenmelidir.

---

## Kapananlar

*(Henüz yok. Çözülen çatışma ilgili ADR'ye taşınır ve buraya tarihiyle
birlikte tek satır yazılır.)*
