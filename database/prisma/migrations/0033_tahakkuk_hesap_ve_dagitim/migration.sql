-- 0033 · GİDER TÜRÜ ↔ HESAP BAĞI + DAĞITIM SNAPSHOT + FİŞ BAĞI (ADR-0017)
--
-- ⚠️  0032 ile AYRI DOSYADA. PostgreSQL'de `ALTER TYPE ... ADD VALUE` ile
--     eklenen değer AYNI İŞLEMDE kullanılamaz; tek dosyada olsaydı bu
--     migration'ın kendisi 'TAHAKKUK' değerini göremezdi.

-- ===========================================================================
-- 1) gider_turu.muhasebe_hesap_id — ZORUNLU (K1)
--
-- `BankaHesabi.muhasebe_hesap_id` emsalinin aynısı. Bu tek alan "aidat gelir
-- mi avans mı" tartışmasını da VERİYE taşır: tenant 349'u gösterirse avans,
-- 600'ü gösterirse gelir yaklaşımı yürür. Ürün taraf tutmaz (§33 kural 3).
--
-- Ad `gelir_hesap_id` DEĞİL: 349 bir gelir hesabı değildir ve alan adı bir
-- muhasebe görüşünü dayatmamalıdır.
-- ===========================================================================

-- ⚠️  OTOMATİK EŞLEŞTİRME YAPILMAZ — DURULUR.
--
-- Hangi gider türünün hangi hesaba yazılacağı MALİ BİR KARARDIR. Kodu
-- varsayan bir backfill ('770' ya da '600'), hesap planını özelleştirmiş
-- projede yanlış hesaba toplu kayıt üretir ve düzeltmesi storno demektir.
-- CT-20 §H.4'te bir migration aynı gerekçeyle yazılmamıştı.
-- ⚠️  TARAMA RLS ALTINDA ÇALIŞMAZ. `app_tenant_id()` bağlam kurulmadan
--     RAISE eder (ADR-0002); migration ise tenant bağlamı olmayan bir
--     oturumda koşar ve TÜM tenant'ları taramak zorundadır. 0005/0016/0017'de
--     uygulanan desenin aynısı: taramadan önce muafiyet, sonra geri alınır.
ALTER TABLE gider_turu           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant               NO FORCE ROW LEVEL SECURITY;
ALTER TABLE tahakkuk_calismasi   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE hesap                NO FORCE ROW LEVEL SECURITY;
-- FK EKLERKEN DE GEREKİR: PostgreSQL kısıtı doğrulamak için hedef tabloyu
-- tarar ve o tarama da RLS'e takılır (0017'de aynı sebeple muaf tutulmuştu).
ALTER TABLE yevmiye_fisi         NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  kalan text;
BEGIN
  SELECT string_agg(DISTINCT t.kod || ':' || g.kod, ', ')
    INTO kalan
    FROM gider_turu g
    JOIN tenant t ON t.id = g.tenant_id;

  IF kalan IS NOT NULL THEN
    RAISE EXCEPTION
      'Muhasebe karşılığı atanmamış gider türleri var: %. Her gider türü için '
      'hesap seçilmeden bu migration uygulanamaz — hangi türün hangi hesaba '
      'yazılacağı mali bir karardır ve kod adına verilemez.', kalan;
  END IF;
END $$;

ALTER TABLE gider_turu
  ADD COLUMN muhasebe_hesap_id uuid NOT NULL;

ALTER TABLE gider_turu
  ADD CONSTRAINT gider_turu_muhasebe_hesap_fk
  FOREIGN KEY (muhasebe_hesap_id) REFERENCES hesap(id) ON DELETE RESTRICT;

CREATE INDEX gider_turu_muhasebe_hesap_idx
  ON gider_turu (tenant_id, muhasebe_hesap_id);

COMMENT ON COLUMN gider_turu.muhasebe_hesap_id IS
  'Tahakkuk fişinin ALACAK tarafı. Hesabın niteliğini (gelir 6xx / avans 34x) '
  'hesap planı belirler; ürün taraf tutmaz — ADR-0017 K1.';

-- ===========================================================================
-- 2) tahakkuk_calismasi — DAĞITIM SNAPSHOT'I (K7a)
--
-- Geçmiş bir tahakkukun NEDEN öyle dağıtıldığı cevaplanabilir olmalıdır.
-- Gider türünün kuralı sonradan değişirse eski tahakkuk yine doğru okunur.
-- `borc_sorumlusu.cozumleme_tarihi` snapshot mantığının aynısı.
--
-- ⚠️  EZME YAPILMASA BİLE YAZILIR. "Varsayılan kullanıldı" ile "ezildi"
--     ayrımı `paylasim_kurali_ezildi` ile görünür; yalnızca ezmede yazılsaydı
--     NULL iki farklı anlama gelirdi (ezilmedi / eski kayıt).
-- ===========================================================================
ALTER TABLE tahakkuk_calismasi
  ADD COLUMN kullanilan_paylasim_kurali "PaylasimKurali",
  ADD COLUMN paylasim_kurali_ezildi boolean NOT NULL DEFAULT false;

-- Geçmiş kayıtlar: türün BUGÜNKÜ kuralı yazılır.
--
-- ⚠️  BU BİR TAHMİNDİR ve sınırı açıktır: tür o tarihten sonra değiştiyse
--     geçmiş kayıt yanlış okunur. Doğrusu kayıt anında yazmaktı; geriye dönük
--     olarak bundan iyisi yok. Yeni kayıtlarda tahmin YOKTUR.
UPDATE tahakkuk_calismasi c
   SET kullanilan_paylasim_kurali = g.paylasim_kurali
  FROM gider_turu g
 WHERE g.tenant_id = c.tenant_id
   AND g.kod = c.gider_turu_kodu
   AND c.kullanilan_paylasim_kurali IS NULL;

-- Türü silinmiş çalışmalar kalabilir; onlar için kural bilinmiyor ve
-- uydurulmaz. NOT NULL bu yüzden koşullu uygulanır.
DO $$
DECLARE
  bilinmeyen bigint;
BEGIN
  SELECT count(*) INTO bilinmeyen
    FROM tahakkuk_calismasi WHERE kullanilan_paylasim_kurali IS NULL;

  IF bilinmeyen = 0 THEN
    ALTER TABLE tahakkuk_calismasi
      ALTER COLUMN kullanilan_paylasim_kurali SET NOT NULL;
  ELSE
    RAISE WARNING
      'Kuralı belirlenemeyen % tahakkuk çalışması var (gider türü silinmiş). '
      'Kolon NULL kalabilir olarak bırakıldı; uydurma değer YAZILMADI.',
      bilinmeyen;
  END IF;
END $$;

-- ===========================================================================
-- 3) tahakkuk_calismasi.yevmiye_fisi_id — FİŞ BAĞI (K3 · K6b)
--
-- ⚠️  BAĞ ÇALIŞMADADIR, `borc`ta DEĞİL. Çalışma başına TEK fiş vardır (K3);
--     bir çalışmanın bütün borçları aynı fişe bağlıdır. `borc.yevmiye_fisi_id`
--     eklenseydi aynı bilgi iki kaynakta dururdu (borc → calisma → fis zaten
--     cevabı veriyor), 5.000 borçlu çalışmada 5.000 satır güncellenirdi ve
--     biri düşerse borçların bir kısmı muhasebeleşmiş GÖRÜNÜRDÜ.
--
--     Mükerrer koruması bu alandadır: dolu ise ikinci muhasebeleştirme
--     reddedilir; düzeltme storno ile yapılır.
-- ===========================================================================
ALTER TABLE tahakkuk_calismasi
  ADD COLUMN yevmiye_fisi_id uuid;

ALTER TABLE tahakkuk_calismasi
  ADD CONSTRAINT tahakkuk_calismasi_yevmiye_fisi_fk
  FOREIGN KEY (yevmiye_fisi_id) REFERENCES yevmiye_fisi(id) ON DELETE RESTRICT;

CREATE INDEX tahakkuk_calismasi_yevmiye_fisi_idx
  ON tahakkuk_calismasi (tenant_id, yevmiye_fisi_id);

COMMENT ON COLUMN tahakkuk_calismasi.yevmiye_fisi_id IS
  'Boşsa çalışma henüz deftere girmemiştir. Bir borcun muhasebeleşip '
  'muhasebeleşmediği BURADAN türetilir — ADR-0017 K6b.';

-- ===========================================================================
-- 4) 500 YENİLEME FONU — hesap tipi (K4)
--
-- Fon kat maliklerine ait İADE EDİLEBİLİR EMANETTİR, özkaynak değil.
-- VUK md. 328'deki teknik "yenileme fonu" (amortismana tabi kıymet satış
-- kârının 549'da izlenmesi) ile KARIŞTIRILMAZ — o, bilanço esasına tabi
-- ticari işletmelere özgü bir vergi erteleme müessesesidir.
--
-- ⚠️  KOD İLE DEĞİL, TİP İLE seçilir mi? Hayır — burada kod kullanmak
--     zorunludur çünkü `HesapOzelligi` içinde "fon" diye bir işaret yok ve
--     onu eklemek ayrı bir karardır. Bu yüzden güncelleme YALNIZCA tohumun
--     yazdığı adla eşleşen satırları hedefler ve özelleştirilmiş planlara
--     DOKUNMAZ.
UPDATE hesap
   SET tip = 'BORC'
 WHERE kod = '500'
   AND ad = 'Yenileme Fonu'
   AND tip = 'OZKAYNAK';

-- ---------------------------------------------------------------------------
-- 5) RLS MUAFİYETİ GERİ ALINIR — atlanırsa bu tablolar kalıcı olarak
--    sahibine karşı korumasız kalır.
-- ---------------------------------------------------------------------------
ALTER TABLE gider_turu           FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant               FORCE ROW LEVEL SECURITY;
ALTER TABLE tahakkuk_calismasi   FORCE ROW LEVEL SECURITY;
ALTER TABLE hesap                FORCE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi         FORCE ROW LEVEL SECURITY;
