# ADR-0011 · Satır kapsamı oturum ayarıyla taşınır — ölçek sınırı ve tetikleyicileri

**Kapsam:** [ORTAK] — Satir kapsami her projede uygulanir.
**Tarih:** 31 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** mimari
**Onaylayan:** ürün sahibi
**İşlendiği belge:** BFS v1 §2 (tenant izolasyonu) · `docs/SATIR-KAPSAMI-KANITI.md`
**İlgili:** [ADR-0002](0002-tenant-modeli.md) (RLS son savunma hattı)

## Bağlam

Satır kapsamı (`yalnizcaKendiVerisi`), tenant izolasyonunun ikinci ekseni olarak
PostgreSQL RLS ile uygulandı (migration 0022–0025). Kişinin bağlı olduğu bölüm
listesi `PrismaService.tenantIslemi` tarafından **oturum ayarına** yazılır
(`app.kapsam_bolumler`), politikalar oradan okur.

Liste neden ayarda: politika fonksiyonu bölüm listesini `malik`/`kiraci`/`sakin`
tablolarından okusaydı, o tabloların **kendi kapsam politikaları** devreye girer
ve `infinite recursion detected in policy for relation "malik"` ile düşerdi.

Ayar boyutu bölüm sayısıyla doğrusal büyür: UUID metni + virgül = **37 bayt/bölüm**.

## Karar

**Kapsam ayarı, tenant başına en çok ~500 bölümlük bir malik varsayımıyla
tasarlanmıştır.** Bu bir *varsayımdır*, ölçülmüş bir üst sınır değil.

⚠️ **31 Temmuz düzeltmesi — varsayım eksik eksen içeriyordu.** Ölçek yalnızca
kapsamın büyüklüğüne bağlı değil: kapsam **kurulumunun** maliyeti tenant'ın
kişi sayısıyla büyür (O(tenant)). 1 daireli sıradan bir malik de 13.000 kişilik
bir tenant'ta ≈39 ms öder. Ayrıntı: "GEÇERLİ SAYILAR" bölümü.

Varsayımın dayanağı ürün gerçeğidir: müteahhit, yeni bir sitede satılmamış
bağımsız bölümlerin malikidir ve KMK md. 20 uyarınca ortak giderden sorumludur.
800 daireli bir sitede ilk yıl 500 daire satılmamış olabilir — bu **normal
durumdur**, uç senaryo değil.

### ★ 800 BÖLÜM — BİLİNEN KIRILMA NOKTASI

**Üst sınır değildir; gerçek kullanımda karşılaşılır.** Teslim öncesi müteahhit,
dairelerin TAMAMININ malikidir: 800 daireli bir sitede ilk satış yapılmadan
önce tek kişi 800 bölümlük kapsam taşır. Bu **her yeni projenin açılış
günüdür**.

Ölçülen: **p95 923,4 ms** · medyan 692 ms · en kötü 998 ms.

**Hata vermez — sessizce yavaşlar.** Kullanıcı `HTTP 200` alır, 521 ms bekler
ve tek kişilik (152 baytlık) bir liste görür. Zaman aşımı yok, hata yok, log
yok (300 eşiği WARN üretir ama kullanıcı onu görmez).

## Ölçüm

**Donanım:** Windows 10 · Docker Desktop · `postgres:16` konteyneri ·
`max_connections=200` · varsayılan `shared_buffers`. Geliştirici dizüstü
bilgisayarı — üretim donanımı değil, **göreli karşılaştırma** için kullanıldı.

**Veri:** 800 bağımsız bölüm · 1.901 kişi · 800 malik kaydı (`perf-muteahhit`)
ve 5.000 bölüm · 5.000 kişi (`perf-5000`).

### Ayar boyutu

| Bölüm | `app.kapsam_bolumler` |
|---|---|
| 1 | 36 bayt |
| 200 | 7.399 bayt |
| 500 | **18.499 bayt** |
| 800 | 29.599 bayt |
| 5.000 | 184.999 bayt |

### ★ ÖLÇÜM YÖNTEMİ — İKİ KALICI KURAL

Bu iki kural, üç ayrı turda yanlış sonuç ürettikleri için ADR'ye kalıcı madde
olarak yazılmıştır. Yeni bir performans sayısı üretilirken ikisi de geçerlidir.

**Kural 1 — psql üretim yolunu TEMSİL ETMEZ.**
Kapsam kurulumu, transaction hazırlığı ve serileştirme psql ölçümünün dışında
kalır. Bu projede **tüm performans ölçütleri uçtan uca HTTP üzerinden alınır.**
psql sayıları yalnızca *göreli* karşılaştırma (önce/sonra) için kullanılır,
mutlak eşik olarak ASLA. Somut kanıt: psql'de kapsam kurulumu 12,6 ms ölçüldü;
aynı kurulumun HTTP'deki soğuk maliyeti ≈39 ms çıktı.

**Kural 2 — kapsam ÖNBELLEKLİDİR (300 sn).**
Ölçüm döngüsü önbelleği temizlemezse **isabet** ölçer, **maliyet** ölçmez.
n=110'luk bir döngünün 109 isteği önbellekten döner. **Soğuk ve sıcak sayılar
ayrı ayrı raporlanır**; tek bir sayı verilecekse hangisi olduğu yazılır.
Somut kanıt: aynı uç, aynı kullanıcı — sıcak 29,2 ms, soğuk 77,7 ms.

### ★ GEÇERLİ SAYILAR — 31 Temmuz, gerçek üretim dağılımı

**Bu bölüm ADR'nin geçerli ölçüm dayanağıdır.** Aşağıdaki eski bölümler
kayıt için korunuyor; çelişki varsa **bu bölüm geçerlidir**.

Veri seti `database/perf/gercek-dagilim.sql` — tenant `gercek-5000`:
5.000 bölüm · 13.000 kişi · 4.985 malik kaydı (4.700 tekil) · 3.000 kiracı ·
5.300 sakin. Malik dağılımı 4.500×1 daire · 150×2 · 45×3 · 5×10. Karşılaştırma
tabanı `guzel-apartmani` (4 bölüm · 30 kişi). Üretim derlemesi
(`node dist/main.js`), uçtan uca HTTP.

#### Maliyet O(tenant), O(kapsam) DEĞİL

Önceki turlarda ölçek ekseni *kapsamın büyüklüğü* (müteahhit, 800 bölüm)
sanılıyordu. Gerçek dağılımda **1 daireli sıradan bir malik de** aynı bedeli
ödüyor, çünkü kapsam kurulumu tenant'ın tamamını tarıyor.

`/tahakkuk/donemler`, n=40, her istekten önce kapsam anahtarı silinerek:

| Kullanıcı | soğuk medyan | sıcak medyan | fark |
|---|---|---|---|
| gercek-5000 · MALİK 1 daire | 77,7 | 29,2 | **+48,5** |
| gercek-5000 · MALİK 10 daire | 78,4 | 30,4 | +48,0 |
| gercek-5000 · KİRACI (403 alıyor) | 62,3 | 9,6 | +52,7 |
| gercek-5000 · SAKİN (403 alıyor) | 60,9 | 16,0 | +44,9 |
| **gercek-5000 · YÖNETİCİ (kapsamsız — kontrol)** | 27,1 | 17,4 | **+9,7** |
| guzel-apartmani · MALİK 1 daire | 47,7 | 24,0 | +23,7 |

Yöneticinin kapsamı önbelleğe hiç yazılmaz; onun +9,7 ms'i sıralama
yanlılığıdır. Çıkarıldığında **kapsam kurulumu 13.000 kişilik tenant'ta
≈39 ms, 30 kişilik tenant'ta ≈14 ms** (≈2,8×). Kapsamın kendisi iki durumda da
**1 bölüm**.

Kök sebep `backend/src/common/prisma/tenant.reader.ts:113` (`kisiId: { not: … }`)
ve `:150`: 3.000 satır çekilip JS tarafında `Set` kesişimi yapılıyor. psql'de
bu dördüncü sorgu tek başına 10,1 ms ve 2.964 tampon — kapsam kurulumunun
%80'i.

**TenantGuard, PermissionGuard'dan önce koşar:** reddedilecek bir istek bile
bu bedeli öder (SAKİN'in 403'ü soğukta 61 ms).

#### Eşzamanlılık — doygunluk

`/kisiler?limit=50`, 20 sn/seviye, farklı 1 daireli malikler:

| eşzamanlı | p50 | p95 | p99 | istek/sn |
|---|---|---|---|---|
| 1 | 71,3 | 128,8 | 148,2 | 13,0 |
| 10 | 211,8 | 340,6 | 420,8 | 44,2 |
| 25 | 533,3 | 804,2 | 1.131 | 44,5 |
| 50 | 1.763 | 2.280 | 4.639 | 25,9 |

Doygunluk 10 eşzamanlıda. Bağlantılar çoğunlukla `idle in transaction` —
`tenantIslemi` her isteği interaktif işleme sarıyor ve `set_config`
gidiş-dönüşleri boyunca bağlantıyı tutuyor. Yüksek eşzamanlılıkta işlem
başlatılamıyor ve istek 500 dönüyor. GC darboğaz değil (duraklama 6,7 → 20 ms,
RSS 215 → 216 MB).

Ayrıntı ve arıza kipleri: `SESSION_SUMMARY.md` §3.I.

### Süre — `GET /kisiler?limit=50` · UÇTAN UCA HTTP (SICAK YOL)

⚠️ **Bu tablo Kural 2 uyarınca SICAK yolu ölçer** — kapsam önbelleği etkin,
istekler önbellek isabeti. Soğuk maliyeti içermez; "kapsam kurulumu ne kadar
sürüyor" sorusunun yanıtı **değildir**. Kapsamın büyüklüğüne bağlı sorgu
maliyetini göstermesi bakımından geçerlidir.

n=100, ilk 10 ısınma atıldı. Kapsam önbelleği **etkin** (5 dk TTL + aktif
geçersizleştirme).

| Senaryo | medyan | **p95** | std | min | maks |
|---|---|---|---|---|---|
| Kısıtsız (yönetici) | 30,0 | **69,0** | 17,4 | 15,1 | 136,1 |
| 500 bölüm (müteahhit) | 93,4 | **121,7** | 14,7 | 36,7 | 164,4 |
| **800 bölüm (açılış günü)** | 692,0 | **923,4** | 132,5 | 518,6 | 998,5 |

Kapsam önbelleği öncesi/sonrası (aynı koşum, n=100):

| Senaryo | p95 ÖNCE | p95 SONRA | Kazanç |
|---|---|---|---|
| 500 bölüm | 146,0 ms | 121,7 ms | %17 |
| 800 bölüm | 924,0 ms | 923,4 ms | **yok** |

Önbellek 500'de işe yarıyor, 800'de yaramıyor: faz ölçümü maliyetin **%89'unun
asıl sorguda** olduğunu gösterdi, önbellek onu değiştirmiyor.

### Faz ölçümü — 800 bölüm, n=30 (nerede harcanıyor)

| Faz | medyan | Pay |
|---|---|---|
| **asıl sorgu** | **620,6 ms** | **%89** |
| `set_config` bölümler (30 KB) | 45,5 ms | %6,5 |
| kapsam kurulumu (4 sorgu) | 27,2 ms | %3,9 |
| JWT · serileştirme · transaction · öteki `set_config` | ~7 ms | %1 |

### ⚠️ GEÇERSİZ — eski psql sayıları (kayıt için korunur)

Aşağıdaki tablo **ölçüm yolu üretimi temsil etmediği için geçersizdir**.
Silinmiyor çünkü ADR'nin ilk hâlinde karar dayanağı olarak kullanıldı.

| Senaryo | psql p95 | Gerçek (HTTP) p95 |
|---|---|---|
| kısıtsız | 6,64 ms | 69,0 ms |
| 200 bölüm | 11,57 ms | ölçülmedi |
| 500 bölüm | 26,95 ms | **121,7 ms** |
| 800 bölüm | 23,94 ms | **923,4 ms** |

800 satırı özellikle yanıltıcı: psql 24 ms gösteriyor, gerçek 923 ms.

### Süre — psql (yalnızca göreli karşılaştırma için)

**psql, plan önbellekli, 10 tekrar (ms):**

| Senaryo | min | ort | **p95** | maks |
|---|---|---|---|---|
| kısıtsız | 0,37 | 1,56 | **6,64** | 11,09 |
| 200 bölüm | 4,83 | 6,48 | **11,57** | 15,37 |
| 500 bölüm | 8,84 | 14,04 | **26,95** | 36,67 |
| 800 bölüm | 9,18 | 13,32 | **23,94** | 28,75 |

**Uçtan uca HTTP (Prisma + transaction + ağ dahil), n=20:**

| Senaryo | min | ort | p50 | **p95** |
|---|---|---|---|---|
| kısıtsız (yönetici) | 18,8 | 35,6 | 28,3 | **159,0** |
| 1 daireli malik | 43,6 | 63,1 | 56,6 | **135,7** |
| 500 daireli müteahhit | 62,4 | 105,8 | 111,0 | **124,8** |

**psql, tek atış, planlama dahil:**

| Bölüm | Execution | Planning |
|---|---|---|
| 500 | 184,8 ms | **214,8 ms** |
| 800 | 1.086,7 ms | **500,5 ms** |

### ✅ ÇÖZÜLDÜ (31 Temmuz) — 12× farkın yeri bulundu

Aşağıdaki çelişki **kapandı**. İki sebep birlikte açıklıyor:

1. **Fark sorguda değil, sorgudan ÖNCE.** Maliyet kapsam *kurulumundadır* ve
   O(tenant)'tır — fikstürün kişi sayısı büyüdükçe artar, kapsamın bölüm
   sayısıyla değil. `ct15` fikstürü (600 kişi) ile `perf-muteahhit` (1.901
   kişi) karşılaştırması bu yüzden beklenenin tersi görünüyordu: ölçülen
   şey aynı şey değildi.
2. **Bazı koşumlar önbellek isabetini ölçüyordu** (Kural 2). psql koşumu
   önbelleği hiç kullanmaz, HTTP koşumu ısındıktan sonra hep kullanır.

Bu yüzden aşağıdaki tablo **geçersizdir** — üç satır üç ayrı şeyi ölçüyor,
karşılaştırılabilir değiller. Kayıt için korunuyor.

### ⚠️ GEÇERSİZ — üç koşum farklı şeyleri ölçüyordu

Aynı senaryo (500 bölümlük kapsam, `/kisiler` eşdeğeri) üç ayrı koşumda
**birbiriyle bağdaşmayan** süreler verdi:

| Koşum | 200 bölüm | 500 bölüm |
|---|---|---|
| psql, PL/pgSQL döngü, `perf-muteahhit` fikstürü | 11,6 ms | **27,0 ms** |
| Uçtan uca HTTP, `perf-muteahhit` fikstürü | — | **125–181 ms** |
| vitest + Prisma, `ct15` fikstürü (600 bölüm · 600 kişi) | 93,0 ms | **734,2 ms** |

Üçüncü koşum, kapsam bir kez kurulup sorgu 12 kez yinelendiğinde bile 734 ms
verdi — yani fark transaction kurulumundan DEĞİL. Daha küçük fikstürde
(600 kişi ↔ 1.901 kişi) daha yavaş olması da beklenenin tersidir.

**Sebep artık biliniyor** (yukarıdaki "ÇÖZÜLDÜ" notu). Veritabanı katmanı için
sayısal eşik yine de KONULMADI: eşik, düzeltme yapılmadan konulursa bugünkü
O(tenant) davranışını *kalıcı hâle getirir*. Regresyon testi
(`kapsam-performans.spec.ts`) hâlâ depoda değildir; eşiği düzeltme sonrası
ölçümle birlikte önerilecektir.

**Güvenilen sayı uçtan uca HTTP ölçümüdür** (iki bağımsız koşumda 125 ve
181 ms): kullanıcının gerçekten yaşadığı süre odur ve yinelenebilirdir.

## Aşıldığında ne olur

**Sessizce çalışır ve YAVAŞLAR — hata vermez.** Bozulmanın üç kademesi:

1. **Execution** kapsamla birlikte artar (6,6 → 27 ms p95). Kademeli.
2. **Planning** çok daha hızlı patlar (5,7 → 215 → 500 ms). Plan önbellekliyken
   görünmez; önbellek ıskalandığında (yeni bağlantı, `DISCARD ALL`, havuz
   döngüsü) tek istek **700 ms**'ye çıkar.
3. `set_config` yükü her transaction'da ağdan geçer (500 bölüm = 18 KB).

⚠️ **Ölçülen p95 (124,8 ms) payı, plan önbelleğine bağlıdır.** Prisma hazırlanmış
ifade kullandığı için bugün geçerlidir; havuz davranışı değişirse pay kaybolur.
Bu, kabul edilen bilinen bir kırılganlıktır.

PostgreSQL GUC değerlerinin belgelenmiş sabit üst sınırı yoktur; 185 KB kabul
edildi ve hata vermedi. Yani **sert bir duvar yok**, yalnızca yavaşlama var.

## Yeniden değerlendirme tetikleyicileri

| Tetikleyici | Yapılacak |
|---|---|
| **Tenant'ta kişi sayısı > 5.000** | ★ 31 Temmuz'da eklendi. Kapsam kurulumu O(tenant)'tır; kapsam küçük olsa bile maliyet buradan gelir. `tenant.reader.ts:113`/`:150` yeniden ele alınır |
| Kapsam **> 300 bölüm** | `TenantGuard` WARN logu üretir (uygulandı). Log görülürse bu ADR gözden geçirilir |
| Kapsam **> 800 bölüm** | Ölçüm yinelenir. Tek atış planlama 500 ms'yi aştığı nokta burasıdır |
| Uçtan uca p95 **> 250 ms** | Regresyon testi kırmızı yanar; seçenek B (EXISTS) değerlendirilir |
| Prisma havuz/hazırlanmış ifade davranışı değişirse | Plan önbelleği varsayımı düşer; uçtan uca ölçüm yinelenir |
| Tek tenant'ta bölüm sayısı 5.000'i aşarsa | Bu ADR'nin varsayımı geçersizdir; yeniden karar gerekir |

## Reddedilen seçenekler

### `SECURITY DEFINER` fonksiyon — REDDEDİLDİ

Bölüm listesini fonksiyon içinde tablolardan okumak özyinelemeyi çözerdi ve ayar
36 bayta inerdi. **ADR-0002 ile çelişir:** o karar, RLS'in son savunma hattı
olmasını ve uygulama rolünün `BYPASSRLS` taşımamasını şart koşar.
`SECURITY DEFINER` bir fonksiyon, tanımlayanın haklarıyla çalışarak RLS'i atlar;
içinde `app_tenant_id()` süzmesi unutulursa **tüm tenant'lar** okunur ve hata
sessizdir. Depoda bugün hiç `SECURITY DEFINER` fonksiyon yoktur; bu istisnayı
performans için açmak, ADR-0002'nin tek katmanlı olmama ilkesini bozar.

### Ayarı büyütmek / sıkıştırmak — REDDEDİLDİ

base64/bytea kodlaması 185 KB'ı ~90 KB'a indirirdi. **Ölçüm bunun yanlış sorunu
çözdüğünü gösterdi:** darboğaz ayar boyutu değil, planlama ve dizi çözümlemesi.
Sıkıştırma süreyi düşürmez, yalnızca ağ yükünü azaltır.

### `EXISTS` / yarı-birleştirmeye çevirmek — ŞİMDİLİK GİRİLMEDİ

Dizi üyeliği yerine `EXISTS (SELECT 1 FROM malik m WHERE m.kisi_id = kisi.id
AND m.bolum_id = ANY(...))` biçimi indeksli birleştirme üretebilir. InitPlan
sarmalaması (0025) hedefi zaten karşıladığı için **gereksiz karmaşıklık
eklenmedi**. Tetikleyici tabloda p95 > 250 ms satırına bağlanmıştır.

## Sonuçlar

**Kolaylaştırdığı:** kapsam kuralı tek yerde (`tenantIslemi`) kurulur, uç uç
filtre serpiştirilmez; RLS son savunma hattı olarak korunur.

**Zorlaştırdığı:** kapsam genişledikçe maliyet artar ve bu maliyet **sessizdir** —
bu yüzden 300 eşiğinde uyarı logu ve iki katmanlı regresyon testi eklenmiştir.

**Kabul edilen bedel:** 500 bölümlük müteahhit senaryosu bugün 124,8 ms p95 ile
geçiyor ama payı plan önbelleği tutuyor. Bu kırılganlık bilinerek kabul edildi;
tetikleyiciler onu görünür kılmak için vardır.
