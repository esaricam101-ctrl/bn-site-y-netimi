-- ===========================================================================
-- BNOS Apartman Yönetimi — 0007_belge_profesyonel
--
-- 0006 belgeyi kalıcı kıldı (versiyonlama · saklama politikası · nesne
-- deposu). Bu migration profesyonel arşiv için eksik olanları ekler:
--   1. Kategori          — türün üstünde dosyalama düzeyi
--   2. Çoklu ilişki      — bir belge birden çok kayda bağlanabilir
--   3. Etiket            — serbest sınıflandırma ve arama
--   4. Gizlilik seviyesi — KVKK veri minimizasyonu (md. 4/1-ç)
--   5. Dosya imhası      — KVKK silme hakkı; üstveri kanıt olarak kalır
--
-- ⚠️  `prisma migrate diff` çıktısı OLDUĞU GİBİ KULLANILMADI (0004-0006
-- notu): diff, şemada karşılığı olmayan elle yazılmış kısmi index'leri
-- düşürmek ister ve FK ekleme `FORCE ROW LEVEL SECURITY` ile çakışır.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) VARLIK TİPİ ENUM'U — `BelgeKapsami` yerini alır
--
-- Eskisi beş değer taşıyordu (TENANT · APARTMAN · BLOK · BOLUM · KISI).
-- KAT, MALIK, KIRACI ve SAKIN eklenmesi gerekiyor.
--
-- `ALTER TYPE ... ADD VALUE` ile genişletmek YERİNE yeni tip üretilip sütun
-- dönüştürülüyor: PostgreSQL'de eklenen enum değeri AYNI TRANSACTION içinde
-- KULLANILAMAZ ve migration'lar transaction içinde koşar. Yeni tip üretmek
-- bu kısıttan tümüyle kaçınır.
--
-- MALIK · KIRACI · SAKIN, KISI'den AYRIDIR: bir kira sözleşmesi kişiye
-- değil, o kişinin O BÖLÜMDEKİ kiracılık dönemine aittir. Kişi taşındığında
-- eski sözleşme eski döneme bağlı kalır.
-- ---------------------------------------------------------------------------

CREATE TYPE "BelgeVarlikTipi" AS ENUM (
  'TENANT', 'APARTMAN', 'BLOK', 'KAT', 'BOLUM', 'KISI', 'MALIK', 'KIRACI', 'SAKIN'
);

ALTER TABLE belge
  ALTER COLUMN kapsam TYPE "BelgeVarlikTipi"
  USING kapsam::text::"BelgeVarlikTipi";

DROP TYPE "BelgeKapsami";

-- ---------------------------------------------------------------------------
-- 2) KATEGORİ ve GİZLİLİK
-- ---------------------------------------------------------------------------

CREATE TYPE "BelgeKategorisi" AS ENUM ('HUKUKI', 'MALI', 'TEKNIK', 'KURUMSAL', 'KISISEL');
CREATE TYPE "BelgeGizliligi" AS ENUM ('GENEL', 'YONETIM', 'KISIYE_OZEL');

-- Kategori TÜRÜN özelliğidir, belgenin değil: "Fatura" her zaman MALI'dir.
-- Belge başına serbest bırakılsaydı aynı tür farklı kategorilere düşer ve
-- kategori bazlı arama güvenilmez olurdu.
ALTER TABLE belge_tipi_politikasi
  ADD COLUMN kategori "BelgeKategorisi" NOT NULL DEFAULT 'KURUMSAL',
  ADD COLUMN varsayilan_gizlilik "BelgeGizliligi" NOT NULL DEFAULT 'YONETIM';

ALTER TABLE belge
  ADD COLUMN gizlilik "BelgeGizliligi" NOT NULL DEFAULT 'YONETIM',
  ADD COLUMN notlar TEXT,
  -- KVKK kalıcı silme kaydı. Dosya imha edildiğinde dolar; üstveri satırı
  -- KANIT olarak kalır: "bu belge şu tarihte imha edildi" sorusunun cevabı
  -- kaydın kendisi silinirse kaybolur.
  ADD COLUMN dosya_imha_tarihi TIMESTAMPTZ(6);

-- ---------------------------------------------------------------------------
-- 3) ÇOKLU İLİŞKİ
-- ---------------------------------------------------------------------------

CREATE TABLE "belge_iliskisi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "belge_id" UUID NOT NULL,
    "varlik_tipi" "BelgeVarlikTipi" NOT NULL,
    "varlik_id" UUID,
    "birincil_mi" BOOLEAN NOT NULL DEFAULT false,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "belge_iliskisi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "belge_iliskisi_tenant_id_varlik_tipi_varlik_id_idx"
  ON "belge_iliskisi"("tenant_id", "varlik_tipi", "varlik_id");
CREATE INDEX "belge_iliskisi_tenant_id_belge_id_idx"
  ON "belge_iliskisi"("tenant_id", "belge_id");

-- Aynı belge aynı kayda İKİ KEZ bağlanamaz; liste mükerrer satır göstermez.
CREATE UNIQUE INDEX belge_iliskisi_tekil_uq
  ON belge_iliskisi (belge_id, varlik_tipi, varlik_id);

-- Belge başına EN FAZLA BİR birincil ilişki. Kısmi unique index bunu
-- veritabanı düzeyinde garanti eder; uygulama katmanına bırakılsaydı iki
-- birincil ilişki "sahibi hangisi?" sorusunu cevapsız bırakırdı.
CREATE UNIQUE INDEX belge_iliskisi_birincil_uq
  ON belge_iliskisi (belge_id) WHERE birincil_mi;

-- ---------------------------------------------------------------------------
-- 4) ETİKET
-- ---------------------------------------------------------------------------

CREATE TABLE "belge_etiketi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "belge_id" UUID NOT NULL,
    -- Normalize edilmiş (küçük harf, Türkçe duyarlı) saklanır: "Acil" ve
    -- "acil" aynı etikettir.
    "etiket" VARCHAR(40) NOT NULL,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "belge_etiketi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "belge_etiketi_belge_id_etiket_key"
  ON "belge_etiketi"("belge_id", "etiket");
CREATE INDEX "belge_etiketi_tenant_id_etiket_idx"
  ON "belge_etiketi"("tenant_id", "etiket");

-- ---------------------------------------------------------------------------
-- 5) YABANCI ANAHTARLAR
--
-- Hedef tablo `belge`; üzerinde FORCE RLS vardır ve kısıt kurulumundaki
-- doğrulama taraması tenant bağlamı olmadan koşar (bkz. 0004 notu).
-- FORCE yalnızca bu işlem boyunca kaldırılır.
-- ---------------------------------------------------------------------------

ALTER TABLE belge NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "belge_iliskisi" ADD CONSTRAINT "belge_iliskisi_belge_id_fkey"
  FOREIGN KEY ("belge_id") REFERENCES "belge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "belge_etiketi" ADD CONSTRAINT "belge_etiketi_belge_id_fkey"
  FOREIGN KEY ("belge_id") REFERENCES "belge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE belge FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 6) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE belge_iliskisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE belge_iliskisi FORCE  ROW LEVEL SECURITY;
CREATE POLICY belge_iliskisi_tenant_isolation ON belge_iliskisi
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE belge_etiketi ENABLE ROW LEVEL SECURITY;
ALTER TABLE belge_etiketi FORCE  ROW LEVEL SECURITY;
CREATE POLICY belge_etiketi_tenant_isolation ON belge_etiketi
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- ---------------------------------------------------------------------------
-- 7) BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- TENANT kapsamı hedef taşımaz; diğerleri taşımak ZORUNDA.
ALTER TABLE belge_iliskisi ADD CONSTRAINT belge_iliskisi_hedef_tutarlilik
  CHECK ((varlik_tipi = 'TENANT' AND varlik_id IS NULL)
      OR (varlik_tipi <> 'TENANT' AND varlik_id IS NOT NULL));

-- Etiket boş olamaz ve küçük harf saklanır; uygulama normalize eder,
-- veritabanı da doğrudan SQL ile yazılan bozuk kaydı reddeder.
ALTER TABLE belge_etiketi ADD CONSTRAINT belge_etiketi_bicim
  CHECK (length(btrim(etiket)) >= 2 AND etiket = lower(etiket));

-- İmha edilmiş belge ARŞİVDE ve SİLİNMİŞ olmak zorundadır: güncel bir
-- belgenin dosyası imha edilirse liste indirilemeyen satır gösterir.
ALTER TABLE belge ADD CONSTRAINT belge_imha_tutarlilik
  CHECK (dosya_imha_tarihi IS NULL OR (silindi_mi = true AND arsiv_mi = true));

-- ---------------------------------------------------------------------------
-- 8) MEVCUT BELGELER İÇİN BİRİNCİL İLİŞKİ ve KATEGORİ
--
-- Tenant döngüsü ZORUNLUDUR: `belge` ve `belge_tipi_politikasi` üzerinde
-- FORCE RLS vardır ve migration rolü de politikaya tabidir (bkz. 0002).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM tenant LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- Var olan her belgenin birincil kapsamı ilişki tablosuna taşınır;
    -- böylece sorgular TEK tablodan çalışır ve iki kaynak ayrışmaz.
    INSERT INTO belge_iliskisi (id, tenant_id, belge_id, varlik_tipi, varlik_id, birincil_mi)
    SELECT gen_random_uuid(), b.tenant_id, b.id, b.kapsam, b.hedef_id, true
    FROM belge b
    WHERE b.tenant_id = t.id
    ON CONFLICT DO NOTHING;

    -- KMK ve muhasebe mevzuatına göre tür kategorileri.
    UPDATE belge_tipi_politikasi SET kategori = 'HUKUKI', varsayilan_gizlilik = 'GENEL'
      WHERE tenant_id = t.id AND tip IN ('YONETIM_PLANI', 'GENEL_KURUL_KARARI');
    UPDATE belge_tipi_politikasi SET kategori = 'HUKUKI', varsayilan_gizlilik = 'KISIYE_OZEL'
      WHERE tenant_id = t.id AND tip IN ('TAPU', 'KIRA_SOZLESMESI');
    UPDATE belge_tipi_politikasi SET kategori = 'MALI', varsayilan_gizlilik = 'YONETIM'
      WHERE tenant_id = t.id AND tip IN ('FATURA', 'MAKBUZ');
    UPDATE belge_tipi_politikasi SET kategori = 'TEKNIK', varsayilan_gizlilik = 'YONETIM'
      WHERE tenant_id = t.id AND tip IN ('RUHSAT', 'TEKNIK_RAPOR', 'SIGORTA_POLICESI');
    UPDATE belge_tipi_politikasi SET kategori = 'KURUMSAL', varsayilan_gizlilik = 'YONETIM'
      WHERE tenant_id = t.id AND tip IN ('YAZISMA', 'DIGER');
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON belge_iliskisi TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON belge_etiketi TO bnos_app;
