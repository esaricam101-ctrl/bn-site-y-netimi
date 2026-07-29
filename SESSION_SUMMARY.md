# Oturum Özeti — 29 Temmuz 2026 (Docker kuruldu)

Bu dosya **sonraki oturuma devir notudur**. Ayrıntılı geçmiş
[`DEVLOG.md`](DEVLOG.md) içindedir; burada yalnızca *nerede kaldık* ve
*nereden devam edilecek* yazar.

---

## 1. Bu oturumda ne oldu

**Docker kuruldu ve veritabanı ilk kez ayağa kalktı.** Bu, aylardır
görülemeyen hataları görünür yaptı: üç kritik hata yalnızca ayakta bir
veritabanıyla ortaya çıkabilirdi. Hepsi derleniyordu, lint geçiyordu ve
tip denetiminden geçiyordu.

| Commit | İş |
|---|---|
| `48b0b7d` | Veritabanı ayağa kalktı — üç kritik hata düzeltildi |
| `3d05194` | Sözleşme testleri 24/24 — iki yetki açığı kapatıldı |
| `53e5010` | Gider Türü modülü + istek bağlamı middleware'e alındı |
| `e4149c4` | Gider Türü arayüzü |
| `002fcf8` | Tahakkuk modülü |
| `5322afe` | Araç modülü + migration 0004 |

Öncesinde (aynı gün, Docker'dan bağımsız): `8bca955` · `66bd2a5` ·
`b4759d3` · `ec76035` · `89a56df` · `666c918`.

### Bulunan ve düzeltilen hatalar

1. **Migration 0001 hiç çalışamazdı.** Prisma'nın üretmesi gereken tablo
   DDL'i hiç üretilmemişti; dosyada yalnızca elle yazılan RLS bölümü vardı.
   `relation "kisi" does not exist` ile düşüyordu. 0001 ve 0002 birleştirilip
   tek doğru temel üretildi.
2. **Giriş hiç çalışamazdı.** `kullanici` RLS taşır; kod "sistem işlemi olarak
   çalışır" diyordu ama `sistemIslemi` RLS'i **atlamaz**, yalnızca bağlam
   *kurmaz*. `POST /oturum/giris` her çağrıda 500 dönüyordu. RLS'siz
   `oturum_dizini` katalogu eklendi (migration 0002); senkronu **trigger**
   tutar, uygulama kodu değil.
3. **Her okuma ucu 500 dönüyordu.** 11 sorgu servisinde 30 çağrı RLS'li
   tabloları tenant bağlamı dışında okuyordu — Kapı 2 dahil.
4. **Bütün yazma uçları kırıktı.** İstek bağlamı bir *interceptor*'da
   kuruluyordu; NestJS'te guard'lar interceptor'lardan **önce** çalışır, bu
   yüzden Üç Kapı bağlama yazamıyordu. Middleware'e alındı.
5. **Tenant uçlarında hiç izin denetimi yoktu.** Kimliği doğrulanmış herhangi
   bir kullanıcı platforma yeni yerleşke açabiliyordu.
6. **Paylaşılan paketler CommonJS'ten `require` edilemiyordu**; backend
   derlense de dist hiç çalışmıyordu.

### Kalıcı korumalar

- `scripts/rls-scan.mjs` — RLS'li modele tenant bağlamı dışında erişen her
  çağrıyı yakalar. `pnpm verify` zincirinde (artık **8/8**).
- `scripts/db.mjs` — migration `bnos_migrator`, tohum `bnos_app` rolüyle
  koşar. Tohumun uygulama rolüyle koşması **kasıtlıdır**: RLS böylece fiilen
  sınanır.
- `unplugin-swc` — vitest esbuild ile derliyordu ve `emitDecoratorMetadata`
  desteklemediği için NestJS DI testlerde çalışmıyordu.

### Çalışma zamanı kanıtı (ilk kez alınabildi)

- Tenant bağlamı olmadan sorgu → exception.
- A tenant'ı B'nin kaydını **göremiyor**.
- Yabancı `tenant_id` ile yazma → *"new row violates row-level security policy"*.
- Audit UPDATE/DELETE → trigger reddediyor, kayıt duruyor.
- `bnos_app` ve `bnos_migrator` → `rolbypassrls = false`.
- 22/22 tenant tablosunda RLS + politika.

---

## 2. Şu anki durum

**Doğrulama:** 9/9 build · ESLint 0 · verify **8/8** · sözleşme testleri
**24/24** · migration **4/4 uygulandı** · 14 web rotası.

Çalışma ağacı temiz, `origin/master` ile senkron.

### Altyapı

```bash
pnpm db:up        # postgres · redis · minio
pnpm db:status    # migration durumu
pnpm db:reset     # sıfırla + migration + tohum (tohum bnos_app rolüyle)
pnpm test:contract
```

Tohum: iki tenant, her biri 1 apartman · 1 blok · 2 kat · bölümler ·
malikler · 10 KMK varsayılan gider türü.
Giriş: `yonetici@guzel-apartmani.test` / `bnos1234`.

### Tamamlanan modüller

| Modül | Durum |
|---|---|
| **Gider Türü** | ✅ API + UI. KMK md. 20 dört ekseni; kaynak referansı zorunluluğu; KARMA toplam denetimi |
| **Tahakkuk** | ✅ API. Dağıtım → sorumluluk → malik bölüşümü; snapshot; boşluksuz numara; önizleme |
| **Araç** | ✅ API + migration 0004. Plaka normalizasyonu; dönemsel kayıt; otopark aşım raporu |

---

## 3. Bekleyen işler

### A. Kalan iki modül (kullanıcı listesindeki sıra)

1. **Sayaç** — domain hazır (`shared/apartman-domain/src/sayac`), tablo yok.
   İki tablo gerekir: `sayac` + `sayac_okumasi`.
   **Dikkat edilecek kurallar (domain'de yazılı):**
   - Sayaç geriye gitmez; giderse ya sayaç değişmiştir ya okuma hatalıdır.
   - **Devir (rollover) açık bayrak ister** — sessizce varsayılmaz. Beş
     basamaklı sayaçta 99 998 → 3 okuması ya devirdir ya hatadır; tahmin
     edilirse tüketim 100 kat yanlış hesaplanır.
   - Sayaç değişen dönemde tüketim **iki parçanın toplamıdır**.
   - Tahakkuk tarafı hazır: `TUKETIM` paylaşım kuralı `bolumGirdileri[].tuketim`
     alanını zaten okuyor.
2. **Belge** — domain hazır (`shared/apartman-domain/src/belge`), tablo yok.
   **MinIO ayakta** (`localhost:9000`, `minio`/`minio12345`) ama S3 istemcisi
   henüz yazılmadı. Belge sınıfı BFS v1 §5'te **versiyonlanır**, silinmez.

### B. Migration yazarken İKİ TUZAK — 0004'te yaşandı

1. **`prisma migrate diff` çıktısı olduğu gibi kullanılamaz.** Diff, şemada
   karşılığı olmayan elle yazılmış kısmi unique index'leri **düşürmek ister**
   (`borc_tahakkuk_no_uq`, `malik_kisi_donem_uq`, `kiraci_kisi_donem_uq`,
   `sakin_kisi_donem_uq`, `yevmiye_fis_no_uq`). Körlemesine uygulanırsa
   mükerrer tahakkuk numarası sessizce mümkün hale gelir. **Her migration'da
   `DROP INDEX` satırları elle gözden geçirilmelidir.**
2. **FK eklemek `FORCE ROW LEVEL SECURITY` ile çakışır.** `ADD CONSTRAINT
   ... FOREIGN KEY` bir doğrulama taraması başlatır; tarama hedef tabloyu
   okur ve FORCE altında sahibi bile politikaya tabidir. Çözüm 0004'te
   yazılı: hedef tabloların FORCE'u yalnızca o işlem boyunca kaldırılır,
   hemen geri verilir.

### C. Kütüphane kararı bekleyenler

3. **PDF / XLSX çıktısı.** Yazdırma stil sayfası yazıldı (`@media print`);
   resmî görünümlü işletme defteri / borç bildirimi hâlâ kütüphane kararı
   bekliyor.
4. **Grafikler** — zaman serisi gerekirse.

### D. Arayüzü olmayan hazır API'ler

5. **Tahakkuk ekranı** — API tamam (`POST /tahakkuk/calistir` önizlemeli),
   arayüz yok. Önizleme modu bir sihirbaz için hazır: yönetici dağıtımı
   görüp onaylayarak uygulayabilmeli.
6. **Araç ekranı** — API tamam, arayüz yok.

### E. Bloke — teknik olmayan

7. **C-4 hukuki görüş** (KMK emredici hükümler, genel kurul yeter sayısı,
   vekâlet sınırları).

---

## 4. Sonraki oturum — ilk komut ve ilk görev

```bash
pnpm db:up && pnpm db:status && pnpm verify && pnpm test:contract
```

Beklenen: `4 migrations found` · `Database schema is up to date` ·
`Tum kontroller yesil` · `24 passed`.

Docker Desktop kapalıysa önce başlatılmalı:
`C:\Users\HP\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`

### İlk görev

**Sayaç modülü** (bekleyen liste A-1). Neden bu: `TUKETIM` paylaşım kuralı
tahakkukta destekleniyor ama tüketim değeri **elle** giriliyor. Sayaç
okuması olmadan ısıtma ve su giderleri 5627 sayılı Enerji Verimliliği
Kanunu'na uygun paylaştırılamaz.

Desen hazır: `backend/src/modules/arac/` birebir şablon olarak kullanılabilir
(migration + servis + controller + DTO, dönemsel kayıt, audit).

---

## 5. Sonraki oturumda dikkat edilecekler

- **`sistemIslemi` RLS'i ATLAMAZ**, yalnızca tenant bağlamı **kurmaz**.
  Yalnızca RLS taşımayan katalog tabloları (`tenant`, `oturum_dizini`) için
  kullanılır. `scripts/rls-scan.mjs` bunu denetler.
- **Üç Kapı bağlamı middleware'den gelir.** Bir interceptor'da bağlam kurmak
  guard'lara ulaşmaz (NestJS sırası: middleware → guard → interceptor).
- **Audit `varlik_id` bir UUID'dir.** Bileşik anahtar (`KOD:donem`) yazma
  anında patlar; çalıştırmaya kendi kimliği verilmelidir.
- **Para ve pay hiçbir yerde ondalık tutulmaz.** Kuruşu `Number`'a çevirip
  bölmek float yuvarlaması yapar (`moneyKurustan` kullanın). Arsa payı ve
  hisse kesirdir (`lib/kesir.ts` · `shared/apartman-domain/src/kesir.ts`).
- **Sahte veri üretilmez.** Backend'i olmayan alanlar `HazirDegil` bileşeniyle
  işaretlidir.
- **CT-05 disiplini:** kullanıcıya görünen her metin `messages/tr.json`
  içinde bir i18n anahtarıdır.
- **Web paketinin birim testi yok.** `tests/unit` yalnızca `shared/*/dist` ve
  `backend/src/common` derlemesini koşar; `filtre.ts`, `csv-oku.ts` ve
  `lib/kesir.ts` yalnızca tip denetimi ve derleme ile korunuyor.
- **Enum kodları iki yerde aynalı:** `frontend/web/lib/kodlar.ts` ve
  `messages/tr.json`. Domain'e yeni kod eklenirse ikisine de eklenmelidir.
- **Yetki modeli kararı:** `tenant.setup` Apartman Yöneticisi'nden alınıp
  Yönetim Şirketi'ne verildi (yeni yerleşke açmak bir onboarding işlemidir).
  Belgelerde yetki matrisi yok; farklı isteniyorsa tek yerden değişir:
  `shared/core-domain/src/yetki/roller.ts`.

---

*İlgili belgeler:* [`DEVLOG.md`](DEVLOG.md) ·
[`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) ·
[`docs/adr/log/`](docs/adr/log/)
