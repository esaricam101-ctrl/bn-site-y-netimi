# ADR-0007 · Para tipi — ölçeklenmiş bigint, harici ondalık kütüphanesi yok

**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** baş mimar
**Onaylayan:** mimari kurul
**İşlendiği belge:** BFS v1 §11 · `packages/shared-kernel/src/money/money.ts`

## Bağlam

`Money` ilk tasarımda `decimal.js` üzerine kurulmuştu: `tutar: Decimal`. Faz 0 Build Verification sırasında iki sorun ortaya çıktı.

**Birincisi tesadüfi:** geliştirme ortamında paket kayıt sunucusuna erişim yoktu, dolayısıyla `decimal.js` kurulamadı ve `shared-kernel` derlenemedi.

**İkincisi yapısal ve asıl gerekçe:** `shared-kernel`, bağımlılık grafiğinin en altındaki pakettir. `Money.tutar` alanının tipi `Decimal` olduğunda, bu üçüncü taraf sınıf **her tüketicinin genel API'sine sızar.** Bir borç, bir tahakkuk satırı, bir API DTO'su — hepsi `decimal.js`'in sürüm ve davranış kararlarına bağlı hale gelir. Kütüphaneyi değiştirmek, tek bir paketin iç meselesi olmaktan çıkıp sistem çapında bir kırıcı değişikliğe dönüşür.

## Karar

`Money`, **ölçeklenmiş `bigint`** ile temsil edilir.

```text
Money = { kurus: bigint, paraBirimi: ParaBirimi, kur: bigint }
Ölçek = 4 basamak  →  PostgreSQL numeric(18,4) ile birebir örtüşür
12,3456 TRY  →  123456n
```

Harici ondalık kütüphanesi kullanılmaz. `shared-kernel`'in çalışma zamanı bağımlılığı **sıfırdır.**

## Gerekçe

1. **Tam.** `bigint` keyfi büyüklükte tam sayı aritmetiğidir; sabit ölçekte toplama ve çıkarma **kayıpsızdır.** `0.1 + 0.2 = 0.3` — float'ta olmayan bir garanti.
2. **Sızıntı yok.** Genel API'de görünen tipler yalnızca `bigint` ve `string`; ikisi de dilin parçası.
3. **Veritabanıyla hizalı.** Ölçek 4, `numeric(18,4)` ile birebir. Okuma/yazma dönüşümü tek çarpma.
4. **Dar kapsam.** İhtiyaç duyulan işlem kümesi küçük ve tam olarak bilinir: toplama, çıkarma, oran çarpımı, dağıtım, biçimlendirme. Genel amaçlı bir ondalık kütüphanesinin sunduğu üs alma, logaritma, keyfi hassasiyet gerekmez.

## Sonuçlar

**Kabul edilen bedel:** Aritmetik operatör kullanılamaz; `topla(a, b)` yazılır. Bu, para karıştırmayı da zorlaştırdığı için çoğu zaman avantajdır — farklı para birimleri toplanmaya çalışıldığında hata verir.

**Bağlayıcı kurallar:**

1. **`number` hiçbir yerde para taşımaz.** `money()` yalnızca ondalık `string` kabul eder — `number` alsaydı kayıp çağıran tarafta zaten olmuş olurdu.
2. **Dört basamaktan fazlası sessizce yuvarlanmaz**, hata verir. Yuvarlama çağıranın açık kararıdır.
3. **Oranlar `pay`/`payda` tam sayı çifti olarak geçer.** Aylık %1,5 faiz → `carpOran(m, 15n, 1000n)`. Float bir oran, sabit noktalı aritmetiğin garantisini bozar.
4. **Yuvarlama bankacı yuvarlamasıdır** (ROUND_HALF_EVEN). Sistematik yukarı sapmayı önler.
5. **Dağıtım farkı kaybolmaz.** `dagit()`, kalanı en büyük ağırlıklı paya ekler; `Σ paylar === toplam` her koşulda sağlanır ve test edilir. ADR v1.1 §4'ün gider paylaşımı için tek meşru yoludur.

**Geri dönüş yolu:** Gerekirse `decimal.js`'e geçiş, `money.ts`'in iç uygulamasını değiştirmekle sınırlıdır — dış imza `bigint` ve `string` üzerinden tanımlı olduğu için tüketiciler etkilenmez. Kararın asıl kazanımı budur.
