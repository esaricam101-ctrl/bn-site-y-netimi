# ADR-0003 · Muhasebe mimarisi — çift taraflı defter

**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** DMS (Finance) · BFS v1 §Money
**Değiştirdiği:** ADR v0.1 §3 (işletme defteri seviyesi)
**Kapattığı çakışma:** Ç-1

## Bağlam

v0.1 §3, v1 hedefini "KMK'ya uygun işletme defteri seviyesi" olarak koymuş, ancak veri modelinin şema değişikliği olmadan çift tarafa genişleyebilmesini şart koşmuştu. Finance spesifikasyonu ise doğrudan çift taraflı defter kurmuştu (`JournalEntry` / `JournalLine`, borç/alacak, mizan). §41 bu çelişkiyi ADR'nin dörde ayrılma gerekçesi olarak anmıştı.

## Karar

**Finance modülü çift taraflı muhasebe mimarisiyle devam eder.** `JournalEntry` + `JournalLine` (borç/alacak) kayıt kaynağıdır. Feature flag ile kapatma yaklaşımı (önceki K-3 önerisi) **terk edilmiştir.**

## Gerekçe

§3'ün asıl kaygısı derinlik değil, **geri dönülemezlikti**: sonradan çift tarafa geçişin şema değişikliği gerektirmemesi. Baştan çift taraflı kurmak bu kaygıyı tamamen ortadan kaldırır — genişleme sorunu diye bir şey kalmaz.

İkinci gerekçe: mutabakat, dönem kapanışı, kontrol hesapları ve denetim izi çift taraflı defterde yapısal olarak doğrulanabilir (borç = alacak). İşletme defterinde bu doğrulama yoktur; hata sessiz kalır.

## Sonuçlar — bağlayıcı koşullar

**Koşul 1 — İşletme defteri bir rapordur, kaybolmaz.** KMK m.36 uyarınca işletme defteri tutma yükümlülüğü devam eder. Çift taraflı defter bunun üst kümesidir; işletme defteri **türetilmiş rapor** olarak üretilir ve defterle mutabık olduğu test edilir. Bu rapor Sprint 4 teslimatıdır ve MVP'nin çıkış ölçütüdür.

**Koşul 2 — Kullanıcıya çift taraflılık dayatılmaz.** Apartman yöneticisi muhasebeci değildir. Yevmiye kaydı doğrudan girilmez; kayıtlar işlemlerden (tahakkuk, tahsilat, gider, banka) sistem tarafından üretilir. Doğrudan yevmiye girişi ve mizan yüzeyleri yalnızca `finance.settings.manage` + muhasebeci rolüne açıktır.

**Koşul 3 — Hesap planı KMK bağlamına göre kurulur.** Tek düzen hesap planı doğrudan alınmaz; apartman işletmesi için sadeleştirilmiş, yenileme fonu ve avans hesaplarını içeren bir plan DMS'te tanımlanır.

**Koşul 4 — Performans.** ADR-0005 finansal özetlerin önbelleklenmesini yasaklar. Çift taraflı defterde bakiye sorguları daha ağırdır. Çözüm önbellek değil: doğru indeksleme ve gerekirse **transaction içinde bakımı yapılan** hesap bakiyesi özet tablosu. Özet tablo kayıt kaynağının parçasıdır, önbellek değildir — ayrım BFS'te tanımlıdır.
