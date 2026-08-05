# Hukuk Soru Seti

**Henüz kimsenin veremeyeceği kararlar.** Cevabı hukuki görüş gerektiren,
ürün ekibinin tek başına kapatamayacağı sorular burada toplanır.

> **Neden dördüncü bir belge:** taksonomi zaten oturmuş —
> [YOL-HARITASI](../YOL-HARITASI.md) *ne eksik*,
> [ADR günlüğü](adr/log/README.md) *ne karar verildi*,
> [CELISKI-KAYDI](CELISKI-KAYDI.md) *hangi iki doğru kesişiyor* der. Hukuk
> soruları bunların hiçbiri değildir: ADR'ye konursa **"kabul edildi"
> statüsü olmayan bir ADR** çıkar.
>
> ★ Dağınık dururlarsa **avukata gönderilecek tek belge çıkmaz.** Bu
> belgenin varlık sebebi budur.

**Her madde:** soru · bugünkü davranış · cevabın neyi değiştireceği ·
ilgili ADR'ye çapraz atıf.

⚠️ **Bugünkü davranışların hiçbiri onaylanmamıştır.** Hepsi ürün ekibinin
tercihidir ve **tespit değildir**. Ürün çalışıyor olması cevabın doğru
olduğunu göstermez.

---

## H-1 · Paylı mülkiyette ortak gider borcunda sorumluluk

**Soru:** Paylı mülkiyette ortak gider borcunda paydaşların **yönetime
karşı** sorumluluğu **payı oranında** mıdır, **müteselsil** midir?

**Bağlam:** TMK'nın paydaşlar **arası** hükmü ile KMK'nın **yönetime
karşı** sorumluluk hükmü aynı şeyi söylemiyor; içtihat tek yönlü değil.

**Bugünkü davranış:** `PAYINA_GORE` — hisseli malikler ASIL katmanında
`pay = tutar × hisse`.

⚠️ **Ama tutarsız uygulanıyor:** aynı malik `ASIL` katmanında payına göre,
`IKINCIL` katmanında **müteselsil** (tam tutar). Ayrıca hisse kaydı
eksikse ürün **sessizce müteselsile kayıyor**.

**Cevabın değiştireceği:** kişi ekstresinin borç tarafı, `borcSorumlusu.pay`
yazma yolu, ve cevap değişirse **geçmiş kayıtların yeniden çözümlenmesi**.

**Cevap:** *(boş)* · **Durum:** 🟠 bekliyor
**ADR:** [ADR-0018](adr/log/ADR-0018-kisi-ekstresi-paylasim-semantigi.md)

---

## H-2 · Kısmi ödemede mahsup önceliği

**Soru:** Bir borçlu borcunun tamamını ödemediğinde, tahsilat önce
**gecikme tazminatına** mı yoksa **anaparaya** mı mahsup edilir?

**Bugünkü davranış:** Soru **henüz doğmadı** — gecikme tazminatı
hesaplanmıyor (motor yok). Borç kapatma sırası
[`tahsis-sirasi.ts`](../backend/src/modules/tahsilat/tahsis-sirasi.ts)
`vade → dönem → kalem kodu → id` ile **deterministik** ama bu bir
**istikrar garantisidir, hukuki öncelik değildir**.

⛔ **Sessiz belirlenme riski:** tazminat bir kalem olarak eklenirse
önceliğini `giderTuruKodu`'nun **alfabetik** sırası belirler ve **CT-26 o
gün yeşil kalarak yanlış şeyi korur.**

**Cevabın değiştireceği:** tahsis sırası, tahsilat ekranındaki FIFO
önerisi, ve tazminat kalemi eklendiğinde CT-26.

**Cevap:** *(boş)* · **Durum:** 🟠 bekliyor
**Kayıt:** [Çelişki Ç-2](CELISKI-KAYDI.md)

---

## H-3 · Gecikme tazminatı — oran, taban ve başlangıç anı

**Soru üç parçalı:**

1. **Oran tabanı var mı?** KMK md. 20/son aylık **%5** üst sınır koyuyor
   (5711 ile %10'dan indirildi). Yönetim planı **daha düşük** oran
   belirleyebilir mi — kanun taban koyuyor mu?
2. **Tazminat neyin üzerinden işler?** Yalnızca anapara mı, işlemiş
   tazminat da faize girer mi (bileşik)?
3. **Başlangıç anı:** vade ertesi gün mü, ihtar sonrası mı?

**Bugünkü davranış:** Motor **yok**. Oran yalnızca portföy öneri
metninde geçiyor.

⚠️ **`mevzuat_parametre` tablosu şemada YOK** — yani oranı "koda
gömmemek" için bugün **yazılacak yer yok**. İşin ilk adımı hesap değil,
o tablodur (yürürlük tarihli).

**Cevabın değiştireceği:** tazminat motoru, tahsilat ekranındaki kalem
listesi, kalan bakiyenin **zamana bağlı** hâle gelmesi (bayat tahsis
koruması).

**Cevap:** *(boş)* · **Durum:** 🟠 bekliyor
**Kayıt:** [Çelişki Ç-2](CELISKI-KAYDI.md) · yol haritası (P1)

---

## H-4 · Belge saklama süreleri

**Soru:** Aşağıdaki süreler doğru ve güncel mi? Yönetim bunları
**uzatabilir** mi, **kısaltabilir** mi?

**Bugünkü davranış:** Süreler **kodda**, üstelik kanun maddesi
atıflarıyla ([`belge.ts:180-187`](../shared/apartman-domain/src/belge/belge.ts)):

| Belge | Süre | Atıf |
|---|---|---|
| Fatura · Makbuz | 10 yıl | VUK md. 253 |
| Yönetim planı · Genel kurul kararı · Tapu | süresiz | KMK md. 28 · 32 · 12 |
| Kira sözleşmesi · Sigorta poliçesi | 10 yıl | — |

⚠️ **R6'nın en açık ihlali budur:** bir **mevzuat tablosu** TypeScript'te
duruyor. KVKK saklama süresi sınırlaması ile VUK saklama **zorunluluğu**
ters yönde çekiyor olabilir — o çatışma da bu sorunun parçası.

**Cevabın değiştireceği:** belge modülü, KVKK otomatik silme işi.

**Cevap:** *(boş)* · **Durum:** 🟠 bekliyor
**Kayıt:** yol haritası — B2 taraması (P1)

---

## H-5 · Yaşlandırma kovaları

**Soru:** Alacak yaşlandırmasında **30/60/90 gün** eşikleri bir mevzuat
gereği mi, yoksa sektör alışkanlığı mı? İcra takibi başlatma eşiğiyle
(KMK md. 20 — iki ay üst üste ödememe) ilişkisi var mı?

**Bugünkü davranış:** `[30, 60, 90]` varsayılan parametre olarak **kodda**
([`tahsilat.ts:376`](../shared/apartman-domain/src/tahsilat/tahsilat.ts)).
Ezilebilir ama varsayılan koda gömülü.

⚠️ Kova eşikleri yalnızca raporlama ise R6 kapsamı dışıdır; **icra
eşiğiyle bağlıysa** mevzuat parametresidir. Bugün hangisi olduğu
**belirsiz** — soru budur.

**Cevabın değiştireceği:** yaşlandırma raporu, gecikmiş borç listesi,
icra takibi tetikleyicisi.

**Cevap:** *(boş)* · **Durum:** 🟠 bekliyor
**Kayıt:** yol haritası — B2 taraması (P1)

---

## Cevaplananlar

*(Henüz yok. Cevap geldiğinde madde ilgili ADR'ye taşınır ve burada
tarihiyle birlikte tek satır kalır.)*
