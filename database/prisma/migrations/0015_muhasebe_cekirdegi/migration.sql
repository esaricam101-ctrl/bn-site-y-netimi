-- ===========================================================================
-- BNOS Apartman Yönetimi — 0015_muhasebe_cekirdegi
--
-- Muhasebe ÇEKİRDEĞİ. `hesap`, `yevmiye_fisi` ve `yevmiye_satiri` 0001'de
-- kurulmuştu ama HİÇ UCU VE EKRANI YOKTU; tablolar yalnızca tahakkuk
-- tarafından dolduruluyordu. Bu migration, defter · mizan · dönem kapanışı
-- için eksik olan eksenleri ekler.
--
-- Eklenenler:
--   1. MUHASEBE DÖNEMİ — mali yıl. Kapalı döneme fiş yazılamaz.
--   2. FİŞ TÜRÜ — açılış · mahsup · tahsilat · tediye · kapanış · yansıtma.
--   3. YEVMİYE SIRA NO — deftere basılan sıra; fiş numarasından AYRIDIR.
--   4. HESAP ÖZELLİĞİ — kasa · banka · yansıtma. Kasa Defteri buna dayanır.
--   5. MUHASEBE PARAMETRELERİ — tenant başına ayar.
--   6. BELGE İLİŞKİSİ — yevmiye fişine evrak eklenebilsin (VUK md. 227:
--      her kayıt bir belgeye dayanır).
--
-- ⚠️  MEVCUT YAPI BOZULMADI. `yevmiye_fisi` ve `hesap` tablolarına yalnızca
--     alan eklendi; sütun kaldırılmadı, tip değiştirilmedi. Tahakkuk modülünün
--     yazdığı fişler geçerliliğini korur (yeni alanlar için varsayılan var).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) MUHASEBE DÖNEMİ
--
-- KAPALI DÖNEME FİŞ YAZILAMAZ. Bu, muhasebenin en temel korumasıdır: kapanmış
-- bir mali yılın kaydı değişirse yayımlanmış bilanço ile defter tutmaz ve
-- denetim izi kopar. Kısıt hem domain'de hem burada durur.
-- ---------------------------------------------------------------------------

CREATE TYPE "DonemDurumu" AS ENUM ('ACIK', 'KAPANIS_SURECI', 'KAPALI');

CREATE TABLE "muhasebe_donemi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    -- Mali yıl. Türkiye'de takvim yılıyla aynıdır ama alan olarak tutulur:
    -- özel hesap dönemi (VUK md. 174) uygulayan tenant'ta farklı olabilir.
    "mali_yil" INTEGER NOT NULL,
    "ad" VARCHAR(60) NOT NULL,
    "baslangic" DATE NOT NULL,
    "bitis" DATE NOT NULL,
    "durum" "DonemDurumu" NOT NULL DEFAULT 'ACIK',

    -- Dönemin açılış ve kapanış fişleri. Kapanışta üretilir ve bir daha
    -- değişmez; hangi fişin dönemi kapattığı sorulduğunda cevap budur.
    "acilis_fisi_id" UUID,
    "kapanis_fisi_id" UUID,

    -- Kapanışı kim, ne zaman, hangi gerekçeyle yaptı.
    "kapanis_ani" TIMESTAMPTZ(6),
    "kapatan_kullanici" UUID,
    "kapanis_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "muhasebe_donemi_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "muhasebe_donemi" ADD CONSTRAINT "muhasebe_donemi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "muhasebe_donemi_tenant_durum_idx"
  ON "muhasebe_donemi"("tenant_id", "durum");

-- Aynı mali yıl iki kez açılamaz.
CREATE UNIQUE INDEX muhasebe_donemi_yil_uq
  ON muhasebe_donemi (tenant_id, mali_yil);

ALTER TABLE muhasebe_donemi ADD CONSTRAINT muhasebe_donemi_tarih_sirasi
  CHECK (bitis > baslangic);

-- KAPALI dönem gerekçe ve kapanış anı taşımak ZORUNDADIR: "bu dönem neden ve
-- ne zaman kapandı" sorusu denetimde ilk sorulan sorudur.
ALTER TABLE muhasebe_donemi ADD CONSTRAINT muhasebe_donemi_kapanis_tutarlilik
  CHECK (
    durum <> 'KAPALI'
    OR (kapanis_ani IS NOT NULL AND kapanis_gerekcesi IS NOT NULL
        AND kapanis_fisi_id IS NOT NULL)
  );

ALTER TABLE muhasebe_donemi ENABLE ROW LEVEL SECURITY;
ALTER TABLE muhasebe_donemi FORCE  ROW LEVEL SECURITY;
CREATE POLICY muhasebe_donemi_tenant_isolation ON muhasebe_donemi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON muhasebe_donemi TO bnos_app;

-- ---------------------------------------------------------------------------
-- 2) FİŞ TÜRÜ · DÖNEM · YEVMİYE SIRA NO
--
-- FİŞ NO ile YEVMİYE SIRA NO AYNI ŞEY DEĞİLDİR ve karıştırılması muhasebede
-- klasik bir hatadır:
--   · `fis_no`         → kayıt anında verilen, boşluksuz seri (mevcut).
--   · `yevmiye_sira_no`→ yevmiye defterine BASILDIĞINDA verilen sıra. Dönem
--                        içinde TARİH SIRASINA göre yeniden numaralandırılır
--                        (VUK md. 183: yevmiye defteri tarih sırasıyla tutulur).
-- İkisi tek alanda tutulsaydı yeniden numaralandırma, kayıt kimliğini de
-- değiştirir ve makbuz üzerindeki numara ile defter tutmaz hale gelirdi.
-- ---------------------------------------------------------------------------

CREATE TYPE "FisTuru" AS ENUM (
  'ACILIS',      -- dönem açılış fişi
  'MAHSUP',      -- genel mahsup (varsayılan)
  'TAHSILAT',    -- kasa/banka girişi
  'TEDIYE',      -- kasa/banka çıkışı
  'YANSITMA',    -- gelir/gider yansıtma (7/A-7/B)
  'KAPANIS'      -- dönem kapanış fişi
);

ALTER TABLE yevmiye_fisi
  ADD COLUMN fis_turu "FisTuru" NOT NULL DEFAULT 'MAHSUP',
  ADD COLUMN donem_id UUID,
  ADD COLUMN yevmiye_sira_no INTEGER;

ALTER TABLE bagimsiz_bolum NO FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi NO FORCE ROW LEVEL SECURITY;
ALTER TABLE muhasebe_donemi NO FORCE ROW LEVEL SECURITY;

ALTER TABLE yevmiye_fisi ADD CONSTRAINT yevmiye_fisi_donem_id_fkey
  FOREIGN KEY ("donem_id") REFERENCES "muhasebe_donemi"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE muhasebe_donemi FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi FORCE ROW LEVEL SECURITY;
ALTER TABLE bagimsiz_bolum FORCE ROW LEVEL SECURITY;

CREATE INDEX "yevmiye_fisi_tenant_donem_idx" ON "yevmiye_fisi"("tenant_id", "donem_id");
CREATE INDEX "yevmiye_fisi_tenant_tur_idx" ON "yevmiye_fisi"("tenant_id", "fis_turu");

-- Yevmiye sıra no dönem içinde TEKİLDİR. Kısmî index: numara yalnızca
-- deftere basılmış fişlerde vardır, taslakta boştur.
CREATE UNIQUE INDEX yevmiye_fisi_sira_uq
  ON yevmiye_fisi (tenant_id, donem_id, yevmiye_sira_no)
  WHERE yevmiye_sira_no IS NOT NULL;

-- Sıra no pozitif olmalı; 0 ya da negatif bir yevmiye sırası yoktur.
ALTER TABLE yevmiye_fisi ADD CONSTRAINT yevmiye_fisi_sira_pozitif
  CHECK (yevmiye_sira_no IS NULL OR yevmiye_sira_no > 0);

-- ---------------------------------------------------------------------------
-- 3) HESAP ÖZELLİĞİ
--
-- Kasa Defteri ve Banka Defteri, hesabın KOD'una bakılarak üretilemez: kod
-- planı tenant'a göre değişir ('100' her tenant'ta kasa olmayabilir). Özellik
-- alanı bu ayrımı VERİ olarak taşır (§33 kural 3: politika koda gömülmez).
-- ---------------------------------------------------------------------------

CREATE TYPE "HesapOzelligi" AS ENUM ('NORMAL', 'KASA', 'BANKA', 'YANSITMA');

ALTER TABLE hesap
  ADD COLUMN ozellik "HesapOzelligi" NOT NULL DEFAULT 'NORMAL';

CREATE INDEX "hesap_tenant_ozellik_idx" ON "hesap"("tenant_id", "ozellik");

-- NOT: `hesap_kod_uq` (tenant_id, kod) kısmî unique index'i 0001'de ZATEN VAR.
-- Burada yeniden oluşturulmaya çalışıldı ve migration "relation already exists"
-- ile düştü. Var olan kısıt yeterlidir; tekrar tanımlanmıyor.

-- ---------------------------------------------------------------------------
-- 4) MUHASEBE PARAMETRELERİ
--
-- Tenant başına TEK satır. Ayarların koda gömülmesi, iki tenant'ın farklı
-- kasa hesabı kullanmasını imkânsız kılardı.
-- ---------------------------------------------------------------------------

CREATE TABLE "muhasebe_parametresi" (
    "tenant_id" UUID NOT NULL,

    -- Varsayılan hesaplar. Boş bırakılabilir: kurulum tamamlanmadan tahsilat
    -- fişi kesilmesi engellenmeli ama parametre kaydı yine açılabilmeli.
    "varsayilan_kasa_hesap_id" UUID,
    "varsayilan_banka_hesap_id" UUID,
    -- Dönem kapanışında kâr/zararın aktarıldığı özkaynak hesabı.
    "donem_kari_hesap_id" UUID,

    -- Yevmiye defteri yeniden numaralandırılırken kullanılan başlangıç.
    "yevmiye_baslangic_no" INTEGER NOT NULL DEFAULT 1,

    -- TASLAK fiş deftere GİRMEZ. Bu bayrak, taslak fişin mizanda görünüp
    -- görünmeyeceğini belirler; varsayılan HAYIR çünkü işlenmemiş bir kayıt
    -- mali tabloya giremez.
    "taslak_mizana_girer" BOOLEAN NOT NULL DEFAULT false,

    -- Geriye dönük kayıt penceresi (gün). 0 = sınırsız. Kapalı dönem yasağı
    -- bundan BAĞIMSIZDIR ve her zaman geçerlidir.
    "geriye_donuk_gun" INTEGER NOT NULL DEFAULT 0,

    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "muhasebe_parametresi_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "muhasebe_parametresi"
  ADD CONSTRAINT "muhasebe_parametresi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE hesap NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "muhasebe_parametresi"
  ADD CONSTRAINT "muhasebe_parametresi_kasa_fkey"
  FOREIGN KEY ("varsayilan_kasa_hesap_id") REFERENCES "hesap"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "muhasebe_parametresi"
  ADD CONSTRAINT "muhasebe_parametresi_banka_fkey"
  FOREIGN KEY ("varsayilan_banka_hesap_id") REFERENCES "hesap"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "muhasebe_parametresi"
  ADD CONSTRAINT "muhasebe_parametresi_donem_kari_fkey"
  FOREIGN KEY ("donem_kari_hesap_id") REFERENCES "hesap"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE hesap FORCE ROW LEVEL SECURITY;

ALTER TABLE muhasebe_parametresi ADD CONSTRAINT muhasebe_parametresi_yevmiye_no_pozitif
  CHECK (yevmiye_baslangic_no > 0);
ALTER TABLE muhasebe_parametresi ADD CONSTRAINT muhasebe_parametresi_geriye_donuk_makul
  CHECK (geriye_donuk_gun >= 0 AND geriye_donuk_gun <= 3650);

ALTER TABLE muhasebe_parametresi ENABLE ROW LEVEL SECURITY;
ALTER TABLE muhasebe_parametresi FORCE  ROW LEVEL SECURITY;
CREATE POLICY muhasebe_parametresi_tenant_isolation ON muhasebe_parametresi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON muhasebe_parametresi TO bnos_app;

-- ---------------------------------------------------------------------------
-- 5) EVRAK YÖNETİMİ — yevmiye fişine belge bağlanabilsin
--
-- VUK md. 227: her kayıt bir belgeye dayanır. Belge modülü (0007) zaten
-- versiyonlama · kategori · gizlilik · önizleme · KVKK imha taşıyor; burada
-- yalnızca İLİŞKİ TİPİ ekleniyor — yeni bir belge altyapısı KURULMUYOR.
--
-- `ALTER TYPE ... ADD VALUE` yeni değeri AYNI TRANSACTION'da kullanamaz
-- (0007 notu). Burada yalnızca ekleniyor, kullanılmıyor; sorun çıkmaz.
-- ---------------------------------------------------------------------------

ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'YEVMIYE_FISI';
ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'MUHASEBE_DONEMI';
