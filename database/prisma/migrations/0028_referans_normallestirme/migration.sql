-- 0028 · REFERANS NORMALLEŞTİRME — aynı fatura tek yazımla değil, tek OLAYLA
--
-- ⚠️  0027'nin açığı: benzersizlik HAM metin üzerindeydi. `FT-2026-001`,
--     `ft 2026 001` ve `FT.2026/001` veritabanı için üç ayrı değerdir; aynı
--     fatura üç kez tahakkuk edilebiliyordu. Koruma var SANILAN, olmayan bir
--     durumdu.
--
-- İKİ TASARIM KARARI:
--
-- 1) İFADE İNDEKSİ DEĞİL, SAKLANAN ÜRETİLMİŞ KOLON. Normalleştirilmiş değer
--    sorgulanabilir ve görünür olmalı: çakışma hatasında kullanıcıya "bu
--    referans şununla çakışıyor" diyebilmek için okunabilmesi gerekir.
--
-- 2) `COLLATE "C"` — DETERMİNİZM ŞART. Yerel ayara bağlı `upper()` üretime
--    taşınırken değişebilir; eski satırlar eski normalleştirmeyle kalır ve
--    benzersizlik SESSİZCE delinir. Mali veride kabul edilemez.
--
--    ⚠️  AMA `COLLATE "C"` TEK BAŞINA TÜRKÇEYİ ÇÖZMEZ: `upper('şubat')` C
--        altında `şUBAT` verir, `ŞUBAT` ile eşleşmez. Ölçüldü. Bu yüzden
--        büyütmeden ÖNCE Türkçe harfler `translate()` ile ASCII karşılığına
--        çevrilir — deterministik, yerel ayardan bağımsız.
--
--    Yan etki bilinerek kabul edildi: `ÇAM` ile `CAM` aynı anahtara düşer.
--    Bu bir EŞLEŞTİRME anahtarıdır, gösterilen değer değil; `referans`
--    kolonu kullanıcının yazdığı hâli aynen saklamaya devam eder.

ALTER TABLE tahakkuk_calismasi
  ADD COLUMN referans_norm text
  GENERATED ALWAYS AS (
    upper(
      translate(
        regexp_replace(referans, '[[:space:]\-_./\\]', '', 'g'),
        'çğıöşüÇĞİÖŞÜ', 'cgiosuCGIOSU'
      ) COLLATE "C"
    )
  ) STORED;

-- ★ MEVCUT BOZUK VERİ DENETİMİ — SESSİZCE DÜZELTİLMEZ (0026 ile aynı ilke).
--
-- Ham metin kısıtı yürürlükteyken aynı fatura farklı yazımlarla iki kez
-- girilmiş olabilir. Hangi çalıştırmanın geçerli olduğu MALİ BİR KARARDIR;
-- migration otomatik silmez, DURUR ve neyin çakıştığını söyler.
-- ⚠️  Denetim sorgusu tabloyu OKUR; FORCE RLS altında bağlam olmadığı için
--     `app_tenant_id()` hata verir. Tarama süresince kaldırılır, sonunda
--     geri konur (0026'daki `borc` ile aynı tuzak).
ALTER TABLE tahakkuk_calismasi NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE cakisan text;
BEGIN
  SELECT string_agg(format('tenant=%s gider=%s donem=%s referanslar=[%s]',
                           tenant_id, gider_turu_kodu, donem, referanslar),
                    E'\n')
  INTO cakisan
  FROM (
    SELECT tenant_id, gider_turu_kodu, donem,
           string_agg(referans, ' | ') AS referanslar
    FROM tahakkuk_calismasi
    WHERE referans IS NOT NULL
    GROUP BY tenant_id, gider_turu_kodu, donem, referans_norm
    HAVING count(*) > 1
    LIMIT 20
  ) s;
  IF cakisan IS NOT NULL THEN
    RAISE EXCEPTION E'AYNI GIDER OLAYI FARKLI YAZIMLARLA IKI KEZ TAHAKKUK EDILMIS — migration durduruldu.\n%\n\n%',
      cakisan,
      'Bu satirlar bu migration''in kapattigi acigin urunudur: benzersizlik '
      'ham metin uzerindeydi ve ayni fatura farkli yazimla ikinci kez '
      'gecebiliyordu. Hangi calistirmanin gecerli oldugu MALI BIR KARARDIR; '
      'migration otomatik silmez. Fazla kayitlari inceleyip temizledikten '
      'sonra tekrar calistirin.';
  END IF;
END $$;

-- Ham metin üzerindeki kısıt kaldırılır; yerine normalleştirilmiş olan gelir.
DROP INDEX tahakkuk_calismasi_referans_uq;

CREATE UNIQUE INDEX tahakkuk_calismasi_referans_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem, referans_norm)
  WHERE referans IS NOT NULL;

DROP INDEX tahakkuk_calismasi_referans_idx;
CREATE INDEX tahakkuk_calismasi_referans_idx
  ON tahakkuk_calismasi (tenant_id, referans_norm);

ALTER TABLE tahakkuk_calismasi FORCE ROW LEVEL SECURITY;
