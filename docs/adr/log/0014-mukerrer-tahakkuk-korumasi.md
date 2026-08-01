# ADR-0014 · Mükerrer tahakkuk koruması veritabanı kısıtıdır

**Tarih:** 1 Ağustos 2026
**Statü:** kabul edildi
**Öneren:** uygulama (ölçülmüş mali veri bozulması)
**Onaylayan:** ürün sahibi
**İşlendiği belge:** BFS v1 §366 (Idempotency) · DMS v1 (Borç aggregate)
**İlgili:** [ADR-0002](0002-tenant-modeli.md) (kuralı veritabanı zorlar) ·
[ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) (cari = bağımsız bölüm) ·
[ADR-0013](ADR-0013-toplu-islem-partileme.md) (taslak)

## Bağlam — ölçülmüş veri bozulması

Toplu tahakkuk uzun sürer (5.000 bölüm ≈ 50 sn). Ters vekil varsayılan
`proxy_read_timeout` 60 sn'dir; Cloudflare 100 sn, çoğu ALB 30–60 sn. İstek
kesildiğinde **iş arka planda sürer** — ölçüldü:

```text
 10..90 sn · borc=0     · istemci 504@60,1sn
100 sn    · borc=10000 · istemci 504@60,1sn
```

Kullanıcı hata gördüğü için tekrar dener. Tekrar denemesi **ilk işlem henüz
commit etmeden** varır. O tarihteki koruma uygulama katmanında bir sayımdı:

```ts
const mevcutSayisi = await tx.borc.count({ where: { …, tahakkukDonemi } });
if (mevcutSayisi > 0) throw new IsKuraliIhlali(…);
```

`count()` **commit edilmemiş satırları göremez**. Ölçülen sonuç:

```text
1. deneme  -> 504 @ 30,0 sn        (arka planda sürüyor)
35. sn     -> commit edilmiş borç = 0     ← sayım burada 0 görür
2. deneme  -> 201 @ 67,0 sn        (AYNI Idempotency-Key)
SONUÇ      -> borç satırı = 10.000   (beklenen 5.000)
```

**Her daire iki kez borçlandı.** `Idempotency-Key` korumadı: başlık BFS v1
§366'da zorunlu kılınmıştı ama depoda **hiçbir yerde okunmuyordu**
(`grep -r Idempotency backend/src` → boş). Beyan edilmiş ve bağlanmamış bir
koruma — `yalnizcaKendiVerisi` bayrağıyla aynı sınıf hata.

## Karar

### 1. Koruma VERİTABANI KISITIDIR, uygulama sayımı değil

Okuma ile yazma arasındaki pencere uygulama katmanında kapatılamaz. ADR-0002'nin
"değeri uygulama koyar, kuralı veritabanı zorlar" gerekçesi burada da geçerlidir.

Yeni tablo `tahakkuk_calismasi` bir kayıt defteri değil, bir **kilittir**:

```sql
CREATE UNIQUE INDEX tahakkuk_calismasi_asil_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem)
  WHERE tip = 'ASIL';
```

Çalışma satırı işlemin **İLK yazmasıdır**. İkinci işlem kısıt üzerinde
**bloklanır**, ilk işlem commit edince benzersizlik ihlaliyle düşer. Pencere
kalmaz.

⚠️ **Önce yazılması şarttır.** Dağıtım hesabından sonra yazılsaydı iki işlem de
hesabı bitirir, kilit yalnızca en sonda alınırdı ve boşa geçen iş süresi kadar
pencere açık kalırdı.

İkinci kısıt aynı çalışmanın kendi içinde bölümü iki kez işlemesini kapatır:

```sql
CREATE UNIQUE INDEX borc_calisma_bolum_uq ON borc (calisma_id, bolum_id);
```

### 2. Benzersizlik CARİ = BAĞIMSIZ BÖLÜM üzerindedir

ADR-0010: *"Cari hesabın birimi `bagimsiz_bolum`dur. Kişi bazlı cari tablosu
AÇILMAZ."* Malik/kiracı `borc_sorumlusu` snapshot'ında tutulur.

Kişi bazlı benzersizlik **yanlış olurdu**: üç daireli bir malik dönemde üç kez
borçlanır ve bu KMK md. 20 gereğidir. CT-16(6) bunu ölçer.

### 2b. ★ İKİ TAHAKKUK SINIFI — düzeltme (migration 0027)

**0026 eksikti:** "dönemde tek tahakkuk" kuralını bütün gider türlerine
uyguluyordu. Bu yalnızca bir sınıf için doğrudur.

| sınıf | örnek | dönemde | mükerrer koruması nerede |
|---|---|---|---|
| **DÖNEMSEL** | aidat · **yıl sonu kapanışı** | **TEK** | dönem ekseninde |
| **OLAY BAZLI** | demirbaş alımı · bir defalık gider | **birden çok** | gider olayı ekseninde |

Yıl sonu kapanışı dönemde bir kez olur; ikincisi mükerrerdir ve mali veriyi
bozar. Ama demirbaş alımı bir **döneme** değil bir **olaya** karşılıktır: aynı
ay içinde iki ayrı alım yapılabilir ve **ikisi de meşrudur**. Bunlar
birbirinin düzeltmesi değildir — `ekTahakkuk` bayrağı onları modellemek için
yanlış araçtır.

Sınıf, kuralın kendisi gibi **veridir**: `gider_turu.tahakkuk_sikligi`.
Varsayılan `DONEMSEL` — sıklık unutulursa davranış **sıkı** tarafa düşer.

Olay bazlı sınıfta ayırt eden şey dönem olamaz; gider olayının iş anahtarıdır.
Bu yüzden `referans` (fatura / genel kurul karar no) **zorunludur**:

```sql
-- Dönemsel: referanssız ASIL çalışma dönemde tektir.
CREATE UNIQUE INDEX tahakkuk_calismasi_donemsel_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem)
  WHERE tip = 'ASIL' AND referans IS NULL;

-- Olay bazlı: aynı gider olayı iki kez yansıtılamaz.
CREATE UNIQUE INDEX tahakkuk_calismasi_referans_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem, referans)
  WHERE referans IS NOT NULL;
```

⚠️ **Referansı unutulmuş bir olay bazlı çalışma dönemsel kısıta düşer** —
yani yapılandırma hatasında davranış gevşek değil **sıkı** taraftadır. Uygulama
katmanı ayrıca 422 ile uyarır: olay bazlı türde referans zorunlu, dönemsel
türde kabul edilmez.

### 3. Kapsam PROJE bütünüdür — blok benzersizliğin parçası DEĞİLDİR

Tahakkuk proje seviyesinde tek sefer koşar; hangi carilere borç yazılacağını
paylaşım kuralı (arsa payı, eşit dağıtım, bölüm tipi, muafiyet) belirler. Blok
yalnızca süzme ve raporlama içindir.

**Sonucu açıkça yazılmalıdır:** BLOK_BAZLI bir gider aynı dönemde ikinci bir
bloğa ayrı çalıştırma ile yazılamaz. İki blok için ayrı gider kalemleri
gerekiyorsa ayrı gider türleri tanımlanır ya da ek tahakkuk kullanılır.

### 4. Ek/düzeltme tahakkuku AÇIK NİYET BEYANI ister

Sonradan gelen fatura meşru bir senaryodur. Ama kesilen bir isteğin ardından
yapılan tekrar denemesi ile bilinçli bir ek tahakkuk **ancak açık bayrakla**
ayırt edilebilir. `ekTahakkuk: true` verilmeden ikinci çalıştırma reddedilir;
verilirse `tip='EK'` ile yeni bir çalışma açılır ve kısmi indekse takılmaz.

### 5. Kısıt ihlali **409 Conflict** döner

Gövde geçerli, istek geçerli — çakışan şey kaynağın **mevcut durumudur**.
422 doğrulama hatası içindir. Zaman aşımından sonra tekrar deneyen istemci için
409 doğru sinyaldir: *"işlem zaten yapılmış"*, *"girdin bozuk"* değil. Depoda
`CakismaHatasi` sınıfı zaten 409 taşıyordu; yeni sınıf açılmadı.

### 6. `Idempotency-Key` KALDIRILMAZ, OKUNUR

Seçenek "gerçekten uygula" ya da "tamamen kaldır" idi. **Uygulandı.**

Gerekçe: BFS v1 §366 başlığı *zorunlu* kılıyor. Kaldırmak, bağlayıcı bir
belgeyi tek taraflı değiştirmek olurdu — üstelik başlık yalnızca tahakkuku
değil, kayıt oluşturan **her** POST'u ilgilendirir. `IdempotansInterceptor`
(tenant + anahtar tekil) aynı anahtarla gelen ikinci isteğe işi tekrar
çalıştırmadan **ilk yanıtı** döner; aynı anahtar farklı gövdeyle gelirse 409.

⚠️ **Bu katman tek başına yeterli değildir ve olması da beklenmez.** İki
eşzamanlı istek ikisi de kaydı bulamayıp işi başlatabilir. Asıl koruma 1.
maddedeki kısıttır; bu katman kullanıcının tekrar denemesine 409 yerine ilk
sonucu döndürmek içindir.

### 7. Migration mevcut bozuk veriyi SESSİZCE DÜZELTMEZ

`0026` benzersiz indeksi oluşturmadan önce mükerrer satırları arar ve varsa
**durur**, hangi tenant/gider/dönem/bölüm satırlarının bozuk olduğunu yazar.
Hangi çalıştırmanın geçerli olduğu mali bir karardır; migration otomatik
silmez. (Bu denetim ilk uygulamada gerçekten tetiklendi — ölçüm sırasında
üretilen 10.000 mükerrer satırı yakaladı.)

## Testler — CT-16

`backend/test/contract/mukerrer-tahakkuk.spec.ts`. Uygulamadan **önce**
yazıldı; 6 testin 5'i kırmızıydı.

| # | Test | Önce | Sonra |
|---|---|---|---|
| 1 | ilk tahakkuk her bölüme bir satır yazar | ✅ | ✅ |
| 2 | aynı proje+dönem+gider türü ikinci tahakkuk reddedilir | ❌ 422 | ✅ 409 |
| 3 | ★ ilk işlem commit etmemişken gelen ikinci istek reddedilir | ❌ | ✅ |
| 4 | aynı Idempotency-Key ilkin sonucunu döner | ❌ 422 | ✅ 201 |
| 5 | ek tahakkuk açıkça istendiğinde geçer | ❌ 422 | ✅ 201 |
| 6 | cari bölümdür: iki daireli malik iki kez borçlanır | ❌ 2 | ✅ 4 |
| 7 | olay bazlı gider iki farklı referansla iki kez koşar | — | ✅ 201·201 |
| 8 | olay bazlı: aynı referans ikinci kez koşamaz | — | ✅ 409 |
| 9 | olay bazlı gider referanssız tahakkuk edilemez | — | ✅ 422 |
| 10 | dönemsel gider referans kabul etmez | — | ✅ 422 |

(7–10 migration 0027 ile eklendi; toplam **10 test**, tüm sözleşme paketi 60.)

Test 3 yarışı birebir üretir: bir işlem çalışma satırını yazıp **commit
etmeden** bekler, bu sırada HTTP üzerinden ikinci tahakkuk gelir. Doğru
davranış ikinci isteğin kısıt üzerinde bloklanıp ihlalle düşmesidir.

## Sonuçlar

**Kolaylaştırdığı:** tahakkuk çalıştırması artık bir varlıktır — denetim kaydı
onun kimliğini taşır, borç satırları ona bağlıdır, ek tahakkuklar sıralıdır.
Geriye dönük sorgulama ("bu dönemde kaç çalıştırma oldu") mümkün hâle geldi.

**Zorlaştırdığı:** dönemde bir gider türü için ikinci bir çalıştırma artık açık
niyet ister. Blok bazlı ayrı çalıştırma yolu kapandı (3. madde).

**Kabul edilen bedel:** çalışma satırı işlemin başında yazıldığı için iki
eşzamanlı tahakkuk isteğinden biri, diğerinin **tüm işi bitirmesini** kısıt
üzerinde bekler. Ölçülen tahakkuk süreleri (5.000 bölüm ≈ 50 sn) düşünülürse
bu bekleme uzundur; ADR-0013'ün partileme kararı bunu da etkileyecektir.
