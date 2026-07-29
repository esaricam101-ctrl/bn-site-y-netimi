-- ===========================================================================
-- BNOS Apartman Yönetimi — 0004_arac
--
-- Domain katmanı (`shared/apartman-domain/src/arac/arac.ts`) bu kuralları
-- zaten taşıyordu; eksik olan kalıcılıktı (bekleyen liste C-8).
--
-- ⚠️  `prisma migrate diff` ÇIKTISI OLDUĞU GİBİ KULLANILMADI.
--
-- Diff, şemada tanımlı olmayan ELLE YAZILMIŞ kısmi unique index'leri
-- düşürmek ister:
--     DROP INDEX borc_tahakkuk_no_uq · malik_kisi_donem_uq ·
--                kiraci_kisi_donem_uq · sakin_kisi_donem_uq ·
--                yevmiye_fis_no_uq
-- Bunlar Prisma şemasından ÜRETİLEMEZ (kısmi index ve soft-delete koşulu
-- taşırlar) ve 0001'de elle yazılmışlardır. Diff çıktısı olduğu gibi
-- uygulansaydı mükerrer tahakkuk numarası, aynı kişinin aynı bölümde aynı
-- tarihte iki kez malik olması ve mükerrer yevmiye fiş numarası SESSİZCE
-- mümkün hale gelirdi.
--
-- KURAL: her migration'da diff çıktısındaki DROP INDEX satırları elle
-- gözden geçirilir. Şemada karşılığı olmayan bir index'i düşürmek, o
-- index'in koruduğu kuralı düşürmektir.
-- ===========================================================================

CREATE TYPE "AracTuru" AS ENUM ('OTOMOBIL', 'MOTOSIKLET', 'TICARI', 'BISIKLET', 'DIGER');

CREATE TABLE "arac" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bolum_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    -- Normalize edilmis plaka (bosluksuz, buyuk harf). Mukerrer denetimi bu
    -- deger uzerinden yapilir; "34 ABC 123" ve "34abc123" AYNI aractir.
    "plaka" VARCHAR(16) NOT NULL,
    "tur" "AracTuru" NOT NULL DEFAULT 'OTOMOBIL',
    "marka" VARCHAR(40),
    "model" VARCHAR(40),
    "renk" VARCHAR(24),
    "otopark_yeri" VARCHAR(24),
    "baslangic" DATE NOT NULL,
    "bitis" DATE,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "arac_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "arac_tenant_id_bolum_id_idx" ON "arac"("tenant_id", "bolum_id");
CREATE INDEX "arac_tenant_id_plaka_idx" ON "arac"("tenant_id", "plaka");

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR — `FORCE ROW LEVEL SECURITY` ile etkileşim
--
-- `ADD CONSTRAINT ... FOREIGN KEY` PostgreSQL'de bir DOĞRULAMA TARAMASI
-- başlatır: referans veren satırların hedefte karşılığı var mı diye bakar.
-- Bu tarama hedef tabloyu (`bagimsiz_bolum`, `kisi`) okur ve o tablolarda
-- `FORCE ROW LEVEL SECURITY` açıktır — sahibi bile politikaya tabidir.
-- Tarama tenant bağlamı olmadan koştuğu için `app_tenant_id()` exception
-- atar ve migration şu hatayla düşer:
--
--     ERROR: Tenant baglami kurulmadan sorgu calistirilamaz
--
-- NOT: bu, çalışma zamanındaki RI tetikleyicilerinden FARKLIDIR. Uygulama
-- INSERT yaparken FK denetimi sistem ayrıcalığıyla koşar ve RLS'i atlar;
-- bu yüzden çapraz-tenant referans uygulama katmanında AYRICA denetlenir.
-- Kısıtın İLK KURULUMUNDAKİ tarama ise bu ayrıcalığı almaz.
--
-- ÇÖZÜM: hedef tabloların FORCE'u yalnızca bu işlem boyunca kaldırılır.
-- Migration transaction içinde koşar; herhangi bir hata olursa ALTER da
-- geri alınır ve tablolar FORCE'suz KALMAZ. RLS'in kendisi (ENABLE) hiçbir
-- an kapatılmaz — yalnızca sahibin muafiyeti geri verilir.
-- ---------------------------------------------------------------------------

ALTER TABLE bagimsiz_bolum NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi           NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "arac" ADD CONSTRAINT "arac_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "arac" ADD CONSTRAINT "arac_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "arac" ADD CONSTRAINT "arac_kisi_id_fkey"
  FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FORCE geri verilir. Bu satırlar ATLANIRSA sahibi rolüyle çalışan her
-- sorgu RLS'i atlar ve izolasyon garantisi tek taraflı kalkar.
ALTER TABLE bagimsiz_bolum FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi           FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — 0001'deki desenin aynısı.
--
-- Atlanırsa tablo RLS'siz kalır ve çapraz-tenant okuma mümkün olur;
-- HATA SESSİZDİR. `scripts/rls-scan.mjs` uygulama kodunu tarar ama
-- tablonun RLS'ini veritabanı tarafında burası kurar.
-- ---------------------------------------------------------------------------
ALTER TABLE arac ENABLE ROW LEVEL SECURITY;
ALTER TABLE arac FORCE  ROW LEVEL SECURITY;
CREATE POLICY arac_tenant_isolation ON arac
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

ALTER TABLE arac ADD CONSTRAINT arac_tarih_sirasi
  CHECK (bitis IS NULL OR bitis >= baslangic);

-- Aynı plaka aynı anda İKİ KEZ kayıtlı olamaz — dönem çakışması uygulama
-- katmanında (`aracKaydiniDogrula`) denetlenir; burada aynı bölümde aynı
-- başlangıçla mükerrer kayıt engellenir.
--
-- Araç SOFT DELETE TAŞIMAZ: kayıt silinmez, `bitis` ile kapanır. Otopark
-- gideri KULLANIM_BAZLI dağıtıldığında hangi ayda hangi aracın kayıtlı
-- olduğu geriye dönük bilinmek zorundadır.
CREATE UNIQUE INDEX arac_plaka_donem_uq
  ON arac (tenant_id, bolum_id, plaka, baslangic);

GRANT SELECT, INSERT, UPDATE, DELETE ON arac TO bnos_app;
