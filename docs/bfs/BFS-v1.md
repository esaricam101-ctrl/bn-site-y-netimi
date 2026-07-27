# BFS v1 — Framework Specification

**BNOS Apartman Yönetimi Modülü · Teknik Standartlar**

**Sürüm:** 1.0
**Tarih:** 26 Temmuz 2026
**Statü:** yürürlükte
**Sahip:** Baş mimar
**Kaynak:** ADR v1.1 §41 · ADR-0001 … ADR-0006
**Kapsam:** Faz 0 teslimatı — Blok-1'in yazılabilmesi için gereken standartlar

> §41 tek kaynak kuralı: Bu belgede yaşayan bir karar başka belgede tekrarlanmaz, referans verilir.
> Bu belge *ne olduğu*nu tutar. *Neden* öyle olduğu `docs/adr/log/` altındadır.

---

## 1. Katmanlar ve paket sınırı

### 1.1 Paket yapısı (ADR v1.1 §40)

```text
packages/
├── shared-kernel/      Money · Zaman · Sonuç tipleri · Principal · Portlar
│                       → hiçbir domain'e bağımlı değil
├── core-domain/        Tenant · Kişi · Belge · Talep · Bildirim · Duyuru
│                       Personel · Tedarikçi · Sözleşme · Muhasebe çekirdeği
│                       → dikeyden bağımsız
├── apartman-domain/    KMK kuralları · Arsa payı · Bağımsız bölüm
│                       Malik/Kiracı · Genel kurul · Yönetim planı
│                       → yalnızca Apartman dikeyi
├── bnos-client/        BNOS kernel tüketicisi (Memory, KG, BRE, Workflow…)
├── module-sdk/         ModuleManifest + sözleşme testleri
└── ui-tokens/          Tek kaynaktan web + mobil tema
```

### 1.2 Bağımlılık kuralı — CI'da zorlanır

```text
shared-kernel  ←  core-domain  ←  apartman-domain  ←  apps/*
```

**`core-domain` hiçbir koşulda `apartman-domain`'e bağımlı olamaz.** İhlal derlemeyi durdurur (`.github/workflows/dependency-boundary.yml`).

Bu tek kural, ikinci dikey (Site) başladığında çıkarmayı mekanik hale getirir. Genel `Tesis → Birim` soyutlaması v1'de **kurulmaz** — kullanılmayan bir soyutlamayı bakımda taşımak, sınır disiplininden pahalıdır.

### 1.3 Uygulama katmanları

```text
apps/api/src/modules/<modül>/
├── domain/          Entity · Value Object · Domain Service · Politika
│                    → framework bağımsız, Prisma bilmez
├── application/     CommandService · QueryService · DTO · Port arayüzleri
├── infrastructure/  Repository (Prisma) · Adaptörler · Dış servis istemcileri
└── presentation/    Controller · Guard · Interceptor · Pipe
```

Bağımlılık yönü içe doğrudur: `presentation → application → domain`. `infrastructure` yalnızca `application`'ın tanımladığı portları uygular.

---

## 2. Multi-tenancy (ADR-0002)

### 2.1 Kural

Tek veritabanı · her tenant-kapsamlı tabloda `tenant_id UUID NOT NULL` · PostgreSQL Row Level Security.

**Her tenant bir apartmandır.** `portfolio`, `group`, `site` kapsamları uygulanmaz.

### 2.2 RLS politikası şablonu

Her tenant-kapsamlı tablo için migration'da zorunludur:

```sql
ALTER TABLE <tablo> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tablo> FORCE  ROW LEVEL SECURITY;

CREATE POLICY <tablo>_tenant_isolation ON <tablo>
  USING      (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

`FORCE` zorunludur — tablo sahibi rol de politikaya tabi olur.

### 2.3 Uygulama kuralları

1. Uygulama veritabanı rolünün **`BYPASSRLS` yetkisi yoktur.** CI'da test edilir.
2. Her transaction başında `SET LOCAL app.tenant_id = '<uuid>'` çalıştırılır. Prisma Client Extension ile merkezî olarak enjekte edilir.
3. `app.tenant_id` ayarlanmamışsa sorgu **hata verir.** Sessizce boş sonuç dönmez — `current_setting('app.tenant_id')` ayarsızken PostgreSQL hata üretir ve bu davranış korunur.
4. İzolasyon uygulama katmanındaki `where` koşuluna **bağlı bırakılmaz.** Veritabanı zorlar.
5. Migration'lar ve arka plan işleri de bağlam kurmadan tenant verisine erişemez. Sistem işleri `SISTEM` principal'ı ile açık tenant döngüsü kurar.

### 2.4 Tenant dışı tablolar

Referans verisi (il/ilçe, para birimi, sabit enum tabloları) tenant kapsamı dışındadır ve RLS taşımaz. Liste BFS'te açıkça tutulur; her ekleme gerekçe gerektirir.

---

## 3. Üç kapı (ADR-0006)

Korumalı her endpoint sırayla: **Kimlik → Kiracı → İzin**.

| Kapı | NestJS bileşeni | Başarısızlık |
|---|---|---|
| 1 · Kimlik | `AuthGuard` — JWT doğrula, `Principal` çöz | `401` |
| 2 · Kiracı | `TenantGuard` — üyelik doğrula, `TenantContext` kur | `403` |
| 3 · İzin | `PermissionGuard` — `@RequirePermission('...')` | `403` |

**Kurallar:**

- Sıra değişmez. İzinler tenant'a görelidir; bağlam kurulmadan değerlendirilemez.
- Kapsam dışı istek `403` döner, filtrelenmiş `200` **değil.**
- Guard zinciri global kayıtlıdır. `@Public()` dekoratörü açık ve gerekçelidir.
- Üç kapının geçilmesi Audit Log'a yazılır.
- RLS kapıların yerine geçmez; son savunma hattıdır.

### 3.1 Principal (ADR v1.1 §39)

```text
Principal = { id, tip, tenantId, izinler[], devraldigiPrincipalId? }
tip: INSAN | AGENT | PLUGIN | CIHAZ | SISTEM
```

Her principal kendi kimliğiyle Audit Log'a yazar. Devralınmış yetki, **devraldığı kapsamın alt kümesidir** — hiçbir principal kendisini devreden principal'dan geniş yetkiye sahip olamaz. Bu kural tek yerde uygulanır (`PermissionGuard`), her çağrı yerinde tekrarlanmaz.

---

## 4. Zaman standardı (ADR v1.1 §34)

### 4.1 Tip haritası — bağlayıcı

| Kategori | Tip | Alanlar |
|---|---|---|
| **An (instant)** | `timestamptz` · UTC | `olusturulma_tarihi` · `guncelleme_tarihi` · `silinme_tarihi` · audit `occurred_at` · event `yayinlanma_tarihi` · oturum · mesaj · log · `odeme_kaydi_zamani` |
| **Takvim tarihi** | `DATE` · saat dilimsiz | **`vade_tarihi`** · `tahakkuk_donemi` · `donem_baslangic` · `donem_bitis` · `genel_kurul_tarihi` · `sozlesme_baslangic/bitis` · `fatura_tarihi` · `valor_tarihi` · `butce_yili` |

Prisma karşılığı: `DateTime @db.Timestamptz(6)` ve `DateTime @db.Date`.

### 4.2 Tenant saat dilimi

`Tenant.saat_dilimi` alanı zorunludur, varsayılan `Europe/Istanbul`. Türkiye 2016'dan beri sabit UTC+3'tür — **bu koda gömülmez**, tenant ayarıdır.

### 4.3 Türetilmiş kurallar

- Gecikme günü hesabı **tenant takviminde** yapılır, UTC'de değil.
- Dönem sınırları tenant yerel takvim sınırlarıdır.
- Zamanlanmış işler tenant saat dilimine göre tetiklenir.
- API: ISO 8601, UTC, offset açık — `2026-07-26T09:00:00Z`.
- Arayüz finansal tarihleri **tarayıcı yereline göre biçimlendirmez**; tenant saat dilimini açıkça kullanır. Rapor başlığında saat dilimi yazılır.

### 4.4 Neden bağlayıcı

Vade tarihi `timestamptz` olarak saklanırsa saat dilimi sınırında bir gün kayar. Gecikme faizi "kaç gün geçti" sorusunun cevabıdır — bir günlük kayma her borçlunun faizini yanlış hesaplar ve **hata sessizdir.**

---

## 5. Silme standardı (ADR v1.1 §33)

### 5.1 Üç sınıf

| Sınıf | Davranış | Örnek |
|---|---|---|
| **Finansal kayıt** | **Asla silinmez.** Düzeltme ters kayıtla (storno) | JournalEntry · JournalLine · Payment · Receipt · Assessment · Borç |
| **Ana veri** | **Soft delete** | Kişi · Bağımsız bölüm · Blok · Tedarikçi · Personel · Hesap planı kalemi |
| **Belge** | **Versiyon + arşiv.** Üzerine yazılmaz | Sözleşme · Yönetim planı · Rapor · Karar ekleri |

### 5.2 Soft delete alanları — standart

```text
silindi_mi        BOOLEAN     NOT NULL DEFAULT false
silinme_tarihi    TIMESTAMPTZ NULL
silen_kullanici   UUID        NULL
silme_gerekcesi   TEXT        NULL
```

### 5.3 Dört zorunlu uygulama kuralı

1. **Kısmi unique index.** Her doğal anahtar için:

   ```sql
   CREATE UNIQUE INDEX <tablo>_<alan>_uq ON <tablo> (tenant_id, <alan>)
     WHERE silinme_tarihi IS NULL;
   ```

   Bu atlanırsa silinen "A-3 dairesi" yeni "A-3" oluşturulmasını kalıcı olarak engeller.

2. **Varsayılan filtre merkezîdir.** Prisma Client Extension ile global uygulanır. Her `where` koşuluna elle eklenmez — biri unutulduğunda silinmiş kayıt sızar. Silinmişleri görmek açık bir çağrı gerektirir (`withDeleted()`).

3. **Bağımlılık kontrolü.** `SilinebilirlikPolitikasi` olarak **veri** biçiminde tanımlanır, koda gömülmez. Örnek: açık borcu olan bağımsız bölüm soft-delete edilemez.

4. **Soft delete ≠ hard delete ≠ anonimleştirme.** KVKK silme talebi ayrı bir işlemdir: `anonimlestir()` — kişisel tanımlayıcılar geri döndürülemez şekilde kaldırılır, finansal kayıt bütünlüğü korunur (borç kaydı kalır, kişi "Anonim Kişi #4821" olur). Sprint 9.

---

## 6. CQRS (ADR v1.1 §32)

### 6.1 Kural

Her aggregate için ayrı servisler:

```text
<Aggregate>CommandService   ← yazma · transaction sınırı burada
<Aggregate>QueryService     ← okuma · optimize SQL / view kullanabilir
```

1. **Query hiçbir koşulda yazmaz.** Command hiçbir koşulda okuma amaçlı kullanılmaz.
2. **Command tam okuma modeli döndürmez.** `{ id, durum }` (gerekirse `version`) döndürür. İstemci gerekiyorsa Query çağırır.
3. **Query domain katmanını atlayabilir** — doğrudan optimize SQL, view veya materialized view. Ayrımın asıl amacı budur.
4. **RLS her ikisine de uygulanır.** Query'nin domain'i atlaması, tenant izolasyonunu atlaması anlamına gelmez.
5. **Transaction sınırı yalnızca Command servisindedir.**

### 6.2 Muafiyet

Yalnızca değişmeyen referans verisi (il/ilçe, para birimi, sabit enum tabloları). Gerekçe DoD'da yazılır.

### 6.3 API sözleşmesi sonucu

Mutasyon uçları `{ id, status }` döndürür. Bu, istemcide ek bir gidiş-dönüş demektir ve mobil ağ koşullarında hissedilir — **bilerek kabul edilmiştir.** Optimizasyon gerekirse çözüm Command'e okuma modeli eklemek değil, Query'yi hızlandırmak veya istemcide iyimser güncelleme kullanmaktır.

---

## 7. Önbellek (ADR-0005 · ADR v1.1 §37)

### 7.1 Anahtar sözleşmesi

```text
t:{tenantId}:{alan}:{kimlik}:{sürüm}
```

`tenantId` içermeyen önbellek anahtarı **veri sızıntısıdır.** RLS önbelleği korumaz. Kural iki katmanda zorlanır: `@bnos/cache` API'si `tenantId` olmadan derlenmez (tip düzeyi) + ESLint kuralı (`bnos/require-tenant-cache-key`).

### 7.2 Katman tablosu

| Katman | TTL | Geçersizleştirme |
|---|---|---|
| Kullanıcı izin seti | 5 dk | Rol/izin değişim event'i |
| Çözümlenmiş yönetim planı kuralları | 24 sa | Plan sürüm değişim event'i |
| Referans verisi (hesap planı, gider türü, enum) | 24 sa | İlgili değişim event'i |
| Widget verisi | `WidgetKaydi.tazeleme_sikligi` | TTL |
| Oturum / rate limit | doğal | — |
| **Hesap bakiyesi · cari hesap · borç durumu · yaşlandırma · nakit** | **ÖNBELLEKLENMEZ** | — |

### 7.3 Üç kural

1. **Önbellek asla kayıt kaynağı değildir.** Redis tamamen boşaltıldığında sistem yavaşlar, bozulmaz.
2. **Geçersizleştirme domain event'lerle yapılır.** TTL'e bel bağlanmaz.
3. **Bayat finansal rakam, yavaş finansal rakamdan kötüdür.**

### 7.4 ⚠️ Özet tablo ≠ önbellek

Performans için hesap bakiyesi özet tablosu kullanılabilir. **Koşul:** özet, yazma transaction'ının **içinde** güncellenir ve kayıt kaynağının parçasıdır; hiçbir zaman bayat olamaz. TTL taşımaz, geçersizleştirme gerektirmez.

Önbellek ise kaynaktan türetilen ve eskiyen bir kopyadır. Bu ayrım karıştırılırsa §37 ilk performans krizinde sessizce delinir. **Kod incelemesinde özellikle bakılacak nokta budur.**

---

## 8. Numaralandırma (ADR v1.1 §35)

Tüm numaralandırma tek motordan geçer: `NumaraSerisi`.

```text
NumaraSerisi
├── kod · tenant_id · kapsam (TENANT | TENANT_YIL | TENANT_TIP)
├── format_sablonu   ("{onek}-{yil}-{sira:6}")
├── sifirlama        (YOK | YILLIK)
├── tip              (BOSLUKSUZ | BOSLUKLU)
└── mevcut_deger
```

| Seri | Tip | Gerekçe |
|---|---|---|
| Makbuz No · Karar No · Tahakkuk No · Yevmiye No | `BOSLUKSUZ` | Yasal / denetim izi |
| Talep No · Belge No · İş Emri No | `BOSLUKLU` | Yasal gereklilik yok |

**Uygulama:**

- `BOSLUKSUZ`: sayaç tablosu + advisory lock, **kaydın transaction'ı içinde** tahsis. Transaction geri alınırsa numara da geri alınır. PostgreSQL `SEQUENCE` **kullanılmaz** — rollback'te boşluk bırakır.
- `BOSLUKLU`: PostgreSQL `SEQUENCE`. Hızlı, kilitsiz.

⚠️ Boşluksuz seri, seri başına yazma işlemlerini serileştirir. Apartman ölçeğinde sorun değildir. **Yüksek hacimli hiçbir seri `BOSLUKSUZ` yapılmaz.**

---

## 9. Zamanlayıcı (ADR v1.1 §36)

```text
IScheduler (port) · v1 uygulaması: BullMQ üzerinde Redis

ZamanlanmisIs  (kod, cron, tenant_kapsami, kacirilan_calistirma_politikasi,
                yeniden_deneme, sahip)
IsCalistirma   (is, tenant, donem_anahtari, durum, baslangic, bitis, sonuc)
               UNIQUE (is, tenant, donem_anahtari)
```

**Altı kural:**

1. Dönem başına en fazla bir kez — `UNIQUE` kısıtı veritabanı düzeyinde zorlar.
2. Çok örnekli çalışmaya güvenli — dağıtık kilit zorunludur.
3. Tenant saat dilimine duyarlı.
4. Kaçırılan çalıştırma politikası iş bazındadır. **Finansal işler geç çalıştırılır, asla atlanmaz.** Bildirim işleri atlanabilir.
5. Başarısız çalıştırma sessiz kalamaz: geri çekilmeli yeniden deneme → ölü mektup kuyruğu → yöneticiye alarm.
6. Her finansal zamanlanmış iş için **manuel tetikleme ve kuru çalıştırma (dry-run)** bulunur.

---

## 10. Event ve Outbox (ADR v1.1 §31 · ADR-0001)

**Event Sourcing kullanılmaz.** PostgreSQL ilişkisel model tek ve nihai kayıt kaynağıdır.

Domain event'ler üç amaç için üretilir: entegrasyon · Enterprise Memory ve Knowledge Graph beslemesi · denetim zenginleştirme.

**Bilgi yalnızca event'te yaşayamaz.** "Neden değişti" bilgisi ilişkisel modelde (audit tablosu) tutulur.

**Outbox zorunludur** — teslimat garantisi için, kayıt kaynağı olduğu için değil. Event, domain yazmasıyla **aynı transaction içinde** outbox tablosuna yazılır; ayrı bir yayıncı süreç Redis Streams'e aktarır.

Tüketiciler hem **idempotent** hem **replay-toleranslı** olmak zorundadır. Event saklama süresi sınırlıdır (Redis Streams penceresi + arşiv).

Event zarfı ve katalog: `docs/ais/AIS-v1.md`.

**Karışmaması gereken ayrım:** Karar Defteri ve Audit Log append-only, hash zincirli değiştirilemez tablolardır — bunlar Event Sourcing değildir. Değiştirilemezlik hukuki gerekliliğin sonucudur.

---

## 11. Para ve muhasebe (ADR-0003 · ADR-0007)

### 11.1 Temsil

```text
Money = { kurus: bigint, paraBirimi: ParaBirimi, kur: bigint }
Ölçek = 4 basamak  →  PostgreSQL numeric(18,4) ile birebir örtüşür
12,3456 TRY  →  123456n
```

**`number` hiçbir yerde para taşımaz.** Kayan noktalı para ve skaler para birimi kolonu, sonradan tam migration olmadan düzeltilemeyecek iki kusurdur. Lint kuralı `no-restricted-syntax` ile `tutar: number` reddedilir.

`shared-kernel`'in çalışma zamanı bağımlılığı sıfırdır — harici ondalık kütüphanesi kullanılmaz. Gerekçe: ADR-0007.

### 11.2 Beş bağlayıcı kural

1. `money()` yalnızca ondalık `string` kabul eder. `number` alsaydı kayıp çağıran tarafta zaten olmuş olurdu.
2. Dört basamaktan fazlası **sessizce yuvarlanmaz**, hata verir. Yuvarlama çağıranın açık kararıdır.
3. Oranlar `pay`/`payda` tam sayı çifti olarak geçer. Aylık %1,5 faiz → `carpOran(m, 15n, 1000n)`.
4. Yuvarlama **bankacı yuvarlamasıdır** (ROUND_HALF_EVEN). Sistematik yukarı sapmayı önler.
5. Dağıtım farkı kaybolmaz. `dagit()` kalanı en büyük ağırlıklı paya ekler; `Σ paylar === toplam` her koşulda sağlanır ve test edilir. ADR v1.1 §4 gider paylaşımının tek meşru yoludur.

### 11.3 API çıktısı

Sayısal değerler **decimal string** olarak döner, `number` olarak değil: `apiBicimi(m)` → `"1234.5600"`.

### 11.4 Defter

Defter yapısı çift taraflıdır: `JournalEntry` + `JournalLine` (borç/alacak). **İşletme defteri türetilmiş rapordur** ve defterle mutabakatı test edilir — KMK m.36 yükümlülüğü devam eder (ADR-0003 Koşul 1).

Kullanıcıya çift taraflılık dayatılmaz: kayıtlar işlemlerden (tahakkuk, tahsilat, gider, banka) sistem tarafından üretilir. Doğrudan yevmiye girişi ve mizan yüzeyleri yalnızca muhasebeci rolüne açıktır.

---

## 12. API standardı

| Konu | Kural |
|---|---|
| Taban | `/api/v1/<modül>` |
| Kimlik | OAuth 2.0 Bearer (JWT) · 15 dk access · refresh rotasyonu |
| Tenant | **Token claim'inden çözülür**, istek parametresinden asla |
| Hata | RFC 7807 `application/problem+json` |
| Korelasyon | `X-Request-Id` her yanıtta yankılanır |
| Idempotency | Kayıt oluşturan her `POST` için `Idempotency-Key` zorunlu |
| Sayfalama | Cursor tabanlı. Offset yalnızca sabit küçük kümelerde |
| Tarih | ISO 8601 UTC, offset açık |

**Hata mesajı disiplini:** Hiçbir hata yalnızca "Bir hata oluştu" değildir. Her hata korelasyon kimliği ve **tek net sonraki eylem** taşır. Yetki hatası gereken izni adıyla söyler.

---

## 13. i18n

**Kullanıcıya görünen tüm metin i18n anahtarıdır** (§40 sözleşme testi). Gömülü metin derleme sırasında taranır ve derlemeyi durdurur.

Web `next-intl`, mobil aynı sözlüğü paylaşır. Sözlük `packages/ui-tokens/i18n/` altında tek kaynaktır.

Domain sözlüğü (aidat, demirbaş, işletme projesi, arsa payı, gecikme tazminatı, kat malikleri kurulu) resmî ve tutarlıdır; AI çıktıları da bu sözlüğe uyar.

---

## 14. Test

| Tür | Kapsam | Konum |
|---|---|---|
| Birim | Domain kuralları, saf fonksiyonlar | paket içi |
| Entegrasyon | Repository + gerçek PostgreSQL (Testcontainers) | `tests/integration/` |
| **Sözleşme** | §40 listesi — her modül geçmek zorunda | `tests/contract/` |
| E2E | Kritik kullanıcı yolları | `tests/e2e/` |
| **Bağımlılıksız doğrulama** | Mimari kurallar — kurulum gerektirmez | `tools/verify/` |

### 14.1 Sözleşme testleri (§40)

```text
· Tenant izolasyonu — RLS altında çapraz okuma reddedilir (her tablo için, üretilir)
· Her mutasyon Audit Log'a yazar
· Yayınlanan her event standart zarfa uyar ve katalogda kayıtlıdır
· Her korumalı endpoint üç kapıdan geçer (ADR-0006)
· Tüm kullanıcıya görünen metin i18n anahtarıdır
· Soft delete standardına uyum (§5)
· Zaman standardına uyum (§4)
· Önbellek anahtarları tenantId taşır (§7)
· core-domain → apartman-domain bağımlılığı yok (§1.2)
```

Tenant izolasyon testi **üretilir**, elle yazılmaz — her yeni tablo otomatik kapsanır.

### 14.2 Bağımlılıksız doğrulama katmanı

`tools/verify/` altındaki üç betik hiçbir paket kurulumu gerektirmez ve CI'ın **ilk** işidir:

| Betik | Uyguladığı kural |
|---|---|
| `boundary.mjs` | `core-domain ↛ apartman-domain` · `shared-kernel` yaprak paket · domain framework bilmez |
| `cache-key-scan.mjs` | Önbellek anahtarı `tenantId` taşır · finansal alan önbeklenmez |
| `config-check.mjs` | JSON/YAML sözdizimi · `NOBYPASSRLS` · paket adları · `tsconfig` path hedefleri |

**Neden iki katman:** ESLint ve dependency-cruiser daha kesin analiz yapar (AST tabanlı) ve asıl kaynaktır. Bu betikler ise mimari kuralların **bağımlılık kurulumu başarısız olsa bile** doğrulanabilmesini garanti eder. İkisi aynı kuralı uygular; biri diğerinin yerine geçmez.

`pnpm verify` ikisini de içeren tam zinciri yerelde çalıştırır.

---

## 15. Definition of Done

```text
Mimari
· Command/Query ayrımı uygulandı — muafiyet varsa gerekçesi yazıldı (§6)
· Silme sınıfı belirlendi; soft delete varsa kısmi unique index kuruldu (§5)
· Tarih alanları DATE / timestamptz olarak doğru tiplendi (§4)
· Yeni numara serisi NumaraSerisi'ne kaydedildi; BOSLUKSUZ ise gerekçesi yazıldı (§8)
· Yeni zamanlanmış iş IsCalistirma unique kısıtıyla korundu (§9)
· Önbellek anahtarları tenantId taşıyor; finansal bakiye önbeklenmemiş (§7)
· core-domain → apartman-domain bağımlılığı yok (§1.2)

Güvenlik ve uyum
· Tenant izolasyonu her yeni tablo için test edildi (§2, §14.1)
· Her mutasyon Audit Log'a yazıyor
· Her korumalı endpoint üç kapıdan geçiyor (§3)
· Yayınlanan her event standart zarfa uyuyor ve katalogda kayıtlı (§10)
· Tüm kullanıcıya görünen metin i18n anahtarı (§13)

Kalite
· Build temiz · TypeScript hatası yok · linter temiz
· Birim + entegrasyon + sözleşme testleri geçiyor
· Web ve mobil aynı API'yi kullanıyor; platforma özgü iş mantığı yok

Belge
· Kararlar BFS/DMS/AIS'e işlendi; ADR günlüğüne yalnızca karar kaydı yazıldı (§41)
```

---

## 16. Değişiklik kaydı

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.0 | 26.07.2026 | İlk sürüm. Faz 0 teslimatı. §1–§15 |
