-- ===========================================================================
-- BNOS Apartman Yönetimi — 0009_daire_gorevlisi_adlandirma
--
-- 0008'de kurulan modülün adı "Konut Çalışanı" idi; doğru ad **Daire
-- Görevlisi**. Tablo, enum, index, kısıt ve politika adları buna göre
-- yeniden adlandırılıyor.
--
-- ⚠️  0008 DÜZENLENMEDİ, yeni migration yazıldı. Uygulanmış bir
--     migration'ın içeriğini değiştirmek Prisma'nın sağlama toplamını
--     bozar; o dosyayı çalıştırmış her ortam `migrate resolve` ile elle
--     kurtarılmak zorunda kalırdı.
--
-- YALNIZCA AD DEĞİŞİYOR. Sütunlar, ilişkiler, kısıtlar ve veriler aynı
-- kalıyor; `ALTER ... RENAME` veri kopyalamaz ve satır kaybı üretmez.
--
-- Malik · Kiracı · Sakin ve `kisi` tablosuna DOKUNULMADI.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) TABLOLAR
--
-- RLS politikaları ve yabancı anahtarlar tabloya bağlıdır; RENAME sonrası
-- kendiliğinden yeni ada bakar. Politika ADLARI ayrıca değiştirilir (aşağıda)
-- çünkü eski ad `konut_calisani_tenant_isolation` yanıltıcı kalırdı.
-- ---------------------------------------------------------------------------

ALTER TABLE konut_calisani      RENAME TO daire_gorevlisi;
ALTER TABLE personel_sertifikasi RENAME TO gorevli_sertifikasi;
ALTER TABLE personel_zimmeti     RENAME TO gorevli_zimmeti;

-- Alt tablolardaki `calisan_id` sütunu da adlandırılır: "çalışan" sözcüğü
-- modülden tümüyle kalkmalı, yoksa iki sözlük bir arada yaşar.
ALTER TABLE gorevli_sertifikasi RENAME COLUMN calisan_id TO gorevli_id;
ALTER TABLE gorevli_zimmeti     RENAME COLUMN calisan_id TO gorevli_id;

-- ---------------------------------------------------------------------------
-- 2) ENUM TİPLERİ
--
-- `PersonelGorevi` → `GorevTuru`: görevlinin görev türü. `Vardiya` zaten
-- modülden bağımsız bir kavram, adı korunur.
-- ---------------------------------------------------------------------------

ALTER TYPE "PersonelGorevi"  RENAME TO "GorevTuru";
ALTER TYPE "PersonelDurumu"  RENAME TO "GorevliDurumu";

-- ---------------------------------------------------------------------------
-- 3) INDEX ve KISIT ADLARI
-- ---------------------------------------------------------------------------

ALTER INDEX konut_calisani_pkey                    RENAME TO daire_gorevlisi_pkey;
ALTER INDEX konut_calisani_tenant_id_durum_gorev_idx
  RENAME TO daire_gorevlisi_tenant_id_durum_gorev_idx;
ALTER INDEX konut_calisani_tenant_id_apartman_id_idx
  RENAME TO daire_gorevlisi_tenant_id_apartman_id_idx;
ALTER INDEX konut_calisani_tc_aktif_uq             RENAME TO daire_gorevlisi_tc_aktif_uq;

ALTER INDEX personel_sertifikasi_pkey              RENAME TO gorevli_sertifikasi_pkey;
ALTER INDEX personel_sertifikasi_tenant_id_calisan_id_idx
  RENAME TO gorevli_sertifikasi_tenant_id_gorevli_id_idx;

ALTER INDEX personel_zimmeti_pkey                  RENAME TO gorevli_zimmeti_pkey;
ALTER INDEX personel_zimmeti_tenant_id_calisan_id_idx
  RENAME TO gorevli_zimmeti_tenant_id_gorevli_id_idx;

ALTER TABLE daire_gorevlisi
  RENAME CONSTRAINT konut_calisani_tenant_id_fkey TO daire_gorevlisi_tenant_id_fkey;
ALTER TABLE daire_gorevlisi
  RENAME CONSTRAINT konut_calisani_apartman_id_fkey TO daire_gorevlisi_apartman_id_fkey;
ALTER TABLE daire_gorevlisi
  RENAME CONSTRAINT konut_calisani_tarih_sirasi TO daire_gorevlisi_tarih_sirasi;
ALTER TABLE daire_gorevlisi
  RENAME CONSTRAINT konut_calisani_durum_tutarlilik TO daire_gorevlisi_durum_tutarlilik;
ALTER TABLE daire_gorevlisi
  RENAME CONSTRAINT konut_calisani_soft_delete_tutarlilik
  TO daire_gorevlisi_soft_delete_tutarlilik;
ALTER TABLE daire_gorevlisi
  RENAME CONSTRAINT konut_calisani_tc_bicim TO daire_gorevlisi_tc_bicim;

ALTER TABLE gorevli_sertifikasi
  RENAME CONSTRAINT personel_sertifikasi_tenant_id_fkey TO gorevli_sertifikasi_tenant_id_fkey;
ALTER TABLE gorevli_sertifikasi
  RENAME CONSTRAINT personel_sertifikasi_calisan_id_fkey TO gorevli_sertifikasi_gorevli_id_fkey;
ALTER TABLE gorevli_sertifikasi
  RENAME CONSTRAINT personel_sertifikasi_tarih_sirasi TO gorevli_sertifikasi_tarih_sirasi;

ALTER TABLE gorevli_zimmeti
  RENAME CONSTRAINT personel_zimmeti_tenant_id_fkey TO gorevli_zimmeti_tenant_id_fkey;
ALTER TABLE gorevli_zimmeti
  RENAME CONSTRAINT personel_zimmeti_calisan_id_fkey TO gorevli_zimmeti_gorevli_id_fkey;
ALTER TABLE gorevli_zimmeti
  RENAME CONSTRAINT personel_zimmeti_tarih_sirasi TO gorevli_zimmeti_tarih_sirasi;
ALTER TABLE gorevli_zimmeti
  RENAME CONSTRAINT personel_zimmeti_adet_pozitif TO gorevli_zimmeti_adet_pozitif;

-- ---------------------------------------------------------------------------
-- 4) RLS POLİTİKA ADLARI
--
-- Politikanın kendisi tabloya bağlı olduğu için RENAME sonrası çalışmaya
-- devam eder; yalnızca adı güncellenir. İzolasyon hiçbir an kalkmaz.
-- ---------------------------------------------------------------------------

ALTER POLICY konut_calisani_tenant_isolation ON daire_gorevlisi
  RENAME TO daire_gorevlisi_tenant_isolation;
ALTER POLICY personel_sertifikasi_tenant_isolation ON gorevli_sertifikasi
  RENAME TO gorevli_sertifikasi_tenant_isolation;
ALTER POLICY personel_zimmeti_tenant_isolation ON gorevli_zimmeti
  RENAME TO gorevli_zimmeti_tenant_isolation;

-- Yetkiler tabloya bağlıdır ve RENAME ile taşınır; yeniden GRANT gerekmez.
-- Doğrulama için yine de açıkça verilir (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE ON daire_gorevlisi TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON gorevli_sertifikasi TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON gorevli_zimmeti TO bnos_app;
