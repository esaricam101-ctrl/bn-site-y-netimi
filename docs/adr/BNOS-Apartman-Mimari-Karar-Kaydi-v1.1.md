# BNOS — Apartman Yönetimi Modülü
## Mimari Karar Kaydı (ADR) — v1.1 · KİLİTLİ

**Belge statüsü:** Proje anayasası
**Yürürlük:** 26 Temmuz 2026
**Önceki sürüm:** v1.0 (§1–§30) — değişiklik yok
**Bu sürümde eklenen:** §31–§41

> Bu belge v1.0'ın devamıdır. §1–§30 aynen yürürlüktedir ve burada tekrarlanmamıştır.
> §41 uyarınca bu belge **son ADR sürümüdür**; bundan sonraki kararlar dört uzmanlaşmış belgeye dağıtılır.

---

# BÖLÜM A — YENİ KİLİTLİ KARARLAR

## §31 · Event Sourcing kullanılmaz

**PostgreSQL ilişkisel veri modeli tek ve nihai kayıt kaynağıdır.**

Domain Event'ler (§29) yalnızca üç amaç için üretilir:
1. Entegrasyon (modüller arası bağımsızlaşma, webhook, plugin)
2. Enterprise Memory ve Knowledge Graph beslemesi
3. Denetim zenginleştirme

**Bu kararın doğrudan sonuçları:**

| Sonuç | Açıklama |
|---|---|
| Event kaybı veri kaybı değildir | Kaybolan event = bozulmuş entegrasyon; kayıt bozulmaz. Operasyonel olarak büyük sadeleşme |
| **Bilgi yalnızca event'te yaşayamaz** | "Neden değişti" bilgisi ilişkisel modelde (audit tablosu) tutulur. Event'e bırakılmaz |
| Replay durumu yeniden kurmaz | Replay yalnızca Memory/KG yeniden tohumlama ve entegrasyon yeniden işleme içindir. Tüketiciler hem idempotent hem replay-toleranslı olmak zorundadır |
| Event saklama süresi sınırlıdır | Sonsuz saklama gerekmez. Redis Streams saklama penceresi + arşiv. Ciddi maliyet tasarrufu |
| Outbox yine de zorunludur | §29 aynen geçerli — teslimat garantisi için, kayıt kaynağı olduğu için değil |

**Karışmaması gereken ayrım:** Karar Defteri (§15) ve Audit Log append-only, hash zincirli **değiştirilemez tablolardır** — bunlar Event Sourcing değildir. Değiştirilemezlik, hukuki gerekliliğin sonucudur; mimari desen değil.

## §32 · CQRS — Command / Query servis ayrımı

Her aggregate için ayrı servisler yazılır:

```
AssessmentCommandService   ← yazma, transaction sınırı burada
AssessmentQueryService     ← okuma, optimize SQL / view kullanabilir
```

Bu, BNOS Enterprise Memory'nin `IMemoryCommandService` / `IMemoryQueryService` ayrımıyla aynı çizgidedir.

**Kurallar:**
1. **Query hiçbir koşulda yazmaz.** Command hiçbir koşulda okuma amaçlı kullanılmaz
2. **Command, tam okuma modeli döndürmez.** `id` + durum döndürür; istemci gerekiyorsa Query çağırır. Aksi halde yazma tarafı, okuma şemasına bağımlı hale gelir
3. **Query, domain katmanını atlayabilir.** Doğrudan optimize SQL, view veya materialized view kullanabilir — ayrımın asıl amacı budur
4. **RLS her ikisine de uygulanır** (§2). Query'nin domain'i atlaması, tenant izolasyonunu atlaması anlamına gelmez
5. **Transaction sınırı yalnızca Command servisindedir**

**v1 kapsamı:** Ayrım varsayılandır. Muafiyet yalnızca değişmeyen referans verisi içindir (il/ilçe, para birimi, sabit enum tabloları) ve gerekçe yazılır.

**Not:** v1'de ayrım *servis* düzeyindedir, *veritabanı* düzeyinde değil. Ayrı okuma veritabanı, projeksiyon ve materialized view daha sonraki bir optimizasyondur — bu ayrım onu mümkün kılar, şimdi zorunlu kılmaz.

## §33 · Silme Standardı

Üç sınıf, üç davranış:

| Sınıf | Davranış | Örnek |
|---|---|---|
| **Finansal kayıt** | **Asla silinmez.** Düzeltme ters kayıtla (storno) yapılır | JournalEntry, Payment, Receipt, Assessment, Borç |
| **Ana veri (master data)** | **Soft delete** | Kişi, Daire, Blok, Tedarikçi, Personel, Hesap planı kalemi |
| **Belge** | **Versiyon + arşiv.** Üzerine yazılmaz | Sözleşme, yönetim planı, rapor, karar ekleri |

```
Soft delete alanları: silindi_mi · silinme_tarihi · silen_kullanici · silme_gerekcesi
```

**Dört zorunlu uygulama kuralı:**

1. **Kısmi unique index.** Soft-deleted "A-3 dairesi", yeni "A-3" oluşturulmasını engellememelidir:
   `CREATE UNIQUE INDEX ... WHERE silinme_tarihi IS NULL`
   Bu kural atlanırsa silme işlemi ileride kaydı yeniden oluşturmayı imkânsız kılar.

2. **Varsayılan filtre merkezîdir.** Prisma Client Extension ile global uygulanır. Her `where` koşuluna elle eklenmez — biri unutulduğunda silinmiş kayıt sızar.

3. **Bağımlılık kontrolü.** Açık borcu olan daire soft-delete edilemez. Kurallar `SilinebilirlikPolitikasi` olarak tanımlanır, koda gömülmez.

4. ⚠️ **Soft delete, KVKK silme hakkını karşılamaz.**
   Veri sahibinin silme talebi ayrı bir işlemdir: `anonimlestir()` — kişisel tanımlayıcılar geri döndürülemez şekilde kaldırılır, finansal kayıt bütünlüğü korunur (borç kaydı kalır, kişi "Anonim Kişi #4821" olur).
   Üç işlem birbirinden ayrıdır: **soft delete ≠ hard delete ≠ anonimleştirme.** Sprint 9'da uygulanır.

## §34 · Zaman Standardı

| Katman | Kural |
|---|---|
| Veritabanı — an (instant) | `timestamptz`, **UTC** |
| Veritabanı — takvim tarihi | `DATE`, saat dilimi **yok** |
| Tenant | `saat_dilimi` ayarı (varsayılan `Europe/Istanbul`) |
| API | ISO 8601, UTC, offset açık (`2026-07-26T09:00:00Z`) |
| Rapor ve arayüz | Tenant saat diliminde; **saat dilimi başlıkta yazılır** |

**Kritik ayrım — an ile takvim tarihi karıştırılmaz:**

`timestamptz` (UTC): olay zamanı, audit, event, oturum, mesaj, log
`DATE` (saat dilimsiz): **vade tarihi, tahakkuk dönemi, dönem başlangıç/bitiş, genel kurul tarihi, sözleşme tarihleri**

**Neden kritik:** Vade tarihi UTC timestamp olarak saklanırsa, saat dilimi sınırında bir gün kayar. Gecikme faizi "kaç gün geçti" sorusunun cevabıdır (§8) — bir günlük kayma, her borçlunun faizini yanlış hesaplar ve hata sessizdir.

**Türetilmiş kurallar:**
- Gecikme günü hesabı **tenant takviminde** yapılır, UTC'de değil
- Dönem sınırları (§ dönem kapanışı) tenant yerel takvim sınırlarıdır
- Zamanlanmış işler tenant saat dilimine göre tetiklenir (§36)
- Türkiye sabit UTC+3'tür (2016'dan beri yaz saati yok) — ancak bu **koda gömülmez**, tenant ayarıdır
- Arayüz, finansal tarihleri tarayıcı yereline göre biçimlendirmez; tenant saat dilimini açıkça kullanır

## §35 · Numaralandırma Motoru

Tüm numaralandırma tek motordan geçer.

```
NumaraSerisi
├── kod, tenant_id, kapsam (TENANT | TENANT_YIL | TENANT_TIP)
├── format_sablonu     ("{onek}-{yil}-{sira:6}")
├── sifirlama          (YOK | YILLIK)
├── tip                (BOSLUKSUZ | BOSLUKLU)
└── mevcut_deger
```

**Kritik ayrım — her numara boşluksuz olmak zorunda değildir:**

| Seri | Tip | Gerekçe |
|---|---|---|
| Makbuz No | `BOSLUKSUZ` | Yasal zorunluluk |
| Karar No | `BOSLUKSUZ` | Karar defteri bütünlüğü (§15) |
| Tahakkuk No | `BOSLUKSUZ` | Mali denetim izi |
| Talep No | `BOSLUKLU` | Yasal gereklilik yok |
| Belge No | `BOSLUKLU` | Yasal gereklilik yok |
| İş Emri No | `BOSLUKLU` | Yasal gereklilik yok |

**Uygulama:**
- `BOSLUKSUZ`: sayaç tablosu + advisory lock, **kaydın transaction'ı içinde** tahsis edilir. Transaction geri alınırsa numara da geri alınır. PostgreSQL `SEQUENCE` **kullanılmaz** — sequence rollback'te boşluk bırakır
- `BOSLUKLU`: PostgreSQL `SEQUENCE`. Çok daha hızlı, kilitsiz

⚠️ **Boşluksuz seri, seri başına yazma işlemlerini serileştirir.** Apartman ölçeğinde (ayda birkaç yüz makbuz) sorun değildir. Yüksek hacimli hiçbir seri `BOSLUKSUZ` yapılmaz — bu sınır belgelenir.

## §36 · Zamanlayıcı Standardı

Sistemdeki tüm zamanlanmış işler tek motordan yürür: aidat tahakkuku · gecikme faizi işletme · hatırlatma · rapor üretimi · workflow zamanlayıcıları · veri saklama süresi işlemleri.

```
IScheduler (port)
Uygulama v1: BullMQ üzerinde Redis (yığında zaten var)
```

```
ZamanlanmisIs        (kod, cron, tenant_kapsamı, kaçırılan_çalıştırma_politikası,
                      yeniden_deneme, sahip)
IsCalistirma         (is, tenant, dönem_anahtarı, durum, başlangıç, bitiş, sonuç)
                      UNIQUE (is, tenant, dönem_anahtarı)
```

**Altı zorunlu kural:**

1. **Dönem başına en fazla bir kez.** "Ocak 2026 tahakkuku", zamanlayıcı iki kez tetiklense veya pod yeniden başlasa da bir kez çalışır. `UNIQUE (is, tenant, dönem_anahtarı)` bunu veritabanı düzeyinde zorlar
2. **Çok örnekli çalışmaya güvenli.** Dağıtık kilit zorunludur. Üç pod = üç tahakkuk hatası, klasik ve pahalıdır
3. **Tenant saat dilimine duyarlı** (§34). "Her ayın 1'i 09:00" tenant yerel saatidir
4. **Kaçırılan çalıştırma politikası iş bazındadır.** Finansal işler: **geç çalıştırılır, asla atlanmaz.** Bildirim işleri: atlanabilir
5. **Başarısız çalıştırma sessiz kalamaz.** Geri çekilmeli yeniden deneme → ölü mektup kuyruğu → yöneticiye alarm. Sessizce başarısız olan bir aidat tahakkuku, bir aylık gelir kaybıdır
6. **Her finansal zamanlanmış iş için manuel tetikleme ve kuru çalıştırma (dry-run) bulunur.** Yönetici, tahakkuku çalıştırmadan sonucunu görebilmelidir

## §37 · Önbellek Stratejisi

```
Anahtar biçimi:  t:{tenantId}:{alan}:{kimlik}:{sürüm}
```

⚠️ **`tenantId` içermeyen önbellek anahtarı, çok kiracılı sistemde veri sızıntısıdır.** RLS önbelleği korumaz. Bu kural bir lint kuralıyla zorlanır.

| Katman | TTL | Geçersizleştirme |
|---|---|---|
| Kullanıcı izin seti | 5 dk | Rol/izin değişim event'i |
| **Çözümlenmiş yönetim planı kuralları** (§14) | 24 sa | Plan sürüm değişim event'i |
| Referans verisi (hesap planı, gider türü, enum) | 24 sa | İlgili değişim event'i |
| Widget verisi | `WidgetKaydi.tazeleme_sıklığı` (§19) | TTL |
| Oturum / rate limit | Doğal | — |
| **Defter bakiyesi, cari hesap, borç durumu** | **Önbelleklenmez** | — |

**Üç kural:**
1. **Önbellek asla kayıt kaynağı değildir.** Her önbellek değeri kaynaktan yeniden üretilebilir olmalıdır. Redis tamamen boşaltıldığında sistem yavaşlar, bozulmaz
2. **Geçersizleştirme domain event'lerle yapılır** (§29) — TTL'e bel bağlanmaz
3. **Bayat finansal rakam, yavaş finansal rakamdan kötüdür.** Defter ve bakiye önbelleklenmez

**En yüksek getirili hedef:** Çözümlenmiş yönetim planı kuralları. Hesaplaması pahalı, değişimi nadirdir ve her tahakkuk satırında okunur.

## §38 · Arama Stratejisi

```
ISearchProvider (port)
├── indexle(doküman), sil(id), toplu_indexle(dokümanlar[])
└── ara(sorgu, tenant, izinFiltresi, sayfalama, filtreler)

v1 adaptörü: PostgreSQL Full-Text Search (tsvector + GIN)
v2 seçenekleri: OpenSearch · vektör arama (Enterprise Memory üzerinden)
```

**v1'de indekslenen:** Belgeler (üstveri + çıkarılmış metin) · Genel kurul kararları · Yönetim planı maddeleri · Talepler · Duyurular

**İki kritik kural:**

1. ⚠️ **Yetki filtresi sorgu anında uygulanır, sonuç kümesi sonradan filtrelenmez.**
   Sonradan filtreleme sayfalamayı bozar ve daha kötüsü, toplam sonuç sayısı üzerinden bilgi sızdırır ("42 sonuç bulundu" → 3 tanesini görebiliyorsun → 39 gizli belgenin varlığını öğrendin). Tenant ve izin kısıtı sorgunun parçasıdır.

2. **Türkçe metin işleme açıkça yapılandırılır.** PostgreSQL varsayılan olarak Türkçe sözlük yapılandırması getirmez. `unaccent` + uygun yapılandırma Sprint 9'da kurulur ve doğrulanır — varsayılana güvenilmez.

**BNOS ile ilişki:** Anlamsal/vektör arama ayrı bir sistem olarak kurulmaz; Enterprise Memory'nin sorumluluğudur (`IMemoryQueryService`). `ISearchProvider` sözcük tabanlı aramadır, ikisi karıştırılmaz.

## §39 · IoT Ağ Geçidi — port şimdi, uygulama sonra

```
IIoTGateway (port)
├── cihazKaydet(cihaz) · cihazDurumu(id) · cihazSil(id)
├── telemetriAl(cihaz, ölçüm[])        ← alım
├── komutGonder(cihaz, komut)          ← kontrol
└── alarmAboneligi(filtre)             ← olay
```

**v1 kapsamı: yalnızca port ve sınır tanımı. Uygulama yok.**

Üç tasarım kısıtı şimdiden kayda geçirilir:

1. **Telemetri ana ilişkisel tablolara yazılmaz.** Yüksek hacimli zaman serisidir; ayrı bölümlenmiş depo veya TimescaleDB gerektirir. Sınır şimdi çizilir ki ileride "sayaç okumalarını Daire tablosuna ekleyelim" denmesin
2. **Telemetri domain event üretir** (§29). Alarm ve kural tepkileri BRE üzerinden çalışır, IoT katmanına bağlanmaz
3. **Cihaz kimliği kullanıcı kimliği değildir.** Cihazlar kendi principal tipine sahiptir

**Hedef cihazlar (v2+):** Sayaç (§18 enerji analizinin gerçek veri kaynağı) · Asansör · Kamera · Sensör

### Ortaya çıkan desen — birleştirilecek

Aynı kural artık üç yerde tekrarlanıyor:
- §24 AI Agent: yetkisi çağıran kullanıcının alt kümesi
- §27 Plugin: yetkisi tenant'ın alt kümesi
- §39 Cihaz: kendi principal'ı, sınırlı yetki

Bu üçü tek bir **`Principal` modeli** altında birleştirilir: `INSAN | AGENT | PLUGIN | CIHAZ | SISTEM`. Her principal tipi kendi kimliğiyle Audit Log'a yazılır ve yetkisi devraldığı kapsamın alt kümesidir. Sprint 1'de tanımlanır.

## §40 · BNOS Module SDK

**§27'deki BNOS Client ile karıştırılmaz:**
- **BNOS Client** = biz kernel'i *tüketiriz* (`libs/bnos-client`)
- **Module SDK** = biz BNOS'a takılan *modül üretiriz* — standart bir sözleşmeye göre

Hedef: Apartman → Site → AVM → Plaza → OSB → Hastane → Otel modüllerinin aynı iskeletle geliştirilmesi.

### Modül Manifestosu

```
ModuleManifest
├── kod, sürüm, görünen_ad, dikey (APARTMAN | SITE | AVM | ...)
├── bagimliliklar[]              (diğer modüller + minimum sürüm)
├── gerektirdigi_cekirdek[]      (Memory, KG, BRE, Workflow, Notification...)
├── sagladigi_yetenekler[]
├── yayinladigi_eventler[]       (§29 kataloğuna kayıt)
├── tukettigi_eventler[]
├── izin_tanimlari[]             (yetki matrisine katkı)
├── lisans_kodu                  (§20 modül registry'sine kayıt)
├── genisletme_noktalari[]       (menü, widget, rapor, kural tipi,
│                                 bildirim şablonu, kurulum adımı)
└── yasam_dongusu                (install · migrate · enable · disable · uninstall)
```

### Sözleşme testleri — her modül geçmek zorundadır

```
· Tenant izolasyonu (RLS altında çapraz okuma reddedilir)
· Her mutasyon Audit Log'a yazar
· Yayınlanan her event standart zarfa uyar ve katalogda kayıtlıdır
· Her korumalı endpoint üç kapıdan geçer (§30)
· Tüm kullanıcıya görünen metin i18n anahtarıdır
· Soft delete standardına uyum (§33)
· Zaman standardına uyum (§34)
```

### Paket sınırı disiplini — v1'de yapılacak asıl iş

**Genel `Tesis → Birim` hiyerarşisi v1'de kurulmaz.** Yalnızca Apartman geliştirilirken genel soyutlama üretmek, kullanılmayan bir soyutlamayı bakımda taşımaktır.

Bunun yerine **sınır disiplini** uygulanır:

```
packages/
├── core-domain/        Tenant · Kişi · Belge · Talep · Bildirim · Duyuru
│                       Personel · Tedarikçi · Sözleşme · Muhasebe çekirdeği
│                       → dikeyden bağımsız, her modül kullanır
│
└── apartman-domain/    KMK kuralları · Arsa payı · Bağımsız bölüm
                        Malik/Kiracı · Genel kurul · Yönetim planı
                        → yalnızca Apartman dikeyi
```

**Kural:** `core-domain` hiçbir koşulda `apartman-domain`'e bağımlı olamaz. Bu tek kural, ikinci dikey (Site) başladığında çıkarmayı mekanik hale getirir. Bağımlılık yönü CI'da doğrulanır.

**v1 teslimatı:** Manifest şeması + yaşam döngüsü sözleşmesi + sözleşme testi paketi + paket sınırı kuralı. Gerçek SDK paketlemesi ikinci modül (Site) başladığında yapılır.

---

## §41 · Belge Mimarisi — ADR büyümez, dörde ayrılır

**Bu, son ADR sürümüdür.** ADR'nin sınırsız büyümesi, daha önce yakalanan §3 çelişkisinin (ADR "işletme defteri" derken Finance spec çift taraflı defter kurmuştu) sistematik hâlini üretir.

Bu karar, BNOS'un kendi standardını uygular. `brm_bnos-_alt_yapı.docx` REQ-ERAM-001: *"Her mimari bileşen en az bir üst ve bir alt bileşen ile ilişkilendirilmelidir."* ve ERAM ilkeleri: **Single Source of Truth · Bidirectional Mapping · Model Consistency.**

### Dört belge + bir kayıt

| Belge | İçerik | Kim değiştirir | Ne zaman |
|---|---|---|---|
| **CONSTITUTION** | Değişmez mimari ilkeler. 10–15 madde. Kısa olmak zorundadır — 50 sayfalık bir belge "değişmez" muamelesi görmez | Yalnızca mimari kurul | Neredeyse hiç |
| **BFS** — Framework Specification | Teknik standartlar ve geliştirme kuralları: kod yapısı, katmanlar, adlandırma, hata yönetimi, test, güvenlik, performans, gözlemlenebilirlik, CI/CD | Baş mimar | Sürüm başına |
| **DMS** — Domain Model Specification | Veri modeli, varlıklar, ilişkiler, durum makineleri, **yetki matrisi**, iş kuralları | Domain sahibi + mimar | Her sprint |
| **AIS** — API & Integration Specification | API sözleşmeleri, event kataloğu, entegrasyon sözleşmeleri, BNOS port'ları, Module SDK, webhook, plugin | API sahibi + mimar | Her sprint |
| **ADR** (kayıt) | **Neden** öyle karar verildiği. Append-only karar günlüğü. Yeni karar buraya yazılır ve ilgili belge bölümüne işaret eder | Herkes önerir, kurul onaylar | Karar başına |

**Ayrımın özü:** ADR *neden*i tutar (tarihsel, değişmez, append-only). Dört belge *ne olduğu*nu tutar (güncel durum, üzerine yazılır). Bu ikisi karışırsa hem tarih kaybolur hem güncel durum belirsizleşir.

### §1–§41'in dağıtımı

| ADR maddesi | Gideceği belge |
|---|---|
| §2 Multi-tenancy · §10 KVKK · §11 Kapsam · §24 Agent sınırları · §31 Event Sourcing yok | **CONSTITUTION** |
| §1 Yığın · §21 Tema · §23 Prototip · §26 API sürümleme · §28 Feature flags · §30 Üç kapı · §32 CQRS · §33 Silme · §34 Zaman · §35 Numaralandırma · §36 Zamanlayıcı · §37 Önbellek · §12 Doküman sırası | **BFS** |
| §3 Muhasebe · §4 Gider · §5 Borç sorumluluğu · §6 Malike aktarım · §7 Mahsup · §8 Faiz · §13 Kurulum · §14 Yönetim planı · §15 Genel kurul · §19 Dashboard · §20 Lisanslama · §25 Offline sınırı | **DMS** |
| §9 Para akışı · §16 İmza · §17 Bildirim · §18 AI raporlama · §22 BNOS stratejisi · §27 Plugin/SDK · §29 Event bus · §38 Arama · §39 IoT · §40 Module SDK | **AIS** |

**Tek kaynak kuralı:** Her karar **tek** belgede yaşar. İkinci belge referans verir, içeriği tekrarlamaz. Tekrarlanan içerik, zamanla çelişen içeriktir.

### Üretim sırası

Belgeler §12'deki sırayla ve sprint'lerle birlikte üretilir:

```
Sprint 0 sonu   → CONSTITUTION (tam) + BFS v1 (tam)
Sprint 1 sonu   → DMS v1 (tenant, kişi, yetki matrisi) + AIS v1 (BNOS port'ları, event zarfı)
Her sprint sonu → DMS ve AIS ilgili bölümleri güncellenir (DoD maddesi)
```

DoD'a eklenen: *"Sprint'in kararları ilgili belgeye (BFS/DMS/AIS) işlendi; ADR'ye yalnızca karar kaydı yazıldı."*

---

# BÖLÜM B — SPRINT PLANI GÜNCELLEMESİ

Yeni standartların çoğu **altyapıdır** ve erken kurulmazsa her yazma yoluna sonradan dokunmayı gerektirir.

| Sprint | Önceki | Yeni | Eklenen |
|---|---|---|---|
| **0** | 3 hafta | **4 hafta** | §31 event politikası · §32 CQRS iskeleti + üretici · §33 soft delete (Prisma extension + kısmi index kuralı) · §34 zaman tipleri + tenant ayarı · §37 önbellek anahtar sözleşmesi + lint kuralı · §38 `ISearchProvider` portu · §39 `IIoTGateway` portu · §40 paket sınırı + CI bağımlılık kontrolü · **CONSTITUTION + BFS v1** |
| **1** | 3 hafta | **4 hafta** | §35 Numaralandırma motoru · §36 Zamanlayıcı motoru + dağıtık kilit · §39 birleşik `Principal` modeli · §40 sözleşme testi paketi · **DMS v1 + AIS v1** |
| 2–16 | değişmedi | değişmedi | Her sprint kendi serilerini, zamanlanmış işlerini ve belge güncellemesini teslim eder |

**Toplam: 46 hafta** (önceki 44)
**MVP: Sprint 6 sonu — 21 hafta** (önceki 19)

### Sprint 0 hakkında bir uyarı ve önlem

Sprint 0 artık **4 hafta saf altyapıdır ve kullanıcıya görünen tek bir özellik üretmez.** Bu, paydaş güveni açısından gerçek bir risktir.

Önlem: Sprint 0, çalışan bir **dikey dilim** ile kapanır — giriş → bir tenant → bir varlık oluşturma → tüm boru hattından geçiş (RLS + outbox + audit + üç kapı + CQRS + soft delete + numaralandırma). Küçük ama uçtan uca. Böylece altyapı yazılmış değil, **kanıtlanmış** olur.

### DoD'a eklenen maddeler

```
· Command/Query ayrımı uygulandı (§32) — muafiyet varsa gerekçesi yazıldı
· Silme sınıfı belirlendi; soft delete varsa kısmi unique index kuruldu (§33)
· Tarih alanları DATE / timestamptz olarak doğru tiplendi (§34)
· Yeni numara serisi NumaraSerisi'ne kaydedildi; BOSLUKSUZ ise gerekçesi yazıldı (§35)
· Yeni zamanlanmış iş IsCalistirma unique kısıtıyla korundu (§36)
· Önbellek anahtarları tenantId taşıyor (§37)
· Aranabilir içerik ISearchProvider'a indekslendi; yetki filtresi sorgu içinde (§38)
· core-domain → apartman-domain bağımlılığı yok (§40)
· Kararlar BFS/DMS/AIS'e işlendi; ADR'ye yalnızca karar kaydı yazıldı (§41)
```

---

# BÖLÜM C — AÇIK MADDELER

v1.0'daki altı madde aynen geçerlidir; değişiklik yoktur.

| # | Madde | Bloke ettiği |
|---|---|---|
| C-1 | BNOS gerçek servis endpoint'leri ve SDK'nın mevcudiyeti | Sprint 15 |
| C-2 | iyzico submerchant sözleşmesi | Sprint 14 |
| C-3 | Personel performans analitiği — KVKK | Sprint 15 çıktısının yayını |
| **C-4** | **KMK emredici hükümler · genel kurul yeter sayısı · vekalet sınırları** | **Sprint 3 — kritik** |
| C-5 | Dijital imza sağlayıcısı ve belge geçerliliği | v2 |
| C-6 | İYS / ticari elektronik ileti kapsamı | Sprint 7 |

**C-4 için kalan süre: 11 hafta.** Paralel başlatılmalıdır.

---

# BÖLÜM D — Değişiklik Kaydı

| Sürüm | Değişiklik |
|---|---|
| v0.1 | §1–§12 · Temel mimari kararlar |
| v0.2 | §13–§20 önerisi |
| v1.0 | §3 kesinleşti · §13–§20 kilitlendi · §21–§30 eklendi · Plan 44 hafta · Açık madde 20 → 6 |
| **v1.1** | **§31–§40 eklendi** (Event Sourcing yok · CQRS · silme · zaman · numaralandırma · zamanlayıcı · önbellek · arama · IoT · Module SDK) · **§41 belge mimarisi** · Sprint 0 ve 1 birer hafta uzadı · Plan 46 hafta · **Son ADR sürümü** |

---

**Sonraki adım:** Sprint 0 başlar. İlk teslimatlar CONSTITUTION ve BFS v1 ile birlikte çalışan dikey dilimdir.
