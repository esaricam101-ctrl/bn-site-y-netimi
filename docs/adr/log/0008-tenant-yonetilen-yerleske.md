# ADR-0008 · Tenant = yönetilen yerleşke (apartman **veya** site)

**Tarih:** 28 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** BFS v1 §2 · DMS v1 (Tenant aggregate)
**Tadil ettiği karar:** [ADR-0002](0002-tenant-modeli.md) — iptal etmez, kapsamını genişletir

## Bağlam

[ADR-0002](0002-tenant-modeli.md) *"her apartman bir tenant'tır"* diyor ve
`portfolio | group | site` kapsamlarını bu modül dışında bırakıyordu. Gerekçe
PostgreSQL RLS'ti: çapraz-tenant toplama tanım gereği imkânsızdır ve izolasyonun
uygulama katmanına bırakılması KVKK açısından yeterli değildir.

Ürün gereksinimi, **site** yönetimini kapsama aldı: birden çok apartman bloğunu
tek yönetim altında toplayan yerleşkeler. Bu, ADR-0002'nin dışladığı `site`
kelimesiyle aynı adı taşıyor ancak **aynı şey değildir.**

Ayrım kritiktir:

| | ADR-0002'nin dışladığı | Bu ADR'nin eklediği |
|---|---|---|
| Ne | Tenant'ları **üstten gruplayan** kapsam | Tenant'ın **içindeki** yapı katmanı |
| Sorgu | Çapraz-tenant toplama | Tek tenant içinde |
| RLS | Gevşetilmesi gerekirdi | Hiç dokunulmaz |

## Karar

**Tenant, yönetilen yerleşkedir.** Bir apartman ya da bir site olabilir;
`TenantTipi` zaten `APARTMAN` ve `SITE` değerlerini taşır.

Tenant içindeki hiyerarşi:

```text
Tenant  (tip: APARTMAN | SITE)
  └─ Apartman        ← yeni; tek apartmanlı tenant'ta bir kayıt
      └─ Blok
          └─ Kat     ← yeni
              └─ BagimsizBolum
```

**ADR-0002'nin çekirdeği aynen yürürlüktedir:**

- Tek veritabanı + `tenant_id` + PostgreSQL RLS.
- Uygulama rolünün `BYPASSRLS` yetkisi **yoktur**.
- **Çapraz-tenant sorgu yoktur ve olmayacaktır.** Site özeti, tek tenant
  içindeki apartmanların toplamıdır; başka bir tenant'ın verisine dokunmaz.

## Gerekçe

Site'yi tenant'ın **üstüne** koymak, birden çok tenant'ı tek sorguda okumayı
gerektirirdi — ADR-0002'nin açıkça yasakladığı ve *"ileride kolay yolun (RLS
by-pass) cazip görünmemesi için"* not düştüğü şey budur.

Site'yi tenant'ın **kendisi** yapmak bu baskıyı tümüyle ortadan kaldırır: bir
sitenin tüm apartmanları, blokları, katları ve bağımsız bölümleri aynı
`tenant_id`'yi taşır. RLS politikası değişmez, yeni tablolar aynı politikayı
devralır, izolasyon kanıtı (CT-01) aynı biçimde geçerlidir.

Bedeli, `Tenant.olustur()`'un `tip !== 'APARTMAN'` reddini gevşetmektir — bu
zaten *"v1 kapsamında"* diye yazılmış geçici bir kısıttı.

## Sonuçlar

**Yeni tablolar tenant kapsamlıdır** ve migration'da RLS politikası almak
zorundadır: `apartman`, `kat`. Bu kural `0001_init`'teki tablo dizisine
eklenerek zorlanır; unutulursa tablo RLS'siz kalır ve **hata sessizdir**.

**Tek apartmanlı tenant'ta `Apartman` bir kayıttır.** Zorunlu bir dolaylılık
gibi görünür; karşılığında site ve apartman aynı kod yolunu kullanır ve
"site mi apartman mı" ayrımı sorgulara sızmaz.

**`Yönetim Şirketi` hâlâ kapsam dışıdır.** Birden çok siteyi/apartmanı tek
çatıda toplayan portföy görünümü v1'de yoktur ve ADR-0002'nin çözüm yolu
(yönetim şirketi tenant'ı + açık devir ilişkisi) geçerliliğini korur.

**Şimdiden kayda geçen kısıt:** Bu ADR, tenant sınırını aşan hiçbir okumaya
kapı açmaz. Site büyüdükçe "iki siteyi birlikte raporlayalım" talebi gelirse
cevap yine RLS gevşetmek değil, ADR-0002'deki devir modelidir.
