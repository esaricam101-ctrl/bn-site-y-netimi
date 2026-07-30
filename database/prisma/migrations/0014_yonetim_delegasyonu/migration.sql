-- ===========================================================================
-- BNOS Apartman Yönetimi — 0014_yonetim_delegasyonu
--
-- PORTFÖY YÖNETİM MERKEZİ'nin veri temeli (ADR-0009).
--
-- Yönetim firması bir TENANT'tır (`TenantTipi = YONETIM_SIRKETI`); proje de bir
-- tenant'tır (APARTMAN | SITE, bkz. ADR-0008). Aralarındaki bağ **açık devir**
-- kaydıdır.
--
-- ⚠️  BU TABLO ÇAPRAZ-TENANT SORGUYA KAPI AÇMAZ. ADR-0002:
--       "Portföy görünümü ileride RLS gevşetilerek çözülmeyecektir. Çözüm yolu:
--        yönetim şirketi tenant'ı + apartman tenant'larından açık devir
--        (delegation) ilişkisi."
--     Portföy özeti PROJE BAŞINA ayrı sorgu + uygulama katmanında toplamadır.
--     `BYPASSRLS` yoktur ve olmayacaktır.
--
-- ⚠️  POLİTİKA İKİ TARAFLIDIR ve bu zorunludur: satırın İKİ tenant'ı vardır.
--     Tek taraflı `tenant_id = app_tenant_id()` politikası, satırı taraflardan
--     birine görünmez kılardı — firma yönettiği projeyi ya proje kendi
--     yöneticisini göremezdi. Açığa çıkan tek şey DEVİR OLGUSUDUR; projenin
--     verisine erişim yine RLS ile tek tenant bağlamında sınırlıdır.
-- ===========================================================================

CREATE TYPE "DevirDurumu" AS ENUM ('AKTIF', 'SONA_ERDI', 'IPTAL');

CREATE TABLE "yonetim_delegasyonu" (
    "id" UUID NOT NULL,

    -- Yönetimi DEVRALAN firma tenant'ı (tip = YONETIM_SIRKETI).
    "yonetim_tenant_id" UUID NOT NULL,
    -- Yönetimi DEVREDEN proje tenant'ı (tip = APARTMAN | SITE).
    "proje_tenant_id" UUID NOT NULL,

    "durum" "DevirDurumu" NOT NULL DEFAULT 'AKTIF',

    -- Devrin dayanağı: yönetim sözleşmesi no, genel kurul kararı vb.
    -- ZORUNLUDUR: dayanağı olmayan bir devir, hangi kararla verildiği
    -- sorulduğunda cevapsız kalır (KMK md. 34 · yönetici seçimi).
    "dayanak" VARCHAR(200) NOT NULL,

    "baslangic" DATE NOT NULL,
    -- Boşsa devir SÜRESİZDİR (sözleşme yenilendikçe sürer).
    "bitis" DATE,

    -- Devri kaydeden kullanıcı ve gerekçesi — denetim izi.
    "veren_kullanici" UUID,
    "sona_erdirme_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "yonetim_delegasyonu_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "yonetim_delegasyonu"
  ADD CONSTRAINT "yonetim_delegasyonu_yonetim_tenant_id_fkey"
  FOREIGN KEY ("yonetim_tenant_id") REFERENCES "tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "yonetim_delegasyonu"
  ADD CONSTRAINT "yonetim_delegasyonu_proje_tenant_id_fkey"
  FOREIGN KEY ("proje_tenant_id") REFERENCES "tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "yonetim_delegasyonu_yonetim_idx"
  ON "yonetim_delegasyonu"("yonetim_tenant_id", "durum");
CREATE INDEX "yonetim_delegasyonu_proje_idx"
  ON "yonetim_delegasyonu"("proje_tenant_id", "durum");

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- Bir tenant kendi yönetimini kendine devredemez.
ALTER TABLE yonetim_delegasyonu ADD CONSTRAINT yonetim_delegasyonu_kendine_olmaz
  CHECK (yonetim_tenant_id <> proje_tenant_id);

ALTER TABLE yonetim_delegasyonu ADD CONSTRAINT yonetim_delegasyonu_tarih_sirasi
  CHECK (bitis IS NULL OR bitis >= baslangic);

-- Sona ermiş/iptal devir GEREKÇE taşımak zorundadır: yetkinin ne zaman ve neden
-- kalktığı, sonradan "bu firma o tarihte neden erişemedi?" sorusunun cevabıdır.
ALTER TABLE yonetim_delegasyonu ADD CONSTRAINT yonetim_delegasyonu_durum_tutarlilik
  CHECK (
    (durum = 'AKTIF' AND sona_erdirme_gerekcesi IS NULL)
    OR (durum <> 'AKTIF' AND sona_erdirme_gerekcesi IS NOT NULL)
  );

-- AYNI PROJE AYNI ANDA İKİ FİRMAYA DEVREDİLEMEZ.
--
-- Kısmî unique index: yalnızca AKTİF devirlerde. Sona ermiş devirler kayıtta
-- kalır (tarihçe) ve yeni devri engellemez — yönetim firması değişebilir.
-- Kısıt olmasaydı iki firma aynı projeyi aynı anda yönetir görünür ve
-- "bu daireye kim tahakkuk yaptı" sorusunun tek cevabı kalmazdı.
CREATE UNIQUE INDEX yonetim_delegasyonu_aktif_proje_uq
  ON yonetim_delegasyonu (proje_tenant_id) WHERE durum = 'AKTIF';

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — İKİ TARAFLI
-- ---------------------------------------------------------------------------

ALTER TABLE yonetim_delegasyonu ENABLE ROW LEVEL SECURITY;
ALTER TABLE yonetim_delegasyonu FORCE  ROW LEVEL SECURITY;

CREATE POLICY yonetim_delegasyonu_tenant_isolation ON yonetim_delegasyonu
  USING (
    yonetim_tenant_id = app_tenant_id()
    OR proje_tenant_id = app_tenant_id()
  )
  WITH CHECK (
    yonetim_tenant_id = app_tenant_id()
    OR proje_tenant_id = app_tenant_id()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON yonetim_delegasyonu TO bnos_app;
