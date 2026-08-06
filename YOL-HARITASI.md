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

> **AKTİF ÇALIŞMA KAPSAMI: APARTMAN** *(5 Ağustos 2026)*
>
> Her satır kapsam etiketi taşır: `[SITE]` yalnızca `CIFT_TARAFLI` muhasebe
> kullanan projeleri, `[APARTMAN]` yalnızca `BASIT` kullananları,
> `[ORTAK]` ikisini birden ilgilendirir. Etiket kuralı ve gerekçe biçimi:
> [ADR günlüğü README](docs/adr/log/README.md).
>
> ⚠️ Kapsam dışı bir iş gelirse **önce sorulur**, sessizce yapılmaz.
>
> ⚠️ **Yalnızca aktif/bekleyen satırlar etiketlidir.** Geçmiş kayıtlar
> (*Kapananlar*, *Çürütülen varsayımlar*) **bilinçli olarak etiketsizdir**:
> geriye dönük etiketleme bugün doğrulanamayan tahmin gerektirir ve yanlış
> etiketlenmiş bir geçmiş kayıt, etiketsiz olandan kötüdür.

### Karar bekleyenler

| Konu | Durum |
|---|---|
| `[ORTAK]` **ADR-0013 · toplu işlem partileme** | Desen kabul edildi, ayrıntılar açık: parti büyüklüğü, kısmi başarı semantiği, geri alma, ilerleme göstergesi. Gerekçe artık işlem sınırı değil (ölçümle çürütüldü); vekil kesmesi, kesilen isteğin sessizce sürmesi, eşzamanlı tahakkukların çekişmesi ve kullanıcının ilerleme görememesi. |
| `[SITE]` **ADR-0015 · yıl sonu kapanışı** | Altı soru açık: hangi kayıtlar üretilir, dönem kilitleme, kapanmış dönemde düzeltme, devir bakiyesi, denetçi raporu, tebligat/icra zinciri. Karar verilmedi. |
| `[ORTAK]` **Proje ısınma modeli ayarı** | `PAY_OLCERLI \| PAY_OLCERSIZ`. Geldiğinde ADR-0014 §2c'deki uyarı gerçek kurala dönüşür. |
| `[ORTAK]` **[ADR-0016](docs/adr/log/ADR-0016-virman.md) · virman** | Dört bölüm açık. **A**: virman iki bacağı bağımsız muhasebeleşiyor (para kaybolmuş görünür) — öneri "tek fiş", karar bekliyor; kasa↔banka yolu yok. **B** ve **C**: ürün sahibinin soru listeleri **henüz gelmedi**. **D**: motor var, arayüz yok. Sebep kodu listesi onay bekliyor. |

### Teknik borç

| Konu | Öncelik | Not |
|---|---|---|
| `[ORTAK]` **Kapsam kurulumu O(tenant)** | P1 | `tenant.reader.ts:113` (`kisiId not` sorgusu `bolum_id` ile kısıtlanabilir) ve `:150` (3.000 satırlık JS `Set` kesişimi). Analiz `SESSION_SUMMARY` §3.K'da; ölçüm tahmini verilmedi. |
| `[ORTAK]` **Depo PUBLIC** | **P1** | `90d085b`, `e7543f7`, `3220c3b` commit'leri kapatılmış güvenlik açıklarının tarifini taşıyor. Public olmanın sağladığı bir fayda yok — CI logu okumak için bile admin yetkisi gerekiyor (`403 Must have admin rights`). Private yapma kararı ürün sahibinde. |
| `[ORTAK]` **★ Kapsam politikaları yazmayı korumuyor** | **P1** | 15 kapsam politikası (0022 · 0023 · 0025) `FOR SELECT`; yalnızca yevmiye (0031) `FOR ALL`. Kısıtlı kapsamdaki bir rol başka daireye ait `borc` satırını **okuyamaz ama yazabilir** — o yol yalnızca Kapı 3 ile kapalı, veri katmanında değil. **Bu, A0.7'deki 17 negatif testin de yarım olduğunu gösteriyor: hepsi OKUMA testi, yazma testi yok.** Yani "kapsam kısıtı var" ifadesi bugün yarım kanıtlanmıştır. Yapılacak: 15 politikanın `FOR ALL`'a taşınması + her biri için negatif (kısıtlı rol yazamaz) **ve** pozitif (meşru yol açık) test — CT-18'de yevmiye için uygulanan disiplinin aynısı. ⛔ Kapanana kadar tutarsızlık DURUR; `0031` yorumunda "hizalamayın" uyarısı var. |
| `[ORTAK]` **Yerelde Linux yok** | **P1** | Beş CI arızasının beşi de yerelde görünemezdi (Windows ↔ Linux). WSL2 kurulu ama boş: node/pnpm yok, Docker entegrasyonu kapalı. Maliyet ~6 dk + depoyu WSL dosya sistemine klonlamak (`/mnt/c` çok yavaş). Karar ürün sahibinde. |
| `[ORTAK]` **CT-04 tohuma bağımlı** | P2 | CT-04 tohum kullanıcısıyla giriş yapıyor, kendi verisini yaratmıyor; CT-13/14/16/17 ise kendi tenant'ını kuruyor. İkinci desen daha sağlam. CI'a tohum adımı eklendi (A çözümü); testi bağımsızlaştırmak (B) ertelendi. |
| `[ORTAK]` **Prisma şeması ↔ migration sürüklenmesi** | **P1** | `migrate diff` 162 satır fark buluyor: **7 enum değeri** (`BelgeVarlikTipi` veritabanında 16, `schema.prisma`'da 9 — `YEVMIYE_FISI` gibi bir değer okunursa istemci hata verir), **11 unique indeks**, **8 yabancı anahtar**, 47 indeks adı (kozmetik). Sürüklenme kapısı CI'a bu düzeltilmeden konulamaz; konulsaydı kalıcı kırmızı olurdu. |
| `[ORTAK]` **★ Kurulum tamamlanma kontrolü YOK** | **P1** | Eksik kurulmuş proje hata vermek yerine **boş ekran** gösteriyor. Tohumdaki üç boşluk kapatıldı (`MuhasebeParametresi` kaydı · hesap `ozellik` işaretleri · bugünü kapsayan açık dönem — üçü de ölçüldü, `SESSION_SUMMARY` §3.H) ama **elle kurulan yeni tenant aynı duruma bugün de düşer.** Yapılacak: "kullanıma hazır" sayılmadan önce neyin zorunlu olduğunu tek yerde tanımlayan kontrol; eksikse yönetime **liste hâlinde** göster. ⛔ Var olan projelere `kod='120'` varsayan migration YAZILMAZ: hesap planını özelleştirmiş projede yanlış hesabı kontrol hesabı yapar — **sessiz bozulma, işaretsiz kalmaktan kötüdür.** Hangi hesabın kontrol hesabı olduğu mali karardır (ADR-0010). |
| `[SITE]` **Defter sorgusu sessiz boş dönüyor** | **P1** | `defter.query.service.ts:293-316` — `ozellik` işaretli hesap yoksa `hesaplar` boş kalıyor, döngü hiç dönmüyor, uç `200 · []` veriyor. **"Hesap işaretlenmemiş" ile "hesapta hareket yok" ayrı iki durumdur**, ikisi de aynı yanıtı alıyor. Aynı eksiklik sınıfı yansıtma yolunda **422 + çıkış yolu** ile karşılanıyor (`donem.service.ts:632`) — ürün kendi içinde tutarsız. Düzeltildiğinde CT-20 test (6) *422 bekleyecek şekilde güncellenir, silinmez*. |
| `[SITE]` **★ Tahakkuk deftere hiç düşmüyor** | **P0** | `Borc` modelinde `yevmiyeFisiId` **yok**, tahakkuk modülünde `muhasebelestir` ucu **yok**. Ölçüldü: `borc` 36 satır · `yevmiye_fisi` 0 satır · `kontrol-mutabakati` → `{"fark":"23400.0000","mutabikMi":false}`. Veri sorunu değil — **her projede** böyle. ADR-0003'teki çift taraflı kayıt kararı kayıt sisteminin ANA işlem türü için uygulanmamış. Üç açık soru [ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md)'de: gider türü ↔ hesap bağı (bugün YOK; `BankaHesabi.muhasebeHesapId` emsali var), karşı taraf gelir mi avans mı, fiş granülerliği (5.000 bölümde 1 fiş ↔ 5.000 fiş). ⛔ **Virmandan ÖNCE** karara bağlanmalı: virman deftere yazacak, mutabık olmayan deftere yeni fiş eklemek ikisini birden düzeltmek demektir. |
| `[ORTAK]` **★ TAHAKKUKUN DAYANAĞI YOK** | **P0** | `TahakkukCalistirDto` yalnızca `giderTuruKodu · toplamTutar · donem · vadeTarihi · hedefBlokId · bolumGirdileri` alıyor — **dayanağa dair hiçbir alan yok.** Tutar serbest giriliyor; hangi bütçeye dayandığı, hangi kararla onaylandığı, tebliğ/kesinleşme durumu kayıtlı değil. Dayanak iki tarafta da var, biçimi farklı: **SITE → işletme projesi** (KMK md. 37, tebliğ + 7 gün itiraz + kesinleşme), **APARTMAN → kat malikleri kurulu kararı** (karar defteri). Kanun ikisini **eşdeğer** tutar — İİK md. 68 uyarınca ikisi de noter borç senedi gücündedir. Sonuç: `dayanak → tebliğ → itiraz → kesinleşme → İİK 68 → icra` zincirinin **ilk halkası tutulmuyor**; kesinleşmemiş proje icra takibinde dayanak olmaz. Model önerisi (tek kavram `TahakkukDayanagi`, iki tip) [ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) §6'da; **ayrı iş, ayrı ADR**. |
| `[ORTAK]` **★ Aidat artış tavanı (YDO) YOK** | **P1** | 7 Mayıs 2026 düzenlemesi (KMK md. 35 ve 37 değişikliği): yönetici **yeniden değerleme oranının üstünde** aidat artışı yapamaz; YDO üstü artış yalnızca **genel kurul onayıyla**; yönetici en fazla **3 ay** geçerli geçici işletme projesi hazırlayabilir. Üründe hiçbiri yok — `IsletmeProjesi` modeli şemada **0 eşleşme**, tavan kavramı hiç yok. Tahakkuk motoru bugün sınırsız artış yazabiliyor. ⚠️ Bu madde yukarıdaki dayanak maddesinin **alt kümesidir**: süre ve tavan kuralları ancak dayanak kaydı varsa yazılabilir. |
| `[ORTAK]` **V23 tanıtım sitesi → bnos.com.tr** | P3 | `docs/reference/marketing/canva-export-landing-page.html` uyarlanabilir ama **olduğu gibi değil**. Ölçüldü: **`_sdk` 8 gönderme** (Canva betikleri; dışarıda çalışmaz) · **124 `data-template-id` alanının 124'ü BOŞ** — metinler Canva editöründen geliyor, dosyada yok · marka **`bnyonetim` 3 kez, `bnos` 0 kez**. Yapılacak: SDK temizliği + metin doldurma + marka değişimi. Bölümler: Platform · Modüller · AI Center · Fiyatlandırma · Referanslar · Blog. **Şimdi yapılmayacak.** |
| `[ORTAK]` ~~Mock varsayılanı `'1'`~~ | ✅ **KAPANDI** | Varsayılan **`'0'`** yapıldı, `.env.example`'a açıklamasıyla eklendi, `config-check` anahtarı denetliyor (`.env.example`'da yoksa **hata**, `.env`'de yoksa/açıksa **uyarı**), ve mock açıkken **kapatılamaz uyarı bandı** görünüyor. Ön koşul CT-22 ile sağlandı: 24 yanıt tipi gerçek API'ye karşı doğrulandı. Ölçüm: `MOCK=0` ile hiçbir ekran kırılmıyor — sebep, `MOCK_AKTIF`'in genel yardımcılarda tek noktada anahtarlanması. [REFERANS-ENVANTER §3](docs/REFERANS-ENVANTER.md) |
| `[ORTAK]` **İstek tipleri için sözleşme testi yok** | P2 | CT-22 **yanıt** tiplerinin tamamını doğruluyor (24 tip · iç içe dâhil). Kalan **9 istek tipi** — `KisiGirdisi` · `PlakaGirdisi` · `MalikEkle` · `KiraciEkle` · `SakinEkle` · `GiderTuruGirdisi` · `PersonelGirdisi` · `DaireGorevlisiGirdisi` · `MisafirGirdisi` — API'nin **kabul ettiği** şekildir, ayrı bir sözleşmedir ve **sınanmadı**; `Mock` önekleri bu yüzden kasten duruyor, ad doğru bilgi veriyor. ⚠️ Risk aynı sınıf: gövdede eksik/fazla alan derleme zamanında görünmez, **400 olarak çalışma anında** çıkar. ★ `MockSakinCikisSonucu` bu listede DEĞİL — o bir sözleşme değil, mock'un iç tipi (`servis.sakinCikis` `Promise<void>` döner, gövdeyi hiç okumaz); öneki kalıcı olarak doğrudur. |
| `[ORTAK]` **CT-22 sınırı: adsız iç nesneler** | P3 | Ayrıştırıcı `readonly tahsilatDurumu: { … }` gibi **adsız** iç nesnelerin alanlarına inmiyor — adı olmayan tipin karşılığı yok. Üst düzey alan varlığı doğrulanıyor, içindekiler değil. Gerekirse o nesneler ada kavuşturulup (`interface TahsilatDurumu`) kapsama alınır. |
| `[ORTAK]` **Genel Bakış zayıf — yöneticinin ilk ekranında para yok** | **P1** | Ürün sahibi ekran incelemesi (4 Ağustos): dört kart, üç çubuk, gerisi boşluk; çubukların ikisi **0/8** — boş çubuk bilgi vermiyor. Referans üründe Özet ekranında **kasa tablosu** (Devir + Giren − Çıkan = Kalan) ve son gider/gelir evrakları var ([MENU-HARITASI §1](docs/MENU-HARITASI.md)). Alt notta finansal rakam olmamasının bilinçli olduğu yazıyor ama *"yöneticinin ilk baktığı ekranda para görmemesi tuhaf"*. ★ MENU-HARITASI §1'deki **gösterge tamamlanma oranı** deseni buraya uygulanmalı: hesaplanamayan gösterge boş/sıfır gösterilmez, **neden** hesaplanamadığı yazar. |
| `[ORTAK]` **Kenar çubuğu simgeleri tutarsız** | P3 | `◈ ▣ ▤ ◎ ◐ ₺ ▦` — Unicode glif karışımı, gerçek bir simge seti değil. Ölçek büyüdükçe (menü haritası 12 üst başlık öngörüyor) ayırt edilemez hâle gelir. Menü yeniden yapılandırmasıyla **birlikte** ele alınmalı; ayrı tur değil. |
| `[ORTAK]` **Yardım metinleri formu ağırlaştırıyor** | P2 | Ürün sahibi: içerik **değerli** ama sürekli görünmesi gerekmiyor (ör. tahakkuk ekranında dağıtım kuralı altındaki iki satır). ★ Öneri: bilgi simgesi arkasına alınsın; ilk kullanımda açık, sonra kapalı. ⚠️ **Metinler SİLİNMEZ** — kuralı öğreten açıklamalar bu ürünün ayrışma noktası olarak işaretlendi; yalnızca varsayılan görünürlükleri değişir. |
| `[ORTAK]` **Boş tarih alanı kırık görünüyor** | P3 | Boş `<input type="date">` `------- ----` biçiminde çiziliyor ve kullanıcıya arıza izlenimi veriyor. Tarayıcı varsayılanı; yer tutucu ya da alan biçimlendirmesiyle çözülür. |
| `[ORTAK]` **Misafir ve daire görevlisi ana menüden Güvenlik altına taşınacak** | **P1** | Ürün sahibi kararı (4 Ağustos): bunlar bağımsız modül değil, **Güvenlik → Giriş-Çıkış Kayıtları** sekmeleridir ([MENU-HARITASI §7](docs/MENU-HARITASI.md)). Referans ekranlar paylaşıldı; menü yapısı `Geçiş Kontrol Sistemi › · Gönderi Takibi › · Olaylar · Kayıp Eşya`. ⚠️ **ÖNCE `/guvenlik` ROTASI, SONRA MENÜDEN KALDIRMA** — ters sırada yapılırsa çalışan iki ekran erişilemez kalır (`/belgeler` dersinin tersi: orada olmayan ekranın menüsü vardı). Mevcut rotalar silinmez, içerik sekmeye taşınır. ★ `Site Personeli` ana menüde KALIR: kadro kaydıdır, güvenlik kaydı değil. ⚠️ Ziyaretçi ekranı sitede **en çok veri üreten** ekrandır (rakipte 275.889 kayıt) ve BNOS'ta bu yük profili hiç ölçülmedi. |
| `[ORTAK]` **Personel ekle — seçimler elle yazılamıyor** | P2 | Ürün sahibi geri bildirimi (4 Ağustos, ekran incelemesi): personel ekleme ekranındaki seçim kutuları **elle yazmaya** da izin vermeli. Kapalı listeden seçim, listede olmayan bir değeri girmeyi imkânsız kılıyor. ⚠️ Ölçülmedi — hangi alanların kapalı liste olduğu ve serbest metnin veri bütünlüğünü nasıl etkileyeceği (ör. görev/departman tanımlı küme mi) incelenmeli. Serbest metne açmak, bugün tanım tablosundan gelen bir alanı yazım hatalarına açar; çözüm "yazarak ara + yoksa ekle" olabilir. |
| `[ORTAK]` **Blok adı seçenekleri dar** | P2 | Ürün sahibi geri bildirimi (4 Ağustos): blok seçeneklerinde **tüm harfler ve rakamlar** bulunmalı. Bugün tohumda yalnızca "A Blok"/"B Blok" var; gerçek sitelerde `C`, `D`, `1`, `2`, `A1` gibi adlar kullanılıyor. ⚠️ Bunun bir **tohum verisi** eksiği mi yoksa blok ekleme ekranında **kapalı liste** mi olduğu ölçülmedi — ikisi farklı iş. Önce ölçülecek. |
| `[ORTAK]` ~~**401'de giriş sayfasına yönlendirme yok**~~ | ✅ **5 Ağustos'ta kapatıldı** | `api()` artık 401'de oturum verisini temizleyip `/giris?donus=…` adresine yönlendiriyor; giriş sonrası bakılan ekrana dönülüyor. ⚠️ **Giriş ucu MUAF** — ölçüldü: yanlış şifre 401 döner, muafiyet olmasaydı her deneme sayfayı yeniler ve kullanıcı hatayı hiç göremezdi. **Açık yönlendirme koruması** eklendi (`//baska-site` reddedilir) ve ikisi de birim testiyle korunuyor (`tests/unit/oturum-yonlendirme.test.mjs`). |
| `[ORTAK]` **Belge ekranı yok** | P2 | Backend'de 12 uç çalışıyor (`GET /belgeler` → 200) ama **ekran hiç yazılmamış**. Menü öğesi 3 Ağustos'ta kaldırıldı (404 veriyordu); **ekran yazılana kadar geri eklenmez** — çalışmayan menü öğesi, eksik özelliği "var" gibi gösterir. |
| `[ORTAK]` **Menü yeniden yapılandırması — sorun sekme değil, ÜST MENÜ** | P3 | ⚠️ **Bu madde 4 Ağustos'ta yeniden yazıldı.** Önce "muhasebe sekmesi 7'ye çıktı" diye kaydedilmişti; [docs/MENU-HARITASI.md](docs/MENU-HARITASI.md) gelince asıl ölçek görüldü: harita **12 üst başlık + alt ağaç** tanımlıyor, bizde **10 düz öğe** var ve hiç gruplama yok ([uygulama-kabugu.tsx:27](frontend/web/components/uygulama-kabugu.tsx#L27)). Muhasebe sekmelerinin yediye çıkması bu sorunun bir belirtisi, kendisi değil. ★ **Tek başına bir tur olarak ele alınacak** — arayüz kararıdır, ekran işine iliştirilmez. V16'nın 6 başlıklı gruplaması + haritanın §16 ortak liste deseni girdi. |
| `[ORTAK]` **Terminoloji: "blok yönetimi"** | P3 | BFS v1 §13.1 bağlayıcı kural olarak eklendi: "blok" YALNIZCA site içindeki yapı birimi; tek yapı yönetimi **APARTMAN YÖNETİMİ**. Tarama yapıldı — kod tabanında **tek** ihlal vardı (`frontend/web/app/bloklar/page.tsx` yorumu), düzeltildi. `Tenant.tip` zaten doğru. Dış kaynaktan alıntıda ("blok yönetimine geçiş") terim **çevrilir**. |
| `[ORTAK]` **Gecikme tazminatı hesaplayan motor yok** | P2 | Oran doğru biliniyor (aylık %5, KMK md. 20/son — 5711 ile %10'dan indirildi) ama yalnızca portföy **öneri metninde** (`portfoy.service.ts:484`). Vadesi geçmiş borç tespit ediliyor, tazminat hesaplanmıyor. ★ Ana borçtan AYRI kalem olarak işletilmeli. |
| `[SITE]` **Tohumda hiç ÖZKAYNAK hesabı yok — dönem kârı seçilemiyor** | **P1** | ⚠️ **4 Ağustos'ta yeniden yazıldı; önceki hâli ("`500 Yenileme Fonu` tohumda `OZKAYNAK`, DEĞİŞTİRİLMEDİ") ARTIK DOĞRU DEĞİL.** `500` ADR-0017 K4 ile `BORC`'a çevrilmiş ([seed.ts:313](database/seeds/seed.ts#L313)) ama yerine özkaynak hesabı KONMAMIŞ: tohumda `tip='OZKAYNAK'` hesap sayısı **sıfır** (ölçüldü; veritabanındaki tek `590` CT-23 fikstüründendir). **Sonuç:** parametre ekranındaki "Dönem Kârı" açılır kutusu BOŞ ve devre dışı; ekran kalıcı olarak *"Kurulum tamamlanmadı — 1 eksik"* gösteriyor ve kullanıcı bunu ekrandan gideremiyor. ★ **Hesap eklenmedi, çünkü hangi hesabın dönem sonucunu alacağı [ADR-0015](docs/adr/log/ADR-0015-yil-sonu-kapanisi.md)'in AÇIK konusudur** — özkaynağa yazmak, "aidat avanstır, yönetim kâr amacı gütmez" duruşuyla çelişir. Tohuma hesap koymak o kararı sessizce vermek olurdu. |
| `[SITE]` **★ `APARTMAN_YONETICISI` yevmiye fişi kesemiyor** | **P1** | Rol `FINANS_TAHAKKUK` · `FINANS_TAHSILAT` · `FINANS_DEFTER_GORUNTULE` taşıyor ama **`FINANS_YEVMIYE_GIRIS` taşımıyor**. Sonuç: tahakkuk çalıştırabiliyor, onu **deftere geçiremiyor**. Kendi sitesini yöneten bir apartman yöneticisi `CIFT_TARAFLI` muhasebe kullanıyorsa yevmiye yolu ona kapalı. ✅ **Virman kısmı çözüldü** — ayrı `FINANS_VIRMAN` izni tanımlandı (ADR-0016 C-K12); virman bir cari işlemdir, muhasebe işlemi değil. Kalan soru yalnızca **yevmiye fişi** yetkisi. |
| `[ORTAK]` **Fiş üreten virman için ek kontrol?** | P2 | İzin guard aşamasında, **gövdeye bakılmadan** kontrol edilir; satırlı (bakiye taşıyan) ve satırsız (taşınma) virman şu an aynı `FINANS_VIRMAN` iznine tabi. Davranışa göre izin seçmek mimari değişikliktir. ★ **Karar ölçüme bağlandı:** satırlı virman pratikte kim tarafından yapılıyor? Ölçülmeden ek kontrol eklenmeyecek (ADR-0016 C-A1). |
| `[SITE]` **ADR-0016 §A · kasa/banka virmanı** | **P1** | `POST /banka/virman` iki hareket üretiyor, **sıfır fiş**; iki bacak bağımsız muhasebeleşebiliyor → *"paranın yarısı deftere girer"* açık hatası. Öneriler yazıldı (§A): **(1)** yeni virman yoluna bağlansın — tek kavram, tek kayıt, iki uç; **(2)** kasa/banka iki seviye sorununda `Hesap` tarafı seçilsin (`BankaHesabi.muhasebeHesapId` zaten zorunlu, dönüşüm kayıpsız). **Karar verilmedi.** |
| `[SITE]` **ADR-0016 §B · hesap virmanı** | P2 | ★ **Hiç gerekmeyebilir:** mevcut `storno` + elle fiş yolu işlevsel olarak yeterli; §B'nin eklediği şey kolaylık ve niyetin kayda geçmesi (`sebepKodu`). Karar ölçütü **ölçüm**: bugüne kadar kaç storno yazıldı ve kaçı *"tek satır yanlış hesapta"* durumuydu? Ölçülmeden kod yazmak kullanılmayan bir yol açmaktır. Diğer sorular ADR-0016 §B'de: kilitli dönem · şüpheli hesap çiftleri (`ISINMA_CAKISMASI` deseni uygulanabilir mi) · `500` fon hesabı özel muamele. |
| `[ORTAK]` **Eksik zorunlu parametrede 500** | P2 | Ölçüldü — `makbuzlar/cari/:id`, `muhasebe/dokumler/mizan`, `muhasebe/defterler/yevmiye`, `muhasebe/defterler/kasa`: `baslangic`/`bitis` verilmeden çağrılınca dördü de **500** dönüyor. Eksik zorunlu parametre istemci hatasıdır → **400** olmalı. Hata kontrolü değil, doğrulama eksikliği. |
| `[SITE]` **`GiderKapsami` / PARSEL / TOPLU_YAPI şemada yok** | P2 | Depo genelinde 0 eşleşme. Var olan: `PaylasimKurali.BLOK_BAZLI` + tahakkukta `hedefBlokId`, `Tenant.tip=SITE`, `Apartman.siteIciKod`, Apartman→Blok→Kat hiyerarşisi. Yani **blok düzeyi sınanabilir, parsel/toplu yapı katmanı sınanamaz** — o kavram üründe yok. Örnek şablon siteler bu yüzden blok düzeyiyle sınırlı kurulacak. Toplu yapı paketi (C paketi) açık kalır. |
| `[ORTAK]` **Uç adı ↔ modül adı tutarsızlığı** | P2 | Tahsilat modülünün ucu `POST /makbuzlar`; `POST /tahsilat` **404** veriyor (ölçüldü). Biri seçilmeli. |
| `[ORTAK]` **Gecikme tazminatı — motor yok, PARAMETRE TABLOSU da yok** | **P1** *(P2'den yükseltildi)* | Tahsilat ekranı denetiminde çıktı: üç borç da "vadesi geçmiş" ama tazminat kalemi görünmüyor — çünkü **hesaplanmıyor**. ⚠️ **ÖLÇÜLDÜ: `mevzuat_parametre` tablosu şemada YOK.** R6 ona atıfta bulunuyor ama hiç oluşturulmamış; yani oranı "koda gömmemek" için bugün **yazılacak yer yok**. İşin ilk adımı hesap değil, o tablodur (yürürlük tarihli). ★ Girdiği gün **üç ekranı birden** değiştirir: kalan bakiye zamana bağlı hâle gelir, dünkü tahsis ekranı bugün geçersizdir. Ayrıntı ve alt sorular: [Çelişki Kaydı Ç-2](docs/CELISKI-KAYDI.md). |
| `[ORTAK]` **Tazminat gelince `tahsis-sirasi.ts` ve CT-26 gözden geçirilecek** | **P1** | Borç kapatma sırası aynı vadedeki kalemleri **kalem koduna göre alfabetik** sıralıyor. Tazminat bir kalem olarak eklenirse mahsup önceliğini **kodunun harfi** sessizce belirler — ⛔ **CT-26 o gün yeşil kalarak YANLIŞ ŞEYİ korur.** Sıra bugün deterministiktir ve bu bir *istikrar* garantisidir, hukuki öncelik değil. |
| `[ORTAK]` **`kalan` float ile hesaplanıyor — ADR-0007 ihlali** | **P1** | `makbuz.query.service.ts` · `kalan: money((Number(tutar) − Number(odenen)).toFixed(4))`. Para aritmetiği float'a düşüyor; bugünkü tutarlarda sapma görünmüyor ama bu depoda para `bigint` kuruş üzerinden işlenir. ⚠️ Tahsilat ekranı **kendi** toplamlarını kuruş tamsayısıyla yapıyor, yani ekran doğru — kusur sunucu tarafında. Düzeltilirken `apiBicimi`/`money` yardımcılarının çıkarma desteği kontrol edilmeli. |
| `[ORTAK]` **★ KİŞİ EKSTRESİ HİSSELİ MÜLKİYETTE YANLIŞ — borç iki kez sayılıyor** | **P0** | ÖLÇÜLDÜ (canlı, Papatya kapı 7, iki malik): bölüm ekstresi `borç 6.485 · tahsilat 4.066 · kapanış 2.419`; **her iki malik ayrı ayrı** `borç 6.485 · tahsilat 2.033 · kapanış 4.452`. İki kişinin kapanışı toplamı **8.904**, bölümünki 2.419. ★ **Kök sebep asimetri:** borç tarafı `sorumlular: { some: { kisiId } }` süzgeciyle `borc.tutar`'ın **TAMAMINI** topluyor, tahsilat tarafı `borcSorumlusu.kisiId` ile kişinin **PAYINI**. Kişinin payı `borcSorumlusu.pay` alanında duruyor ve hiç kullanılmıyor. ⚠️ Hisseli malike ekstre verilirse *"6.485 borçlusun"* der; gerçekte payı 3.242,50'dir. **Cari ekstre ekranı bu düzeltilmeden yazılmamalı** — ekran doğru veriyi gösteremez. |
| `[ORTAK]` **★ `hisseleriZorunluKil` YAZILMIŞ ama HİÇBİR YERDEN ÇAĞRILMIYOR** | **P0** | Ölçüldü: `hisseleriDogrula` **var ve çalışıyor** — ama yalnızca **okuma** yolunda (`bolum.query.service` · `malik.query.service`), bir **rapor bayrağı** olarak (`hisseTam`). Yazma yolunda (`malik.command.service`) **hiç yok**. Üstelik tam ihtiyaç duyduğumuz fonksiyon da yazılmış: **`hisseleriZorunluKil`** — *"Hisse toplami tam degilse islemi durdurur"*, hata fırlatır **ve süzülmüş listeyi döndürür** — yani doğrulama + süzme tek yerde, §2.5'in istediği yapı. ⛔ **Hiçbir çağıranı yok.** ★ Σ hisse kontrolü **yeniden yazılmayacak, BAĞLANACAK**. |
| `[ORTAK]` **Σ hisse kontrolü malik kaydı üreten HER YOLDA olmalı** | **P1** | Kilit tahakkuk + önizleme yoluna bağlanacak — ama **veri sisteme başka yollardan da giriyor**: Excel/CSV içe aktarım, veri göçü, doğrudan API. Bu yollar `malik.command.service`'ten geçmiyorsa kontrol **yine atlanır**. ★ İçe aktarım yolları **ayrı ayrı sayılmalı** ve her biri kontrolden geçmeli. ⚠️ Tarama sonucu *"veri temiz"* değil, **"kilidi açmak bugün maliyetsiz"** demektir: tohum yarım kalmış devir üretmiyor, yani tarama bu sınıfı **arayabileceği bir yerde aramadı**. |
| `[ORTAK]` **`dagit` ağırlık toplamını kendisi doğrulamıyor** | P2 | `dagit` gerçek ağırlık toplamına bölerek **normalize ediyor** — sessiz düzeltmenin kaynağı buydu. `hisseleriZorunluKil` bağlanınca girdi garantili hâle gelir ve normalizasyon zararsızlaşır. ⚠️ **Ama koruma ÇAĞRI YERİNE bağlı:** ileride başka bir çağıran `dagit`'i doğrudan çağırırsa **sessiz düzeltme geri döner**. ★ `dagit` ağırlık toplamının beklenen ölçeğe eşit olduğunu **kendisi de** doğrulasın; o zaman koruma çağrı sırasına değil **fonksiyonun kendisine** bağlı olur. ⛔ **TOLERANS ŞARTI — bu madde uygulanırken zorunlu:** kontrol **katı eşitlikle** yazılırsa `A6` ve `B1` **kırmızıya döner**, çünkü `1/3 × 3 → 333333 × 3 = 999999 ≠ 1000000`. Kırpma artığı **≤ sorumlu sayısı** kadar olabilir ve tolerans buradan türetilir. ⚠️ Bu şart şimdi yazılmazsa, maddeyi uygulayan kişi kırmızı testi görüp **testi gevşetir** — oysa yanlış olan test değil, **katı eşitliktir**. ★ Ayrıca: B1 iki temsilin ayrışmadığını ölçtü; **ayrışmama tam da `dagit`'in normalize etmesinin yan ürünüdür** — yani bu madde o davranışa dokunuyor. |
| `[ORTAK]` **`Money.kurus` adı ölçeği yanlış anlatıyor** | P2 | Alan **kuruş tutmuyor**, dört ondalıklı ölçek tutuyor (`1500.00` → `15000000`; şemadaki `Decimal(18,4)` ile aynı). ADR-0007 *"ölçeklenmiş bigint"* diyor ama alan adı *"kuruş"* diyor — ikisi **çelişiyor**. ⚠️ CT-27/7a yazılırken **100× hatalı beklentiye** yol açtı ve kırmızıyla yakalandı; bir sonraki kişiyi de düşürür. ★ **Yeniden adlandırma ÖNERİLMİYOR** (R1 — geniş dokunuş); ya alan adı ölçeği yansıtsın ya `Money` tipinin dokümantasyonu ölçeği **açıkça** yazsın. Panzehir zaten uygulandı: beklenen değerler girdiden **türetiliyor**, sabit yazılmıyor. |
| `[ORTAK]` **★ Σ hisse = 1 hiçbir yerde doğrulanmıyor** | **P0** | Ölçüldü: `dagit` ağırlıkları **toplama bölerek normalize eder** ([money.ts:168](shared/kernel/src/money/money.ts)), yani `Σ pay = borc.tutar` **yapısal olarak** garanti — K5'in doğrulaması hiçbir şey yakalamaz. Ölçülmeyen ve **ulaşılabilir** olan `Σ hisse = 1`'dir: `1/1 + 1/1` (silinmemiş devir) bugün **975/975** üretiyor ve **hiçbir uyarı vermiyor**. ⚠️ Mülkiyeti devretmiş kişi adına borç doğuyor, `BorcSorumlusu` snapshot'ına yazılıyor, kişi ekstresinde çıkıyor, gecikme bildirimine giriyor. ★ Karar verildi ([ADR-0018 §2.5](docs/adr/log/ADR-0018-kisi-ekstresi-paylasim-semantigi.md)): tahakkuk **reddedilir**, tolerans `HISSE_OLCEGI`'den türetilir. **Üç şart:** asıl kontrol **malik/devir yazma anında** (bu madde), doğrulama **önizlemeye** taşınır (kısmi tahakkuk YOK), ve kontrol açılmadan **mevcut veri taranır** — düzeltme yolu olmayan kilit ürünü kilitler. |
| `[ORTAK]` **Malik ilişkisi ve hisse haritası tek fonksiyondan üretilsin** | P2 | Bugün ikisi ayrı döngülerde aynı `tx.malik.findMany` sonucundan kuruluyor ve eşitlikleri **yapısal ama örtük**. Koddaki küme kontrolü bu yüzden **ulaşılamaz** ve testi yazılamıyor ([ADR-0018 §2.5](docs/adr/log/ADR-0018-kisi-ekstresi-paylasim-semantigi.md)). Tek üretici fonksiyon tautolojiyi **yapıya gömer**, kontrole gerek kalmaz, garanti tip seviyesine çıkar. ⚠️ Düzeltmenin kapsamını genişlettiği için ayrı tur. |
| `[ORTAK]` **★ TOHUM ÜRÜNÜN ÜRETTİĞİNİ ÜRETMELİ — benzerini değil** | **P1** | `tahakkukGecmisiOlustur` sorumluları **kendi kuruyor**, `borcSorumlulariniCoz`'u çağırmıyor. Sonucu CT-27'den geniş: **teminat katmanı (KMK m.22 ikincil sorumluluk) bugüne kadar hiçbir demoda, hiçbir ekran denetiminde, hiçbir elle yapılan ölçümde görünmedi.** Tahsilat ekranı üç görselde denetlendi ve ikincil sorumlu satırı yoktu — yokluğu **ürünün değil, tohumun kararıydı** ve o yüzden hiç sorulmadı. ★ **Bu bir düzeltme değil, bir KURALDIR:** fikstür **ürünün ürettiğini üretmeli, benzerini değil**. Aksi hâlde her yeni ekran **aynı kör noktayla** denetlenir. **İki örnek:** ⑴ `tahakkukGecmisiOlustur` — teminat katmanı hiçbir demoda görünmedi; ⑵ **CT-26 `tahsis.spec.ts`** — `tahakkukCalismasi`'nı **doğrudan Prisma ile** yazıyor, tahakkuk servis yolundan geçmiyor. İkincisi bugün zararsız (bkz. C ölçümü: bağlama onu kırmızıya düşürmez) **ama servis yoluna kontrol eklendiğinde CT-26 onu HİÇ SINAMAYACAK.** |
| `[ORTAK]` **Kişi ekstresinin borç tarafı HUKUKİ BİR SEÇİMDİR** | **P0** | Kişi ekstresinin borç tarafı hukuki bir seçimdir; bugünkü varsayılan **payına göredir ve onaylanmamıştır.** Karar ve altı maddesi [ADR-0018](docs/adr/log/ADR-0018-kisi-ekstresi-paylasim-semantigi.md)'de; hukuk sorusu [H-1](docs/HUKUK-SORU-SETI.md)'de. ⚠️ Semantik **yazma anında** uygulanır (snapshot), okuma anında parametre yoktur — cevap değişirse geçmiş kayıtlar **kendiliğinden düzelmez**, yeniden çözümleme işi gerekir ve bu maliyet ADR'de açıkça yazılıdır. |
| `[ORTAK]` **Aynı hukuki soru iki katmanda FARKLI cevaplanmış** | **P0** | Ölçüldü ([tahakkuk.command.service.ts:634](backend/src/modules/tahakkuk/tahakkuk.command.service.ts)): `ASIL` katmanında birden çok malik varsa pay **hisseye göre** bölünüyor, `IKINCIL` katmanında **her satır tam tutar**. Aynı malik bir katmanda payına göre, ötekinde müteselsil. ⚠️ **İkinci sessiz düşüş:** bölüşüm yalnızca `donemHisseleri.length === asillar.length` iken uygulanıyor — hisse kaydı eksikse (yarım devir, dönem dışı hisse) ürün hata vermiyor, **sessizce müteselsile kayıyor.** Eksik veri bir hukuki yorumu değiştirmemelidir. |
| `[ORTAK]` **Cari ekstrede ÖDEYEN izi yok — üç katmanda birden** | **P1** | Şema `odeyenKisiId` taşıyor ve makbuz **listesi** `odeyenAdi` döndürüyor, ama: (1) cari ekstrenin tahsilat satırı yalnızca `makbuzNo · tahsilatTarihi · kanal` seçiyor — ödeyen **yok**; (2) tahsilat ekranı alanı **toplamıyor**, yani bugün her kayıtta `null`; (3) dolayısıyla *"malik, kiracının borcunu ödedi"* durumu hiçbir yerde görünmüyor. Malik "ben ödedim, ekstremde yok" der ve haklıdır. ★ **Banka kanalından ÖNCE çözülmeli:** banka hareketinde ödeyen çoğu zaman borçludan farklıdır. |
| `[ORTAK]` **R6 taraması (B2) — mevzuat sayıları kodda** | **P1** | `mevzuat_parametre` tablosu hiç olmadığı için R6 bugüne dek **denetlenemedi, yalnızca varsayıldı**. Tarandı, tazminat tek örnek değil: **(a)** [belge.ts:180-187](shared/apartman-domain/src/belge/belge.ts) — belge **saklama süreleri** tablosu kodda, üstelik `kaynakReferansi: 'VUK md. 253'` gibi **kanun maddesi atıflarıyla**; en açık R6 ihlali budur. **(b)** [tahsilat.ts:376](shared/apartman-domain/src/tahsilat/tahsilat.ts) yaşlandırma kovaları `[30, 60, 90]` — varsayılan parametre, ezilebilir ama varsayılan kodda. **(c)** gecikme tazminatı %5 (yalnızca portföy öneri metninde). ⚠️ **Tabloyu açıp yalnızca tazminat oranını taşımak kuralı yine yarım uygular.** ★ Tablo **yürürlük tarihli** okuma demektir: her hesap *"hangi tarihe göre"* sorusunu taşımak zorunda — `bugun()` yerine **hesap tarihi parametresi** imzalara tablo açılırken girmeli, sonradan değil ([Ç-2](docs/CELISKI-KAYDI.md)). |
| `[ORTAK]` **Cari ekstre ekranı yok** | **P1** | Backend hazır: `GET /makbuzlar/cari/:bolumId?baslangic&bitis&kisiId?` — açılış bakiyesi, aynı gün borç-önce sıralaması, iptal edilmiş makbuzların dışlanması hepsi uçta çözülmüş. ★ Tahsilat ekranındaki **"Ödenen" sütunundan geçmişe gidiş** buraya bağlanacak: 300,00 ₺'nin hangi tahsilattan geldiği bugün izlenemiyor. |
| `[ORTAK]` **Tahsilat ekranı — kalan P2'ler** | P2 | Çok satırda **kaydırma/sayfalama davranışı belirsiz** (bugün tek tabloda hepsi çiziliyor; 12 daire × birkaç kalem sorun değil, 200 satırda ölçülmedi). Banka kanalı ekranda **kapalı** — açılması `bankaHareketiId` eşleştirmesine ve [Çelişki Kaydı Ç-1](docs/CELISKI-KAYDI.md)'e bağlı. |
| `[ORTAK]` **`lint:md` çift kodlamayı yakalamıyor** | **P1** | 4 Ağustos'ta `SESSION_SUMMARY.md` PowerShell `Set-Content` ile **çift kodlandı** (`Özeti` → `Ã–zeti`); dosyanın tamamı bozuldu, commit'lendi ve **`lint:md` yeşil geçti**. Ertesi gün tesadüfen fark edildi. ⚠️ **Devir notunun sessizce okunamaz hâle gelmesi, bir sonraki oturumu kör başlatır** — kusurun bedeli dosyanın kendisiyle sınırlı değil. ★ Öneri: `lint:md` zincirine mojibake tespiti eklensin — UTF-8 baytlarının ANSI olarak çözülmesinden doğan karakter dizileri metin dosyalarında meşru bağlamda geçmez. ⚠️ **Yanlış pozitif riski SIFIR DEĞİL ve ölçüldü:** bu satırın kendisi ilk yazımında denetimi tetikledi, çünkü örnek dizileri metin içinde barındırıyordu. Yani denetim kod bloklarını/satır içi kodu dışlamalı ya da bu belge muaf tutulmalı. Ölçülmedi: hangi dosya kümesi taranmalı (yalnızca `.md` mi, `.ts`/`.json` da mı). |
| `[ORTAK]` **`.mjs` testinden `.ts` import'u** | P2 | `tests/unit/sekme-hata.test.mjs:25` doğrudan `frontend/web/lib/sekme-hata.ts` dosyasını import ediyor. Node'un tip soyma davranışına, dolayısıyla **Node sürümüne bağımlı** — kırılgan. Derlenmiş çıktıya ya da `.mjs` kaynağa bağlanmalı. |
| `[ORTAK]` **`referans` geçici köprü** | P2 | Gider/fatura varlığı geldiğinde faturaya bağlanmalı, serbest metin değerler göç ettirilmeli. |
| `[ORTAK]` **Soft delete uzantısı bağlı değil** | P2 | `$extends` dönüşü atılıyor; bağlanırsa sütunu olmayan 15 model kırılır. Doğru çözüm muafiyeti `Prisma.dmmf`'ten türetmek. |
| `[ORTAK]` **8 tabloda kapsam politikası yok** | P2 | `belge`, `belge_iliskisi`, `belge_etiketi`, `sayac_okumasi`, `site_personeli`, `personel_sertifikasi`, `personel_zimmeti`, `audit_kaydi`. |
| `[ORTAK]` **Mevcut projelere `YAKIT` eklenmedi** | P3 | 0029 yalnızca `ANA_BAKIM`/`SIGORTA`'yı günceller. `YAKIT` yeni kurulumlara tohumla gelir; mevcut projeye eklemek ısınma modelini bilmeyi gerektirir. |

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
