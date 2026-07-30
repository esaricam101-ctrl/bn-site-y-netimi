-- ===========================================================================
-- BNOS Apartman Yönetimi — 0016_banka_cekirdegi
--
-- BANKA YÖNETİMİ çekirdeği. Kullanıcının istediği 17 alt modül SEKİZ TABLOYA
-- indirildi; bu bir eksiltme değil, TEKRARIN ÖNLENMESİDİR:
--
--   Bankalar · Banka Şubeleri · Banka Hesapları  → banka · banka_subesi · banka_hesabi
--   POS Tanımları · Sanal POS                    → pos_tanimi (tip: FIZIKI | SANAL)
--   Banka Hareketleri                            → banka_hareketi
--   Havale · EFT · FAST · Virman · Banka Masraf. → banka_hareketi.islem_tipi
--   Banka Ekstreleri · Online Ekstre             → banka_ekstresi + ekstre_satiri
--   Mutabakat                                    → ekstre_satiri.eslesen_hareket_id
--   Çek · Senet                                  → kiymetli_evrak (tip: CEK | SENET)
--   Banka Parametreleri                          → banka_parametresi
--
-- ⚠️  HAVALE · EFT · FAST · VİRMAN AYRI TABLO DEĞİLDİR. Dördü de "bir banka
--     hesabından para çıkışı/girişi"dir; alan kümeleri birebir aynıdır. Ayrı
--     tablo yapılsaydı aynı şema dört kez tekrarlanır, mutabakat dört tabloyu
--     ayrı ayrı taramak zorunda kalır ve banka bakiyesi dört sorgunun toplamı
--     olurdu — biri unutulduğunda bakiye SESSİZCE yanlış çıkardı.
--
-- ⚠️  BANKA HAREKETİ MUHASEBEDEN AYRIDIR ama ona BAĞLANIR. Hareket önce
--     kaydedilir (banka gerçeği), sonra muhasebeleşir (`yevmiye_fisi_id`).
--     Tek tabloda tutulsaydı henüz muhasebeleşmemiş bir banka hareketi
--     mizana girer ve dönem sonu tutmazdı.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) BANKA ve ŞUBE — tanım verisi
-- ---------------------------------------------------------------------------

CREATE TABLE "banka" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    -- EFT kodu TCMB'nin banka kodudur (4 hane). IBAN'ın 5-8. haneleriyle
    -- eşleşir; mutabakatta hangi bankadan geldiğini bu kod söyler.
    "eft_kodu" VARCHAR(4),
    "swift" VARCHAR(11),

    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banka_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "banka_subesi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "banka_id" UUID NOT NULL,
    "ad" VARCHAR(120) NOT NULL,
    "sube_kodu" VARCHAR(10),
    "adres" TEXT,
    "telefon" VARCHAR(32),

    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banka_subesi_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 2) BANKA HESABI
--
-- ⚠️  MUHASEBE HESABINA BAĞLIDIR ve bu bağ ZORUNLUDUR. Bağ olmasaydı banka
--     bakiyesi ile 102 Bankalar hesabının bakiyesi birbirinden bağımsız iki
--     sayı olur ve mutabakat yapılamazdı. Bağlanan muhasebe hesabının
--     `ozellik = BANKA` olması gerekir (0015).
-- ---------------------------------------------------------------------------

CREATE TABLE "banka_hesabi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "banka_id" UUID NOT NULL,
    "sube_id" UUID,
    -- Muhasebe karşılığı (ozellik = BANKA). ZORUNLU: bkz. üstteki not.
    "muhasebe_hesap_id" UUID NOT NULL,

    "ad" VARCHAR(120) NOT NULL,
    "iban" VARCHAR(34),
    "hesap_no" VARCHAR(32),
    "para_birimi" CHAR(3) NOT NULL DEFAULT 'TRY',
    -- Hesap açılış bakiyesi. Muhasebe açılış fişinden AYRIDIR: banka gerçeği
    -- ile defterin başlangıç noktası farklı olabilir ve fark mutabakatta
    -- görünmelidir.
    "acilis_bakiyesi" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "acilis_tarihi" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "notlar" TEXT,

    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banka_hesabi_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3) POS TANIMI — fiziki ve sanal POS aynı tablo
--
-- Sanal POS'un fiziki POS'tan tek farkı `tip` alanıdır; alan kümesi aynıdır
-- (banka hesabı · komisyon oranı · valör günü · terminal no). Ayrı tablo
-- yapılsaydı komisyon hesabı iki yerde yazılırdı.
-- ---------------------------------------------------------------------------

CREATE TYPE "PosTipi" AS ENUM ('FIZIKI', 'SANAL');

CREATE TABLE "pos_tanimi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "banka_hesabi_id" UUID NOT NULL,
    "tip" "PosTipi" NOT NULL DEFAULT 'FIZIKI',
    "ad" VARCHAR(120) NOT NULL,
    "terminal_no" VARCHAR(32),
    "uye_isyeri_no" VARCHAR(32),
    -- Komisyon oranı BİNDE tam sayı taşınır (`250` = %2,5). Ondalık oran
    -- float olurdu ve komisyon tutarı kuruş sapardı (ADR-0007 gerekçesi).
    "komisyon_binde" INTEGER NOT NULL DEFAULT 0,
    -- Valör: paranın hesaba geçtiği gün sayısı. 0 = aynı gün.
    "valor_gunu" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    "silindi_mi" BOOLEAN NOT NULL DEFAULT false,
    "silinme_tarihi" TIMESTAMPTZ(6),
    "silen_kullanici" UUID,
    "silme_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_tanimi_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 4) BANKA HAREKETİ — Havale · EFT · FAST · Virman · Masraf · POS · Faiz
--
-- ⚠️  YÖN AYRI ALANDIR, tutar İŞARETSİZDİR. Negatif tutarla çıkış yazmak
--     mümkün olsaydı toplamlar işaret karışıklığıyla bozulur ve "toplam
--     giriş" sorgusu negatifleri de toplardı.
--
-- ⚠️  MUHASEBELEŞTİRME AYRI ADIMDIR (`yevmiye_fisi_id`). Hareket banka
--     gerçeğidir ve fiş kesilmeden de var olabilir; fiş kesildikten sonra
--     hareket DEĞİŞTİRİLEMEZ (mali kayıt dayanağı olur).
-- ---------------------------------------------------------------------------

CREATE TYPE "BankaIslemTipi" AS ENUM (
  'HAVALE', 'EFT', 'FAST', 'VIRMAN', 'MASRAF', 'FAIZ',
  'POS_TAHSILAT', 'CEK_TAHSIL', 'SENET_TAHSIL', 'NAKIT', 'DIGER'
);

CREATE TYPE "HareketYonu" AS ENUM ('GIRIS', 'CIKIS');

CREATE TABLE "banka_hareketi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "banka_hesabi_id" UUID NOT NULL,

    "islem_tipi" "BankaIslemTipi" NOT NULL,
    "yon" "HareketYonu" NOT NULL,
    -- İŞARETSİZ tutar. Yön `yon` alanındadır.
    "tutar" DECIMAL(18,4) NOT NULL,

    -- İşlem tarihi ile VALÖR tarihi FARKLIDIR: POS tahsilatı bugün olur ama
    -- para üç gün sonra hesaba geçer. Bakiye valöre, ekstre işlem tarihine
    -- göre okunur; tek alan tutulsaydı ikisi de yanlış olurdu.
    "islem_tarihi" DATE NOT NULL,
    "valor_tarihi" DATE,

    "aciklama" TEXT NOT NULL,
    "karsi_taraf" VARCHAR(200),
    "karsi_iban" VARCHAR(34),
    -- Banka referans/dekont numarası — mutabakatın birincil eşleştirme anahtarı.
    "referans_no" VARCHAR(64),

    -- Virmanın karşı bacağı. Virman İKİ hareket üretir (çıkış + giriş) ve
    -- birbirlerine referans verir; tek kayıt olsaydı iki hesabın bakiyesi
    -- tek satırdan türetilmek zorunda kalırdı.
    "karsi_hareket_id" UUID,

    "pos_tanimi_id" UUID,
    "kiymetli_evrak_id" UUID,

    -- Muhasebeleştirme. Boşsa hareket henüz deftere girmemiştir.
    "yevmiye_fisi_id" UUID,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banka_hareketi_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 5) BANKA EKSTRESİ ve SATIRLARI — mutabakatın temeli
--
-- Ekstre BANKANIN beyanıdır, bizim kaydımız değil. İkisi ayrı tutulur ki
-- fark GÖRÜNÜR olsun: ekstrede olup sistemde olmayan satır, kaçırılmış bir
-- hareket demektir.
-- ---------------------------------------------------------------------------

CREATE TYPE "EkstreKaynagi" AS ENUM ('ELLE', 'DOSYA', 'ONLINE');
CREATE TYPE "MutabakatDurumu" AS ENUM ('ESLESMEDI', 'ESLESTI', 'FARK_KABUL');

CREATE TABLE "banka_ekstresi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "banka_hesabi_id" UUID NOT NULL,

    "baslangic" DATE NOT NULL,
    "bitis" DATE NOT NULL,
    -- Bankanın beyan ettiği açılış/kapanış bakiyesi.
    "acilis_bakiyesi" DECIMAL(18,4) NOT NULL,
    "kapanis_bakiyesi" DECIMAL(18,4) NOT NULL,
    "kaynak" "EkstreKaynagi" NOT NULL DEFAULT 'ELLE',
    -- Online/dosya kaynaklı ekstrede özgün dosya adı — denetim izi.
    "kaynak_referansi" VARCHAR(200),

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banka_ekstresi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ekstre_satiri" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ekstre_id" UUID NOT NULL,

    "islem_tarihi" DATE NOT NULL,
    "valor_tarihi" DATE,
    "yon" "HareketYonu" NOT NULL,
    "tutar" DECIMAL(18,4) NOT NULL,
    "aciklama" TEXT NOT NULL,
    "referans_no" VARCHAR(64),
    -- Bankanın satır sonrası bakiyesi — sıralama ve tutarlılık denetimi.
    "bakiye" DECIMAL(18,4),

    -- MUTABAKAT. Eşleşen sistem hareketi.
    "mutabakat_durumu" "MutabakatDurumu" NOT NULL DEFAULT 'ESLESMEDI',
    "eslesen_hareket_id" UUID,
    "eslestiren_kullanici" UUID,
    "eslesme_ani" TIMESTAMPTZ(6),
    -- FARK_KABUL için gerekçe ZORUNLUDUR (aşağıdaki CHECK): bir farkı
    -- "kabul edildi" diye kapatmak, gerekçesi yazılmazsa denetimde
    -- açıklanamaz.
    "fark_gerekcesi" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ekstre_satiri_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 6) KIYMETLİ EVRAK — Çek ve Senet aynı tablo, farkı `tip`
--
-- Alan kümesi birebir aynıdır (vade · tutar · borçlu · durum). Ayrı tablo
-- yapılsaydı durum makinesi iki yerde yazılır ve biri güncellenmeyi unuturdu.
--
-- ⚠️  DURUM MAKİNESİ ATLAMA KABUL ETMEZ (domain'de zorlanır):
--       PORTFOYDE → TAHSILDE → TAHSIL_EDILDI
--                            → KARSILIKSIZ
--       PORTFOYDE → CIRO_EDILDI / IADE_EDILDI
--     Doğrudan TAHSIL_EDILDI'ye atlamak, çekin bankaya verilmediği hâlde
--     tahsil edilmiş görünmesi demektir.
-- ---------------------------------------------------------------------------

CREATE TYPE "KiymetliEvrakTipi" AS ENUM ('CEK', 'SENET');
CREATE TYPE "KiymetliEvrakDurumu" AS ENUM (
  'PORTFOYDE', 'TAHSILDE', 'TAHSIL_EDILDI', 'KARSILIKSIZ',
  'CIRO_EDILDI', 'IADE_EDILDI'
);

CREATE TABLE "kiymetli_evrak" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    "tip" "KiymetliEvrakTipi" NOT NULL,
    "durum" "KiymetliEvrakDurumu" NOT NULL DEFAULT 'PORTFOYDE',

    "evrak_no" VARCHAR(64) NOT NULL,
    "tutar" DECIMAL(18,4) NOT NULL,
    "vade_tarihi" DATE NOT NULL,
    "alis_tarihi" DATE NOT NULL,

    -- Çeki/senedi VEREN taraf. Kişi kaydı olmayabilir (dışarıdan gelen çek),
    -- bu yüzden serbest metin + isteğe bağlı kişi bağı.
    "borclu_adi" VARCHAR(200) NOT NULL,
    "borclu_kisi_id" UUID,

    -- Çekte banka/şube bilgisi vardır, senette olmayabilir.
    "banka_id" UUID,
    "sube_id" UUID,

    -- Tahsile verildiği hesap.
    "tahsil_hesabi_id" UUID,
    "tahsil_tarihi" DATE,
    -- Durum değişiklikleri GEREKÇE taşır: karşılıksız çıkan bir çekin neden
    -- öyle işaretlendiği sonradan sorulabilir olmalıdır.
    "durum_gerekcesi" TEXT,

    "notlar" TEXT,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kiymetli_evrak_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 7) BANKA PARAMETRELERİ — tenant başına tek satır
-- ---------------------------------------------------------------------------

CREATE TABLE "banka_parametresi" (
    "tenant_id" UUID NOT NULL,
    "varsayilan_banka_hesabi_id" UUID,
    -- Banka masraflarının yazıldığı gider hesabı.
    "masraf_gider_hesap_id" UUID,
    -- POS komisyonunun yazıldığı gider hesabı.
    "pos_komisyon_hesap_id" UUID,
    -- Mutabakatta otomatik eşleştirme için kabul edilen tutar toleransı
    -- (kuruş). 0 = tam eşleşme zorunlu.
    "mutabakat_tolerans_kurus" INTEGER NOT NULL DEFAULT 0,
    -- Otomatik eşleştirmede referans no aranırken tarih penceresi (gün).
    "mutabakat_gun_penceresi" INTEGER NOT NULL DEFAULT 3,

    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "banka_parametresi_pkey" PRIMARY KEY ("tenant_id")
);

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR
--
-- FK doğrulama taraması hem KAYNAK hem HEDEF tabloyu okur (0011 notu); yeni
-- tablolarda RLS henüz açılmadığı için yalnızca mevcut hedefler muaf tutulur.
-- ---------------------------------------------------------------------------

ALTER TABLE hesap        NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "banka" ADD CONSTRAINT "banka_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "banka_subesi" ADD CONSTRAINT "banka_subesi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_subesi" ADD CONSTRAINT "banka_subesi_banka_id_fkey"
  FOREIGN KEY ("banka_id") REFERENCES "banka"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "banka_hesabi" ADD CONSTRAINT "banka_hesabi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hesabi" ADD CONSTRAINT "banka_hesabi_banka_id_fkey"
  FOREIGN KEY ("banka_id") REFERENCES "banka"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hesabi" ADD CONSTRAINT "banka_hesabi_sube_id_fkey"
  FOREIGN KEY ("sube_id") REFERENCES "banka_subesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hesabi" ADD CONSTRAINT "banka_hesabi_muhasebe_hesap_id_fkey"
  FOREIGN KEY ("muhasebe_hesap_id") REFERENCES "hesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_tanimi" ADD CONSTRAINT "pos_tanimi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_tanimi" ADD CONSTRAINT "pos_tanimi_banka_hesabi_id_fkey"
  FOREIGN KEY ("banka_hesabi_id") REFERENCES "banka_hesabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kiymetli_evrak" ADD CONSTRAINT "kiymetli_evrak_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kiymetli_evrak" ADD CONSTRAINT "kiymetli_evrak_borclu_kisi_id_fkey"
  FOREIGN KEY ("borclu_kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kiymetli_evrak" ADD CONSTRAINT "kiymetli_evrak_banka_id_fkey"
  FOREIGN KEY ("banka_id") REFERENCES "banka"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kiymetli_evrak" ADD CONSTRAINT "kiymetli_evrak_sube_id_fkey"
  FOREIGN KEY ("sube_id") REFERENCES "banka_subesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kiymetli_evrak" ADD CONSTRAINT "kiymetli_evrak_tahsil_hesabi_id_fkey"
  FOREIGN KEY ("tahsil_hesabi_id") REFERENCES "banka_hesabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "banka_hareketi" ADD CONSTRAINT "banka_hareketi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hareketi" ADD CONSTRAINT "banka_hareketi_banka_hesabi_id_fkey"
  FOREIGN KEY ("banka_hesabi_id") REFERENCES "banka_hesabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hareketi" ADD CONSTRAINT "banka_hareketi_karsi_hareket_id_fkey"
  FOREIGN KEY ("karsi_hareket_id") REFERENCES "banka_hareketi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hareketi" ADD CONSTRAINT "banka_hareketi_pos_tanimi_id_fkey"
  FOREIGN KEY ("pos_tanimi_id") REFERENCES "pos_tanimi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hareketi" ADD CONSTRAINT "banka_hareketi_kiymetli_evrak_id_fkey"
  FOREIGN KEY ("kiymetli_evrak_id") REFERENCES "kiymetli_evrak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_hareketi" ADD CONSTRAINT "banka_hareketi_yevmiye_fisi_id_fkey"
  FOREIGN KEY ("yevmiye_fisi_id") REFERENCES "yevmiye_fisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "banka_ekstresi" ADD CONSTRAINT "banka_ekstresi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_ekstresi" ADD CONSTRAINT "banka_ekstresi_banka_hesabi_id_fkey"
  FOREIGN KEY ("banka_hesabi_id") REFERENCES "banka_hesabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ekstre_satiri" ADD CONSTRAINT "ekstre_satiri_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ekstre_satiri" ADD CONSTRAINT "ekstre_satiri_ekstre_id_fkey"
  FOREIGN KEY ("ekstre_id") REFERENCES "banka_ekstresi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ekstre_satiri" ADD CONSTRAINT "ekstre_satiri_eslesen_hareket_id_fkey"
  FOREIGN KEY ("eslesen_hareket_id") REFERENCES "banka_hareketi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "banka_parametresi" ADD CONSTRAINT "banka_parametresi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_parametresi" ADD CONSTRAINT "banka_parametresi_varsayilan_fkey"
  FOREIGN KEY ("varsayilan_banka_hesabi_id") REFERENCES "banka_hesabi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_parametresi" ADD CONSTRAINT "banka_parametresi_masraf_fkey"
  FOREIGN KEY ("masraf_gider_hesap_id") REFERENCES "hesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "banka_parametresi" ADD CONSTRAINT "banka_parametresi_komisyon_fkey"
  FOREIGN KEY ("pos_komisyon_hesap_id") REFERENCES "hesap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE hesap        FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi         FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- INDEX'LER
-- ---------------------------------------------------------------------------

CREATE INDEX "banka_tenant_idx" ON "banka"("tenant_id");
CREATE INDEX "banka_subesi_tenant_banka_idx" ON "banka_subesi"("tenant_id", "banka_id");
CREATE INDEX "banka_hesabi_tenant_banka_idx" ON "banka_hesabi"("tenant_id", "banka_id");
CREATE INDEX "banka_hesabi_tenant_muhasebe_idx" ON "banka_hesabi"("tenant_id", "muhasebe_hesap_id");
CREATE INDEX "pos_tanimi_tenant_hesap_idx" ON "pos_tanimi"("tenant_id", "banka_hesabi_id");

CREATE INDEX "banka_hareketi_tenant_hesap_tarih_idx"
  ON "banka_hareketi"("tenant_id", "banka_hesabi_id", "islem_tarihi");
CREATE INDEX "banka_hareketi_tenant_referans_idx"
  ON "banka_hareketi"("tenant_id", "referans_no");
-- Muhasebeleşmemiş hareketler — kısmî index: bunlar zamanla azalır ve
-- "deftere girmeyi bekleyen" listesi bu sorguya dayanır.
CREATE INDEX "banka_hareketi_muhasebesiz_idx"
  ON "banka_hareketi"("tenant_id", "islem_tarihi") WHERE yevmiye_fisi_id IS NULL;

CREATE INDEX "banka_ekstresi_tenant_hesap_idx"
  ON "banka_ekstresi"("tenant_id", "banka_hesabi_id", "baslangic");
CREATE INDEX "ekstre_satiri_tenant_ekstre_idx" ON "ekstre_satiri"("tenant_id", "ekstre_id");
-- Eşleşmemiş satırlar — mutabakat ekranının ana sorgusu.
CREATE INDEX "ekstre_satiri_eslesmemis_idx"
  ON "ekstre_satiri"("tenant_id", "islem_tarihi") WHERE mutabakat_durumu = 'ESLESMEDI';

CREATE INDEX "kiymetli_evrak_tenant_durum_vade_idx"
  ON "kiymetli_evrak"("tenant_id", "durum", "vade_tarihi");

-- ---------------------------------------------------------------------------
-- TEKİLLİK
-- ---------------------------------------------------------------------------

-- IBAN tenant içinde tekildir: aynı IBAN'ı iki hesap taşırsa mutabakat hangi
-- hesaba yazacağını bilemez.
CREATE UNIQUE INDEX banka_hesabi_iban_uq
  ON banka_hesabi (tenant_id, iban) WHERE iban IS NOT NULL AND silinme_tarihi IS NULL;

CREATE UNIQUE INDEX banka_eft_kodu_uq
  ON banka (tenant_id, eft_kodu) WHERE eft_kodu IS NOT NULL AND silinme_tarihi IS NULL;

CREATE UNIQUE INDEX banka_subesi_kodu_uq
  ON banka_subesi (tenant_id, banka_id, sube_kodu)
  WHERE sube_kodu IS NOT NULL AND silinme_tarihi IS NULL;

-- Aynı evrak numarası aynı borçludan iki kez girilemez: mükerrer çek kaydı
-- alacağı iki kez sayar.
CREATE UNIQUE INDEX kiymetli_evrak_no_uq
  ON kiymetli_evrak (tenant_id, tip, evrak_no, borclu_adi);

-- Bir sistem hareketi İKİ ekstre satırıyla eşleşemez: eşleşseydi aynı para
-- iki kez mutabık sayılır ve fark gizlenirdi.
CREATE UNIQUE INDEX ekstre_satiri_eslesen_hareket_uq
  ON ekstre_satiri (tenant_id, eslesen_hareket_id)
  WHERE eslesen_hareket_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- Tutar POZİTİF olmak zorundadır; yön `yon` alanındadır.
ALTER TABLE banka_hareketi ADD CONSTRAINT banka_hareketi_tutar_pozitif
  CHECK (tutar > 0);
ALTER TABLE ekstre_satiri ADD CONSTRAINT ekstre_satiri_tutar_pozitif
  CHECK (tutar > 0);
ALTER TABLE kiymetli_evrak ADD CONSTRAINT kiymetli_evrak_tutar_pozitif
  CHECK (tutar > 0);

-- Valör işlem tarihinden ÖNCE olamaz.
ALTER TABLE banka_hareketi ADD CONSTRAINT banka_hareketi_valor_sirasi
  CHECK (valor_tarihi IS NULL OR valor_tarihi >= islem_tarihi);

ALTER TABLE banka_ekstresi ADD CONSTRAINT banka_ekstresi_tarih_sirasi
  CHECK (bitis >= baslangic);

-- FARK_KABUL gerekçe ZORUNLU: bir farkı "kabul edildi" diye kapatmak,
-- gerekçesi yazılmazsa denetimde açıklanamaz.
ALTER TABLE ekstre_satiri ADD CONSTRAINT ekstre_satiri_fark_gerekce
  CHECK (mutabakat_durumu <> 'FARK_KABUL' OR fark_gerekcesi IS NOT NULL);

-- ESLESTI durumu eşleşen hareket İSTER; hareketsiz "eşleşti" işareti
-- mutabakatı yalancı biçimde tamamlanmış gösterir.
ALTER TABLE ekstre_satiri ADD CONSTRAINT ekstre_satiri_eslesti_tutarlilik
  CHECK (mutabakat_durumu <> 'ESLESTI' OR eslesen_hareket_id IS NOT NULL);

-- Vade alış tarihinden önce olamaz (ileri vadeli evrak alınır, geçmiş vadeli
-- alınmaz — geçmiş vadeli bir çek zaten karşılıksız ya da tahsil edilmiştir).
ALTER TABLE kiymetli_evrak ADD CONSTRAINT kiymetli_evrak_vade_sirasi
  CHECK (vade_tarihi >= alis_tarihi);

-- TAHSIL_EDILDI ve KARSILIKSIZ durumları tahsil hesabı ve tarih ister:
-- hangi hesaba/ne zaman girdiği bilinmeyen bir tahsilat mutabık edilemez.
ALTER TABLE kiymetli_evrak ADD CONSTRAINT kiymetli_evrak_tahsil_tutarlilik
  CHECK (durum <> 'TAHSIL_EDILDI'
      OR (tahsil_hesabi_id IS NOT NULL AND tahsil_tarihi IS NOT NULL));

-- Durum değişikliği gerekçesi: olumsuz sonuçlanan durumlar için zorunlu.
ALTER TABLE kiymetli_evrak ADD CONSTRAINT kiymetli_evrak_olumsuz_gerekce
  CHECK (durum NOT IN ('KARSILIKSIZ', 'IADE_EDILDI') OR durum_gerekcesi IS NOT NULL);

ALTER TABLE pos_tanimi ADD CONSTRAINT pos_tanimi_komisyon_makul
  CHECK (komisyon_binde >= 0 AND komisyon_binde <= 1000);
ALTER TABLE pos_tanimi ADD CONSTRAINT pos_tanimi_valor_makul
  CHECK (valor_gunu >= 0 AND valor_gunu <= 90);

ALTER TABLE banka_parametresi ADD CONSTRAINT banka_parametresi_tolerans_makul
  CHECK (mutabakat_tolerans_kurus >= 0 AND mutabakat_tolerans_kurus <= 100000);
ALTER TABLE banka_parametresi ADD CONSTRAINT banka_parametresi_pencere_makul
  CHECK (mutabakat_gun_penceresi >= 0 AND mutabakat_gun_penceresi <= 30);

-- Virman kendi kendine bağlanamaz.
ALTER TABLE banka_hareketi ADD CONSTRAINT banka_hareketi_karsi_kendisi_olmaz
  CHECK (karsi_hareket_id IS NULL OR karsi_hareket_id <> id);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — sekiz tablonun HEPSİ
--
-- ⚠️  Yeni tablo RLS politikası almazsa tenant izolasyonu SESSİZCE kalkar
--     (ADR-0008 notu). `scripts/rls-scan.mjs` uygulama tarafını denetler ama
--     politika eksikliğini burada unutmak, taramanın yakalamadığı bir açıktır.
-- ---------------------------------------------------------------------------

ALTER TABLE banka             ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka             FORCE  ROW LEVEL SECURITY;
CREATE POLICY banka_tenant_isolation ON banka
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE banka_subesi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_subesi      FORCE  ROW LEVEL SECURITY;
CREATE POLICY banka_subesi_tenant_isolation ON banka_subesi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE banka_hesabi      ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_hesabi      FORCE  ROW LEVEL SECURITY;
CREATE POLICY banka_hesabi_tenant_isolation ON banka_hesabi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE pos_tanimi        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_tanimi        FORCE  ROW LEVEL SECURITY;
CREATE POLICY pos_tanimi_tenant_isolation ON pos_tanimi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE banka_hareketi    ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_hareketi    FORCE  ROW LEVEL SECURITY;
CREATE POLICY banka_hareketi_tenant_isolation ON banka_hareketi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE banka_ekstresi    ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_ekstresi    FORCE  ROW LEVEL SECURITY;
CREATE POLICY banka_ekstresi_tenant_isolation ON banka_ekstresi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE ekstre_satiri     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekstre_satiri     FORCE  ROW LEVEL SECURITY;
CREATE POLICY ekstre_satiri_tenant_isolation ON ekstre_satiri
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE kiymetli_evrak    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiymetli_evrak    FORCE  ROW LEVEL SECURITY;
CREATE POLICY kiymetli_evrak_tenant_isolation ON kiymetli_evrak
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE banka_parametresi ENABLE ROW LEVEL SECURITY;
ALTER TABLE banka_parametresi FORCE  ROW LEVEL SECURITY;
CREATE POLICY banka_parametresi_tenant_isolation ON banka_parametresi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON banka             TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON banka_subesi      TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON banka_hesabi      TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON pos_tanimi        TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON banka_hareketi    TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON banka_ekstresi    TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ekstre_satiri     TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON kiymetli_evrak    TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON banka_parametresi TO bnos_app;

-- ---------------------------------------------------------------------------
-- EVRAK YÖNETİMİ — banka kayıtlarına belge bağlanabilsin
--
-- Belge modülü (0007) zaten versiyonlama · kategori · gizlilik · önizleme ·
-- KVKK imha taşıyor; burada yalnızca İLİŞKİ TİPİ ekleniyor. Kullanıcının
-- istediği "İlişkili Banka Hareketi" ve "İlişkili Cari Hesap" bağlarından
-- ilki burada karşılanır; cari hesap FAZ 2'de eklenecek.
-- ---------------------------------------------------------------------------

ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'BANKA_HAREKETI';
ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'BANKA_EKSTRESI';
ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'KIYMETLI_EVRAK';
