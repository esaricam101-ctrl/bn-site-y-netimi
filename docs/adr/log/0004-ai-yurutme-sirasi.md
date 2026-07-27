# ADR-0004 · AI yürütme sırası

**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** AIS v1 §AI · DMS (AI Center)
**Kapattığı çakışma:** Ç-3

## Bağlam

AI Center spesifikasyonundaki karar akışı `Girdi → niyet sınıflandırma (ucuz model) → izin ön kontrolü → kapsam → model yönlendirme → retrieval → üretim` biçimindeydi. İlk adım bir LLM'dir. Enterprise Memory ve Knowledge Graph hiçbir akışta geçmiyor, Business Rules Engine yalnızca üretim **sonrası** engelleyici olarak görünüyordu.

## Karar

Yürütme sırası BNOS standardına göre düzeltilir:

```text
Enterprise Memory → Knowledge Graph → Business Rules Engine → AI Agent → (gerekirse) LLM
```

**LLM hiçbir zaman ilk çalışan bileşen değildir.** Niyet sınıflandırması kural/anahtar sözcük tabanlı deterministik bir katmanda yapılır; LLM'e yalnızca bu katman çözemediğinde düşülür.

## Gerekçe

Sıra, mimari zarafet meselesi değildir. BRE üretimden **sonra** çalıştığında sistem, bir kuralı ihlal eden öneriyi üretmiş ve saklamış olur; sonra bastırır. BRE üretimden **önce** çalıştığında o öneri hiç var olmaz. İkincisi hem ucuz hem denetlenebilirdir.

Ayrıca: LLM'in ilk bileşen olması, her istekte bir model çağrısı maliyeti ve gecikmesi demektir — çoğu isteğin deterministik olarak yanıtlanabildiği bir domainde.

## Sonuçlar

**Kaldırılan:** AI Center'ın kendi Retrieval Service'i, gömme (embedding) deposu ve gömme önbelleği. Anlamsal erişim `IMemoryQueryService` (BNOS Enterprise Memory), sözcük tabanlı arama `ISearchProvider` (§38) üzerinden yapılır. İki port, iki sorumluluk. (Kapattığı çakışma: Ç-5)

**Korunan:** AI Center 4.3'teki ACL filtresinin sıralamadan **önce** uygulanması ve sonuç sayısı üzerinden bilgi sızıntısının reddi. Bu kural §38 ile birebir örtüşür ve port değişiminde kaybedilmeyecektir.

**Korunan:** AI'ın bağımsız kimliği ve yükseltilmiş erişimi yoktur; her erişim çağıran principal olarak yürütülür. Karar her zaman insana aittir.
