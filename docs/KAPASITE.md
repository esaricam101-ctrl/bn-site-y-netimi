# BNOS Apartman — ölçülmüş kapasite

**Son ölçüm:** 1 Ağustos 2026

> **Bu belgede yalnızca ÖLÇÜLMÜŞ sayılar vardır.** Ölçülmemiş her şey
> "ölçülmedi" olarak yazılır. Tahmin, ekstrapolasyon ve "yaklaşık olarak"
> ifadesi kullanılmamıştır.

## Ölçüm ortamı — üretim donanımı DEĞİLDİR

Windows 10 · Docker Desktop · `postgres:16` konteyneri · **2 fiziksel çekirdek**
· varsayılan `shared_buffers` · geliştirici dizüstü bilgisayarı. Uygulama
üretim derlemesiyle (`node dist/main.js`) koştu, ölçümler uçtan uca HTTP'dir.

**Üretim donanımında sayılar farklı olacaktır.** Bu belge mutlak bir taahhüt
değil, bilinen davranışın kaydıdır. Satış taahhüdü verilmeden önce hedef
donanımda yinelenmelidir.

Veri seti: 5.000 bağımsız bölüm · 13.000 kişi · 4.985 malik kaydı (4.700 tekil
kişi) · 3.000 kiracı · 5.300 sakin (`database/perf/gercek-dagilim.sql`).

## Tek projede toplu tahakkuk

Bölüm başına maliyet **doğrusaldır**; 10× ölçekte sapma %1,8.

| bölüm | süre | borç satırı | outbox olayı | ms/bölüm |
|---|---|---|---|---|
| 500 | 5,0 sn | 500 | 1 | 10,06 |
| 1.000 | 10,1 sn | 1.000 | 1 | 10,08 |
| 2.000 | 19,8 sn | 2.000 | 1 | 9,90 |
| 5.000 | 49,6 sn | 5.000 | 1 | 9,92 |
| 10.000 | ~100 sn | 10.000 | 1 | ölçüldü, süre tek koşum |

Outbox olayı **tahakkuk başına birdir**, bölüm başına değil. Relay gecikmesi
ortalama 1,3 sn, yeniden deneme 0.

⚠️ Bu sayılar işlem süresi sınırı yükseltilmiş hâlde alınmıştır. Depodaki
varsayılan yapılandırmada üst sınır ≈420 bölümdür — ADR-0013.

## Ters vekil arkasındaki üst sınır

Nginx **varsayılan** `proxy_read_timeout` 60 sn:

| iş | süre | sonuç |
|---|---|---|
| 5.000 bölüm | 50,7 sn | ✅ geçer — payın %85'i kullanılır |
| 10.000 bölüm | 60,1 sn | ❌ **504 Gateway Time-out** |

**Kesilen istek arka planda devam eder ve işlem tamamlanır** (10.000 bölüm
ölçümünde borç satırları 504'ten ~40 sn sonra yazıldı). Kullanıcı hata görür,
veri yazılmıştır. Yapılandırma önerisi: `docs/TERS-VEKIL.md`.

## Eşzamanlı okuma kapasitesi

`GET /kisiler?limit=50`, farklı maliklerle, 20 sn/seviye:

| eşzamanlı kullanıcı | p50 | p95 | p99 | istek/sn | hata |
|---|---|---|---|---|---|
| 1 | 33,6 ms | 48,4 ms | 74,9 ms | 28,0 | 0 |
| 10 | 138 ms | 237 ms | 360 ms | 67,0 | 0 |
| 25 | 337 ms | 581 ms | 785 ms | 70,7 | 0 |
| 50 | 687 ms | 957 ms | 1.761 ms | 69,5 | 0 |

**Verim tavanı ~50–70 istek/sn** (koşumlar arası oynaklık bu aralıktadır).
Doygunluk 10 eşzamanlı kullanıcıda başlar: bunun ötesinde verim sabit kalır,
gecikme doğrusal artar. Kullanıcı **bekler**, hata almaz.

## Eşzamanlı tahakkuk davranışı

3 ayrı projede aynı anda 1.000'er bölüm:

| | tek başına | 3 eşzamanlı |
|---|---|---|
| tahakkuk süresi | 10,2 sn | 35,8 / 36,8 / 37,1 sn (**3,6×**) |
| sonuç | 201 · 1.000 borç | 201 · 1.000 borç · hata yok |
| aynı anda 10 sakin okuması p95 | 342 ms | **990 ms** (2,9×) |

Yavaşlama **CPU/veritabanı çekişmesindendir**, bağlantı havuzundan değil:
20 bağlantının yalnızca 3–4'ü tutuluyordu.

## Bellek

Node süreci yük altında **215 → 216 MB RSS**. Yığın büyümedi, sızıntı yok.
GC duraklamaları boştaki 6,7 ms medyandan yük altında 20 ms'e çıkıyor —
p50'nin yüzlerce ms olduğu yerde belirleyici değil.

## Bağlantı havuzu

`max_connections` 200. Uygulama havuzu için ölçüm (50 eşzamanlı, tek koşum):

| havuz | p50 | p95 | istek/sn |
|---|---|---|---|
| varsayılan (5) | 891 ms | 1.280 ms | 52,8 |
| 15 | 907 ms | 1.138 ms | 53,4 |
| 20 | 975 ms | 1.382 ms | 49,3 |
| 30 | 949 ms | 1.416 ms | 50,7 |

**Havuz boyutunun bu ölçümde belirleyici bir etkisi yoktur** — dört değer
koşum oynaklığı içinde. (Daha önce havuz büyütmenin verimi 44 → 70 istek/sn
çıkardığı ölçülmüştü; o ölçüm `set_config` çağrıları ayrı ayrı gönderilirken
yapılmıştı. Çağrılar tek sorguda birleştirildikten sonra havuz baskısı ortadan
kalktı.)

## ★ HENÜZ ÖLÇÜLMEYENLER

Aşağıdakiler için **hiçbir sayı verilemez**. Satış taahhüdüne girmemelidir.

| konu | durum |
|---|---|
| 15 proje eşzamanlı tahakkuk | **ölçülmedi** — yalnızca 3 proje ölçüldü |
| Fotoğraf/dosya yükleme yolu (MinIO) | **ölçülmedi** |
| Personel akışı (vardiya, zimmet, sertifika) | **ölçülmedi** |
| Gider kalemi çarpanı (bir dönemde N farklı gider türü) | **ölçülmedi** |
| 12 aylık geçmiş verinin okuma başarımına etkisi | **ölçülmedi** |
| Tahsilat ve mutabakat yolları | **ölçülmedi** |
| Rapor ve ekstre uçları | **ölçülmedi** |
| Bildirim/mesaj gönderim yolu | **ölçülmedi** |
| Çok örnekli (yatay ölçekli) kurulum | **ölçülmedi** |
| Yedekleme/geri yükleme süresi | **ölçülmedi** |
| Üretim donanımında herhangi bir sayı | **ölçülmedi** |

## Bilinen sınırlar

- Toplu tahakkuk **senkron** çalışır; 5.000 bölümde kullanıcı 50 saniye
  ilerleme göstergesi olmadan bekler (ADR-0013).
- Bir dönemde bir gider türü için **tek** ASIL tahakkuk koşar; ikincisi açık
  "Ek Tahakkuk" beyanı ister (ADR-0014).
- `prisma migrate reset` kapsam politikalarının tablolar arası bağımlılığı
  yüzünden çalışmaz; geliştirme ve CI ortamlarını etkiler, üretim
  `migrate deploy` yolunu etkilemez.
