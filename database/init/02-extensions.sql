-- Turkce tam metin arama on kosullari (ADR v1.1 §38 · Sprint 9'da yapilandirilir).
-- PostgreSQL VARSAYILAN OLARAK Turkce sozluk yapilandirmasi GETIRMEZ.
-- Bu uzantilar kurulur; gercek yapilandirma ve DOGRULAMA Sprint 9 isidir.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
