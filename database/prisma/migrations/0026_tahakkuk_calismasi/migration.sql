-- 0026 · TAHAKKUK ÇALIŞMASI — mükerrer tahakkuk koruması veritabanına taşınır
--
-- ⚠️  NEDEN: `borc.count()` ile yapılan uygulama denetimi bir YARIŞI önleyemez.
--     Uzun bir toplu tahakkuk ters vekilde kesildiğinde iş arka planda sürer;
--     kullanıcı tekrar dener; ikinci istek ilk işlem COMMIT ETMEDEN gelir ve
--     sayaç commit edilmemiş satırları göremez. 5.000 bölümlük bir sitede
--     ölçülen sonuç: 5.000 yerine 10.000 borç satırı. Her daire iki kez.
--
--     Koruma bu yüzden BENZERSİZLİK KISITIDIR: ikinci işlem kısıt üzerinde
--     BLOKLANIR, ilk işlem commit edince ihlalle düşer. Pencere yoktur.
--
-- KAPSAM PROJE BÜTÜNÜDÜR. Blok, tahakkukun benzersizlik anahtarının ya da iş
-- kuralının parçası DEĞİLDİR; yalnızca süzme ve raporlama içindir.
--
-- CARİ = BAĞIMSIZ BÖLÜM (ADR-0010). Benzersizlik bölüm üzerindedir, kişi
-- üzerinde değil: üç daireli bir malik dönemde üç kez borçlanır (KMK md. 20).

CREATE TYPE "TahakkukTipi" AS ENUM ('ASIL', 'EK');

CREATE TABLE tahakkuk_calismasi (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  gider_turu_kodu    varchar(40) NOT NULL,
  donem              date NOT NULL,
  tip                "TahakkukTipi" NOT NULL DEFAULT 'ASIL',
  -- ASIL her zaman 1'dir; ek tahakkuklar 2'den başlar.
  sira               integer NOT NULL DEFAULT 1,
  toplam_tutar       numeric(18,4) NOT NULL,
  bolum_sayisi       integer NOT NULL,
  olusturulma_tarihi timestamptz(6) NOT NULL DEFAULT now()
);

-- ★ ASIL TAHAKKUK DÖNEMDE TEKTİR. Kısmi indeks: ek tahakkuklar bu kısıta
--   girmez, dolayısıyla yönetici açıkça "Ek Tahakkuk" dediğinde geçebilir.
CREATE UNIQUE INDEX tahakkuk_calismasi_asil_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem)
  WHERE tip = 'ASIL';

-- Ek tahakkuklar da kendi aralarında sıralı ve tektir.
CREATE UNIQUE INDEX tahakkuk_calismasi_sira_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem, sira);

CREATE INDEX tahakkuk_calismasi_donem_idx
  ON tahakkuk_calismasi (tenant_id, donem);

-- --- borç satırı çalışmaya bağlanır --------------------------------------
--
-- Mevcut satırlar için geriye dönük bir çalışma üretilir: kolon NOT NULL
-- olacak ve veri kaybı olmayacak. Her (gider türü, dönem) üçlüsü tek bir
-- ASIL çalışmaya toplanır — geçmişte zaten dönemde tek tahakkuk kuralı
-- uygulama katmanında zorlanıyordu.
ALTER TABLE borc ADD COLUMN calisma_id uuid;

-- ⚠️  MIGRATION TUZAĞI (0004/0005/0006'da da yaşandı): geri doldurma sorgusu
--     `borc` tablosunu OKUR ve FORCE RLS altında `app_tenant_id()` bağlam
--     olmadığı için hata verir. Tarama süresince FORCE kaldırılır; blok
--     sonunda GERİ KONUR. Aynı şey FK doğrulaması ve benzersiz indeks
--     oluşturmanın tablo taraması için de geçerlidir.
ALTER TABLE borc NO FORCE ROW LEVEL SECURITY;

INSERT INTO tahakkuk_calismasi
  (id, tenant_id, gider_turu_kodu, donem, tip, sira, toplam_tutar, bolum_sayisi,
   olusturulma_tarihi)
SELECT gen_random_uuid(), b.tenant_id, b.gider_turu_kodu, b.tahakkuk_donemi,
       'ASIL', 1, sum(b.tutar), count(*), min(b.olusturulma_tarihi)
FROM borc b
GROUP BY b.tenant_id, b.gider_turu_kodu, b.tahakkuk_donemi;

UPDATE borc b
SET calisma_id = c.id
FROM tahakkuk_calismasi c
WHERE c.tenant_id = b.tenant_id
  AND c.gider_turu_kodu = b.gider_turu_kodu
  AND c.donem = b.tahakkuk_donemi;

ALTER TABLE borc ALTER COLUMN calisma_id SET NOT NULL;
ALTER TABLE borc ADD CONSTRAINT borc_calisma_fk
  FOREIGN KEY (calisma_id) REFERENCES tahakkuk_calismasi(id);

-- ★ MEVCUT BOZUK VERİ DENETİMİ — SESSİZCE DÜZELTİLMEZ.
--
-- Bu migration'ın kapattığı hata (çift tahakkuk) UYGULANMADAN ÖNCE veri
-- bozmuş olabilir. Mükerrer satırları otomatik silmek, mali kaydı insan
-- gözü görmeden değiştirmek olurdu. Bunun yerine migration DURUR ve neyin
-- bozuk olduğunu söyler; temizlik bilinçli bir karar olarak yapılır.
DO $$
DECLARE mukerrer text;
BEGIN
  SELECT string_agg(format('tenant=%s gider=%s donem=%s bolum=%s adet=%s',
                           tenant_id, gider_turu_kodu, tahakkuk_donemi, bolum_id, n),
                    E'\n' ORDER BY n DESC)
  INTO mukerrer
  FROM (
    SELECT tenant_id, gider_turu_kodu, tahakkuk_donemi, bolum_id, count(*) n
    FROM borc
    GROUP BY 1,2,3,4 HAVING count(*) > 1
    LIMIT 20
  ) s;
  IF mukerrer IS NOT NULL THEN
    RAISE EXCEPTION E'MUKERRER BORC KAYDI VAR — migration durduruldu.\n%\n\n%',
      mukerrer,
      'Bu satirlar bu migration''in kapattigi cift tahakkuk hatasinin urunudur. '
      'Hangi calistirmanin gecerli oldugu MALI BIR KARARDIR; migration '
      'otomatik silmez. Fazla kayitlari inceleyip temizledikten sonra tekrar '
      'calistirin.';
  END IF;
END $$;

-- ★ BİR ÇALIŞMADA BİR BÖLÜME BİR BORÇ. Çalışma kısıtı yarışı kapatır; bu
--   kısıt aynı çalışmanın kendi içinde bölümü iki kez işlemesini kapatır.
CREATE UNIQUE INDEX borc_calisma_bolum_uq ON borc (calisma_id, bolum_id);

CREATE INDEX borc_calisma_idx ON borc (tenant_id, calisma_id);

ALTER TABLE borc FORCE ROW LEVEL SECURITY;

-- --- RLS ------------------------------------------------------------------
ALTER TABLE tahakkuk_calismasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE tahakkuk_calismasi FORCE ROW LEVEL SECURITY;

CREATE POLICY tahakkuk_calismasi_tenant_isolation ON tahakkuk_calismasi
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- Satır kapsamı: çalışma kaydı PROJE seviyesindedir ve bölüm taşımaz.
-- Sakin sınıfı roller kendi borçlarını `borc` üzerinden görür; çalışma
-- kaydının kendisi yalnızca kapsamı serbest olan rollere açıktır.
CREATE POLICY tahakkuk_calismasi_kapsam ON tahakkuk_calismasi
  AS RESTRICTIVE FOR SELECT
  USING (app_kapsam_serbest());

GRANT SELECT, INSERT, UPDATE, DELETE ON tahakkuk_calismasi TO bnos_app;

-- --- IDEMPOTENCY-KEY -------------------------------------------------------
--
-- ⚠️  BFS v1 §366 bu başlığı ZORUNLU kılıyordu ama depoda hiçbir yer onu
--     OKUMUYORDU. Beyan edilmiş ve bağlanmamış koruma — `yalnizcaKendiVerisi`
--     ile aynı sınıf hata. Bu tablo başlığı gerçek yapar.
CREATE TABLE idempotans_kaydi (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  anahtar            varchar(200) NOT NULL,
  yol                varchar(200) NOT NULL,
  -- Gövdenin sha256'sı: aynı anahtar farklı gövdeyle gelirse 409.
  istek_ozeti        varchar(64) NOT NULL,
  durum              integer NOT NULL,
  yanit              jsonb NOT NULL,
  gecerlilik_sonu    timestamptz(6) NOT NULL,
  olusturulma_tarihi timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idempotans_kaydi_anahtar_uq
  ON idempotans_kaydi (tenant_id, anahtar);
CREATE INDEX idempotans_kaydi_gecerlilik_idx
  ON idempotans_kaydi (gecerlilik_sonu);

ALTER TABLE idempotans_kaydi ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotans_kaydi FORCE ROW LEVEL SECURITY;

CREATE POLICY idempotans_kaydi_tenant_isolation ON idempotans_kaydi
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- Satır kapsamı: kayıt bölüm taşımaz, kendi isteğinin yanıtını tutar.
-- Sakin sınıfı roller kendi anahtarlarını kullanır; başkasının anahtarını
-- bilemez. Yine de kapsam politikası AÇIKÇA yazılır (RESTRICTIVE zinciri
-- eksiksiz kalsın diye).
CREATE POLICY idempotans_kaydi_kapsam ON idempotans_kaydi
  AS RESTRICTIVE FOR SELECT
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotans_kaydi TO bnos_app;
