# Oturum Özeti — 29 Temmuz 2026

Bu dosya **sonraki oturuma devir notudur**. Ayrıntılı geçmiş
[`DEVLOG.md`](DEVLOG.md) içindedir; burada yalnızca *nerede kaldık* ve
*nereden devam edilecek* yazar.

---

## 1. Son tamamlanan iş

**Commit `ec76035`** — Arsa payı toplu düzeltme arayüzü.
**A listesi (migration gerektirmeyenler) tamamen kapandı.**

Bu oturumda teslim edilenler:

| Commit | İş |
|---|---|
| `8bca955` | Apartman ve Blok yazma arayüzleri (A-6) |
| `66bd2a5` | Gelişmiş filtre paneli + kaydedilebilir filtreler (A-3 · A-4) |
| `b4759d3` | CSV içe aktarma sihirbazı + toplu taşıma (A-5) |
| `ec76035` | Arsa payı toplu düzeltme (KMK md. 3) |

Önceki oturumların zinciri: `1ef7d5b` · `bf31046` · `572617c` · `dd624ce` ·
`494abd8` · `299e486` · `c529be2` · `1bc1d6a`.

**Doğrulama (son commit itibarıyla):** build 9/9 · ESLint 0 · verify 7/7 ·
belge lint 0 · 57 backend ucu · **13 web rotası**.

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
5. ~~**CSV içe aktarma sihirbazı** ve **toplu düzenleme**.~~ ✅ Üç adımlı
   sihirbaz (`/bolumler/ice-aktar`) → `POST /bolumler/toplu`; toplu taşıma
   tablo seçim çubuğunda → `POST /bolumler/tasi`; arsa payı toplu düzeltme
   (`/bolumler/arsa-payi`) → `POST /bolumler/arsa-payi-duzelt`, canlı kesir
   toplamı ve liste ekranında bozuk toplam uyarısı.
6. ~~**Apartman ve Blok için yazma arayüzü.**~~ ✅ Ekleme · düzeltme · soft
   delete; bloğu olan apartman ve bölümü olan blok silinemez (düğme devre
   dışı + neden), blok başka apartmana taşınmaz.

### B. Kütüphane kararı gerektirenler

6. **PDF çıktısı ve XLSX aktarımı.** Şu an CSV ve yazdırma var; **yazdırma
   stil sayfası yazıldı** (`globals.css` · `@media print`) — koyu tema
   basılmaz, tablo başlığı her sayfada tekrarlanır, araç çubuğu ve seçim
   kolonu kâğıda çıkmaz, çıktıya ekran adı ve tarih basılır. **Resmî görünümlü
   belge (işletme defteri · borç bildirimi) hâlâ kütüphane kararı bekliyor.**
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

### İlk görev — **karar gerekiyor**

**A listesinde iş kalmadı.** Migration gerektirmeyen ve backend'i hazır olan
her akış yazıldı. Kalan üç yolun ikisi bloke, biri kullanıcı kararı bekliyor:

| Yol | Durum | Ne gerekiyor |
|---|---|---|
| **B — PDF / XLSX çıktısı** | Kütüphane kararı bekliyor | Kullanıcı onayı: bağımlılık eklenecek mi? |
| **C — araç · sayaç · evcil · belge · not** | **Docker bloke** | PostgreSQL kurulumu; domain katmanları zaten yazılı ve testli |
| **D — genel kurul / tahakkuk** | Hukuki görüş bekliyor | C-4 raporu (teknik değil) |

**Öneri:** oturuma başlarken kullanıcıya B için sorulmalı. PDF/XLSX'in şu anki
karşılığı CSV + tarayıcı yazdırmadır ve ikisi de çalışıyor; asıl eksik,
**resmî görünümlü işletme defteri / borç bildirimi çıktısı**. Bu, kütüphane
seçilmeden yapılamaz (`@react-pdf/renderer`, `pdfmake` ya da sunucu tarafı
üretim — üçünün de lisans ve boyut etkisi farklıdır).

Kullanıcı bağımlılık istemiyorsa yapılabilecek migration'sız iş:
**yazdırma stil sayfası** (`@media print`) — mevcut ekranlardan düzgün A4
çıktısı almak. Bu bağımlılık gerektirmez ve bugünkü `window.print()`
çağrısını kullanılabilir hale getirir.

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
- **Para ve pay hiçbir yerde ondalık tutulmaz.** Arsa payı ve hisse kesirdir
  (`lib/kesir.ts` · `shared/apartman-domain/src/kesir.ts`); 1/3 ondalığa
  çevrilince toplam asla tamı etmez ve ekran doğru veriyi hatalı gösterir.
- **Web paketinin birim testi yok.** `tests/unit` yalnızca `shared/*/dist` ve
  `backend/src/common` derlemesini koşar; `filtre.ts`, `csv-oku.ts` ve
  `lib/kesir.ts` yalnızca tip denetimi ve derleme ile korunuyor. Web için
  test altyapısı kurulacaksa bu üç modül ilk adaydır.
- **Enum kodları iki yerde aynalı:** `frontend/web/lib/kodlar.ts` ve
  `messages/tr.json`. Domain'e yeni kod eklenirse ikisine de eklenmelidir;
  eklenmezse kayıt listede doğru görünür ama filtrede seçenek çıkmaz.
- **Docker hâlâ kurulu değil.** Migration üretilemez, sözleşme testleri
  koşulamaz, RLS'in çalışma zamanı kanıtı alınamaz (DEVLOG TODO-3).

---

*İlgili belgeler:* [`DEVLOG.md`](DEVLOG.md) ·
[`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) ·
[`docs/adr/log/`](docs/adr/log/)
