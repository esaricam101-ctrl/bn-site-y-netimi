# ADR-0005 · Finansal özetler önbelleklenmez

**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** BFS v1 §7 Önbellek
**Kapattığı çakışma:** Ç-4

## Bağlam

Dashboard ve Finance spesifikasyonlarının her ikisi de `GET /summary` için *"p95 ≤ 400ms cached"* taahhüdü veriyordu. Bu uçların yükünde alacak yaşlandırma, nakit pozisyonu ve bütçe sapması bulunuyordu. ADR v1.1 §37 ise defter bakiyesi, cari hesap ve borç durumunun önbelleklenmeyeceğini açıkça yasaklar.

## Karar

ADR v1.1 §37 aynen uygulanır. **Defter bakiyesi, cari hesap ve borç durumu önbelleklenmez.**

`GET /summary` yükü ikiye ayrılır:

| Önbelleklenebilir | Önbelleklenmez |
|---|---|
| KPI tanımları · widget yerleşimi · referans verisi (hesap planı, gider türü, enum) · çözümlenmiş yönetim planı kuralları · kullanıcı izin seti | Hesap bakiyesi · cari hesap · borç durumu · alacak yaşlandırma · nakit pozisyonu · bütçe gerçekleşmesi |

## Gerekçe

*Bayat finansal rakam, yavaş finansal rakamdan kötüdür.* Bir yöneticinin tahsilat kaydettikten sonra eski bakiyeyi görmesi, sistemin güvenilirliğini tek seferde bitiren türden bir hatadır — ve kullanıcı hatayı sisteme değil kendine atfeder, bu yüzden bildirilmez.

## Sonuçlar

**Performans kaygısı meşrudur ve göz ardı edilmez.** 25.000 bağımsız bölümde yaşlandırma sorgusu önbelleksiz kolay değildir. Çözüm sırası:

1. Doğru indeksleme (`tenant_id, hesap_id, tarih` bileşik indeksleri, kısmi indeksler)
2. Yetersizse: **transaction içinde bakımı yapılan** hesap bakiyesi özet tablosu

**Kritik ayrım — BFS'e yazılmıştır:** Özet tablo, yazma transaction'ı içinde güncellenir ve kayıt kaynağının parçasıdır; hiçbir zaman bayat olamaz. Önbellek, kaynaktan türetilen ve TTL ile eskiyen bir kopyadır. İkisi karıştırılırsa §37 ilk performans krizinde sessizce delinir. Bu not tam olarak bunun için yazılmıştır.

**Anahtar sözleşmesi:** Her önbellek anahtarı `t:{tenantId}:{alan}:{kimlik}:{sürüm}` biçimindedir. `tenantId` içermeyen anahtar çok kiracılı sistemde veri sızıntısıdır — RLS önbelleği korumaz. Bu kural derleme zamanında (tip) ve lint kuralıyla zorlanır.
