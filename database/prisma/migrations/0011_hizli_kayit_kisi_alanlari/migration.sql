-- ===========================================================================
-- BNOS Apartman Yönetimi — 0011_hizli_kayit_kisi_alanlari
--
-- AMAÇ: "Yeni Ekle" akışında kişi SEÇME zorunluluğunu kaldırmak. Malik,
-- kiracı, sakin, misafir ve daire görevlisi tek ekrandan, kişi bilgileri
-- doğrudan girilerek kaydedilebilecek.
--
-- Bunun için eksik olanlar:
--   1. `kisi` tablosunda doğum tarihi · cinsiyet · adres · not YOK.
--   2. MİSAFİR kavramı hiç yok — yeni tablo.
--   3. Araç kaydı yalnızca `kisi`ye bağlanabiliyor; daire görevlisi, site
--      personeli ve misafir aracı kaydedilemiyor.
--
-- ⚠️  Malik · Kiracı · Sakin tablolarına DOKUNULMADI. Onların veri modeli,
--     ilişkileri ve iş kuralları aynen duruyor; yalnızca bağlı oldukları
--     `kisi` kaydı daha fazla alan taşıyor.
--
-- ⚠️  `prisma migrate diff` çıktısı olduğu gibi kullanılmadı (0004-0010
--     notu): elle yazılmış kısmi index'leri düşürmek ister ve FK ekleme
--     `FORCE ROW LEVEL SECURITY` ile çakışır.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) KİŞİ — hızlı kayıtta girilen alanlar
--
-- Hepsi İSTEĞE BAĞLI. KVKK veri minimizasyonu (md. 4/1-ç): doğum tarihi ve
-- cinsiyet aidat tahakkuku için gerekli DEĞİLDİR; zorunlu kılınsaydı her
-- kayıtta gereksiz kişisel veri toplanırdı.
--
-- `Cinsiyet` tipi 0010'da kuruldu. PostgreSQL yeni enum değerini/tipini
-- oluşturan transaction içinde kullanamaz; bu yüzden tip önceki
-- migration'dadır.
-- ---------------------------------------------------------------------------

ALTER TABLE kisi
  ADD COLUMN dogum_tarihi DATE,
  ADD COLUMN cinsiyet "Cinsiyet" NOT NULL DEFAULT 'BELIRTILMEMIS',
  ADD COLUMN adres TEXT,
  ADD COLUMN notlar TEXT;

-- Doğum tarihi gelecekte olamaz ve makul bir alt sınır taşır: 1900'den
-- eski bir tarih veri girişi hatasıdır (yıl alanına 19 yazılması gibi).
ALTER TABLE kisi ADD CONSTRAINT kisi_dogum_tarihi_makul
  CHECK (dogum_tarihi IS NULL
     OR (dogum_tarihi >= DATE '1900-01-01' AND dogum_tarihi <= CURRENT_DATE));

-- ---------------------------------------------------------------------------
-- 2) MİSAFİR — yeni tablo
--
-- Misafir bir HAK SAHİBİ DEĞİLDİR: borç sorumlusu olmaz, tahakkuka girmez,
-- arsa payı taşımaz. Bu yüzden `kisi` kaydı açılmaz ve bilgiler burada
-- inline tutulur.
--
-- KVKK: misafir verisi doğası gereği KISA ÖMÜRLÜDÜR. Kalıcı bir kimlik
-- kaydı açmak, ziyaretten aylar sonra silinmesi gereken veriyi malik/kiracı
-- kayıtlarıyla aynı ömre bağlardı.
-- ---------------------------------------------------------------------------

CREATE TABLE "misafir" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    -- Hangi bağımsız bölümü ziyaret ediyor.
    "bolum_id" UUID NOT NULL,
    "ad" VARCHAR(60) NOT NULL,
    "soyad" VARCHAR(60) NOT NULL,
    "tc_kimlik_no" VARCHAR(11),
    "telefon" VARCHAR(32),
    "eposta" VARCHAR(180),
    "dogum_tarihi" DATE,
    "cinsiyet" "Cinsiyet" NOT NULL DEFAULT 'BELIRTILMEMIS',
    "adres" TEXT,
    "notlar" TEXT,
    "giris_tarihi" DATE NOT NULL,
    -- Boşsa misafir HÂLEN içeridedir. Güvenlik/tahliye listesi bunu kullanır.
    "cikis_tarihi" DATE,
    "ziyaret_nedeni" VARCHAR(200),
    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,
    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "misafir_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "misafir_tenant_id_bolum_id_giris_tarihi_idx"
  ON "misafir"("tenant_id", "bolum_id", "giris_tarihi");
-- Hâlen içeride olan misafirler — güvenlik ve tahliye listesi. Kısmi index:
-- çıkış yapmış misafirler zamanla çoğalır, listede hiç okunmaz.
CREATE INDEX "misafir_tenant_id_cikis_tarihi_idx"
  ON "misafir"("tenant_id", "cikis_tarihi") WHERE cikis_tarihi IS NULL;

ALTER TABLE "misafir" ADD CONSTRAINT "misafir_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE bagimsiz_bolum NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "misafir" ADD CONSTRAINT "misafir_bolum_id_fkey"
  FOREIGN KEY ("bolum_id") REFERENCES "bagimsiz_bolum"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE bagimsiz_bolum FORCE ROW LEVEL SECURITY;

ALTER TABLE misafir ADD CONSTRAINT misafir_tarih_sirasi
  CHECK (cikis_tarihi IS NULL OR cikis_tarihi >= giris_tarihi);

ALTER TABLE misafir ADD CONSTRAINT misafir_tc_bicim
  CHECK (tc_kimlik_no IS NULL OR tc_kimlik_no ~ '^[0-9]{11}$');

ALTER TABLE misafir ADD CONSTRAINT misafir_dogum_tarihi_makul
  CHECK (dogum_tarihi IS NULL
     OR (dogum_tarihi >= DATE '1900-01-01' AND dogum_tarihi <= CURRENT_DATE));

ALTER TABLE misafir ADD CONSTRAINT misafir_soft_delete_tutarlilik
  CHECK ((silindi_mi = false AND silinme_tarihi IS NULL)
      OR (silindi_mi = true AND silinme_tarihi IS NOT NULL AND silme_gerekcesi IS NOT NULL));

-- ---------------------------------------------------------------------------
-- 3) ARAÇ — tek plaka kütüğü, dört ayrı sahip tipi
--
-- Otopark kapasitesi malik aracıyla bakıcının aracını AYIRT ETMEZ: ikisi de
-- yer kaplar. Bu yüzden ayrı tablolar yerine tek kütük kullanılır ve sahip
-- alanı dörde açılır.
--
-- `kisi_id` artık NULL olabilir; TAM OLARAK BİR sahip alanı dolu olmak
-- zorundadır (aşağıdaki CHECK). Kısıt olmasaydı sahibi olmayan ya da iki
-- sahibi olan araç kaydı oluşur ve otopark sayımı ikiye katlardı.
-- ---------------------------------------------------------------------------

ALTER TABLE arac ALTER COLUMN kisi_id DROP NOT NULL;

ALTER TABLE arac
  ADD COLUMN gorevli_id UUID,
  ADD COLUMN personel_id UUID,
  ADD COLUMN misafir_id UUID;

-- FK eklemeden önce FORCE geçici kaldırılır (bkz. 0004).
--
-- ⚠️  BURADA HEDEF TABLO YETMEZ, **KAYNAK** TABLO DA GEREKİR. Doğrulama
--     taraması şu sorguyu koşar:
--        SELECT fk.gorevli_id FROM ONLY arac fk
--        LEFT JOIN daire_gorevlisi pk ON pk.id = fk.gorevli_id
--        WHERE pk.id IS NULL AND fk.gorevli_id IS NOT NULL
--     yani `arac`ı DA okur. 0004/0008'de kaynak tablo yeni ve RLS'siz
--     olduğu için yalnızca hedef yetmişti; burada `arac` üzerinde FORCE
--     açık olduğundan o da kaldırılmalı.
--
-- `misafir` üzerinde RLS henüz açılmadı (aşağıda açılıyor), ona bakan FK
-- sorun çıkarmaz.
ALTER TABLE arac            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE daire_gorevlisi NO FORCE ROW LEVEL SECURITY;
ALTER TABLE site_personeli  NO FORCE ROW LEVEL SECURITY;

ALTER TABLE arac ADD CONSTRAINT arac_gorevli_id_fkey
  FOREIGN KEY ("gorevli_id") REFERENCES "daire_gorevlisi"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE arac ADD CONSTRAINT arac_personel_id_fkey
  FOREIGN KEY ("personel_id") REFERENCES "site_personeli"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE arac ADD CONSTRAINT arac_misafir_id_fkey
  FOREIGN KEY ("misafir_id") REFERENCES "misafir"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE arac            FORCE ROW LEVEL SECURITY;
ALTER TABLE daire_gorevlisi FORCE ROW LEVEL SECURITY;
ALTER TABLE site_personeli  FORCE ROW LEVEL SECURITY;

CREATE INDEX "arac_tenant_id_gorevli_id_idx"  ON "arac"("tenant_id", "gorevli_id");
CREATE INDEX "arac_tenant_id_personel_id_idx" ON "arac"("tenant_id", "personel_id");
CREATE INDEX "arac_tenant_id_misafir_id_idx"  ON "arac"("tenant_id", "misafir_id");

-- TAM OLARAK BİR sahip. `num_nonnulls` PostgreSQL'in yerleşik sayacıdır;
-- elle yazılan CASE zinciri okunmaz ve yeni sahip tipi eklendiğinde
-- güncellenmesi unutulur.
ALTER TABLE arac ADD CONSTRAINT arac_tek_sahip
  CHECK (num_nonnulls(kisi_id, gorevli_id, personel_id, misafir_id) = 1);

-- ---------------------------------------------------------------------------
-- 4) MİSAFİR — ROW LEVEL SECURITY
--
-- `arac` yabancı anahtarları kurulduktan SONRA açılıyor; FK doğrulama
-- taraması FORCE RLS altında `app_tenant_id()` hatası verirdi.
-- ---------------------------------------------------------------------------

ALTER TABLE misafir ENABLE ROW LEVEL SECURITY;
ALTER TABLE misafir FORCE  ROW LEVEL SECURITY;
CREATE POLICY misafir_tenant_isolation ON misafir
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON misafir TO bnos_app;
