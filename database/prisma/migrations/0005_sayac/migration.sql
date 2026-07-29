-- ===========================================================================
-- BNOS Apartman Yönetimi — 0005_sayac
--
-- Domain katmanı (`shared/apartman-domain/src/sayac/sayac.ts`) bu kuralları
-- zaten taşıyordu; eksik olan kalıcılıktı (bekleyen liste C-8).
--
-- ⚠️  `prisma migrate diff` ÇIKTISI OLDUĞU GİBİ KULLANILMADI — 0004'teki
-- aynı iki tuzak burada da geçerlidir:
--   1. Diff, şemada karşılığı olmayan ELLE YAZILMIŞ kısmi unique index'leri
--      düşürmek ister (arac_plaka_donem_uq · borc_tahakkuk_no_uq ·
--      malik_kisi_donem_uq · kiraci_kisi_donem_uq · sakin_kisi_donem_uq ·
--      yevmiye_fis_no_uq). Uygulanırsa korudukları kural sessizce kalkar.
--   2. FK eklemek `FORCE ROW LEVEL SECURITY` ile çakışır (aşağıda).
-- ===========================================================================

CREATE TYPE "SayacTuru" AS ENUM (
  'SU', 'SICAK_SU', 'ELEKTRIK', 'DOGALGAZ', 'ISI_PAY_OLCER', 'KALORIMETRE'
);

CREATE TABLE "sayac" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "tur" "SayacTuru" NOT NULL,
    "seri_no" VARCHAR(40) NOT NULL,
    -- Gostergenin basamak sayisi. Devir hesabi (99999 -> 00001) buna dayanir.
    "basamak" INTEGER NOT NULL,
    -- Okumadaki ondalik basamak. 12,345 -> deger 12345, olcek 3.
    "olcek_basamak" INTEGER NOT NULL DEFAULT 0,
    "takilma_tarihi" DATE NOT NULL,
    "sokulme_tarihi" DATE,
    -- Takildigi andaki gosterge. Kullanilmis sayacta sifir olmaz.
    "ilk_deger" BIGINT NOT NULL DEFAULT 0,
    -- Degisim zinciri: bu sayac hangi sayacin yerine takildi.
    "onceki_sayac_id" UUID,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sayac_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sayac_okumasi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sayac_id" UUID NOT NULL,
    "tarih" DATE NOT NULL,
    "deger" BIGINT NOT NULL,
    -- Gosterge basa dondu mu — OPERATOR ONAYIYLA gelir, tahmin EDILMEZ.
    "devir_mi" BOOLEAN NOT NULL DEFAULT false,
    -- Hesaplanan tuketim SAKLANIR (snapshot). Sorgu aninda yeniden
    -- hesaplansaydi, bir okuma sonradan duzeltildiginde gecmis donemlerin
    -- dagitimi kendiliginden degisir ve tahsil edilmis aidatla tutmazdi.
    "tuketim" BIGINT NOT NULL,
    "kaynak" VARCHAR(16) NOT NULL DEFAULT 'ELLE',
    "notu" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sayac_okumasi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sayac_tenant_id_bolum_id_tur_idx" ON "sayac"("tenant_id", "bolum_id", "tur");
CREATE INDEX "sayac_okumasi_tenant_id_sayac_id_tarih_idx"
  ON "sayac_okumasi"("tenant_id", "sayac_id", "tarih");

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR — `FORCE ROW LEVEL SECURITY` ile etkileşim
--
-- `ADD CONSTRAINT ... FOREIGN KEY` bir doğrulama taraması başlatır; tarama
-- hedef tabloyu okur ve FORCE altında sahibi bile politikaya tabidir.
-- Tenant bağlamı olmadığı için migration "Tenant baglami kurulmadan sorgu
-- calistirilamaz" ile düşer.
--
-- Hedef tablonun FORCE'u YALNIZCA bu işlem boyunca kaldırılır. Migration
-- transaction içinde koşar; hata halinde ALTER da geri alınır. RLS'in kendisi
-- (ENABLE) hiçbir an kapatılmaz — yalnızca sahibin muafiyeti geri verilir.
--
-- `sayac` ve `sayac_okumasi` üzerinde RLS henüz AÇILMADIĞI için kendi
-- aralarındaki FK'lar sorun çıkarmaz; RLS bu bloktan SONRA açılır.
-- ---------------------------------------------------------------------------

ALTER TABLE bagimsiz_bolum NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "sayac" ADD CONSTRAINT "sayac_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sayac" ADD CONSTRAINT "sayac_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sayac" ADD CONSTRAINT "sayac_onceki_sayac_id_fkey"
  FOREIGN KEY ("onceki_sayac_id") REFERENCES "sayac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sayac_okumasi" ADD CONSTRAINT "sayac_okumasi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sayac_okumasi" ADD CONSTRAINT "sayac_okumasi_sayac_id_fkey"
  FOREIGN KEY ("sayac_id") REFERENCES "sayac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE bagimsiz_bolum FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE sayac ENABLE ROW LEVEL SECURITY;
ALTER TABLE sayac FORCE  ROW LEVEL SECURITY;
CREATE POLICY sayac_tenant_isolation ON sayac
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE sayac_okumasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE sayac_okumasi FORCE  ROW LEVEL SECURITY;
CREATE POLICY sayac_okumasi_tenant_isolation ON sayac_okumasi
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- Basamak sınırı domain'de de denetlenir (`gostergeSiniri`); burada da
-- durması, doğrudan SQL ile yazılan bir kaydın devir hesabını bozmasını
-- engeller.
ALTER TABLE sayac ADD CONSTRAINT sayac_basamak_sinir
  CHECK (basamak >= 1 AND basamak <= 12);

ALTER TABLE sayac ADD CONSTRAINT sayac_olcek_sinir
  CHECK (olcek_basamak >= 0 AND olcek_basamak <= 6);

ALTER TABLE sayac ADD CONSTRAINT sayac_ilk_deger_pozitif
  CHECK (ilk_deger >= 0);

ALTER TABLE sayac ADD CONSTRAINT sayac_tarih_sirasi
  CHECK (sokulme_tarihi IS NULL OR sokulme_tarihi >= takilma_tarihi);

-- Sayaç KENDİSİNİN yerine takılamaz; zincir kendine dönerse değişim dönemi
-- tüketimi sonsuz döngüye girer.
ALTER TABLE sayac ADD CONSTRAINT sayac_zincir_kendine_donmez
  CHECK (onceki_sayac_id IS NULL OR onceki_sayac_id <> id);

-- Aynı seri numarası aynı anda İKİ KEZ TAKILI olamaz. Sökülmüş sayaç bu
-- kısıtı tetiklemez: aynı sayaç başka bir daireye takılabilir.
CREATE UNIQUE INDEX sayac_seri_no_aktif_uq
  ON sayac (tenant_id, seri_no) WHERE sokulme_tarihi IS NULL;

ALTER TABLE sayac_okumasi ADD CONSTRAINT sayac_okumasi_deger_pozitif
  CHECK (deger >= 0);

-- Tüketim negatif OLAMAZ. Negatif tüketim, TUKETIM dağıtımında negatif
-- ağırlık demektir: dağıtım ya patlar ya da başka daireye fazla yazar.
ALTER TABLE sayac_okumasi ADD CONSTRAINT sayac_okumasi_tuketim_pozitif
  CHECK (tuketim >= 0);

-- Bir sayaca aynı tarihte İKİ okuma girilemez; hangisinin geçerli olduğu
-- belirsiz kalır ve tüketim iki kez sayılabilir.
CREATE UNIQUE INDEX sayac_okumasi_tarih_uq
  ON sayac_okumasi (tenant_id, sayac_id, tarih);

GRANT SELECT, INSERT, UPDATE, DELETE ON sayac TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sayac_okumasi TO bnos_app;
