# Oturum Özeti — 29 Temmuz 2026 (Docker + beş modül)

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
| `0b8609c` | Sayaç modülü + migration 0005 + tahakkuk entegrasyonu |
| `3985c4c` | Belge modülü + migration 0006 + nesne deposu (MinIO) |

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
7. **Yeni tenant belge politikasız açılıyordu.** Politikasız bir tenant'ta
   `tipPolitikasi` güvenli *görünen* bir varsayılana düşer (`finansalMi:
   false`) ve FATURA arşivlendiğinde silinebilir hale gelir; mali denetim izi
   sessizce kaybolur. Varsayılanlar domain'e taşındı, tenant ve politikaları
   aynı transaction'da yazılıyor.
8. **Doğrulama hatası hangi alanın hatalı olduğunu söylemiyordu.**
   `ValidationPipe` gövdesinde `message` bir DİZİDİR; filtre yalnızca metin
   kabul ettiği için sessizce düşüyor ve istemciye "Bad Request Exception"
   gidiyordu — dosyadaki yorumun uyardığı `String(unknown)` tuzağının kardeşi.

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
**24/24** · migration **6/6 uygulandı** · 14 web rotası.

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
| **Tahakkuk** | ✅ API. Dağıtım → sorumluluk → malik bölüşümü; snapshot; boşluksuz numara; önizleme; **sayaçtan tüketim** |
| **Araç** | ✅ API + migration 0004. Plaka normalizasyonu; dönemsel kayıt; otopark aşım raporu |
| **Sayaç** | ✅ API + migration 0005. Okuma · devir · değişim · dönem tüketimi · geçmiş |
| **Belge** | ✅ API + migration 0006 + MinIO. Versiyonlama · saklama politikası · önimzalı URL |

Kullanıcının istediği **beş modülün beşi de** tamamlandı.

### Sayaç — kritik kurallar (canlı doğrulandı)

- **Sayaç geriye gitmez**; küçülen okuma reddedilir.
- **Devir açık bayrak ister.** 99998 → 3 okuması `devirMi: true` olmadan
  reddedilir; işaretlendiğinde tüketim 100000−99998+3 = **5** çıkar.
  Tahmin edilseydi 99 995'lik olmayan bir tüketim yazılırdı.
- **Değişim döneminde tüketim iki parçanın toplamıdır** (5 + 120 = 125).
- Araya **geçmiş tarihli okuma girilemez** — sonraki tüketimleri yanlış bırakır.
- **Tüketim saklanır** (snapshot); sorgu anında yeniden hesaplanmaz.
- Tahakkuk `sayacTuru` ile ağırlıkları okumalardan alır. **Okuması olmayan
  bölüm varsa tahakkuk reddedilir** ve eksik kapı numaraları yazılır; sessizce
  sıfır yazmak o daireyi ısıtma giderinden muaf tutup farkı diğerlerine yükler.

### Belge — kritik kurallar (canlı doğrulandı)

- **Silinmez, versiyonlanır.** Yeni sürümde eski **arşivlenir**.
- Zincirin ucu olmayan sürüme yeni sürüm bağlanamaz (dallanma engellenir).
- **FİNANSAL belge asla silinemez** (fatura · makbuz · genel kurul kararı).
- Güncel sürüm silinemez; arşivli + saklama süresi dolmuş belge silinebilir.
- **Dosya API'den geçmez**: önimzalı URL ile doğrudan depoya. Kayıt açılmadan
  önce nesnenin gerçekten yüklendiği `HeadObject` ile doğrulanır.
- Nesne anahtarı tenant önekli; kayıtta önek denetlenir. İndirme
  `attachment` olarak zorlanır (HTML/SVG betik çalıştırmasın), URL ömrü 5 dk.

---

## 3. Bekleyen işler

### A. Arayüzü olmayan hazır API'ler — en yüksek değer burada

Backend'de beş modül tamam ama **dördünün ekranı yok**. Kullanıcı bunları
yalnızca Swagger'dan görebiliyor.

1. **Tahakkuk ekranı.** API önizlemeli (`onizleme: true`), yani bir sihirbaz
   için hazır: yönetici dağıtımı görüp onaylayarak uygular. Sayaç türü
   seçilince tüketim otomatik gelir. **Öncelikli iş budur** — tahakkuk,
   sistemin para üreten tek akışı.
2. **Sayaç ekranı.** Okuma girişi toplu olmalı: kapıcı bir turda kırk daire
   okur. Devir onayı ekranda AÇIK bir kutu olmalı, varsayılan kapalı.
3. **Belge ekranı.** Yükleme iki adımlıdır (izin → PUT → kayıt); sürüm
   geçmişi ve "geçerliliği dolanlar" listesi gösterilmeli.
4. **Araç ekranı.**

### B. Bilinen sorunlar

5. **Sözleşme testleri tenant sızdırıyor.** `numaralandirma` ve
   `rls-izolasyon` testleri her koşuda yeni tenant açıyor ve temizlemiyor;
   dokuz koşuda 29 tenant birikmişti. Ürün hatası değil, test hijyeni —
   ama geliştirme veritabanını sınırsız büyütüyor ve tenant döngüsü kuran
   migration'ları yavaşlatıyor. `afterAll` temizliği gerekir.
6. **Belge hard delete yok.** Saklama süresi dolan belge soft-delete edilir;
   nesne deposundaki dosya BIRAKILIR. KVKK silme hakkı için ayrı bir
   "gerçekten sil" akışı gerekir (soft delete ≠ hard delete ≠ anonimleştirme).

### C. Migration yazarken İKİ TUZAK — 0004, 0005 ve 0006'da yaşandı

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

### D. Kütüphane kararı bekleyenler

7. **PDF / XLSX çıktısı.** Yazdırma stil sayfası yazıldı (`@media print`);
   resmî görünümlü işletme defteri / borç bildirimi hâlâ kütüphane kararı
   bekliyor.
8. **Grafikler** — zaman serisi gerekirse.

### E. Bloke — teknik olmayan

9. **C-4 hukuki görüş** (KMK emredici hükümler, genel kurul yeter sayısı,
   vekâlet sınırları).

---

## 4. Sonraki oturum — ilk komut ve ilk görev

```bash
pnpm db:up && pnpm db:status && pnpm verify && pnpm test:contract
```

Beklenen: `6 migrations found` · `Database schema is up to date` ·
`Tum kontroller yesil` · `24 passed`.

Docker Desktop kapalıysa önce başlatılmalı:
`C:\Users\HP\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`

### İlk görev

**Tahakkuk ekranı** (bekleyen liste A-1). Neden bu: backend'de beş modül
tamam ama tahakkuk — sistemin para üreten tek akışı — yalnızca Swagger'dan
çalıştırılabiliyor. Bir yönetici ekran olmadan aidat kesemez.

API bir sihirbaz için hazır:

| Adım | Uç |
|---|---|
| 1. Gider türü seç | `GET /gider-turleri?yalnizcaAktif=true` |
| 2. Tutar · dönem · vade gir | — |
| 3. TUKETIM ise sayaç türü seç | `GET /sayaclar/tuketim/donem` ile önizleme |
| 4. Dağıtımı gör | `POST /tahakkuk/calistir` + `onizleme: true` |
| 5. Onayla ve uygula | aynı uç, `onizleme` olmadan |

Dikkat: 4. adımda dönen `satirlar[].sorumlular` her bölüm için borcun kime
yazılacağını gösterir (malik/kiracı/sakin, ASIL/İKİNCİL). Bu **onay ekranının
asıl değeridir** — yönetici parayı kimden isteyeceğini uygulamadan ÖNCE görür.
Eksik sayaç okuması varsa uç 422 döner ve eksik kapı numaralarını yazar;
ekran bunu satır satır göstermelidir.

---

## 5. Sonraki oturumda dikkat edilecekler

- **`sistemIslemi` RLS'i ATLAMAZ**, yalnızca tenant bağlamı **kurmaz**.
  Yalnızca RLS taşımayan katalog tabloları (`tenant`, `oturum_dizini`) için
  kullanılır. `scripts/rls-scan.mjs` bunu denetler.
- **Üç Kapı bağlamı middleware'den gelir.** Bir interceptor'da bağlam kurmak
  guard'lara ulaşmaz (NestJS sırası: middleware → guard → interceptor).
- **Audit `varlik_id` bir UUID'dir.** Bileşik anahtar (`KOD:donem`) yazma
  anında patlar; çalıştırmaya kendi kimliği verilmelidir.
- **Snapshot kuralı üç yerde geçerli:** borç sorumlusu, sayaç tüketimi ve
  belge sürümü. Üçü de yazıldığı anda sabitlenir; sorgu anında yeniden
  hesaplanırsa geçmiş sessizce değişir ve tahsil edilmiş tutarla tutmaz.
- **Yeni bir tenant açan her yol politikaları da yazmalıdır.** Belge saklama
  politikaları `VARSAYILAN_BELGE_POLITIKALARI` (domain) içindedir; tohum ve
  `TenantCommandService.olustur` ikisi de oradan okur. Üçüncü bir yol
  eklenirse aynı listeyi kullanmalı — politikasız tenant'ta fatura
  silinebilir hale gelir.
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
