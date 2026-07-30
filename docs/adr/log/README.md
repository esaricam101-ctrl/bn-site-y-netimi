# ADR Karar Günlüğü

ADR v1.1, §41 uyarınca **son ADR sürümüdür.** Bundan sonraki kararlar bu klasöre append-only kayıt olarak yazılır.

## Kayıt biçimi

Dosya adı: `NNNN-kisa-baslik.md` (örn. `0001-veri-aktarim-merkezi-rollback-politikasi.md`)

```markdown
# ADR-NNNN · Başlık

**Tarih:** 
**Statü:** önerildi | kabul edildi | reddedildi | değiştirildi (→ ADR-XXXX)
**Öneren:** 
**Onaylayan:** mimari kurul
**İşlendiği belge:** CONSTITUTION §X | BFS §X | DMS §X | AIS §X

## Bağlam
Hangi problem, hangi kısıtlar.

## Karar
Ne kararlaştırıldı.

## Gerekçe
Neden bu, alternatifler neden değil.

## Sonuçlar
Neyi kolaylaştırır, neyi zorlaştırır, hangi bedeli kabul ediyoruz.
```

## Kural

Karar **buraya** yazılır ve ilgili belge bölümüne (CONSTITUTION / BFS / DMS / AIS) **işaret eder.**
İçerik ilgili belgede yaşar; burada yalnızca *neden* durur. Tekrarlanan içerik, zamanla çelişen içeriktir.

## Bekleyen kararlar

| # | Konu | Kaynak | Aciliyet |
|---|---|---|---|
| — | Veri Aktarım Merkezi · rollback'in §33 ile ilişkisi | `04-CAKISMA-KAYDI.md` Y-Ç-1 | Sprint 3 öncesi |
| ✅ | ~~Portföy görünümünün Yönetim Şirketi dikeyinde çözüm yolu~~ | → [ADR-0009](0009-yonetim-sirketi-acik-devir.md) | — |
| — | §13–§30'un yeniden karara bağlanması (v1.0 bulunamazsa) | `BASELINE.md` G-1 | **Derhal** |
| — | **Tedarikçi carisi ve personel bordro/avans defteri** | [ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) kapsam dışı bıraktı | Bölüm 5 ekranları öncesi |
| — | **Kontrol hesabının (`120`) tenant başına işaretlenmesi** — kod planı tenant'a göre değişir, koda gömülemez (§33 kural 3) | [ADR-0010](0010-cari-hesap-bolum-yardimci-defteri.md) | FAZ 2 |
