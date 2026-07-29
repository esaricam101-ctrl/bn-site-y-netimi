-- ===========================================================================
-- BNOS Apartman Yönetimi — 0006_belge
--
-- Domain katmanı (`shared/apartman-domain/src/belge/belge.ts`) bu kuralları
-- zaten taşıyordu; eksik olan kalıcılık ve nesne deposuydu.
--
-- BELGE SİLİNMEZ, VERSİYONLANIR (BFS v1 §5.3 kural 3). Yeni sürüm eskisini
-- geçersiz kılar ama yok etmez: "hangi yönetim planına göre karar verildi?"
-- sorusunun cevabı eski sürümdedir.
--
-- ⚠️  `prisma migrate diff` çıktısı OLDUĞU GİBİ KULLANILMADI — 0004 ve
-- 0005'teki iki tuzak burada da geçerlidir (elle yazılmış kısmi index'lerin
-- düşürülmek istenmesi ve FK'nın FORCE RLS ile çakışması).
-- ===========================================================================

CREATE TYPE "BelgeTipi" AS ENUM (
  'YONETIM_PLANI', 'GENEL_KURUL_KARARI', 'TAPU', 'KIRA_SOZLESMESI',
  'FATURA', 'MAKBUZ', 'SIGORTA_POLICESI', 'RUHSAT', 'TEKNIK_RAPOR',
  'YAZISMA', 'DIGER'
);

CREATE TYPE "BelgeKapsami" AS ENUM ('TENANT', 'APARTMAN', 'BLOK', 'BOLUM', 'KISI');

CREATE TABLE "belge_tipi_politikasi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tip" "BelgeTipi" NOT NULL,
    -- NULL = SURESIZ saklanir.
    "saklama_yili" INTEGER,
    -- FINANSAL sinif asla silinmez (BFS v1 §5.1).
    "finansal_mi" BOOLEAN NOT NULL DEFAULT false,
    "kaynak_referansi" VARCHAR(200),
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "belge_tipi_politikasi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "belge_tipi_politikasi_tenant_id_tip_key"
  ON "belge_tipi_politikasi"("tenant_id", "tip");

CREATE TABLE "belge" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tip" "BelgeTipi" NOT NULL,
    "kapsam" "BelgeKapsami" NOT NULL,
    -- TIPLI YABANCI ANAHTAR YOK: hedef bes ayri tabloya isaret edebilir.
    -- Varligi uygulama katmaninda denetlenir.
    "hedef_id" UUID,
    "ad" VARCHAR(200) NOT NULL,
    "surum" INTEGER NOT NULL DEFAULT 1,
    "onceki_surum_id" UUID,
    "belge_tarihi" DATE NOT NULL,
    "gecerlilik_bitisi" DATE,
    -- Nesne deposundaki anahtar; tenant kimligiyle oneklidir.
    "dosya_anahtari" VARCHAR(300) NOT NULL,
    "dosya_boyutu" INTEGER NOT NULL,
    "icerik_tipi" VARCHAR(120) NOT NULL,
    -- SHA-256 ozeti: belge bir delildir, icerigi sessizce degismemelidir.
    "dosya_ozeti" VARCHAR(64),
    "arsiv_mi" BOOLEAN NOT NULL DEFAULT false,
    "yukleyen_kullanici" UUID,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "belge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "belge_tenant_id_kapsam_hedef_id_idx" ON "belge"("tenant_id", "kapsam", "hedef_id");
CREATE INDEX "belge_tenant_id_tip_arsiv_mi_idx" ON "belge"("tenant_id", "tip", "arsiv_mi");

-- Yabanci anahtarlar. `tenant` RLS tasimaz; `belge` uzerinde RLS henuz
-- acilmadigi icin kendi ic zinciri de sorun cikarmaz (bkz. 0004 notu).
ALTER TABLE "belge_tipi_politikasi" ADD CONSTRAINT "belge_tipi_politikasi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "belge" ADD CONSTRAINT "belge_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "belge" ADD CONSTRAINT "belge_onceki_surum_id_fkey"
  FOREIGN KEY ("onceki_surum_id") REFERENCES "belge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE belge ENABLE ROW LEVEL SECURITY;
ALTER TABLE belge FORCE  ROW LEVEL SECURITY;
CREATE POLICY belge_tenant_isolation ON belge
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE belge_tipi_politikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE belge_tipi_politikasi FORCE  ROW LEVEL SECURITY;
CREATE POLICY belge_tipi_politikasi_tenant_isolation ON belge_tipi_politikasi
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

ALTER TABLE belge ADD CONSTRAINT belge_surum_pozitif CHECK (surum >= 1);
ALTER TABLE belge ADD CONSTRAINT belge_boyut_pozitif CHECK (dosya_boyutu > 0);

-- Belge KENDISININ onceki surumu olamaz; zincir kendine donerse surum
-- gecmisi sonsuz donguye girer.
ALTER TABLE belge ADD CONSTRAINT belge_zincir_kendine_donmez
  CHECK (onceki_surum_id IS NULL OR onceki_surum_id <> id);

-- Ilk surum onceki surum TASIYAMAZ; sonraki surumler TASIMAK ZORUNDA.
-- Zincir kopmussa "bu belge neyin yerine geldi?" sorusu cevapsiz kalir.
ALTER TABLE belge ADD CONSTRAINT belge_surum_zinciri_butun
  CHECK ((surum = 1 AND onceki_surum_id IS NULL)
      OR (surum > 1 AND onceki_surum_id IS NOT NULL));

-- Gecerlilik bitisi belge tarihinden once olamaz.
ALTER TABLE belge ADD CONSTRAINT belge_tarih_sirasi
  CHECK (gecerlilik_bitisi IS NULL OR gecerlilik_bitisi >= belge_tarihi);

ALTER TABLE belge ADD CONSTRAINT belge_soft_delete_tutarlilik
  CHECK ((silindi_mi = false AND silinme_tarihi IS NULL)
      OR (silindi_mi = true AND silinme_tarihi IS NOT NULL AND silme_gerekcesi IS NOT NULL));

-- Ayni nesne anahtari IKI belge kaydina baglanamaz: biri silinirse digerinin
-- dosyasi da yok olurdu.
CREATE UNIQUE INDEX belge_dosya_anahtari_uq
  ON belge (tenant_id, dosya_anahtari) WHERE silinme_tarihi IS NULL;

-- Bir belgenin AYNI surumu iki kez kaydedilemez.
CREATE UNIQUE INDEX belge_surum_uq
  ON belge (tenant_id, onceki_surum_id, surum) WHERE onceki_surum_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- VARSAYILAN SAKLAMA POLİTİKALARI
--
-- Mevcut her tenant için KMK ve genel muhasebe mevzuatı varsayılanları
-- yüklenir. Bunlar VARSAYILANDIR; yönetim kararıyla değiştirilebilir ve
-- değiştirildiğinde `kaynak_referansi` doldurulmalıdır.
--
-- Tenant döngüsü ZORUNLUDUR: `belge_tipi_politikasi` üzerinde FORCE RLS
-- vardır ve migration rolü de politikaya tabidir (bkz. 0002).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM tenant LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    INSERT INTO belge_tipi_politikasi
      (id, tenant_id, tip, saklama_yili, finansal_mi, kaynak_referansi, guncelleme_tarihi)
    VALUES
      -- Yonetim plani ve genel kurul kararlari SURESIZ saklanir: bir dairenin
      -- aidat kuralinin dayanagi bunlardir ve on yil sonra da sorulabilir.
      (gen_random_uuid(), t.id, 'YONETIM_PLANI',      NULL, false, 'KMK md. 28', now()),
      (gen_random_uuid(), t.id, 'GENEL_KURUL_KARARI', NULL, true,  'KMK md. 32 — karar defteri', now()),
      (gen_random_uuid(), t.id, 'TAPU',               NULL, false, 'KMK md. 12', now()),
      -- Fatura ve makbuz FINANSAL: asla silinmez, duzeltme yeni surumle yapilir.
      (gen_random_uuid(), t.id, 'FATURA',             10,   true,  'VUK md. 253 — 5 yil; guvenli tarafta 10', now()),
      (gen_random_uuid(), t.id, 'MAKBUZ',             10,   true,  'VUK md. 253', now()),
      (gen_random_uuid(), t.id, 'KIRA_SOZLESMESI',    10,   false, NULL, now()),
      (gen_random_uuid(), t.id, 'SIGORTA_POLICESI',   10,   false, NULL, now()),
      (gen_random_uuid(), t.id, 'RUHSAT',             NULL, false, NULL, now()),
      (gen_random_uuid(), t.id, 'TEKNIK_RAPOR',       10,   false, NULL, now()),
      (gen_random_uuid(), t.id, 'YAZISMA',            5,    false, NULL, now()),
      (gen_random_uuid(), t.id, 'DIGER',              5,    false, NULL, now())
    ON CONFLICT (tenant_id, tip) DO NOTHING;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON belge TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON belge_tipi_politikasi TO bnos_app;
