# Doğrulama Raporu — yönlendirme

Bu belgenin **tek kaynağı depo kökündedir:**
[`../VALIDATION_REPORT.md`](../VALIDATION_REPORT.md)

## Neden burada bir kopya yok

Bu yol daha önce kök belgenin byte-eş bir kopyasını taşıyordu. İki nüsha
sessizce ayrışır: biri güncellenip diğeri unutulduğunda hangisinin doğru olduğu
anlaşılamaz. Somut olarak da bozuluyordu — belge içindeki göreli bir ADR
bağlantısı (`adr/log/0007-para-tipi-bigint.md`) iki farklı dizin derinliğinde
aynı anda doğru olamaz; kopyaların birinde her zaman kırıktı.

Kopya, işaretçiyle değiştirildi. Rapor güncellenirken tek dosya düzenlenir.

*Kayıt:* [`../DEVLOG.md`](../DEVLOG.md) TODO-6 · Oturum 3
