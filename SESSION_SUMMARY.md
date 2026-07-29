# Oturum Özeti — 28 Temmuz 2026

Bu dosya **sonraki oturuma devir notudur**. Ayrıntılı geçmiş
[`DEVLOG.md`](DEVLOG.md) içindedir; burada yalnızca *nerede kaldık* ve
*nereden devam edilecek* yazar.

---

## 1. Son tamamlanan iş

**Commit `1bc1d6a`** — Kiracı/Sakin düzeltme arayüzleri (A-1 tamamen kapandı).

Teslim edilen commit zinciri:

| Commit | İş |
|---|---|
| `1ef7d5b` | Tema sistemi (koyu/açık) + uygulama kabuğu (nav · breadcrumb · yoğunluk) |
| `bf31046` | Mock servis katmanı + veri tablosu + Bağımsız Bölümler ekranı |
| `572617c` | 360° Daire Kartı + denetim kaydı sorgu ucu (`GET /audit`) |
| `dd624ce` | Dashboard + Apartman + Blok/Kat ekranları |
| `494abd8` | Malik yönetim arayüzü + bildirim (toast) altyapısı |
| `299e486` | Kiracı + Sakin yönetim arayüzleri (ekleme · tahliye · çıkış) |
| `c529be2` | Kat yönetim ekranı |
| `1bc1d6a` | Kiracı/Sakin düzeltme (PATCH) arayüzleri |

**Doğrulama (son commit itibarıyla):** build 9/9 · ESLint 0 · verify 7/7 ·
137 birim testi · belge lint 0 · 57 backend ucu · **10 web rotası**.

Çalışma ağacı **temiz**, `origin/master` ile **senkron**.

---

## 2. Bekleyen işler — öncelik sırasıyla

### A. Migration gerektirmeyenler (hemen yapılabilir)

1. ~~**Malik / Kiracı / Sakin yönetim ekranları.**~~ ✅ `494abd8` · `299e486` ·
   `1bc1d6a`. Ekleme · devir/tahliye/çıkış · düzeltme, form doğrulama ve
   bildirim altyapısı tamam.
2. ~~**Kat ekranı (bağımsız).**~~ ✅ `c529be2`. Ekleme · düzeltme · soft delete;
   bölümü olan katta numara kilitli.
3. ~~**Arama ve filtreleme ekranı**~~ ✅ Kolon bazında işleçli filtre paneli
   (`components/tablo/filtre.ts` motor · `filtre-paneli.tsx` arayüz).
   **Bilinen boşluk:** motorun çalışma zamanı birim testi yok — `tests/unit`
   yalnızca `shared/*/dist` ve `backend/src/common` derlemesini koşabiliyor,
   web paketi için test altyapısı kurulu değil.
4. ~~**Kaydedilebilir filtreler.**~~ ✅ Adlandırılmış filtreler
   `localStorage`'da (`bnos.filtre.<ekran>`); görünüm profilinden ayrıdır.
5. **CSV içe aktarma sihirbazı** ve **toplu düzenleme** akışları.
6. ~~**Apartman ve Blok için yazma arayüzü.**~~ ✅ Ekleme · düzeltme · soft
   delete; bloğu olan apartman ve bölümü olan blok silinemez (düğme devre
   dışı + neden), blok başka apartmana taşınmaz.

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

**Apartman ve Blok için yazma arayüzü** (bekleyen liste A-6).

Neden bu: hiyerarşinin en üst iki seviyesi hâlâ **salt okunur**. Kat ve
Bağımsız Bölüm ekranlarında ekleme/düzeltme/silme var; apartman ve blok
yalnızca listeleniyor. Backend hazır:

| Uç | İşlev |
|---|---|
| `POST /apartmanlar` · `PATCH /:id` · `DELETE /:id` | Apartman CRUD |
| `POST /bloklar` · `PATCH /:id` · `DELETE /:id` | Blok CRUD |

Dikkat edilecek kurallar:

- **Bloğu olan apartman silinemez**, **bölümü olan blok silinemez** — kat
  ekranındaki gibi düğme devre dışı + neden yazılmalı.
- **Blok başka apartmana taşınmaz**; `PATCH /bloklar/:id` yalnızca `ad` alır.
- Blok adı **apartman içinde** tekildir (sitede iki apartmanın da "A Blok"u
  olabilir) — hata mesajı bunu yansıtmalı.

Desen hazır: [`app/katlar/page.tsx`](frontend/web/app/katlar/page.tsx) birebir
şablon olarak kullanılabilir (kart + satır içi form + soft delete gerekçesi).

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
