-- ===========================================================================
-- BNOS Apartman Yönetimi — 0002_hiyerarsi_malik_kiraci_sakin
--
-- ADR-0008 · Tenant = yönetilen yerleşke (apartman veya site)
--
-- Getirdikleri:
--   1. Hiyerarşi:  Tenant → Apartman → Blok → Kat → BagimsizBolum
--   2. Malik (hisseli, çoklu) · Kiraci (sözleşmeli) · Sakin (fiilen oturan)
--   3. GiderTuru — aidat kuralları VERİ olarak; koda gömülmez
--   4. BorcSorumlusu.pay — hisseli borç bölüşümü
--
-- ⚠️  DOĞRULANMAMIŞ MIGRATION
--     Bu dosya `prisma migrate dev` ile ÜRETİLMEMİŞ, elle yazılmıştır:
--     yazıldığı ortamda PostgreSQL yoktu (DEVLOG TODO-3). Hiçbir veritabanına
--     uygulanmadı. İlk uygulamadan ÖNCE gözden geçirilmeli ve
--     `pnpm db:migrate` çıktısı ile Prisma'nın ürettiği DDL karşılaştırılmalıdır.
--     Özellikle §1'deki RLS listesi eksik kalırsa yeni tablolar RLS'siz kalır
--     ve HATA SESSİZDİR.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0) ENUM'LAR
-- ---------------------------------------------------------------------------

CREATE TYPE "DaireTipi" AS ENUM (
  'STUDYO', 'BIR_SIFIR', 'BIR_BIR', 'IKI_BIR', 'UC_BIR',
  'DORT_BIR', 'BES_BIR', 'DUBLEKS', 'DIGER'
);

CREATE TYPE "BolumDurumu" AS ENUM ('AKTIF', 'BOS', 'TADILATTA', 'KULLANIM_DISI');

CREATE TYPE "TapuTuru" AS ENUM (
  'KAT_MULKIYETI', 'KAT_IRTIFAKI', 'ARSA_PAYLI', 'MIRAS_ISTIRAK', 'DIGER'
);

CREATE TYPE "YakinlikDerecesi" AS ENUM (
  'KENDISI', 'ES', 'COCUK', 'ANNE_BABA', 'KARDES', 'AKRABA',
  'MISAFIR', 'CALISAN', 'DIGER'
);

CREATE TYPE "PaylasimKurali" AS ENUM (
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE',
  'TUKETIM', 'SABIT_TUTAR', 'KARMA'
);

CREATE TYPE "SorumlulukTipi" AS ENUM ('MALIKE_AIT', 'KULLANANA_AIT');

CREATE TYPE "KuralKaynagi" AS ENUM (
  'KMK_VARSAYILAN', 'YONETIM_PLANI', 'GENEL_KURUL_KARARI'
);

-- ---------------------------------------------------------------------------
-- 1) YENİ TABLOLAR
-- ---------------------------------------------------------------------------

CREATE TABLE apartman (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  ad                 varchar(120) NOT NULL,
  adres              text,
  site_ici_kod       varchar(16),
  silindi_mi         boolean NOT NULL DEFAULT false,
  silinme_tarihi     timestamptz(6),
  silen_kullanici    uuid,
  silme_gerekcesi    text,
  olusturulma_tarihi timestamptz(6) NOT NULL DEFAULT now(),
  guncelleme_tarihi  timestamptz(6) NOT NULL
);
CREATE INDEX apartman_tenant_idx ON apartman (tenant_id);

CREATE TABLE kat (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  blok_id            uuid NOT NULL REFERENCES blok(id),
  no                 integer NOT NULL,
  ad                 varchar(40),
  silindi_mi         boolean NOT NULL DEFAULT false,
  silinme_tarihi     timestamptz(6),
  silen_kullanici    uuid,
  silme_gerekcesi    text,
  olusturulma_tarihi timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX kat_tenant_blok_idx ON kat (tenant_id, blok_id);

CREATE TABLE malik (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES tenant(id),
  bolum_id             uuid NOT NULL REFERENCES bagimsiz_bolum(id),
  kisi_id              uuid NOT NULL REFERENCES kisi(id),
  hisse_pay            bigint NOT NULL,
  hisse_payda          bigint NOT NULL,
  tapu_turu            "TapuTuru" NOT NULL DEFAULT 'KAT_MULKIYETI',
  tapu_baslangic       date NOT NULL,
  tapu_bitis           date,
  tapu_yevmiye_no      varchar(40),
  vekil_kisi_id        uuid REFERENCES kisi(id),
  vekaletname_no       varchar(40),
  vekalet_bitis_tarihi date,
  olusturulma_tarihi   timestamptz(6) NOT NULL DEFAULT now(),
  guncelleme_tarihi    timestamptz(6) NOT NULL
);
CREATE INDEX malik_tenant_bolum_idx ON malik (tenant_id, bolum_id, tapu_baslangic);

CREATE TABLE kiraci (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES tenant(id),
  bolum_id             uuid NOT NULL REFERENCES bagimsiz_bolum(id),
  kisi_id              uuid NOT NULL REFERENCES kisi(id),
  baslangic            date NOT NULL,
  bitis                date,
  sozlesme_no          varchar(40),
  sozlesme_tarihi      date,
  depozito             numeric(18,4),
  depozito_iade_tarihi date,
  tahliye_tarihi       date,
  tahliye_gerekcesi    text,
  olusturulma_tarihi   timestamptz(6) NOT NULL DEFAULT now(),
  guncelleme_tarihi    timestamptz(6) NOT NULL
);
CREATE INDEX kiraci_tenant_bolum_idx ON kiraci (tenant_id, bolum_id, baslangic);

CREATE TABLE sakin (
  id                   uuid PRIMARY KEY,
  tenant_id            uuid NOT NULL REFERENCES tenant(id),
  bolum_id             uuid NOT NULL REFERENCES bagimsiz_bolum(id),
  kisi_id              uuid NOT NULL REFERENCES kisi(id),
  yakinlik_derecesi    "YakinlikDerecesi" NOT NULL DEFAULT 'KENDISI',
  giris_tarihi         date NOT NULL,
  cikis_tarihi         date,
  acil_durum_kisi_adi  varchar(120),
  acil_durum_telefon   varchar(24),
  olusturulma_tarihi   timestamptz(6) NOT NULL DEFAULT now(),
  guncelleme_tarihi    timestamptz(6) NOT NULL
);
CREATE INDEX sakin_tenant_bolum_idx ON sakin (tenant_id, bolum_id, giris_tarihi);

CREATE TABLE gider_turu (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  kod                varchar(40) NOT NULL,
  ad                 varchar(120) NOT NULL,
  paylasim_kurali    "PaylasimKurali" NOT NULL,
  sorumluluk_tipi    "SorumlulukTipi" NOT NULL,
  kural_kaynagi      "KuralKaynagi" NOT NULL,
  kaynak_referansi   varchar(200),
  karma_bilesenler   jsonb,
  malik_paylasimi    varchar(20) NOT NULL DEFAULT 'HISSE_ORANI',
  aktif_mi           boolean NOT NULL DEFAULT true,
  silindi_mi         boolean NOT NULL DEFAULT false,
  silinme_tarihi     timestamptz(6),
  silen_kullanici    uuid,
  silme_gerekcesi    text,
  olusturulma_tarihi timestamptz(6) NOT NULL DEFAULT now(),
  guncelleme_tarihi  timestamptz(6) NOT NULL
);
CREATE INDEX gider_turu_tenant_kod_idx ON gider_turu (tenant_id, kod);

-- ---------------------------------------------------------------------------
-- 2) MEVCUT TABLOLARIN GENİŞLETİLMESİ
--
-- blok.apartman_id NOT NULL'dur ancak mevcut satırlar için değer gerekir.
-- Sıra: (a) nullable ekle, (b) her tenant için bir apartman türet ve doldur,
-- (c) NOT NULL'a çevir. Boş veritabanında (b) hiçbir şey yapmaz.
-- ---------------------------------------------------------------------------

ALTER TABLE blok ADD COLUMN apartman_id uuid REFERENCES apartman(id);

INSERT INTO apartman (id, tenant_id, ad, guncelleme_tarihi)
SELECT gen_random_uuid(), t.id, t.ad, now()
FROM tenant t
WHERE EXISTS (SELECT 1 FROM blok b WHERE b.tenant_id = t.id);

UPDATE blok b
SET apartman_id = a.id
FROM apartman a
WHERE a.tenant_id = b.tenant_id AND b.apartman_id IS NULL;

ALTER TABLE blok ALTER COLUMN apartman_id SET NOT NULL;
CREATE INDEX blok_tenant_apartman_idx ON blok (tenant_id, apartman_id);

ALTER TABLE bagimsiz_bolum
  ADD COLUMN kat_id                 uuid REFERENCES kat(id),
  ADD COLUMN ic_kapi_no             varchar(16),
  ADD COLUMN daire_tipi             "DaireTipi",
  ADD COLUMN kullanim_amaci         varchar(80),
  ADD COLUMN durum                  "BolumDurumu" NOT NULL DEFAULT 'AKTIF',
  ADD COLUMN tapu_ada               varchar(20),
  ADD COLUMN tapu_parsel            varchar(20),
  ADD COLUMN tapu_pafta             varchar(20),
  ADD COLUMN tapu_bagimsiz_bolum_no varchar(20),
  ADD COLUMN tapu_cilt              varchar(20),
  ADD COLUMN tapu_sahife            varchar(20);

CREATE INDEX bagimsiz_bolum_tenant_kat_idx ON bagimsiz_bolum (tenant_id, kat_id);

-- Hisseli borç bölüşümü. Mevcut satırlarda tek sorumlu vardır; payı borcun
-- tamamıdır — bu yüzden varsayılan borç tutarından türetilir.
ALTER TABLE borc_sorumlusu
  ADD COLUMN pay        numeric(18,4),
  ADD COLUMN odenen     numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN agirlik    bigint NOT NULL DEFAULT 1,
  ADD COLUMN kapandi_mi boolean NOT NULL DEFAULT false;

UPDATE borc_sorumlusu bs
SET pay = b.tutar
FROM borc b
WHERE b.id = bs.borc_id AND bs.pay IS NULL;

ALTER TABLE borc_sorumlusu ALTER COLUMN pay SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) ROW LEVEL SECURITY — YENİ TABLOLAR
--
-- 0001_init'teki desenin aynısı. Bu blok atlanırsa yeni tablolar RLS'siz
-- kalır ve çapraz-tenant okuma mümkün olur; HATA SESSİZDİR.
-- `apartman` ve `kat` dahil TÜM yeni tablolar tenant kapsamlıdır.
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'apartman', 'kat', 'malik', 'kiraci', 'sakin', 'gider_turu'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) KISMİ UNIQUE INDEX'LER  (BFS v1 §5.3 kural 1)
--
-- blok_ad_uq YENİDEN TANIMLANIR: blok adı artık tenant genelinde değil,
-- APARTMAN içinde tekildir. Sitede iki apartmanın da "A Blok"u olabilir.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS blok_ad_uq;
CREATE UNIQUE INDEX blok_ad_uq
  ON blok (tenant_id, apartman_id, ad) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX apartman_ad_uq
  ON apartman (tenant_id, ad) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX kat_no_uq
  ON kat (tenant_id, blok_id, no) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX gider_turu_kod_uq
  ON gider_turu (tenant_id, kod) WHERE silinme_tarihi IS NULL;

-- Aynı kişi aynı bölümde aynı tarihte iki kez malik olamaz. Tarihçe korunur:
-- geçmiş kayıt farklı `tapu_baslangic` taşır.
CREATE UNIQUE INDEX malik_kisi_donem_uq
  ON malik (tenant_id, bolum_id, kisi_id, tapu_baslangic);

CREATE UNIQUE INDEX kiraci_kisi_donem_uq
  ON kiraci (tenant_id, bolum_id, kisi_id, baslangic);

CREATE UNIQUE INDEX sakin_kisi_donem_uq
  ON sakin (tenant_id, bolum_id, kisi_id, giris_tarihi);

-- ---------------------------------------------------------------------------
-- 5) BÜTÜNLÜK KISITLARI
-- ---------------------------------------------------------------------------

-- Hisse geçerli bir kesir olmalıdır; toplamın tamı etmesi uygulama katmanında
-- (hisseleriDogrula) zorlanır — tek satırdan bakarak doğrulanamaz.
ALTER TABLE malik ADD CONSTRAINT malik_hisse_gecerli
  CHECK (hisse_payda > 0 AND hisse_pay > 0 AND hisse_pay <= hisse_payda);

ALTER TABLE malik ADD CONSTRAINT malik_tarih_sirasi
  CHECK (tapu_bitis IS NULL OR tapu_bitis >= tapu_baslangic);

-- Vekâlet bilgisi ya tümüyle vardır ya da yoktur; yarım kayıt vekilin
-- yetkisini belirsiz bırakır (C-4).
ALTER TABLE malik ADD CONSTRAINT malik_vekalet_butun
  CHECK ((vekil_kisi_id IS NULL AND vekaletname_no IS NULL)
      OR (vekil_kisi_id IS NOT NULL AND vekaletname_no IS NOT NULL));

ALTER TABLE kiraci ADD CONSTRAINT kiraci_tarih_sirasi
  CHECK (bitis IS NULL OR bitis >= baslangic);

ALTER TABLE kiraci ADD CONSTRAINT kiraci_depozito_pozitif
  CHECK (depozito IS NULL OR depozito >= 0);

-- Tahliye, sözleşme başlangıcından önce olamaz.
ALTER TABLE kiraci ADD CONSTRAINT kiraci_tahliye_sirasi
  CHECK (tahliye_tarihi IS NULL OR tahliye_tarihi >= baslangic);

ALTER TABLE sakin ADD CONSTRAINT sakin_tarih_sirasi
  CHECK (cikis_tarihi IS NULL OR cikis_tarihi >= giris_tarihi);

-- KARMA dışında bileşen tanımlanamaz; KARMA ise bileşensiz olamaz.
ALTER TABLE gider_turu ADD CONSTRAINT gider_turu_karma_butun
  CHECK ((paylasim_kurali = 'KARMA' AND karma_bilesenler IS NOT NULL)
      OR (paylasim_kurali <> 'KARMA' AND karma_bilesenler IS NULL));

-- Override daima kaynak referansı taşır — kuralın nereden geldiği kaybolmaz.
ALTER TABLE gider_turu ADD CONSTRAINT gider_turu_kaynak_referansi
  CHECK (kural_kaynagi = 'KMK_VARSAYILAN' OR kaynak_referansi IS NOT NULL);

ALTER TABLE gider_turu ADD CONSTRAINT gider_turu_malik_paylasimi
  CHECK (malik_paylasimi IN ('ESIT', 'HISSE_ORANI', 'MANUEL'));

-- Kişi payı negatif olamaz ve ödenen payı aşamaz.
ALTER TABLE borc_sorumlusu ADD CONSTRAINT borc_sorumlusu_pay_sinir
  CHECK (pay >= 0 AND odenen >= 0 AND odenen <= pay);
