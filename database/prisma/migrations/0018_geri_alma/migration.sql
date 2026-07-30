-- ===========================================================================
-- BNOS Apartman Yönetimi — 0018_geri_alma
--
-- GENEL GERİ AL (UNDO) — kullanıcı bazlı "son işlemi geri al".
--
-- ⚠️  YENİ BİR "NE DEĞİŞTİ" GÜNLÜĞÜ AÇILMADI. `audit_kaydi` zaten her işlemin
--     `onceki_deger` ve `sonraki_deger` alanlarını hash zinciriyle tutuyor.
--     İkinci bir günlük yazılsaydı iki kaynak zamanla ayrışır ve geri alma
--     YANLIŞ değere dönerdi. Bu tablo yalnızca "hangi denetim kaydı geri
--     alındı" olgusunu taşır.
--
-- ⚠️  AUDIT KAYDI GÜNCELLENEMEZ. 0001'de UPDATE/DELETE trigger ile reddedilir
--     (hash zinciri kopmasın diye). Bu yüzden "geri alındı" işareti audit
--     satırına YAZILAMAZ; ayrı tabloda durmak zorundadır.
--
-- ⚠️  FİNANSAL KAYIT GERİ ALINIRKEN SİLİNMEZ. Geri alma, ters kayıt
--     (storno / makbuz iptali) üretir; veri silinmez (BFS v1 §5.1).
--     `yontem` alanı hangi yolun izlendiğini SAKLAR: denetimde "bu kayıt
--     nasıl geri alındı" sorusunun cevabı budur.
-- ===========================================================================

CREATE TYPE "GeriAlmaYontemi" AS ENUM (
  -- Finansal kayıt: ters kayıt üretildi (fiş storno · makbuz iptali).
  'TERS_KAYIT',
  -- Soft-delete edilmiş kayıt geri yüklendi.
  'GERI_YUKLE',
  -- Oluşturma işlemi geri alındı: kayıt arşivlendi (soft delete).
  'ARSIVLE',
  -- Güncelleme geri alındı: alanlar `onceki_deger`den yazıldı.
  'ALAN_GERI_AL'
);

CREATE TABLE "geri_alma" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    -- GERİ ALINAN denetim kaydı. TEKİLDİR: aynı işlem iki kez geri alınamaz.
    -- Alınabilseydi bir güncelleme iki kez "eski değere" döndürülür ve arada
    -- yapılan başka değişiklikler sessizce silinirdi.
    "audit_kaydi_id" UUID NOT NULL,

    "varlik" VARCHAR(60) NOT NULL,
    "varlik_id" UUID NOT NULL,
    -- Geri alınan işlemin türü (audit'teki `eylem`in kopyası). Denetim kaydı
    -- silinmez ama sorgu kolaylığı için burada da durur.
    "eylem" VARCHAR(20) NOT NULL,

    "yontem" "GeriAlmaYontemi" NOT NULL,
    -- Ters kayıt üretildiyse doğan kaydın kimliği (storno fişi vb.).
    "sonuc_varlik_id" UUID,

    "geri_alan" UUID NOT NULL,
    "gerekce" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geri_alma_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR
--
-- FK doğrulama taraması hem KAYNAK hem HEDEF tabloyu okur (0011 notu).
-- ---------------------------------------------------------------------------

ALTER TABLE audit_kaydi NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "geri_alma" ADD CONSTRAINT "geri_alma_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "geri_alma" ADD CONSTRAINT "geri_alma_audit_kaydi_id_fkey"
  FOREIGN KEY ("audit_kaydi_id") REFERENCES "audit_kaydi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE audit_kaydi FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- TEKİLLİK ve INDEX
-- ---------------------------------------------------------------------------

-- Bir denetim kaydı EN ÇOK BİR KEZ geri alınabilir.
CREATE UNIQUE INDEX geri_alma_audit_uq ON geri_alma (audit_kaydi_id);

CREATE INDEX "geri_alma_tenant_kullanici_idx"
  ON "geri_alma"("tenant_id", "geri_alan", "olusturulma_tarihi");
CREATE INDEX "geri_alma_tenant_varlik_idx"
  ON "geri_alma"("tenant_id", "varlik", "varlik_id");

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE geri_alma ENABLE ROW LEVEL SECURITY;
ALTER TABLE geri_alma FORCE  ROW LEVEL SECURITY;
CREATE POLICY geri_alma_tenant_isolation ON geri_alma
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT ON geri_alma TO bnos_app;
-- UPDATE ve DELETE VERİLMEZ: geri alma olgusu da denetim izidir ve
-- değiştirilemez.
