# ADR-0015 · Yıl sonu kapanışı

**Tarih:** 1 Ağustos 2026
**Statü:** 🟡 TASLAK — **KARAR YOK**
**Öneren:** —
**Onaylayan:** —
**İşlendiği belge:** —
**İlgili:** [ADR-0003](0003-muhasebe-cift-tarafli.md) ·
[ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) ·
[ADR-0014](0014-mukerrer-tahakkuk-korumasi.md)

> ⚠️ Bu dosya bilinçli olarak **eksiktir**. İçinde yalnızca cevaplanacak
> sorular vardır. Karar birlikte verilecek; o zamana kadar buraya çözüm,
> tasarım ya da tercih YAZILMAZ.

## Neden açıldı — bir sınıflandırma hatası

ADR-0014 yazılırken yıl sonu kapanışı, "dönemde bir kez koşan bir gider türü"
örneği olarak anıldı. **Bu yanlıştır ve düzeltilmiştir.**

Yıl sonu kapanışı bir **gider türü değildir**; bir gideri bölümlere paylaştırma
işi hiç değildir. Bir **süreçtir**: yenileme fonu devri, bakiye aktarımı, kesin
hesap, dönem kilitleme. Gider dağıtımıyla ilgisi yoktur.

Dolayısıyla `tahakkuk_calismasi` ve `tahakkuk_sikligi` mekanizması kapanışı
modellemez. Kapanışın kendi kayıtları, kendi kısıtları ve kendi geri alma
kuralları olacaktır.

## Cevaplanacak sorular

1. **Kapanış hangi kayıtları üretir?**
   Yevmiye fişi mi, ayrı bir "kapanış" varlığı mı, ikisi birden mi? Gelir ve
   gider hesaplarının kapatılması, yenileme fonu devri ve bakiye aktarımı
   ayrı fişler mi yoksa tek bir fiş mi olmalı? Kapanış kaydı geri alınabilir
   bir kayıt mıdır, yoksa yalnızca ters kayıtla mı düzeltilir?

2. **Dönem kilitleme — MEKANİZMA VAR, eksik olan ne?**

   ⚠️ **Düzeltme (2 Ağustos 2026):** bu soru ilk yazıldığında "kilit var mı"
   diye soruyordu. **Vardır ve çalışır** — tarama ile doğrulandı:
   `MuhasebeDonemi.durum` (`ACIK`/`KAPALI`), `donem.service.ts:261 kapat()`,
   kapalı döneme fiş işlenemez
   ([fis.command.service.ts:227](../../../backend/src/modules/muhasebe/fis.command.service.ts#L227)),
   kapalı dönemde yevmiye yeniden numaralandırılamaz
   ([donem.service.ts:192](../../../backend/src/modules/muhasebe/donem.service.ts#L192)).

   Açık kalan sorular şunlardır:
   - Kilit **uygulama katmanında** duruyor. ADR-0002'nin gerekçesi
     ("değeri uygulama koyar, kuralı veritabanı zorlar") burada da geçerli
     mi — kapalı döneme yazma bir veritabanı kısıtıyla da engellenmeli mi?
   - **Kilidi açma yolu var mı?** `kapat()` var; geri alma yok. Kapanış
     "geri alınamaz" olarak yazılmış — bu bilinçli mi, yoksa henüz
     yazılmamış mı?
   - Kapanış hangi rolün yetkisinde ve denetim kaydı üretiyor mu?
     (`kapatanKullanici` alanı var; yetki kuralı doğrulanmadı.)
   - ⚠️ **Virman kapalı döneme yazılabiliyor mu?** Bugün `POST /banka/virman`
     yevmiye fişi üretmediği için dönem kilidine **takılmıyor**
     ([ADR-0016](ADR-0016-virman.md) §A). Kapanış kararı bu boşlukla
     birlikte ele alınmalı.

3. **Kapanmış dönemde düzeltme gerekirse ne olur?**
   Kilit açılıp yeniden mi kapatılır, yoksa düzeltme cari döneme mi yazılır?
   Geçmiş dönem düzeltmesi kesin hesabı değiştirir mi — değiştiriyorsa
   kat malikleri kuruluna sunulmuş rakam ile kayıt arasındaki fark nasıl
   izlenir?

4. **Devir bakiyesi hangi hesaba yazılır?**
   Bölüm bazlı alacak bakiyeleri (ADR-0010: cari = bağımsız bölüm) yeni
   döneme nasıl taşınır — açılış fişiyle mi, yoksa borç kayıtları dönem
   ötesi mi yaşar? Yenileme fonu (`500`) devri ile aidat alacakları (`120`)
   devri farklı kurallara mı tabidir?

5. **Denetçi raporu bu kayıttan mı üretilir?**
   Denetim kurulu raporu kapanış kaydının bir görünümü müdür, yoksa ayrı bir
   belge midir? Rapor üretildikten sonra kapanış kaydı değişebilir mi; değişirse
   rapor geçersiz mi sayılır?

6. **Kapanış ile tebligat/icra zinciri ilişkisi.**
   Kapanmış dönemin borcu için icra takibi sürüyorsa tahsilat hangi döneme
   yazılır — borcun doğduğu döneme mi, tahsilatın yapıldığı döneme mi? Kesin
   hesap sonradan gelen tahsilatla değişir mi; değişmiyorsa kat malikleri
   kuruluna sunulmuş rakam ile güncel bakiye arasındaki fark nerede görünür?
   İcra masrafı ve gecikme tazminatı hangi dönemin geliridir?

7. **★ BÜTÇE FARKI NEREYE DÜŞER? — bu ADR'nin asıl konusu (2 Ağustos 2026)**

   ⚠️ **ÖNCE BİR YANLIŞ ÇIKARIMI KAPATALIM: "kâr/zarar yapısal olarak
   sıfırdır" DOĞRU DEĞİLDİR.**

   Aidat **tahmini bütçeye** göre belirlenir. Gerçek giderler tahmini tutmaz:
   tasarrufla **artı**, beklenmedik masrafla **eksi** verir. Dönem sonunda
   toplanan avans ile harcanan gider **EŞİT DEĞİLDİR ve eşit olması
   beklenemez.**

   Bu fark kâr/zarar değildir — yönetim kâr amacı gütmez — **ama muhasebede
   bir yere düşmek ZORUNDADIR.** Avans yaklaşımı (ADR-0017 · S2) farkı ortadan
   kaldırmaz, yalnızca nereye düşeceğini değiştirir.

   **(a) ARTI BAKİYE (tasarruf) ne olur?**
   - Ertesi döneme **devreder** mi?
   - Kat maliklerine **iade** mi edilir? (dış araştırma bu görüşü aktarıyor;
     pratikte genelde devrediliyor)
   - **Yenileme fonuna** mı aktarılır?
   - **Genel kurul kararına** mı bağlıdır — yani sistem bir varsayılan
     dayatmalı mı, yoksa kararı kaydedip ona mı uymalı?

   Muhasebe karşılığı: avans bakiyesi (`349` benzeri) devreder mi, kapatılır
   mı? Gelir yaklaşımı seçilirse bu bakiye kâra kapanır — ki artı bakiyenin
   "kâr" sayılması KMK md. 20 ile çelişir.

   **(b) EKSİ BAKİYE (bütçe aşımı) ne olur?**
   - **Ek tahakkuk** mu çıkarılır?
   - **Ertesi dönem aidatına** mı yansıtılır?
   - Yönetimin **başka kaynağından** mı karşılanır (yenileme fonu, yedek akçe)?

   ★ Bu, (a)'dan **daha sık ve daha sancılıdır**: para zaten harcanmıştır,
   karşılığı yoktur. Muhasebe karşılığı ne olacak — açık borç mu, negatif
   avans mı, ayrı bir alacak kalemi mi?

   ⛔ Eksi bakiyeyi ek tahakkukla kapatmak, **yeni bir dayanak** gerektirir
   (ADR-0017 §6): kesinleşmemiş dayanağa tahakkuk yazılamıyorsa yıl sonu farkı
   da kendiliğinden tahakkuk edemez.

   **(c) Bu iki durum hangi mekanizmayla yapılır?**
   - ADR-0014'teki **`OLAY_BAZLI`** tahakkukla mı (ayırt edici `referans`
     taşıyan, dönemde birden çok koşabilen çalışma)?
   - Yoksa **ayrı bir kapanış işlemi** mi (kendi fiş türü, kendi denetim izi)?

   ★ Ölçüt: yıl sonu farkı bir **gider dağıtımı** mıdır (o zaman tahakkuk
   motoru doğru yerdir), yoksa bir **kapanış kaydı** mıdır (o zaman dönem
   servisi doğru yerdir)? İkisi karıştırılırsa fark hem mizanda hem borç
   listesinde iki kez görünebilir.

## Karar

**Verilmedi.**

## Gerekçe

**Yazılmadı.**
