-- ===========================================================================
-- BNOS Apartman Yönetimi — 0019_iletisim_cekirdegi
--
-- WhatsApp Business ve SMS yönetimi TEK ÇEKİRDEKTE toplandı.
--
-- ⚠️  WHATSAPP ve SMS AYRI MODÜL DEĞİLDİR. İkisi de "bir mesajı, bir alıcıya,
--     bir kanaldan gönder"dir. Ortak olanlar:
--       · alıcı çözümü (site · blok · kat · daire · malik · kiracı · sakin ·
--         daire görevlisi · yönetim kurulu · kişiler · gruplar)
--       · şablonlar ve değişken alanlar
--       · toplu gönderim · zamanlanmış gönderim
--       · gönderim geçmişi · durum takibi · yeniden gönderim
--       · izin (İYS) denetimi · audit
--
--     Ayrı tablolar yapılsaydı bu iskelet İKİ KEZ yazılır; alıcı çözümü iki
--     yerde durur ve biri düzeltildiğinde öteki SESSİZCE eski davranmaya devam
--     ederdi. Kanal bir ALANDIR (`IletisimKanali`), tablo değil. E-posta
--     ileride aynı çekirdeğe yeni bir enum değeriyle girer.
--
-- ⚠️  GERÇEK SAĞLAYICI BAĞLANTISI YOKTUR (kullanıcının kararı: "altyapı ve
--     modüller hazır olsun"). Bu yüzden hiçbir mesaj TESLİM_EDİLDİ olarak
--     işaretlenmez; sağlayıcı yokken durum `SAGLAYICI_YOK`ta kalır.
--
--     Bu bilinçlidir: sahte bir "teslim edildi", yöneticinin sakinleri
--     bilgilendirdiğini sanmasına yol açardı. Gönderilmemiş bir aidat
--     hatırlatmasının "gönderildi" görünmesi, icra takibinde dayanak
--     sanılabilecek bir yanlıştır.
--
-- ⚠️  İYS / TİCARİ ELEKTRONİK İLETİ. 6563 sayılı Kanun ticari iletiyi ÖNCEDEN
--     İZNE bağlar; hizmet ilişkisinden doğan BİLGİLENDİRME (aidat borcu,
--     arıza, toplantı çağrısı) izin gerektirmez. Bu ayrım VERİ olarak taşınır
--     (`ileti_turu`) ve TİCARİ ileti izinsiz gönderilemez. Ayrım yapılmasaydı
--     ya bütün bildirimler izne takılır ya da ticari ileti izinsiz giderdi;
--     ikincisi idari para cezasıdır.
-- ===========================================================================

CREATE TYPE "IletisimKanali" AS ENUM ('WHATSAPP', 'SMS', 'EPOSTA');

-- Hizmet ilişkisinden doğan bilgilendirme İYS iznine tabi DEĞİLDİR; ticari
-- ileti tabidir (6563 s. K. md. 6).
CREATE TYPE "IletiTuru" AS ENUM ('BILGILENDIRME', 'TICARI');

CREATE TYPE "IletiIzinDurumu" AS ENUM ('IZIN', 'RET');

CREATE TYPE "HedefTipi" AS ENUM (
  'TUM_SITE', 'BLOK', 'KAT', 'DAIRE',
  'MALIK', 'KIRACI', 'SAKIN', 'DAIRE_GOREVLISI', 'YONETIM_KURULU',
  'KISILER', 'GRUP'
);

CREATE TYPE "GonderimDurumu" AS ENUM (
  'TASLAK', 'ZAMANLANDI', 'GONDERILIYOR', 'TAMAMLANDI', 'IPTAL'
);

/*
 * ⚠️  `SAGLAYICI_YOK` AYRI BİR DURUMDUR, `BASARISIZ` DEĞİL.
 *     Başarısız, sağlayıcının reddettiği mesajdır ve yeniden denenebilir.
 *     Sağlayıcı yokluğu bir yapılandırma eksiğidir; "başarısız" sayılsaydı
 *     durum raporunda operatör hatası gibi görünür ve gerçek hata oranı
 *     yanlış okunurdu.
 */
CREATE TYPE "MesajDurumu" AS ENUM (
  'BEKLIYOR', 'KUYRUKTA', 'GONDERILDI', 'TESLIM_EDILDI', 'OKUNDU',
  'BASARISIZ', 'IPTAL', 'SAGLAYICI_YOK', 'IZIN_YOK'
);

-- ---------------------------------------------------------------------------
-- 1) MESAJ ŞABLONU — değişken alanlı hazır mesajlar
-- ---------------------------------------------------------------------------

CREATE TABLE "mesaj_sablonu" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    "kod" VARCHAR(60) NOT NULL,
    "ad" VARCHAR(160) NOT NULL,
    -- Boşsa şablon HER kanalda kullanılabilir. SMS'e özel kısa metin ile
    -- WhatsApp'a özel uzun metin ayrı şablonlardır.
    "kanal" "IletisimKanali",
    "ileti_turu" "IletiTuru" NOT NULL DEFAULT 'BILGILENDIRME',

    -- Değişkenler `{{ad}}` biçimindedir. Çözülmeyen değişken GÖNDERİMİ
    -- ENGELLER: "Sayın {{ad}}, {{tutar}} TL borcunuz var" mesajının ham
    -- hâliyle gitmesi, yönetime olan güveni tek seferde bitirir.
    "govde" TEXT NOT NULL,
    "aciklama" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mesaj_sablonu_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 2) İLETİŞİM İZNİ (İYS) — kişi · kanal bazında
--
-- ⚠️  RET, İZİN YOKLUĞUNDAN FARKLIDIR. İzin kaydı hiç yoksa ticari ileti
--     gönderilemez; RET varsa BİLGİLENDİRME de dahil hiçbir şey gönderilmez
--     (kişi açıkça istememiştir). İkisi tek bayrağa indirgenseydi "hiç
--     sorulmamış" ile "hayır demiş" ayırt edilemezdi.
-- ---------------------------------------------------------------------------

CREATE TABLE "iletisim_izni" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kisi_id" UUID NOT NULL,
    "kanal" "IletisimKanali" NOT NULL,
    "ileti_turu" "IletiTuru" NOT NULL,
    "durum" "IletiIzinDurumu" NOT NULL,

    -- İzin KANITI: nereden alındığı (sözleşme · form · İYS · sözlü beyan).
    -- Kanıtı olmayan izin, denetimde izin sayılmaz.
    "kaynak" VARCHAR(120) NOT NULL,
    "beyan_tarihi" DATE NOT NULL,
    "gerekce" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "iletisim_izni_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3) GÖNDERİM — bir kampanya/parti (toplu ya da tekil)
-- ---------------------------------------------------------------------------

CREATE TABLE "mesaj_gonderimi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    "kanal" "IletisimKanali" NOT NULL,
    "ileti_turu" "IletiTuru" NOT NULL DEFAULT 'BILGILENDIRME',
    "durum" "GonderimDurumu" NOT NULL DEFAULT 'TASLAK',

    "sablon_id" UUID,
    "baslik" VARCHAR(200),
    -- Şablon çözülmeden ÖNCEKİ gövde. Şablon sonradan değişse bile gönderilen
    -- metin `mesaj.govde`de saklıdır; bu alan "ne yazılmıştı"yı gösterir.
    "govde" TEXT NOT NULL,

    "hedef_tipi" "HedefTipi" NOT NULL,
    -- Hedefin kimliği: blok/kat/daire id'si ya da kişi id listesi (JSON).
    -- Tek alan yerine JSON: hedef tipine göre şekil değişir ve her tip için
    -- ayrı kolon açmak on boş kolon demekti.
    "hedef_referansi" JSONB,

    "zamanlanma_ani" TIMESTAMPTZ(6),
    "baslama_ani" TIMESTAMPTZ(6),
    "bitis_ani" TIMESTAMPTZ(6),

    -- İLİŞKİLİ KAYIT: hangi tahakkuk/makbuz/arıza için gönderildi.
    "ilgili_varlik" VARCHAR(60),
    "ilgili_varlik_id" UUID,

    "olusturan" UUID NOT NULL,
    "iptal_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mesaj_gonderimi_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 4) MESAJ — alıcı başına tek satır
--
-- ⚠️  ALICI BİLGİSİ KOPYALANIR (ad ve numara). Kişi sonradan taşınsa ya da
--     numarası değişse bile "bu mesaj O GÜN şu numaraya gitti" bilgisi
--     değişmemelidir; ilişkiye bakılsaydı geçmiş sessizce yeniden yazılırdı.
-- ---------------------------------------------------------------------------

CREATE TABLE "mesaj" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "gonderim_id" UUID NOT NULL,

    "kisi_id" UUID,
    -- SNAPSHOT — gönderim anındaki hâli.
    "alici_adi" VARCHAR(160) NOT NULL,
    "numara" VARCHAR(24) NOT NULL,

    "kanal" "IletisimKanali" NOT NULL,
    "durum" "MesajDurumu" NOT NULL DEFAULT 'BEKLIYOR',
    -- Şablon ÇÖZÜLMÜŞ hâli — gerçekten gönderilen metin.
    "govde" TEXT NOT NULL,

    -- SMS kontörü: parça sayısı. Türkçe karakterler (ğ ı ş İ) GSM-7 alfabesinde
    -- YOKTUR; mesaj UCS-2'ye düşer ve parça uzunluğu 160'tan 70'e iner. Yanlış
    -- hesaplansa fatura sessizce iki katına çıkardı.
    "parca_sayisi" INTEGER NOT NULL DEFAULT 1,

    "saglayici" VARCHAR(60),
    "saglayici_mesaj_id" VARCHAR(120),
    "hata_kodu" VARCHAR(60),
    "hata_mesaji" TEXT,
    "deneme_sayisi" INTEGER NOT NULL DEFAULT 0,

    "gonderim_ani" TIMESTAMPTZ(6),
    "teslim_ani" TIMESTAMPTZ(6),
    "okunma_ani" TIMESTAMPTZ(6),

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mesaj_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 5) OTOMATİK BİLDİRİM KURALI — olay → şablon eşlemesi
--
-- ⚠️  KURAL VERİ OLARAK TUTULUR, KODA GÖMÜLMEZ (§33 kural 3). "Aidat
--     tahakkukunda SMS at" kodda olsaydı, SMS istemeyen bir tenant için
--     kapatılamazdı.
--
-- ⚠️  BU TABLO DOLU OLSA DA HİÇBİR ŞEY OTOMATİK GÖNDERİLMEZ: tetikleyici
--     bağlantısı (outbox tüketicisi) BU MIGRATION'DA YOKTUR. Kural kaydı
--     "gönderilecek" anlamına gelmez; `aktif` alanı ileride tüketici
--     yazıldığında anlam kazanır.
-- ---------------------------------------------------------------------------

CREATE TABLE "otomatik_bildirim_kurali" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    -- Olay kodu — outbox olay tipiyle eşleşir (ör. 'tahakkuk.olusturuldu').
    "olay_kodu" VARCHAR(80) NOT NULL,
    "kanal" "IletisimKanali" NOT NULL,
    "sablon_id" UUID NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT false,
    "aciklama" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "otomatik_bildirim_kurali_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 6) KİŞİ — WhatsApp numarası
--
-- WhatsApp numarası telefondan FARKLI olabilir (iş telefonu SMS alır ama
-- WhatsApp'ı kişisel numaradadır). Tek alan kullanılsaydı biri mutlaka yanlış
-- olurdu.
-- ---------------------------------------------------------------------------

ALTER TABLE "kisi" ADD COLUMN "whatsapp_no" VARCHAR(24);

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR
--
-- FK doğrulama taraması hem KAYNAK hem HEDEF tabloyu okur (0011 notu).
-- ---------------------------------------------------------------------------

ALTER TABLE kisi NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "mesaj_sablonu" ADD CONSTRAINT "mesaj_sablonu_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "iletisim_izni" ADD CONSTRAINT "iletisim_izni_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iletisim_izni" ADD CONSTRAINT "iletisim_izni_kisi_id_fkey"
  FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mesaj_gonderimi" ADD CONSTRAINT "mesaj_gonderimi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mesaj_gonderimi" ADD CONSTRAINT "mesaj_gonderimi_sablon_id_fkey"
  FOREIGN KEY ("sablon_id") REFERENCES "mesaj_sablonu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mesaj" ADD CONSTRAINT "mesaj_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mesaj" ADD CONSTRAINT "mesaj_gonderim_id_fkey"
  FOREIGN KEY ("gonderim_id") REFERENCES "mesaj_gonderimi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mesaj" ADD CONSTRAINT "mesaj_kisi_id_fkey"
  FOREIGN KEY ("kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "otomatik_bildirim_kurali" ADD CONSTRAINT "otomatik_bildirim_kurali_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "otomatik_bildirim_kurali" ADD CONSTRAINT "otomatik_bildirim_kurali_sablon_id_fkey"
  FOREIGN KEY ("sablon_id") REFERENCES "mesaj_sablonu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE kisi FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- INDEX'LER
-- ---------------------------------------------------------------------------

CREATE INDEX "mesaj_sablonu_tenant_kanal_idx" ON "mesaj_sablonu"("tenant_id", "kanal");
CREATE INDEX "iletisim_izni_tenant_kisi_idx" ON "iletisim_izni"("tenant_id", "kisi_id");
CREATE INDEX "mesaj_gonderimi_tenant_durum_idx" ON "mesaj_gonderimi"("tenant_id", "durum");
CREATE INDEX "mesaj_gonderimi_tenant_kanal_tarih_idx"
  ON "mesaj_gonderimi"("tenant_id", "kanal", "olusturulma_tarihi");
-- Zamanlanmış gönderimler — planlayıcının ana sorgusu.
CREATE INDEX "mesaj_gonderimi_zamanlanmis_idx"
  ON "mesaj_gonderimi"("tenant_id", "zamanlanma_ani") WHERE durum = 'ZAMANLANDI';

CREATE INDEX "mesaj_tenant_gonderim_idx" ON "mesaj"("tenant_id", "gonderim_id");
CREATE INDEX "mesaj_tenant_kisi_idx" ON "mesaj"("tenant_id", "kisi_id");
CREATE INDEX "mesaj_tenant_durum_idx" ON "mesaj"("tenant_id", "durum");
-- "Son gönderilen mesajlar" ekranının sorgusu.
CREATE INDEX "mesaj_tenant_tarih_idx" ON "mesaj"("tenant_id", "olusturulma_tarihi");

CREATE INDEX "otomatik_bildirim_kurali_tenant_olay_idx"
  ON "otomatik_bildirim_kurali"("tenant_id", "olay_kodu");

-- ---------------------------------------------------------------------------
-- TEKİLLİK
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX mesaj_sablonu_kod_uq
  ON mesaj_sablonu (tenant_id, kod) WHERE silinme_tarihi IS NULL;

-- Bir kişinin bir kanal + ileti türü için TEK geçerli izin beyanı olur.
-- Olmasaydı "izin" ve "ret" aynı anda durur ve hangisinin geçerli olduğu
-- belirsiz kalırdı.
CREATE UNIQUE INDEX iletisim_izni_uq
  ON iletisim_izni (tenant_id, kisi_id, kanal, ileti_turu);

-- Aynı olay + kanal için iki kural olamaz: hangisinin çalışacağı belirsiz
-- olurdu ve ikisi birden çalışırsa kişi aynı bildirimi iki kez alırdı.
CREATE UNIQUE INDEX otomatik_bildirim_kurali_uq
  ON otomatik_bildirim_kurali (tenant_id, olay_kodu, kanal);

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

ALTER TABLE mesaj ADD CONSTRAINT mesaj_parca_pozitif
  CHECK (parca_sayisi >= 1);
ALTER TABLE mesaj ADD CONSTRAINT mesaj_deneme_makul
  CHECK (deneme_sayisi >= 0 AND deneme_sayisi <= 10);

-- BAŞARISIZ mesaj hata bilgisi TAŞIMAK ZORUNDA: hatasız bir "başarısız",
-- durum raporunda neden başarısız olduğu bilinmeyen bir satır üretir ve
-- operatör/API hata ayrımı yapılamaz.
ALTER TABLE mesaj ADD CONSTRAINT mesaj_basarisiz_hata
  CHECK (durum <> 'BASARISIZ' OR hata_kodu IS NOT NULL OR hata_mesaji IS NOT NULL);

-- TESLİM ve OKUNMA anları GÖNDERİM anından önce olamaz.
ALTER TABLE mesaj ADD CONSTRAINT mesaj_teslim_sirasi
  CHECK (teslim_ani IS NULL OR gonderim_ani IS NULL OR teslim_ani >= gonderim_ani);
ALTER TABLE mesaj ADD CONSTRAINT mesaj_okunma_sirasi
  CHECK (okunma_ani IS NULL OR teslim_ani IS NULL OR okunma_ani >= teslim_ani);

-- ZAMANLANMIŞ gönderim zaman İSTER; zamansız "zamanlandı" hiç çalışmaz ve
-- kullanıcı gönderildiğini sanır.
ALTER TABLE mesaj_gonderimi ADD CONSTRAINT mesaj_gonderimi_zaman
  CHECK (durum <> 'ZAMANLANDI' OR zamanlanma_ani IS NOT NULL);

ALTER TABLE mesaj_gonderimi ADD CONSTRAINT mesaj_gonderimi_iptal_gerekce
  CHECK (durum <> 'IPTAL' OR iptal_gerekcesi IS NOT NULL);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE mesaj_sablonu            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaj_sablonu            FORCE  ROW LEVEL SECURITY;
CREATE POLICY mesaj_sablonu_tenant_isolation ON mesaj_sablonu
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE iletisim_izni            ENABLE ROW LEVEL SECURITY;
ALTER TABLE iletisim_izni            FORCE  ROW LEVEL SECURITY;
CREATE POLICY iletisim_izni_tenant_isolation ON iletisim_izni
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE mesaj_gonderimi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaj_gonderimi          FORCE  ROW LEVEL SECURITY;
CREATE POLICY mesaj_gonderimi_tenant_isolation ON mesaj_gonderimi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE mesaj                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesaj                    FORCE  ROW LEVEL SECURITY;
CREATE POLICY mesaj_tenant_isolation ON mesaj
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE otomatik_bildirim_kurali ENABLE ROW LEVEL SECURITY;
ALTER TABLE otomatik_bildirim_kurali FORCE  ROW LEVEL SECURITY;
CREATE POLICY otomatik_bildirim_kurali_tenant_isolation ON otomatik_bildirim_kurali
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON mesaj_sablonu            TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON iletisim_izni            TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON mesaj_gonderimi          TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON mesaj                    TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON otomatik_bildirim_kurali TO bnos_app;

-- ---------------------------------------------------------------------------
-- EVRAK — mesaja belge eklenebilsin (PDF · Excel · Word · resim · makbuz)
--
-- Belge modülü (0007) zaten depolama · versiyonlama · gizlilik taşıyor;
-- burada yalnızca İLİŞKİ TİPİ ekleniyor. WhatsApp belge paylaşımı yeni bir
-- dosya altyapısı GEREKTİRMEZ.
-- ---------------------------------------------------------------------------

ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'MESAJ_GONDERIMI';
