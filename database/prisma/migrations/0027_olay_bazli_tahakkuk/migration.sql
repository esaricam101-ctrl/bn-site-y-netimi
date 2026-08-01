-- 0027 · OLAY BAZLI TAHAKKUK — mükerrer koruması iki sınıfa ayrılır
--
-- ⚠️  0026'nın eksiği: "dönemde tek tahakkuk" kuralını BÜTÜN gider türlerine
--     uyguluyordu. Doğru olan yalnızca DÖNEMSEL giderler içindir:
--
--       DÖNEMSEL   — aidat, yıl sonu kapanışı. Dönemde TEK olur; ikincisi
--                    mükerrerdir ve mali veri bozar.
--       OLAY BAZLI — demirbaş alımı, bir defalık gider. Bir OLAYA bağlıdır;
--                    aynı ay içinde iki ayrı alım yapılabilir ve İKİSİ DE
--                    meşrudur. Bunlar birbirinin düzeltmesi DEĞİLDİR.
--
--     Olay bazlı sınıfta koruma dönem üzerinden kurulamaz — ayırt edici olan
--     gider olayının kendisidir. Bu yüzden `referans` (fatura/karar no)
--     ZORUNLUDUR ve benzersizlik onun üzerindedir: aynı fatura iki kez
--     yansıtılamaz, farklı faturalar serbestçe yansıtılır.

CREATE TYPE "TahakkukSikligi" AS ENUM ('DONEMSEL', 'OLAY_BAZLI');

-- Varsayılan DÖNEMSEL: mevcut gider türlerinin davranışı DEĞİŞMEZ ve yeni
-- bir tür tanımlanırken sıklık unutulursa SIKI tarafa düşer (fail closed).
ALTER TABLE gider_turu
  ADD COLUMN tahakkuk_sikligi "TahakkukSikligi" NOT NULL DEFAULT 'DONEMSEL';

-- Gider olayının iş anahtarı. DÖNEMSEL çalışmalarda NULL kalır.
ALTER TABLE tahakkuk_calismasi ADD COLUMN referans varchar(120);

-- --- kısıtlar yeniden kurulur ---------------------------------------------
--
-- Eski kısıt referansı bilmiyordu ve olay bazlı ikinci çalışmayı da bloklardı.
DROP INDEX tahakkuk_calismasi_asil_uq;

-- ★ DÖNEMSEL TEK: referanssız ASIL çalışma dönemde tektir.
--   Olay bazlı çalışmalar referans taşıdığı için bu kısıta GİRMEZ.
--   Referansı unutulmuş bir olay bazlı çalışma da buraya düşer — yani
--   hata durumunda davranış SIKI taraftadır, gevşek değil.
CREATE UNIQUE INDEX tahakkuk_calismasi_donemsel_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem)
  WHERE tip = 'ASIL' AND referans IS NULL;

-- ★ AYNI GİDER OLAYI İKİ KEZ YANSITILAMAZ.
CREATE UNIQUE INDEX tahakkuk_calismasi_referans_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem, referans)
  WHERE referans IS NOT NULL;

-- 0026'daki sıra kısıtı olay bazlı çalışmalarda yanlış çakışma üretirdi
-- (her olay bazlı çalışma sira=1 ile açılır). Yalnızca referanssız
-- çalışmalar için geçerli kalır.
DROP INDEX tahakkuk_calismasi_sira_uq;
CREATE UNIQUE INDEX tahakkuk_calismasi_sira_uq
  ON tahakkuk_calismasi (tenant_id, gider_turu_kodu, donem, sira)
  WHERE referans IS NULL;

CREATE INDEX tahakkuk_calismasi_referans_idx
  ON tahakkuk_calismasi (tenant_id, referans);
