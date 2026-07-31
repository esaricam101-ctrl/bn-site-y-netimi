-- ===========================================================================
-- 0025 · KAPSAM POLİTİKALARI — argümansız STABLE çağrıları InitPlan'a sarılır
--
-- ÖLÇÜLEN SORUN (31 Temmuz 2026, 5.000 bölümlü sentetik veri):
--
--   GET /kisiler eşdeğeri, 200 daireli malik:
--     Execution Time: 39.227 ms · Buffers: shared hit=545.390
--   Aynı sorgu kısıtsız:
--     Execution Time:      0,295 ms · Buffers: shared hit=54
--
-- KÖK SEBEP: `id = ANY (app_kapsam_kisileri())` ifadesi WHERE filtresinde
-- SATIR BAŞINA yeniden değerlendiriliyordu. `STABLE` işareti bunu engellemez —
-- `STABLE` yalnızca "aynı anlık görüntüde aynı sonucu döndürür" der, "sorgu
-- başına bir kez çalışır" DEMEZ. Plan bunu doğruluyordu:
--
--   Filter: (... OR (id = ANY (app_kapsam_kisileri())))
--
-- ÇÖZÜM: argümansız çağrıyı SKALER ALT SORGUYA sarmak. PostgreSQL alt
-- sorguyu InitPlan'a çevirir ve sorgu başına BİR KEZ değerlendirir:
--
--   id IN (SELECT unnest(app_kapsam_kisileri()))
--
-- ⚠️  SARMALAMA TÜM TABLOLARDA YAPILIR, yalnızca `kisi`de değil. Tek tabloda
--     yapılsaydı öteki 14 tablo aynı satır-başına maliyeti taşımaya devam
--     ederdi ve fark yalnızca en çok bakılan uçta görünürdü — hata sessiz
--     kalırdı.
-- ===========================================================================

-- --------------------------- kisi ------------------------------------------
DROP POLICY kisi_kapsam ON kisi;
CREATE POLICY kisi_kapsam ON kisi AS RESTRICTIVE FOR SELECT
  USING (
    (SELECT app_kapsam_serbest())
    OR id = (SELECT app_kapsam_kisi_id())
    OR id IN (SELECT unnest(app_kapsam_kisileri()))
  );

-- --------------------- bölüm eksenli: OTURULAN -----------------------------
DROP POLICY kiraci_kapsam ON kiraci;
CREATE POLICY kiraci_kapsam ON kiraci AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

DROP POLICY sakin_kapsam ON sakin;
CREATE POLICY sakin_kapsam ON sakin AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

DROP POLICY bolum_iliskisi_kapsam ON bolum_iliskisi;
CREATE POLICY bolum_iliskisi_kapsam ON bolum_iliskisi AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

DROP POLICY misafir_kapsam ON misafir;
CREATE POLICY misafir_kapsam ON misafir AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

DROP POLICY daire_gorevlisi_kapsam ON daire_gorevlisi;
CREATE POLICY daire_gorevlisi_kapsam ON daire_gorevlisi AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

DROP POLICY sayac_kapsam ON sayac;
CREATE POLICY sayac_kapsam ON sayac AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

DROP POLICY arac_kapsam ON arac;
CREATE POLICY arac_kapsam ON arac AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IS NULL
         OR bolum_id IN (SELECT unnest(app_kapsam_bolumler())));

-- ---------------- bölüm eksenli: OTURULAN + MÜLK (finans) ------------------
DROP POLICY bagimsiz_bolum_kapsam ON bagimsiz_bolum;
CREATE POLICY bagimsiz_bolum_kapsam ON bagimsiz_bolum AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR id IN (SELECT unnest(app_kapsam_finans_bolumler())));

DROP POLICY malik_kapsam ON malik;
CREATE POLICY malik_kapsam ON malik AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_finans_bolumler())));

DROP POLICY borc_kapsam ON borc;
CREATE POLICY borc_kapsam ON borc AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR bolum_id IN (SELECT unnest(app_kapsam_finans_bolumler())));

-- --------------------------- kişi eksenli ----------------------------------
DROP POLICY mesaj_kapsam ON mesaj;
CREATE POLICY mesaj_kapsam ON mesaj AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR kisi_id = (SELECT app_kapsam_kisi_id())
         OR kisi_id IN (SELECT unnest(app_kapsam_kisileri())));

DROP POLICY iletisim_izni_kapsam ON iletisim_izni;
CREATE POLICY iletisim_izni_kapsam ON iletisim_izni AS RESTRICTIVE FOR SELECT
  USING ((SELECT app_kapsam_serbest())
         OR kisi_id = (SELECT app_kapsam_kisi_id())
         OR kisi_id IN (SELECT unnest(app_kapsam_kisileri())));

DROP POLICY tahsilat_kapsam ON tahsilat;
CREATE POLICY tahsilat_kapsam ON tahsilat AS RESTRICTIVE FOR SELECT
  USING (
    (SELECT app_kapsam_serbest())
    OR odeyen_kisi_id = (SELECT app_kapsam_kisi_id())
    OR odeyen_kisi_id IN (SELECT unnest(app_kapsam_kisileri()))
    OR EXISTS (
      SELECT 1 FROM tahsilat_tahsisi tt
      JOIN borc b ON b.id = tt.borc_id
      WHERE tt.tahsilat_id = tahsilat.id
        AND b.bolum_id IN (SELECT unnest(app_kapsam_finans_bolumler()))
    )
  );

-- Hisseli mülkiyet kuralı 0024'ten AYNEN korunur; yalnızca sarmalama eklenir.
DROP POLICY borc_sorumlusu_kapsam ON borc_sorumlusu;
CREATE POLICY borc_sorumlusu_kapsam ON borc_sorumlusu AS RESTRICTIVE FOR SELECT
  USING (
    (SELECT app_kapsam_serbest())
    OR kisi_id = (SELECT app_kapsam_kisi_id())
    OR (
      rol <> 'MALIK'
      AND (
        kisi_id IN (SELECT unnest(app_kapsam_kisileri()))
        OR EXISTS (
          SELECT 1 FROM borc b
          WHERE b.id = borc_sorumlusu.borc_id
            AND b.bolum_id IN (SELECT unnest(app_kapsam_mulk_bolumler()))
        )
      )
    )
  );
