-- ===========================================================================
-- BNOS Apartman Yönetimi — 0003_gider_enum_genisletme
--
-- Domain katmanı bu değerleri BUGÜN destekliyordu ama veritabanına
-- yazılamıyordu: `shared/apartman-domain/src/gider/gider-turu.ts` içindeki
-- `PaylasimKurali` ve `SorumlulukTipi` birlik tipleri şemadaki enum'lardan
-- geniştir. Tanımlanan kural kaydedilemiyor, kaydedilemediği için de
-- uygulanamıyordu (bekleyen liste C-9).
--
-- NEDEN AYRI MIGRATION: PostgreSQL'de `ALTER TYPE ... ADD VALUE` aynı
-- transaction içinde kullanılamaz (PG 12 öncesi kesin, sonrasında da
-- kısıtlıdır). Prisma migration'ları transaction içinde koştuğu için bu
-- ifadeler kendi migration'ında ve `ALTER TYPE` ile yalın olarak durur.
-- ===========================================================================

-- Eksen 1 — paylaşım kuralı.
--
-- KULLANIM_BAZLI: yalnızca hizmeti kullanan bölümler öder. Otopark hakkı
--   olmayan daireye otopark gideri yazmak KMK md. 20'ye aykırıdır.
-- BLOK_BAZLI: yalnızca ilgili bloğun bölümleri öder. A blok asansör onarımını
--   B bloğa yansıtmak, ödemeyeni haklı çıkarır.
-- MANUEL: yönetici tutarları bölüm bölüm belirler; toplam gidere eşit olmak
--   zorundadır — eşitlik uygulama katmanında zorlanır, tek satırdan
--   doğrulanamaz.
ALTER TYPE "PaylasimKurali" ADD VALUE IF NOT EXISTS 'KULLANIM_BAZLI';
ALTER TYPE "PaylasimKurali" ADD VALUE IF NOT EXISTS 'BLOK_BAZLI';
ALTER TYPE "PaylasimKurali" ADD VALUE IF NOT EXISTS 'MANUEL';

-- Eksen 2 — sorumluluk tipi.
--
-- SAKINE_AIT, KULLANANA_AIT'ten AYRIDIR: kiracı bir şirket olabilir ve
-- dairede şirketin çalışanı oturuyor olabilir. Tüketime bağlı giderlerde
-- yönetim planı sorumluluğu fiilen oturana verebilir. Ayrım olmadan bu
-- kural yazılamaz ve gider yanlış kişiye tahakkuk eder.
ALTER TYPE "SorumlulukTipi" ADD VALUE IF NOT EXISTS 'SAKINE_AIT';

-- Bölüm ilişkisi rolü — borç sorumlusu çözümlemesi bu rolü kullanır.
ALTER TYPE "IliskiRolu" ADD VALUE IF NOT EXISTS 'SAKIN';
