# ADR-0013 · Toplu işlemlerin partilenmesi

**Kapsam:** [ORTAK] — Partileme olcek sorunudur, proje tipine bagli degil.
**Tarih:** 31 Temmuz 2026 (1 Ağustos'ta güncellendi)
**Statü:** 🟡 TASLAK — **desen KABUL EDİLDİ, ayrıntılar açık**
**Öneren:** —
**Onaylayan:** —
**İşlendiği belge:** —
**İlgili:** [ADR-0011](0011-kapsam-ayari-olcek-siniri.md) · D1 `IslemPartisi`

> ⚠️ Bu dosya bilinçli olarak **eksiktir**. İçinde yalnızca cevaplanacak
> sorular vardır. Karar birlikte verilecek; o zamana kadar buraya çözüm,
> tasarım ya da tercih YAZILMAZ.
>
> Dosya adı depo kuralından (`NNNN-kisa-baslik.md`) ayrılıyor; ürün sahibinin
> verdiği ad korundu. Karar kesinleşince ada da karar verilir.

## ⚠️ İLK GEREKÇE — ÖLÇÜMLE ÇÜRÜTÜLDÜ (1 Ağustos 2026)

Bu ADR 31 Temmuz'da şu gerekçeyle açılmıştı:

> `POST /tahakkuk/calistir` 5.000 bölümlük bir sitede **çalışmıyor**. 5 saniyelik
> işlem sınırı doluyor, istek 500 dönüyor ve işlem tümüyle geri alınıyor:
> **sıfır borç, sıfır outbox olayı**. Parti büyüklüğü taraması: 400 bölüm
> 4.789 ms (%96 doluluk), 500 bölüm ❌. Sınır **≈420 bölümde** doluyor.

**Bu gerekçe geçersizdir.** İşlem süresi sınırı yalnızca bu yol için
yükseltildiğinde (5.000 → 110.000 ms) ölçüm şunu verdi:

| ölçek | HTTP | süre | borç satırı | outbox | **ms/bölüm** |
|---|---|---|---|---|---|
| 500 | 201 | 5.032 ms | +500 | +1 | 10,06 |
| 1.000 | 201 | 10.082 ms | +1.000 | +1 | 10,08 |
| 2.000 | 201 | 19.808 ms | +2.000 | +1 | 9,90 |
| **5.000** | **201** | **49.619 ms** | **+5.000** | +1 | **9,92** |

**Doğrusallık hiç bozulmuyor.** Bölüm başına maliyet 500'den 5.000'e kadar
9,90–10,08 ms bandında; 10× ölçekte sapma %1,8. Kırılma noktası yok.

Bu, mimarinin sağlam olduğunun kanıtıdır: dağıtım, sorumluluk çözümü ve borç
yazımı ölçekle doğrusal büyüyor. **420 bölümlük sınır bir tasarım sınırı değil,
tek bir yapılandırma değeriydi.** Eski gerekçe kayıt için burada bırakılıyor.

## Neden hâlâ gerekli — yeni gerekçeler

Partileme kararı düşmedi; **gerekçesi değişti**. Dördü de ölçülmüştür.

### 1. Uzun senkron istek üretim altyapısında KESİLİR

Nginx (1.27, **varsayılan ayarlar**) arkasına konup ölçüldü:

| iş | süre | sonuç |
|---|---|---|
| 5.000 bölüm | 50,7 sn | ✅ 201 — 60 sn varsayılanın altında kaldı |
| 10.000 bölüm | **60,1 sn** | ❌ **504 Gateway Time-out** |

Varsayılan `proxy_read_timeout` 60 sn'dir. Cloudflare 100 sn, çoğu ALB/ingress
30–60 sn kullanır. 5.000 bölüm bugün **payın %85'ini** yiyor; daha yavaş bir
üretim diskinde ya da 30 sn'lik bir vekilin arkasında kesilir.

### 2. Kesilen istek arka planda DEVAM EDİYOR — sessiz ve tehlikeli

10.000 bölümlük iş, 504'ten sonra izlendi (istemci tekrar denemedi):

```text
 10..90 sn · borc=0     · idle in transaction=1  · istemci 504@60,1sn
100 sn    · borc=10000 · idle=20                · istemci 504@60,1sn
```

**Kullanıcı "504 Gateway Time-out" gördü; tahakkuk 40 saniye sonra başarıyla
işlendi.** İstemcinin aldığı yanıt ile veritabanının durumu birbirini
tutmuyor.

### 3. ★ ÇİFT TAHAKKUK — üretilebilir mali veri bozulması

Kullanıcı 504'ü görüp tekrar denerse, tekrar denemesi **ilk işlem henüz commit
etmeden** varır. Mükerrer tahakkuk denetimi ([tahakkuk.command.service.ts
§2](../../../backend/src/modules/tahakkuk/tahakkuk.command.service.ts))
`borc.count()` ile çalışır ve **commit edilmemiş satırları göremez**.

Ölçülen (5.000 bölüm, vekil 30 sn'de kesiyor, tekrar deneme 35. saniyede):

```text
1. deneme  -> 504 @ 30,0 sn   (arka planda sürüyor)
35. sn     -> commit edilmiş borç = 0
2. deneme  -> 201 @ 67,0 sn   (AYNI Idempotency-Key)
SONUÇ      -> borç satırı = 10.000   (beklenen 5.000)
```

**Her daire iki kez borçlandı.** `Idempotency-Key` koruma sağlamadı: başlık
depoda **hiçbir yerde okunmuyor** (`grep -r Idempotency backend/src` → boş).
Tek koruma, commit edilmiş satır sayan mükerrer denetimidir ve commit
penceresinde kördür.

### 4. Uzun işlem kaynak tutar — eşzamanlı tahakkukları yavaşlatır

Yönetim firması senaryosu: 3 ayrı projede aynı anda 1.000'er bölüm.

| | tek başına | 3 eşzamanlı |
|---|---|---|
| süre | 10,2 sn | **35,8 / 36,8 / 37,1 sn** (≈3,6×) |
| sonuç | 201 · 1.000 borç | 201 · 1.000 borç (hepsi başarılı) |
| aynı anda 10 sakin okuması p95 | 342 ms | **990 ms** (2,9×) |

Havuz **darboğaz değil**: 20 bağlantının yalnızca 3–4'ü tutuluyordu
(`idle in transaction=2..4`), 16–17'si boştaydı. Yavaşlama CPU/veritabanı
çekişmesinden geliyor. Ama okuma p95'i 3 kat artıyor — **tahakkuk koşarken
bütün sakinler yavaşlıyor**.

### 5. Kullanıcı 50 saniye boş ekrana bakar

İlerleme göstergesi yok, iş kimliği yok, iptal yok. Kullanıcının elindeki tek
geri bildirim dönen HTTP yanıtıdır ve o yanıt (madde 2) yanlış olabilir.

## Cevaplanacak sorular

0. **★ ÇİFT TAHAKKUK ÖNCE KAPATILMALI MI?**
   Yukarıdaki 3. gerekçe partilemeden bağımsızdır: bugün, uzun bir istek
   kesildiğinde tekrar deneme mali veriyi bozuyor. Bu partileme kararını
   beklemeli mi, yoksa ayrı ve öncelikli bir düzeltme mi?

1. **Toplu tahakkuk tek işlemde mi, partili mi koşmalı?**
   Tek işlem bütünlüğü korur; ölçüm hedef ölçekte **tamamlandığını** gösterdi
   (49,6 sn). Partileme senkron süreyi kısaltır ama bütünlük garantisini
   zayıflatır. Soru artık "çalışıyor mu" değil, "50 sn senkron kabul edilebilir
   mi".

2. **Parti büyüklüğü kaç olmalı?**
   Ölçüm: bölüm başına ≈10 ms, doğrusal. 30 sn'lik bir vekil payı ≈3.000
   bölüme, 10 sn'lik bir hedef ≈1.000 bölüme denk gelir. Sabit sayı mı,
   süre hedefinden türetilen bir sayı mı?

3. **Kısmi başarı olabilir mi, yoksa hep ya hep yok mu?**
   3.000 bölüme yazılıp 2.000'de durulan bir tahakkuk muhasebe açısından
   ne anlama gelir? Yönetici için "yarım tahakkuk" kabul edilebilir bir
   durum mu?

4. **Kısmi başarıda `IslemPartisi` (D1) geri alma nasıl işler?**
   Geri alma partileri tek tek mi çözer, tamamını mı? Ters kayıt kuralı
   (yerel fikstür ≠ muhasebe kaydı) burada nasıl uygulanır? Kısmen yazılmış
   bir tahakkuk geri alınırken outbox olayları ne olur?

5. **Kullanıcı 5.000 bölümlük bir işlemin ilerlemesini nasıl görür?**
   Senkron istek dönüş süresi bir dakikayı aşabilir. İlerleme göstergesi,
   iş kimliği + yoklama, yoksa olay akışı mı? Yarıda kalan bir işi kullanıcı
   nereden görür ve nasıl sürdürür?

6. **`Idempotency-Key` okunmalı mı, yoksa mükerrer denetimi mi
   güçlendirilmeli?**
   Başlık bugün gönderiliyor ama hiçbir yerde okunmuyor. Seçenekler: başlığı
   gerçekten uygulamak · tahakkuk döneminde veritabanı düzeyinde tekillik
   kısıtı · ikisi birden. Karar 0. maddeye bağlı.

## Karar

**Taslak/kesinleştirme deseni KABUL EDİLDİ — ama sırası bellidir:**

1. **ÖNCE mükerrer tahakkuk koruması** ([ADR-0014](0014-mukerrer-tahakkuk-korumasi.md)).
   Çift tahakkuk partilemeden **bağımsız** bir hatadır; partileme onu çözmez,
   hatta yeni pencereler açabilir. Bu madde **kapatıldı** (migration 0026 ·
   CT-16 6/6).
2. **SONRA partileme.** Parti büyüklüğü, kısmi başarı semantiği, geri alma ve
   ilerleme göstergesi kararları bu ADR'de açık kalmaya devam ediyor.

### Ayrı süreç/kuyruk mu, ayrı havuz mu — ölçüm cevaplıyor

3 ayrı projede aynı anda 1.000'er bölüm tahakkuk:

| | tek başına | 3 eşzamanlı |
|---|---|---|
| süre | 10,2 sn | 35,8 / 36,8 / 37,1 sn (**3,6× — süperdoğrusal**) |
| 10 sakin okuması p95 | 342 ms | **990 ms (2,9×)** |

**Havuz darboğaz DEĞİLDİ:** 20 bağlantının yalnızca **3–4'ü** tutuluyordu,
16–17'si boştaydı. Yavaşlama CPU/veritabanı çekişmesinden gelir.

Bunun doğrudan sonucu: **bu bir AYRI SÜREÇ / KUYRUK gerekçesidir, ayrı havuz
gerekçesi değildir.** Ayrı havuz olmayan bir sorunu çözer ve ikinci bir
yapılandırma yüzeyi ekler. Tahakkukun okumaları yavaşlatmasını engelleyecek
şey, onu farklı bir kaynak bütçesinde koşturmaktır.

## Gerekçe

**Partilemenin gerekçesi artık işlem sınırı değildir** (ölçümle çürütüldü,
yukarıdaki tablo). Gerekçe dörttür: vekil kesmesi · kesilen isteğin sessizce
devam etmesi · eşzamanlı tahakkukların birbirini ve okumaları yavaşlatması ·
kullanıcının ilerleme görememesi.
