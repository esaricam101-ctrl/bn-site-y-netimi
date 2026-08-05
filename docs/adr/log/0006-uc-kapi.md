# ADR-0006 · Üç kapı — korumalı endpoint zinciri

**Kapsam:** [ORTAK] — Kimlik/kiraci/izin zinciri her istekte calisir.
**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi — **yeniden tanımlama**
**Öneren:** baş mimar
**Onaylayan:** mimari kurul
**İşlendiği belge:** BFS v1 §3 Üç kapı

## Bağlam

ADR v1.1 §40 sözleşme testleri arasında *"Her korumalı endpoint üç kapıdan geçer (§30)"* maddesi vardır. §30 ADR v1.0'dadır ve ADR-0001 uyarınca v1.0 artık bağlayıcı değildir; metni de mevcut değildir. Sözleşme testi yazılabilmesi için üç kapının tanımlanması gerekir.

## Karar

Korumalı her endpoint aşağıdaki üç kapıdan **bu sırayla** geçer:

| # | Kapı | Sorumluluk | Başarısızlık |
|---|---|---|---|
| **1** | **Kimlik** | JWT doğrulanır, `Principal` çözülür (`INSAN \| AGENT \| PLUGIN \| CIHAZ \| SISTEM`), oturum geçerliliği ve iptal kontrolü | `401` |
| **2** | **Kiracı** | Principal'ın tenant üyeliği doğrulanır, `TenantContext` kurulur, transaction başında `SET LOCAL app.tenant_id` çalıştırılır | `403` |
| **3** | **İzin** | Endpoint'in gerektirdiği izin, principal'ın etkin izin setinde aranır. Devralınmış yetki (agent, plugin, cihaz) devraldığı kapsamın alt kümesiyle sınırlıdır | `403` |

**Zorunlu kurallar:**

1. **Sıra değişmez.** İzin kontrolü tenant bağlamı kurulmadan yapılamaz — izinler tenant'a görelidir.
2. **Kapsam dışı istek `403` döner, filtrelenmiş `200` değil.** Sessiz filtreleme yetkilendirme hatalarını gizler.
3. **Kapılar merkezîdir.** NestJS guard zinciri olarak bir kez yazılır; endpoint başına elle eklenmez. `@Public()` dekoratörü açık ve gerekçelidir.
4. **Üç kapının geçildiği Audit Log'a yazılır** — hangi principal, hangi tenant, hangi izin.
5. RLS, üç kapının yerine geçmez; **son savunma hattıdır.** Kapı 2 unutulursa RLS bağlamsız sorguyu reddeder ve hata verir.

## Gerekçe

Üç kapının hangi üçü olduğu §30 metni olmadan kesin bilinemez. Bu tanım, projenin bilinen kısıtlarından türetilmiştir: JWT authentication, RBAC + permission-based authorization (kullanıcı gereksinimi), tenant izolasyonu (ADR-0002) ve birleşik `Principal` modeli (§39).

## Sonuçlar

**Bu bir yeniden tanımlamadır, bir kurtarma değil.** §30'un özgün metni ortaya çıkarsa bu kayıt onunla karşılaştırılır ve farklıysa ADR-0006 değiştirilir. O ana kadar sözleşme testi bu tanıma göre yazılır ve çalışır.
