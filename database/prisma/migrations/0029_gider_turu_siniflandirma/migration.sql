-- 0029 · GİDER TÜRÜ SINIFLANDIRMASI — mevcut kayıtlar
--
-- 0027 `tahakkuk_sikligi` kolonunu `DONEMSEL` varsayılanıyla ekledi. Ölçüt
-- şudur: "aynı ay içinde bu türden ikinci bir gider NORMAL Mİ?"
--
-- Evet olan iki tür var; bunlar olay bazlıdır:
--
--   ANA_BAKIM — onarım bir olaydır. Aynı ay çatı akıntısı VE boya işi
--               olabilir; ikincisi ilkinin düzeltmesi değildir.
--   SIGORTA   — poliçe takvim ayına oturmaz. Aynı ay ikinci poliçe
--               (asansör sigortası, DASK yenilemesi, ek teminat) meşrudur.
--               Referans = poliçe numarasıdır.
--
-- Kalanlar dönemseldir: KAPICI · TEMIZLIK · YONETIM · ASANSOR_ISLETME ·
-- YENILEME_FONU · ISITMA · ELEKTRIK_ORTAK · SU.
--
-- ⚠️  YAKIT TÜRÜ BU MIGRATION'DA ÜRETİLMEZ. Yeni kurulumlara tohum verisiyle
--     gelir. Mevcut projelere otomatik eklemek, o projenin ısınma modelini
--     (pay ölçerli mi, pay ölçersiz mi) bilmeden karar vermek olurdu — bu bir
--     PROJE AYARIDIR, migration kararı değil.

ALTER TABLE gider_turu NO FORCE ROW LEVEL SECURITY;

UPDATE gider_turu
SET tahakkuk_sikligi = 'OLAY_BAZLI'
WHERE kod IN ('ANA_BAKIM', 'SIGORTA');

ALTER TABLE gider_turu FORCE ROW LEVEL SECURITY;
