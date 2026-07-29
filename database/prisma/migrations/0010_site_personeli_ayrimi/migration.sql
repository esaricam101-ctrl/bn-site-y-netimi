-- ===========================================================================
-- BNOS Apartman Yönetimi — 0010_site_personeli_ayrimi
--
-- İKİ AYRI KAVRAM TEK TABLODA BİRLEŞTİRİLMİŞTİ. Ayrılıyor:
--
--   A) SİTE PERSONELİ — İŞVEREN YÖNETİMDİR.
--      Site müdürü, yönetici, güvenlik, temizlik, teknik, bahçıvan, vale,
--      resepsiyon, havuz görevlisi. Ücreti işletme projesinden ödenir,
--      SGK'sı yönetim tarafından yapılır, vardiyası yönetim planlar,
--      zimmeti yönetimin malıdır.
--
--   B) DAİRE GÖREVLİSİ — İŞVEREN MALİK / KİRACI / SAKİNDİR.
--      Çocuk bakıcısı, hasta bakıcısı, ev yardımcısı, temizlikçi, aşçı,
--      şoför, özel güvenlik. BİR BAĞIMSIZ BÖLÜME hizmet eder. Yönetimin
--      işvereni olmadığı kişidir; yönetim bu kaydı yalnızca **site
--      girişi/güvenlik kütüğü** olarak tutar.
--
-- NEDEN AYRI TABLO:
--   · SGK · departman · vardiya · zimmet alanları yönetimin yükümlülüğüdür.
--     Daire görevlisinde bu alanların doldurulması, yönetimi hukuken
--     işveren gibi gösterirdi (5510 s.K. yükümlülüğü işvereninkidir).
--   · Site personeli site genelinde çalışır (`apartman_id` opsiyonel);
--     daire görevlisi ZORUNLU olarak tek bağımsız bölüme bağlıdır.
--   · Aynı TC ile ikinci AKTİF kayıt yasağı: personelde tenant genelinde
--     (bordroyu ikiye katlar), daire görevlisinde BÖLÜM BAŞINA (aynı
--     temizlikçinin üç ayrı dairede çalışması olağandır).
--   · KVKK: veri sorumlusu farklıdır. Personel verisinin sorumlusu
--     yönetim, daire görevlisi verisinin sorumlusu onu çalıştıran maliktir.
--
-- ⚠️  0008/0009 DÜZENLENMEDİ (uygulanmış migration'ın sağlama toplamı).
--     0008'de kurulan tablo veriyle birlikte `site_personeli` adına
--     TAŞINIYOR; RENAME veri kopyalamaz, satır kaybı üretmez.
--
-- ⚠️  Malik · Kiracı · Sakin · `kisi` tablolarına DOKUNULMADI.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) MEVCUT TABLO → SİTE PERSONELİ
--
-- 0009'da `konut_calisani` → `daire_gorevlisi` yapılmıştı; asıl kavram
-- yönetim personeli olduğu için 0008'in sözlüğüne (`personel`) dönülüyor.
-- `daire_gorevlisi` adı, aşağıda kurulacak GERÇEK daire görevlisi tablosu
-- için serbest bırakılıyor.
-- ---------------------------------------------------------------------------

ALTER TABLE daire_gorevlisi     RENAME TO site_personeli;
ALTER TABLE gorevli_sertifikasi RENAME TO personel_sertifikasi;
ALTER TABLE gorevli_zimmeti     RENAME TO personel_zimmeti;

ALTER TABLE personel_sertifikasi RENAME COLUMN gorevli_id TO personel_id;
ALTER TABLE personel_zimmeti     RENAME COLUMN gorevli_id TO personel_id;

ALTER TYPE "GorevTuru"     RENAME TO "PersonelGorevi";
ALTER TYPE "GorevliDurumu" RENAME TO "PersonelDurumu";

ALTER INDEX daire_gorevlisi_pkey RENAME TO site_personeli_pkey;
ALTER INDEX daire_gorevlisi_tenant_id_durum_gorev_idx
  RENAME TO site_personeli_tenant_id_durum_gorev_idx;
ALTER INDEX daire_gorevlisi_tenant_id_apartman_id_idx
  RENAME TO site_personeli_tenant_id_apartman_id_idx;
ALTER INDEX daire_gorevlisi_tc_aktif_uq RENAME TO site_personeli_tc_aktif_uq;

ALTER INDEX gorevli_sertifikasi_pkey RENAME TO personel_sertifikasi_pkey;
ALTER INDEX gorevli_sertifikasi_tenant_id_gorevli_id_idx
  RENAME TO personel_sertifikasi_tenant_id_personel_id_idx;
ALTER INDEX gorevli_zimmeti_pkey RENAME TO personel_zimmeti_pkey;
ALTER INDEX gorevli_zimmeti_tenant_id_gorevli_id_idx
  RENAME TO personel_zimmeti_tenant_id_personel_id_idx;

ALTER TABLE site_personeli
  RENAME CONSTRAINT daire_gorevlisi_tenant_id_fkey TO site_personeli_tenant_id_fkey;
ALTER TABLE site_personeli
  RENAME CONSTRAINT daire_gorevlisi_apartman_id_fkey TO site_personeli_apartman_id_fkey;
ALTER TABLE site_personeli
  RENAME CONSTRAINT daire_gorevlisi_tarih_sirasi TO site_personeli_tarih_sirasi;
ALTER TABLE site_personeli
  RENAME CONSTRAINT daire_gorevlisi_durum_tutarlilik TO site_personeli_durum_tutarlilik;
ALTER TABLE site_personeli
  RENAME CONSTRAINT daire_gorevlisi_soft_delete_tutarlilik
  TO site_personeli_soft_delete_tutarlilik;
ALTER TABLE site_personeli
  RENAME CONSTRAINT daire_gorevlisi_tc_bicim TO site_personeli_tc_bicim;

ALTER TABLE personel_sertifikasi
  RENAME CONSTRAINT gorevli_sertifikasi_tenant_id_fkey TO personel_sertifikasi_tenant_id_fkey;
ALTER TABLE personel_sertifikasi
  RENAME CONSTRAINT gorevli_sertifikasi_gorevli_id_fkey TO personel_sertifikasi_personel_id_fkey;
ALTER TABLE personel_sertifikasi
  RENAME CONSTRAINT gorevli_sertifikasi_tarih_sirasi TO personel_sertifikasi_tarih_sirasi;

ALTER TABLE personel_zimmeti
  RENAME CONSTRAINT gorevli_zimmeti_tenant_id_fkey TO personel_zimmeti_tenant_id_fkey;
ALTER TABLE personel_zimmeti
  RENAME CONSTRAINT gorevli_zimmeti_gorevli_id_fkey TO personel_zimmeti_personel_id_fkey;
ALTER TABLE personel_zimmeti
  RENAME CONSTRAINT gorevli_zimmeti_tarih_sirasi TO personel_zimmeti_tarih_sirasi;
ALTER TABLE personel_zimmeti
  RENAME CONSTRAINT gorevli_zimmeti_adet_pozitif TO personel_zimmeti_adet_pozitif;

ALTER POLICY daire_gorevlisi_tenant_isolation ON site_personeli
  RENAME TO site_personeli_tenant_isolation;
ALTER POLICY gorevli_sertifikasi_tenant_isolation ON personel_sertifikasi
  RENAME TO personel_sertifikasi_tenant_isolation;
ALTER POLICY gorevli_zimmeti_tenant_isolation ON personel_zimmeti
  RENAME TO personel_zimmeti_tenant_isolation;

GRANT SELECT, INSERT, UPDATE, DELETE ON site_personeli       TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON personel_sertifikasi TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON personel_zimmeti     TO bnos_app;

-- ---------------------------------------------------------------------------
-- 2) DAİRE GÖREVLİSİ — yeni tablo (ev hizmetleri)
--
-- `Cinsiyet` burada kurulur; 0011 aynı tipi `kisi` ve `misafir` için
-- kullanır. Enum'un ayrı migration'da açılıp aynı transaction'da
-- kullanılması PostgreSQL'de mümkün olmadığından tip, kendisini ilk
-- kullanan migration'da tanımlanır.
-- ---------------------------------------------------------------------------

CREATE TYPE "Cinsiyet" AS ENUM ('KADIN', 'ERKEK', 'BELIRTILMEMIS');

CREATE TYPE "DaireGorevi" AS ENUM (
  'COCUK_BAKICISI', 'HASTA_BAKICISI', 'YASLI_BAKICISI', 'EV_YARDIMCISI',
  'TEMIZLIK', 'ASCI', 'SOFOR', 'OZEL_GUVENLIK', 'OZEL_OGRETMEN', 'DIGER'
);

CREATE TYPE "DaireGorevlisiDurumu" AS ENUM ('AKTIF', 'PASIF');

-- Görevliyi kim çalıştırıyor. Yönetim İŞVEREN DEĞİLDİR; bu alan sorumluluğun
-- kimde olduğunu kayda geçirir (KVKK veri sorumlusu · SGK yükümlüsü).
CREATE TYPE "DaireGorevlisiIsvereni" AS ENUM ('MALIK', 'KIRACI', 'SAKIN');

CREATE TABLE "daire_gorevlisi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    -- ZORUNLU: görevli her zaman tek bir bağımsız bölüme hizmet eder.
    -- Site personelinin aksine "site genelinde görevli" diye bir hâli yoktur.
    "bolum_id" UUID NOT NULL,

    "isveren_tipi" "DaireGorevlisiIsvereni" NOT NULL,
    -- Hangi kişi çalıştırıyor. İsteğe bağlı: yönetim çoğu zaman yalnızca
    -- "daire 12'nin bakıcısı" bilgisine sahiptir, işveren kişiyi kayda
    -- geçirmek zorunlu tutulsaydı görevli hiç kaydedilemezdi.
    "isveren_kisi_id" UUID,

    "ad" VARCHAR(60) NOT NULL,
    "soyad" VARCHAR(60) NOT NULL,
    "tc_kimlik_no" VARCHAR(11),
    "telefon" VARCHAR(32),
    "eposta" VARCHAR(180),
    "dogum_tarihi" DATE,
    "cinsiyet" "Cinsiyet" NOT NULL DEFAULT 'BELIRTILMEMIS',
    "adres" TEXT,

    "gorev" "DaireGorevi" NOT NULL,
    "calisma_baslangic" DATE NOT NULL,
    "calisma_bitis" DATE,
    "aciklama" TEXT,
    "notlar" TEXT,
    "durum" "DaireGorevlisiDurumu" NOT NULL DEFAULT 'AKTIF',

    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daire_gorevlisi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "daire_gorevlisi_tenant_id_bolum_id_durum_idx"
  ON "daire_gorevlisi"("tenant_id", "bolum_id", "durum");
CREATE INDEX "daire_gorevlisi_tenant_id_durum_gorev_idx"
  ON "daire_gorevlisi"("tenant_id", "durum", "gorev");
CREATE INDEX "daire_gorevlisi_tenant_id_isveren_kisi_id_idx"
  ON "daire_gorevlisi"("tenant_id", "isveren_kisi_id");

-- FK doğrulama taraması hedef tabloyu okur; FORCE RLS altında `app_tenant_id()`
-- hata verir (bkz. 0004). Yeni tabloda RLS henüz açık olmadığı için yalnızca
-- hedefler geçici olarak muaf tutulur.
ALTER TABLE bagimsiz_bolum NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi           NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "daire_gorevlisi" ADD CONSTRAINT "daire_gorevlisi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daire_gorevlisi" ADD CONSTRAINT "daire_gorevlisi_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daire_gorevlisi" ADD CONSTRAINT "daire_gorevlisi_isveren_kisi_id_fkey"
  FOREIGN KEY ("isveren_kisi_id") REFERENCES "kisi"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE bagimsiz_bolum FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi           FORCE ROW LEVEL SECURITY;

ALTER TABLE daire_gorevlisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE daire_gorevlisi FORCE  ROW LEVEL SECURITY;
CREATE POLICY daire_gorevlisi_tenant_isolation ON daire_gorevlisi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

-- ---------------------------------------------------------------------------
-- 3) DAİRE GÖREVLİSİ — BÜTÜNLÜK
-- ---------------------------------------------------------------------------

ALTER TABLE daire_gorevlisi ADD CONSTRAINT daire_gorevlisi_tarih_sirasi
  CHECK (calisma_bitis IS NULL OR calisma_bitis >= calisma_baslangic);

-- Çalışması bitmiş görevli AKTİF olamaz; aksi hâlde "dairede çalışan
-- görevliler" listesi kartı iptal edilmiş kişileri gösterir ve site girişi
-- yetkisi açık kalır.
ALTER TABLE daire_gorevlisi ADD CONSTRAINT daire_gorevlisi_durum_tutarlilik
  CHECK (calisma_bitis IS NULL OR durum = 'PASIF');

ALTER TABLE daire_gorevlisi ADD CONSTRAINT daire_gorevlisi_tc_bicim
  CHECK (tc_kimlik_no IS NULL OR tc_kimlik_no ~ '^[0-9]{11}$');

ALTER TABLE daire_gorevlisi ADD CONSTRAINT daire_gorevlisi_dogum_tarihi_makul
  CHECK (dogum_tarihi IS NULL
     OR (dogum_tarihi >= DATE '1900-01-01' AND dogum_tarihi <= CURRENT_DATE));

ALTER TABLE daire_gorevlisi ADD CONSTRAINT daire_gorevlisi_soft_delete_tutarlilik
  CHECK ((silindi_mi = false AND silinme_tarihi IS NULL)
      OR (silindi_mi = true AND silinme_tarihi IS NOT NULL AND silme_gerekcesi IS NOT NULL));

-- Aynı TC ile aynı bölümde ikinci AKTİF kayıt açılamaz.
--
-- ⚠️  Tekillik BÖLÜM BAŞINADIR, tenant başına DEĞİL: bir temizlik görevlisinin
--     aynı sitede üç ayrı dairede çalışması olağandır ve her biri ayrı bir
--     hizmet ilişkisidir. Site personelindeki kısıt (`site_personeli_tc_aktif_uq`)
--     tenant genelindedir, çünkü orada mükerrer kayıt bordro hatasıdır.
CREATE UNIQUE INDEX daire_gorevlisi_tc_bolum_aktif_uq
  ON daire_gorevlisi (tenant_id, bolum_id, tc_kimlik_no)
  WHERE tc_kimlik_no IS NOT NULL AND silinme_tarihi IS NULL AND calisma_bitis IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON daire_gorevlisi TO bnos_app;
