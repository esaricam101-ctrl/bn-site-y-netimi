-- ===========================================================================
-- 0023 · KİRAYA VERİLMİŞ MÜLKTE KAPSAM DARALIR
--
-- Kaynak: ürün sahibi kararı · KMK md. 22 (müteselsil sorumluluk) · KVKK md. 4
--
-- KURAL: Malik, KİRAYA VERDİĞİ bölümde yalnızca AİDAT BORCUNU ve ÖDEME
-- DURUMUNU görür — kiracının ödeyip ödemediğini. Kiracının kimliği, sözleşme
-- koşulları, ailesi, aracı, misafiri ve iletişim kayıtları bu hakkın
-- KAPSAMINDA DEĞİLDİR.
--
-- ⚠️  GEREKÇE HUKUKİDİR, teknik değil: kiracı aidatı ödemezse borç KMK md. 22
--     uyarınca malike döner. Malikin menfaati bu yüzden BORÇTADIR. Kiracının
--     ev hayatını site yazılımından izlemek bu menfaatin kapsamı değildir ve
--     KVKK veri minimizasyonuna aykırıdır.
--
-- ⚠️  0022 TEK LİSTE KULLANIYORDU ve bu yüzden fazla genişti: malik kendi
--     bölümündeki kiracının sözleşmesini, depozitosunu, kefilini ve ailesini
--     de görebiliyordu. "Borcu görebiliyorsa her şeyi görebilir" sonucu
--     çıkıyordu. Ayrım İKİ AYRI LİSTEYLE kurulur.
--
--   app.kapsam_bolumler       → OTURULAN hane. Tam görünürlük.
--                               (kiracılık · sakinlik · KİRADA OLMAYAN mülk)
--   app.kapsam_mulk_bolumler  → KİRAYA VERİLMİŞ mülk. YALNIZCA borç/ödeme.
-- ===========================================================================

CREATE OR REPLACE FUNCTION app_kapsam_mulk_bolumler() RETURNS uuid[]
LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.kapsam_mulk_bolumler', true);
  IF v IS NULL OR v = '' THEN RETURN ARRAY[]::uuid[]; END IF;
  RETURN string_to_array(v, ',')::uuid[];
END $$;

/* Borç ve ödeme eksenindeki tablolar İKİ listeyi de görür. */
CREATE OR REPLACE FUNCTION app_kapsam_finans_bolumler() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT app_kapsam_bolumler() || app_kapsam_mulk_bolumler()
$$;

GRANT EXECUTE ON FUNCTION app_kapsam_mulk_bolumler()   TO bnos_app;
GRANT EXECUTE ON FUNCTION app_kapsam_finans_bolumler() TO bnos_app;

-- ---------------------------------------------------------------------------
-- 1) FİNANSAL EKSEN — kiraya verilmiş mülk DAHİL
-- ---------------------------------------------------------------------------

DROP POLICY borc_kapsam ON borc;
CREATE POLICY borc_kapsam ON borc AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_finans_bolumler()));

-- Bağımsız bölümün KENDİSİ de görünür: borcun hangi daireye ait olduğu
-- okunamazsa borç listesi anlamsız kalır (kapı no gösterilemez).
DROP POLICY bagimsiz_bolum_kapsam ON bagimsiz_bolum;
CREATE POLICY bagimsiz_bolum_kapsam ON bagimsiz_bolum AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR id = ANY(app_kapsam_finans_bolumler()));

-- Malik kaydı: kendi maliklik kaydını görür (hisse · tapu dönemi).
DROP POLICY malik_kapsam ON malik;
CREATE POLICY malik_kapsam ON malik AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest() OR bolum_id = ANY(app_kapsam_finans_bolumler()));

-- Tahsilat: kiraya verilen dairede yapılan ödeme MALİKİ İLGİLENDİRİR —
-- "kiracı ödedi mi" sorusunun cevabı budur.
DROP POLICY tahsilat_kapsam ON tahsilat;
CREATE POLICY tahsilat_kapsam ON tahsilat AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR odeyen_kisi_id = app_kapsam_kisi_id()
    OR odeyen_kisi_id = ANY(app_kapsam_kisileri())
    OR EXISTS (
      SELECT 1 FROM tahsilat_tahsisi tt
      JOIN borc b ON b.id = tt.borc_id
      WHERE tt.tahsilat_id = tahsilat.id
        AND b.bolum_id = ANY(app_kapsam_finans_bolumler())
    )
  );

/*
 * Borç sorumlusu: kendi payı VE kiraya verdiği dairenin borcunun sorumluları.
 *
 * ⚠️  Burada KİŞİ ADI görünür ve bu BİLİNÇLİDİR: "kiracı ödemedi" bilgisi,
 *     borcun kime yazıldığı bilinmeden anlamsızdır ve malik zaten kendi
 *     kiracısının kim olduğunu sözleşmeden bilir. Sızan yeni bir bilgi yoktur.
 */
DROP POLICY borc_sorumlusu_kapsam ON borc_sorumlusu;
CREATE POLICY borc_sorumlusu_kapsam ON borc_sorumlusu AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    OR kisi_id = app_kapsam_kisi_id()
    OR kisi_id = ANY(app_kapsam_kisileri())
    OR EXISTS (
      SELECT 1 FROM borc b
      WHERE b.id = borc_sorumlusu.borc_id
        AND b.bolum_id = ANY(app_kapsam_finans_bolumler())
    )
  );

-- ---------------------------------------------------------------------------
-- 2) HANE EKSENİ — kiraya verilmiş mülk HARİÇ
--
-- Aşağıdakiler DEĞİŞMEZ; zaten `app_kapsam_bolumler()` (yalnızca oturulan)
-- kullanıyorlar. Burada açıkça yazılmalarının nedeni, ileride birinin
-- "tutarlılık olsun" diye finans listesine çevirmesini önlemektir:
--
--   kiraci · sakin · misafir · daire_gorevlisi · arac · sayac ·
--   bolum_iliskisi · mesaj · iletisim_izni · kisi
--
-- Malik, kiraya verdiği dairede bunları GÖRMEZ. Görmesi gereken tek şey
-- borcun ödenip ödenmediğidir.
-- ---------------------------------------------------------------------------
