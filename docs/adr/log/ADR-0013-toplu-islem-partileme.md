# ADR-0013 · Toplu işlemlerin partilenmesi

**Tarih:** 31 Temmuz 2026
**Statü:** 🟡 TASLAK — **KARAR YOK**
**Öneren:** —
**Onaylayan:** —
**İşlendiği belge:** —
**İlgili:** [ADR-0011](0011-kapsam-ayari-olcek-siniri.md) · D1 `IslemPartisi`

> ⚠️ Bu dosya bilinçli olarak **eksiktir**. İçinde yalnızca cevaplanacak
> sorular vardır. Karar birlikte verilecek; o zamana kadar buraya çözüm,
> tasarım ya da tercih YAZILMAZ.
>
> Dosya adı depo kuralından (`NNNN-kisa-baslik.md`) ayrılıyor; ürün sahibinin
> verdiği ad korundu. Karar kesinleşince ada da karar verilir.

## Neden açıldı — ölçülen olgu

`POST /tahakkuk/calistir` 5.000 bölümlük bir sitede **çalışmıyor**. 5 saniyelik
işlem sınırı doluyor, istek 500 dönüyor ve işlem tümüyle geri alınıyor:
**sıfır borç, sıfır outbox olayı**.

Parti büyüklüğü taraması (`database/perf/parti-tavani.sql`):

| bölüm | sonuç | süre |
|---|---|---|
| 25 · 50 · 100 · 200 · 300 | ✅ | 437 → 4.002 ms |
| **400** | ✅ | **4.789 ms (%96 doluluk)** |
| 500 | ❌ 500 | ~5.020 ms |

Doğrusal: bölüm başına ≈11,6 ms. Sınır **≈420 bölümde** doluyor.

Ayrıntılı ölçüm: `SESSION_SUMMARY.md` §3.I.

## Cevaplanacak sorular

1. **Toplu tahakkuk tek işlemde mi, partili mi koşmalı?**
   Tek işlem bütünlüğü korur ama hedef ölçekte hiç tamamlanmıyor. Partileme
   tamamlanmayı sağlar, bütünlük garantisini zayıflatır.

2. **Parti büyüklüğü kaç olmalı?**
   Ölçüm: 400 bölüm mevcut sınırın %96'sını dolduruyor. Sabit sayı mı,
   ölçülen süreye göre uyarlanan bir sayı mı, yoksa sınırın kendisi mi
   değişmeli?

3. **Kısmi başarı olabilir mi, yoksa hep ya hep yok mu?**
   3.000 bölüme yazılıp 2.000'de durulan bir tahakkuk muhasebe açısından
   ne anlama gelir? Yönetici için "yarım tahakkuk" kabul edilebilir bir
   durum mu?

4. **Kısmi başarıda `IslemPartisi` (D1) geri alma nasıl işler?**
   Geri alma partileri tek tek mi çözer, tamamını mı? Ters kayıt kuralı
   (yerel fikstür ≠ muhasebe kaydı) burada nasıl uygulanır? Kısmen yazılmış
   bir tahakkuk geri alınırken outbox olayları ne olur?

5. **Kullanıcı 5.000 bölümlük bir işlemin ilerlemesini nasıl görür?**
   Senkron istek dönüş süresi bir dakikayı aşabilir. İlerleme göstergesi,
   iş kimliği + yoklama, yoksa olay akışı mı? Yarıda kalan bir işi kullanıcı
   nereden görür ve nasıl sürdürür?

## Karar

**Verilmedi.**

## Gerekçe

**Yazılmadı.**
