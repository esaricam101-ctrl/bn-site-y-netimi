# BNOS — Apartman Yönetimi Modülü
## Mimari Karar Kaydı (ADR Log) — v0.1

> Bu belge çekirdek mimari dokümanı **değildir**. Alınmış kararların kaydıdır.
> Amaç: her yeni sohbette bu kararların tekrar tartışılmasını önlemek.
> Proje bilgi tabanına (Project Knowledge) yüklenmelidir.

---

## 1. Teknoloji Yığını — KİLİTLİ

| Katman | Seçim |
|---|---|
| Backend | NestJS (TypeScript), REST (gerekirse GraphQL) |
| Veritabanı | PostgreSQL |
| ORM | Prisma |
| Önbellek | Redis |
| Dosya | S3 uyumlu Object Storage |
| Frontend | React + Next.js |
| Mobil | React Native (Android + iOS) |
| Gerçek zamanlı | WebSocket |
| Container / CI | Docker, GitHub Actions |

Mevcut çalışan kod tabanı yoktur. Modül sıfırdan geliştirilecektir.

---

## 2. Multi-Tenancy — KİLİTLİ

**Karar:** Tek veritabanı + `tenant_id` + PostgreSQL **Row Level Security (RLS)**.

**Gerekçe:** Hedef ölçek binlerce apartman / on binlerce bağımsız bölüm.
Şema-per-tenant veya DB-per-tenant, Prisma migration yönetimini bu ölçekte
sürdürülemez hale getirir.

**Uygulama kuralı:**
- Her transaction başında `SET LOCAL app.tenant_id = '<uuid>'` çalıştırılır.
- Prisma Client Extension ile merkezî olarak enjekte edilir.
- İzolasyon uygulama katmanındaki `where` koşuluna **bağlı bırakılmaz**;
  veritabanı zorlar. (KVKK denetlenebilirliği için gereklidir.)
- Her tenant = bir apartman. İleride Site / Yönetim Şirketi tenant tipleri eklenecek.

---

## 3. Muhasebe Derinliği — KİLİTLİ

**v1 hedefi:** 634 sayılı KMK'ya uygun **işletme defteri** seviyesi.

Kapsam: Aidat, Borçlandırma, Tahsilat, Cari Hesap, Gelir, Gider, Banka, Kasa,
İşletme Defteri, Mali Raporlar.

**Kısıt:** Veri modeli ileride çift taraflı muhasebeye (yevmiye, büyük defter,
mizan) **şema değişikliği olmadan** genişleyebilmelidir. Bu, kayıt tablolarının
baştan borç/alacak çiftli satır yapısına uygun tasarlanmasını gerektirir.

---

## 4. Gider Sınıflandırması — KİLİTLİ

Her gider türü **üç bağımsız eksen** taşır:

**Eksen 1 — Paylaşım kuralı**
`EŞİT` · `ARSA_PAYI` · `METREKARE` · `TÜKETİM` · `SABİT_TUTAR`

**Eksen 2 — Sorumluluk tipi**
- `MALİKE_AİT` → demirbaş, yatırım, ana yapı onarımı. Her koşulda malik.
- `KULLANANA_AİT` → varsa kiracı, yoksa malik.

**Eksen 3 — Kaynak**
`KMK_VARSAYILAN` · `YÖNETİM_PLANI` · `GENEL_KURUL_KARARI`

Varsayılan KMK md. 20'dir; tenant bazında yönetim planına göre override edilebilir.
Bu iki eksen birbirinden bağımsızdır — bir gider hem arsa payına göre
dağıtılıp hem kullanana yansıtılabilir.

---

## 5. Borç Sorumluluğu — KİLİTLİ

**Karar:** Borç kaydı **bağımsız bölüme** bağlanır, kişiye değil.
Sorumlular sıralı zincir olarak tutulur.

```
Borc (→ BagimsizBolum)
  └── BorcSorumlusu[]
        1. Kiracı  (ASIL)      — varsa
        2. Malik   (İKİNCİL)   — her durumda
```

**Kritik kural — SNAPSHOT:**
Sorumlu kişiler borç **oluşturulduğu anda** çözülür ve kayda yazılır.
Sorgu anında hesaplanmaz. Kiracı Mart'ta taşınırsa Şubat borcu eski kiracıda kalır.

**Gerekli tablo:** `BolumSakinlikDonemi`
(daire, kişi, rol, başlangıç_tarihi, bitiş_tarihi)
Bu tablo olmadan geçmişe dönük sorumlu çözümlemesi ve tahliye senaryoları çalışmaz.
Sonradan eklenmesi maliyetlidir.

---

## 6. Borcun Malike Aktarımı — KİLİTLİ

**Karar:** Ayarlanabilir — hem otomatik hem manuel desteklenir.

- Tenant ayarı: `malige_aktarim_gun_sayisi` (null = otomatik aktarım kapalı)
- Yönetici her zaman manuel aktarım yapabilir.
- Her aktarım Audit Log'a yazılır (kim, ne zaman, hangi gerekçe).

**Borç durum makinesi:**
`AÇIK → GECİKMİŞ → MALİKE_AKTARILDI → KAPANDI`
(`İPTAL` ve `İTİRAZLI` durumları ayrıca tanımlanacak.)

> ⚠️ Açık kalan: varsayılan gün sayısı ne olacak? (Öneri: 30 gün)

---

## 7. Ödeme Mahsup Sırası — KİLİTLİ

**Karar:** FIFO — gelen ödeme en eski açık borçtan başlayarak kapatır.

**Uygulama notu:** Aynı vade içinde kapatma sırası
`gecikme faizi → anapara` olmalıdır; aksi halde faiz bakiyesi sürekli devreder.
Bu sıra da tenant ayarı olarak tutulmalıdır.

---

## 8. Gecikme Faizi — KİLİTLİ

**Karar:** KMK md. 20 varsayılanı — **aylık %5 gecikme tazminatı**.

**Uygulama notu:** Değer koda gömülmez; tenant ayarı olarak tutulur,
varsayılanı %5'tir. Mevzuat değişikliğine ve genel kurul kararına açık kalır.
Hesaplama basit faiz olarak, ödenmemiş anapara üzerinden işletilir.

---

## 9. Para Akışı ve Ödeme Hatları — KİLİTLİ

İki hat kesin olarak ayrılmıştır:

**Hat A — Aidat / Ortak Gider**
- Sakinler doğrudan **apartmanın kendi banka hesabına** öder.
- BNOS parayı **hiçbir noktada elinde tutmaz**.
- BNOS'un rolü: hesap hareketini okumak, mutabakat, eşleştirme, raporlama.
- Uygulama içi kartla ödeme eklenirse: iyzico **alt üye işyeri (submerchant)**
  modeli kullanılır, hakediş doğrudan apartmanın IBAN'ına geçer.
- ⚠️ Para BN'nin kendi üye işyeri hesabına düşerse bu hat bozulur ve
  faaliyet ödeme hizmeti niteliği kazanır.

**Hat B — BN Hizmet Bedeli (SaaS)**
- iyzico vb. üzerinden abonelik tahsilatı. Standart.

**Banka entegrasyonu:** Altyapı v1'de kurulur (çoklu hesap, hesap hareketi,
otomatik mutabakat, AI eşleştirme). Açık Bankacılık arayüzü mimaride yer alır
ancak canlı bağlantı ileri faza bırakılır.

> Not: Lisans/mevzuat tarafı bir hukuk danışmanına teyit ettirilmelidir.
> Bu belge hukuki görüş değildir.

---

## 10. KVKK — KİLİTLİ

- Malik ve kiracı yalnızca **kendi** finansal verisini görür.
- Sakinler birbirinin borç, iletişim ve kişisel bilgisine erişemez.
- Yönetici ve yetkili muhasebe kullanıcıları görev kapsamıyla sınırlı erişir.
- Tüm erişimler Audit Log'a yazılır.
- Veri minimizasyonu ve saklama süresi politikası yetki matrisi dokümanında
  tanımlanacaktır.

---

## 11. Kapsam Sınırı — KİLİTLİ

- v1 = **yalnızca Apartman Yönetimi**.
- Site Yönetimi ve Yönetim Şirketi aynı çekirdek üzerine sonra eklenecek.
- Yönetim şirketi kullanımı zorunlu değildir.
- BNOS çekirdek servisleri **yeniden tasarlanmayacaktır**.
- LLM hiçbir zaman ilk çalışan bileşen değildir. Sıra:
  `Enterprise Memory → Knowledge Graph → Business Rules Engine → AI Agent → (gerekirse) LLM`

---

## 12. Doküman Üretim Sırası — KİLİTLİ

```
0. BNOS Core Service Contracts   ← önce bu
1. Veri Modeli
2. Yetki Matrisi
3. İş Kuralları
4. API Sözleşmesi
```

Her doküman 10–20 sayfa hedefinde, kod üretimine referans olacak yoğunlukta.

---

## Açık Kalan Sorular

1. Malike otomatik aktarım varsayılan gün sayısı? (Öneri: 30)
2. Ödeme mahsup sırasında faiz mi anapara mı önce? (Öneri: faiz)
3. Aidat avansı (KMK md. 20 avans sistemi) v1'de olacak mı?
4. Genel kurul / karar defteri v1 kapsamında mı, yoksa Belgeler modülüne mi bırakılıyor?
5. Kiracı sorumluluğunun kira bedeliyle sınırlı olması (KMK md. 22) sistemde
   takip edilecek mi, yoksa yönetici insiyatifine mi bırakılacak?
