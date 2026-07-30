# Oturum Özeti — 29-30 Temmuz 2026 (Docker · on modül · hızlı kayıt · portföy)

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
| `58ae032` | Belge profesyonel seviye (0007) + Daire Görevlileri (0008) |
| `a9d4071` | Devir notu — kritik soft-delete bulgusu |
| `b869940` | Modül adı düzeltmesi: Konut Çalışanları → Daire Görevlileri (0009) |
| `394eb61` | Site Personeli / Daire Görevlisi ayrımı (0010) + tek ekran hızlı kayıt (0011-0013) + Misafir modülü |
| `e191968` | Devir notu — v23/v24 referans mimari görevi |
| `2f39c75` | Portföy Yönetim Merkezi (0014 · ADR-0009) + v23/v24 boşluk analizi |
| _bu commit_ | **Beş "Yeni Ekle" formu SEKMELİ** — Kişi Bilgileri sekmesi + modüle özel sekmeler |

Öncesinde (aynı gün, Docker'dan bağımsız): `8bca955` · `66bd2a5` ·
`b4759d3` · `ec76035` · `89a56df` · `666c918`.

### Bu commit'te yapılan — beş form sekmeli hâle geldi

Malik · Kiracı · Sakin · Misafir · Daire Görevlisi "Yeni Ekle" ekranları
sekmelendi. İlk sekme **Kişi Bilgileri** (ad · soyad · TC · telefon · e-posta ·
doğum tarihi · cinsiyet · adres · not · **çoklu araç plakası**), ardından
modüle özel sekmeler:

| Modül | Sekmeler |
|---|---|
| Malik | Kişi Bilgileri · **Tapu Bilgileri** |
| Kiracı | Kişi Bilgileri · **Kira Sözleşmesi** · **Kefil** |
| Sakin | Kişi Bilgileri · **Oturum Bilgileri** |
| Misafir | Kişi Bilgileri · **Ziyaret Bilgileri** |
| Daire Görevlisi | Kişi Bilgileri · **Görev Bilgileri** |

**TEK FORM, TEK KAYDET.** Sekmeler yalnızca hangi bölümün görüneceğini
değiştirir; her sekmenin kendi kaydet düğmesi YOKTUR. Kullanıcının daha önce
istediği *"varsayılan kullanım tek ekrandan hızlı kayıt"* böylece korundu.

⚠️ **Sekmeli formun ASIL TUZAĞI: gizli sekmedeki hata görünmez.** Kullanıcı
Kaydet'e basar, hiçbir şey olmaz ve nedenini göremez. Üç koruma birlikte
uygulandı:

1. **Sekme başlığında hata rozeti** — o sekmedeki hata sayısı kırmızı badge
   olarak görünür (`aria-label="N hata"`; çıplak sayı ekran okuyucuda
   anlamsızdır).
2. **Gönderim başarısızsa hatalı ilk sekmeye geçilir** (`ilkHataliSekme`).
3. **Gizli alanda `required` KULLANILMAZ.** Tarayıcı gizli bir zorunlu alanı
   odaklayamaz ve gönderimi *"An invalid form control is not focusable"* ile
   **sessizce** durdurur. Beş formdaki `required` nitelikleri kaldırıldı;
   zorunluluk kendi doğrulamamızla uygulanıyor.

Ek olarak: **paneller kaldırılmaz, `hidden` ile gizlenir** — ağaçtan
çıkarılsaydı sekme değiştikçe alanların DOM durumu sıfırlanırdı. Klavye
gezinmesi WAI-ARIA tabs desenine göre (oklar · Home/End · tek durak).

**Hata yönlendirme mantığı test edildi.** `lib/sekme-hata.ts` React'ten ayrı
tutuldu (JSX taşıyan modül `node --test` ile içe alınamaz) ve 9 test yazıldı;
biri özellikle şu ayrımı korur: `plaka-0` ön ekle yakalanmalı ama `plakaci`
yakalanMAmalı. Birim testleri artık **155/155**.

> `.test.ts` olarak yazmak denendi: `pnpm verify` koşuyor ama **ESLint
> düşüyor** — kök `tsconfig.json` yalnızca `references` taşıyan bir çözüm
> dosyası (`files: []`), bu yüzden `projectService` test dosyasını hiçbir
> projede bulamıyor. `.mjs` + Node 24 yerleşik tip soyutlaması bunu tümüyle
> çözdü.

### Önceki commit'te yapılan — Portföy Yönetim Merkezi (ADR-0009)

**YÖNETİM FİRMASI ARTIK BİR TENANT.** Ürün gereksinimi Portföy Yönetim
Merkezi'ni zorunlu kıldı: firma giriş yaptığında doğrudan bir projeye
düşmüyor, önce yönettiği bütün projeleri kontrol merkezinde görüyor.

⚠️ **Yeni mimari TASARLANMADI.** [ADR-0002](docs/adr/log/0002-tenant-modeli.md)
bu günü öngörmüş ve çözüm yolunu *şimdiden yazmıştı*:

> Portföy görünümü ileride **RLS gevşetilerek çözülmeyecektir.** Çözüm yolu:
> yönetim şirketi tenant'ı + apartman tenant'larından **açık devir**
> (delegation) ilişkisi. Bu not, ileride kolay yolun (RLS by-pass) cazip
> görünmemesi için yazılmıştır.

Uygulanan tam olarak bu yol:

| Katman | Ne yapıldı |
|---|---|
| Şema (0014) | `yonetim_delegasyonu` — firma tenant'ı ⟷ proje tenant'ı; **iki taraflı** RLS politikası |
| Domain | `devirGecerliMi` · `devriDogrula` · `devirSonlandirmayiDogrula`; `Tenant.olustur` üç tipi de kabul ediyor |
| Kapı 2 | Üyeliğin **ikinci yolu**: aktif devir. Jeton `dvr` claim'i taşır |
| Backend | `/portfoy/ozet` · `/portfoy/projeler/:id/gir` · devir ekle/sonlandır |
| Rol | `YONETIM_SIRKETI.varsayilanPanel` → **`/portfoy`** (projeye yönlendirilmiyor) |
| Frontend | `/portfoy` kontrol merkezi + proje seçimi + kabukta "Aktif proje / Portföye dön" |
| Tohum | `portfoy@bn-yonetim.test` / `bnos1234` — iki projeye açık devir |

**ÇAPRAZ-TENANT SORGU YOK.** Özet, proje başına ayrı `tenantIslemi(projeId)`
sorgusunun uygulama katmanında toplanmasıdır — ADR-0002'nin açıkça kabul
ettiği bedel. `BYPASSRLS` yok ve CI'da denetleniyor.

**Kısmî veri açıkça bildiriliyor:** bir projenin özeti okunamazsa satır
`ozetHatasi` ile YİNE döner ve toplamların eksik olduğu yazılır. 150 projeli
bir firmada bir projenin arızası öteki 149'u görünmez kılmamalı.

**Uydurma veri üretilmedi:** "Açık İş Emirleri" ve "Bekleyen Talepler"
modülleri yok; uçlar **-1** döner ve ekran "Modül hazır değil" gösterir.
Sıfır basmak, "iş emri yok" ile "modül yok" ayrımını gizlerdi.

### v23/v24 referans mimari boşluk analizi

[`docs/V23-V24-BOSLUK-ANALIZI.md`](docs/V23-V24-BOSLUK-ANALIZI.md) —
referanslar madde madde mevcut kodla karşılaştırıldı.

En önemli iki bulgu:

1. **Referanslar ekran tasarımı değil, SÜRÜM YOL HARİTASIDIR** ve kendileri
   bunu söylüyor. Ekran envanteri V22 "Temel" belgesindedir.
2. 🔴 **`/belgeler` menüde var ama sayfası YOK** — link 404 veriyor. Backend
   Belge modülü tam çalışıyor; eksik olan yalnızca ekran. Eski "Kişiler"
   girdisiyle aynı hata sınıfı.

### Önceki commit'te yapılan — iki kavram ayrıldı, kayıt akışı tek ekrana indi

**1. İKİ AYRI KAVRAM TEK TABLODA BİRLEŞTİRİLMİŞTİ.** 0009'da yapılan
adlandırma düzeltmesi hatalıydı: yönetimin kadrosu ile malikin ücretli
çalıştırdığı ev hizmetleri görevlisi aynı tabloya konmuştu. 0010 ile ayrıldı:

| | **Site Personeli** | **Daire Görevlisi** |
|---|---|---|
| İşveren | **Yönetim** | **Malik / Kiracı / Sakin** |
| Örnek | Site müdürü, güvenlik, temizlik, teknik, bahçıvan, vale | Çocuk bakıcısı, hasta bakıcısı, ev yardımcısı, aşçı, şoför |
| Ücret | İşletme projesinden | Daire sahibi öder |
| SGK · departman · vardiya · zimmet | **Var** | **YOK** — yönetimin yükümlülüğü değil |
| Kapsam | Site geneli ya da apartman (`apartmanId` opsiyonel) | **Zorunlu tek bağımsız bölüm** |
| Aynı TC tekilliği | Tenant geneli (mükerrer kayıt bordroyu ikiye katlar) | **Bölüm başına** (aynı temizlikçi üç dairede çalışabilir) |
| KVKK veri sorumlusu | Yönetim | Onu çalıştıran malik |
| Uç | `/site-personeli` | `/daire-gorevlileri` |

**2. KİŞİ SEÇME ZORUNLULUĞU KALKTI (0011).** Malik/kiracı/sakin eklemek için
önce "Kişiler"e gidip kayıt açmak, sonra o kişiyi seçmek gerekiyordu; bu,
sahada tek işlem olan bir şeyi ikiye bölüyordu. Artık `kisiId` isteğe bağlı;
form içinde ad, soyad, TC, telefon, e-posta, doğum tarihi, cinsiyet, adres,
not ve **çoklu araç plakası** girilebiliyor.

> **Mükerrer kimlik kaydı TC ve E-POSTA üzerinden önleniyor.** `kisiId`
> zorunluluğunun asıl işlevi buydu. Aynı kişi iki `Kisi` satırına bölünürse
> borç geçmişi, tahakkuk sorumluluğu ve KVKK silme talebi iki kayda dağılır.
> `kisiyiCoz` sırası: `kisiId` → TC eşleşmesi → e-posta eşleşmesi → yeni kayıt.
> Mevcut kişi bulunduğunda YALNIZCA BOŞ alanlar doldurulur; dolu alanın
> üzerine yazmak kiracı eklerken malikin telefonunu değiştirmek olurdu.

**3. MİSAFİR MODÜLÜ (0011).** Misafir **hak sahibi değildir**: borç sorumlusu
olmaz, tahakkuka girmez, arsa payı taşımaz. Bu yüzden `Kisi` kaydı AÇILMAZ —
verisi kısa ömürlüdür ve kalıcı kimlik kaydı, ziyaretten aylar sonra silinmesi
gereken veriyi malik kayıtlarıyla aynı ömre bağlardı (KVKK md. 4/1-ç).
Çıkış tarihi boşsa misafir **hâlen içeridedir**; `/misafirler/iceride` güvenlik
ve tahliye listesidir.

**4. KEFİL (0012).** Kiracıya kefil alanları eklendi ve **ayrı `Kisi` kaydı
açılmıyor**: yönetimin ortak gider alacağı malike (KMK md. 20) ve kiracıya
(md. 22, kira bedeli kadar müteselsil) yönelir, **kefile yönelmez** — kefalet
kira sözleşmesinin tarafıdır, yönetim planının değil.

**5. TEK PLAKA KÜTÜĞÜ, DÖRT SAHİP TİPİ + KAPSAM (0011-0013).** Otopark
kapasitesi malik aracıyla bakıcının aracını ayırt etmez; ikisi de yer kaplar.
`arac` tek kütük kaldı, sahip alanı dörde açıldı (`arac_tek_sahip` tam olarak
birini zorlar) ve **kapsam** ayrıldı (`arac_kapsam`):

- Malik · kiracı · sakin · **daire görevlisi** · **misafir** aracı →
  **ilgili bağımsız bölüme** (`bolum_id` dolu)
- **Site personeli aracı → YÖNETİME** (`bolum_id` boş)

> Personel aracını bir daireye yazmak o dairenin otopark hakkını tüketmiş
> gösterir ve KULLANIM_BAZLI dağıtımda ona fazla pay çıkarır.

Görevli/misafir/personel kaydı kapandığında **açık araç kayıtları da aynı
tarihte kapanır**; kapanmasaydı işi bitmiş kişinin aracı otopark sayımında yer
kaplamaya devam ederdi.

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

**Doğrulama:** 9/9 build · ESLint 0 · tip denetimi temiz · verify **8/8** ·
birim testleri **155/155** · sözleşme testleri **24/24** · migration
**14/14 uygulandı** · 17 web rotası · hızlı kayıt canlı testi **40/40** ·
portföy canlı testi **19/19**.

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
| **Belge** | ✅ API + migration 0006/0007 + MinIO. Versiyonlama · kategori · çoklu ilişki · etiket · arama · gizlilik · önizleme · KVKK imha |
| **Site Personeli** | ✅ API + UI + migration 0008/0009/0010. İşveren YÖNETİM. On görev · vardiya · SGK · sertifika · zimmet · ayrılış · plaka (yönetim kapsamı) |
| **Daire Görevlisi** | ✅ API + UI + migration 0010. İşveren MALİK/KİRACI/SAKİN. Ev hizmetleri; bölüm zorunlu; plaka; çalışma sonlandırma |
| **Misafir** | ✅ API + UI + migration 0011. `Kisi` kaydı açmaz; giriş/çıkış; "hâlen içeride" listesi; plaka |
| **Hızlı kayıt** | ✅ Malik · Kiracı · Sakin · Misafir · Daire Görevlisi tek ekrandan. Kişi seçimi isteğe bağlı; TC/e-posta ile tekilleştirme; çoklu plaka |

Kullanıcının istediği beş modül + Belge profesyonel seviye + Site Personeli +
Daire Görevlisi + Misafir + tek ekran hızlı kayıt tamamlandı.

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
- **Kategori TÜRÜN özelliğidir**, belgenin değil: "Fatura" her zaman MALI.
  Belge başına serbest bırakılsaydı aynı tür farklı kategorilere düşer ve
  kategori bazlı arama güvenilmez olurdu.
- **Gizlilik yükseltilebilir, DÜŞÜRÜLEMEZ.** Tapu ve kira sözleşmesinin
  varsayılanı KISIYE_OZEL'dir; tek yanlış tıkla herkese açılamamalı.
- **Önizleme yalnızca betik taşıyamayan tiplerde** (PDF · resim · düz metin).
  HTML/SVG asla — depo alan adında çalışan betik oradaki oturum bağlamına
  erişebilir.
- **KVKK kalıcı silmede üstveri KALIR.** Kayıt da silinseydi "bu belge şu
  tarihte, şu gerekçeyle imha edildi" cevabı kaybolur ve imha kanıtlanamazdı.
  Nesne, veritabanı işlemi KAPANDIKTAN SONRA silinir.

### Site Personeli — kritik kurallar (canlı doğrulandı)

- **`kisi` tablosundan AYRI tablo.** `Kisi` malik/kiracı/sakin ilişkilerinin
  dayandığı KİMLİK kaydı; personel bir İSTİHDAM kaydı. Aynı tabloda olsaydı
  bir kapıcının o binada kiracı olması durumunda "işten ayrıldı" işareti
  kiracılık kaydını da etkilerdi.
- Aynı TC ile **AKTİF** ikinci kayıt reddedilir (bordroyu ikiye katlar);
  ayrılmış kayıt engellemez — aynı kişi tekrar işe alınabilir.
- **Ayrılmış personel AKTİF olamaz** (veritabanı kısıtı). Ayrı bırakılsaydı
  "aktif personel" listesi ayrılmış kişileri gösterir ve vardiya planlaması
  yanlış yapılırdı.
- **Açık zimmet ayrılışı ENGELLEMEZ, UYARIR.** Teslim edilmemiş telsiz, kaydı
  kapatmamak için sebep değildir; görünür olması yeter.
- Zimmet **iade ile kapanır**, silinmez — teslim geçmişi kanıttır.
- **Aracı YÖNETİM kapsamındadır** (`bolum_id` boş). Ayrılışta araç da kapanır.
- **TC kimlik no denetim gövdesine YAZILMAZ.** Audit kaydı değiştirilemezdir;
  oraya giren kişisel veri bir daha silinemez.

### Daire Görevlisi — kritik kurallar (canlı doğrulandı)

- **İşveren YÖNETİM DEĞİLDİR**, malik/kiracı/sakindir. Bu yüzden SGK ·
  departman · vardiya · zimmet alanları **yoktur**: bunları yönetimin
  kütüğünde tutmak, yönetimi hukuken işveren gibi gösterirdi (5510 s.K.
  yükümlülüğü işvereninkidir).
- **`Kisi` kaydı AÇILMAZ.** Görevli hak sahibi değildir; `Kisi`ye yazılsaydı
  malik/kiracı listelerine karışır ve borç sorumluluğu sorgularında görünürdü.
  `isverenKisiId` yalnızca ONU ÇALIŞTIRAN kişiyi gösterir.
- **`bolumId` ZORUNLU** — "site genelinde görevli" hâli yoktur.
- Aynı TC tekilliği **BÖLÜM BAŞINADIR**: bir temizlik görevlisinin sitede üç
  ayrı dairede çalışması olağandır ve her biri ayrı hizmet ilişkisidir.
  Personeldeki kısıt tenant genelindedir, çünkü orada mükerrer kayıt bordro
  hatasıdır.
- Çalışma sonlandırıldığında **açık araç kayıtları da kapanır**.

### Misafir — kritik kurallar (canlı doğrulandı)

- **HAK SAHİBİ DEĞİLDİR**: borç sorumlusu olmaz, tahakkuka girmez, arsa payı
  taşımaz, genel kurulda oy kullanmaz.
- **`Kisi` kaydı AÇILMAZ.** KVKK: misafir verisi kısa ömürlüdür; kalıcı kimlik
  kaydı, ziyaretten aylar sonra silinmesi gereken veriyi malik/kiracı
  kayıtlarıyla aynı ömre bağlardı.
- **Çıkış tarihi boşsa misafir hâlen içeridedir** — `/misafirler/iceride`
  güvenlik ve tahliye listesidir; kısmî index bu sorguya hizmet eder.
- Çıkışta **aracı da kapanır**; kapanmasaydı çıkmış misafirin aracı otopark
  sayımında yer kaplamaya devam ederdi.

### Hızlı kayıt — kritik kurallar (canlı doğrulandı, 40/40)

- **Kişi seçimi isteğe bağlı.** `kisiId` verilirse mevcut kişi kullanılır ve
  form alanları YOK SAYILIR — var olan kimlik kaydını yan kapıdan güncellemek,
  kiracı eklerken malikin adını değiştirmek gibi sonuçlar üretirdi.
- **Tekilleştirme sırası:** `kisiId` → TC eşleşmesi → **e-posta eşleşmesi** →
  yeni kayıt. E-posta da bir kimlik anahtarıdır: `kisi_eposta_uq` tenant
  genelinde tekildir.
- Mevcut kişi bulunduğunda **yalnızca BOŞ alanlar doldurulur**.
- E-posta doldurulacaksa **sahibi denetlenir**; başka kişiye kayıtlıysa
  anlaşılır bir 422 döner. Denetim yoksa veritabanı kısıtı **500** olarak
  dönüyordu (bu oturumda bulundu ve düzeltildi).
- Yanıtta `kisiOlusturulduMu` ve `tcIleEslestiMi` döner: kullanıcı yeni kişi
  girdiğini sanırken mevcut bir kayda bağlanmış olabilir; görmezse mükerrer
  sandığı kaydı silmeye çalışır.
- **Plakalar aynı işlemde yazılır.** Hata verirse ana kayıt da geri alınır;
  yarım kayıt "plakayı da girdim" sanan kullanıcı için sessiz veri kaybıdır.
- **Mükerrer plaka reddedilir** — hem veritabanındaki kayıtlara hem AYNI
  FORMDA iki kez yazılan plakaya karşı; tekillik **tenant genelindedir**.

---

## 3. Bekleyen işler

### A. Arayüzü olmayan hazır API'ler — en yüksek değer burada

Backend'de dokuz modül tamam ama **dördünün ekranı yok** (Tahakkuk · Sayaç ·
Belge · Araç). Kullanıcı bunları yalnızca Swagger'dan görebiliyor.

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

0. 🔴 **SOFT DELETE UZANTISI BAĞLI DEĞİL — silinmiş kayıtlar her listede
   görünüyor.**

   `PrismaService` yapıcısında:
   ```ts
   this.$extends(softDeleteUzantisi());   // dönüş değeri ATILIYOR
   ```
   `$extends` **yeni bir istemci döndürür**, `this`'i değiştirmez. Uzantı
   hiçbir zaman devreye girmiyor. Sonuçları:
   - Soft-delete edilmiş kayıtlar **bütün liste uçlarında dönüyor**.
   - Birçok sorgu servisinin yorumunda yazan *"soft delete filtresi Prisma
     uzantısı tarafından MERKEZÎ uygulanır"* ifadesi **YANLIŞ**.
   - `__silinmisleriDahilEt` sihirli bayrağı Prisma'ya bilinmeyen alan olarak
     gider ve `PrismaClientValidationError` verir (belge modülünde bu 500 ile
     yakalandı; orada açık `silinmeTarihi` koşuluna çevrildi).

   **Neden bu oturumda düzeltilmedi:** düzeltmek çapraz kesen bir değişiklik.
   Şu an silinmiş kayıtları gösteren her uç birden göstermemeye başlar; 24
   sözleşme testinin ve mevcut ekranların davranışı değişir. Düşük kalan
   bütçeyle riskli bulundu ve **bilinçli olarak devredildi**.

   **Nasıl düzeltilir (üç seçenek):**
   - `$use` middleware — `extends PrismaClient` ile yerinde çalışır, Prisma
     5'te kullanımdan kaldırılmış ama işlevsel. En küçük değişiklik.
   - `PrismaService` genişletilmiş istemciyi tutup delege etsin — temiz ama
     geniş refactor.
   - Uzantıyı bırakıp her sorguda koşulu AÇIKÇA yazmak — belge modülünde
     şimdilik bu yapıldı.

   Hangisi seçilirse `scripts/` altına bir tarayıcı eklenmeli: RLS
   tarayıcısı gibi, soft delete taşıyan modele koşulsuz sorgu atan yeri
   yakalasın.

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

   ⚠️ **0011'de öğrenilen ek:** hedef tablo YETMEZ, **KAYNAK tablo da**
   FORCE'suz olmalıdır. Doğrulama taraması
   `SELECT fk.x FROM ONLY kaynak fk LEFT JOIN hedef pk ON …` koşar, yani
   kaynağı DA okur. 0004 ve 0008'de kaynak tablo yeni ve RLS'siz olduğu için
   fark edilmemişti; `arac`a FK eklerken `arac` üzerinde FORCE açık olduğundan
   migration `app_tenant_id()` hatasıyla düştü.

3. **Prisma isteğe bağlı ilişkide `onDelete: SetNull` VARSAYAR.** SQL'de
   `ON DELETE RESTRICT` yazılıp şemada belirtilmezse `migrate diff` kalıcı
   sapma gösterir. Daha kötüsü: `arac`ta SetNull, sahibi silinen satırın sahip
   alanını boşaltıp `arac_tek_sahip` kısıtını **silme anında** ihlal ederdi.
   Yeni isteğe bağlı ilişkilerde `onDelete` **açıkça yazılmalıdır**.

**Bilinen kalıcı `migrate diff` sapmaları** (beklenen, düzeltilmemeli):
elle yazılmış kısmî unique index'ler (`arac_plaka_donem_uq`,
`belge_iliskisi_tekil_uq`, `borc_tahakkuk_no_uq`, `kiraci_kisi_donem_uq`,
`malik_kisi_donem_uq`, `sakin_kisi_donem_uq`, `sayac_okumasi_tarih_uq`,
`yevmiye_fis_no_uq`), kısmî `misafir_tenant_id_cikis_tarihi_idx` ve
`arac_tenant_id_yonetim_idx`, `oturum_dizini` index adı.

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

Beklenen: `14 migrations found` · `Database schema is up to date` ·
`Tum kontroller yesil` · `24 passed`.

Docker Desktop kapalıysa önce başlatılmalı:
`C:\Users\HP\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`

### İlk görev — `/belgeler` ekranı (menüde ölü link)

**En düşük maliyet, en görünür kazanç.** `components/uygulama-kabugu.tsx`
menüsünde `/belgeler` girdisi var ama `app/belgeler/` **yok**; link 404
veriyor. Backend Belge modülü **tam** (versiyonlama · kategori · çoklu ilişki ·
etiket · arama · gizlilik · önizleme · KVKK imha) ve MinIO bağlı.

Ekranın taşıması gerekenler (backend hazır):

- Yükleme **iki adımlıdır**: `POST /belgeler/yukleme-izni` → önimzalı URL'ye
  `PUT` → `POST /belgeler`. Dosya API'den geçmez.
- Sürüm geçmişi zinciri; güncel sürüm silinemez.
- Kategori · etiket · tarih aralığı · ilişki (apartman/blok/bölüm/kişi) süzgeci.
- "Geçerliliği dolanlar" listesi.
- Gizlilik yükseltilebilir, DÜŞÜRÜLEMEZ — arayüz düşürmeyi teklif etmemeli.
- Önizleme yalnızca betik taşıyamayan tiplerde (PDF · resim · düz metin).

### İkinci görev — Tahakkuk Sihirbazı

Boşluk analizinin 2. önceliği: sistemin **para üreten tek akışı** ve ekranı
yok. Ayrıntılı kapsam aşağıda.

> Sıralamanın tamamı ve gerekçeleri:
> [`docs/V23-V24-BOSLUK-ANALIZI.md`](docs/V23-V24-BOSLUK-ANALIZI.md) §5.
> Kısaca: (3) Muhasebe ekranı · (4) Malik/Kiracı liste ekranları ·
> (5) **v24 iskeleti** (İş Emri + Onay Akışı + Bildirim Merkezi — "Teknik
> İşler", "Açık İş Emirleri" ve personel görev onayının ORTAK temeli; üçünü
> ayrı kurmak üç farklı onay mekanizması doğurur) · (6) personel görev
> yürütme akışı · (7) v23 pano derinliği.

### Tahakkuk Sihirbazı — kapsam

Kullanıcı bu işi tarif etti ama bütçe Belge + Site Personeli / Daire Görevlisi
ayrımı + hızlı kayıt + Portföy Merkezi'ne gitti; **hiç başlanmadı**.

Talep edilen kapsam (kullanıcının kendi sözleriyle: *"ticari muhasebe
mantığıyla değil, Kat Mülkiyeti Kanunu ve profesyonel site yönetimi
mantığıyla"*):

**1. Motorun desteklemesi gereken tahakkuk türleri.** Bugün `PaylasimKurali`
ekseni var (ESIT · ARSA_PAYI · BRUT_M2 · NET_M2 · TUKETIM · SABIT_TUTAR ·
KULLANIM_BAZLI · BLOK_BAZLI · MANUEL · KARMA) ama bunlar *nasıl dağıtılacağı*.
Eksik olan *ne olduğu*: **aidat · avans · ek bütçe · demirbaş · gecikme
tazminatı**. Bunlar yeni bir eksen (`TahakkukTuru`) ister; paylaşım kuralıyla
karıştırılmamalı:
   - **Avans** ileriki döneme mahsuptur; ödendiğinde borç kapatmaz, alacak
     doğurur (KMK md. 20 işletme projesi avansı).
   - **Ek bütçe** genel kurul kararı ister — `kaynakReferansi` zorunlu olmalı.
   - **Demirbaş** MALİKE aittir (KMK md. 20/b), kiracıya yansıtılamaz.
   - **Gecikme tazminatı** KMK md. 20/son: aylık **%5**'i geçemez ve ANA
     BORÇTAN AYRI bir kalemdir; ana borca eklenip üzerine yeniden faiz
     işletilirse bileşik faize dönüşür ve talep edilemez hale gelir.

**2. Önizlemede denetim listesi.** Bugün önizleme dağıtımı gösteriyor.
Eklenmesi istenen kontroller: borçlular · paylaşım kuralları · **muafiyetler**
· **yönetim planı istisnaları** · **genel kurul kararları** · **geçmiş
tahakkuklar**. Bunların bir kısmı için veri kaynağı henüz yok (yönetim planı
istisnası ve genel kurul kararı yalnızca `kaynakReferansi` metni olarak var) —
**önce o eksik netleştirilmeli**, uydurma alan eklenmemeli.

**3. Geriye dönük değişmezlik ve düzeltme akışları.** Bugün tahakkuk yazıldıktan
sonra değiştirilemiyor (iyi) ama düzeltme YOLU YOK. Gereken üç kayıt tipi:
   - **İptal** (ters kayıt / storno) — borç sıfırlanır, iki kayıt da durur.
   - **Mahsup** — fazla tahsilat sonraki döneme sayılır.
   - **Devir** — kapanmayan borç sonraki döneme taşınır.
   `borc` tablosu FINANSAL sınıftır ve silinmez; bu üçü yeni satır olarak
   yazılmalı ve orijinale referans vermeli (`ters_kayit_id` gibi).

Hazır olan altyapı: `POST /tahakkuk/calistir` önizlemeli çalışıyor,
`satirlar[].sorumlular` her bölüm için borcun kime yazılacağını
(malik/kiracı/sakin · ASIL/İKİNCİL) gösteriyor — **onay ekranının asıl değeri
budur**, yönetici parayı kimden isteyeceğini uygulamadan ÖNCE görür. Sayaç
entegrasyonu da hazır: eksik okuma varsa uç 422 döner ve eksik kapı
numaralarını yazar.

| Sihirbaz adımı | Uç |
|---|---|
| 1. Gider türü seç | `GET /gider-turleri?yalnizcaAktif=true` |
| 2. Tutar · dönem · vade | — |
| 3. TUKETIM ise sayaç türü | `GET /sayaclar/tuketim/donem` |
| 4. Dağıtımı ve borçluları gör | `POST /tahakkuk/calistir` + `onizleme: true` |
| 5. Onayla ve uygula | aynı uç, `onizleme` olmadan |

---

## 5. Bu oturumda alınan önemli kararlar

Hepsi geri alınabilir; nedenleri burada yazılı ki tartışılabilsin.

| Karar | Gerekçe | Nerede |
|---|---|---|
| **0001 ve 0002 tek temele birleştirildi** | 0001 uygulanamaz durumdaydı (tablo DDL'i yoktu) ve ikisi de hiçbir veritabanına uygulanmamıştı. Ayrı tutmak, 0001 dönemine ait kurgusal bir şema uydurmayı gerektirirdi. | `migrations/0001_init` başlığı |
| **Giriş için RLS'siz `oturum_dizini` katalogu** | `kullanici` RLS taşır, giriş tenant'ı bilmeden okumak zorunda. Reddedilenler: BYPASSRLS'li rol (ele geçirilirse izolasyon tümüyle kalkar), SECURITY DEFINER (FORCE RLS sahibi de kapsar), girişte tüm tenant'ları dolaşmak (10 000 tenant = 10 000 sorgu). Senkronu **trigger** tutar. | `migrations/0002_oturum_dizini` |
| **İstek bağlamı interceptor'dan middleware'e alındı** | NestJS sırası middleware → guard → interceptor. Bağlam interceptor'da kurulunca Üç Kapı ona yazamıyordu ve **bütün yazma uçları** 403 dönüyordu. | `common/context/correlation.middleware.ts` |
| **`tenant.setup` Yönetim Şirketi'ne taşındı** | Yeni yerleşke açmak onboarding işlemidir; tek bina yöneten rolde olmamalı. Belgelerde yetki matrisi **yok** — bu bir yorum, farklı isteniyorsa tek yerden değişir. | `shared/core-domain/src/yetki/roller.ts` |
| **`prisma migrate diff` çıktısı elle süzülür** | Diff, şemada karşılığı olmayan elle yazılmış kısmi index'leri düşürmek ister; uygulanırsa mükerrer tahakkuk numarası sessizce mümkün olur. Migration'lar elle yazılıyor. | `migrations/0004` · `0005` · `0006` |
| **Dosya API'den geçmez (önimzalı URL)** | 50 MB'lık bir belgeyi Node üzerinden akıtmak olay döngüsünü tıkar; içerik hiç uygulama belleğine girmez. Bedeli: dosyasız kayıt riski — `HeadObject` ile kapatıldı. | `common/storage/nesne-deposu.service.ts` |
| **Yeni bağımlılıklar: `@aws-sdk/client-s3`, `unplugin-swc`** | S3 imzalama elle yazılamayacak kadar güvenlik-kritik. `unplugin-swc` olmadan sözleşme testleri hiç koşamıyordu (esbuild `emitDecoratorMetadata` desteklemez). | `backend/package.json` |
| **Personel `kisi` tablosuna KONULMADI** | `Kisi` malik/kiracı/sakin ilişkilerinin dayandığı kimlik kaydı; personel bir istihdam kaydı. Aynı tabloda olsaydı bir kapıcının o binada kiracı olması durumunda "işten ayrıldı" işareti kiracılık kaydını da etkilerdi. Kullanıcı "Malik/Kiracı/Sakin'e dokunma" dedi; ayrı tablo bunu garanti eder. | `migrations/0008` |
| **`kisi` API'si KALDIRILMADI, yalnızca menü girdisi kaldırıldı** | `POST /kisiler`, bir malik/kiracı/sakin eklemenin TEK yoludur (hepsi var olan `kisiId` ister). Kaldırılsaydı kullanıcının korunmasını istediği üç modül çalışamaz hale gelirdi. Menüdeki "Kişiler" girdisi zaten var olmayan bir rotayı gösteriyordu; o kaldırıldı. | `uygulama-kabugu.tsx` |
| **Etiket ASCII katlanır, Türkçe katlanmaz** | Etiket bir KİMLİKTİR. `'ACIL'.toLocaleLowerCase('tr')` → `'acıl'` verir (noktasız I'nın küçüğü ı'dır); dilbilgisel olarak doğru ama caps lock ile yazan kullanıcının etiketi "acil" ile eşleşmezdi. Prose aramasında (ad/notlar) Türkçe katlama doğru olandır — ayrım korunmalı. | `shared/apartman-domain/src/belge/belge.ts` |
| **Site Personeli ile Daire Görevlisi AYRI tablolara ayrıldı** | 0009'da ikisi tek tabloda birleştirilmişti; bu hataydı. İşveren farklıdır (yönetim ↔ malik/kiracı), dolayısıyla SGK/vardiya/zimmet yükümlülüğü, KVKK veri sorumlusu ve TC tekillik kapsamı da farklıdır. Tek tabloda tutmak yönetimi, olmadığı bir ilişkide işveren gibi gösterirdi. 0008 uygulanmış olduğu için **düzenlenmedi**, 0010 ile taşındı. | `migrations/0010_site_personeli_ayrimi` |
| **Misafir ve daire görevlisi `Kisi` kaydı AÇMAZ** | İkisi de hak sahibi değildir: borç sorumlusu olmaz, tahakkuka girmez, arsa payı taşımaz. `Kisi`ye yazılsalardı malik/kiracı listelerine karışır ve borç sorumluluğu sorgularında görünürlerdi. Misafirde ayrıca KVKK: verisi kısa ömürlüdür, kalıcı kimlik kaydı yanlış ömre bağlardı. | `migrations/0011` · `misafir.service.ts` |
| **Kefil ayrı `Kisi` DEĞİL, sözleşme üzerinde inline** | Yönetimin ortak gider alacağı malike (KMK md. 20) ve kiracıya (md. 22, kira bedeli kadar müteselsil) yönelir; **kefile yönelmez** — kefalet kira sözleşmesinin tarafıdır, yönetim planının değil. Ayrı kimlik kaydı borç sorumluluğu sorgularında görünürdü. | `migrations/0012_kiraci_kefil` |
| **Tek araç kütüğü + kapsam ayrımı** | Otopark kapasitesi malik aracıyla bakıcının/güvenliğin aracını ayırt etmez; ayrı tablolar sayımı bölerdi. Ama **personel aracı yönetime**, diğerleri **ilgili bölüme** kayıtlıdır: personel aracını daireye yazmak o dairenin otopark hakkını tüketmiş gösterir ve KULLANIM_BAZLI dağıtımda ona fazla pay çıkarır. | `migrations/0011` · `0013_arac_kapsami` |
| **`kisiId` zorunluluğu kalktı; tekilleştirme TC + e-postaya devredildi** | Zorunluluğun asıl işlevi mükerrer kimlik kaydını engellemekti. Kaldırırken bu koruma bırakılsaydı aynı kişi iki `Kisi` satırına bölünür ve borç geçmişi, tahakkuk sorumluluğu, KVKK silme talebi iki kayda dağılırdı. `kisi_eposta_uq` tenant genelinde tekil olduğu için e-posta da kimlik anahtarı sayıldı. | `common/kayit/hizli-kayit.ts` |
| **Portföy, RLS gevşetilerek DEĞİL açık devirle çözüldü** | ADR-0002 kolay yolu (RLS by-pass / `BYPASSRLS` rolü) ismiyle yasaklamış ve çözüm yolunu şimdiden yazmıştı. Devir modeli **yetkilendirme ile izolasyonu ayırır**: firma neye erişeceğini devir kaydından öğrenir, ama her sorgu yine tek tenant bağlamında koşar. Devir kaydı silinse bile RLS ayakta kalır. | [ADR-0009](docs/adr/log/0009-yonetim-sirketi-acik-devir.md) |
| **Devir yetkisi Kapı 2'de doğrulanır, projede `kullanici` kaydı AÇILMAZ** | Firma kullanıcısını her projeye kopyalamak, KVKK silme talebinde kişinin kaç tenant'a yayıldığını takip edilemez kılardı. Bunun yerine jeton `dvr` claim'i taşır ve Kapı 2 aktif devri sorgular. | `common/guards/tenant.guard.ts` |
| **Devir doğrulaması ÖNBELLEKLENMEZ** | Üyelik 5 dk önbelleklenir (değişimi nadir, etkisi sınırlı). Devrin sona ermesi bir YETKİ KALDIRMADIR; 5 dakika boyunca geçerli görünmesi kabul edilemez. | `common/prisma/tenant.reader.ts` |
| **`Tenant.olustur` üç tipi de kabul ediyor; birim testi buna göre GÜNCELLENDİ** | Test "yalnizca APARTMAN kabul edilir" diye assert ediyordu. O kısıt kaynağın kendisinde "v1 kapsamında" diye yazılmış geçici bir kısıttı; ADR-0008 SITE'yi, ADR-0009 YONETIM_SIRKETI'ni kapsama aldı. Testi olduğu gibi bırakmak, kararı koda yansıtmayı imkânsız kılardı. | `tests/unit/domain.smoke.mjs` |

---

## 6. Sonraki oturumda dikkat edilecekler

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
- **Web paketinin birim testi neredeyse yok.** `tests/unit` çoğunlukla
  `shared/*/dist` ve `backend/src/common` derlemesini koşar; `filtre.ts`,
  `csv-oku.ts` ve `lib/kesir.ts` yalnızca tip denetimi ve derleme ile
  korunuyor. **İstisna:** `lib/sekme-hata.ts` React'ten ayrı tutulduğu için
  `tests/unit/sekme-hata.test.mjs` ile test edilir — aynı yol, saf mantığı
  bileşenden çıkararak başka web modülleri için de kullanılabilir.
- **Tarayıcı koşum harness'ı YOK** (playwright/puppeteer/jsdom kurulu değil).
  Etkileşimli davranış (sekme değişimi, form gönderimi) tip denetimi, derleme,
  i18n anahtar denetimi ve saf mantık testleriyle korunuyor; gerçek tıklama
  doğrulanmıyor. Sekmeli formlarda bu sınır özellikle önemli.
- **SEKMELİ FORMDA GİZLİ ALANDA `required` KULLANILMAZ.** Tarayıcı gizli bir
  zorunlu alanı odaklayamaz ve gönderimi *sessizce* durdurur. Yeni bir sekme
  eklerken bu kural tekrar hatırlanmalı.
- **Enum kodları iki yerde aynalı:** `frontend/web/lib/kodlar.ts` ve
  `messages/tr.json`. Domain'e yeni kod eklenirse ikisine de eklenmelidir.
- **SİTE PERSONELİ ≠ DAİRE GÖREVLİSİ.** İşveren farklıdır ve bu, alan listesini
  belirler: SGK · departman · vardiya · zimmet YALNIZCA site personelinde
  bulunur. Yeni bir alan eklerken "bu yükümlülük kimin?" sorusu sorulmalıdır.
  İki ekran birbirine gönderme yapan bir uyarı satırı taşır; kaldırılmamalı.
- **i18n anahtarları toptan arama-değiştirme ile YENİDEN ADLANDIRILAMAZ.**
  0009'da blanket bir `Personel → Görevli` değişimi `yeniPersonel`
  ANAHTARINI `yeniGörevli` yapıp Next.js'i `MISSING_MESSAGE` ile patlatmıştı.
  Bu oturumda `tr.json` **programatik olarak** (JSON düzeyinde) ayrıldı.
- **Kabuk üzerinden node betiği yazarken şablon dizgi kullanmayın.** `bash -c`
  içindeki `\`${...}\`` ve `\"` kaçışları sessizce yeniyor: bu oturumda bir
  Prisma modelinin bütün `@map("...")` tırnakları kayboldu ve şema geçersiz
  hale geldi; başka bir seferde Malik ile Kiracı modellerine yanlış alan
  bloğu yazıldı. Betikler **dosyaya yazılıp** `node dosya.mjs` ile koşulmalı.
- **Git Bash `/api/v1` gibi env değerlerini Windows yoluna çevirir.** Backend'i
  elle başlatırken `MSYS_NO_PATHCONV=1` verilmezse API öneki
  `C:/Program Files/Git/api/v1` olur ve bütün uçlar 404 döner. Ayrıca giriş
  noktası `dist/src/main.js`'tir (`dist/main.js` değil).
- **Backend çalışırken `prisma generate` EPERM verir.** Motor DLL'i
  (`query_engine-windows.dll.node`) kilitlidir. `pnpm -r build` öncesi node
  süreçleri durdurulmalı.
- **PORTFÖY ÖZETİ ÇAPRAZ-TENANT SORGU DEĞİLDİR.** Proje başına ayrı
  `tenantIslemi(projeId)` çağrısıdır. "Tek sorguda toplayalım" fikri
  ADR-0002'nin ismiyle yasakladığı şeydir; hızlandırma yolu da yazılıdır —
  RLS'i delmek değil, event ile bakımı yapılan özet tabloları
  (IMPLEMENTATION-ROADMAP R-4).
- **Kontrol merkezinde karşılığı olmayan gösterge `-1` döner**, sıfır DEĞİL.
  Sıfır basmak "iş emri yok" ile "iş emri modülü yok" ayrımını gizler.
- **Yetki modeli kararı:** `tenant.setup` Apartman Yöneticisi'nden alınıp
  Yönetim Şirketi'ne verildi (yeni yerleşke açmak bir onboarding işlemidir).
  Belgelerde yetki matrisi yok; farklı isteniyorsa tek yerden değişir:
  `shared/core-domain/src/yetki/roller.ts`.

---

*İlgili belgeler:* [`DEVLOG.md`](DEVLOG.md) ·
[`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) ·
[`docs/adr/log/`](docs/adr/log/)
