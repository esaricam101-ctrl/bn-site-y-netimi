-- ===========================================================================
-- BNOS Apartman Yönetimi — 0001_init
--
-- Bu dosya Prisma'nın üretemediği İKİ KRİTİK yapıyı içerir:
--   1. PostgreSQL Row Level Security politikaları  (ADR-0002 · BFS v1 §2.2)
--   2. Kısmi unique index'ler                       (BFS v1 §5.3 kural 1)
--
-- Prisma şema DDL'i `prisma migrate dev` tarafından bu dosyanın başına
-- üretilir. Aşağıdaki bölüm HER migration'da elle korunur ve gözden geçirilir.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) ROW LEVEL SECURITY
--
-- İzolasyon uygulama katmanındaki `where` koşuluna BIRAKILMAZ; veritabanı zorlar.
-- FORCE zorunludur — tablo sahibi rol de politikaya tabi olur.
-- `app.tenant_id` ayarlanmamışsa sorgu HATA VERİR, sessizce boş dönmez.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.tenant_id', true);
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION
      'Tenant baglami kurulmadan sorgu calistirilamaz (ADR-0002 · BFS v1 §2.3). '
      'Her transaction basinda SET LOCAL app.tenant_id calistirilmalidir.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v::uuid;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kisi', 'kullanici', 'kullanici_rolu', 'blok', 'bagimsiz_bolum',
    'bolum_iliskisi', 'hesap', 'yevmiye_fisi', 'yevmiye_satiri',
    'borc', 'borc_sorumlusu', 'audit_kaydi', 'outbox_kayit',
    'numara_sayaci', 'is_calistirma'
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

-- Tenant tablosu RLS TASIMAZ: katalog tablosudur ve tenant seçiminden
-- ÖNCE okunur. Erişimi uygulama katmanında (Kapı 2) denetlenir.
-- Bu istisna bilinçlidir ve BFS v1 §2.4 uyarınca gerekçelenmiştir.

-- ---------------------------------------------------------------------------
-- 2) KISMİ UNIQUE INDEX'LER  (BFS v1 §5.3 kural 1)
--
-- Soft-deleted "A-3 dairesi", yeni "A-3" olusturulmasini ENGELLEMEMELIDIR.
-- Bu kural atlanirsa silme islemi ileride kaydi yeniden olusturmayi
-- IMKANSIZ kilar.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX kisi_eposta_uq
  ON kisi (tenant_id, eposta) WHERE silinme_tarihi IS NULL AND eposta IS NOT NULL;

CREATE UNIQUE INDEX kullanici_eposta_uq
  ON kullanici (tenant_id, eposta) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX blok_ad_uq
  ON blok (tenant_id, ad) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX bagimsiz_bolum_kapi_no_uq
  ON bagimsiz_bolum (tenant_id, blok_id, kapi_no) WHERE silinme_tarihi IS NULL;

CREATE UNIQUE INDEX hesap_kod_uq
  ON hesap (tenant_id, kod) WHERE silinme_tarihi IS NULL;

-- Finansal kayitlar soft delete TASIMAZ (BFS v1 §5.1) — kosulsuz unique.
CREATE UNIQUE INDEX yevmiye_fis_no_uq ON yevmiye_fisi (tenant_id, fis_no);
CREATE UNIQUE INDEX borc_tahakkuk_no_uq ON borc (tenant_id, tahakkuk_no, bolum_id);

-- ---------------------------------------------------------------------------
-- 3) MUHASEBE BÜTÜNLÜK KISITLARI  (ADR-0003)
-- ---------------------------------------------------------------------------

-- Bir yevmiye satirinda borc VEYA alacak dolu olur, ikisi birden degil.
ALTER TABLE yevmiye_satiri ADD CONSTRAINT yevmiye_satiri_borc_veya_alacak
  CHECK ((borc > 0 AND alacak = 0) OR (alacak > 0 AND borc = 0));

-- Negatif tutar yok.
ALTER TABLE yevmiye_satiri ADD CONSTRAINT yevmiye_satiri_pozitif
  CHECK (borc >= 0 AND alacak >= 0);

-- Odenen tutar borcu asamaz.
ALTER TABLE borc ADD CONSTRAINT borc_odenen_sinir
  CHECK (odenen >= 0 AND odenen <= tutar);

-- Arsa payi gecerli kesir olmalidir (KMK md. 3).
ALTER TABLE bagimsiz_bolum ADD CONSTRAINT bagimsiz_bolum_arsa_payi
  CHECK (arsa_payi_payda > 0 AND arsa_payi_pay >= 0 AND arsa_payi_pay <= arsa_payi_payda);

-- Net m2 brut m2'yi asamaz.
ALTER TABLE bagimsiz_bolum ADD CONSTRAINT bagimsiz_bolum_m2
  CHECK (brut_m2 > 0 AND net_m2 > 0 AND net_m2 <= brut_m2);

-- Iliski bitis tarihi baslangictan once olamaz.
ALTER TABLE bolum_iliskisi ADD CONSTRAINT bolum_iliskisi_tarih_sirasi
  CHECK (bitis IS NULL OR bitis >= baslangic);

-- Soft delete tutarliligi: silindi_mi true ise silinme_tarihi dolu olmalidir.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kisi','kullanici','blok','bagimsiz_bolum','hesap']
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK ((silindi_mi = false AND silinme_tarihi IS NULL) OR (silindi_mi = true AND silinme_tarihi IS NOT NULL AND silme_gerekcesi IS NOT NULL))',
      t, t || '_soft_delete_tutarlilik'
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) AUDIT ZINCIRI — degistirilemezlik
--
-- Audit kaydi UPDATE ve DELETE kabul etmez. Bu hukuki gerekliligin sonucudur;
-- Event Sourcing degildir (ADR v1.1 §31).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_degistirilemez() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit kaydi degistirilemez veya silinemez (ADR v1.1 §31).'
    USING ERRCODE = '42501';
END $$;

CREATE TRIGGER audit_kaydi_degistirilemez
  BEFORE UPDATE OR DELETE ON audit_kaydi
  FOR EACH ROW EXECUTE FUNCTION audit_degistirilemez();

-- ---------------------------------------------------------------------------
-- 5) YETKILER
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bnos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bnos_app;
