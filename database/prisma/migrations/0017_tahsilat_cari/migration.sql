-- ===========================================================================
-- BNOS Apartman Yönetimi — 0017_tahsilat_cari
--
-- CARİ HESAP = bağımsız bölüm yardımcı defteri (ADR-0010). Bu migration o
-- defterin EKSİK YARISINI ekler: ÖDEME KAYDI.
--
-- ⚠️  BUGÜNE KADAR ÖDEME KAYDI HİÇ YOKTU. Ödeme bilgisi yalnızca
--     `borc.odenen` ve `borc_sorumlusu.odenen` kolonlarında YÜRÜYEN BİR
--     TOPLAM olarak duruyordu. Bu kolon, ödeme kaydı olmadan da DOĞRU
--     GÖRÜNÜR — toplam tuttuğu için ödeme geçmişinin var olduğu sanılır.
--     Oysa:
--
--       · Ekstre üretilemez  — "borç satırı · ödeme satırı · yürüyen bakiye"
--         isteyen ekstrenin ödeme satırı diye bir kaydı yoktu.
--       · Tahsis izlenemez   — bir ödeme birden çok borcu kapatabilir; hangi
--         borca ne kadar gittiği kayıtsızdı.
--       · Denetlenemez       — `odenen` bir UPDATE ile artıyordu; kim, ne
--         zaman, hangi kanaldan tahsil etti sorusunun cevabı yoktu. Bu
--         FİNANSAL bir kayıttır ve BFS v1 §5.1 uyarınca değiştirilemez
--         olmalıydı.
--       · Makbuz numarası bağlanamaz — boşluksuz seri hazırdı ama bağlanacak
--         ödeme kaydı yoktu.
--       · Banka mutabakatı yarım kalıyordu — 0016 `banka_hareketi` ile aidat
--         tahsilatı arasında bağ yoktu; para hesaba girdi ama hangi borcu
--         kapattığı kayıtsızdı.
--
-- ⚠️  `borc.odenen` ARTIK TÜRETİLMİŞ DEĞERDİR. Elle yazılmaz; tahsis
--     satırlarından hesaplanır. İki kaynak (kolon + tahsis) birbirinden
--     bağımsız yazılabilseydi, biri güncellenmeyi unuttuğunda bakiye SESSİZCE
--     yanlış çıkardı.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) TAHSİLAT — FİNANSAL kayıt, SİLİNMEZ
--
-- Soft delete alanları BİLİNÇLİ OLARAK YOK (BFS v1 §5.1). Hatalı tahsilat
-- `durum = IPTAL` ile gerekçelenir; kayıt defterde kalır ve makbuz numarası
-- serisinde boşluk oluşmaz (VUK: makbuz numarası atlamaz).
-- ---------------------------------------------------------------------------

CREATE TYPE "TahsilatKanali" AS ENUM (
  'NAKIT', 'BANKA', 'POS', 'CEK', 'SENET', 'MAHSUP'
);

CREATE TYPE "TahsilatDurumu" AS ENUM ('GECERLI', 'IPTAL');

CREATE TABLE "tahsilat" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    -- Makbuz numarası BOŞLUKSUZ seridir (`NumaraServisi` · seri MAKBUZ).
    -- Tenant içinde tekildir: aynı numaralı iki makbuz, hangisinin geçerli
    -- olduğu sorulduğunda cevapsız kalır.
    "makbuz_no" VARCHAR(32) NOT NULL,

    "kanal" "TahsilatKanali" NOT NULL,
    "durum" "TahsilatDurumu" NOT NULL DEFAULT 'GECERLI',

    -- İŞARETSİZ tutar. Tahsilat her zaman paranın GİRİŞİdir; iade ayrı bir
    -- kavramdır ve negatif tahsilat olarak yazılmaz (toplamları bozar).
    "tutar" DECIMAL(18,4) NOT NULL,
    "tahsilat_tarihi" DATE NOT NULL,

    "aciklama" TEXT,

    -- ÖDEYEN kişi, BORÇLU ile aynı olmak zorunda DEĞİLDİR: komşusu ya da
    -- akrabası adına ödeme yapılabilir. Borçlu kimliği tahsis satırındaki
    -- `borc_sorumlusu_id` üzerinden gelir.
    "odeyen_kisi_id" UUID,
    "tahsil_eden" UUID,

    -- 0016 BAĞLARI. Banka kanalıyla gelen tahsilatın hangi banka hareketine
    -- karşılık geldiği; çek/senet ile ödemede hangi evrak.
    "banka_hareketi_id" UUID,
    "kiymetli_evrak_id" UUID,

    -- Muhasebeleştirme. Boşsa tahsilat henüz deftere girmemiştir.
    "yevmiye_fisi_id" UUID,

    -- İPTAL — gerekçe ZORUNLU (aşağıdaki CHECK). Bir tahsilatı iptal etmek
    -- parayı geri vermek değildir; hangi kararla iptal edildiği denetimde
    -- sorulabilir olmalıdır.
    "iptal_gerekcesi" TEXT,
    "iptal_eden" UUID,
    "iptal_ani" TIMESTAMPTZ(6),

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncelleme_tarihi" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tahsilat_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 2) TAHSİLAT TAHSİSİ — ödemenin hangi borca ne kadar gittiği
--
-- ⚠️  BU TABLO OLMADAN "cari ekstre" DİYE BİR ŞEY YOKTUR. Ekstrenin ödeme
--     satırı burasıdır; yürüyen bakiye borç satırları ile bu satırların
--     tarih sırasına göre birleşiminden çıkar.
--
-- ⚠️  `borc_sorumlusu_id` HİSSELİ MÜLKİYET İÇİN ZORUNLU AYRIMDIR. Borç
--     maliklere BÖLÜNÜR (`borc_sorumlusu.pay`); bir malik kendi payını
--     ödediğinde ötekilerin borcu AÇIK kalmalıdır. Tahsis yalnızca borca
--     bağlansaydı, bir malikin ödemesi bütün hissedarların borcunu kapatmış
--     görünürdü.
-- ---------------------------------------------------------------------------

CREATE TABLE "tahsilat_tahsisi" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tahsilat_id" UUID NOT NULL,
    "borc_id" UUID NOT NULL,
    -- Hisseli mülkiyette kimin payına sayıldığı. Tek sorumlu varsa boş
    -- bırakılabilir.
    "borc_sorumlusu_id" UUID,

    "tutar" DECIMAL(18,4) NOT NULL,

    "olusturulma_tarihi" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tahsilat_tahsisi_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 3) HESAP ÖZELLİĞİ — KONTROL HESABI
--
-- Yardımcı defterin (bölüm bakiyeleri toplamı) mutabık olması gereken hesap
-- `120 Alıcılar`dır. Ama HESAP KODU TENANT'A GÖRE DEĞİŞİR: '120' her
-- tenant'ta alıcılar hesabı olmayabilir. Bu yüzden kontrol hesabı KOD ile
-- DEĞİL `ozellik` alanıyla işaretlenir (§33 kural 3: politika koda gömülmez).
--
-- Bu, 0015'te `KASA`/`BANKA` için verilen kararın aynısıdır: Kasa Defteri de
-- hesap koduna değil bu alana dayanıyor.
-- ---------------------------------------------------------------------------

ALTER TYPE "HesapOzelligi" ADD VALUE IF NOT EXISTS 'CARI_KONTROL';

-- ---------------------------------------------------------------------------
-- YABANCI ANAHTARLAR
--
-- ⚠️  FK doğrulama taraması hem KAYNAK hem HEDEF tabloyu okur (0011 notu).
--     Hedef tablolar RLS taşıdığı için tarama tenant bağlamı olmadan
--     çalışamaz; bu yüzden FK eklenirken geçici olarak muaf tutulurlar.
-- ---------------------------------------------------------------------------

ALTER TABLE borc            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE borc_sorumlusu  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE banka_hareketi  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE kiymetli_evrak  NO FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi    NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "tahsilat" ADD CONSTRAINT "tahsilat_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tahsilat" ADD CONSTRAINT "tahsilat_odeyen_kisi_id_fkey"
  FOREIGN KEY ("odeyen_kisi_id") REFERENCES "kisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tahsilat" ADD CONSTRAINT "tahsilat_banka_hareketi_id_fkey"
  FOREIGN KEY ("banka_hareketi_id") REFERENCES "banka_hareketi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tahsilat" ADD CONSTRAINT "tahsilat_kiymetli_evrak_id_fkey"
  FOREIGN KEY ("kiymetli_evrak_id") REFERENCES "kiymetli_evrak"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tahsilat" ADD CONSTRAINT "tahsilat_yevmiye_fisi_id_fkey"
  FOREIGN KEY ("yevmiye_fisi_id") REFERENCES "yevmiye_fisi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tahsilat_tahsisi" ADD CONSTRAINT "tahsilat_tahsisi_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Tahsilat silinmez; ama bir tahsilatın tahsisleri onunla birlikte anlam
-- taşır. CASCADE bilinçli: iptal edilen tahsilatın tahsisleri servis
-- katmanında silinir ve `borc.odenen` yeniden hesaplanır.
ALTER TABLE "tahsilat_tahsisi" ADD CONSTRAINT "tahsilat_tahsisi_tahsilat_id_fkey"
  FOREIGN KEY ("tahsilat_id") REFERENCES "tahsilat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tahsilat_tahsisi" ADD CONSTRAINT "tahsilat_tahsisi_borc_id_fkey"
  FOREIGN KEY ("borc_id") REFERENCES "borc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tahsilat_tahsisi" ADD CONSTRAINT "tahsilat_tahsisi_borc_sorumlusu_id_fkey"
  FOREIGN KEY ("borc_sorumlusu_id") REFERENCES "borc_sorumlusu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE borc            FORCE ROW LEVEL SECURITY;
ALTER TABLE borc_sorumlusu  FORCE ROW LEVEL SECURITY;
ALTER TABLE kisi            FORCE ROW LEVEL SECURITY;
ALTER TABLE banka_hareketi  FORCE ROW LEVEL SECURITY;
ALTER TABLE kiymetli_evrak  FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi    FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- INDEX'LER
-- ---------------------------------------------------------------------------

CREATE INDEX "tahsilat_tenant_tarih_idx" ON "tahsilat"("tenant_id", "tahsilat_tarihi");
CREATE INDEX "tahsilat_tenant_kanal_idx" ON "tahsilat"("tenant_id", "kanal");
CREATE INDEX "tahsilat_tenant_odeyen_idx" ON "tahsilat"("tenant_id", "odeyen_kisi_id");
-- Muhasebeleşmemiş tahsilatlar — "deftere girmeyi bekleyen" listesinin sorgusu.
CREATE INDEX "tahsilat_muhasebesiz_idx"
  ON "tahsilat"("tenant_id", "tahsilat_tarihi") WHERE yevmiye_fisi_id IS NULL;

CREATE INDEX "tahsilat_tahsisi_tenant_borc_idx"
  ON "tahsilat_tahsisi"("tenant_id", "borc_id");
CREATE INDEX "tahsilat_tahsisi_tenant_tahsilat_idx"
  ON "tahsilat_tahsisi"("tenant_id", "tahsilat_id");
CREATE INDEX "tahsilat_tahsisi_tenant_sorumlu_idx"
  ON "tahsilat_tahsisi"("tenant_id", "borc_sorumlusu_id");

-- ---------------------------------------------------------------------------
-- TEKİLLİK
-- ---------------------------------------------------------------------------

-- Makbuz numarası tenant içinde TEKİLDİR. Kısmî değil TAM unique: tahsilat
-- soft delete taşımaz, iptal edilen makbuz da numarasını KORUR (VUK: makbuz
-- numarası atlamaz, iptal edilen makbuz "iptal" olarak saklanır).
CREATE UNIQUE INDEX tahsilat_makbuz_no_uq ON tahsilat (tenant_id, makbuz_no);

-- Aynı tahsilat, aynı borcun aynı sorumlusuna İKİ KEZ tahsis edilemez: iki
-- satır aynı parayı iki kez saydırır ve borç fazla kapanmış görünür.
-- `borc_sorumlusu_id` NULL olabildiği için İKİ kısmî index gerekir; tek
-- index'te NULL'lar birbirine eşit sayılmaz ve kural boşa çıkardı.
CREATE UNIQUE INDEX tahsilat_tahsisi_sorumlu_uq
  ON tahsilat_tahsisi (tahsilat_id, borc_id, borc_sorumlusu_id)
  WHERE borc_sorumlusu_id IS NOT NULL;
CREATE UNIQUE INDEX tahsilat_tahsisi_borc_uq
  ON tahsilat_tahsisi (tahsilat_id, borc_id)
  WHERE borc_sorumlusu_id IS NULL;

-- ---------------------------------------------------------------------------
-- BÜTÜNLÜK
-- ---------------------------------------------------------------------------

-- Tutarlar POZİTİF. Sıfır tahsilat kayıt kirliliğidir; negatif tahsilat ise
-- iade demektir ve ayrı bir kavramdır (toplamları bozar).
ALTER TABLE tahsilat ADD CONSTRAINT tahsilat_tutar_pozitif
  CHECK (tutar > 0);
ALTER TABLE tahsilat_tahsisi ADD CONSTRAINT tahsilat_tahsisi_tutar_pozitif
  CHECK (tutar > 0);

-- İPTAL gerekçe ZORUNLU: bir tahsilatı iptal etmek parayı geri vermek
-- değildir; hangi kararla iptal edildiği denetimde sorulabilir olmalıdır.
ALTER TABLE tahsilat ADD CONSTRAINT tahsilat_iptal_gerekce
  CHECK (durum <> 'IPTAL' OR (iptal_gerekcesi IS NOT NULL AND iptal_ani IS NOT NULL));

-- GEÇERLİ tahsilatın iptal alanları BOŞ olmalıdır: dolu kalırsa "iptal
-- edilmiş ama geçerli" gibi anlamsız bir kayıt oluşur ve raporlar çelişir.
ALTER TABLE tahsilat ADD CONSTRAINT tahsilat_gecerli_temiz
  CHECK (durum <> 'GECERLI' OR (iptal_gerekcesi IS NULL AND iptal_ani IS NULL));

-- BANKA kanalı banka hareketi İSTER; nakit tahsilatın banka hareketi OLAMAZ.
-- Bu bağ olmadan banka mutabakatı aidat tahsilatını göremez.
ALTER TABLE tahsilat ADD CONSTRAINT tahsilat_kanal_banka
  CHECK (kanal <> 'BANKA' OR banka_hareketi_id IS NOT NULL);
ALTER TABLE tahsilat ADD CONSTRAINT tahsilat_kanal_nakit
  CHECK (kanal <> 'NAKIT' OR banka_hareketi_id IS NULL);

-- ÇEK/SENET kanalı kıymetli evrak İSTER (0016).
ALTER TABLE tahsilat ADD CONSTRAINT tahsilat_kanal_evrak
  CHECK (kanal NOT IN ('CEK', 'SENET') OR kiymetli_evrak_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- ⚠️  Yeni tablo politika almazsa tenant izolasyonu SESSİZCE kalkar.
--     `scripts/rls-politika-scan.mjs` bu eksikliği artık yakalar (0016'da
--     eklendi) ama migration'da unutmak yine de mümkündür.
-- ---------------------------------------------------------------------------

ALTER TABLE tahsilat         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tahsilat         FORCE  ROW LEVEL SECURITY;
CREATE POLICY tahsilat_tenant_isolation ON tahsilat
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

ALTER TABLE tahsilat_tahsisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE tahsilat_tahsisi FORCE  ROW LEVEL SECURITY;
CREATE POLICY tahsilat_tahsisi_tenant_isolation ON tahsilat_tahsisi
  USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON tahsilat         TO bnos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tahsilat_tahsisi TO bnos_app;

-- ---------------------------------------------------------------------------
-- EVRAK YÖNETİMİ — makbuz belgesi tahsilata bağlanabilsin
-- ---------------------------------------------------------------------------

ALTER TYPE "BelgeVarlikTipi" ADD VALUE IF NOT EXISTS 'TAHSILAT';
