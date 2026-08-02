# Oturum Özeti — 29-30 Temmuz 2026 (Docker · on bir modül · muhasebe · banka)

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
| `b40ee54` | Beş "Yeni Ekle" formu sekmeli — Kişi Bilgileri + modüle özel sekmeler |
| `<muhasebe>` | **Muhasebe çekirdeği** (0015) — hesap planı · fiş · defterler · mizan · dönem kapanışı + **iki sessiz kusur düzeltildi** |
| `230042d` | **Banka Yönetimi çekirdeği** (0016) — banka · şube · hesap · POS · hareket · virman · ekstre · mutabakat · çek/senet + **veritabanı kısıt ihlalleri artık 500 değil 4xx** |
| `5b56381` | ADR-0010 — cari hesap = **bölüm yardımcı defteri** (karar referans belgeden çözüldü) |
| `85bbca5` | Tahsilat çekirdeği yarım (0017 + domain) — şema ve kurallar |
| `ed68721` | **Makbuzlar** (tahsilat uçları + `/muhasebe` sekmesi) + **Genel Geri Al** (0018) |
| `2094903` | **İletişim çekirdeği** (0019/0020) — WhatsApp · SMS · e-posta TEK modülde |
| `ded0cc3` | **Sakin dayanak kuralı** (0021) — sakin artık malike ya da kiracıya bağlı |
| `cdbe92d` | **Dayanağı biten sakine otomatik çıkış** — malik devri · kiracı tahliyesi + **bozuk kimlik artık 500 değil 404** |
| `90d085b` | **Altyapı ve ölçeklenebilirlik denetimi** — salt okunur, kod değişmedi (§3.F) |
| `e7543f7` | Oturum kapanışı — devredilen iki düzeltme kayda geçti (§3.G) |
| _bu commit_ | **§3.G'deki iki düzeltme UYGULANDI** — konteyner giriş noktası + istek sınırı |

### Bu commit'te yapılan — dayanağı sona eren sakine otomatik çıkış

Ürün sahibi: *"DEVREDİLMİŞ MALİK VE TAHLİYE EDİLMİŞ KİRACIDA SAKİNLERDE
OTOMATİKMEN TAHLİYE EDİLİR"*.

0021 sakini bir malike ya da kiracıya bağladı. Bu commit bağın **sona erme**
yönünü kapatıyor: dayanak biterse (tapu devri · kiracı tahliyesi) o dayanağa
bağlı sakinlerin oturma hakkı da biter.

**Elle yapılması beklenseydi unutulurdu ve hata SESSİZ olurdu.** Kiracı tahliye
edilir, eşi ve çocukları listede "hâlen oturuyor" kalır; daire kartı, acil
durum listesi ve doluluk raporu **aylarca** yanlış çalışır — kayıt geçerli
göründüğü için kimse fark etmez.

- `backend/src/common/kayit/sakin-otomatik-cikis.ts` — **tek yerde** yazılan
  kural; `malik.devret` ve `kiraci.tahliyeEt` ikisi de bunu çağırır. Ayrı ayrı
  yazılsaydı biri düzeltildiğinde öteki eski davranmaya devam ederdi.

#### Zorlanan kritik kurallar

- **AYNI İŞLEM İÇİNDE.** Dayanağın kapanışı ile sakinlerin çıkışı ya birlikte
  olur ya hiç olmaz. Ayrı işlemde yapılsaydı araya düşen bir hata "kiracı
  gitmiş ama ailesi hâlâ oturuyor" durumunu **kalıcı** hâle getirirdi.
- **ÇIKIŞ TARİHİ = DAYANAĞIN BİTİŞİ**, bugün değil. Kiracı 30.06'da tahliye
  edildiyse ailesi de o gün çıkmıştır; "bugün" yazılsaydı aradaki günler
  boyunca oturuyor görünürlerdi.
- **GİRİŞİ, DAYANAĞIN BİTİŞİNDEN SONRA OLAN KAYIT SESSİZCE ATLANMAZ.** Çıkış
  girişten önce yazılsaydı "eksi gün oturmuş" bir kayıt doğardı; bugüne
  çekilseydi kişi dayanağı bittikten sonra da oturmuş görünürdü. İkisi de
  veriyi bozar — kayıt **açık bırakılır** ve gerekçesiyle **kullanıcıya
  bildirilir**; kararı kullanıcı verir.
- **HER SAKİN İÇİN AYRI DENETİM KAYDI + AYRI OUTBOX OLAYI.** Tek toplu satır
  yazılsaydı "benim sakin kaydımı kim, ne zaman kapattı" sorusu kişi bazında
  yanıtlanamazdı. Olay elle çıkışla **aynıdır** (`apartman.sakin.cikti`); fark
  `payload.otomatikMi` ile taşınır, böylece tüketiciler ikisini ayırmak
  zorunda kalmaz.
- **SAYI YANITTA DÖNER VE EKRANDA GÖSTERİLİR** (`sakinCikisi.cikarilan`).
  Dönmeseydi yönetici dört kişiyi listeden düşürdüğünü hiç öğrenmez, daire
  beklenmedik biçimde boş göründüğünde nedenini arayacak yer olmazdı.
- **ÖZET SAYFA SEVİYESİNDE TUTULUR.** İlk denemede eylem bileşenine konmuştu;
  ama devir/tahliyeden sonra kayıt "geçerli değil" olur ve o bileşen `null`
  döner — özet **yazıldığı anda kaybolurdu**. Çıkarılamayan kayıtlar ayrıca
  bildirim balonunda değil **kalıcı panelde** durur: balon beş saniyede
  kaybolur, oysa bunlar kullanıcının elle yapması gereken bir işi anlatır.
- **MOCK DA AYNI KURALI UYGULAR.** `MockSakin` artık `malikId`/`kiraciId`
  taşıyor. Mock hiçbir şey yapmasaydı demo modda kiracı tahliye edilir, ailesi
  "hâlen oturuyor" kalırdı — mock, ürünün **yapmadığı** bir şeyi gösterirdi.
- **Sözleşme bitişi (`duzelt`) tahliye DEĞİLDİR** ve sakinleri kapatmaz:
  sözleşme sessizce yenilenmiş olabilir. Otomatik çıkış yalnızca `devret` ve
  `tahliyeEt` uçlarına bağlıdır.

#### Yan bulgu — bozuk kimlik BÜTÜN uygulamada 500 dönüyordu

Canlı test yazarken çıktı: `/kiracilar/undefined/tahliye` gibi bir yol Prisma
`P2023` ("Inconsistent column data: Error creating UUID") atıyor ve bu kod
`prisma-hata-cevirisi.ts` içinde **eşlenmemişti** → 500 "sistem bozuldu".

Adres çubuğundaki kimliği kırpılmış her bağlantı, eksik değişken taşıyan her
istemci çağrısı bu koda düşer. Artık **404** dönüyor: sunucu sağlamdır,
*aranan kayıt yoktur*. 400 değil 404 — kimliğin biçimi hakkında bilgi vermek,
var olan bir kimliğin biçimini de doğrulamak olurdu.

#### Doğrulama

- Birim: `tests/unit/sakin-otomatik-cikis.test.mjs` (**19**) + P2023 testi →
  toplam **317** birim testi.
- Canlı (gerçek veritabanı): **23/23** — iki sakinin tahliyeyle kapanması,
  malik yakınının **etkilenmemesi**, ileri tarihli kaydın **açık kalıp
  raporlanması**, devirde kapanma, mükerrer tahliyenin reddi, bozuk kimlikte
  404. Sakin dayanak testi de yeniden koşuldu: **11/11**.
- `pnpm verify` 9/9 · lint temiz · sözleşme testleri 24/24.

### Bu commit'te yapılan — Sakin kayıt kuralı

**SAKİN ARTIK BİR MALİKE YA DA KİRACIYA BAĞLANMAK ZORUNDA.**

Bugüne kadar `sakin` yalnızca bölüme ve kişiye bağlıydı; **"bu kişi burada
KİMİN YAKINI olarak oturuyor" sorusunun cevabı yoktu.** Sonuçları: kiracı
taşındığında ailesinin akıbeti belirsizdi, acil durumda "bu çocuğun velisi
kim" yanıtsızdı, sakin ile sorumlu arasındaki bağ kurulamıyordu.

- **0021** — `sakin.malik_id` · `sakin.kiraci_id` · `sakin.yakinlik_aciklamasi`
  + `YakinlikDerecesi` enum'una `ANNE` ve `BABA`.
- Form: **Malik / Kiracı seçimi** (dairenin kendi malik-kiracılarından) →
  **Yakınlık Derecesi** → `Diğer` seçilirse **serbest metin alanı açılır**.

#### Zorlanan kritik kurallar

- **DAYANAK TAM OLARAK BİR TANE.** İkisi birden verilirse hangisinin geçerli
  olduğu belirsiz; hiçbiri verilmezse kayıt "havada" kalır ve kuralın kendisi
  anlamsızlaşır. (CHECK `sakin_dayanak_tek` + servis denetimi.)
- **DAYANAK AYNI BÖLÜMDE OLMAK ZORUNDA — ve bunu VERİTABANI garanti ediyor.**
  `(malik_id, bolum_id)` çifti `malik(id, bolum_id)`ye **bileşik yabancı
  anahtarla** bağlandı. Yalnızca serviste denetlenseydi, doğrudan veritabanına
  yazan bir betik ya da ileride yazılacak toplu aktarım kuralı sessizce
  atlardı. Servis ayrıca **açık hata mesajı** için denetler; yoksa kullanıcı
  anlaşılmaz bir FK hatası görürdü.
- **DEVREDİLMİŞ MALİKE / TAHLİYE OLMUŞ KİRACIYA yeni sakin bağlanamaz** — o
  hane artık onun değildir.
- **`DIGER` seçilirse serbest metin ZORUNLU**; başka dereceye geçilirse
  **boşaltılır**. Boşaltılmasaydı "Diğer — Amcası" kaydı "Eşi"ne çevrildiğinde
  ekranda "Eşi (Amcası)" gibi çelişkili bir bilgi kalırdı.
- **Liste dayanağı GÖSTERİR** (`dayanakTipi` · `dayanakKisiAdi`): "Ayşe Yılmaz
  · Eşi" satırı, kimin eşi olduğu yazılmazsa dört daireli bir katta hiçbir şey
  anlatmaz.
- **`ANNE_BABA` KALDIRILMADI.** Enum değeri silmek, o değeri taşıyan satırlar
  varsa imkânsızdır ve geçmiş kayıtların anlamı değişmemelidir. Yeni kayıtlarda
  `ANNE`/`BABA` kullanılır — acil durumda "annesini arayın" ile "babasını
  arayın" farklı bilgilerdir. Aynı şekilde `AKRABA` · `MISAFIR` · `CALISAN`
  DTO'da kabul edilmeye devam eder (eski kayıtlar düzeltilebilsin diye) ama
  formda **teklif edilmez**.
- **`KENDISI` FORMDAN ÇIKARILDI.** İlk uygulamada listeye eklenmişti; ürün
  sahibi talebi aynen yineleyince karar olarak alındı. Form artık **tam olarak
  istenen altı seçeneği** gösterir: Eşi · Çocuğu · Annesi · Babası · Kardeşi ·
  Diğer. Model: sakin, dayanağının **yakınıdır**; malikin/kiracının kendisi
  zaten kendi kaydıyla durur. `KENDISI` enum'da ve DTO'da kalır — eski
  kayıtların düzeltilebilmesi için.
- **VARSAYILAN YAKINLIK YOK** — kullanıcı açıkça seçer. "Eşi" gibi bir
  varsayılan konsaydı, alanı atlayan kullanıcı çocuğunu eşi olarak kaydeder ve
  hata hiçbir yerde görünmezdi; acil durumda yanlış kişiye ulaşılırdı.

#### Geriye dönük doldurma

Migration mevcut sakinleri sırayla bağlar: (a) kişinin kendisi malik/kiracıysa
ona, (b) bölümün açık kiracısına, (c) açık malikine. (b) ve (c) **tahmindir**
ve doldurulan kayıtlar `yakinlik_aciklamasi` alanına **iz bırakır** — iz
olmasaydı sonradan bakan biri bu bağın kullanıcı tarafından mı göç tarafından
mı kurulduğunu ayırt edemezdi.

`CHECK sakin_dayanak_tek` doldurma başarısız kalırsa migration'ı **durdurur**.
Bilinçlidir: dayanaksız bir kaydı sessizce bırakmak, kuralı "yeni kayıtlar
için" geçerli kılıp eski veriyi görünmez bir istisna hâline getirirdi.
(Bu veritabanında 0 sakin kaydı vardı; doldurma yolu canlıda sınanmadı.)

#### Migration'da çıkan kusur

**FK doğrulama taraması KAYNAK tabloyu da okur.** İlk yazımda yalnızca hedefler
(`malik`, `kiraci`) RLS'ten muaf tutulmuştu; migration tam FK ekleme adımında
durdu: *"Tenant baglami kurulmadan sorgu calistirilamaz"*. Tarama SELECT'i
`FROM ONLY sakin fk LEFT JOIN malik pk` biçimindedir — kaynak taraf RLS
altındaysa tarama da engellenir. (0011'de belgelenmiş tuzağın tekrarı.)

#### Düzeltme formundaki gösterim eksiği KAPATILDI

`secenekler()` mevcut değeri listeye **başa ekler**: eski değerli bir kayıt
(`KENDISI` · `ANNE_BABA` · `AKRABA` …) düzenlenirken liste artık boş
görünmüyor. Boş görünseydi kullanıcı değerin kaybolduğunu sanır ve rastgele
bir seçim yaparak gerçek veriyi bozardı. Düzeltme formuna ayrıca **"Diğer" →
serbest metin** alanı eklendi (ekleme formuyla aynı kural).

### Bu commit'te yapılan — İletişim (WhatsApp Business · SMS)

**WHATSAPP ve SMS AYRI MODÜL DEĞİLDİR.** İkisi de "bir mesajı, bir alıcıya,
bir kanaldan gönder"dir. Ortak olanlar: alıcı çözümü (site · blok · kat ·
daire · malik · kiracı · sakin · daire görevlisi · YK · kişiler), şablonlar ve
değişkenler, toplu/zamanlanmış gönderim, geçmiş, durum takibi, İYS izin
denetimi, audit. Ayrı yazılsaydı bu iskelet **iki kez** dururdu ve biri
düzeltildiğinde öteki sessizce eski davranırdı. **Kanal bir ALANDIR.**
E-posta ileride aynı çekirdeğe yeni enum değeriyle girer.

Ekran: `/iletisim` → **WhatsApp · SMS · E-posta** sekmeleri (kullanıcının
isteği: *"whatsapp, sms, e-posta gibi sekmeleri iletişim sekmesinde topla"*).

- **0019** — `mesaj_sablonu` · `iletisim_izni` · `mesaj_gonderimi` · `mesaj` ·
  `otomatik_bildirim_kurali` + `kisi.whatsapp_no`. Hepsinde RLS + politika.
- **0020** — `daire_gorevlisi.whatsapp_no`. **Daire görevlisi bir `Kisi`
  değildir** (0010); kendi telefonunu taşır, dolayısıyla kendi WhatsApp
  numarasını da taşımalıydı.
- **domain** `shared/apartman-domain/src/iletisim` — 33 birim testi.
- **backend** `modules/iletisim` — CQRS + **sağlayıcı portu**.
- **RBAC** — dört yeni izin (aşağıda).

#### Zorlanan kritik kurallar

- **HİÇBİR MESAJ GERÇEKTEN GÖNDERİLMEZ** ve hiçbiri "teslim edildi"
  sayılmaz. Sağlayıcı yokken durum `SAGLAYICI_YOK`ta kalır. Sahte bir başarı,
  yöneticinin 400 daireyi bilgilendirdiğini sanmasına yol açardı — ve bu
  ancak icra takibi aşamasında anlaşılırdı.
- **`SAGLAYICI_YOK` ve `IZIN_YOK`, `BASARISIZ` DEĞİLDİR.** Biri yapılandırma
  eksiği, öteki hukuki engel; üçü tek durumda toplansaydı "hata oranı"
  hiçbir şey anlatmazdı.
- **İYS: ÜÇ DURUM VARDIR, İKİ DEĞİL.** RET → o kanalda bilgilendirme dahil
  hiçbir şey; izin kaydı yok → bilgilendirme gider, ticari gitmez; İZİN →
  ikisi de. Tek bayrağa indirgenseydi ya aidat borcu haber verilemez ya da
  ticari ileti izinsiz giderdi (6563 s. K. md. 6 — idari para cezası).
- **SMS KONTÖRÜ GSM-7/UCS-2 ayrımıyla hesaplanır.** Tek bir `ğ` mesajı
  UCS-2'ye düşürür ve parça sınırı 160'tan 70'e iner. Hata **sessizdir**:
  mesaj yine gider, yalnızca fatura iki katına çıkar. (`ç ö ü` GSM-7'de
  vardır; hepsi UCS-2 sanılsaydı kontör boşuna fazla hesaplanırdı.)
- **ÇÖZÜLMEYEN ŞABLON DEĞİŞKENİ GÖNDERİMİ ENGELLER.** Ham `{{ad}}` metninin
  ya da `"Sayın , TL borcunuz var"` cümlesinin gitmesi güveni tek seferde
  bitirir. Ama tek alıcının eksik verisi **bütün partiyi düşürmez**: o mesaj
  `BASARISIZ` kaydedilir, ötekiler devam eder.
- **İZİNSİZ/NUMARASIZ ALICI ATLANMAZ, KAYDEDİLİR.** Atlansaydı "500 kişiye
  gönderdim" denir ama 80'ine gitmediği hiçbir yerde görünmezdi.
- **AYNI KİŞİ TEKİLLEŞTİRİLİR** — hem malik hem sakin olan kişi duyuruyu iki
  kez almaz (ve iki kontör düşmez).
- **AYRILMIŞ KİRACIYA/ESKİ MALİKE MESAJ GİTMEZ**: alıcı çözümü *hâlen süren*
  ilişkiye bakar (`tapuBitis` · `bitis` · `cikisTarihi`).
- **GRUP hedefi AÇIK HATA verir** — sistemde grup kavramı yok; boş liste
  dönmek sessiz başarısızlık olurdu.
- Numara **E.164'e normallenir** ve **sabit hat reddedilir**: normalleştirme
  olmasaydı aynı kişi üç kez kaydedilir ve aynı duyuruyu üç kez alırdı.

#### Yeni izinler (yetki matrisi genişletildi)

Bu talep RBAC gerektiriyordu ve iletişim izinleri **hiç yoktu**. Dört ayrı
izin eklendi — tek `iletisim.manage` değil, çünkü bunlar farklı büyüklükte
risklerdir:

| İzin | Neden ayrı |
|---|---|
| `ILETI_GONDER` | Tekil mesaj bir kişiye gider; yanlışsa düzeltilir |
| `ILETI_TOPLU_GONDER` | 400 daireye aynı anda gider ve **geri alınamaz** |
| `ILETI_BELGE_PAYLAS` | Gizlilik seviyesi olan dosyayı dışarı çıkarır (KVKK) |
| `ILETI_AYAR` | Şablon/kural değişikliği bütün gelecek gönderimleri etkiler |

Dağıtım: `APARTMAN_YONETICISI` ve `YONETIM_SIRKETI` dördüne de sahip.
`YK_BASKANI` **yalnızca `ILETI_GONDER`** — yönetim kurulu denetim organıdır,
işletme değil; 400 daireye giden ve geri alınamayan bir mesaj işletme
kararıdır.

#### Canlı testte çıkan iki kusur

1. **`tx.malik.findMany()` çalışma zamanında patladı** — `Malik`, `Kiraci`,
   `Sakin` **soft delete taşımaz**; bunlar ilişki kayıtlarıdır. Asıl mesele
   tip hatası değil **anlam**: alan doğru kabul edilseydi bile taşınmış
   kiracıya duyuru gitmeye devam ederdi.
2. **Dört alıcının dördü de numarasızken hiç uyarı üretilmedi.** Yanıt
   "oluşturuldu" dedi, `numarasiz: 4` sayısı vardı ama kimse okumak zorunda
   değildi. **Sayı ile uyarı aynı şey değildir**: sayı veridir, uyarı
   iddiadır. Artık "hiçbir alıcıya mesaj gitmedi" açıkça yazılıyor.

#### Karşılanmayanlar — açıkça eksik

| İstenen | Neden |
|---|---|
| **Gerçek WhatsApp/SMS gönderimi** | Kullanıcının kararı: *"gerçek API bağlantıları sonraki fazda"*. Port hazır; adaptör eklenince servis kodu değişmez |
| **Belge paylaşımı (PDF/Excel/Word/resim)** | İzin (`ILETI_BELGE_PAYLAS`) ve `BelgeVarlikTipi += MESAJ_GONDERIMI` hazır; **ekleme akışı yazılmadı**. Dosya altyapısı Belge modülünde zaten var |
| **Otomatik bildirimler (14 olay)** | Kural tablosu var ve kayıt alınabiliyor ama **outbox tüketicisi yok**: `aktif = true` olsa bile hiçbir şey kendiliğinden gitmez. Bu ekranda ve API açıklamasında yazılı |
| **Zamanlanmış gönderim** | Kayıt oluşur, **planlayıcı yok**; yanıtta uyarı olarak döner |
| **Kişi kartlarına alan eklenmesi** | API hazır (`GET /iletisim/kisiler/:id`); Malik/Kiracı/Sakin **form ekranlarına** alan eklenmedi |
| **Şablon/izin/kural yönetim ekranları** | API tam; ekran yalnızca şablon **seçimi** sunuyor |
| **Grafikler** | Rapor uçları seri döndürüyor (`gunlukSeri`, `durumDagilimi`); grafik bileşeni çizilmedi |
| **Dışa aktarma (Excel/PDF)** | FAZ 4 — kütüphane kararı bekliyor |

### Bu commit'te yapılan — Makbuzlar + Genel Geri Al

**Makbuzlar, `85bbca5`'te yarım kalan tahsilat modülünü tamamlar.** Makbuz
AYRI BİR VARLIK DEĞİLDİR: `tahsilat` kaydının belge görünümüdür. Ayrı bir
`makbuz` tablosu açılsaydı aynı para iki yerde durur ve biri güncellenmediğinde
makbuz ile defter tutmazdı.

Eklenen uçlar (`/makbuzlar`):

- `GET /` **Makbuz Geçmişi** — iptal edilmişler de listede (durum rozetiyle);
  gizlenselerdi numara serisindeki boşluk açıklanamaz görünürdü.
- `GET /:id` **Tahsilat Makbuzu detayı** — istenen alanların tamamı.
  **Malik · Kiracı · Sakin ÖDEYENDEN DEĞİL** borcun sorumluluk zincirinden
  gelir: ödeyen komşusu olabilir.
- `GET /borclar/:bolumId` **Detaylı Tahsilat Girişi** — açık borçlar; hisseli
  mülkiyette PAY satırları ayrı.
- `POST /tahsis-onerisi` — EN ESKİ VADE önce, **hiçbir şey yazmaz**.
- `POST /` tahsilat · `POST /:id/iptal` **Makbuz İptali** · `POST
  /:id/muhasebelestir`
- `GET /cari/:bolumId` **Cari Hesap Ekstresi** (ADR-0010) · `GET
  /rapor/yaslandirma` · `GET /rapor/kontrol-mutabakati`

Ekran: `/muhasebe` → **Makbuzlar** sekmesi (altıncı sekme). Ayrı rota değil —
makbuz listesi fiş listesiyle aynı süzgeç/tablo iskeletini kullanır.

#### GENEL GERİ AL (0018)

**Yeni bir "ne değişti" günlüğü AÇILMADI.** `audit_kaydi` zaten
`oncekiDeger`/`sonrakiDeger` tutuyor; ikinci bir günlük yazılsaydı iki kaynak
zamanla ayrışır ve geri alma **yanlış değere** dönerdi. `geri_alma` tablosu
yalnızca "hangi denetim kaydı, hangi yöntemle geri alındı" olgusunu taşır —
işaret audit satırına yazılamaz çünkü audit UPDATE'i trigger ile reddedilir.

Yöntemler varlığın **silme sınıfına** göre: FİNANSAL → `TERS_KAYIT` (kayıt
silinmez), BELGE → `ARSIVLE`/`GERI_YUKLE` (dosya silinmez, sürüm korunur),
ANA_VERİ → `ARSIVLE`/`GERI_YUKLE`/`ALAN_GERI_AL`.

Reddedilen durumlar **gerekçesiyle** bildirilir: başkasının işlemi · zaten geri
alınmış · sonradan tekrar değiştirilmiş · anonimleştirme (KVKK) ·
muhasebeleşmiş finansal kayıt · kapalı dönem · **kuralı tanımlı olmayan
varlık** ("muhtemelen ana veridir" varsayımıyla devam edilseydi finansal bir
kayıt silinebilirdi). 25 birim testi.

#### Canlı testte çıkan iki kusur

1. **Geri alma uçları `AUDIT_GORUNTULE` iznine bağlanmıştı → 403.** O izin
   yalnızca DENETÇİ rolünde; yani kaydı **giren kullanıcı kendi işlemini geri
   alamıyordu** — özelliğin bütün amacı buyken. Doğru sınır **sahipliktir**:
   geri alma, kullanıcının zaten yapmaya yetkili olduğu bir işlemi geri çevirir
   ve servis kayıt sahipliğini doğrular. Modül izni kaldırıldı (Kapı 1 ve 2
   çalışmaya devam eder), **yetki matrisi değiştirilmedi, yeni izin
   tanımlanmadı**.
2. **`dist` bayat kaldığı için ilk düzeltme görünmedi.** Backend çalışırken
   yapılan derleme dosyaları yazamamış; süreç kapatılıp `dist` silinerek
   yeniden derlendi. (Bilinen tuzak: çalışan backend derleme çıktısını kilitler.)

### Bu commit'te yapılan — Banka Yönetimi çekirdeği (FAZ 1)

Kullanıcının istediği **17 alt modül dokuz tabloya indirildi.** Bu bir
eksiltme değil, "gereksiz tekrar eden ekran oluşturma" kuralının veri
katmanındaki karşılığıdır:

| İstenen | Karşılığı |
|---|---|
| Bankalar · Şubeler · Hesaplar | `banka` · `banka_subesi` · `banka_hesabi` |
| POS Tanımları · Sanal POS | `pos_tanimi` (`tip`) |
| Havale · EFT · FAST · Virman · Masraf · Faiz | `banka_hareketi` (`islem_tipi`) |
| Ekstreler · Online Ekstre · Mutabakat | `banka_ekstresi` + `ekstre_satiri` |
| Çek · Senet | `kiymetli_evrak` (`tip`) |
| Banka Parametreleri | `banka_parametresi` |

**⚠️ HAVALE ve EFT AYRI TABLO DEĞİLDİR.** İkisi de "bir banka hesabından para
çıkışı"dır ve alan kümeleri birebir aynıdır. Ayrı tutulsaydı banka bakiyesi
dört ayrı sorgunun toplamı olur, biri unutulduğunda **bakiye sessizce yanlış
çıkardı** ve mutabakat dört tabloyu ayrı ayrı taramak zorunda kalırdı.

Katmanlar:

- **0016** — dokuz tablo, hepsinde RLS + FORCE + politika; 6 kısmî unique
  index, 14 CHECK kısıtı. `BelgeVarlikTipi` += `BANKA_HAREKETI` ·
  `BANKA_EKSTRESI` · `KIYMETLI_EVRAK` (belge modülü yeniden kullanıldı).
- **domain** — `shared/apartman-domain/src/banka`: IBAN mod-97, hareket/virman
  kuralları, POS komisyonu (binde BigInt), mutabakat eşleştirme, çek/senet
  durum makinesi. **38 birim testi.**
- **backend** — `modules/banka`, CQRS ayrımı korundu: `BankaTanimServisi` ·
  `BankaHareketCommandServisi` · `EkstreServisi` · `KiymetliEvrakServisi` ·
  `BankaParametreServisi` (yazma), `BankaHareketQueryServisi` (okuma).
  **Yeni izin tanımlanmadı.**
- **ekran YOK** — kullanıcının talimatı: *"Do not generate the remaining
  screens yet."* FAZ 1 yalnızca temeldir.

Zorlanan kritik kurallar (canlı test **91/91**, iki kez üst üste):

- **IBAN mod-97 ile doğrulanır.** Uzunluk denetimi yetmez: tek hane yanlış
  girilmiş bir IBAN biçimsel olarak kusursuz görünür ve hata ancak **para
  başka hesaba gittiğinde** anlaşılır. IBAN'ın banka kodu seçilen bankanın EFT
  kodu ile tutmazsa hesap eklenemez.
- **Banka hesabı muhasebe hesabına bağlanmak ZORUNDA** ve bağlanan hesabın
  `ozellik = BANKA` olmalı. Bağ olmasaydı banka bakiyesi ile 102 Bankalar
  hesabının bakiyesi bağımsız iki sayı olur, **mutabakat yapılamazdı**.
- **Tutar işaretsiz, yön ayrı alan.** Negatif tutarla çıkış yazılabilseydi
  "toplam giriş" sorgusu negatifleri de toplardı.
- **VİRMAN tek hareket olarak yazılamaz** — iki bacak, aynı transaction,
  karşılıklı referans. Farklı para birimi virman değildir (kur işlemi).
- **İŞLEM ve VALÖR bakiyesi AYRI raporlanır.** Tek sayı verilseydi POS
  tahsilatı henüz hesaba geçmemişken bakiyede görünür, harcanabilir sanılır ve
  karşılıksız ödeme yapılırdı. `yoldaTutar` farkı gösterir.
- **Muhasebeleştirme ayrı adım ve TEK TRANSACTION.** Fiş üretimi
  `FisCommandServisi.ekleIslemde` ile **kopyalanmadan** çağrılır. İki ayrı
  işlem olsaydı fiş yazılıp hareket işaretlenmeden hata alınabilir, hareket
  "muhasebeleşmemiş" görünmeye devam eder ve **aynı para iki kez** deftere
  girerdi.
- **Muhasebeleşmiş ya da eşleşmiş hareket değiştirilemez.**
- **Otomatik eşleştirme BELİRSİZLİKTE DURUR.** İki aday uyuyorsa hiçbiri
  seçilmez; `kalanEslesmeyen` yanıtta döner ve gizlenmez. Makine tahmin
  ederse yanlış eşleşme mutabakatı **sessizce tamamlanmış** gösterir.
- **`mutabikMi` İKİ koşul ister**: eşleşmemiş satır kalmaması **ve** bakiye
  farkının sıfır olması. Yalnızca satır sayısına bakılsaydı, ekstrede hiç
  görünmeyen bir sistem hareketi mutabakatı tamamlanmış gösterirdi.
- **FARK_KABUL gerekçe ister** ve özette **ayrı** sayılır.
- **Çek/senet durum makinesi atlama kabul etmez.** `PORTFOYDE →
  TAHSIL_EDILDI` yasaktır: bankaya verilmemiş bir çek tahsil edilmiş olamaz ve
  "tahsilde bekleyenler" listesi bir daha doğru olmazdı. `KARSILIKSIZ →
  TAHSILDE` (yeniden ibraz) açıktır.
- Para her yerde `Decimal`/`Money`; hiçbir yerde `Number`.

#### Bu commit'te bulunan sessiz kusur — kısıt ihlalleri 500 dönüyordu

`POST /banka/bankalar` aynı EFT kodu ile ikinci kez çağrıldığında **500
"beklenmeyen bir sorun oluştu"** döndü. Kök neden banka modülünde değildi:
**Prisma/PostgreSQL kısıt ihlalleri istisna filtresinde hiç eşlenmemişti.**

Yani şemadaki **bütün** korumalar — 20'den fazla kısmî unique index, 30'dan
fazla CHECK kısıtı, yabancı anahtarlar — kullanıcıya "sistem bozuldu" gibi
görünüyordu. `kisi_eposta_uq` için önceki bir oturumda **tek modüle özel** ön
kontrol yazılmıştı; bu sınıfı çözmez ve **yarış durumuna** açıktır (kontrol ile
yazma arasına başka istek girebilir).

Çözüm merkezî: `backend/src/common/errors/prisma-hata-cevirisi.ts`

- `P2002` → **409**, `P2003` → 422, `P2025` → 404, `P2000` → 422
- **CHECK kısıtları Prisma'da tipli hata değildir** (ham PostgreSQL mesajı
  `PrismaClientUnknownRequestError` içinde gelir) — metinden de yakalanır.
  Yalnızca tipli hatalar çevrilseydi bütün CHECK korumaları 500 dönmeye devam
  ederdi.
- **Kısmî unique index'te Prisma alan adı VERMEZ** (`meta.target` =
  `"(not available)"`). O metin alan adı değildir ve **gösterilmez** — var
  olmayan bir alan uydurulmaz. Kısıt adı ham PostgreSQL mesajından okunur.
- Çevrilemeyen hata `null` döner ve 500'e düşer: **bilinmeyen hata için 4xx
  uydurulmaz.**
- Kısıt adı → kullanıcı diline çeviri tablosu **veri olarak** tutulur (§33
  kural 3). 12 birim testi.

#### İkinci kalıcı koruma — RLS politika kapsamı taraması

`scripts/rls-scan.mjs` **uygulama** tarafını denetliyordu (sorgu bağlam içinden
mi çalışıyor). **Veritabanı** tarafını kimse denetlemiyordu: yeni bir tabloya
`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` yazmayı unutmak derleme hatası
vermez, lint geçer, testleri kırmaz ve uygulama taramasına da yakalanmaz —
sonuç **tenant izolasyonunun sessizce kalkmasıdır.**

`scripts/rls-politika-scan.mjs` migration SQL'lerini okur ve `verify`
zincirine eklendi (artık 9 adım). 0001'in **dinamik** politika döngüsü
(`tenant_id` sütunu olan her tabloyu tarar) modellendi; o döngü yalnızca **o
anda var olan** tabloları kapsar, sonradan eklenen tablo kendi migration'ında
açıkça politika almak zorundadır. Muafiyetler (`tenant` · `oturum_dizini`)
**gerekçesiyle** listede. Canlı veritabanına karşı da doğrulandı: 45 tablo,
9/9 banka tablosu RLS + FORCE + politika, `bnos_app` ve `bnos_migrator`
`NOBYPASSRLS`.

Öncesinde (aynı gün, Docker'dan bağımsız): `8bca955` · `66bd2a5` ·
`b4759d3` · `ec76035` · `89a56df` · `666c918`.

### Bu commit'te yapılan — muhasebe çekirdeği

**BULGU: muhasebe ŞEMASI vardı ama HİÇ UCU VE EKRANI YOKTU.** `hesap`,
`yevmiye_fisi` ve `yevmiye_satiri` 0001'de kurulmuştu ve yalnızca tahakkuk
modülü dolduruyordu; okuma, yazma, defter, mizan, dönem — hiçbiri yoktu.

Eklenenler (0015 + `modules/muhasebe` + `/muhasebe` ekranı):

| Bölüm | Durum |
|---|---|
| Hesap Planı | ✅ ağaç · kod/tip tutarlılığı · ara hesap koruması · arşivleme |
| Muhasebe Fişleri + detay | ✅ çift kayıt denkliği · TASLAK/İŞLENDİ · **storno** |
| Yevmiye Defteri | ✅ tarih sırası · yevmiye sıra no |
| Büyük Defter (Muavin) | ✅ açılış devri · yürüyen bakiye · doğal yön |
| Kasa Defteri | ✅ (aynı uç `ozellik=BANKA` ile Banka Defteri) |
| Mizan | ✅ denklik denetimi yanıtta döner |
| Muhasebe Parametreleri | ✅ varsayılan kasa/banka/dönem kârı · geriye dönük pencere |
| Dönem Sonu Kapanış | ✅ hepsi (aşağıda) |

**Dönem Sonu Kapanış — altı işlem:**

- **Yeni Dönem Açılışı** — aynı mali yıl iki kez açılamaz, tarih aralığı çakışamaz
- **Muhasebe Açılış İşlemleri** — önceki dönemin **bilanço** bakiyelerini devreder
  (gelir/gider DEVRETMEZ: geçmiş yılın kârı yeni yılın gelir tablosunda ikinci
  kez görünürdü)
- **Yansıtma Hesapları** — `ozellik=YANSITMA` hesaplarını karşı yöne yazar
- **Yevmiye Yeniden Numaralandırma** — `fisNo` **DEĞİŞTİRİLMEZ**, yalnızca
  `yevmiyeSiraNo` yazılır (makbuz üzerindeki numara ile defter tutmalı)
- **Muhasebe/Mali Yıl Kapanışı** — gelir/gider sıfırlanır, net sonuç özkaynağa
  aktarılır; **GERİ ALINAMAZ** ve önkoşullar öncesinde denetlenir

**Zorlanan kritik kurallar** (canlı test 51/51):

- Fiş **silinemez** — düzeltme yalnızca ters kayıt (storno); yön ters çevrilir,
  **negatif tutar yazılmaz** (eksi tutar mizan toplamlarını bozar)
- **Kapalı döneme fiş yazılamaz** — düzeltme açık dönemde storno ile
- En az iki satır · borç = alacak · satırda tek yön · ara hesaba fiş yok ·
  aynı hesap aynı yönde iki kez yok
- **Taslak fiş mizanda görünmez** (parametre açabilir)
- Kasa/Banka Defteri hesap **koduna değil** `hesap.ozellik` alanına dayanır
  (kod planı tenant'a göre değişir)
- Para her yerde **Decimal/Money**, hiçbir yerde `Number`

#### 🔴 İki sessiz kusur bulundu ve düzeltildi

**1. `silmeyiDogrula` engelleyen bağımlılıkları HİÇ OKUMUYORDU.** Alan
arayüzde tanımlıydı, **dört modül** dolduruyordu (`Belge`, `DaireGorevlisi`,
`Misafir`, `Hesap`) ama fonksiyon bakmıyordu. Sonuç: "açık araç kaydı varken
misafir/görevli arşivlenemez" ve "hareket görmüş hesap arşivlenemez"
korumaları **etkisizdi** — hesap arşivlenip ona yazılmış yevmiye satırları
sahipsiz kalabiliyordu.

> Arayüzde duran ama okunmayan bir alan, çağıranı korunduğuna inandırdığı için
> yokluğundan daha tehlikelidir. Dört test eklendi.

**2. `SilmePolitikaHatasi` istisna filtresinde eşlenmemişti** → 422 yerine
**500**. İki kusur birbirini gizliyordu: okunmayan alan yüzünden bu hata hiç
fırlatılmadığı için eşleme eksikliği hiç görünmemişti.

### Önceki commit'te yapılan — beş form sekmeli hâle geldi

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
  çağrıyı yakalar (**uygulama** tarafı). `pnpm verify` zincirinde.
- `scripts/rls-politika-scan.mjs` — migration'da oluşturulan her tablonun RLS
  politikası alıp almadığını denetler (**veritabanı** tarafı). Politikasız bir
  tablo derlenir, lint geçer, testler yeşil kalır ve tenant izolasyonu
  **sessizce** kalkar; bu iki tarama ayrı sessiz kusur sınıfıdır.
- `common/errors/prisma-hata-cevirisi.ts` — veritabanı kısıt ihlalleri (unique ·
  CHECK · FK) artık 500 değil **409/422/404** döner. Çevrilemeyen hata `null`
  döner ve 500'e düşer; bilinmeyen hata için 4xx **uydurulmaz**.
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

**Doğrulama:** 9/9 build · ESLint 0 · tip denetimi temiz · verify **9/9** ·
birim testleri **298/298** · sözleşme testleri **24/24** · lint:md 0 ·
migration **21/21 uygulandı** · 18 web rotası · hızlı kayıt canlı testi
**40/40** · portföy canlı testi **19/19** · muhasebe canlı testi **51/51** ·
**banka canlı testi 91/91** · makbuz+geri al **13/13** · iletişim **18/18** · sakin dayanak **11/11**.

> ⚠️ **Makbuz canlı testi 13/13.** `tahsilat` uçları artık çalışıyor; kalan
> eksikler ("Makbuzlar talebinden karşılanmayanlar") ve FAZ 2'nin geri kalanı
> aşağıda başlıklar hâlinde yazılı.

> ⚠️ **MUHASEBE YAZMA YETKİSİ YALNIZCA `YONETIM_SIRKETI` ROLÜNDE.**
> `FINANS_YEVMIYE_GIRIS` ve `FINANS_DONEM_KAPAT` izinleri
> `APARTMAN_YONETICISI`de **yok**; o rol yalnızca defter görüntüleyip ayar
> yapabiliyor. KMK md. 35/d–36 uyarınca işletme defterini tutan ve genel kurula
> hesap veren taraf yöneticidir, dolayısıyla bu dağıtım büyük olasılıkla
> yanlıştır — ama **yetki matrisini izinsiz değiştirmedim**. Karar kullanıcıya
> ait; değişecekse tek yerden: `shared/core-domain/src/yetki/roller.ts`.

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
| **Muhasebe** | ✅ API + UI (`/muhasebe`, 5 sekme) + migration 0015. Hesap planı · fiş · storno · yevmiye/muavin/kasa defteri · mizan · dönem kapanışı (6 işlem) · parametreler |
| **Banka** | ✅ API + migration 0016, **EKRAN YOK** (kullanıcı talimatı). Banka · şube · hesap (IBAN mod-97) · POS/sanal POS · hareket · virman · muhasebeleştirme · ekstre · mutabakat · çek/senet · parametreler |

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

Backend'de on bir modül tamam ama **beşinin ekranı yok** (Tahakkuk · Sayaç ·
Belge · Araç · **Banka**). Kullanıcı bunları yalnızca Swagger'dan görebiliyor.

> **Banka ekranı bilinçli olarak yazılmadı**, eksik kalmadı: kullanıcının
> talimatı *"Do not generate the remaining screens yet"* idi. Ekran üretimi
> FAZ 5'te, bağımlılık sırasına göre toplu yapılacak. Banka için gereken
> sekmeler: Hesaplar · Hareketler · Ekstre/Mutabakat · Çek-Senet · POS ·
> Parametreler — **tek rota, çok sekme** (muhasebe ekranındaki desen).

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

   ⚠️ **BU DÜZELTME "TEK SATIR" DEĞİLDİR — ikinci bir tuzak var.**
   `SOFT_DELETE_HARICI` elle tutulan bir listedir ve **eksiktir**. Uzantı
   bağlanır bağlanmaz, `silinmeTarihi` sütunu olmayan **15 modelin** bütün
   okuma uçları `PrismaClientValidationError` verir (uzantı `where`'a
   `silinmeTarihi: null` ekler): `YevmiyeFisi` · `YevmiyeSatiri` · `Borc` ·
   `BorcSorumlusu` · `MuhasebeDonemi` · `MuhasebeParametresi` ·
   `BolumIliskisi` · `SayacOkumasi` · `BelgeIliskisi` · `YonetimDelegasyonu` ·
   `BankaHareketi` · `BankaEkstresi` · `EkstreSatiri` · `KiymetliEvrak` ·
   `BankaParametresi`.

   Listeyi elle uzatmak çözüm değil: her yeni tabloda güncellenmeyi unutur ve
   hata sessizdir. Muafiyet **modelin o sütunu gerçekten taşıyıp
   taşımadığından** türetilmeli (`Prisma.dmmf`). Gerekçe
   `prisma.service.ts` içinde de yazılı.

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

   ★ **Eklendi (2 Ağustos 2026) — yenileme fonunun amaca özgülüğü.**

   ⚠️ **DÜZELTME:** burada önce dayanak olarak **KMK md. 72** gösteriliyordu.
   Atıf YANLIŞTI — md. 72 toplu yapılarda ortak giderlere katılmayı düzenler,
   yenileme fonunu değil. Soru geçerli; dayanağı fonun kat maliklerine ait
   **iade edilebilir emanet** niteliğidir (ADR-0017 §5.5).

   Yenileme fonu hesabından işletme hesabına aktarım meşru mudur?
   - Fondan harcama hangi karar/onayla yapılabilir?
   - Aktarım sistemde **engellenmeli** mi, yoksa **uyarı + gerekçe** ile izin
     mi verilmeli?
   - Ters yön (işletmeden fona) serbest mi?

   ⚠️ Cevap gelmeden bu yola teknik kısıt KONULMAMALIDIR: yanlış yönde katı
   bir kural meşru işlemi bloklar, gevşek bir kural fonun amaç dışı
   kullanımını sessizleştirir. Bağlam: [ADR-0016](docs/adr/log/ADR-0016-virman.md) §A.

### F. Altyapı ve ölçeklenebilirlik denetimi (31 Temmuz 2026)

Ürün sahibi talebiyle **salt okunur** bir denetim yapıldı: 443 dosya, 55 model,
21 migration, 204 uç, 317 birim + 24 sözleşme testi tarandı. **Kod
değiştirilmedi.** Aşağıdakiler bulgudur, karar değil — hiçbiri bu oturumda
uygulanmadı.

**Sonuç:** uygulanmış çekirdek (çok kiracılılık, RLS, denetim izi, şema, para
tipi, doğrulama) kurumsal kalitede; eksik olan etrafındaki **işletme
katmanıdır** (kuyruk, zamanlayıcı, metrik, rate limit, dağıtım). Uygulanmış
bileşenler üzerinden üretim hazırlığı **%55**; 18 alanın kapsanma oranı **%38**.
İki sayı arasındaki fark durumu özetliyor: *derinlik var, genişlik yok.*

#### P0 — üretime çıkmadan kapatılması gerekenler

1. 🔴 **`yalnizcaKendiVerisi` UYGULANMIYOR.** `RolTanimi.yalnizcaKendiVerisi` ve
   `KENDI_VERISI_KISITLI` tanımlı ama **hiçbir yerde okunmuyor** (backend +
   frontend genelinde 0 kullanım). Sonuç: `MALIK`/`KIRACI`/`SAKIN` rolündeki bir
   kullanıcı `KISI_GORUNTULE` + `BOLUM_GORUNTULE` taşıdığı için `GET /kisiler`
   ve `GET /bolumler` ile **tüm sitenin** listesini çekebiliyor. README:151 bunun
   tersini iddia ediyor. **KVKK açığı.**
2. 🔴 **Dağıtım giriş noktası yanlış.** Derleme çıktısı `backend/dist/src/main.js`
   (tsconfig `include` hem `src` hem `test` kapsadığı için rootDir `backend/`
   oluyor). Ama `backend/package.json:9` `dist/main.js`, `Dockerfile.backend`
   son satırı `backend/dist/main.js` diyor → **konteyner MODULE_NOT_FOUND ile
   açılışta düşer.** İmajın bir kez bile çalıştırılmadığını gösteriyor.
3. 🔴 **Rate limiting yok** + giriş ucu istek başına ~134 MB scrypt belleği
   ayırıyor (`N=131_072, r=8` → `128×N×r`; `maxmem` tavanı bunun iki katı).
   Sınır olmadığı için tek IP'den düşük maliyetli bellek tükenmesi.
4. 🔴 **`Idempotency-Key` gönderiliyor, okunmuyor.** Frontend her POST'ta
   yolluyor (`api.ts:36`) ve yorumu "BFS v1 §12 zorunlu" diyor; backend'de
   `@Headers` **hiç kullanılmıyor**. Ağ yeniden denemesi **mükerrer tahsilat /
   tahakkuk** üretir.
5. 🔴 **Bağlantı havuzu ve transaction timeout ayarsız.** `DATABASE_URL`'de
   `connection_limit` yok → Prisma varsayılanı 9-17. `$transaction` seçeneksiz
   çağrılıyor → varsayılan **5 sn**. Tahakkuk 400 daire için ~400 advisory lock
   + ~1200 ardışık INSERT yapıyor; bu sınırın altında bitmesi olası değil
   (`P2028`).

#### P1 — ölçek büyümeden kapatılmalı

6. **Portföy fan-out'u sınırsız eşzamanlı.** `portfoy.service.ts:307`
   `Promise.allSettled(gecerliler.map(...))` — proje başına ayrı transaction,
   11 sorgu. 150 proje = 150 eşzamanlı transaction. Havuz tükendiğinde
   `allSettled` hatayı yutuyor ve portföy **eksik ama hatasız** görünüyor.
7. **Önbellek geçersizleştirmesi yok.** `desenSil()` yazılmış, **sıfır çağrı
   yeri**. Rol değişince yetki 5 dk eski kalıyor. İronik: aynı dosya devir kaydı
   için önbelleklemeyi *"yetki kaldırmadır, 5 dakika geçerli görünmesi kabul
   edilemez"* diye reddediyor — aynı gerekçe üyelik için de geçerli.
8. **CI sözleşme testleri RLS'i doğrulayamıyor.** `ci.yml:74` `postgres`
   süper kullanıcısıyla bağlanıyor; süper kullanıcı RLS'i **her koşulda atlar**
   ve `database/init/01-roles.sql` CI servisine bağlanmadığı için `bnos_app`
   rolü orada yok. Yerelde gerçekten doğrulanıyor, CI'da doğrulanamıyor.
9. **Audit zinciri tenant başına serileşme noktası ve çatallanabilir.** Her
   yazma `findFirst(orderBy: olusmaAni desc)` ile son halkayı okuyor; iki
   eşzamanlı yazma **aynı `oncekiHash`'i** alabilir ve `oncekiHash` üzerinde
   unique kısıt yok. Advisory lock deseni depoda zaten var (`numara.service.ts`).
10. **Refresh token iptal edilemiyor.** `jti` üretiliyor, saklanmıyor; çıkış ucu
    yok. Çalınan token 7 gün geçerli.
11. **Metrik ve tracing yok** (OTel/prom-client 0 sonuç). `/saglik` Redis'i
    kontrol etmiyor; readiness/liveness ayrımı yok.
12. **`trust proxy` ayarlanmamış** → LB arkasında **her audit kaydındaki IP
    yanlış** olur ve hata sessizdir (alan dolu görünür).

#### Uygulanmamış bileşenler (kapsam dışı, belgeyle tutarlı)

Workflow Engine · Knowledge Graph adaptörü · Vector DB / pgvector · AI Agent
System · LLM Router · Token Optimization. Bunlar C-1 açık maddesiyle zaten
işaretli. **Kuyruk altyapısı farklı:** BullMQ `backend/package.json`'da kurulu
ama kaynak kodda **sıfır kullanım**; `IScheduler` portu ve `IsCalistirma` tablosu
(idempotentlik UNIQUE'i dahil) yazılmış, **uygulaması yok**. Outbox Redis
Stream'e `XADD` yapıyor ama **tüketici yok** ve `MAXLEN` verilmediği için stream
sınırsız büyüyor. İletişimdeki `durum: 'ZAMANLANDI'` kayıtları **hiçbir zaman
gönderilmiyor**.

#### Belge–kod tutarsızlıkları (kod geçerlidir)

| Belge iddiası | Koddaki gerçek |
|---|---|
| README:151 — malik/kiracı/sakin `yalnizcaKendiVerisi` taşır | Bayrak okunmuyor |
| `api.ts:29` — "her POST için zorunlu (BFS v1 §12)" | Backend başlığı okumuyor |
| ADR-0005 — "geçersizleştirme domain event'lerle" | `desenSil` hiç çağrılmıyor |
| ADR-0005 — "yetersizse özet tablosu" | Özet tablo yok, canlı `groupBy` |
| `local-business-rules.adapter.ts:4` — "kurallar VERİ olarak" | TS closure'ı olarak gömülü |
| `bnos-client/package.json` — "Workflow portlari" | Workflow portu yok |
| README:44 — `infrastructure/ … k8s` | Dizin **boş** |
| README:116 — "57 duman testi" | 317 test |
| `scheduler.port.ts:4` — "v1 uygulaması: BullMQ" | Uygulama yok |
| `prisma.service.ts:9` — "soft delete filtresi merkezîdir" | Uzantı bağlı değil (§3.B.0) |

#### Ölçek değerlendirmesi (kod yapısından çıkarım, ölçüm yok)

| Ölçek | Hazırlık | İlk düşecek bileşen |
|---|---|---|
| 15 site | %60 | `GET /portfoy/ozet` yavaşlar, düşmez |
| 50 site | %40 | Havuz tükenmesi → `P2024`, portföy **sessizce eksik** |
| 100 site | %20 | `tahakkuk.calistir` → `P2028` (200+ daireli sitelerde) |
| 500 site | %10 | `audit_kaydi` (bölümleme ve arşivleme yok) |
| 1000 site | %5 | Tek PostgreSQL örneğinin yazma kapasitesi |

⚠️  Bu tabloda **hiçbir ölçüm yok** — depoda yük testi, benchmark veya
performans bütçesi bulunmuyor. Rakamlar kod yapısından yapılan mühendislik
tahminidir ve gerçek ölçümle değiştirilmelidir.

### G. ✅ KAPATILDI — devredilen iki düzeltme uygulandı

> Aşağıdaki bölüm bulguyu ve gerekçesini tarihçe olarak korur. **İkisi de bu
> commit'te kapatıldı**; nasıl kapatıldığı §3.H'dedir.



30-31 Temmuz 2026 oturumu kapatılırken ürün sahibi, denetimde çıkan iki küçük
ama **üretime çıkışı doğrudan engelleyen** düzeltmenin sonraki oturumda ele
alınmasına karar verdi. Bu bir erteleme kararıdır, bulgunun geçersizliği
DEĞİLDİR: ikisi de bugün ayakta duran bir engeldir.

**1. Konteyner giriş noktası yanlış — imaj açılışta düşer.**

| Yer | Yazan | Olması gereken |
|---|---|---|
| `backend/package.json:9` | `node dist/main.js` | `node dist/src/main.js` |
| `infrastructure/docker/Dockerfile.backend` (CMD) | `node backend/dist/main.js` | `node backend/dist/src/main.js` |

Sebep: `backend/tsconfig.json` `include: ["src/**/*", "test/**/*"]` olduğu için
tsc rootDir'i `backend/` seçiyor ve çıktı `dist/src/` altına düşüyor. İki yol da
`MODULE_NOT_FOUND` verir. **İmajın bir kez bile çalıştırılmadığının kanıtıdır.**

İki çözüm var, biri seçilmeli:
- Yolları düzeltmek (en küçük değişiklik), ya da
- `tsconfig`'te testleri `include` dışına alıp çıktıyı `dist/` köküne düzleştirmek
  (o zaman `vitest` yolları gözden geçirilmeli).

⚠️  Hangisi seçilirse **CI'a bir duman testi bağlanmalı**: imaj build edilip
`--help` ya da sağlık ucuyla bir kez açılmalı. Bu hata tam olarak "hiç
çalıştırılmadığı için" fark edilmedi; aynı boşluk bırakılırsa tekrar eder.

**2. Rate limiting yok — giriş ucu ucuz bir bellek tükenmesi vektörü.**

`@nestjs/throttler` benzeri bir sınır **hiç yok** (depoda 0 sonuç). Giriş ucu
her denemede scrypt çalıştırıyor — kullanıcı bulunamasa bile, çünkü zamanlama
sızıntısını önlemek için `KUKLA_OZET` ile doğrulama yapılıyor
(`oturum.service.ts:95`, doğru bir tasarım).

Maliyet: `N=131_072, r=8` → scrypt çalışma belleği `128 × N × r` ≈ **134 MB**;
`sifre.ts:37`'deki `maxmem` tavanı bunun **iki katını** (≈268 MB) veriyor.
Sınırsız istek × 134 MB = tek IP'den önemsiz maliyetle süreç düşürülebilir.

⚠️  **scrypt parametreleri DÜŞÜRÜLEREK çözülmemeli** — `N=2^17` OWASP 2024
asgarisidir ve bilinçli seçilmiştir (`sifre.ts:28`). Çözüm sınırlamadır, maliyeti
azaltmak değil. En az `/oturum/giris` ve `/oturum/yenile` sınırlanmalı; IP başına
ve e-posta başına ayrı sayaç gerekir (yalnızca IP, NAT arkasındaki bir siteyi
toptan kilitler).

**Devredilmeyen ama açık kalan:** §3.F'deki P0-1 (`yalnizcaKendiVerisi`
uygulanmıyor — KVKK açığı) bu iki maddenin **dışındadır** ve hâlâ açıktır.
Denetimdeki en ağır bulgu odur; küçük bir düzeltme olmadığı için bu ikisiyle
birlikte gruplanmadı. Önceliklendirmesi ürün sahibine aittir.

### H. Bu commit'te yapılan — iki düzeltmenin uygulanması

#### 1. Konteyner giriş noktası — ÇÖZÜM: çıktı düzeltildi, beyan değil

İki seçenek vardı (§3.G). **İkincisi seçildi:** yolları `dist/src/main.js`'e
çekmek yerine, derleme çıktısı `dist/` köküne düzleştirildi. Gerekçe: birinci
seçenek `dist/test/` klasörünün de üretim imajına kopyalanmasını **sürdürürdü**
— test kodu üretim imajında işi olmayan bir yüktür.

- `backend/tsconfig.build.json` (yeni) — `test` ve `**/*.spec.ts` hariç tutulur.
- `backend/nest-cli.json` — `tsConfigPath` bu dosyaya bağlandı.
- Sonuç: çıktı artık `backend/dist/main.js`. `package.json` ve
  `Dockerfile.backend` **hiç değişmedi**; zaten doğru yolu gösteriyorlardı.
- `pnpm typecheck` hâlâ ana `tsconfig.json`'u kullanır → **testler tip
  denetiminden geçmeye devam eder**. `vitest` swc kullanır, tsc çıktısına
  bağlı değildir → sözleşme testleri etkilenmez (24/24 doğrulandı).
- `tests/unit/*.mjs` içindeki iki `dist/src/...` yolu güncellendi.

**Tekrarı önleyen denetim** (§3.G'nin istediği): `scripts/config-check.mjs`'e
yedinci adım eklendi — `package.json` "start" ile Dockerfile CMD'si birbiriyle
**ve** varsa gerçek derleme çıktısıyla karşılaştırılır. `pnpm verify` zincirinde
ve CI'ın ilk işinde koşar.

⚠️  **Denetleyici NEGATİF TESTLE kanıtlandı:** `dist/main.js` geçici olarak
başka bir ada alındı, `config-check.mjs` çıkış kodu **1** verdi ve
*"Giris noktasi derleme ciktisinda YOK … Konteyner acilista MODULE_NOT_FOUND ile
duser"* yazdı. Kontrolün gerçekten çalıştığı, "yeşil yanıyor" ile değil
**kırmızı yakılarak** doğrulandı.

⚠️  Bu, imaj duman testinin **ucuz ikamesidir, yerine geçmez.** `docker build`
+ bir kez açılış hâlâ CI'a eklenmeli; bu kontrol yalnızca yol tutarlılığını
görür, imajın gerçekten açıldığını değil.

#### 2. İstek sınırı — `common/guards/istek-siniri.guard.ts` (yeni)

`@nestjs/throttler` **kullanılmadı**, iki nedenle: (a) kurulu değil ve depoda
scrypt'in bcrypt yerine seçilme gerekçesiyle aynı çizgide gereksiz bağımlılık
eklenmiyor; (b) varsayılan deposu **bellek içidir** ve çok örnekli dağıtımda
sessizce yanlış çalışır — 3 replikada etkin sınır 3× olur, koruma "var"
görünürken üçte bir gücündedir. Sayaç **Redis'tedir** (`ioredis` zaten var).

| Uç | IP | Kimlik | Pencere |
|---|---|---|---|
| `POST /oturum/giris` | 20 | 5 (e-posta) | 300 sn |
| `POST /oturum/yenile` | 60 | — | 300 sn |

Zorlanan kurallar:

- **İşaretsiz uç sınırlanmaz.** `@IstekSiniri(...)` taşımayan uç dokunulmadan
  geçer (`@RequirePermission` deseni). Genel bir sınır, toplu tahakkuk ve toplu
  gönderim gibi meşru yoğun işleri sessizce keserdi.
- **Sınır Üç Kapı'dan ÖNCE** çalışır ama bir kapı değildir. Sonda olsaydı
  reddedilen istek yine de JWT doğrulaması ve veritabanı okuması yaptırırdı.
- **Atomik Lua sayacı.** `INCR` + `EXPIRE` iki gidiş-dönüş olarak yazılamaz:
  arada bağlantı koparsa anahtar **ömürsüz** kalır ve o kimlik KALICI olarak
  kilitlenir — kullanıcı "şifremi unuttum" akışında da kilitli kalır.
- **429 hangi sayacın dolduğunu SÖYLEMEZ.** "Bu e-posta için sınır doldu"
  demek, e-postanın kayıtlı olduğunu doğrulardı ve giriş ucunun kullanıcı
  numaralandırmayı engelleme çabasını boşa çıkarırdı.
- **Ham e-posta anahtara yazılmaz**, SHA-256 özeti konur: sayaç kişisel veri
  deposu değildir (KVKK).
- **Fail-open + ERROR log.** Redis düşerse istek geçer. Fail-closed seçilseydi
  bir Redis kesintisi **tam bir kimlik kesintisine** dönüşürdü. Kabul edilen
  bedel açıkça loglanır — alarm kurulacak yer orasıdır.
- **Bağlantı tembeldir** (`lazyConnect`). Eager bağlanan yapıcı sınıfı birim
  testinde kurulamaz kılıyordu: soket açılıyor, olay döngüsü ayakta kalıyor ve
  **test asılıyordu** (yaşandı). Ayrıca fail-open politikasıyla da çelişirdi.

**scrypt parametrelerine DOKUNULMADI.** `N=2^17` OWASP 2024 asgarisidir;
düşürmek DoS'u hafifletirken parola kırmayı ucuzlatırdı — bir açığı kapatıp
daha kötüsünü açmak olurdu.

#### Yanında kapatılan: `TRUST_PROXY`

IP sayacı, doğru istemci adresi olmadan **anlamsızdır**: yük dengeleyici
arkasında bütün istekler tek adresten geliyor görünür ve sayaç bir sitenin
tamamını kilitler. Bu yüzden `TRUST_PROXY` ortam değişkeni eklendi
(`env.schema.ts` + `main.ts` + `.env.example`).

⚠️  **Varsayılan 0 (kapalı).** İki yönde de sessiz hata var: yanlış **açmak**
korumayı tümüyle kaldırır (doğrudan erişilen sunucuda istemci
`X-Forwarded-For`'u kendisi yazar ve her istekte farklı "IP" görünür); yanlış
**kapatmak** meşru kullanıcıyı kilitler. Dağıtım topolojisi bilinerek verilir.

#### ⚠️ KAPANMAYAN kalan boşluk — dürüstçe

**İstek sınırı HIZI sınırlar, EŞZAMANLILIĞI değil.** Pencere başına 20 istek,
o 20 isteğin aynı anda gelemeyeceği anlamına gelmez: en kötü durumda 20
eşzamanlı scrypt ≈ **2,7 GB**. Sınırsız hâle göre büyük kazanç, ama sıfır risk
değil. Kalan boşluk scrypt çağrılarına bir **eşzamanlılık kapısı (semafor)**
koymakla kapanır; bu ayrı bir iştir ve bu düzeltmenin kapsamında değildi.
Buraya yazılmasının nedeni "çözüldü" sanılmamasıdır.

#### Doğrulama

- Birim: `tests/unit/istek-siniri.test.mjs` (**14**) → toplam **331** birim testi.
- Sözleşme: **24/24** (Docker ayağa kaldırılıp koşuldu).
- `pnpm verify` **9/9** · lint temiz · `lint:md` temiz.
- **Canlı 13/13** — kabul ölçütü karşılandı:
  - Backend `node backend/dist/main.js` ile **ayağa kalktı** (beyan edilen yol).
  - `/saglik` → **200**, `veritabani: açık`.
  - İşaretsiz uç sınırlanmadı (30 sağlık isteği geçti).
  - Giriş: `401 401 401 401 401` → **6.'da 429**, `Retry-After: 297`.
  - 429 gövdesi sayaç adını sızdırmıyor, `correlationId` taşıyor.
  - Farklı e-posta ayrı sayıldı; IP sayacı da bağımsız tetiklendi (20'de).
- Denetleyici negatif testi: giriş noktası saklandığında `config-check` **1**
  döndü.

---

### I. Gerçekçi dağılım ölçümü — 5.000 bölüm / 4.700 malik (31 Temmuz 2026)

Bu tur **yalnızca ölçümdür**; ürün kodu değişmedi. Veri seti:
`database/perf/gercek-dagilim.sql` (tenant `gercek-5000`) — 5.000 bölüm ·
13.000 kişi · 4.985 malik kaydı (4.700 tekil kişi) · 3.000 kiracı · 5.300
sakin. Malik dağılımı 4.500×1 daire · 150×2 · 45×3 · 5×10. Parti tavanı için
ikinci fikstür: `database/perf/parti-tavani.sql` (tenant `perf-parti`,
25/50/100/200/300/400 bölümlük bloklar).

Bütün sayılar **uçtan uca HTTP** ölçümüdür (`node dist/main.js`, üretim
derlemesi). psql sayıları artık ölçüt olarak kullanılmıyor — gerekçe ADR-0011.

#### ★ P0-İŞLEVSEL — toplu tahakkuk hedef ölçekte KIRIK

**Bu bir performans sorunu değil; çekirdek özellik 5.000 bölümlük bir sitede
hiç çalışmıyor.**

`POST /tahakkuk/calistir` tüm siteye aidat yazarken **5 saniyelik işlem
sınırını aşıyor ve 500 dönüyor**. İşlem tümüyle geri alınıyor: **sıfır borç,
sıfır outbox olayı**. Yönetici hiçbir şey yazılmadığını yalnızca opak bir
hata mesajından anlıyor.

Parti büyüklüğü taraması (`perf-parti`, BLOK_BAZLI):

| bölüm | HTTP | süre | borç | outbox |
|---|---|---|---|---|
| 25 | 201 | 437 ms | +25 | +1 |
| 50 | 201 | 700 ms | +50 | +1 |
| 100 | 201 | 1.263 ms | +100 | +1 |
| 200 | 201 | 2.386 ms | +200 | +1 |
| 300 | 201 | 4.002 ms | +300 | +1 |
| **400** | 201 | **4.789 ms** | +400 | +1 |
| 500 | **500** | ~5.020 ms | **+0** | **+0** |

Doğrusal: bölüm başına **≈11,6 ms**. 5.000 ms'lik sınır **≈420 bölümde**
doluyor. 400 bölüm zaten **%96 dolulukta** — daha yavaş bir makinede o da
düşer. Tek blok (500 bölüm) üç denemede de 500 döndü.

Yan bulgular: outbox olayı **tahakkuk başına 1** (bölüm başına değil), relay
gecikmesi ortalama 1,3 sn, yeniden deneme 0 — outbox geride kalmıyor.
10 eşzamanlı okuyucu varken toplu tahakkuk koşarsa okuma p95 282,8 → 319,7 ms
(+%13).

Karar taslağı: **ADR-0013** (yalnızca sorular; karar verilmedi).

#### P0-ÖLÇEK — havuz ve işlem sarmalama

- **DB bağlantı havuzu 5** (Prisma varsayılanı; `DATABASE_URL` içinde
  `connection_limit` verilmemiş).
- **Doygunluk 10 eşzamanlı kullanıcıda.** Verim tavanı ~44 istek/sn; 25'e
  çıkınca verim aynı kalıp gecikme 2,5×, 50'de verim düşüyor.
- Yük altında bağlantılar çoğunlukla **`idle in transaction`**:
  `PrismaService.tenantIslemi` **her isteği** interaktif işleme sarıyor ve
  4 `set_config` gidiş-dönüşü boyunca bağlantı tutuluyor. Havuz meşgul
  görünüyor ama sorgu koşmuyor.
- Yüksek eşzamanlılıkta arıza yavaş sorgu değil, **işlem başlatma açlığı**:
  Prisma işlemi verilen sürede başlatamıyor ve istek **500** dönüyor. Kullanıcı
  önce bekliyor, sonra opak `BEKLENMEYEN_HATA` alıyor.
- GC darboğaz **değil**: duraklamalar boştaki 6,7 ms medyandan 20 ms'e çıkıyor,
  RSS 215 → 216 MB, yığın büyümüyor.

#### P1

- **Kapsam kurulumu O(tenant)** — O(kapsam) değil. Uçtan uca soğuk maliyet:
  13.000 kişilik tenant'ta **≈39 ms**, 30 kişilik tenant'ta **≈14 ms**
  (kapsamsız YÖNETİCİ kontrol ölçümü çıkarılmış hâliyle). Kök sebep
  `backend/src/common/prisma/tenant.reader.ts:113` (`kisiId: { not: … }`) ve
  `:150` — 3.000 satır çekilip JS tarafında `Set` kesişimi yapılıyor.
- **TenantGuard, PermissionGuard'dan ÖNCE koşuyor.** Reddedilecek bir istek
  bile bu bedeli ödüyor: SAKİN'in 403 aldığı uç soğuk kapsamda **61 ms**.
- Sıcak/soğuk farkı büyük: aynı uç önbellek isabetinde 15–30 ms, ıskada
  60–78 ms. Rol bazlı uçların ölçümü bu yüzden iki ayrı sayı ister.
- **MANUEL tahakkuk doğrulaması** eksik bölümlerin tamamını tek `detail`
  metnine yazıyor; 5.000 bölümde binlerce isim döndürüyor.

#### ★ AÇIK SORU — yarın ilk iş

**Kapsam önbelleği 300 sn TTL** (`tenant.reader.ts:82`). Süresi dolmuş bir
yetki bu pencerede hâlâ erişim veriyor olabilir.

A0.7'deki **17. negatif test** geçiyorsa, muhtemelen önbellekli yoldan
**GEÇMİYOR**. Doğrulanacak: test önbellekli yolu mu, doğrudan yolu mu ölçüyor?
Geçiyorsa **test yanlış güvence veriyor** ve düzeltilmesi gereken testtir.

#### P1 — `prisma migrate reset` KIRIK (1 Ağustos 2026)

```
Error: P3016  The fallback method for database resets failed…
ERROR: cannot drop table borc because other objects depend on it
DETAIL: policy tahsilat_kapsam on table tahsilat depends on table borc
        policy borc_sorumlusu_kapsam on table borc_sorumlusu depends on table borc
HINT: Use DROP … CASCADE
```

**Kök sebep bulundu.** Kapsam politikalarından **ikisi** `EXISTS` alt sorgusuyla
BAŞKA bir tabloya bakıyor; PostgreSQL bunu `pg_depend` kaydı olarak tutuyor:

| politika | tablo | bağımlı olduğu |
|---|---|---|
| `borc_sorumlusu_kapsam` | `borc_sorumlusu` | `borc` |
| `tahsilat_kapsam` | `tahsilat` | `borc`, `tahsilat_tahsisi` |

(`0022_satir_kapsami/migration.sql:141,166` · `0023_kirali_mulk_kapsami/migration.sql:66,87`)

Prisma'nın reset geri düşüş yolu tabloları **CASCADE olmadan** düşürüyor ve bu
iki bağımlılıkta takılıyor. Diğer 13 kapsam politikası yalnızca kendi tablosuna
baktığı için sorun çıkarmıyor.

**Etki alanı — üretim riski DEĞİL, doğrulanmadan yazılmasın:** `migrate deploy`
(üretim yolu) hiçbir şey düşürmez, etkilenmez. Kırılan yollar `migrate reset` ve
sürüklenme (drift) algılandığında reset çağıran `migrate dev`. Yani risk
**geliştirme ve CI** ortamlarındadır: temiz kurulum yapılamaz, CI'da sıfırdan
şema kurma adımı eklenirse ilk günden kırmızı yanar.

**Bugünkü geçici çözüm** (uygulandı, kalıcı değil):
`DROP SCHEMA public CASCADE` + `CREATE SCHEMA` + `pnpm db:migrate` + `pnpm db:seed`.

**Düzeltme seçenekleri — karar verilmedi:**
1. `scripts/db.mjs reset` içinde şema düşürmeyi Prisma'ya bırakmayıp doğrudan
   `DROP SCHEMA … CASCADE` yapmak (en küçük değişiklik, Prisma'ya dokunmaz).
2. İki politikayı tablolar arası `EXISTS` kullanmayacak biçimde yeniden yazmak
   (bağımlılığı kaldırır ama kapsam kuralını değiştirir — ADR-0011 konusu).
3. Reset öncesi politikaları düşüren bir hazırlık adımı.

### K. P0 KAPATILDI — çift tahakkuk (1 Ağustos 2026)

**Ölçülmüş mali veri bozulmasıydı:** 5.000 bölümlük bir sitede beklenen 5.000
yerine **10.000 borç satırı**. Ayrıntı ve karar:
[ADR-0014](docs/adr/log/0014-mukerrer-tahakkuk-korumasi.md).

Kapatan şey: **migration 0026** — `tahakkuk_calismasi` tablosu ve kısmi
benzersiz indeks `tahakkuk_calismasi_asil_uq`. Çalışma satırı işlemin ilk
yazmasıdır; ikinci işlem kısıt üzerinde bloklanır. `borc.count()` denetimi
kaldırıldı — okuma/yazma penceresi uygulama katmanında kapatılamıyordu.

Yanında gelen üç şey:

- **`Idempotency-Key` artık OKUNUYOR** (`IdempotansInterceptor` + tablo).
  BFS v1 §366 zorunlu kılıyordu, depoda hiçbir yer okumuyordu.
- **Ek/düzeltme tahakkuku** açık `ekTahakkuk` bayrağı ister; `tip='EK'` ile
  yeni çalışma açar ve kısmi indekse takılmaz.
- **Migration mevcut bozuk veriyi sessizce düzeltmez** — mükerrer satır varsa
  durur ve hangi satırların bozuk olduğunu yazar. İlk uygulamada gerçekten
  tetiklendi.

Testler: **CT-16, 6/6** (`backend/test/contract/mukerrer-tahakkuk.spec.ts`).
Uygulamadan önce yazıldı, 5'i kırmızıydı.

#### Kalıcılaşan ikinci değişiklik: `set_config` tek sorguda

`tenantIslemi`'ndeki dört `set_config` çağrısı tek `SELECT`'e alındı. Ölçülen
(50 eşzamanlı, havuz 20): boş bekleme %23,2 → %13,0 · `active` %72,7 → %83,6 ·
verim 63,9 → 80,7 istek/sn · p95 1.110 → 878 ms.

#### ⚠️ HAVUZ ÖNERİM DEĞİŞTİ — birleştirmeden sonra yeniden ölçüldü

Dün "20 iyi görünüyor, belki 25" demiştim. Birleştirme kalıcılaştıktan sonra
aynı yük (50 eşzamanlı) dört havuz boyutuyla ölçüldü:

| havuz | p50 | p95 | istek/sn |
|---|---|---|---|
| varsayılan (5) | 891 ms | 1.280 ms | 52,8 |
| 15 | 907 ms | 1.138 ms | 53,4 |
| 20 | 975 ms | 1.382 ms | 49,3 |
| 30 | 949 ms | 1.416 ms | 50,7 |

**Fark yok** — dördü de koşum oynaklığı içinde. Havuz büyütmenin dünkü
kazancı (44 → 70 istek/sn), bağlantıların `set_config` gidiş-dönüşleri boyunca
tutulmasından kaynaklanıyordu; birleştirme o baskıyı kaldırınca havuz boyutu
belirleyici olmaktan çıktı.

**Yeni öneri: `connection_limit` şimdilik DEĞİŞTİRİLMESİN.** Ölçüm bir kazanç
göstermiyor; kanıtsız bir yapılandırma eklemek yalnızca bakım yüküdür. Ölçüm
yapılandırmadan önce gelir — bu ADR-0011'in 1. yöntem kuralının aynısıdır.

#### Madde 4 analizi — kapsam kurulumu ayrı işlemde (ölçüm YOK, yalnızca analiz)

`tenant.reader.ts:120` kendi `tenantIslemi` çağrısını açar. Soğuk bir istek iki
interaktif işlem başlatır.

1. **Ana işlemin içine alınabilir mi? — HAYIR, sıra sorunu var.** Kapsam,
   `set_config` değerlerini ÜRETEN şeydir; ana işlem o değerler yazılmadan
   açılamaz. Kapsam sorgularının kendisi de kapsam politikalarına tabidir
   (`malik`, `kiraci`, `sakin` üzerinde RESTRICTIVE politika var) — kapsam
   kurulmadan koşarlarsa kendilerini süzerler. Bugün bu, kapsamı **kurulmadan
   önce** ayrı bir işlemde okuyarak çözülüyor ve `tenant.reader.ts:77`
   yorumu bunu açıkça uyarıyor. Birleştirme, politikaların kapsam kurulumunu
   muaf tutmasını gerektirirdi; bu ADR-0002'nin tek katmanlı olmama ilkesine
   dokunur. **Önerilmez.**
2. **`:113`'teki `kisiId: { not: … }` sorgusu `bolum_id` ile kısıtlanabilir mi?
   — EVET, ve maliyeti O(tenant)'tan O(kapsam)'a düşürür.** Sorgunun amacı
   "kişinin MALİK olduğu bölümlerde başkası kiracı mı" sorusudur; yani ilgi
   alanı zaten **o kişinin malik olduğu bölümlerdir**. Bugün tenant'ın bütün
   kiracılarını (3.000 satır) çekiyor. `bolumId: { in: malikBolumleri }`
   eklenmesi sorguyu kapsam boyutuna indirir. Malik sorgusu önce koştuğu için
   liste zaten elde; iki sorgu `Promise.all` yerine sıraya alınır.
   **Önerilir.**
3. **`:150`'deki JS `Set` kesişimi SQL'e taşınabilir mi? — EVET ve 2. madde
   uygulanırsa GEREKSİZLEŞİR.** 2. madde sonrası dönen satır sayısı kapsam
   kadar olur (tipik olarak 1–10); kesişimin JS'te yapılması sorun değildir.
   SQL'e taşımak ancak 2. madde uygulanmazsa anlamlıdır. **Önce 2. madde.**

**Ölçüm tahmini vermiyorum** — 2. maddenin kazancı uygulanıp ölçülmeden
bilinemez.

### J. İki ayar denemesi ve set_config birleştirme (1 Ağustos 2026)

**Hiçbiri kalıcı değildir.** Ayarlar ölçüm sonrası geri alındı, deneme dalı
silindi, hiçbir şey commit edilmedi. Sayılar karar içindir.

**Deney 1 — `connection_limit=20` + tahakkuk yolunda `timeout` 110 sn.**
Havuz 5 → 20; `max_connections` 200, sorun yok. Sonuç: verim tavanı 44 → 70
istek/sn, 50 eşzamanlıda p95 2.280 → 957 ms, 500'ler sıfırlandı, verim çöküşü
kalktı. Toplu tahakkuk 5.000 bölümde **çalıştı** (49,6 sn, doğrusal) —
ADR-0013'ün ilk gerekçesi böyle çürütüldü.

**Deney 2 — `tenantIslemi`'ndeki 4 `set_config` tek sorguda.** Aynı havuzla
(20) A/B:

| eşzamanlı | idle-in-tx ayrık → birleşik | active ayrık → birleşik | p95 | istek/sn |
|---|---|---|---|---|
| 10 | %26,3 → **%19,8** | %51,1 → %53,9 | 256 → 263 | 62,8 → 63,2 |
| 25 | %24,5 → **%14,7** | %70,4 → %81,3 | 637 → 526 | 66,0 → 78,4 |
| 50 | %23,2 → **%13,0** | %72,7 → **%83,6** | 1.110 → **878** | 63,9 → **80,7** |

Boş bekleme **yarıya indi**, verim %26 arttı, p95 %21 düştü. Tek satırlık bir
değişiklik; kalıcı hâle getirilip getirilmeyeceği ürün sahibinin kararı.

**Kapsam kurulumu bu işlemin İÇİNDE DEĞİL.** `tenant.reader.ts:120`
kapsamı **kendi `tenantIslemi` çağrısında** kuruyor. Yani önbellek ıskalayan bir
istek **iki interaktif işlem** açıyor: ayrık sürümde 8 `set_config` gidiş-dönüşü,
birleşik sürümde 2. Soğuk/sıcak faz ölçümü (aynı havuz, kontrol grubu çıkarılmış):

| | soğuk − sıcak | kontrol (kapsamsız yönetici) | düzeltilmiş kapsam maliyeti |
|---|---|---|---|
| ayrık `set_config` | 50,7 ms | +10,3 ms | **≈40 ms** |
| birleşik `set_config` | 34,1 ms | −0,7 ms | **≈35 ms** |

Yani kapsam kurulumunun ≈35 ms'i `set_config` değil, **4 kapsam sorgusu + JS
`Set` kesişimi**. Birleştirme sıcak yolu iyileştiriyor; soğuk yol için asıl
düzeltme hâlâ `tenant.reader.ts:113/:150`.

#### Ölçüm koşulları (tekrar üretmek için)

- İstek sınırı sayaçları giriş öncesi Redis'ten temizlendi. Bu bir **fikstür
  engeli**dir (IP başına 20 giriş / 5 dk), ölçülen uç değil.
- DB havuzu örneklemesi **ayrı bir süreçte** koştu. İlk denemede aynı süreçte
  senkron örnekleme olay döngüsünü blokladı ve gecikmeleri bozdu; o koşum
  atıldı.
- `pg_stat_activity.state` yalnızca süper kullanıcıya görünür; `bnos_migrator`
  ile örneklerken bütün alanlar NULL geldi.

---

### H. Kurulum bütünlüğü — tohumla kurulan proje muhasebe yapamıyordu (2 Ağustos 2026)

Virman çalışması sırasında **ayrı bir bulgu** olarak çıktı, virmanla ilgisi yok.
Kapatıldı; ama kapatılan **semptomdu, sebep değil** — sebep §H.3'te açık madde
olarak duruyor.

#### H.1 · Ölçüm — üç boşluk, sırayla ortaya çıktı

Kanıt önce alındı, sonra düzeltildi. Her düzeltme bir sonrakini görünür yaptı:

| # | Boşluk | Ölçülen davranış |
|---|---|---|
| 1 | `MuhasebeParametresi` kaydı **hiç açılmıyordu** | `POST /makbuzlar/:id/muhasebelestir` → **422** · *"Varsayılan kasa hesabı tanımlı değil; nakit tahsilat muhasebeleşemez."* |
| 2 | 12 hesabın **hiçbirinde** `ozellik` yoktu (hepsi `NORMAL`) | `GET /muhasebe/defterler/kasa?ozellik=KASA` → **200 · `[]`** (BANKA da aynı) |
| 3 | **Hiç muhasebe dönemi açılmıyordu** | 1 ve 2 kapatıldıktan sonra → **422** · *"2026-08-02 tarihini kapsayan bir muhasebe dönemi yok."* |

Üçü de kapatıldıktan sonra uçtan uca kanıt: `POST /makbuzlar` → **201**,
`POST /makbuzlar/:id/muhasebelestir` → **201 · `YEV-2026-000001`**.
Kasa defteri artık `[]` değil, hesabı döndürüyor (satırları boş, çünkü fiş
TASLAK ve `taslakMizanaGirer=false` — beklenen).

> ⚠️ **Boşluk 3, ilk ikisi kapatılmadan GÖRÜNMÜYORDU.** İlk hata sonrakini
> maskeliyordu. "Bir hata düzelttik, bitti" varsayımının neden ölçümle
> sınanması gerektiğinin somut örneği.

#### H.2 · YANSITMA — varsayımım yanlış çıktı, düzeltildi

Önceki turda *"yansıtma dönem kapanışına kadar görünmez, muhtemelen o da
sessiz"* demiştim. **Öyle değil.** `donem.service.ts:632` açık hata veriyor:

```
422 · "Yansıtılacak hesap hareketi yok."
      sonrakiEylem: "Hesap planında özelliği YANSITMA olan hesap tanımlı mı?"
```

Yani aynı eksiklik sınıfı ürünün **iki farklı yerinde iki farklı şekilde**
davranıyor: yansıtma yolu doğruyu yapıyor, kasa/banka defteri yapmıyor. Bu
tutarsızlık ölçülmeseydi "hepsi sessiz" ya da "hepsi açık" sanılacaktı.

#### H.3 · ★ Kapatılan semptomdu, sebep değil

Tohum düzeltmesi **tohumu** düzeltir. Sebep şudur:

> Kurulumun tamamlanıp tamamlanmadığını **hiçbir yerde kontrol eden yok.**
> Eksik kurulmuş proje, hata vermek yerine boş ekran gösteriyor.

Elle kurulan yeni bir tenant aynı duruma **bugün de** düşer. Bu yüzden
`backend/test/contract/kurulum-butunlugu.spec.ts` (**CT-20 · 7 test**) iki
bölümlü yazıldı ve **ikinci bölüm kalıcıdır**:

- **Bölüm 1 (5 test)** — tohumun kurulumu tam mı. Düzeltmeden sonra yeşil.
- **Bölüm 2 (2 test)** — kurulum EKSİKKEN sistem ne yapıyor. Kendi işaretsiz
  tenant'ını kurar; **tohum düzeltildikten sonra da koşar.** Amacı sessizliğin
  görünür kalmasıdır. `it.skip` kullanılmadı — atlanan test, olmayan testtir.

#### H.4 · Migration YAZILMADI — gerekçe

Var olan projelerin hesap planına `ozellik` atayan bir migration **bilerek
yazılmadı**:

> `kod='120'` varsayan bir migration, hesap planını özelleştirmiş projede
> **yanlış hesabı kontrol hesabı yapar. Sessiz bozulma, işaretsiz kalmaktan
> kötüdür.**

Hangi hesabın kontrol hesabı olduğu **mali bir karardır** (ADR-0010) ve kod
adına verilemez. Var olan projeler için doğru yol §H.3'teki kurulum kontrolü:
eksikliği **söyle**, tahmin etme.

#### H.5 · Yol haritasına eklenen üç madde

- **(b) Defter sorgusu açık hata versin.** `defter.query.service.ts:293-316` —
  işaretli hesap yoksa `hesaplar` boş kalıyor, döngü hiç dönmüyor, `200 · []`
  dönüyor. "Hesap işaretlenmemiş" ile "hesapta hareket yok" ayrı iki durumdur;
  ikisi de aynı yanıtı veriyor. Doğrusu: işaretli hesap yoksa **422 + çıkış
  yolu**. Düzeltildiğinde CT-20 test (6) *422 bekleyecek şekilde GÜNCELLENİR,
  silinmez.*
- **(c) Kurulum tamamlanma kontrolü.** Proje "kullanıma hazır" sayılmadan önce
  neyin zorunlu olduğunu tek yerde tanımlayan kontrol: parametre kaydı,
  kasa/banka/cari kontrol/yansıtma işaretleri, bugünü kapsayan açık dönem.
  Eksikse yönetime **liste hâlinde** göster. Henüz **yapılmadı**, karar bekliyor.
- **Uç adı tutarsızlığı.** Tahsilat modülünün ucu `POST /makbuzlar`, modül adı
  `tahsilat`. `POST /tahsilat` **404** veriyor (ölçüldü). İkisinden biri
  seçilmeli; bu turda dokunulmadı.

#### H.6 · Yan bulgu — testin kendisi de sessiz kalabiliyor

CT-20 test (2) ilk koşumda **yanlış sebeple yeşil** geçti: kayıt yokken
`p?.varsayilanKasaHesapId` `undefined` üretiyor ve `not.toBeNull()` geçiyor.
Test dosyasına kural olarak yazıldı: **iddia edilen şeyin varlığı önce
daraltılır, `?.` ile geçiştirilmez.**

---

### I. Demo akışı ölçümü + tohum tutarlılığı (2 Ağustos 2026)

#### I.1 · Uçtan uca ölçüm — 34 uç, ham çıktı

Tohum yeniden kurulup 34 uç sırayla çağrıldı (ilk koşum kendi kanıt betiğimin
bıraktığı makbuzla kirlenmişti; `db:reset` sonrası tekrarlandı). Dolu dönenler:
apartman · blok · kat · bölüm · kişi · malik · ilişki · gider türü ·
tahakkuk borçları (36) · dönemler (3) · cari ekstre · yaşlandırma · hesaplar ·
kasa/banka defteri. Boş dönenler: kiracı · sakin · makbuz · fiş · yevmiye ·
muavin · mizan · sayaç · belge · araç · misafir · daire görevlisi ·
site personeli · banka hesabı.

`GET /daireler` için aldığım 404 **benim hatamdı** — liste ucu yok, rota
`/daireler/:bolumId/kart`.

#### I.2 · ★ Tohum kendi kendini yalanlıyordu — kapatıldı

```
ÖNCE : borc kapandi_mi=true → 24 · Σ odenen = 43.200,00 · tahsilat tablosu → 0 satır
       cari ekstre: 3 BORÇ satırı, hiç TAHSİLAT satırı yok, tahsilatToplam "0.0000"
```

`odenen` elle yazılıyordu (`odenen: d.kapali ? d.tutar : 0`) — oysa şema
`Borc.odenen` notu açıkça *"ARTIK BU SATIRLARDAN TÜRETİLİR (0017 · ADR-0010),
elle yazılmaz"* diyor. Tohum belgelenmiş bir değişmezi çiğniyordu.

Düzeltildi: tohum artık gerçek `Tahsilat` + `TahsilatTahsisi` kayıtları üretiyor,
`odenen` ve `kapandiMi` **onlardan türetiliyor**.

```
SONRA: odenen = 43.200,0000 · tahsis = 43.200,0000 · fark = 0,0000
       cari ekstre: BORÇ → TAHSİLAT → BORÇ → TAHSİLAT → BORÇ,
       her ödemeden sonra yürüyen bakiye 0, kapanış 1.950 (tek açık borç)
```

⚠️ Tahsilatlar **muhasebeleştirilmedi** (`yevmiyeFisiId` boş) ve bu bilinçli:
tahakkuk deftere düşmediği için yalnızca tahsilatı muhasebeleştirmek 120'yi
alacaklandırıp mutabakat farkını **büyütürdü**. Bkz. §I.4.

⚠️ Bütün makbuzlar NAKİT. `tahsilat_kanal_banka` CHECK kısıtı BANKA kanalında
`banka_hareketi_id` zorunlu kılıyor ve tohumda banka hesabı yok. **Kısıt doğru
çalışıyor** — gevşetilmedi, kanal daraltıldı.

#### I.3 · Hisseli mülkiyet fikstürü — ilk kez var

Ölçüm gösterdi: 12 dairenin **hepsi** tek malikti, hisse `1/1`. Yani
`borc_sorumlusu.pay` mantığı ve pay bazında tahsis kodda vardı ama **hiçbir
fikstür ona dokunmuyordu.** Üç daire hisseli yapıldı:

| Daire | Hisse | Borç 1.950 nasıl bölünüyor |
|---|---|---|
| 4 | 1/2 + 1/2 (iki kardeş) | 975,00 + 975,00 |
| 9 | 1/3 × 3 (miras) | 650,00 × 3 |
| 12 | **3/4 + 1/4** (eşit değil) | **1.462,50 + 487,50** |

Daire 12 bilerek eşit değil: eşit paylı fikstür, `pay = tutar/n` varsayan bir
hatayı yakalayamaz.

Tohuma iki kontrol eklendi (kontrol **eklendi**, gevşetilmedi):
Σ hisse ≠ 1 ise tohum **durur**; pay dağıtımında **son hissedar artığı alır** ki
`Σ pay = borc.tutar` bozulmasın. İkincisi bir dağıtım tekniğidir, yuvarlama
politikası değil — o karar tohumun işi değildir.

Doğrulama: `Σ pay ≠ tutar` olan borç sayısı **0**.

#### I.4 · ★ DUR VE BİLDİR — tahakkuk deftere hiç düşmüyor

`kontrol-mutabakati` her projede `mutabikMi:false` döner. Sebep yapısal:
`Borc` modelinde `yevmiyeFisiId` yok, tahakkukta `muhasebelestir` ucu yok.
Bu **eksik özelliktir, veri eksiği değil** — tohuma elle yevmiye fişi yazmak
ürünün yapamadığı bir şeyi demoda göstermek olurdu.
[ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) açıldı, **karar
yok**. Yol haritasında **P0** ve virmandan öncedir.

---

### J. Tahakkuk muhasebeleştirmesi + apartman/site ayrımı (2 Ağustos 2026)

[ADR-0017](docs/adr/log/ADR-0017-tahakkuk-muhasebelestirme.md) karara bağlandı
ve uygulandı; kapsamı **`CIFT_TARAFLI` muhasebedir**. Ayrımın tamamı tek
belgede: [docs/APARTMAN-SITE-AYRIMI.md](docs/APARTMAN-SITE-AYRIMI.md).

#### J.1 · Bitişin kanıtı

```json
SITE (Papatya Sitesi · CIFT_TARAFLI)
{"yardimciDefterToplami":"15600.0000","kontrolHesabiKodu":"120",
 "kontrolHesabiBakiyesi":"15600.0000","fark":"0.0000","mutabikMi":true,
 "bolumSayisi":8}
```

Önceki hâli `{"fark":"15600.0000","mutabikMi":false}` idi. Tohum artık
tahakkukları **ve** tahsilatları muhasebeleştiriyor; yalnızca biri
muhasebeleşseydi kontrol hesabı ödenen kadar sapardı.

⚠️ Tohumun ürettiği fiş, `muhasebelestir` ucunun ürettiğinin **aynı
biçimidir** (fiş türü · kaynak bağı · iki satır · `ISLENDI`). Elle yevmiye
fişi yazılmadı — tohum, ürünün yapmadığı bir şeyi göstermez.

#### J.2 · Muhasebe derinliği

`MuhasebeParametresi.muhasebeDerinligi: BASIT | CIFT_TARAFLI` (migration 0034).
Varsayılanı kurulumda `Tenant.tip`'ten gelir ama **kural değildir** —
politika koda gömülmediği gibi **yapıya da gömülmez**. `BASIT` projede
`muhasebelestir` ve `kontrol-mutabakati` **422** verir; alacak takibi
**etkilenmez**.

#### J.3 · CT-20 yanlış teşhis koyuyordu — düzeltildi

Test, her projede hesap planı + parametre + açık dönem arıyordu. `BASIT`
derinlikte bunların olmaması **eksiklik değildir**. Artık üç bölümlü ve
öznesi site tenant'ı: 12/12 yeşil.

#### J.4 · Tohumda hiç SITE yoktu

`seed.ts` içinde `tip: 'SITE'` için 0 eşleşme vardı; site tarafına kod
yazılıyordu ama **hiçbir fikstür onu temsil etmiyordu**. Papatya Sitesi
eklendi (2 blok · 8 bölüm · hisseli daire dâhil).

#### J.5 · Canlı ölçüm — her iki taraf

```json
SITE (Papatya · CIFT_TARAFLI)
{"yardimciDefterToplami":"15600.0000","kontrolHesabiBakiyesi":"15600.0000",
 "fark":"0.0000","mutabikMi":true,"bolumSayisi":8}

APARTMAN (Güzel · BASIT) → HTTP 422
{"detail":"Bu proje basit muhasebe kullanıyor; kontrol hesabı mutabakatı
 yapılmaz.","sonrakiEylem":"… Alacak takibi ETKİLENMEZ: …"}
```

#### J.6 · ★ 404 SUNUCU ARIZASI — sebep BENDİM, P0 değil

Bütün rotalar 404 veriyordu, `/api/v1/saglik` dâhil. Teşhis:

```text
[RoutesResolver] HealthController {/C:/Program Files/Git/api/v1/saglik}
```

Genel önek `/api/v1` yerine **`/C:/Program Files/Git/api/v1`** olarak
kaydedilmiş. Sebep: sunucuyu **Git Bash içinden** `set -a && . ./.env` ile
başlatmıştım; MSYS yol dönüşümü `.env`'deki `API_PREFIX="/api/v1"` değerini
Windows yoluna çevirdi.

⚠️ **Denetim raporundaki P0 giriş noktası bulgusu DEĞİLDİ ve o bulgu şu an
yeniden üretmiyor:** `backend/dist/main.js` var ve taze, `dist/src/main.js`
yok. `config-check.mjs` bunu zaten kapı olarak doğruluyor
(*"Giris noktasi dogrulandi: backend/dist/main.js"*).

★ **Ders:** Windows'ta bir Node sunucusunu Git Bash'ten ortam yükleyerek
başlatmayın; eğik çizgiyle başlayan değerler sessizce yola çevrilir. Hata
mesajı vermez — rota tablosu bozulur.

#### J.7 · ★★ `pnpm verify` UYGULAMA KODUNU HİÇ TİP DENETİMİNDEN GEÇİRMİYORDU

Bu turda üç gerçek hata (`FIS_TURLERI`/`FisTuru` `TAHAKKUK` taşımıyor, gider
türü ucu zorunlu `muhasebeHesapId`'yi vermiyor) **`pnpm verify` YEŞİLKEN**
geçti ve ancak sunucu yeniden başlatılınca ortaya çıktı.

**Sebep ölçüldü:**

| Ne | Kapsam |
|---|---|
| Kök `tsconfig.json` → `references` | **yalnızca `shared/*`** — `backend` grafikte YOK |
| `verify` adımı *"TypeScript derleme (tsc -b)"* | kök grafiği derler → uygulama kodunu **görmez** |
| `verify` adımı *"Test derlemesi"* | `tests/tsconfig.json` → framework bağımsız modüller |
| Vitest | tip denetimi **yapmaz** |
| CI `pnpm typecheck` → `pnpm -r typecheck` | backend `tsc --noEmit` — **yakalardı** |

Yani **yerel kapı ile CI aynı şeyi ölçmüyordu.** Adın *"TypeScript derleme"*
olması bütün deponun tarandığı izlenimi veriyordu; taramıyordu.

**Kapatıldı.** `verify` artık uygulama paketlerini de tarıyor ve **liste elle
yazılmadı, TÜRETİLDİ**: workspace desenlerinden paketler bulunur,
`typecheck` betiği `--noEmit` içerenler taranır (`tsc -b` kullananlar kök
grafikte zaten var). Yeni bir paket eklendiğinde sessizce dışarıda kalmaz.

```text
GECTI      Tip denetimi — backend
GECTI      Tip denetimi — frontend/mobile
GECTI      Tip denetimi — frontend/web
GECTI      Tip denetimi — database
```

⚠️ `pnpm -r typecheck` çağrılmadı: `pnpm` Windows'ta `.cmd` shim'idir ve
`execFileSync` onu kabuk olmadan çalıştıramaz — denendi, adım **boş çıktıyla**
başarısız oluyordu.

**Negatif test yapıldı** (kapı gerçekten yakalıyor mu):

```text
FIS_TURLERI'den 'TAHAKKUK' geçici olarak kaldırıldı
  →  BASARISIZ  Tip denetimi — backend
dosya yedekten geri alındı (git checkout -- KULLANILMADI)
```

★ **Ders — "güvence mekanizmasının kendisi doğrulanmamış" sınıfının yeni
örneği.** Bir kapının adı, neyi kapsadığının kanıtı değildir. Bu oturumda
aynı sınıf dört kez çıktı: RLS politikaları hiç sınanmamıştı, CI iş akışı hiç
koşmamıştı, `Idempotency-Key` okunmuyordu, ve şimdi tip kapısı uygulama
kodunu görmüyordu. **Yeni bir kapı eklendiğinde negatif testi de eklenmeli:
kapıyı bilerek ihlal et, kırmızıya döndüğünü gör, geri al.**

#### J.8 · ★ CT-04 tam süitte kırmızı — sebebi CT-19

```text
virman HARİÇ süit  →  104/104 YEŞİL
tam süit           →  CT-04 kırmızı + CT-19'un 14 beklenen kırmızısı
```

Sebep **CT-19'un uygulanmamış olmasıdır**. Elenenler: istek sınırı (Redis
boşaltılıp tekrarlandı), eşzamanlılık (`--no-file-parallelism` ile de düştü),
ikili kombinasyonlar (virman+oturum tek başına geçiyor).

**Virman bittiğinde kapanması bekleniyor — kapanmazsa ayrı bulgu olarak
açılacak.** `it.skip` konulmadı, CT-04 gevşetilmedi.

★ Yan bulgu: giriş ucu **e-posta başına 5 deneme / 5 dk** sınırlıyor
(`oturum.controller.ts:23`). CT-20'ye eklenen ikinci giriş önce tohum
kullanıcısını kullanıyordu ve CT-04'ün bütçesini tüketiyordu. **Paylaşılan
kimlik, paylaşılan fikstürdür** — CT-20 artık kendi kullanıcısını açıyor.

---

## 4. Sonraki oturum — ilk komut ve ilk görev

```bash
pnpm db:up && pnpm db:status && pnpm verify && pnpm test:contract
```

Beklenen: `14 migrations found` · `Database schema is up to date` ·
`Tum kontroller yesil` · `24 passed`.

Docker Desktop kapalıysa önce başlatılmalı:
`C:\Users\HP\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`

### ✅ Önceki ilk görev TAMAMLANDI

§3.G'deki iki düzeltme uygulandı ve doğrulandı (ayrıntı: **§3.H**). Kabul
ölçütü karşılandı: uygulama beyan edilen yoldan ayağa kalkıyor, `/saglik` 200
dönüyor, giriş ucu 6. denemede 429 + `Retry-After` veriyor.

### ⚠️ AÇIK İŞ — satır kapsamı (31 Temmuz, oturum ortasında kesildi)

**Durum: kod ve migration YAZILDI ve UYGULANDI; 0025 sonrası testler
KOŞULMADI.** Sonraki oturumun ilk işi budur.

#### Tamamlananlar

| İş | Durum |
|---|---|
| CT-13 `satir-kapsami.spec.ts` (14 test) | ✅ yazıldı · 0024'e kadar yeşil |
| CT-14 `kapsam-kenar-durumlari.spec.ts` (12 test) | ✅ yazıldı · 0024'e kadar yeşil |
| Migration 0022 — kapsam ekseni, 15 RESTRICTIVE politika | ✅ uygulandı |
| Migration 0023 — kiraya verilen mülkte yalnızca borç/ödeme | ✅ uygulandı |
| Migration 0024 — hisseli mülkiyette yalnızca kendi payı | ✅ uygulandı |
| Migration 0025 — InitPlan sarmalama | ✅ uygulandı |
| `docs/SATIR-KAPSAMI-KANITI.md` — 55 tablonun kapsam envanteri | ✅ |
| Git geçmişi sızıntı taraması (67 commit) | ✅ **temiz** |

#### 🔴 0025 SONRASI TESTLER KOŞULMADI

50 sözleşme testi **0024 durumunda** yeşildi. `0025_kapsam_initplan`
politika ifadelerini yeniden yazdı ve **ondan sonra hiçbir test koşulmadı**.
İlk iş: `pnpm test:contract` → 50/50 beklenir. Kırmızı çıkarsa DUR ve bildir.

#### ⚠️ `= ANY ((SELECT dizi))` YAZILAMAZ — 42883

Talimatta yazılan biçim PostgreSQL'de **çalışmaz**:

```sql
id = ANY ((SELECT app_kapsam_kisileri()))
-- ERROR 42883: operator does not exist: uuid = uuid[]
```

PostgreSQL bunu *alt sorgu biçimi* sanıp `uuid = uuid[]` operatörü arar.
0025'te kullanılan geçerli biçim:

```sql
id IN (SELECT unnest(app_kapsam_kisileri()))
```

Bu da amaca ulaşır: plan `hashed SubPlan` üretir, fonksiyon sorgu başına
**bir kez** çalışır. Skaler çağrılar (`app_kapsam_serbest`,
`app_kapsam_kisi_id`) `(SELECT f())` ile sarılabilir ve InitPlan olur.

#### Ölçüm — 0025 öncesi/sonrası (uygulama rolü `bnos_app`)

Sentetik: 5.000 bağımsız bölüm · 5.000 kişi · 5.000 malik.

| Senaryo | Execution ÖNCE | SONRA | Buffers ÖNCE | SONRA |
|---|---|---|---|---|
| Kısıtsız | 0,295 ms | 1,474 ms | 54 | 54 |
| 1 daireli malik | 280,483 ms | 12,700 ms | 15.194 | 5.023 |
| 200 daireli malik | **39.227 ms** | **10,639 ms** | **545.390** | **1.709** |
| 5.000 daireli malik | 10 dk'da bitmedi | ölçülemedi (çıktı kesildi) | — | 10.057 |

Plan artık `InitPlan 1/2` + `hashed SubPlan 3` düğümlerini gösteriyor.
Kısıtsız yol 0,295 → 1,474 ms yavaşladı (InitPlan yöneticide de kuruluyor);
mutlak değer küçük ama gerçek.

`set_config` boyutu **değişmedi**: 200 daire = 7.399 bayt, 5.000 daire =
184.999 bayt.

#### Ürün sahibi kararları (bu oturumda alındı)

| Konu | Karar |
|---|---|
| Reşit olmayan | Yalnızca **başka hane** gizlenir; veli kendi çocuğunu görür |
| KİRACI bina finansı | Yeni izin `FINANS_BINA_OZET` — MALİK'te var, KİRACI'da yok |
| Kiraya verilen mülk | Malik yalnızca **borç + ödeme** görür (KMK md. 22) |
| Hisseli mülkiyet | Her malik **yalnızca kendi payını** görür (0024) |
| Çok rollü kişi | Birleşim korunur — bir rolü kısıtsızsa kapsam kurulmaz |
| SECURITY DEFINER (Adım 2) | ❌ **GERİ ÇEKİLDİ** — ADR-0002 ile çelişiyor |
| Ayar boyutunu küçültme | ❌ şimdilik yapılmayacak |

#### Sonraki oturumun sırası

1. `pnpm test:contract` — 50/50 doğrula (0025 sonrası ilk koşu).
2. Ölçümü tekrarla: 30 kişi · 5.000 kişi · 200 daireli malik. 5.000 daireli
   senaryonun `Execution Time`'ı **hâlâ eksik**.
3. **Analiz soruları** (§ aşağıda) yanıtlandı; kararı ürün sahibi verecek.
4. Veri temizliği: `prisma migrate reset` + seed. Ters kayıt KULLANILMAZ —
   yerel fikstür muhasebe kaydı değildir.
5. Ters kayıt / soft delete / toplu geri alma için **ayrı** testler.
6. CI kilitleme ve README:151 — politika DDL'i durulana kadar **beklemede**.

#### Veritabanında duran artıklar

- `perf-5000` tenant'ı (5.000 bölüm · 5.000 kişi · 5.000 malik)
- `malik-test@guzel-apartmani.test` kullanıcısı
- 2026-03 dönemi tahakkuku (4 borç kaydı)
- CT-13/CT-14 tenant'ları (denetim kaydı olanlar silinemedi — trigger)

Hepsi `migrate reset` ile gidecek. Veritabanı **yerel**, paylaşımlı değil.

#### 🔴 Depo PUBLIC

`90d085b` · `e7543f7` · `3220c3b` commit'leri kapatılmamış açığın tarifini
yayımladı. Ürün sahibi depoyu private yapacağını bildirdi. Geçmiş
**yeniden yazılmayacak** (önbellek ve çatallar kalır); sızmış bir sır
bulunmadığı için iptal edilecek anahtar da yok.

### L. CI yeşile döndü · virman analizi (1–2 Ağustos 2026)

**CI ilk kez koştu ve tam yeşile döndü.** Depo kurulduğundan beri hiç
çalışmamıştı; tetikleyicide `master` yoktu. Beş turda beş ayrı sınıf arıza
çıktı — ayrıntı ve **ortak sebep** [`YOL-HARITASI.md`](YOL-HARITASI.md)
"Çürütülen varsayımlar" bölümündedir.

Son durum (koşu `f7aeacf`): `mimari` ✅ · `belge` ✅ · `migration` ✅ ·
`kalite` ✅ — sözleşme testleri **uygulama rolüyle** koşuyor, yani CT-01
gerçekten RLS'i sınıyor.

**Kalıcı kapılar (hepsi bozukken kırmızı verdiği görülerek eklendi):**

| Kapı | Ne yakalar |
|---|---|
| `config-check` · Node sürümü | `.nvmrc` · `engines` · iş akışları ayrışırsa |
| `scripts/test-onkosul.mjs` | derlenmiş çıktı yoksa `ERR_MODULE_NOT_FOUND` yerine açık mesaj |
| `scripts/env-sozlesme-check.mjs` | şemadaki zorunlu anahtar `.env.example`'da yoksa |
| CI `migration` işi | zincir boş veritabanına uygulanamıyorsa · reset geri düşüşe girerse |
| `.github/actions/kosu-ve-raporla` | hata metnini `::error::` olarak yayınlar — log admin ister, annotation istemez |

**Tohum artık demo fikstürüdür.** CI'ın kullandığı veri ile sunumda
gösterilecek veri **aynı**: 12 daire, söylenebilir isimler, 3 kiracı,
3 dönem tahakkuk geçmişi, 12 açık ve vadesi geçmiş borç (23.400 TL).
Giriş: `yonetici@guzel-apartmani.test` / `bnos1234`.

**Virman analizi** — kod yazılmadı, [ADR-0016](docs/adr/log/ADR-0016-virman.md)
taslağı açıldı. Dört tür ayrıldı (A kasa/banka · B hesap · C cari ·
D kalem bazlı tahsis) ve taramadan çıkan bulgular:

- ⚠️ **Banka↔banka virmanın iki bacağı BAĞIMSIZ muhasebeleşiyor.** Biri
  deftere girip öteki girmezse para kaybolmuş görünür, mizan tutmaz.
  Öneri: virman anında **tek fiş**; karar bekliyor.
- Kasa ayrı bir varlık değil (hesap planı kalemi) — **kasa↔banka yolu yok**.
- **Elle kalem tahsisi zaten asıl yoldur**; otomatik FIFO yalnızca öneri ve
  hiçbir şey yazmıyor. D'nin eksiği motor değil **arayüz**.
- **İleri dönem tahakkuku bugün mümkün** (tek tarih kuralı `vade >= donem`).
- **`YevmiyeFisi`'nde belge tarihi alanı yok** — dayanak bilgisi serbest
  metne sıkışıyor.

ADR-0015'teki dönem kilidi sorusu düzeltildi: **mekanizma var ve çalışıyor.**
Yenileme fonunun amaca özgülüğü (KMK md. 72) §3.E'deki C-4 listesine eklendi.

### İLK GÖREV — sırada ne var (3 Ağustos 2026)

CI yeşil, demo fikstürü hazır. Sıradaki üç iş:

1. **ADR-0016 · B ve C soru listeleri.** Bölümler açık, taramadan çıkan
   girdiler içinde, ama ürün sahibinin soru listeleri **gelmedi**. Ayrıca
   onay bekleyen üç karar var: sebep kodu başlangıç listesi, `DIGER` kodu
   olsun mu, virmanın taslak kalabilmesi.

2. **★ Virmanın iki bacağının bağımsız muhasebeleşmesi.** ADR-0016 §A'daki
   açık hata — para kaybolmuş görünüyor. Öneri "tek fiş" yazılı, karar
   bekliyor. Karar çıkınca bu bir P0 düzeltmesidir.

3. **Demo ekranı.** D bölümünün eksiği motor değil arayüz. Üç aday:
   Tahakkuk Sihirbazı · `/belgeler` (menüde ölü link) · Sakin paneli.
   Hangisinin önce yapılacağı seçilmedi.

**Yapısal borç, arka planda duruyor:** yerelde Linux yok. Beş CI arızasının
beşi de yerelde görünemezdi. WSL2 kurulu ama boş; kapanmazsa altıncısı da
CI'da bulunacak.

Daha önce sıraya alınmış ve **hâlâ açık** olanlar: kapsam önbelleği TTL
güvenlik doğrulaması (A0.7'deki 17. negatif testin hangi yolu ölçtüğü),
ADR-0013 partileme kararı, kapsam kurulumunun O(tenant) maliyeti,
`yalnizcaKendiVerisi` uçlarının kalan denetimi, şema↔migration sürüklenmesi
(P1), imaj duman testi.

### Muhasebe/Banka talebinin EKSİK KALAN bölümleri

Kullanıcı 10 bölümlük bir liste verdi (~100+ ekran). Bu commit **1. bölümün
çekirdeğini** tamamladı; geri kalanı aşağıda. Sıralama bağımlılığa göredir:
analiz/liste/ekstre/döküm ekranlarının hepsi muhasebe çekirdeğinin ve banka
modülünün üstüne kurulur.

| Bölüm | Durum |
|---|---|
| **1. Muhasebe** | ✅ çekirdek tamam (fiş · hesap planı · 3 defter · mizan · parametre · 6 kapanış işlemi) · ❌ Muhasebe Raporları (bkz. 6) |
| **2. Banka Yönetimi** (17 alt modül) | ✅ **çekirdek tamam** (0016) — banka · şube · hesap · POS/sanal POS · hareket (havale/EFT/FAST/virman/masraf/faiz/POS) · ekstre · mutabakat · çek/senet · parametre. **API tam, EKRAN YOK** (kullanıcı talimatı) |
| **3. Muhasebe Analizleri** (11 ekran) | ❌ yok. Ödeme skorları `borc` + `borc_sorumlusu` üzerinden türetilebilir; nakit akışı artık **banka hareketlerinden türetilebilir** (ön koşul kalktı) |
| **4. Listeler** (14 ekran) | ⚠️ veri temeli var (`borc` · `Malik/Kiraci/Sakin` · mizan), ekran yok. Makbuz numaralandırma serileri hazır |
| **5. Ekstreler** (7 ekran) | ⚠️ **Muavin bunun motoru**: cari/kasa/banka/genel hesap ekstresi `muavin` ucunun farklı hesap seçimleridir. Personel ve site sakini ekstresi cari hesap kavramı ister (henüz yok) |
| **6. Dökümler** (7 döküm) | ⚠️ **Mizan ✅ · Muavin ✅** · Bilanço · Gelir Tablosu · Fiş dökümü · Hesap planı dökümü · Gelir-gider muavini ❌ |
| **7. Grafikler** (7 grafik) | ❌ yok. `dataviz` yönergesi izlenmeli; veri kaynakları (3) ve (6)'ya bağlı |
| **8. İletişim** (9 ekran) | ⚠️ veri var (kişi · araç · misafir giriş-çıkış · personel), ekran/çıktı yok |
| **9. Evrak Yönetimi** | ⚠️ **Belge modülü tam** (versiyonlama · kategori · gizlilik · önizleme · KVKK · MinIO). 0015 `YEVMIYE_FISI` + `MUHASEBE_DONEMI`, 0016 `BANKA_HAREKETI` + `BANKA_EKSTRESI` + `KIYMETLI_EVRAK` ekledi; **cari hesap ilişkisi FAZ 2'de**. `/belgeler` EKRANI hâlâ yok |
| **10. Genel Özellikler** | ⚠️ Audit ✅ (hash zincirli) · Yetkilendirme ✅ (Üç Kapı) · Listeleme/arama/filtreleme/sıralama ✅ · Sayfalama ⚠️ (limit var, cursor yok) · Yazdırma ✅ (`@media print`) · **Excel/PDF aktarma ❌ kütüphane kararı bekliyor** · Toplu işlem ⚠️ kısmî · İşlem geçmişi ⚠️ audit'ten okunuyor, ekranı yok |

**Neden hepsi yapılmadı:** ~100 ekranı tek oturumda üretmek, kullanıcının kendi
koyduğu iki kurala aykırı olurdu — *"Gereksiz tekrar eden ekran oluşturma"* ve
*"Kod kalitesini düşürme"*. Muhasebe çekirdeği seçildi çünkü 3 · 4 · 5 · 6 · 7
bölümlerinin **tamamı** onun okuma modelleridir; çekirdek yanlışsa yüz ekran da
yanlış olur.

**Önerilen sıra:** ~~(a) Banka Yönetimi çekirdeği~~ ✅ **bu commit** ·
**(b) Cari hesap kavramı** — 4 ve 5'in ön koşulu · (c) Bilanço + Gelir Tablosu
(mizandan türetilir) · (d) Excel/PDF kütüphane kararı, sonra tüm dökümler ·
(e) Analizler ve grafikler · (f) `/belgeler` ve İletişim ekranları ·
(g) **ekranların toplu üretimi** — bağımlılık sırasına göre, her toplu grup
kendi içinde çalışır durumda.

---

## Mimari-öncelikli plan — nerede kaldık

Kullanıcının onayladığı sıra: *"Finish the shared platform and domain
foundation first… When the platform foundation is complete, automatically start
generating the remaining screens batch by batch."*

| Faz | Kapsam | Durum |
|---|---|---|
| **FAZ 1** | Banka Yönetimi çekirdeği (0016 · domain · CQRS servisleri) | ✅ **tamam** — 91/91 canlı |
| **FAZ 2** | **Cari hesap** — karar (ADR-0010) · 0017 · domain | ⚠️ **YARIM** — aşağıda |
| FAZ 3 | Bilanço + Gelir Tablosu (mizandan türetilir) | bekliyor |
| FAZ 4 | Excel/PDF kütüphane kararı + aktarma altyapısı | bekliyor |
| FAZ 5+ | Ekranların toplu üretimi (bağımlılık sırasına göre) | bekliyor |

### FAZ 2 — cari hesap: karar VERİLDİ (ADR-0010), asıl eksik başkaydı

Mimari soru — *cari, `hesap` ağacının altına mı yoksa ayrı bir `cari` tablosuna
mı?* — **referans belgelerde cevaplıydı.** Kullanıcıya sorulmasına gerek
kalmadı:

> **Debt follows the unit, not the person.** … The data model therefore attaches
> the receivable to the **Daire**, with the responsible party recorded separately
> and historically. — `07-Finance-Spec` §128
>
> **The critical relationship:** `Receivable → Daire`, not
> `Receivable → Resident`. — §561
>
> `GET /statements/{unitId}` — **Unit** statement · `unit balance = Σ
> receivables − Σ allocations`

Referans prototipinde de yevmiye satırı **`120 Alıcılar (Daire Cari)`** —
cari hesabın **birimi dairedir.** BNOS bunu zaten uygulamış: `borc.bolum_id`
zorunlu, `borc_sorumlusu` tarihsel snapshot.

**Karar** ([ADR-0010](docs/adr/log/0010-cari-hesap-bolum-yardimci-defteri.md)):
cari hesap ayrı bir varlık değil, **kontrol hesabı `120` ile mutabık olan bölüm
bazlı yardımcı defterdir.** Kişi ekstresi bir **görünümdür**
(`borc_sorumlusu` süzgeci), ayrı defter değil. Yardımcı defter ↔ kontrol hesabı
uyuşmazlığı **dönem kapanışını bloke eder.**

#### Karar netleşince görünen GERÇEK eksik: `tahsilat` tablosu YOK

Ödeme bilgisi bugün yalnızca `borc.odenen` ve `borc_sorumlusu.odenen`
kolonlarında **yürüyen bir toplam**. Sonuçları:

- **Ekstre üretilemez** — ekstre "borç satırı · ödeme satırı · yürüyen bakiye"
  ister; ödeme satırı diye bir kayıt yok.
- **Tahsis izlenemez** — bir ödeme birden çok borcu kapatabilir; hangisine ne
  kadar gittiği kayıtsız.
- **Denetlenemez** — `odenen` bir UPDATE ile artıyor; kim, ne zaman, hangi
  kanaldan tahsil etti belli değil. Bu FİNANSAL kayıttır ve BFS v1 §5.1
  uyarınca değiştirilemez olmalıydı.
- **Makbuz numarası bağlanamaz** — boşluksuz seri hazır ama bağlanacak ödeme
  kaydı yok.
- **Banka mutabakatı yarım kalıyor** — 0016 ile aidat tahsilatı arasında bağ
  yok; para hesaba girdi ama hangi borcu kapattığı kayıtsız.

> ⚠️ `odenen` kolonu, ödeme kaydı olmadan da **doğru görünür.** Toplam tuttuğu
> için ödeme geçmişinin var olduğu sanılır; oysa yoktur. Eksiklik ancak ekstre
> üretmeye çalışınca ortaya çıkar.

**FAZ 2 kapsamı:** (1) `tahsilat` — FİNANSAL, silinmez; kanal · makbuz no ·
`banka_hareketi_id?` · `yevmiye_fisi_id?` · (2) `tahsilat_tahsisi` — Σ tahsis =
tahsilat tutarı; `borc.odenen` bundan **türetilir**, elle yazılmaz ·
(3) bölüm cari ekstresi · (4) kişi ekstresi (aynı motor, süzgeç) ·
(5) yardımcı defter ↔ kontrol hesabı mutabakat denetimi.

#### Makbuzlar talebinden KARŞILANMAYANLAR — açıkça eksik

Kullanıcı 17 alt modül istedi. Karşılanan: **Tahsilat Makbuzu · Detaylı
Tahsilat Girişi · Makbuz İptali · Makbuz Geçmişi** (+ Makbuz Yazdır yalnızca
tarayıcı yazdırması). Karşılanmayanlar ve **nedenleri**:

| İstenen | Neden yapılmadı |
|---|---|
| **PDF Oluştur** (otomatik) | PDF kütüphanesi kararı verilmedi (FAZ 4). Ekran şu an `window.print()` kullanır — gerçek PDF değildir ve öyle sunulmuyor |
| **E-posta · SMS · WhatsApp** | Bildirim altyapısı **yok**. Ayrıca ticari elektronik ileti **İYS kapsamı belirsiz** ve bu, belgelerde açık bir bloke (`04-CAKISMA-KAYDI.md` C-6). Sağlayıcı seçilmeden gönderim yazmak, mevzuata aykırı ileti üretebilirdi |
| **İade Makbuzu** | İade kavramı TANIMSIZ. ADR-0010 negatif tahsilatı yasakladı; iade ayrı bir kayıt tipi ve karşılık hesabı ister. Uydurmak yerine bırakıldı |
| **Borç Makbuzu · Toplu/Otomatik Borçlandırma · Gider/Gelir Dağıtımı** | Bunlar **tahsilat değil TAHAKKUK** işlemleridir ve `TahakkukModule`'e aittir (API var, ekran yok). Makbuz modülüne kopyalamak aynı dağıtım mantığını ikinci kez yazmak olurdu |
| **Devir Bakiye Girişi** | Muhasebe **açılış fişi** ile yapılır (`DonemServisi.acilisFisiUret` mevcut). Cari devir bakiyesi için ayrı bir akış gerekir; kontrol hesabı mutabakatını bozmadan yazılmalı |
| **Toplu Tahsilat** | Tek tahsilat çekirdeği yeni oturdu. Toplu akış, kısmî başarısızlıkta ne olacağına (hepsi mi geri alınır) dair karar ister |
| **Makbuz versiyonlama** | Makbuz İPTAL edilir, sürümlenmez (VUK: numara korunur). "Versiyon" isteniyorsa Belge modülü zaten sürümlüyor; makbuz PDF'i oraya `varlikTipi = TAHSILAT` ile bağlanabilir — 0017 bu enum değerini ekledi |
| **Geri Al arayüzü** | Backend tamam (`/geri-alma`), ekran yok |

#### FAZ 2 nerede kaldı — YARIM, kalan iş net

| Katman | Durum |
|---|---|
| **ADR-0010** — cari = bölüm yardımcı defteri | ✅ yazıldı, commit edildi |
| **Migration 0017** — `tahsilat` + `tahsilat_tahsisi` + `CARI_KONTROL` | ✅ **uygulandı** (48 tablo, RLS taraması temiz) |
| **Prisma modelleri** + 7 ters ilişki + client | ✅ tamam |
| **Domain** `shared/apartman-domain/src/tahsilat` | ✅ tamam — **32 birim testi** |
| **Backend `modules/tahsilat`** | ⚠️ **YALNIZCA DTO yazıldı.** Servisler · controller · module YOK |
| Canlı test | ❌ yapılamadı (uç yok) |

**Sıradaki oturumun ilk işi — `backend/src/modules/tahsilat/` tamamlamak.**
DTO hazır (`dto/tahsilat.dto.ts`); yazılacaklar:

1. `tahsilat.command.service.ts`
   - `ekle` — `tahsilatiDogrula` + `tahsisleriDogrula`, makbuz no
     `NumaraServisi.tahsisEt(tx, {seriKodu: 'MAKBUZ'})`, tahsis satırları,
     **ardından `borc.odenen` ve `borc_sorumlusu.odenen` YENİDEN HESAPLANIR**
     (Σ tahsis) — asla `increment` ile artırılmaz.
   - `iptal` — `tahsilatIptalEdilebilirMi` (muhasebeleşmişse RED), tahsisler
     silinir, `odenen` yeniden hesaplanır, `durum = IPTAL` + gerekçe.
   - `muhasebelestir` — `FisCommandServisi.ekleIslemde` ile **aynı
     transaction'da** (banka modülündeki desen). Borç tarafı kanala göre:
     NAKIT → `varsayilanKasaHesapId`, BANKA/POS → banka hareketinin hesabı ya
     da `varsayilanBankaHesapId`. Alacak tarafı **`ozellik = CARI_KONTROL`**
     hesabı. CEK/SENET/MAHSUP için hesap tanımı yok → **açık hata mesajıyla
     reddedilmeli**, uydurma hesap seçilmemeli.
2. `cari.query.service.ts` — `cariEkstre` (bölüm), kişi ekstresi
   (`borc_sorumlusu` süzgeci), `alacakYaslandirmasi`, `otomatikTahsis`
   önizlemesi (**YAZMAZ**), `kontrolMutabakati`.
3. `tahsilat.controller.ts` + `tahsilat.module.ts` (+ `app.module.ts` kaydı).
   Yetki: okuma `FINANS_BORCLU_DETAY`/`FINANS_DEFTER_GORUNTULE`, yazma
   `FINANS_TAHSILAT`, makbuz `FINANS_MAKBUZ`, muhasebeleştirme
   `FINANS_YEVMIYE_GIRIS`.
4. `DonemServisi.kapat` içine **kontrol mutabakatı bloğu**: uyuşmazlık
   kapanışı engeller (ADR-0010).

> ⚠️ Domain kuralları hazır ve testli ama **hiçbir uçtan çağrılmıyor.** Bu
> durum 0004/0005'te yaşananın aynısıdır: kural katmanı var, kalıcılık var,
> arada uç yok. `git grep tahsisleriDogrula` bugün yalnızca testte eşleşir.

**Kapsam dışı ve açıkça eksik:** tedarikçi carisi, personel bordro/avans
defteri, `120` kontrol hesabının `HesapOzelligi` ile işaretlenmesi. Bunlar
ADR-0010'da bekleyen karar olarak kayıtlı — **uydurma veriyle ekran
üretilmeyecek.**

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
