-- ===========================================================================
-- BNOS Apartman Yönetimi — 0021_sakin_dayanak
--
-- SAKİN ARTIK BİR MALİK YA DA KİRACIYA BAĞLANMAK ZORUNDA.
--
-- ⚠️  BUGÜNE KADAR SAKİN "HAVADA" DURUYORDU. `sakin` yalnızca bölüme ve kişiye
--     bağlıydı; "bu kişi burada KİMİN YAKINI olarak oturuyor" sorusunun cevabı
--     YOKTU. Sonuçları:
--
--       · Kiracı taşındığında ailesinin kayıtta kalıp kalmayacağı belirsizdi.
--       · Acil durumda "bu çocuğun velisi kim" sorusu yanıtsızdı.
--       · Aidat sorumluluğu zaten malike/kiracıya yazılır (ADR v1.1 §5) ama
--         sakinle sorumlu arasındaki bağ kurulamadığı için "kimin hanesi"
--         bilgisi kayıptı.
--
-- ⚠️  BAĞ İKİ NULLABLE FK + CHECK İLE KURULUR, tek polimorfik alanla değil.
--     `dayanak_tipi/dayanak_id` biçiminde tek alan kullanılsaydı yabancı
--     anahtar bütünlüğü KAYBOLURDU: silinmiş bir malike işaret eden sakin
--     kaydı veritabanı düzeyinde engellenemezdi. Bu, 0011'deki
--     `arac_tek_sahip` deseninin aynısıdır.
--
-- ⚠️  BİLEŞİK FK — dayanak AYNI BÖLÜMDE olmak zorundadır. `(malik_id,
--     bolum_id)` çifti `malik(id, bolum_id)`ye bağlanır; böylece A dairesinin
--     sakini B dairesinin malikine BAĞLANAMAZ. Yalnızca servis katmanında
--     denetlenseydi, doğrudan veritabanına yazan bir betik ya da ileride
--     yazılacak bir toplu aktarım bu kuralı sessizce atlardı.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) YAKINLIK DERECESİ — ANNE ve BABA AYRILDI
--
-- Mevcut `ANNE_BABA` tek değerdi. Kullanıcı "Annesi" ve "Babası"nı AYRI
-- istedi; acil durumda "annesini arayın" ile "babasını arayın" farklı
-- bilgilerdir.
--
-- ⚠️  `ANNE_BABA` KALDIRILMADI. PostgreSQL'de enum değeri silmek, o değeri
--     taşıyan satırlar varsa imkânsızdır; ayrıca geçmiş kayıtların anlamı
--     değişmemelidir. Eski değer geçerli kalır, yeni kayıtlarda kullanılmaz.
-- ---------------------------------------------------------------------------

ALTER TYPE "YakinlikDerecesi" ADD VALUE IF NOT EXISTS 'ANNE';
ALTER TYPE "YakinlikDerecesi" ADD VALUE IF NOT EXISTS 'BABA';

-- ---------------------------------------------------------------------------
-- 2) DAYANAK ALANLARI ve SERBEST METİN
-- ---------------------------------------------------------------------------

ALTER TABLE "sakin" ADD COLUMN "malik_id" UUID;
ALTER TABLE "sakin" ADD COLUMN "kiraci_id" UUID;

-- "Diğer" seçildiğinde kullanıcının yazdığı ifade (Amcası · Bakıcısı · …).
-- Seçenek listesi sabit tutulup serbest metin verilmeseydi, listede olmayan
-- her ilişki "Diğer" olarak kaydedilir ve bilgi KAYBOLURDU.
ALTER TABLE "sakin" ADD COLUMN "yakinlik_aciklamasi" VARCHAR(80);

-- ---------------------------------------------------------------------------
-- 3) BİLEŞİK YABANCI ANAHTAR İÇİN GEREKLİ TEKİLLİK
--
-- `id` zaten birincil anahtardır; `(id, bolum_id)` tekilliği bu yüzden
-- bedelsizdir ama bileşik FK'nın hedefi olabilmesi için AÇIKÇA tanımlanmalıdır.
-- ---------------------------------------------------------------------------

ALTER TABLE "malik"  ADD CONSTRAINT "malik_id_bolum_uq"  UNIQUE ("id", "bolum_id");
ALTER TABLE "kiraci" ADD CONSTRAINT "kiraci_id_bolum_uq" UNIQUE ("id", "bolum_id");

-- ---------------------------------------------------------------------------
-- 4) GERİYE DÖNÜK DOLDURMA
--
-- ⚠️  RLS FORCE AÇIKKEN MIGRATION İÇİNDE UPDATE ÇALIŞMAZ: `app_tenant_id()`
--     kurulmadığı için sorgu hata verir (0011 notunun aynısı). Bu yüzden
--     doldurma süresince tablolar geçici olarak muaf tutulur.
--
-- Sıra ÖNEMLİ:
--   (a) Kişi kendisi malikse/kiracıysa ona bağlanır — "kendisi" durumu.
--   (b) Değilse bölümün AÇIK kiracısına bağlanır: oturanların yakını olma
--       ihtimali en yüksek taraf fiilen oturan kiracıdır.
--   (c) Kiracı yoksa bölümün açık malikine bağlanır.
--
-- (b) ve (c) bir VARSAYIMDIR ve geçmiş veriyi tahmin eder; bu yüzden
-- doldurulan kayıtlar `yakinlik_aciklamasi` alanına iz bırakır. İz
-- bırakılmasaydı, sonradan bakan biri bu bağın kullanıcı tarafından mı yoksa
-- göç tarafından mı kurulduğunu ayırt edemezdi.
-- ---------------------------------------------------------------------------

ALTER TABLE sakin  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE malik  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kiraci NO FORCE ROW LEVEL SECURITY;

-- (a) Kişinin kendisi malik
UPDATE sakin s SET malik_id = m.id
FROM malik m
WHERE m.bolum_id = s.bolum_id AND m.kisi_id = s.kisi_id
  AND s.malik_id IS NULL AND s.kiraci_id IS NULL;

-- (a) Kişinin kendisi kiracı
UPDATE sakin s SET kiraci_id = k.id
FROM kiraci k
WHERE k.bolum_id = s.bolum_id AND k.kisi_id = s.kisi_id
  AND s.malik_id IS NULL AND s.kiraci_id IS NULL;

-- (b) Bölümün açık kiracısı
UPDATE sakin s
SET kiraci_id = (
      SELECT k.id FROM kiraci k
      WHERE k.bolum_id = s.bolum_id AND (k.bitis IS NULL OR k.bitis >= CURRENT_DATE)
      ORDER BY k.baslangic DESC LIMIT 1
    ),
    yakinlik_aciklamasi = COALESCE(yakinlik_aciklamasi, '0021 göçü: bağ tahmin edildi')
WHERE s.malik_id IS NULL AND s.kiraci_id IS NULL
  AND EXISTS (
    SELECT 1 FROM kiraci k
    WHERE k.bolum_id = s.bolum_id AND (k.bitis IS NULL OR k.bitis >= CURRENT_DATE)
  );

-- (c) Bölümün açık maliki
UPDATE sakin s
SET malik_id = (
      SELECT m.id FROM malik m
      WHERE m.bolum_id = s.bolum_id
        AND (m.tapu_bitis IS NULL OR m.tapu_bitis >= CURRENT_DATE)
      ORDER BY m.tapu_baslangic DESC LIMIT 1
    ),
    yakinlik_aciklamasi = COALESCE(yakinlik_aciklamasi, '0021 göçü: bağ tahmin edildi')
WHERE s.malik_id IS NULL AND s.kiraci_id IS NULL
  AND EXISTS (
    SELECT 1 FROM malik m
    WHERE m.bolum_id = s.bolum_id
      AND (m.tapu_bitis IS NULL OR m.tapu_bitis >= CURRENT_DATE)
  );

ALTER TABLE sakin  FORCE ROW LEVEL SECURITY;
ALTER TABLE malik  FORCE ROW LEVEL SECURITY;
ALTER TABLE kiraci FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5) YABANCI ANAHTARLAR (bileşik — dayanak aynı bölümde olmalı)
-- ---------------------------------------------------------------------------

-- ⚠️  KAYNAK TABLO DA MUAF TUTULUR. FK doğrulama taraması hem `malik`i hem
--     `sakin`i okur (0011 notu). İlk yazımda yalnızca hedefler muaf tutulmuştu
--     ve migration tam bu noktada çalışma zamanında durdu:
--       "Tenant baglami kurulmadan sorgu calistirilamaz"
--     Tarama SELECT'i `FROM ONLY sakin fk LEFT JOIN malik pk` biçimindedir;
--     kaynak taraf RLS altındaysa tarama da engellenir.
ALTER TABLE sakin  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE malik  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kiraci NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "sakin" ADD CONSTRAINT "sakin_malik_fkey"
  FOREIGN KEY ("malik_id", "bolum_id") REFERENCES "malik"("id", "bolum_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sakin" ADD CONSTRAINT "sakin_kiraci_fkey"
  FOREIGN KEY ("kiraci_id", "bolum_id") REFERENCES "kiraci"("id", "bolum_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE sakin  FORCE ROW LEVEL SECURITY;
ALTER TABLE malik  FORCE ROW LEVEL SECURITY;
ALTER TABLE kiraci FORCE ROW LEVEL SECURITY;

CREATE INDEX "sakin_tenant_malik_idx"  ON "sakin"("tenant_id", "malik_id");
CREATE INDEX "sakin_tenant_kiraci_idx" ON "sakin"("tenant_id", "kiraci_id");

-- ---------------------------------------------------------------------------
-- 6) BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- SAKİN TAM OLARAK BİR DAYANAĞA BAĞLANIR.
--
-- ⚠️  Bu CHECK, geriye dönük doldurmanın BAŞARISIZ KALDIĞI satır varsa
--     migration'ı DURDURUR. Bilinçlidir: dayanaksız bir sakin kaydını sessizce
--     bırakmak, kuralı "yeni kayıtlar için" geçerli kılıp eski veriyi görünmez
--     bir istisna hâline getirirdi.
ALTER TABLE sakin ADD CONSTRAINT sakin_dayanak_tek
  CHECK (num_nonnulls(malik_id, kiraci_id) = 1);

-- "Diğer" seçildiğinde serbest metin ZORUNLU.
ALTER TABLE sakin ADD CONSTRAINT sakin_diger_aciklama
  CHECK (yakinlik_derecesi <> 'DIGER' OR yakinlik_aciklamasi IS NOT NULL);
