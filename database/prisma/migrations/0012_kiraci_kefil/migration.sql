-- ===========================================================================
-- BNOS Apartman Yönetimi — 0012_kiraci_kefil
--
-- Kira sözleşmesinde KEFİL bilgisi. "Yeni Ekle" ekranında kiracıya özel
-- alanlar arasında istendi; tabloda karşılığı yoktu.
--
-- KEFİL AYRI BİR `kisi` KAYDI OLARAK AÇILMAZ, sözleşmenin ÜZERİNDE inline
-- tutulur. Gerekçe:
--
--   · Kefil bir HAK SAHİBİ DEĞİLDİR. Yönetimin ortak gider alacağı KMK
--     md. 20 uyarınca MALİKE, md. 22 uyarınca da kiracıya (kira bedeli
--     kadar, müteselsil) yönelir. KEFİLE YÖNELMEZ — kefalet, malik ile
--     kiracı arasındaki kira sözleşmesinin tarafıdır, yönetim planının
--     değil.
--   · `kisi` kaydı açılsaydı kefil malik/kiracı/sakin listelerine karışır,
--     borç sorumluluğu sorgularında görünür ve "bu kişinin borcu" sorusuna
--     yanlış cevap üretirdi.
--   · Kefalet sözleşmeyle birlikte doğar ve onunla birlikte sona erer;
--     ömrü sözleşmeye bağlıdır (KVKK veri minimizasyonu md. 4/1-ç).
--
-- ⚠️  Malik · Sakin · `kisi` tablolarına DOKUNULMADI. `kiraci` tablosuna
--     yalnızca dört İSTEĞE BAĞLI sütun eklendi; mevcut kayıtlar ve iş
--     kuralları etkilenmedi.
-- ===========================================================================

ALTER TABLE kiraci
  ADD COLUMN kefil_ad_soyad VARCHAR(120),
  ADD COLUMN kefil_tc_kimlik_no VARCHAR(11),
  ADD COLUMN kefil_telefon VARCHAR(32),
  ADD COLUMN kefil_adres TEXT;

ALTER TABLE kiraci ADD CONSTRAINT kiraci_kefil_tc_bicim
  CHECK (kefil_tc_kimlik_no IS NULL OR kefil_tc_kimlik_no ~ '^[0-9]{11}$');

-- Kefil bilgisi varsa ADI ZORUNLUDUR. Adı olmayan ama telefonu/TC'si olan
-- bir kefil kaydı, icra takibinde kime başvurulacağını belirsiz bırakır;
-- "kefil var mı?" sorusunun cevabı tek bir alana bakılarak verilebilmelidir.
ALTER TABLE kiraci ADD CONSTRAINT kiraci_kefil_butun
  CHECK (kefil_ad_soyad IS NOT NULL
      OR (kefil_tc_kimlik_no IS NULL
      AND kefil_telefon IS NULL
      AND kefil_adres IS NULL));
