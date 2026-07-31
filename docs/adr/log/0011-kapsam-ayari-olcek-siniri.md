# ADR-0011 · Satır kapsamı oturum ayarıyla taşınır — ölçek sınırı ve tetikleyicileri

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

### ★ ÖLÇÜM YOLU KURALI

**psql ölçümü üretim yolunu TEMSİL ETMEZ.** Kapsam kurulumu, transaction
hazırlığı ve serileştirme ölçüm dışında kalır. Bu projede **tüm performans
ölçütleri uçtan uca HTTP üzerinden alınır.**

Aynı senaryoda iki yol 12 kat ayrışıyor ve fark açıklanamadı (ayrıntı aşağıda);
bu yüzden kural katıdır: psql sayıları yalnızca *göreli* karşılaştırma
(önce/sonra) için kullanılır, mutlak eşik olarak ASLA.

### Süre — `GET /kisiler?limit=50` · UÇTAN UCA HTTP (geçerli sayılar)

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

### ⚠️ ÇÖZÜLMEMİŞ ÇELİŞKİ — üç koşum farklı sonuç veriyor

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

**Sebep bulunamadı.** Bu yüzden veritabanı katmanı için sayısal eşik
KONULMADI: doğrulayamadığım bir sayıya eşik koymak, yanlış bir güvence
üretirdi. Regresyon testi bu çelişki çözülene kadar beklemededir
(`kapsam-performans.spec.ts` depoya alınmadı).

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
