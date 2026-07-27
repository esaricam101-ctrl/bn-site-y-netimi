-- BNOS Apartman — veritabanı rolleri
-- Kaynak: ADR-0002 · BFS v1 §2.3
--
-- KRİTİK: Uygulama rolünün BYPASSRLS yetkisi YOKTUR.
-- Bu, RLS'in son savunma hattı olarak çalışmasının ön koşuludur.
-- CI'da test edilir (tests/contract/rls-bypass.spec.ts).

CREATE ROLE bnos_app WITH LOGIN PASSWORD 'bnos_app_dev' NOBYPASSRLS;
CREATE ROLE bnos_migrator WITH LOGIN PASSWORD 'bnos_migrator_dev' NOBYPASSRLS;

GRANT CONNECT ON DATABASE bnos_apartman TO bnos_app, bnos_migrator;

-- Migrator şema değiştirir; app yalnızca veri okur/yazar.
GRANT CREATE ON SCHEMA public TO bnos_migrator;
GRANT USAGE  ON SCHEMA public TO bnos_app;

ALTER DEFAULT PRIVILEGES FOR ROLE bnos_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bnos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bnos_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bnos_app;

-- §38 Türkçe tam metin arama için gerekli (Sprint 9'da yapılandırılır)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
