-- ===========================================================================
-- BNOS Apartman Yönetimi — 0008_konut_calisani
--
-- Sitede/apartmanda çalışan personel kayıtları.
--
-- ⚠️  `kisi` TABLOSUNA DOKUNULMADI. Personel, `Kisi`'den AYRI bir tablodur:
--     `Kisi` malik/kiracı/sakin ilişkilerinin dayandığı KİMLİK kaydıdır;
--     personel ise bir İSTİHDAM kaydıdır ve kendi yaşam döngüsü vardır
--     (işe giriş · vardiya · SGK · çıkış · zimmet).
--     Aynı tabloya sıkıştırılsaydı, bir kapıcının aynı zamanda o binada
--     kiracı olması durumunda iki farklı kavram tek satıra binerdi ve
--     "işten ayrıldı" işareti kiracılık kaydını da etkilerdi.
--
--     Malik · Kiracı · Sakin modüllerinin veri modeli, ilişkileri ve iş
--     kuralları BU MIGRATION'DA DEĞİŞMEDİ.
--
-- ⚠️  `prisma migrate diff` çıktısı olduğu gibi kullanılmadı (0004-0007
--     notu): elle yazılmış kısmi index'leri düşürmek ister ve FK ekleme
--     `FORCE ROW LEVEL SECURITY` ile çakışır.
-- ===========================================================================

CREATE TYPE "PersonelGorevi" AS ENUM (
  'SITE_MUDURU', 'YONETICI', 'GUVENLIK', 'TEMIZLIK', 'TEKNIK',
  'BAHCIVAN', 'VALE', 'RESEPSIYON', 'HAVUZ_GOREVLISI', 'DIGER'
);

CREATE TYPE "PersonelDurumu" AS ENUM ('AKTIF', 'PASIF');

CREATE TYPE "Vardiya" AS ENUM ('GUNDUZ', 'AKSAM', 'GECE', 'TAM_GUN', 'DONUSUMLU');

CREATE TABLE "konut_calisani" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    -- Site genelinde çalışan personelde NULL; belirli bir apartmana bağlıysa dolu.
    "apartman_id" UUID,
    "ad" VARCHAR(60) NOT NULL,
    "soyad" VARCHAR(60) NOT NULL,
    "gorev" "PersonelGorevi" NOT NULL,
    "departman" VARCHAR(80),
    "telefon" VARCHAR(32),
    "eposta" VARCHAR(180),
    "tc_kimlik_no" VARCHAR(11),
    "sgk_no" VARCHAR(30),
    "ise_giris_tarihi" DATE NOT NULL,
    "isten_ayrilis_tarihi" DATE,
    "vardiya" "Vardiya" NOT NULL DEFAULT 'GUNDUZ',
    "durum" "PersonelDurumu" NOT NULL DEFAULT 'AKTIF',
    "notlar" TEXT,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "konut_calisani_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personel_sertifikasi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "calisan_id" UUID NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "kurum" VARCHAR(120),
    "belge_no" VARCHAR(60),
    "verilis_tarihi" DATE NOT NULL,
    "gecerlilik_bitisi" DATE,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personel_sertifikasi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personel_zimmeti" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "calisan_id" UUID NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "seri_no" VARCHAR(60),
    "adet" INTEGER NOT NULL DEFAULT 1,
    "zimmet_tarihi" DATE NOT NULL,
    -- İade tarihiyle kapanır, SİLİNMEZ: işten ayrılan personelin üzerinde
    -- kalan zimmet, ayrılıştan sonra sorulduğunda kayıtta görünmelidir.
    "iade_tarihi" DATE,
    "notlar" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personel_zimmeti_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "konut_calisani_tenant_id_durum_gorev_idx"
  ON "konut_calisani"("tenant_id", "durum", "gorev");
CREATE INDEX "konut_calisani_tenant_id_apartman_id_idx"
  ON "konut_calisani"("tenant_id", "apartman_id");
CREATE INDEX "personel_sertifikasi_tenant_id_calisan_id_idx"
  ON "personel_sertifikasi"("tenant_id", "calisan_id");
CREATE INDEX "personel_zimmeti_tenant_id_calisan_id_idx"
  ON "personel_zimmeti"("tenant_id", "calisan_id");

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR — FORCE RLS geçici olarak kaldırılır (bkz. 0004 notu).
-- `konut_calisani` üzerinde RLS henüz açılmadığı için alt tabloların ona
-- bakan FK'ları sorun çıkarmaz.
-- ---------------------------------------------------------------------------

ALTER TABLE apartman NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "konut_calisani" ADD CONSTRAINT "konut_calisani_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "konut_calisani" ADD CONSTRAINT "konut_calisani_apartman_id_fkey"
  FOREIGN KEY ("apartman_id") REFERENCES "apartman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE apartman FORCE ROW LEVEL SECURITY;

ALTER TABLE "personel_sertifikasi" ADD CONSTRAINT "personel_sertifikasi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "personel_sertifikasi" ADD CONSTRAINT "personel_sertifikasi_calisan_id_fkey"
  FOREIGN KEY ("calisan_id") REFERENCES "konut_calisani"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personel_zimmeti" ADD CONSTRAINT "personel_zimmeti_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "personel_zimmeti" ADD CONSTRAINT "personel_zimmeti_calisan_id_fkey"
  FOREIGN KEY ("calisan_id") REFERENCES "konut_calisani"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE konut_calisani ENABLE ROW LEVEL SECURITY;
ALTER TABLE konut_calisani FORCE  ROW LEVEL SECURITY;
CREATE POLICY konut_calisani_tenant_isolation ON konut_calisani
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE personel_sertifikasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE personel_sertifikasi FORCE  ROW LEVEL SECURITY;
CREATE POLICY personel_sertifikasi_tenant_isolation ON personel_sertifikasi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE personel_zimmeti ENABLE ROW LEVEL SECURITY;
ALTER TABLE personel_zimmeti FORCE  ROW LEVEL SECURITY;
CREATE POLICY personel_zimmeti_tenant_isolation ON personel_zimmeti
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- Ayrılış işe girişten önce olamaz.
ALTER TABLE konut_calisani ADD CONSTRAINT konut_calisani_tarih_sirasi
  CHECK (isten_ayrilis_tarihi IS NULL OR isten_ayrilis_tarihi >= ise_giris_tarihi);

-- AYRILMIŞ PERSONEL AKTİF OLAMAZ. Ayrılış tarihi girilip durum AKTİF
-- bırakılsaydı, "aktif personel" listesi işten ayrılmış kişileri gösterir ve
-- vardiya planlaması yanlış yapılırdı.
ALTER TABLE konut_calisani ADD CONSTRAINT konut_calisani_durum_tutarlilik
  CHECK (isten_ayrilis_tarihi IS NULL OR durum = 'PASIF');

ALTER TABLE konut_calisani ADD CONSTRAINT konut_calisani_soft_delete_tutarlilik
  CHECK ((silindi_mi = false AND silinme_tarihi IS NULL)
      OR (silindi_mi = true AND silinme_tarihi IS NOT NULL AND silme_gerekcesi IS NOT NULL));

-- TC kimlik no 11 hane ve yalnızca rakam. Biçim denetimi burada da durur:
-- doğrudan SQL ile yazılan bozuk bir kayıt bordroda sorun çıkarır.
ALTER TABLE konut_calisani ADD CONSTRAINT konut_calisani_tc_bicim
  CHECK (tc_kimlik_no IS NULL OR tc_kimlik_no ~ '^[0-9]{11}$');

-- Aynı TC ile AKTİF ikinci kayıt açılamaz; mükerrer personel bordroyu ikiye
-- katlar. Ayrılmış kayıt engellemez: aynı kişi tekrar işe alınabilir.
CREATE UNIQUE INDEX konut_calisani_tc_aktif_uq
  ON konut_calisani (tenant_id, tc_kimlik_no)
  WHERE tc_kimlik_no IS NOT NULL AND silinme_tarihi IS NULL AND isten_ayrilis_tarihi IS NULL;

ALTER TABLE personel_sertifikasi ADD CONSTRAINT personel_sertifikasi_tarih_sirasi
  CHECK (gecerlilik_bitisi IS NULL OR gecerlilik_bitisi >= verilis_tarihi);

ALTER TABLE personel_zimmeti ADD CONSTRAINT personel_zimmeti_tarih_sirasi
  CHECK (iade_tarihi IS NULL OR iade_tarihi >= zimmet_tarihi);

ALTER TABLE personel_zimmeti ADD CONSTRAINT personel_zimmeti_adet_pozitif
  CHECK (adet >= 1);

GRANT SELECT, INSERT, UPDATE, DELETE ON konut_calisani TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON personel_sertifikasi TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON personel_zimmeti TO bnos_app;
