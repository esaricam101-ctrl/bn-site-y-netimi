-- 0035 · VİRMAN (ADR-0016)
--
-- ⚠️  TANIM: virman mevcut borcu İPTAL ETMEK için değil, DOĞRU KİŞİYE
--     AKTARMAK için yapılan muhasebe işlemidir. Toplam borç DEĞİŞMEZ;
--     değişen yalnızca borcun muhatabıdır.
--
--     Bu tanım kritiktir: virmanı bir düzeltme/iptal aracı sanmak model
--     tasarımını yanlış yöne götürür (silme/ters kayıt üretmeye).

CREATE TYPE "VirmanTuru" AS ENUM (
  -- A · fon taşır (kasa ↔ banka). Bugün `banka_hareketi` üzerinden yürüyor.
  'KASA_BANKA',
  -- B · muhasebe kaydı taşır (yanlış hesaba yazılmış tutar).
  'HESAP',
  -- C · borç/alacak taşır (bölüm carisi · borc_sorumlusu payları).
  'CARI'
);

-- ---------------------------------------------------------------------------
-- VİRMAN KAYDI
--
-- ⚠️  AYRI VARLIK, fişin bir alanı DEĞİL. Sebebi: virmanın her zaman bir fişi
--     OLMAZ. Taşınma virmanı yalnızca payları böler; hiçbir hesap bakiyesi
--     değişmediği için deftere yazılacak bir şey yoktur (ADR-0016 · "iki
--     davranış"). Fişin alanı olsaydı fişsiz virman kaydedilemezdi.
--
-- ⚠️  `aciklama` ZORUNLU ve BOŞLUK KABUL ETMEZ. Boş bırakılabilen zorunlu
--     alan zorunlu değildir: denetimde "neden yapıldı" sorusu serbest metinle
--     cevaplanır, sebep kodu yalnızca sınıflandırmadır.
-- ---------------------------------------------------------------------------
CREATE TABLE virman (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenant(id),
  virman_no  varchar(32) NOT NULL,
  tur        "VirmanTuru" NOT NULL,
  -- Sebep kodu VERİDİR, koda gömülü değildir; her tür kendi geçerli
  -- listesini taşır (ADR-0016 · R6).
  sebep_kodu varchar(60) NOT NULL,
  tarih      date NOT NULL,
  aciklama   text NOT NULL,
  -- Boşsa bu virman deftere yazılmamıştır (taşınma virmanı gibi).
  yevmiye_fisi_id uuid REFERENCES yevmiye_fisi(id) ON DELETE RESTRICT,

  olusturan         uuid,
  olusturma_tarihi  timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT virman_aciklama_dolu CHECK (length(btrim(aciklama)) >= 3),
  CONSTRAINT virman_no_uq UNIQUE (tenant_id, virman_no)
);

CREATE INDEX virman_tenant_tarih_idx  ON virman (tenant_id, tarih);
CREATE INDEX virman_tenant_tur_idx    ON virman (tenant_id, tur);
CREATE INDEX virman_yevmiye_fisi_idx  ON virman (tenant_id, yevmiye_fisi_id);

COMMENT ON COLUMN virman.yevmiye_fisi_id IS
  'Bossa bu virman deftere yazilmamistir. Tasinma virmani hicbir hesap '
  'bakiyesini degistirmez; fis uretmemesi DOGRU davranistir (ADR-0016).';

-- ---------------------------------------------------------------------------
-- RLS — ADR-0002. Tenant izolasyonu + satır kapsamı.
--
-- ⚠️  KAPSAM POLİTİKASI `FOR ALL`: yevmiye tarafında (0031) uygulanan
--     disiplinin aynısı. `FOR SELECT` olsaydı kısıtlı kapsamdaki bir rol
--     virman kaydını OKUYAMAZ ama YAZABİLİRDİ; o yol yalnızca Kapı 3 ile
--     kapalı kalırdı, veri katmanında değil.
-- ---------------------------------------------------------------------------
ALTER TABLE virman ENABLE ROW LEVEL SECURITY;
ALTER TABLE virman FORCE ROW LEVEL SECURITY;

CREATE POLICY virman_tenant ON virman
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

CREATE POLICY virman_kapsam ON virman
  AS RESTRICTIVE FOR ALL
  USING (app_kapsam_serbest())
  WITH CHECK (app_kapsam_serbest());

GRANT SELECT, INSERT, UPDATE ON virman TO bnos_app;
