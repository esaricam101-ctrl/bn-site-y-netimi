-- BNOS Apartman — veritabanı rolleri
-- Kaynak: ADR-0002 · BFS v1 §2.3 · docs/VERITABANI-KURULUM.md
--
-- KRİTİK: Uygulama rolünün BYPASSRLS yetkisi YOKTUR.
-- Bu, RLS'in son savunma hattı olarak çalışmasının ön koşuludur.
-- CI'da test edilir (CT-01 · rls-izolasyon.spec.ts).
--
-- ⚠️  BU DOSYA GELİŞTİRME VE CI İÇİNDİR. Üretim yordamı AYRIDIR ve şema
--     sahipliği içermez — bkz. `docs/VERITABANI-KURULUM.md`.
--
-- ⚠️  VERİTABANI ADINDAN BAĞIMSIZDIR. Docker geliştirme ortamı
--     `bnos_apartman`, CI `bnos_test` kullanır; aynı dosyanın ikisinde de
--     koşabilmesi için veritabanı adı `current_database()` ile çözülür.
--     Adı sabit yazmak, CI'ın init'i atlayıp süper kullanıcıyla koşmasına
--     ve RLS testlerinin ANLAMSIZ hâle gelmesine yol açmıştı.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bnos_app') THEN
    CREATE ROLE bnos_app WITH LOGIN PASSWORD 'bnos_app_dev' NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bnos_migrator') THEN
    CREATE ROLE bnos_migrator WITH LOGIN PASSWORD 'bnos_migrator_dev' NOBYPASSRLS;
  END IF;
END $$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO bnos_app, bnos_migrator',
                 current_database());
END $$;

-- Migrator şema değiştirir; app yalnızca veri okur/yazar.
GRANT CREATE ON SCHEMA public TO bnos_migrator;
GRANT USAGE  ON SCHEMA public TO bnos_app;

ALTER DEFAULT PRIVILEGES FOR ROLE bnos_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bnos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bnos_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bnos_app;

/*
 * ★ ŞEMA SAHİPLİĞİ + VERİTABANI ÜZERİNDE CREATE — GELİŞTİRME VE CI İÇİN.
 *
 * NEDEN: `prisma migrate reset` önce `DROP SCHEMA public CASCADE` dener.
 * Sahiplik olmadan bu "must be owner of schema public" ile düşer ve Prisma
 * CASCADE'SİZ tek tek düşürmeye geri düşer. Geri düşüş yolu, çapraz tabloya
 * bakan iki RLS politikasına (`borc_sorumlusu_kapsam`, `tahsilat_kapsam`)
 * takılır ve reset tümüyle başarısız olur.
 *
 * Yani sorun politikalar DEĞİLDİR; sahiplik olmadığı için hiç kullanılmaması
 * gereken bir yola düşülmesidir.
 *
 * ⚠️  İKİ YETKİ BİRLİKTE GEREKİR — sahiplik TEK BAŞINA YETMEZ. Ölçüldü:
 *     yalnızca sahiplik verildiğinde `DROP SCHEMA` çalışıyor ama ardından
 *     gelen `CREATE SCHEMA public` "no schema has been selected to create in"
 *     ile düşüyor ve veritabanı ŞEMASIZ kalıyor. Şema yaratmak, şema
 *     üzerinde değil VERİTABANI üzerinde `CREATE` yetkisi ister.
 *
 * ⚠️  ÜRETİMDE UYGULANMAMALIDIR. Üretimde `bnos_migrator` şema sahibi
 *     OLMAMALIDIR: migration için `CREATE ON SCHEMA` yeterlidir, sahiplik
 *     yalnızca reset içindir ve üretimde reset ÇALIŞTIRILMAZ. Sahiplik
 *     verilirse yanlış bir komut tüm şemayı düşürebilir.
 */
ALTER SCHEMA public OWNER TO bnos_migrator;

DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO bnos_migrator', current_database());
END $$;

-- §38 Türkçe tam metin arama için gerekli (Sprint 9'da yapılandırılır)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
