# ADR-0009 · Yönetim Şirketi = tenant + **açık devir** ilişkisi

**Tarih:** 30 Temmuz 2026
**Statü:** kabul edildi
**Öneren:** ürün sahibi
**Onaylayan:** mimari kurul
**İşlendiği belge:** BFS v1 §2 · §3 · DMS v1 (Tenant aggregate)
**Uyguladığı karar:** [ADR-0002](0002-tenant-modeli.md) — yazılı çözüm yolunu
hayata geçirir; [ADR-0008](0008-tenant-yonetilen-yerleske.md) ile çelişmez

## Bağlam

Ürün gereksinimi **Portföy Yönetim Merkezi**'ni zorunlu kıldı: yönetim firması
sisteme girdiğinde doğrudan bir site/apartman paneline düşmeyecek, önce
yönettiği bütün projeleri tek kontrol merkezinde görecek ve oradan proje
seçecek.

Bu, [ADR-0002](0002-tenant-modeli.md)'nin *"v1 kapsamı dışında"* bıraktığı
Yönetim Şirketi dikeyidir. ADR-0002 bu günün geleceğini öngörmüş ve **çözüm
yolunu şimdiden yazmıştı**:

> Portföy görünümü ileride **RLS gevşetilerek çözülmeyecektir.** Çözüm yolu:
> yönetim şirketi tenant'ı + apartman tenant'larından açık devir (delegation)
> ilişkisi. Bu not, ileride kolay yolun (RLS by-pass) cazip görünmemesi için
> yazılmıştır.

[ADR-0008](0008-tenant-yonetilen-yerleske.md) da aynı sınırı tekrar etmişti:
*"`Yönetim Şirketi` hâlâ kapsam dışıdır… ADR-0002'nin çözüm yolu geçerliliğini
korur."*

Bu ADR **yeni bir mimari tasarlamaz**; yazılı yolu uygular.

## Karar

**1. Yönetim firması bir tenant'tır** (`TenantTipi = YONETIM_SIRKETI`). Kendi
kullanıcıları, kendi rolleri, kendi `tenant_id`'si vardır.

**2. Proje = tenant.** [ADR-0008](0008-tenant-yonetilen-yerleske.md) uyarınca
bir proje ya `APARTMAN` ya `SITE` tipli bir yerleşke tenant'ıdır. **Yeni bir
hiyerarşi katmanı EKLENMEZ:**

```text
YonetimDelegasyonu   ← yönetim firması tenant'ı ⟷ proje tenant'ı
   │
Tenant  (tip: APARTMAN | SITE)          ← proje
  └─ Apartman
      └─ Blok
          └─ Kat
              └─ BagimsizBolum
```

**3. Açık devir (`yonetim_delegasyonu`).** Bir proje tenant'ı yönetimini bir
firma tenant'ına devreder. Devir bir **kayıttır**: kim, ne zaman, hangi
gerekçeyle verdi ve ne zaman sona erdi — hepsi yazılı.

**4. Devir bir YETKİLENDİRMEDİR, izolasyon değildir.** Kapı 2 (TenantGuard)
genişletildi: kullanıcı jetondaki tenant'ın doğrudan üyesi değilse, **aktif bir
devir** üzerinden üye olabilir. Jeton `dvr` (devir) claim'i taşır ve Kapı 2 şunu
doğrular:

- kullanıcı `dvr` (yönetim firması) tenant'ının üyesi **mi**, ve
- `dvr` → jetondaki proje tenant'ı için **aktif devir var mı**.

**5. Portföy özeti PROJE BAŞINA SORGU + uygulama katmanında toplamadır.**
Çapraz-tenant `SELECT` yoktur. Her proje için `tenantIslemi(projeTenantId)`
ayrı ayrı koşar; RLS her sorguda tek tenant görür.

## Gerekçe

Kolay yol RLS'i gevşetmek ya da `BYPASSRLS` rolü açmaktı. ADR-0002 bunu
ismiyle yasakladı ve gerekçesi hâlâ geçerli: izolasyonu uygulama katmanındaki
bir `where` koşuluna bırakmak, unutulduğunda **sessiz** bir çapraz-tenant
sızıntısıdır ve KVKK denetlenebilirliği açısından yetersizdir.

Devir modeli bu baskıyı kaldırır çünkü **yetkilendirme ile izolasyonu
ayırır**: firma neye erişebileceğini devir kaydından öğrenir (yetki), ama her
sorgu yine tek tenant bağlamında koşar (izolasyon). Devir kaydı silinse bile
RLS ayakta kalır — güvenlik iki bağımsız katmana yayılmıştır.

`Tenant.olustur()`'un `tip !== 'APARTMAN'` reddi kaldırıldı. Bu, ADR-0008'de
zaten *"v1 kapsamında diye yazılmış geçici bir kısıt"* olarak işaretlenmişti.

## Sonuçlar

**Kabul edilen bedel — portföy özeti yavaştır.** 150 projelik bir firmada özet
150 ayrı sorgu demektir. ADR-0002 bu bedeli açıkça kabul etmişti ve çözümü de
yazmıştı: *"RLS'i delmek değil, indeksleme ve event ile bakımı yapılan özet
tablolar"* (bkz. IMPLEMENTATION-ROADMAP R-4). Özet tablosu geldiğinde bu
ADR değişmez; yalnızca okuma yolu hızlanır.

**`yonetim_delegasyonu` İKİ TARAFLI politika taşır.** Tek taraflı
(`tenant_id = app_tenant_id()`) bir politika işe yaramaz: satırın iki tenant'ı
vardır ve ikisi de kendi tarafını görmek zorundadır. Politika:

```sql
USING (yonetim_tenant_id = app_tenant_id() OR proje_tenant_id = app_tenant_id())
```

Bu, izolasyonu **gevşetmez**: açığa çıkan tek şey devir olgusudur, projenin
verisi değil.

**Devir doğrulaması TEK YERDE durur** (`TenantOkuyucu.devirGecerliMi`). İki
yere kopyalanırsa biri güncellenmeyi unutur ve firma, devri sona ermiş bir
projeyi okumaya devam eder — sessiz bir yetki aşımı.

**Proje oturumu denetime yazılır.** `dvr` claim'i taşıyan her oturum, "hangi
firma, hangi kullanıcı, hangi projeye adına hareket etti" bilgisini audit
kaydına bırakır. Aksi hâlde projede yapılan bir işlem, firmanın kullanıcısını
projenin kullanıcısı gibi gösterirdi.

**Şimdiden kayda geçen kısıt:** Devir, firma kullanıcısına projede **kendi
rolünün izinlerini** verir; projede ayrı bir `kullanici` kaydı AÇILMAZ. Kimliği
çoğaltmak, KVKK silme talebinde kişinin kaç tenant'a yayıldığını takip
edilemez kılardı.
