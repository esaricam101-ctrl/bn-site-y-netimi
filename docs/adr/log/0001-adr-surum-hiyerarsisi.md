# ADR-0001 · ADR sürüm hiyerarşisi

**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** BASELINE.md §2 · README.md

## Bağlam

ADR v1.1 başlığı "v1.0 (§1–§30) aynen yürürlüktedir ve burada tekrarlanmamıştır" der. Ancak v1.0 belgesi depoda mevcut değildir. Bu durum, §13–§30'un metni olmadan bağlayıcı sayılması gibi denetlenemez bir hal üretiyordu (bkz. `02-ADR-UYUM-RAPORU.md` K-1).

## Karar

**ADR v1.1 tek geçerli mimari karar kaynağıdır.** ADR v1.0 ve v0.1 tarihsel referanstır ve bağlayıcı değildir.

Metni mevcut olan v0.1 §1–§12, ayrı ayrı yeniden karara bağlandığı ölçüde geçerlidir. Bu kayıt tarihinde yeniden karara bağlananlar: §2 (ADR-0002), §3 (ADR-0003), §11 (ADR-0004). Diğerleri (§4, §5, §7, §8, §9, §10, §12) **çalışma varsayımı** statüsündedir: uygulanır, ancak bağlayıcı karar olarak DMS/BFS'e yazılırken ayrıca onaylanır.

## Gerekçe

Metni olmayan bir karara uyum denetlenemez. §41'in kendi ilkesi — *tek kaynak, tekrarlanan içerik zamanla çelişen içeriktir* — v1.0'ın hayalet statüsünü de kapsar. Bir belgenin var sayılıp okunamaması, olmamasından daha kötüdür: ihlal sessiz kalır.

## Sonuçlar

**Kolaylaştırdığı:** Denetim artık tek belgeye karşı yapılır. `02-ADR-UYUM-RAPORU.md`'deki 19 "doğrulanamadı" kaydı kapanır.

**Zorlaştırdığı — kabul edilen bedel:** v1.1 metni, artık bağlayıcı olmayan maddelere atıf yapar. İki atıf gerçek boşluk üretir:

| Atıf | Nerede | Çözüm |
|---|---|---|
| §29 Event bus | §31 (*"Outbox yine de zorunludur — §29 aynen geçerli"*) · §40 sözleşme testi (*"standart zarfa uyar"*) | Event zarfı ve outbox sözleşmesi AIS v1'de sıfırdan tanımlandı |
| §30 Üç kapı | §40 sözleşme testi (*"Her korumalı endpoint üç kapıdan geçer"*) | ADR-0006 ile yeniden tanımlandı |

Diğer atıflar (§21 tema, §25 offline, §26 sürümleme, §27 plugin, §28 feature flag) Blok-1'i etkilemez ve ilgili sprint'te BFS'e yazılır.
