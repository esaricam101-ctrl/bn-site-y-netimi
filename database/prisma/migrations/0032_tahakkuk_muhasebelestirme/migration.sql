-- 0032 · TAHAKKUKUN MUHASEBELEŞTİRİLMESİ (ADR-0017)
--
-- Tahakkuk borç üretiyordu ama deftere hiç düşmüyordu. Ölçüldü:
--   borc 36 satır · yevmiye_fisi 0 satır
--   kontrol-mutabakati → {"fark":"23400.0000","mutabikMi":false}
-- ADR-0003'ün çift taraflı kayıt kararı, kayıt sisteminin ANA işlem türü
-- için uygulanmamıştı.

-- ---------------------------------------------------------------------------
-- 1) FİŞ TÜRÜ (ADR-0017 · K5)
--
-- MAHSUP'a sıkıştırılsaydı dönem kapanışı ve raporlar tahakkuk fişini ayırt
-- edemezdi; fisTuru bu ayrımın tek dayanağıdır.
-- ---------------------------------------------------------------------------
ALTER TYPE "FisTuru" ADD VALUE IF NOT EXISTS 'TAHAKKUK';
