# Yol haritası

**Son güncelleme:** 1 Ağustos 2026

Bu belge *nerede durduğumuzu* söyler. Ayrıntılı devir notu
[`SESSION_SUMMARY.md`](SESSION_SUMMARY.md), ölçülmüş kapasite
[`docs/KAPASITE.md`](docs/KAPASITE.md), kararlar `docs/adr/log/` altındadır.

> Kural: buraya **ölçülmemiş sayı yazılmaz**. Ölçülmeyen şey "ölçülmedi"
> olarak listelenir.

---

## ✅ Kapananlar

| İş | Nasıl kapandı | Kanıt |
|---|---|---|
| **Çift tahakkuk** — kesilen istek sonrası tekrar deneme her daireyi iki kez borçlandırıyordu (ölçüldü: 5.000 yerine 10.000 satır) | Koruma uygulama sayımından **veritabanı kısıtına** taşındı; çalışma kaydı işlemin ilk yazması | [ADR-0014](docs/adr/log/0014-mukerrer-tahakkuk-korumasi.md) · migration 0026 · CT-16 |
| **Gider türü sınıflandırması** — "dönemde tek tahakkuk" kuralı bütün türlere uygulanıyordu | `DONEMSEL` / `OLAY_BAZLI` ayrımı; olay bazlı türlerde `referans` zorunlu | 0027 · 0029 · CT-16 (7–10) |
| **Referans normalleştirmesi** — `FT-2026-001` ile `ft 2026 001` iki ayrı kayıt sayılıyordu | Saklanan üretilmiş kolon + `COLLATE "C"` + Türkçe `translate()` | 0028 · CT-16 (11–12) |
| **`Idempotency-Key` okunmuyordu** — BFS v1 §366 zorunlu kılıyordu, depoda hiçbir yer okumuyordu | `IdempotansInterceptor` + tablo; aynı anahtar ilk yanıtı döner | 0026 · CT-16 (4) |
| **`set_config` birleştirmesi** — dört ayrı gidiş-dönüş bağlantıyı `idle in transaction` tutuyordu | Tek sorguda; doygunlukta boş bekleme %23,2 → %13,0, verim +%26, p95 −%21 | `SESSION_SUMMARY` §3.K |
| **Isıtma/yakıt çakışması** — aynı dönemde ikisi tahakkuk edilirse ısınma gideri iki kez yansıyordu | Engelleme değil **uyarı**: `uyarilar[]` + denetim kaydı; çakışma tanımı veri | ADR-0014 §2c · 0030 · CT-17 |
| **Satır kapsamı** — malik/kiracı/sakin tüm sitenin verisini çekebiliyordu | RESTRICTIVE RLS politikaları, tek noktada kurulan kapsam | ADR-0011 · 0022–0025 · CT-13/CT-14 |
| **`prisma migrate reset` kırık** | Kök sebep **şema sahipliği** — `bnos_migrator` şemayı düşüremiyordu. Sahiplik + veritabanı üzerinde `CREATE` verildi. **Gerçek CI'da doğrulandı:** `migrate reset — geri dususe girmeden` adımı geçti; adım çıktıda `fallback` görürse `exit 1` verir | [docs/VERITABANI-KURULUM.md](docs/VERITABANI-KURULUM.md) · koşu `78c8277` |
| **CI veritabanı yanlış rollerle kuruluyordu** | `01-roles.sql` veritabanı adından bağımsızlaştırıldı, CI'da da koşuyor. **Gerçek CI'da doğrulandı:** `Rol kurulumu dogrulamasi` adımı geçti; şema sahibi `bnos_migrator` değilse veya bir `bnos_%` rolü `BYPASSRLS` taşırsa `exit 1` verir | koşu `78c8277` |
| **CI hiç çalışmıyordu** | Tetikleyicide `master` yoktu. Eklendi; CI ilk kez `f53da93`'te koştu | `.github/workflows/ci.yml` |
| **★ CI TAMAMEN YEŞİL** | Dört iş de `success`; sözleşme testleri **uygulama rolüyle** koşuyor | koşu `f7aeacf` |
| **Tohum = demo fikstürü** | 12 daire · söylenebilir isimler · 3 kiracı · 3 dönem tahakkuk · 12 açık borç (23.400 TL). CI'ın kullandığı veri sunumda gösterilen veri | `database/seeds/seed.ts` |

Sözleşme paketi: **69 test, 9 dosya.**

---

## ⚠️ Çürütülen varsayımlar

Kayıt için tutuluyor: yanlış bir kök sebebe göre iş yapılsaydı ne olacaktı.

### "`migrate reset`'i çapraz tablo politikaları kırıyor" → **YANLIŞ**

Hata mesajı politikaları gösteriyordu:

```text
ERROR: cannot drop table borc because other objects depend on it
DETAIL: policy tahsilat_kapsam on table tahsilat depends on table borc
```

**Gerçek kök sebep şema sahipliğiydi.** Prisma reset önce
`DROP SCHEMA public CASCADE` dener; `bnos_migrator` şemanın sahibi olmadığı
için bu adım *"must be owner of schema public"* ile düşüyor ve Prisma
**CASCADE'siz** tek tek düşürmeye geri düşüyordu. Politikalar, hiç
kullanılmaması gereken o yolun takıldığı engeldi.

Kanıt — aynı zincir, iki veritabanı:

| veritabanı | şema sahibi | `DROP SCHEMA` | reset |
|---|---|---|---|
| `bnos_apartman` | `pg_database_owner` → postgres | ❌ yetki yok | ❌ geri düşüş, hata |
| deneme veritabanı | `bnos_migrator` | ✅ 118 nesne | ✅ çalıştı |

**Bu ayrım neden önemliydi:** politikaları yeniden yazmak seçeneklerden
biriydi. Seçilseydi `tahsilat_kapsam` ve `borc_sorumlusu_kapsam`'ın kapsam
mantığı değişecek, **güvenlik davranışı gereksiz yere riske girecek** ve
A0.7'deki 17 negatif testin tamamı yeniden kanıtlanmak zorunda kalacaktı.
Kök sebep doğru bulunduğu için tek satırlık bir yetki düzeltmesi yetti;
hiçbir politikaya dokunulmadı.

### "Şema sahipliği tek başına yeter" → **YANLIŞ**

Sahiplik verilince `DROP SCHEMA` çalıştı ama ardından gelen
`CREATE SCHEMA public` *"no schema has been selected to create in"* ile düştü
ve **veritabanı şemasız kaldı**. Şema yaratmak, şema üzerinde değil
**veritabanı** üzerinde `CREATE` yetkisi ister. İkisi birlikte gerekiyor.

### "CI'da testler koşuyor ve güvenlik doğrulanıyor" → **YANLIŞ**

CI hiç çalışmıyordu: tetikleyici `main`/`develop` idi, çalışılan dal
`master`. Üstelik çalışsaydı bile veritabanına **süper kullanıcı** olarak
bağlanıyordu — süper kullanıcı RLS'i baştan atlar. Yerelde CI'ın tam
yapılandırmasıyla koşturulduğunda CT-01'in 5 testinden **4'ü düştü**:

```text
× B tenant, A tenant kaydını GÖREMEZ        → 16 satır gördü
× B tenant, A tenant kaydına yazamaz        → yazabildi
× bağlam kurulmadan sorgu HATA verir        → vermedi
× uygulama rolünün BYPASSRLS yetkisi yoktur → expected true to be false
```

### "CI iş akışı eklendi, demek ki koşuyor" → **YANLIŞ**

İş akışı dosyasının var olması, kurulumunun başarılı olduğu anlamına gelmez.
Tetikleyici düzeltildikten sonraki **ilk gerçek koşu** (`f53da93`), pnpm
kullanan üç işin hepsinde `pnpm/action-setup@v4` adımında düştü ve bütün
doğrulama adımları **ATLANDI**:

```text
=== Derleme · Tip · Lint · Test :: failure
  HATA Run pnpm/action-setup@v4
  ATLA Veritabani rolleri (01-roles.sql)
  ATLA Rol kurulumu dogrulamasi
  ATLA Sozlesme testleri — BFS v1 §14.1
```

Yani sonuç **yeşil de kırmızı da değildi — hiç çalışmamıştı.** Yalnızca pnpm
kullanmayan `mimari` işi geçmişti ve tek başına bakıldığında "CI var, bir
şeyler geçiyor" görüntüsü veriyordu.

### "Yerelde yeşil olan test doğru koşullarda yeşildir" → **YANLIŞ**

CI'ı yeşile döndürmek **beş tur** sürdü ve her turda **başka bir sınıf** arıza
çıktı. Hiçbiri yerelde görünemezdi:

| # | Arıza | Kök sebep |
|---|---|---|
| 1 | pnpm kullanan üç iş kurulumda düştü | `packageManager` varken `version` da verilmesi |
| 2 | Birim testleri | Node sürümü: yerel 24 ↔ CI 22 |
| 3 | Birim testleri | Derleme sırası — `backend/dist` ve `tests/.derleme` yoktu |
| 4 | Birim testleri | `pathname.slice(1)` Windows yamasıydı, Linux'ta mutlak yolu bozuyordu |
| 5 | Sözleşme testleri | `JWT_SECRET` yok → sonra tohum yok |

**★ ORTAK SEBEP — listeyi değil bunu hatırla:**

> Geliştirme makinesi **Windows**, CI **Linux**. Hiçbir yerel kapı bu farkı
> göremez. İkisi de kendi içinde tutarlı olduğu için sapma **aylarca**
> görünmez kalır ve ancak CI koştuğunda ortaya çıkar — tur başına 3–5 dakika.

Aynı sınıfın altıncı örneği ölçüm sırasında çıktı: `config-check`'in YAML
doğrulayıcısı dosyayı **sistem kodlamasıyla** açıyordu. `ci.yml`'e ASCII dışı
bir karakter konunca denetim **yalnızca Windows'ta** düştü, Linux'ta geçerdi.
Kontrolün kendisi platforma bağlıysa, kontrol güvenilmezdir.

Her biri için kalıcı bir kapı bırakıldı: Node sürümü tek kaynakta
(`config-check`), derleme bağımlılığı açık mesajla (`test-onkosul`), ortam
sözleşmesi senkron (`env-sozlesme-check`), YAML kodlaması sabit, ve hata metni
artık **admin yetkisi olmadan** okunabiliyor
(`.github/actions/kosu-ve-raporla`).

⚠️ **Kalan yapısal boşluk:** yerelde Linux koşturulmuyor. WSL2 **kurulu**
(Ubuntu 24.04) ama **içi boş** — node/pnpm yok, Docker entegrasyonu kapalı.
Kapanmazsa yedinci örnek de CI'da bulunacak.

### ★ Genel ders — üçü de aynı sınıftan

Bu üç bulgunun ortak yanı şudur: **güvence mekanizmasının kendisi
doğrulanmamıştı.** RLS politikaları vardı ama CI onları hiç sınamıyordu;
CI iş akışı vardı ama hiç koşmuyordu; koştuğunda da kurulum adımında
düşüyordu.

Bundan sonra her koruma için şu soru cevaplanmalıdır:

> **Bu koruma olmasaydı ne kırılırdı — ve o kırılmayı bir kez gördüm mü?**

**Kırmızı olduğu görülmemiş bir test, yeşil olduğunda bir şey kanıtlamaz.**
Bu, ADR-0011'deki "psql üretim yolunu temsil etmez" dersinin aynısıdır:
ölçüm ancak DOĞRU KOŞULLARDA yapıldığında bir şey söyler.

Uygulaması: bu depoda artık her yeni koruma adımı, koruma bozukken
**gerçekten kırmızı verdiği görülerek** ekleniyor — `migrate reset`
adımının `fallback` denetimi ve `Rol kurulumu dogrulamasi` adımının
`exit 1` yolları böyle kuruldu.

---

## 📏 Ölçüm bulguları — karar dayanağı

- **`connection_limit` DEĞİŞTİRİLMEMELİ.** `set_config` birleştirmesinden
  sonra havuz boyutu belirleyici olmaktan çıktı: 5 / 15 / 20 / 30 arasında
  fark yok (49–53 istek/sn, koşum oynaklığı içinde). Birleştirme öncesi
  ölçülen 44 → 70 kazancı, bağlantıların `set_config` gidiş-dönüşlerinde
  tutulmasından kaynaklanıyordu. Kanıtsız yapılandırma eklemek yalnızca bakım
  yüküdür.
- **Toplu tahakkuk doğrusaldır**: bölüm başına ≈10 ms, 500'den 5.000'e sapma
  %1,8. Kırılma noktası yok — mimari sağlam.
- **Doygunluk 10 eşzamanlı kullanıcıda**, verim tavanı ~50–70 istek/sn.
  Kullanıcı bekler, hata almaz.
- **Kapsam kurulumu O(tenant)**: 13.000 kişilik tenant'ta ≈39 ms, 30 kişilik
  tenant'ta ≈14 ms. Kapsam iki durumda da 1 bölüm.

Ayrıntı: [`docs/KAPASITE.md`](docs/KAPASITE.md).

---

## 🔒 CI kapıları

| iş | ne doğrular |
|---|---|
| `mimari` | paket sınırı · önbellek anahtarı · yapılandırma tutarlılığı |
| `kalite` | derleme · tip · lint · birim + **sözleşme testleri (uygulama rolüyle)** |
| `migration` | boş veritabanına zincirin tamamı · her migration uygulandı mı · **`migrate reset` geri düşüşe girmeden** · reset sonrası RLS politikaları duruyor mu |
| `belge` | markdown lint |

Gerçek koşu durumu (`78c8277`): `mimari` ✅ · `belge` ✅ · `migration` ✅ ·
`kalite` ❌ (`Birim testleri` adımında; sözleşme testleri **atlandı**).

`migration` işi bu turda eklendi. `01-roles.sql` artık veritabanı adından
bağımsızdır ve CI'da da koşar; iş, şema sahibini ve `BYPASSRLS`
taşınmadığını **açıkça doğrular**.

Şema bağımlılık envanteri (2 çapraz politika · 1 üretilmiş kolon · 2 trigger ·
9 fonksiyon · 50 enum · 0 view): [`docs/VERITABANI-KURULUM.md`](docs/VERITABANI-KURULUM.md).

---

## 🔶 Açık işler

### Karar bekleyenler

| Konu | Durum |
|---|---|
| **ADR-0013 · toplu işlem partileme** | Desen kabul edildi, ayrıntılar açık: parti büyüklüğü, kısmi başarı semantiği, geri alma, ilerleme göstergesi. Gerekçe artık işlem sınırı değil (ölçümle çürütüldü); vekil kesmesi, kesilen isteğin sessizce sürmesi, eşzamanlı tahakkukların çekişmesi ve kullanıcının ilerleme görememesi. |
| **ADR-0015 · yıl sonu kapanışı** | Altı soru açık: hangi kayıtlar üretilir, dönem kilitleme, kapanmış dönemde düzeltme, devir bakiyesi, denetçi raporu, tebligat/icra zinciri. Karar verilmedi. |
| **Proje ısınma modeli ayarı** | `PAY_OLCERLI \| PAY_OLCERSIZ`. Geldiğinde ADR-0014 §2c'deki uyarı gerçek kurala dönüşür. |
| **[ADR-0016](docs/adr/log/ADR-0016-virman.md) · virman** | Dört bölüm açık. **A**: virman iki bacağı bağımsız muhasebeleşiyor (para kaybolmuş görünür) — öneri "tek fiş", karar bekliyor; kasa↔banka yolu yok. **B** ve **C**: ürün sahibinin soru listeleri **henüz gelmedi**. **D**: motor var, arayüz yok. Sebep kodu listesi onay bekliyor. |

### Teknik borç

| Konu | Öncelik | Not |
|---|---|---|
| **Kapsam kurulumu O(tenant)** | P1 | `tenant.reader.ts:113` (`kisiId not` sorgusu `bolum_id` ile kısıtlanabilir) ve `:150` (3.000 satırlık JS `Set` kesişimi). Analiz `SESSION_SUMMARY` §3.K'da; ölçüm tahmini verilmedi. |
| **Depo PUBLIC** | **P1** | `90d085b`, `e7543f7`, `3220c3b` commit'leri kapatılmış güvenlik açıklarının tarifini taşıyor. Public olmanın sağladığı bir fayda yok — CI logu okumak için bile admin yetkisi gerekiyor (`403 Must have admin rights`). Private yapma kararı ürün sahibinde. |
| **★ Kapsam politikaları yazmayı korumuyor** | **P1** | 15 kapsam politikası (0022 · 0023 · 0025) `FOR SELECT`; yalnızca yevmiye (0031) `FOR ALL`. Kısıtlı kapsamdaki bir rol başka daireye ait `borc` satırını **okuyamaz ama yazabilir** — o yol yalnızca Kapı 3 ile kapalı, veri katmanında değil. **Bu, A0.7'deki 17 negatif testin de yarım olduğunu gösteriyor: hepsi OKUMA testi, yazma testi yok.** Yani "kapsam kısıtı var" ifadesi bugün yarım kanıtlanmıştır. Yapılacak: 15 politikanın `FOR ALL`'a taşınması + her biri için negatif (kısıtlı rol yazamaz) **ve** pozitif (meşru yol açık) test — CT-18'de yevmiye için uygulanan disiplinin aynısı. ⛔ Kapanana kadar tutarsızlık DURUR; `0031` yorumunda "hizalamayın" uyarısı var. |
| **Yerelde Linux yok** | **P1** | Beş CI arızasının beşi de yerelde görünemezdi (Windows ↔ Linux). WSL2 kurulu ama boş: node/pnpm yok, Docker entegrasyonu kapalı. Maliyet ~6 dk + depoyu WSL dosya sistemine klonlamak (`/mnt/c` çok yavaş). Karar ürün sahibinde. |
| **CT-04 tohuma bağımlı** | P2 | CT-04 tohum kullanıcısıyla giriş yapıyor, kendi verisini yaratmıyor; CT-13/14/16/17 ise kendi tenant'ını kuruyor. İkinci desen daha sağlam. CI'a tohum adımı eklendi (A çözümü); testi bağımsızlaştırmak (B) ertelendi. |
| **Prisma şeması ↔ migration sürüklenmesi** | **P1** | `migrate diff` 162 satır fark buluyor: **7 enum değeri** (`BelgeVarlikTipi` veritabanında 16, `schema.prisma`'da 9 — `YEVMIYE_FISI` gibi bir değer okunursa istemci hata verir), **11 unique indeks**, **8 yabancı anahtar**, 47 indeks adı (kozmetik). Sürüklenme kapısı CI'a bu düzeltilmeden konulamaz; konulsaydı kalıcı kırmızı olurdu. |
| **★ Kurulum tamamlanma kontrolü YOK** | **P1** | Eksik kurulmuş proje hata vermek yerine **boş ekran** gösteriyor. Tohumdaki üç boşluk kapatıldı (`MuhasebeParametresi` kaydı · hesap `ozellik` işaretleri · bugünü kapsayan açık dönem — üçü de ölçüldü, `SESSION_SUMMARY` §3.H) ama **elle kurulan yeni tenant aynı duruma bugün de düşer.** Yapılacak: "kullanıma hazır" sayılmadan önce neyin zorunlu olduğunu tek yerde tanımlayan kontrol; eksikse yönetime **liste hâlinde** göster. ⛔ Var olan projelere `kod='120'` varsayan migration YAZILMAZ: hesap planını özelleştirmiş projede yanlış hesabı kontrol hesabı yapar — **sessiz bozulma, işaretsiz kalmaktan kötüdür.** Hangi hesabın kontrol hesabı olduğu mali karardır (ADR-0010). |
| **Defter sorgusu sessiz boş dönüyor** | **P1** | `defter.query.service.ts:293-316` — `ozellik` işaretli hesap yoksa `hesaplar` boş kalıyor, döngü hiç dönmüyor, uç `200 · []` veriyor. **"Hesap işaretlenmemiş" ile "hesapta hareket yok" ayrı iki durumdur**, ikisi de aynı yanıtı alıyor. Aynı eksiklik sınıfı yansıtma yolunda **422 + çıkış yolu** ile karşılanıyor (`donem.service.ts:632`) — ürün kendi içinde tutarsız. Düzeltildiğinde CT-20 test (6) *422 bekleyecek şekilde güncellenir, silinmez*. |
| **★ Tahakkuk deftere hiç düşmüyor** | **P0** | `Borc` modelinde `yevmiyeFisiId` **yok**, tahakkuk modülünde `muhasebelestir` ucu **yok**. Ölçüldü: `borc` 36 satır · `yevmiye_fisi` 0 satır · `kontrol-mutabakati` → `{"fark":"23400.0000","mutabikMi":false}`. Veri sorunu değil — **her projede** böyle. ADR-0003'teki çift taraflı kayıt kararı kayıt sisteminin ANA işlem türü için uygulanmamış. Üç açık soru [ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md)'de: gider türü ↔ hesap bağı (bugün YOK; `BankaHesabi.muhasebeHesapId` emsali var), karşı taraf gelir mi avans mı, fiş granülerliği (5.000 bölümde 1 fiş ↔ 5.000 fiş). ⛔ **Virmandan ÖNCE** karara bağlanmalı: virman deftere yazacak, mutabık olmayan deftere yeni fiş eklemek ikisini birden düzeltmek demektir. |
| **★ TAHAKKUKUN DAYANAĞI YOK** | **P0** | `TahakkukCalistirDto` yalnızca `giderTuruKodu · toplamTutar · donem · vadeTarihi · hedefBlokId · bolumGirdileri` alıyor — **dayanağa dair hiçbir alan yok.** Tutar serbest giriliyor; hangi bütçeye dayandığı, hangi kararla onaylandığı, tebliğ/kesinleşme durumu kayıtlı değil. Dayanak iki tarafta da var, biçimi farklı: **SITE → işletme projesi** (KMK md. 37, tebliğ + 7 gün itiraz + kesinleşme), **APARTMAN → kat malikleri kurulu kararı** (karar defteri). Kanun ikisini **eşdeğer** tutar — İİK md. 68 uyarınca ikisi de noter borç senedi gücündedir. Sonuç: `dayanak → tebliğ → itiraz → kesinleşme → İİK 68 → icra` zincirinin **ilk halkası tutulmuyor**; kesinleşmemiş proje icra takibinde dayanak olmaz. Model önerisi (tek kavram `TahakkukDayanagi`, iki tip) [ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) §6'da; **ayrı iş, ayrı ADR**. |
| **★ Aidat artış tavanı (YDO) YOK** | **P1** | 7 Mayıs 2026 düzenlemesi (KMK md. 35 ve 37 değişikliği): yönetici **yeniden değerleme oranının üstünde** aidat artışı yapamaz; YDO üstü artış yalnızca **genel kurul onayıyla**; yönetici en fazla **3 ay** geçerli geçici işletme projesi hazırlayabilir. Üründe hiçbiri yok — `IsletmeProjesi` modeli şemada **0 eşleşme**, tavan kavramı hiç yok. Tahakkuk motoru bugün sınırsız artış yazabiliyor. ⚠️ Bu madde yukarıdaki dayanak maddesinin **alt kümesidir**: süre ve tavan kuralları ancak dayanak kaydı varsa yazılabilir. |
| **Terminoloji: "blok yönetimi"** | P3 | BFS v1 §13.1 bağlayıcı kural olarak eklendi: "blok" YALNIZCA site içindeki yapı birimi; tek yapı yönetimi **APARTMAN YÖNETİMİ**. Tarama yapıldı — kod tabanında **tek** ihlal vardı (`frontend/web/app/bloklar/page.tsx` yorumu), düzeltildi. `Tenant.tip` zaten doğru. Dış kaynaktan alıntıda ("blok yönetimine geçiş") terim **çevrilir**. |
| **Gecikme tazminatı hesaplayan motor yok** | P2 | Oran doğru biliniyor (aylık %5, KMK md. 20/son — 5711 ile %10'dan indirildi) ama yalnızca portföy **öneri metninde** (`portfoy.service.ts:484`). Vadesi geçmiş borç tespit ediliyor, tazminat hesaplanmıyor. ★ Ana borçtan AYRI kalem olarak işletilmeli. |
| **`500 Yenileme Fonu` hesap tipi tartışmalı** | P2 | Tohumda `OZKAYNAK`. Dış araştırma: fon kat maliklerine ait **iade edilebilir borç/emanet**tir, özkaynak değil; VUK md. 328'deki teknik "yenileme fonu" ile karıştırılmamalı. ⚠️ **DEĞİŞTİRİLMEDİ** — hesap tipi bakiye yönünü ve mizanı etkiler, [ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) S2 kararıyla BİRLİKTE verilmeli. |
| **Eksik zorunlu parametrede 500** | P2 | Ölçüldü — `makbuzlar/cari/:id`, `muhasebe/dokumler/mizan`, `muhasebe/defterler/yevmiye`, `muhasebe/defterler/kasa`: `baslangic`/`bitis` verilmeden çağrılınca dördü de **500** dönüyor. Eksik zorunlu parametre istemci hatasıdır → **400** olmalı. Hata kontrolü değil, doğrulama eksikliği. |
| **`GiderKapsami` / PARSEL / TOPLU_YAPI şemada yok** | P2 | Depo genelinde 0 eşleşme. Var olan: `PaylasimKurali.BLOK_BAZLI` + tahakkukta `hedefBlokId`, `Tenant.tip=SITE`, `Apartman.siteIciKod`, Apartman→Blok→Kat hiyerarşisi. Yani **blok düzeyi sınanabilir, parsel/toplu yapı katmanı sınanamaz** — o kavram üründe yok. Örnek şablon siteler bu yüzden blok düzeyiyle sınırlı kurulacak. Toplu yapı paketi (C paketi) açık kalır. |
| **Uç adı ↔ modül adı tutarsızlığı** | P2 | Tahsilat modülünün ucu `POST /makbuzlar`; `POST /tahsilat` **404** veriyor (ölçüldü). Biri seçilmeli. |
| **`.mjs` testinden `.ts` import'u** | P2 | `tests/unit/sekme-hata.test.mjs:25` doğrudan `frontend/web/lib/sekme-hata.ts` dosyasını import ediyor. Node'un tip soyma davranışına, dolayısıyla **Node sürümüne bağımlı** — kırılgan. Derlenmiş çıktıya ya da `.mjs` kaynağa bağlanmalı. |
| **`referans` geçici köprü** | P2 | Gider/fatura varlığı geldiğinde faturaya bağlanmalı, serbest metin değerler göç ettirilmeli. |
| **Soft delete uzantısı bağlı değil** | P2 | `$extends` dönüşü atılıyor; bağlanırsa sütunu olmayan 15 model kırılır. Doğru çözüm muafiyeti `Prisma.dmmf`'ten türetmek. |
| **8 tabloda kapsam politikası yok** | P2 | `belge`, `belge_iliskisi`, `belge_etiketi`, `sayac_okumasi`, `site_personeli`, `personel_sertifikasi`, `personel_zimmeti`, `audit_kaydi`. |
| **Mevcut projelere `YAKIT` eklenmedi** | P3 | 0029 yalnızca `ANA_BAKIM`/`SIGORTA`'yı günceller. `YAKIT` yeni kurulumlara tohumla gelir; mevcut projeye eklemek ısınma modelini bilmeyi gerektirir. |

---

## ❌ Hiç ölçülmeyenler

`docs/KAPASITE.md` ile birebir aynı liste. **Bunlar için hiçbir sayı
verilemez ve satış taahhüdüne girmemelidir.**

- 15 proje eşzamanlı tahakkuk (yalnızca 3 proje ölçüldü)
- Fotoğraf/dosya yükleme yolu (MinIO)
- Personel akışı (vardiya, zimmet, sertifika)
- Gider kalemi çarpanı (bir dönemde N farklı gider türü)
- 12 aylık geçmiş verinin okuma başarımına etkisi
- Tahsilat ve mutabakat yolları
- Rapor ve ekstre uçları
- Bildirim/mesaj gönderim yolu
- Çok örnekli (yatay ölçekli) kurulum
- Yedekleme/geri yükleme süresi
- **Üretim donanımında herhangi bir sayı**
