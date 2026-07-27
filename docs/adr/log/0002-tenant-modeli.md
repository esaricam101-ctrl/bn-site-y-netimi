# ADR-0002 · Tenant modeli — tenant = apartman

**Tarih:** 26 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** BFS v1 §2 · DMS v1 (Tenant aggregate)
**Kapattığı çakışma:** Ç-2

## Bağlam

Mevcut spesifikasyonlar `estateId` alanı ve `scope: portfolio | group | site | block` kapsam modeli üzerine kurulmuştu; portföy geneli toplama içeriyordu. Bu, PostgreSQL RLS ile zorlanan tenant izolasyonuyla bağdaşmaz — RLS altında çapraz-tenant toplama tanım gereği imkânsızdır.

## Karar

**Her apartman bir tenant'tır.** Tek veritabanı + `tenant_id` + PostgreSQL Row Level Security.

`portfolio`, `group`, `site` kapsamları **bu modülde uygulanmaz.** Kapsam yalnızca `tenant` ve isteğe bağlı olarak `blok`tur.

`estateId` → `tenant_id` yeniden adlandırması tüm spesifikasyon ve prototiplerde geçerlidir.

## Gerekçe

Hedef ölçek binlerce apartman / on binlerce bağımsız bölümdür. İzolasyonun uygulama katmanındaki `where` koşuluna bırakılması, KVKK denetlenebilirliği açısından yeterli değildir: bir unutulmuş koşul çapraz-tenant sızıntısıdır ve sessizdir. Veritabanının zorlaması, ihlali imkânsız kılar.

Portföy görünümü bir Yönetim Şirketi yeteneğidir ve v1 kapsamı dışındadır.

## Sonuçlar

**Kabul edilen bedel:** Yönetim Şirketi dikeyi geldiğinde portföy raporu, tenant başına ayrı sorgu + uygulama katmanında toplama demektir. Yavaştır.

**Şimdiden kayda geçen kısıt:** Portföy görünümü ileride **RLS gevşetilerek çözülmeyecektir.** Çözüm yolu: yönetim şirketi tenant'ı + apartman tenant'larından açık devir (delegation) ilişkisi. Bu not, ileride kolay yolun (RLS by-pass) cazip görünmemesi için yazılmıştır.

**Uygulama kuralı:** Uygulama veritabanı rolünün `BYPASSRLS` yetkisi **yoktur.** Bu, CI'da test edilir.
