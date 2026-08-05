# ADR-0010 · Cari hesap = **bağımsız bölüm yardımcı defteri**, kişi carisi değil

**Kapsam:** [ORTAK] — Cari birimi = bagimsiz bolum karari her iki tarafta da gecerlidir; borc ve borc sorumlusu BASIT projede de bolume baglanir. ⚠️ Kontrol hesabi mutabakati yalnizca CIFT_TARAFLI projede anlamlidir — o SONUC [SITE].
**Tarih:** 30 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** uygulama (FAZ 2 önkoşulu)
**İşlendiği belge:** BFS v1 §11 (para) · DMS v1 (Borç aggregate)
**Dayandığı referans:** `docs/reference/specs/07-Finance-Spec-STEP-1-8.md`
**Uyguladığı karar:** [ADR-0003](0003-muhasebe-cift-tarafli.md) ·
[ADR-0007](0007-para-tipi-bigint.md)

## Bağlam

Kullanıcının Muhasebe/Banka talebinin **4. bölümü (Listeler)** ve **5. bölümü
(Ekstreler)** "cari hesap" kavramını gerektiriyor: *cari hesap ekstresi*,
*personel ekstresi*, *site sakini ekstresi*, *genel hesap ekstresi*.

Sorulacak mimari soru şuydu: cari, `hesap` ağacının altına bir alt hesap olarak
mı (`120.01.001 = Ahmet Yılmaz`) yoksa ayrı bir `cari` tablosuna mı kurulacak?

**Soru referans belgelerde CEVAPLIDIR**; yeni bir mimari icat edilmesine gerek
yoktur:

> **Debt follows the unit, not the person.** Under KMK m.22 the malik is liable;
> a departing tenant does not extinguish the unit's arrears. The data model
> therefore attaches the receivable to the **Daire**, with the responsible party
> recorded separately and historically.
> — 07-Finance-Spec §128
>
> **The critical relationship:** `Receivable → Daire`, not
> `Receivable → Resident`. Debt follows the unit under KMK m.22; the liable
> party is recorded on the line and historically, so a tenant change never
> orphans or extinguishes arrears.
> — 07-Finance-Spec §561
>
> `GET /statements/{unitId}` — Unit statement
> — 07-Finance-Spec, uç tablosu #15
>
> unit balance = Σ receivables − Σ allocations
> — 07-Finance-Spec, bütünlük kuralları

Referans prototipi de aynı şeyi söylüyor: yevmiye satırı
`120 Alıcılar (Daire Cari)` — cari hesabın **birimi dairedir**
(`docs/reference/prototypes/bn-finance.html`).

Mevcut BNOS şeması bu kararı **zaten uygulamış**: `borc.bolum_id` zorunludur ve
`borc_sorumlusu` sorumluları çözümleme tarihiyle **snapshot** olarak tutar
(ADR v1.1 §5).

## Karar

**Cari hesap AYRI BİR VARLIK DEĞİLDİR.** Cari hesap, kontrol hesabı `120`
(Alıcılar) ile mutabık olan **bağımsız bölüm bazlı yardımcı defterdir**
(subledger).

1. **Cari hesabın birimi `bagimsiz_bolum`dur.** Kişi bazlı cari
   tablosu AÇILMAZ.
2. **Kişi ekstresi bir GÖRÜNÜMDÜR**, ayrı defter değildir: kişinin
   `borc_sorumlusu` üzerinden bağlı olduğu bölüm satırları süzülerek üretilir.
   Sorumluluk snapshot'ı tarihseldir; kiracı değişse geçmiş ekstre değişmez.
3. **Yardımcı defter kontrol hesabıyla MUTABIK OLMAK ZORUNDADIR.**
   Σ (bölüm bakiyeleri) = `120` hesabının mizan bakiyesi. Uyuşmazlık **dönem
   kapanışını bloke eder** (07-Finance-Spec §377: *"Close blocks on…
   subledger-to-control disagreement"*).
4. **Tedarikçi/personel carisi ayrı bir karardır** ve bu ADR'nin kapsamı
   dışındadır. Kullanıcının istediği "personel ekstresi" bir bordro/avans
   defteri ister; `site_personeli` tablosu vardır ama bordro defteri yoktur.
   Bu, FAZ 2'de **kapsam dışı** bırakılır ve açıkça eksik olarak raporlanır —
   uydurma veriyle ekran üretilmez.

## Bu kararın ortaya çıkardığı GERÇEK eksik

Karar netleşince asıl boşluk göründü: **`Tahsilat` (ödeme) tablosu YOK.**

Bugün ödeme bilgisi yalnızca `borc.odenen` ve `borc_sorumlusu.odenen`
kolonlarında **yürüyen bir toplam** olarak duruyor. Sonuçları:

- **Ekstre üretilemez.** Ekstre "borç satırı · ödeme satırı · yürüyen bakiye"
  ister; ödeme satırı diye bir kayıt yok. Yalnızca toplam var.
- **Tahsis (allocation) izlenemez.** Bir ödeme birden çok borcu kapatabilir
  (07-Finance-Spec: *"Payment + allocations"*). Hangi ödemenin hangi borca ne
  kadar gittiği bilinmiyor.
- **Denetlenemez.** `odenen` bir UPDATE ile artıyor; kim, ne zaman, hangi
  kanaldan tahsil etti sorusunun cevabı yok. Bu bir FİNANSAL kayıttır ve
  BFS v1 §5.1 uyarınca değiştirilemez olmalıydı.
- **Makbuz numarası bağlanamaz.** `NumaraServisi` boşluksuz seri üretiyor ama
  makbuzun bağlanacağı bir ödeme kaydı yok.
- **Banka mutabakatı yarım kalıyor.** `banka_hareketi` (0016) ile aidat
  tahsilatı arasında bağ yok; para hesaba girdi ama hangi borcu kapattığı
  kayıtsız.

> ⚠️ `odenen` kolonu, ödeme kaydı olmadan da **doğru görünür**. Toplam
> tutuyor diye ödeme geçmişinin var olduğu sanılır; oysa yoktur. Eksikliği
> ancak ekstre üretmeye çalışınca ortaya çıkar — tam olarak bu ADR'de olduğu
> gibi.

## Sonuç — FAZ 2 kapsamı

1. `tahsilat` tablosu — FİNANSAL sınıf, silinmez; kanal (nakit · banka · POS ·
   çek/senet), tutar, tarih, makbuz no (boşluksuz seri), `banka_hareketi_id?`
   (0016 ile bağ), `yevmiye_fisi_id?`.
2. `tahsilat_tahsisi` — bir ödemenin hangi borca ne kadar gittiği. Σ tahsis =
   tahsilat tutarı (CHECK/servis kuralı). `borc.odenen` bundan **türetilir**,
   elle yazılmaz.
3. Bölüm cari ekstresi — borç + tahsis satırları, yürüyen bakiye.
4. Kişi ekstresi — aynı motorun `borc_sorumlusu` süzgeci.
5. Yardımcı defter ↔ kontrol hesabı mutabakat denetimi; dönem kapanışında
   bloke eder.

**Kapsam dışı ve açıkça eksik:** tedarikçi carisi, personel bordro/avans
defteri, `120` kontrol hesabının tenant başına parametreleştirilmesi (bugün
hesap kodu tenant'a göre değişir — kontrol hesabı `HesapOzelligi` ile
işaretlenmeli, koda gömülmemeli; §33 kural 3).

## Alternatifler ve neden reddedildi

**(a) Kişi bazlı `cari` tablosu.** KMK md. 22'ye aykırı: borç bölüme aittir.
Kiracı taşındığında borcu "kapanmış" görünürdü ve malikin sorumluluğu kaybolurdu.
Referans belge bunu açıkça yasaklıyor.

**(b) `hesap` ağacına kişi başına alt hesap (`120.01.001`).** Her yeni malik
hesap planını büyütür; 400 daireli bir sitede hesap planı 400 satır uzar ve
mizan okunamaz hâle gelir. Ayrıca hesap kodu değişmez (ADR-0003), kişi ise
değişir — kiracı çıktığında hesabı silinemez, ölü kod olarak kalır.

**(c) Ödemeyi `borc.odenen` ile taşımaya devam etmek.** Bugünkü durum. Ekstre
üretilemez, tahsis izlenemez, denetim izi yoktur ve finansal kayıt
değiştirilebilir durumdadır — BFS v1 §5.1 ihlali.
