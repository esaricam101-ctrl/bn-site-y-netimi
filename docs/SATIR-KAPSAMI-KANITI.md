# Satır kapsamı — tablo bazlı kanıt

**Tarih:** 31 Temmuz 2026
**Migration:** [0022](../database/prisma/migrations/0022_satir_kapsami/migration.sql) ·
[0023](../database/prisma/migrations/0023_kirali_mulk_kapsami/migration.sql)
**Sözleşme testi:** `backend/test/contract/satir-kapsami.spec.ts` (CT-13)

Kısıt RLS katmanındadır. Doğru kanıt "her uçta filtre var mı" değil,
**"kapsam politikası olması gereken hangi tabloda politika tanımlı"**dır —
tek bir uç bile kapsanmayan bir tabloyu okursa koruma delinir.

Aşağıdaki tablo canlı veritabanından üretilmiştir (`pg_class` · `pg_policies`),
elle yazılmamıştır.

---

## 1. Kapsam politikası OLAN tablolar (15)

Hepsi `RESTRICTIVE` — tenant politikasıyla **VE**'lenir. `PERMISSIVE` olsaydı
OR'lanır ve tenant izolasyonunu gevşetirdi.

| Tablo | İçerik | tenant pol. | kapsam pol. | Eksen |
|---|---|---|---|---|
| `kisi` | ad · soyad · e-posta · telefon · TCKN · adres · doğum tarihi | ✅ PERMISSIVE | ✅ RESTRICTIVE | kendisi + oturulan hane |
| `bagimsiz_bolum` | daire · m² · arsa payı · tapu | ✅ | ✅ | oturulan + mülk |
| `malik` | hisse · tapu dönemi · vekâlet | ✅ | ✅ | oturulan + mülk |
| `kiraci` | sözleşme · depozito · kefil | ✅ | ✅ | **yalnızca oturulan** |
| `sakin` | yakınlık · giriş/çıkış · acil durum kişisi | ✅ | ✅ | **yalnızca oturulan** |
| `bolum_iliskisi` | rol · dönem | ✅ | ✅ | yalnızca oturulan |
| `borc` | tutar · vade · ödenen | ✅ | ✅ | oturulan + mülk |
| `borc_sorumlusu` | kişi payı · sorumluluk | ✅ | ✅ | kendi payı + mülkün borcu |
| `tahsilat` | ödeme · kanal · tutar | ✅ | ✅ | kendi ödemesi + mülkün tahsilatı |
| `arac` | plaka · sahip | ✅ | ✅ | yalnızca oturulan |
| `misafir` | ad · giriş/çıkış | ✅ | ✅ | yalnızca oturulan |
| `daire_gorevlisi` | bakıcı · yardımcı · telefon | ✅ | ✅ | yalnızca oturulan |
| `sayac` | sayaç no · tip | ✅ | ✅ | yalnızca oturulan |
| `mesaj` | gönderilen ileti gövdesi | ✅ | ✅ | kendi mesajı |
| `iletisim_izni` | İYS izin durumu | ✅ | ✅ | kendi izni |

### Kirada olan mülkte kapsam DARALIR (0023)

| Liste | İçerik | Görünürlük |
|---|---|---|
| `app.kapsam_bolumler` | kiracılık · sakinlik · **kirada olmayan** kendi mülkü | tam hane |
| `app.kapsam_mulk_bolumler` | **kiraya verilmiş** kendi mülkü | **yalnızca borç + ödeme** |

KMK md. 22 uyarınca kiracı ödemezse borç malike döner; malikin menfaati
borçtadır. Kiracının kimliği, sözleşmesi ve ailesi bu menfaatin kapsamında
değildir (KVKK md. 4 veri minimizasyonu).

---

## 2. Kapsam politikası OLMAYAN tablolar (40) — gerekçeleriyle

### 2.1 Kişiye/haneye bağlı DEĞİL — kapsam gerekmez (17)

| Tablo | Neden gerekmez |
|---|---|
| `tenant` | Katalog. RLS de taşımaz (BFS v1 §2.4, bilinçli istisna) |
| `oturum_dizini` | Tenant çözümlemesi; tenant seçiminden ÖNCE okunur. RLS taşımaz |
| `yonetim_delegasyonu` | Firma↔proje bağı. Kişi ekseni yok |
| `apartman` · `blok` · `kat` | Bina yapısı. Kişiye bağlı değil — **aşağıdaki nota bakın** |
| `gider_turu` | Aidat kuralı katalogu (KMK md. 20). Bina geneli referans veri |
| `hesap` | Hesap planı. Referans veri |
| `muhasebe_donemi` · `muhasebe_parametresi` | Dönem ve ayar. Kişiye bağlı değil |
| `banka` · `banka_subesi` · `pos_tanimi` | Katalog |
| `banka_parametresi` | Ayar |
| `numara_sayaci` | Seri sayacı |
| `is_calistirma` | Zamanlanmış iş kaydı |
| `belge_tipi_politikasi` | Saklama/gizlilik kuralı katalogu |

### 2.2 Kapsam GEREKİR ama YOK — **AÇIK** (8)

⚠️ Bunlar kısıtlı rolün erişebildiği ve kişisel/mali veri taşıyan tablolardır.
Kapsam politikaları **yazılmamıştır**.

| Tablo | Taşıdığı veri | Neden henüz yok | Erişen kısıtlı rol |
|---|---|---|---|
| `belge` | sözleşme · karar · tutanak | `bolum_id` yok; belge↔bölüm bağı `belge_iliskisi` üzerinden dolaylı | MALIK · KIRACI · SAKIN · PERSONEL |
| `belge_iliskisi` | belge↔varlık bağı | yukarıdakinin ön koşulu | aynı |
| `belge_etiketi` | etiket | belgeye bağlı | aynı |
| `sayac_okumasi` | tüketim değeri | `bolum_id` yok, `sayac_id` üzerinden dolaylı | MALIK |
| `site_personeli` | personel kimlik · SGK · vardiya | **`bolum_id` YOK** — site geneli. Bölüm ekseniyle kapsanamaz | MALIK · KIRACI |
| `personel_sertifikasi` | sertifika | personele bağlı | MALIK · KIRACI |
| `personel_zimmeti` | zimmet | personele bağlı | MALIK · KIRACI |
| `audit_kaydi` | tüm mutasyon geçmişi | `AUDIT_GORUNTULE` yalnızca DENETÇİ'de; kısıtlı rol erişemiyor | (erişemiyor) |

**`site_personeli` bölüm ekseniyle çözülemez** — site geneli bir kayıttır.
Doğru çözüm izin eksenidir: `KISI_GORUNTULE` bu uçları da açıyor, ayrı bir
`PERSONEL_GORUNTULE` izni gerekir. Bu bir yetki matrisi kararıdır.

### 2.3 Finansal defter — kısıtlı rol erişemiyor (15)

`yevmiye_fisi` · `yevmiye_satiri` · `banka_hareketi` · `banka_hesabi` ·
`banka_ekstresi` · `ekstre_satiri` · `kiymetli_evrak` · `tahsilat_tahsisi` ·
`mesaj_gonderimi` · `mesaj_sablonu` · `otomatik_bildirim_kurali` ·
`kullanici` · `kullanici_rolu` · `geri_alma` · `outbox_kayit`

Hepsi `FINANS_DEFTER_GORUNTULE` · `FINANS_YEVMIYE_GIRIS` · `ILETI_AYAR` ·
`TENANT_YONET` gibi izinlerle korunuyor ve **hiçbiri MALIK/KIRACI/SAKIN/
PERSONEL rollerinde yok**. Kapı 3 erişimi kesiyor.

⚠️ Bu **savunma derinliği değil, tek katman** demektir: izin matrisi
değişirse koruma kalkar. `yevmiye_satiri` `bolum_id` taşıdığı için kapsam
politikası yazılabilir; yazılmadı.

### 2.4 Emin değilim (1)

| Tablo | Belirsizlik |
|---|---|
| `tahsilat_tahsisi` | `bolum_id` yok, `borc_id` üzerinden dolaylı. `tahsilat` ve `borc` kapsanmış olduğu için pratikte erişilemez sanıyorum ama **doğrulanmadı** — join yönüne göre sızabilir. Test yazılmalı. |

---

## 3. Baypas taraması

Kapsam politikası olan tabloları politikayı atlayarak okuyan bir yol var mı?

### 3.1 View / materialized view — **YOK**

```text
SELECT table_name FROM information_schema.views WHERE table_schema='public'  -> 0 satır
SELECT matviewname FROM pg_matviews WHERE schemaname='public'                -> 0 satır
```

View'lar varsayılan olarak tanımlayanın haklarıyla çalışır ve RLS'i atlar;
depoda hiç yok.

### 3.2 `SECURITY DEFINER` fonksiyon — **YOK**

```text
SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef  -> 0 satır
```

Bütün `app_*` fonksiyonları `SECURITY INVOKER` (varsayılan): içlerindeki
okumalar da RLS'e tabi.

### 3.3 Trigger — 2 adet, ikisi de kapsam dışına veri taşımıyor

| Trigger | İş |
|---|---|
| `audit_kaydi.audit_kaydi_degistirilemez` | UPDATE/DELETE reddeder |
| `kullanici.kullanici_oturum_dizini` | `oturum_dizini` senkronu (RLS'siz katalog) |

### 3.4 Ham SQL — 9 çağrı yeri, hiçbiri kapsamlı tablo okumuyor

```text
numara.service.ts:41         pg_advisory_xact_lock         (kilit)
prisma.service.ts:106-109    set_config × 4                (bağlam kurulumu)
health.controller.ts:26      SELECT 1                      (sağlık)
tenant.command.service.ts:80 set_config                    (tenant kurulumu)
seed.ts:118,279              set_config                    (tohum)
```

`$queryRawUnsafe` uygulama kodunda **yok**.

### 3.5 ⚠️ İki bulgu

**(a) `sistemIslemi` kapsam ayarlarını KURMAZ → kısıtsız çalışır.**

`PrismaService.sistemIslemi` yalnızca `$transaction(fn)`'dir; `app.kapsam_*`
yazılmaz, dolayısıyla `app_kapsam_serbest()` **true** döner. Bu bilinçli
(sistem işleri kısıtlanamaz) ama **tasarımca bir baypas yoludur**.

Çağrı yerleri ve erişilebilirliği:

| Yer | Ne okuyor | Kısıtlı rolden erişilebilir mi |
|---|---|---|
| `outbox.publisher.ts:53` | `tenant` (RLS'siz katalog) | Hayır — arka plan işi |
| `oturum.service.ts:65` | `oturum_dizini` (RLS'siz) | Giriş ucu — ama yalnızca dizin |
| `tenant.command.service.ts:50,122` | tenant kurulum/aktifleştirme | Hayır — `TENANT_KURULUM` izni gerekir |

Bugün sızıntı yok. Ama yeni bir `sistemIslemi` çağrısı kapsamlı bir tablo
okursa koruma sessizce delinir — **tarayıcı gerekir** (§6'daki iş).

**(b) `seed.ts` `set_config(..., false)` kullanıyor — OTURUM düzeyi.**

```text
seed.ts:118  set_config('app.tenant_id', '...', false)
seed.ts:279  set_config('app.tenant_id', '...', false)
```

Üçüncü argüman `false` = transaction-local **değil**, oturum düzeyi: bağlantı
havuzuna dönerse ayar sonraki isteğe sızar. Tohum betiği kendi istemcisiyle
çalışıp çıktığı için bugün zararsız; ama bu desen uygulama koduna kopyalanırsa
tenant bağlamı istekler arası sızar. `tenantIslemi` doğru biçimi (`true`)
kullanıyor.

---

## 4. Fonksiyon değişkenliği

```text
app_tenant_id                = s (STABLE)
app_kapsam_serbest           = s
app_kapsam_kisi_id           = s
app_kapsam_bolumler          = s
app_kapsam_mulk_bolumler     = s
app_kapsam_finans_bolumler   = s
app_kapsam_kisileri          = s
```

Hepsi `STABLE`: PostgreSQL sorgu başına bir kez değerlendirebilir, satır
başına değil.

⚠️ **`STABLE` TEK BAŞINA YETMEZ.** Ölçüm bunu gösterdi: `STABLE` yalnızca
"aynı anlık görüntüde aynı sonucu döndürür" der, "sorgu başına bir kez
çalışır" DEMEZ. `WHERE` filtresindeki argümansız çağrı satır başına yeniden
koşuyordu (200 daireli malikte 39 saniye). Çözüm 0025'teki sarmalamadır.

---

## 5. Özyineleme analizi — "kendi kaydını her zaman görür" dalı yeterli mi

**Soru:** kapsam fonksiyonları ayardan okumak yerine tabloyu okusa,
`malik`/`kiraci`/`sakin` politikalarına *"kişi kendi kaydını her zaman
görür"* dalı eklemek özyinelemeyi kırar mı?

**Cevap: HAYIR — birinci sıçramayı kırar, ikincisini kırmaz.**

Zincir iki adımlıdır:

```text
1. sıçrama:  kisi_kapsam  ->  app_kapsam_kisileri()  ->  malik/kiraci/sakin okur
2. sıçrama:  malik_kapsam ->  app_kapsam_bolumler()  ->  malik okur   <-- ÖZYİNELEME
```

*"Kendi kaydın"* dalı (`kisi_id = app_kapsam_kisi_id()`) yalnızca **1.
sıçramanın kendi satırlarını** çözer. Ama kapsamın asıl işi bu değildir:
malikin **kendi hanesindeki SAKİNİ** görmesi gerekir ve o sakinin
`sakin` satırı **başkasının** `kisi_id`'sine aittir. O satırı görebilmek
için politikanın *"kapsamımdaki bölümün kaydı"* dalına ihtiyacı var:

```sql
OR bolum_id IN (SELECT unnest(app_kapsam_bolumler()))
```

Bu dal eklendiği anda `app_kapsam_bolumler()` tabloyu okumak zorunda kalır
(çünkü ayar kaldırılmıştır) ve **`malik` politikası kendi kendini çağırır**.
PostgreSQL bunu `infinite recursion detected in policy for relation "malik"`
ile keser.

**Sonuç:** ayarı kaldırmak, *"kendi kaydın"* dalı eklenerek çözülemez.
Özyinelemeyi kırmanın yolları yalnızca şunlar:

| Yol | Bedel |
|---|---|
| Bölüm listesini ayarda tutmak (**bugünkü tasarım**) | 185 KB ayar |
| `SECURITY DEFINER` fonksiyon | ADR-0002 ile çelişir — **geri çekildi** |
| Bölüm listesini ayrı, kapsam politikası OLMAYAN bir tabloda tutmak | Yeni tablo + tazelik sorunu |

Bugünkü tasarım (ayar) bilinçli bir seçimdir, eksiklik değil.

---

## 6. Gerçekçi azami daire sayısı — mimari kararı etkiler

**5.000 sentetik bir EN KÖTÜ DURUMDUR, gerçek gereksinim değil.**

Kapsam **proje (tenant) bazlıdır** — ADR-0002 ve ADR-0008 uyarınca tenant =
bir apartman ya da site. Tek bir malikin **tek bir projede** sahip
olabileceği daire sayısı, o projenin toplam daire sayısıyla sınırlıdır.

| Durum | Gerçekçi daire | Not |
|---|---|---|
| Tipik kat maliki | **1–3** | Ezici çoğunluk |
| Yatırımcı (aynı sitede) | 5–20 | Yaygın |
| Müteahhit payı (kat karşılığı) | 20–80 | Tek projede üst sınır |
| Kurumsal malik / tek elden site | 100–400 | Nadir ama gerçek |
| **5.000** | ❌ | Tek projede bu kadar daire zaten yok |

Ölçülen 200 daireli senaryo (**10,6 ms**) müteahhit/kurumsal malik durumunu
zaten kapsıyor. 5.000, bir portföy yönetim firmasının **bütün projelerinin
toplamına** karşılık gelir — ama firma **YONETIM_SIRKETI** rolündedir ve
`yalnizcaKendiVerisi` taşımaz, yani **kapsam hiç kurulmaz**. O yol
ADR-0009'un açık devir mekanizmasıdır, kapsam ekseni değil.

**Karar için sonuç:** 185 KB'lık ayar boyutu **teorik bir üst sınırdır**.
Gerçek en kötü durum ~400 daire ≈ **14,8 KB**. Ayar boyutunu küçültmek
(base64/bytea) bu ölçekte bir sorunu çözmez — ürün sahibinin "şimdilik
küçültme" kararı ölçümle uyumludur.
