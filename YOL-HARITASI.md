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
| **`prisma migrate reset` kırık** | Kök sebep **şema sahipliği** — `bnos_migrator` şemayı düşüremiyordu. Sahiplik + veritabanı üzerinde `CREATE` verildi | [docs/VERITABANI-KURULUM.md](docs/VERITABANI-KURULUM.md) |
| **CI hiç çalışmıyordu** | Tetikleyicide `master` yoktu; ayrıca CI süper kullanıcıyla koşuyordu ve RLS testleri anlamsızdı | `.github/workflows/ci.yml` |

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

### "CI yeşil, demek ki her şey doğrulanıyor" → **YANLIŞ**

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

### Teknik borç

| Konu | Öncelik | Not |
|---|---|---|
| **Kapsam kurulumu O(tenant)** | P1 | `tenant.reader.ts:113` (`kisiId not` sorgusu `bolum_id` ile kısıtlanabilir) ve `:150` (3.000 satırlık JS `Set` kesişimi). Analiz `SESSION_SUMMARY` §3.K'da; ölçüm tahmini verilmedi. |
| **Prisma şeması ↔ migration sürüklenmesi** | **P1** | `migrate diff` 162 satır fark buluyor: **7 enum değeri** (`BelgeVarlikTipi` veritabanında 16, `schema.prisma`'da 9 — `YEVMIYE_FISI` gibi bir değer okunursa istemci hata verir), **11 unique indeks**, **8 yabancı anahtar**, 47 indeks adı (kozmetik). Sürüklenme kapısı CI'a bu düzeltilmeden konulamaz; konulsaydı kalıcı kırmızı olurdu. |
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
