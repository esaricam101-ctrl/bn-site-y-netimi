-- ===========================================================================
-- 0022 · SATIR KAPSAMI — tenant izolasyonunun İKİNCİ EKSENİ
--
-- Kaynak: ADR-0002 (aynı gerekçe) · ADR v1.1 §10 KVKK ·
--         `RolTanimi.yalnizcaKendiVerisi`
--
-- SORUN: `yalnizcaKendiVerisi` bayrağı ve `KENDI_VERISI_KISITLI` listesi
-- tanımlıydı ama HİÇBİR YERDE OKUNMUYORDU. Canlı doğrulamada MALİK rolündeki
-- bir kullanıcı `/kisiler` ucundan tenant'ın bütün kişilerini, `/bolumler`den
-- bütün daireleri ve `/daireler/<başka>/kart` ucundan komşusunun tapu ve
-- malik bilgisini çekebiliyordu.
--
-- ⚠️  ÇÖZÜM NEDEN BURADA (VERİTABANINDA), UÇLARDA DEĞİL:
--     ADR-0002 tenant izolasyonu için birebir aynı soruyu yanıtlamıştı —
--     "izolasyon uygulama katmanındaki `where` koşuluna BIRAKILMAZ; veritabanı
--     zorlar". Gerekçe aynen geçerlidir: unutulan bir `where` derleme hatası
--     vermez, lint hatası vermez, testle yakalanmazsa HİÇ görünmez. Bugün 204
--     uç var; birinde unutmak yeterlidir.
--
-- ⚠️  POLİTİKALAR **RESTRICTIVE**'DİR, PERMISSIVE DEĞİL.
--     PostgreSQL permissive politikaları OR'lar. Kapsam politikası permissive
--     olsaydı tenant politikasıyla OR'lanır ve İZOLASYONU GEVŞETİRDİ:
--     "kendi bölümüm" koşulunu sağlayan bir satır, BAŞKA TENANT'A ait olsa
--     bile görünürdü. RESTRICTIVE olan politikalar AND'lenir.
--
-- ⚠️  KISITSIZLIK = BOŞ AYAR. Yönetici, denetçi, sistem işleri ve migration
--     bu durumdadır. `PrismaService.tenantIslemi` her transaction'da ayarı
--     AÇIKÇA yazar (boş bile olsa); yazılmasaydı `current_setting(...,true)`
--     NULL döner ve kapsam sessizce kalkardı.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) OKUYUCU FONKSİYONLAR
-- ---------------------------------------------------------------------------

/*
 * Kapsam KISITLI mı?
 *
 * `app_tenant_id()`den farklı olarak ayar yoksa HATA ATMAZ, "kısıtsız" döner.
 * Fark bilinçlidir: tenant bağlamı olmadan hiçbir sorgu çalışmamalıdır ama
 * kapsam yalnızca sakin sınıfı roller için vardır ve yönetici sorgularının
 * çoğunda boştur.
 */
CREATE OR REPLACE FUNCTION app_kapsam_serbest() RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.kapsam_kisi_id', true);
  RETURN v IS NULL OR v = '';
END $$;

CREATE OR REPLACE FUNCTION app_kapsam_kisi_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.kapsam_kisi_id', true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
END $$;

/*
 * Görüntüleyenin bağlı olduğu bölümler.
 *
 * ⚠️  DEĞER UYGULAMADAN GELİR, BURADA SORGULANMAZ. Fonksiyon `malik`/`kiraci`/
 *     `sakin` tablolarını okusaydı, o tabloların KENDİ kapsam politikaları
 *     devreye girer ve SONSUZ ÖZYİNELEME olurdu. Liste `TenantGuard` içinde
 *     kapsam kurulmadan ÖNCE hesaplanır ve ayara yazılır.
 */
CREATE OR REPLACE FUNCTION app_kapsam_bolumler() RETURNS uuid[]
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.kapsam_bolumler', true);
  IF v IS NULL OR v = '' THEN RETURN ARRAY[]::uuid[]; END IF;
  RETURN string_to_array(v, ',')::uuid[];
END $$;

/*
 * Kapsam içindeki KİŞİLER — kendi hanesindekiler.
 *
 * Özyineleme YOKTUR: bu fonksiyon `malik`/`kiraci`/`sakin` okur, o tabloların
 * kapsam politikaları ise yalnızca `app_kapsam_bolumler()` (ayar okuma)
 * çağırır ve `kisi`ye DÖNMEZ.
 *
 * ⚠️  REŞİT OLMAYANLAR: ayrı bir yaş süzgeci YOKTUR ve gerekmez. Kural
 *     "başka hanenin reşit olmayanı görünmez"dir; bu politika zaten yalnızca
 *     KENDİ hanesini geçirir, dolayısıyla başka hanenin çocuğu da elenir.
 *     Kendi çocuğunu velinin görmesi İSTENEN davranıştır (giriş/çıkış
 *     düzeltmesi ve acil durum kişisi yönetimi buna bağlıdır).
 */
CREATE OR REPLACE FUNCTION app_kapsam_kisileri() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT k), ARRAY[]::uuid[])
  FROM (
    SELECT kisi_id AS k FROM malik  WHERE bolum_id = ANY(app_kapsam_bolumler())
    UNION
    SELECT kisi_id      FROM kiraci WHERE bolum_id = ANY(app_kapsam_bolumler())
    UNION
    SELECT kisi_id      FROM sakin  WHERE bolum_id = ANY(app_kapsam_bolumler())
  ) t
$$;

-- ---------------------------------------------------------------------------
-- 2) POLİTİKALAR
--
-- Yalnızca SELECT kapsanır. Yazma yolları Kapı 3 (izin) ile korunur ve sakin
-- sınıfı rollerin yazma izni zaten yoktur; SELECT'e sınırlamak, kapsam
-- kurulumundaki bir hatanın yazma yollarını kilitlemesini önler.
-- ---------------------------------------------------------------------------

-- Kişi: KENDİSİ + kendi hanesindekiler.
CREATE POLICY kisi_kapsam ON kisi AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR id = app_kapsam_kisi_id()
    OR id = ANY(app_kapsam_kisileri())
  );

-- Bağımsız bölüm: yalnızca bağlı olduğu daireler.
CREATE POLICY bagimsiz_bolum_kapsam ON bagimsiz_bolum AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR id = ANY(app_kapsam_bolumler()));

-- Bölüme bağlı ilişki kayıtları.
CREATE POLICY malik_kapsam ON malik AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

CREATE POLICY kiraci_kapsam ON kiraci AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

CREATE POLICY sakin_kapsam ON sakin AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

CREATE POLICY bolum_iliskisi_kapsam ON bolum_iliskisi AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

-- Finansal kayıtlar: kendi dairesinin borcu.
CREATE POLICY borc_kapsam ON borc AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

-- Borç sorumlusu KİŞİ eksenlidir: kendi borç payını görür.
CREATE POLICY borc_sorumlusu_kapsam ON borc_sorumlusu AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR kisi_id = app_kapsam_kisi_id()
    OR kisi_id = ANY(app_kapsam_kisileri())
  );

-- Operasyonel kayıtlar.
CREATE POLICY arac_kapsam ON arac AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR bolum_id IS NULL
    OR bolum_id = ANY(app_kapsam_bolumler())
  );

CREATE POLICY misafir_kapsam ON misafir AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

CREATE POLICY daire_gorevlisi_kapsam ON daire_gorevlisi AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

CREATE POLICY sayac_kapsam ON sayac AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_bolumler()));

-- Tahsilat: ödeyen kişi ekseninde.
CREATE POLICY tahsilat_kapsam ON tahsilat AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR odeyen_kisi_id = app_kapsam_kisi_id()
    OR odeyen_kisi_id = ANY(app_kapsam_kisileri())
  );

-- İletişim: kendi mesajları.
CREATE POLICY mesaj_kapsam ON mesaj AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR kisi_id = app_kapsam_kisi_id()
    OR kisi_id = ANY(app_kapsam_kisileri())
  );

CREATE POLICY iletisim_izni_kapsam ON iletisim_izni AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR kisi_id = app_kapsam_kisi_id()
    OR kisi_id = ANY(app_kapsam_kisileri())
  );

-- ---------------------------------------------------------------------------
-- 3) YETKİLER
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION app_kapsam_serbest()   TO bnos_app;
GRANT EXECUTE ON FUNCTION app_kapsam_kisi_id()   TO bnos_app;
GRANT EXECUTE ON FUNCTION app_kapsam_bolumler()  TO bnos_app;
GRANT EXECUTE ON FUNCTION app_kapsam_kisileri()  TO bnos_app;
