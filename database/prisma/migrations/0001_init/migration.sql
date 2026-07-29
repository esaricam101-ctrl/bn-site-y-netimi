-- ===========================================================================
-- BNOS Apartman YÃ¶netimi â€” 0001_init  (temel / baseline)
--
-- Kaynaklar:
--   ADR-0002  tenant = yÃ¶netilen yerleÅŸke Â· PostgreSQL RLS
--   ADR-0003  Ã§ift taraflÄ± muhasebe
--   ADR-0007  para = Ã¶lÃ§eklenmiÅŸ bigint (numeric(18,4))
--   ADR-0008  hiyerarÅŸi tenant Ä°Ã‡Ä°NDE yaÅŸar
--   BFS v1 Â§5 silme: FINANSAL / ANA_VERI / BELGE
--
-- ---------------------------------------------------------------------------
-- BÄ°RLEÅTÄ°RME NOTU â€” 29 Temmuz 2026
--
-- Bu dosya iki migration'Ä±n birleÅŸimidir:
--   - eski `0001_init`  (yalnÄ±zca elle yazÄ±lan RLS/index bÃ¶lÃ¼mÃ¼)
--   - eski `0002_hiyerarsi_malik_kiraci_sakin`  (elle yazÄ±lan DDL)
--
-- Neden birleÅŸtirildi: eski 0001, Prisma'nÄ±n Ã¼retmesi gereken tablo DDL'ini
-- HÄ°Ã‡ Ä°Ã‡ERMÄ°YORDU. YazÄ±ldÄ±ÄŸÄ± ortamda PostgreSQL kurulu olmadÄ±ÄŸÄ± iÃ§in
-- `prisma migrate dev` Ã§alÄ±ÅŸtÄ±rÄ±lamamÄ±ÅŸ, dosyanÄ±n baÅŸÄ±na gelmesi gereken DDL
-- hiÃ§ Ã¼retilmemiÅŸti. SonuÃ§: migration uygulanamÄ±yordu â€”
--   ERROR: relation "kisi" does not exist
-- Ã§Ã¼nkÃ¼ RLS bloÄŸu var olmayan tablolara ALTER TABLE uyguluyordu.
--
-- Ä°ki migration da HÄ°Ã‡BÄ°R veritabanÄ±na uygulanmamÄ±ÅŸtÄ±; ayrÄ± ayrÄ± tutmak iÃ§in
-- 0001 dÃ¶nemine ait kurgusal bir ÅŸema uydurmak gerekirdi. Bunun yerine tek
-- ve doÄŸru bir temel Ã¼retildi. UygulanmÄ±ÅŸ bir migration silinmedi.
--
-- AÅŸaÄŸÄ±daki DDL `prisma migrate diff --from-empty --to-schema-datamodel`
-- Ã§Ä±ktÄ±sÄ±dÄ±r; ÅŸemayla birebir tutarlÄ±dÄ±r. ArdÄ±ndan gelen "ELLE KORUNAN
-- BÃ–LÃœM" Prisma'nÄ±n Ã¼retemediÄŸi yapÄ±larÄ± iÃ§erir.
-- ===========================================================================

-- CreateEnum
CREATE TYPE "TenantTipi" AS ENUM ('APARTMAN', 'SITE', 'YONETIM_SIRKETI');

-- CreateEnum
CREATE TYPE "TenantDurumu" AS ENUM ('KURULUM', 'AKTIF', 'ASKIDA', 'ARSIV');

-- CreateEnum
CREATE TYPE "BolumNiteligi" AS ENUM ('MESKEN', 'ISYERI', 'DEPO', 'OTOPARK', 'ORTAK_ALAN');

-- CreateEnum
CREATE TYPE "DaireTipi" AS ENUM ('STUDYO', 'BIR_SIFIR', 'BIR_BIR', 'IKI_BIR', 'UC_BIR', 'DORT_BIR', 'BES_BIR', 'DUBLEKS', 'DIGER');

-- CreateEnum
CREATE TYPE "BolumDurumu" AS ENUM ('AKTIF', 'BOS', 'TADILATTA', 'KULLANIM_DISI');

-- CreateEnum
CREATE TYPE "IliskiRolu" AS ENUM ('MALIK', 'KIRACI');

-- CreateEnum
CREATE TYPE "TapuTuru" AS ENUM ('KAT_MULKIYETI', 'KAT_IRTIFAKI', 'ARSA_PAYLI', 'MIRAS_ISTIRAK', 'DIGER');

-- CreateEnum
CREATE TYPE "YakinlikDerecesi" AS ENUM ('KENDISI', 'ES', 'COCUK', 'ANNE_BABA', 'KARDES', 'AKRABA', 'MISAFIR', 'CALISAN', 'DIGER');

-- CreateEnum
CREATE TYPE "PaylasimKurali" AS ENUM ('ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'TUKETIM', 'SABIT_TUTAR', 'KARMA');

-- CreateEnum
CREATE TYPE "SorumlulukTipi" AS ENUM ('MALIKE_AIT', 'KULLANANA_AIT');

-- CreateEnum
CREATE TYPE "KuralKaynagi" AS ENUM ('KMK_VARSAYILAN', 'YONETIM_PLANI', 'GENEL_KURUL_KARARI');

-- CreateEnum
CREATE TYPE "HesapTipi" AS ENUM ('VARLIK', 'BORC', 'OZKAYNAK', 'GELIR', 'GIDER');

-- CreateEnum
CREATE TYPE "FisDurumu" AS ENUM ('TASLAK', 'ISLENDI', 'TERS_KAYITLI');

-- CreateEnum
CREATE TYPE "SorumlulukSirasi" AS ENUM ('ASIL', 'IKINCIL');

-- CreateEnum
CREATE TYPE "IsDurumu" AS ENUM ('BEKLIYOR', 'CALISIYOR', 'BASARILI', 'BASARISIZ');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "kod" VARCHAR(32) NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "tip" "TenantTipi" NOT NULL DEFAULT 'APARTMAN',
    "durum" "TenantDurumu" NOT NULL DEFAULT 'KURULUM',
    "saat_dilimi" VARCHAR(64) NOT NULL DEFAULT 'Europe/Istanbul',
    "para_birimi" CHAR(3) NOT NULL DEFAULT 'TRY',
    "lisans_kodu" VARCHAR(32) NOT NULL,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kisi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ad" VARCHAR(60) NOT NULL,
    "soyad" VARCHAR(60) NOT NULL,
    "eposta" VARCHAR(180),
    "telefon" VARCHAR(32),
    "tc_kimlik_no" VARCHAR(11),
    "anonim_mi" BOOLEAN NOT NULL DEFAULT false,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kullanici" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "eposta" VARCHAR(180) NOT NULL,
    "sifre_hash" VARCHAR(255) NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "son_giris_ani" TIMESTAMPTZ(6),
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kullanici_rolu" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kullanici_id" UUID NOT NULL,
    "rol_kodu" VARCHAR(40) NOT NULL,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kullanici_rolu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apartman" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "adres" TEXT,
    "site_ici_kod" VARCHAR(16),
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "apartman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blok" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "apartman_id" UUID NOT NULL,
    "ad" VARCHAR(40) NOT NULL,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kat" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "blok_id" UUID NOT NULL,
    "no" INTEGER NOT NULL,
    "ad" VARCHAR(40),
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bagimsiz_bolum" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "blok_id" UUID,
    "kat_id" UUID,
    "kapi_no" VARCHAR(16) NOT NULL,
    "ic_kapi_no" VARCHAR(16),
    "kat" INTEGER NOT NULL,
    "nitelik" "BolumNiteligi" NOT NULL DEFAULT 'MESKEN',
    "daire_tipi" "DaireTipi",
    "kullanim_amaci" VARCHAR(80),
    "durum" "BolumDurumu" NOT NULL DEFAULT 'AKTIF',
    "brut_m2" DECIMAL(10,2) NOT NULL,
    "net_m2" DECIMAL(10,2) NOT NULL,
    "tapu_ada" VARCHAR(20),
    "tapu_parsel" VARCHAR(20),
    "tapu_pafta" VARCHAR(20),
    "tapu_bagimsiz_bolum_no" VARCHAR(20),
    "tapu_cilt" VARCHAR(20),
    "tapu_sahife" VARCHAR(20),
    "arsa_payi_pay" BIGINT NOT NULL,
    "arsa_payi_payda" BIGINT NOT NULL,
    "aidat_muafiyeti" BOOLEAN NOT NULL DEFAULT false,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bagimsiz_bolum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bolum_iliskisi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "rol" "IliskiRolu" NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bolum_iliskisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "malik" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "hisse_pay" BIGINT NOT NULL,
    "hisse_payda" BIGINT NOT NULL,
    "tapu_turu" "TapuTuru" NOT NULL DEFAULT 'KAT_MULKIYETI',
    "tapu_baslangic" DATE NOT NULL,
    "tapu_bitis" DATE,
    "tapu_yevmiye_no" VARCHAR(40),
    "vekil_kisi_id" UUID,
    "vekaletname_no" VARCHAR(40),
    "vekalet_bitis_tarihi" DATE,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "malik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiraci" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE,
    "sozlesme_no" VARCHAR(40),
    "sozlesme_tarihi" DATE,
    "depozito" DECIMAL(18,4),
    "depozito_iade_tarihi" DATE,
    "tahliye_tarihi" DATE,
    "tahliye_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kiraci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sakin" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "yakinlik_derecesi" "YakinlikDerecesi" NOT NULL DEFAULT 'KENDISI',
    "giris_tarihi" DATE NOT NULL,
    "cikis_tarihi" DATE,
    "acil_durum_kisi_adi" VARCHAR(120),
    "acil_durum_telefon" VARCHAR(24),
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sakin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gider_turu" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kod" VARCHAR(40) NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "paylasim_kurali" "PaylasimKurali" NOT NULL,
    "sorumluluk_tipi" "SorumlulukTipi" NOT NULL,
    "kural_kaynagi" "KuralKaynagi" NOT NULL,
    "kaynak_referansi" VARCHAR(200),
    "karma_bilesenler" JSONB,
    "malik_paylasimi" VARCHAR(20) NOT NULL DEFAULT 'HISSE_ORANI',
    "aktif_mi" BOOLEAN NOT NULL DEFAULT true,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gider_turu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hesap" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kod" VARCHAR(20) NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "tip" "HesapTipi" NOT NULL,
    "ust_hesap_id" UUID,
    "fis_kesilebilir_mi" BOOLEAN NOT NULL DEFAULT true,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hesap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yevmiye_fisi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fis_no" VARCHAR(32) NOT NULL,
    "tarih" DATE NOT NULL,
    "aciklama" TEXT NOT NULL,
    "kaynak_tipi" VARCHAR(40) NOT NULL,
    "kaynak_id" UUID,
    "durum" "FisDurumu" NOT NULL DEFAULT 'TASLAK',
    "ters_kaydi_olan_id" UUID,
    "islenme_ani" TIMESTAMPTZ(6),
    "isleyen_kisi" UUID,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yevmiye_fisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yevmiye_satiri" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fis_id" UUID NOT NULL,
    "hesap_id" UUID NOT NULL,
    "borc" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "alacak" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "aciklama" TEXT,
    "bolum_id" UUID,

    CONSTRAINT "yevmiye_satiri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borc" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "gider_turu_kodu" VARCHAR(40) NOT NULL,
    "tahakkuk_no" VARCHAR(32) NOT NULL,
    "tutar" DECIMAL(18,4) NOT NULL,
    "odenen" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vade_tarihi" DATE NOT NULL,
    "tahakkuk_donemi" DATE NOT NULL,
    "kapandi_mi" BOOLEAN NOT NULL DEFAULT false,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borc_sorumlusu" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "borc_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "sira" "SorumlulukSirasi" NOT NULL,
    "rol" "IliskiRolu" NOT NULL,
    "cozumleme_tarihi" DATE NOT NULL,
    "pay" DECIMAL(18,4) NOT NULL,
    "odenen" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "agirlik" BIGINT NOT NULL DEFAULT 1,
    "kapandi_mi" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "borc_sorumlusu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_kaydi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "principal_id" UUID NOT NULL,
    "principal_tipi" VARCHAR(16) NOT NULL,
    "eylem" VARCHAR(24) NOT NULL,
    "varlik" VARCHAR(60) NOT NULL,
    "varlik_id" UUID NOT NULL,
    "onceki_deger" JSONB,
    "sonraki_deger" JSONB,
    "gerekce" TEXT,
    "correlation_id" UUID NOT NULL,
    "ip" VARCHAR(45),
    "kullanici_ajani" TEXT,
    "olusma_ani" TIMESTAMPTZ(6) NOT NULL,
    "onceki_hash" VARCHAR(64),
    "hash" VARCHAR(64) NOT NULL,

    CONSTRAINT "audit_kaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_kayit" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "zarf" JSONB NOT NULL,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL,
    "yayinlanma_tarihi" TIMESTAMPTZ(6),
    "deneme_sayisi" INTEGER NOT NULL DEFAULT 0,
    "son_hata" TEXT,

    CONSTRAINT "outbox_kayit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numara_sayaci" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "seri_kodu" VARCHAR(40) NOT NULL,
    "kapsam_anahtari" VARCHAR(120) NOT NULL,
    "mevcut_deger" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "numara_sayaci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "is_calistirma" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "is_kodu" VARCHAR(60) NOT NULL,
    "donem_anahtari" VARCHAR(40) NOT NULL,
    "durum" "IsDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    "baslangic" TIMESTAMPTZ(6),
    "bitis" TIMESTAMPTZ(6),
    "sonuc" JSONB,
    "hata" TEXT,

    CONSTRAINT "is_calistirma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_kod_key" ON "tenant"("kod");

-- CreateIndex
CREATE INDEX "kisi_tenant_id_soyad_ad_idx" ON "kisi"("tenant_id", "soyad", "ad");

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_kisi_id_key" ON "kullanici"("kisi_id");

-- CreateIndex
CREATE UNIQUE INDEX "kullanici_rolu_kullanici_id_rol_kodu_key" ON "kullanici_rolu"("kullanici_id", "rol_kodu");

-- CreateIndex
CREATE INDEX "apartman_tenant_id_idx" ON "apartman"("tenant_id");

-- CreateIndex
CREATE INDEX "blok_tenant_id_apartman_id_idx" ON "blok"("tenant_id", "apartman_id");

-- CreateIndex
CREATE INDEX "kat_tenant_id_blok_id_idx" ON "kat"("tenant_id", "blok_id");

-- CreateIndex
CREATE INDEX "bagimsiz_bolum_tenant_id_blok_id_idx" ON "bagimsiz_bolum"("tenant_id", "blok_id");

-- CreateIndex
CREATE INDEX "bagimsiz_bolum_tenant_id_kat_id_idx" ON "bagimsiz_bolum"("tenant_id", "kat_id");

-- CreateIndex
CREATE INDEX "bolum_iliskisi_tenant_id_bolum_id_rol_idx" ON "bolum_iliskisi"("tenant_id", "bolum_id", "rol");

-- CreateIndex
CREATE INDEX "malik_tenant_id_bolum_id_tapu_baslangic_idx" ON "malik"("tenant_id", "bolum_id", "tapu_baslangic");

-- CreateIndex
CREATE INDEX "kiraci_tenant_id_bolum_id_baslangic_idx" ON "kiraci"("tenant_id", "bolum_id", "baslangic");

-- CreateIndex
CREATE INDEX "sakin_tenant_id_bolum_id_giris_tarihi_idx" ON "sakin"("tenant_id", "bolum_id", "giris_tarihi");

-- CreateIndex
CREATE INDEX "gider_turu_tenant_id_kod_idx" ON "gider_turu"("tenant_id", "kod");

-- CreateIndex
CREATE INDEX "hesap_tenant_id_kod_idx" ON "hesap"("tenant_id", "kod");

-- CreateIndex
CREATE INDEX "yevmiye_fisi_tenant_id_tarih_idx" ON "yevmiye_fisi"("tenant_id", "tarih");

-- CreateIndex
CREATE INDEX "yevmiye_satiri_tenant_id_hesap_id_idx" ON "yevmiye_satiri"("tenant_id", "hesap_id");

-- CreateIndex
CREATE INDEX "borc_tenant_id_bolum_id_kapandi_mi_idx" ON "borc"("tenant_id", "bolum_id", "kapandi_mi");

-- CreateIndex
CREATE INDEX "borc_tenant_id_vade_tarihi_idx" ON "borc"("tenant_id", "vade_tarihi");

-- CreateIndex
CREATE INDEX "borc_sorumlusu_tenant_id_kisi_id_idx" ON "borc_sorumlusu"("tenant_id", "kisi_id");

-- CreateIndex
CREATE UNIQUE INDEX "borc_sorumlusu_borc_id_kisi_id_sira_key" ON "borc_sorumlusu"("borc_id", "kisi_id", "sira");

-- CreateIndex
CREATE INDEX "audit_kaydi_tenant_id_olusma_ani_idx" ON "audit_kaydi"("tenant_id", "olusma_ani");

-- CreateIndex
CREATE INDEX "audit_kaydi_tenant_id_varlik_varlik_id_idx" ON "audit_kaydi"("tenant_id", "varlik", "varlik_id");

-- CreateIndex
CREATE INDEX "outbox_kayit_yayinlanma_tarihi_idx" ON "outbox_kayit"("yayinlanma_tarihi");

-- CreateIndex
CREATE UNIQUE INDEX "numara_sayaci_tenant_id_seri_kodu_kapsam_anahtari_key" ON "numara_sayaci"("tenant_id", "seri_kodu", "kapsam_anahtari");

-- CreateIndex
CREATE UNIQUE INDEX "is_calistirma_is_kodu_tenant_id_donem_anahtari_key" ON "is_calistirma"("is_kodu", "tenant_id", "donem_anahtari");

-- AddForeignKey
ALTER TABLE "kisi" ADD CONSTRAINT "kisi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kullanici" ADD CONSTRAINT "kullanici_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kullanici" ADD CONSTRAINT "kullanici_kisi_id_fkey" FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kullanici_rolu" ADD CONSTRAINT "kullanici_rolu_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartman" ADD CONSTRAINT "apartman_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blok" ADD CONSTRAINT "blok_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blok" ADD CONSTRAINT "blok_apartman_id_fkey" FOREIGN KEY ("apartman_id") REFERENCES "apartman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kat" ADD CONSTRAINT "kat_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kat" ADD CONSTRAINT "kat_blok_id_fkey" FOREIGN KEY ("blok_id") REFERENCES "blok"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bagimsiz_bolum" ADD CONSTRAINT "bagimsiz_bolum_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bagimsiz_bolum" ADD CONSTRAINT "bagimsiz_bolum_blok_id_fkey" FOREIGN KEY ("blok_id") REFERENCES "blok"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bagimsiz_bolum" ADD CONSTRAINT "bagimsiz_bolum_kat_id_fkey" FOREIGN KEY ("kat_id") REFERENCES "kat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolum_iliskisi" ADD CONSTRAINT "bolum_iliskisi_bolum_id_fkey" FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bolum_iliskisi" ADD CONSTRAINT "bolum_iliskisi_kisi_id_fkey" FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malik" ADD CONSTRAINT "malik_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malik" ADD CONSTRAINT "malik_bolum_id_fkey" FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malik" ADD CONSTRAINT "malik_kisi_id_fkey" FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "malik" ADD CONSTRAINT "malik_vekil_kisi_id_fkey" FOREIGN KEY ("vekil_kisi_id") REFERENCES "kisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiraci" ADD CONSTRAINT "kiraci_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiraci" ADD CONSTRAINT "kiraci_bolum_id_fkey" FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiraci" ADD CONSTRAINT "kiraci_kisi_id_fkey" FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sakin" ADD CONSTRAINT "sakin_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sakin" ADD CONSTRAINT "sakin_bolum_id_fkey" FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sakin" ADD CONSTRAINT "sakin_kisi_id_fkey" FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gider_turu" ADD CONSTRAINT "gider_turu_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hesap" ADD CONSTRAINT "hesap_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hesap" ADD CONSTRAINT "hesap_ust_hesap_id_fkey" FOREIGN KEY ("ust_hesap_id") REFERENCES "hesap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yevmiye_fisi" ADD CONSTRAINT "yevmiye_fisi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yevmiye_satiri" ADD CONSTRAINT "yevmiye_satiri_fis_id_fkey" FOREIGN KEY ("fis_id") REFERENCES "yevmiye_fisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yevmiye_satiri" ADD CONSTRAINT "yevmiye_satiri_hesap_id_fkey" FOREIGN KEY ("hesap_id") REFERENCES "hesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borc" ADD CONSTRAINT "borc_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borc" ADD CONSTRAINT "borc_bolum_id_fkey" FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borc_sorumlusu" ADD CONSTRAINT "borc_sorumlusu_borc_id_fkey" FOREIGN KEY ("borc_id") REFERENCES "borc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borc_sorumlusu" ADD CONSTRAINT "borc_sorumlusu_kisi_id_fkey" FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_kaydi" ADD CONSTRAINT "audit_kaydi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_kayit" ADD CONSTRAINT "outbox_kayit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numara_sayaci" ADD CONSTRAINT "numara_sayaci_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "is_calistirma" ADD CONSTRAINT "is_calistirma_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===========================================================================
-- ELLE KORUNAN BÃ–LÃœM â€” Prisma bunlarÄ± ÅŸemadan ÃœRETEMEZ
--
-- YukarÄ±daki DDL `prisma migrate diff` Ã§Ä±ktÄ±sÄ±dÄ±r ve ÅŸemadan tÃ¼retilir.
-- AÅŸaÄŸÄ±daki bÃ¶lÃ¼m her migration'da elle korunur ve gÃ¶zden geÃ§irilir.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) ROW LEVEL SECURITY  (ADR-0002 Â· BFS v1 Â§2.2)
--
-- RLS son savunma hattÄ±dÄ±r. Uygulama rolÃ¼ `bnos_app` NOBYPASSRLS'tir; bir
-- sorgu tenant baÄŸlamÄ± kurulmadan Ã§alÄ±ÅŸtÄ±rÄ±lÄ±rsa satÄ±r DÃ–NMEZ, sessizce
-- baÅŸka tenant'Ä±n verisi gelmez.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.tenant_id', true);
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION
      'Tenant baglami kurulmadan sorgu calistirilamaz (ADR-0002 Â· BFS v1 Â§2.3). '
      'Her transaction basinda SET LOCAL app.tenant_id calistirilmalidir.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v::uuid;
END $$;

-- `tenant` DIÅINDAKÄ° HER TABLO tenant kapsamlÄ±dÄ±r. Liste elle yazÄ±lmaz;
-- tenant_id sÃ¼tunu olan her tablo taranÄ±r. Elle yazÄ±lan bir liste, yeni tablo
-- eklendiÄŸinde gÃ¼ncellenmeyi unutulur ve tablo RLS'siz kalÄ±r â€” HATA SESSÄ°ZDÄ°R.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'tenant_id'
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- Tenant tablosu RLS TAÅIMAZ: katalog tablosudur ve tenant seÃ§iminden Ã–NCE
-- okunur. EriÅŸimi uygulama katmanÄ±nda (KapÄ± 2) denetlenir. Bu istisna
-- bilinÃ§lidir ve BFS v1 Â§2.4 uyarÄ±nca gerekÃ§elenmiÅŸtir.

-- ---------------------------------------------------------------------------
-- 2) KISMÄ° UNIQUE INDEX'LER  (BFS v1 Â§5.3 kural 1)
--
-- Soft-deleted "A-3 dairesi", yeni "A-3" oluÅŸturulmasÄ±nÄ± ENGELLEMEMELÄ°DÄ°R.
-- Bu kural atlanÄ±rsa silme iÅŸlemi ileride kaydÄ± yeniden oluÅŸturmayÄ±
-- Ä°MKÃ‚NSIZ kÄ±lar.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX kisi_eposta_uq
  ON kisi (tenant_id, eposta) WHERE silinme_tarihi IS NULL AND eposta IS NOT NULL;

CREATE UNIQUE INDEX kullanici_eposta_uq
  ON kullanici (tenant_id, eposta) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX apartman_ad_uq
  ON apartman (tenant_id, ad) WHERE silinme_tarihi IS NULL;

-- Blok adÄ± TENANT genelinde deÄŸil, APARTMAN iÃ§inde tekildir: sitede iki
-- apartmanÄ±n da "A Blok"u olabilir (ADR-0008).
CREATE UNIQUE INDEX blok_ad_uq
  ON blok (tenant_id, apartman_id, ad) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX kat_no_uq
  ON kat (tenant_id, blok_id, no) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX bagimsiz_bolum_kapi_no_uq
  ON bagimsiz_bolum (tenant_id, blok_id, kapi_no) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX gider_turu_kod_uq
  ON gider_turu (tenant_id, kod) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX hesap_kod_uq
  ON hesap (tenant_id, kod) WHERE silinme_tarihi IS NULL;

-- Finansal kayÄ±tlar soft delete TAÅIMAZ (BFS v1 Â§5.1) â€” koÅŸulsuz unique.
CREATE UNIQUE INDEX yevmiye_fis_no_uq ON yevmiye_fisi (tenant_id, fis_no);
CREATE UNIQUE INDEX borc_tahakkuk_no_uq ON borc (tenant_id, tahakkuk_no, bolum_id);

-- Malik/kiracÄ±/sakin soft delete TAÅIMAZ: dÃ¶nem kapatÄ±lÄ±r, kayÄ±t silinmez.
-- AynÄ± kiÅŸi aynÄ± bÃ¶lÃ¼mde aynÄ± tarihte iki kez kaydedilemez; tarihÃ§e korunur.
CREATE UNIQUE INDEX malik_kisi_donem_uq
  ON malik (tenant_id, bolum_id, kisi_id, tapu_baslangic);

CREATE UNIQUE INDEX kiraci_kisi_donem_uq
  ON kiraci (tenant_id, bolum_id, kisi_id, baslangic);

CREATE UNIQUE INDEX sakin_kisi_donem_uq
  ON sakin (tenant_id, bolum_id, kisi_id, giris_tarihi);

-- ---------------------------------------------------------------------------
-- 3) BÃœTÃœNLÃœK KISITLARI
-- ---------------------------------------------------------------------------

-- Bir yevmiye satÄ±rÄ±nda borÃ§ VEYA alacak dolu olur, ikisi birden deÄŸil (ADR-0003).
ALTER TABLE yevmiye_satiri ADD CONSTRAINT yevmiye_satiri_borc_veya_alacak
  CHECK ((borc > 0 AND alacak = 0) OR (alacak > 0 AND borc = 0));

ALTER TABLE yevmiye_satiri ADD CONSTRAINT yevmiye_satiri_pozitif
  CHECK (borc >= 0 AND alacak >= 0);

ALTER TABLE borc ADD CONSTRAINT borc_odenen_sinir
  CHECK (odenen >= 0 AND odenen <= tutar);

-- Arsa payÄ± geÃ§erli kesir olmalÄ±dÄ±r (KMK md. 3). ToplamÄ±n tamÄ± etmesi tek
-- satÄ±rdan doÄŸrulanamaz; uygulama katmanÄ±nda zorlanÄ±r.
ALTER TABLE bagimsiz_bolum ADD CONSTRAINT bagimsiz_bolum_arsa_payi
  CHECK (arsa_payi_payda > 0 AND arsa_payi_pay >= 0 AND arsa_payi_pay <= arsa_payi_payda);

ALTER TABLE bagimsiz_bolum ADD CONSTRAINT bagimsiz_bolum_m2
  CHECK (brut_m2 > 0 AND net_m2 > 0 AND net_m2 <= brut_m2);

ALTER TABLE bolum_iliskisi ADD CONSTRAINT bolum_iliskisi_tarih_sirasi
  CHECK (bitis IS NULL OR bitis >= baslangic);

-- Hisse geÃ§erli bir kesirdir; toplamÄ±n tamÄ± etmesi uygulama katmanÄ±nda
-- (hisseleriDogrula) zorlanÄ±r â€” tek satÄ±rdan bakarak doÄŸrulanamaz.
ALTER TABLE malik ADD CONSTRAINT malik_hisse_gecerli
  CHECK (hisse_payda > 0 AND hisse_pay > 0 AND hisse_pay <= hisse_payda);

ALTER TABLE malik ADD CONSTRAINT malik_tarih_sirasi
  CHECK (tapu_bitis IS NULL OR tapu_bitis >= tapu_baslangic);

-- VekÃ¢let bilgisi ya tÃ¼mÃ¼yle vardÄ±r ya da yoktur; yarÄ±m kayÄ±t vekilin
-- yetkisini belirsiz bÄ±rakÄ±r (C-4).
ALTER TABLE malik ADD CONSTRAINT malik_vekalet_butun
  CHECK ((vekil_kisi_id IS NULL AND vekaletname_no IS NULL)
      OR (vekil_kisi_id IS NOT NULL AND vekaletname_no IS NOT NULL));

ALTER TABLE kiraci ADD CONSTRAINT kiraci_tarih_sirasi
  CHECK (bitis IS NULL OR bitis >= baslangic);

ALTER TABLE kiraci ADD CONSTRAINT kiraci_depozito_pozitif
  CHECK (depozito IS NULL OR depozito >= 0);

ALTER TABLE kiraci ADD CONSTRAINT kiraci_tahliye_sirasi
  CHECK (tahliye_tarihi IS NULL OR tahliye_tarihi >= baslangic);

ALTER TABLE sakin ADD CONSTRAINT sakin_tarih_sirasi
  CHECK (cikis_tarihi IS NULL OR cikis_tarihi >= giris_tarihi);

-- KARMA dÄ±ÅŸÄ±nda bileÅŸen tanÄ±mlanamaz; KARMA ise bileÅŸensiz olamaz.
ALTER TABLE gider_turu ADD CONSTRAINT gider_turu_karma_butun
  CHECK ((paylasim_kurali = 'KARMA' AND karma_bilesenler IS NOT NULL)
      OR (paylasim_kurali <> 'KARMA' AND karma_bilesenler IS NULL));

-- Override daima kaynak referansÄ± taÅŸÄ±r â€” kuralÄ±n nereden geldiÄŸi kaybolmaz.
ALTER TABLE gider_turu ADD CONSTRAINT gider_turu_kaynak_referansi
  CHECK (kural_kaynagi = 'KMK_VARSAYILAN' OR kaynak_referansi IS NOT NULL);

ALTER TABLE gider_turu ADD CONSTRAINT gider_turu_malik_paylasimi
  CHECK (malik_paylasimi IN ('ESIT', 'HISSE_ORANI', 'MANUEL'));

-- KiÅŸi payÄ± negatif olamaz ve Ã¶denen payÄ± aÅŸamaz.
ALTER TABLE borc_sorumlusu ADD CONSTRAINT borc_sorumlusu_pay_sinir
  CHECK (pay >= 0 AND odenen >= 0 AND odenen <= pay);

-- Soft delete tutarlÄ±lÄ±ÄŸÄ±: silindi_mi true ise gerekÃ§e ve tarih dolu olmalÄ±dÄ±r
-- (BFS v1 Â§5.2). Liste taranarak Ã¼retilir; soft delete taÅŸÄ±yan her tablo
-- kapsanÄ±r.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'silindi_mi'
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK ((silindi_mi = false AND silinme_tarihi IS NULL) OR (silindi_mi = true AND silinme_tarihi IS NOT NULL AND silme_gerekcesi IS NOT NULL))',
      t, t || '_soft_delete_tutarlilik'
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) AUDIT ZÄ°NCÄ°RÄ° â€” deÄŸiÅŸtirilemezlik
--
-- Audit kaydÄ± UPDATE ve DELETE kabul etmez. Bu hukuki gerekliliÄŸin sonucudur;
-- Event Sourcing DEÄÄ°LDÄ°R (ADR v1.1 Â§31).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_degistirilemez() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit kaydi degistirilemez veya silinemez (ADR v1.1 Â§31).'
    USING ERRCODE = '42501';
END $$;

CREATE TRIGGER audit_kaydi_degistirilemez
  BEFORE UPDATE OR DELETE ON audit_kaydi
  FOR EACH ROW EXECUTE FUNCTION audit_degistirilemez();

-- ---------------------------------------------------------------------------
-- 5) YETKÄ°LER
--
-- Migration `bnos_migrator` ile koÅŸar; uygulama `bnos_app` ile baÄŸlanÄ±r ve
-- ÅŸema deÄŸiÅŸtiremez. Ä°kisi de NOBYPASSRLS'tir.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bnos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bnos_app;

