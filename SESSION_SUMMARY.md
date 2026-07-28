# Oturum Özeti — 28 Temmuz 2026

Bu dosya **sonraki oturuma devir notudur**. Ayrıntılı geçmiş
[`DEVLOG.md`](DEVLOG.md) içindedir; burada yalnızca *nerede kaldık* ve
*nereden devam edilecek* yazar.

---

## 1. Son tamamlanan iş

**Commit `299e486`** — Kiracı ve Sakin yönetim arayüzleri.

Teslim edilen commit zinciri:

| Commit | İş |
|---|---|
| `1ef7d5b` | Tema sistemi (koyu/açık) + uygulama kabuğu (nav · breadcrumb · yoğunluk) |
| `bf31046` | Mock servis katmanı + veri tablosu + Bağımsız Bölümler ekranı |
| `572617c` | 360° Daire Kartı + denetim kaydı sorgu ucu (`GET /audit`) |
| `dd624ce` | Dashboard + Apartman + Blok/Kat ekranları |
| `d60dc49` | Oturum devir notu |
| `494abd8` | Malik yönetim arayüzü + bildirim (toast) altyapısı |
| `299e486` | Kiracı + Sakin yönetim arayüzleri |

**Doğrulama (son commit itibarıyla):** build 9/9 · ESLint 0 · verify 7/7 ·
137 birim testi · belge lint 0 · 57 backend ucu · 9 web rotası.

Çalışma ağacı **temiz**, `origin/master` ile **senkron**.

---

## 2. Bekleyen işler — öncelik sırasıyla

### A. Migration gerektirmeyenler (hemen yapılabilir)

1. ~~**Malik / Kiracı / Sakin yönetim ekranları.**~~ ✅ `494abd8` + `299e486`.
   Ekleme · devir/tahliye/çıkış · malik düzeltme, form doğrulama ve bildirim
   altyapısı tamam. Kalan: **kiracı ve sakin için düzeltme (PATCH) arayüzü** —
   backend uçları var (`PATCH …/kiracilar/:id`, `PATCH …/sakinler/:id`), arayüz
   yok.
2. **Kat ekranı (bağımsız).** Şu an bloklar sayfasında açılır liste olarak
   var; ayrı yönetim ekranı yok.
3. **Arama ve filtreleme ekranı** (öncelik listesi #15) — veri tablosunda
   hızlı arama var, gelişmiş filtre paneli yok.
4. **Kaydedilebilir filtreler.** Görünüm profili kaydetme var; filtre
   kaydetme yok.
5. **CSV içe aktarma sihirbazı** ve **toplu düzenleme** akışları.

### B. Kütüphane kararı gerektirenler

6. **PDF çıktısı ve XLSX aktarımı.** Şu an yalnızca CSV ve yazdırma var.
   Harici kütüphane seçimi gerekir.
7. **Grafikler.** Basit oran çubuğu elde yazıldı; zaman serisi ya da çoklu
   eksen gerekirse kütüphane değerlendirilmeli.

### C. Migration bekleyenler — **Docker kurulmadan başlanamaz**

8. `arac` · `sayac` + `sayac_okumasi` · `evcil_hayvan` + politikası ·
   `belge` + politikası · `not` tabloları. **Domain katmanları yazılı ve
   testli** (`shared/apartman-domain/src/{arac,sayac,evcil,belge}`); yalnızca
   kalıcılık ve API eksik.
9. `IliskiRolu` enum'una `SAKIN`; `PaylasimKurali`'na `KULLANIM_BAZLI` ·
   `BLOK_BAZLI` · `MANUEL`; `SorumlulukTipi`'ne `SAKINE_AIT`. **Domain bunları
   bugün destekliyor ama veritabanına yazılamıyor.**
10. `bolum_iliskisi` ile `malik`/`kiraci` örtüşmesinin çözülmesi — tahakkuk
    yazılırken hangi tablonun kaynak olduğu netleşmeli.
11. Hisse çakışması için `EXCLUDE USING gist`; kapı no kısmi unique index.
12. **Migration `0002` hiç uygulanmadı ve doğrulanmadı** (elle yazıldı).
13. Koordinat alanı (harita) ve MinIO dosya deposu (fotoğraf/belge).

### D. Bloke — teknik olmayan

14. **C-4 hukuki görüş** (KMK emredici hükümler, genel kurul yeter sayısı,
    vekâlet sınırları). Sprint 3'ü bloke ediyor.

---

## 3. Sonraki oturum — ilk komut ve ilk görev

### İlk çalıştırılacak komut

```bash
pnpm verify && pnpm -r build && pnpm lint
```

Beklenen: `Tum kontroller yesil` · 9 paket `Done` · `0 hata`.

`pnpm` bulunamazsa terminali kapatıp açın — `PATH` girdisi kullanıcı
registry'sine yazılıdır, açık süreçler eski ortamı miras alır.

Negatif testler `bash` `PATH`'te olmadığı için şu komutla koşulur:

```bash
TSC="$PWD/node_modules/.bin/tsc" bash scripts/negative-tests.sh
```

### İlk görev

**Kat yönetim ekranı** (bekleyen liste A-2).

Neden bu: hiyerarşinin tek eksik seviyesi. Apartman, Blok ve Bağımsız Bölüm
ekranları var; kat yalnızca bloklar sayfasında **açılır liste** olarak
görünüyor — ekleme, düzeltme ve silme arayüzü yok. Backend hazır:

| Uç | İşlev |
|---|---|
| `POST /katlar` | Kat oluştur (bloğa bağlı) |
| `GET /katlar?blokId=` | Bloğun katları (bölüm sayısıyla) |
| `PATCH /katlar/:id` | Kat no · ad düzeltme |
| `DELETE /katlar/:id` | Soft delete, gerekçe zorunlu |

Dikkat edilecek kural: **bölümü olan katın NUMARASI değiştirilemez** —
bölümlerin `kat` alanı bu numaraya bağlıdır ve oluşturmada eşitliği zorlanır.
Arayüz bu durumda alanı devre dışı bırakmalı ve nedenini yazmalı.

İkinci görev olarak **kiracı/sakin düzeltme arayüzü** (A-1'in kalanı) hızlı
bir iş: `malik-eylemleri.tsx` deseni birebir uygulanabilir.

---

## 4. Sonraki oturumda dikkat edilecekler

- **Sahte veri üretilmez.** Backend'i olmayan alanlar (araç · sayaç · belge ·
  not) `HazirDegil` bileşeniyle işaretlidir; uydurma satır göstermek
  kullanıcıya sistemin çalıştığını sandırır.
- **Mock tipleri gerçek uçların şeklini birebir taşır.** Yeni servis
  eklerken zarf (`{ kayitlar, sonrakiImlec }` gibi) korunmalı; ayrılırsa
  `NEXT_PUBLIC_MOCK=0` yapıldığında sayfa bozulur.
- **CT-05 disiplini:** kullanıcıya görünen her metin `messages/tr.json`
  içinde bir i18n anahtarıdır. Bu oturumda build iki kez bu yüzden kırıldı.
- `useSearchParams` kullanan sayfalar `<Suspense>` sınırı ister (Next.js App
  Router); sınır olmadan prerender aşamasında patlar.
- **Docker hâlâ kurulu değil.** Migration üretilemez, sözleşme testleri
  koşulamaz, RLS'in çalışma zamanı kanıtı alınamaz (DEVLOG TODO-3).

---

*İlgili belgeler:* [`DEVLOG.md`](DEVLOG.md) ·
[`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) ·
[`docs/adr/log/`](docs/adr/log/)
