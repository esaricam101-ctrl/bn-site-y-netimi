-- ===========================================================================
-- 0024 · HİSSELİ MÜLKİYETTE HER MALİK YALNIZCA KENDİ PAYINI GÖRÜR
--
-- Kaynak: ürün sahibi kararı (31 Temmuz 2026)
--
-- SORUN: 0023'teki `borc_sorumlusu_kapsam` politikası, bölümün borcunu gören
-- herkese O BÖLÜMÜN BÜTÜN SORUMLULARINI açıyordu. Hisseli mülkiyette (1/3 ·
-- 1/3 · 1/3) bu, her malikin öteki iki malikin payını ve ödeme durumunu
-- görmesi demekti.
--
-- KARAR: her malik YALNIZCA KENDİ PAYINI görür.
--
-- ⚠️  BEDELİ AÇIKÇA KABUL EDİLDİ: KMK md. 20 ortak giderde müteselsil
--     sorumluluk kurar; A, B'nin ödemediği paydan sorumlu tutulabilir ama
--     artık B'nin ödeyip ödemediğini GÖREMEZ. Yani kendi hukuki riskini
--     sistemden okuyamaz. Bu, KVKK veri minimizasyonu lehine verilmiş
--     bilinçli bir karardır — teknik bir kısıt değil.
--
-- ⚠️  KİRACI SATIRI AYRIDIR ve GÖRÜNÜR KALIR. Malikin kiraya verdiği dairede
--     "kiracı ödedi mi" sorusunu görmesi KMK md. 22'ye dayanır ve 0023'ün
--     konusudur. Ayrım `rol` sütunuyla kurulur: MALİK satırları gizlenir,
--     KİRACI/SAKİN satırları görünür.
--
--     Tek koşulla yazılsaydı ikisinden biri mutlaka yanlış olurdu.
-- ===========================================================================

DROP POLICY borc_sorumlusu_kapsam ON borc_sorumlusu;

CREATE POLICY borc_sorumlusu_kapsam ON borc_sorumlusu AS RESTRICTIVE FOR SELECT
  USING (
    app_kapsam_serbest()
    -- 1) KENDİ payı — rolü ne olursa olsun.
    OR kisi_id = app_kapsam_kisi_id()
    -- 2) Öteki satırlar YALNIZCA malik olmayanlar için açılır.
    --    Bu koşul olmadan ortak malikler birbirinin payını görürdü.
    OR (
      rol <> 'MALIK'
      AND (
        -- 2a) Kendi hanesindeki kiracı/sakin (birlikte oturduğu kişiler).
        kisi_id = ANY(app_kapsam_kisileri())
        -- 2b) Kiraya verdiği mülkün sakini — "kiracı ödedi mi" (KMK md. 22).
        OR EXISTS (
          SELECT 1 FROM borc b
          WHERE b.id = borc_sorumlusu.borc_id
            AND b.bolum_id = ANY(app_kapsam_mulk_bolumler())
        )
      )
    )
  );
