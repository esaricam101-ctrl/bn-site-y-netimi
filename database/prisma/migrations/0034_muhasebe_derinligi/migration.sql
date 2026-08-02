-- 0034 · MUHASEBE DERİNLİĞİ (docs/APARTMAN-SITE-AYRIMI.md §2.1)
--
-- Apartman yönetimlerinin tüzel kişiliği ve vergi mükellefiyeti yoktur; çift
-- taraflı bilanço esaslı muhasebe KANUNEN ZORUNLU DEĞİLDİR. Apartmanda
-- hesap planı ve yevmiye fişi bulunmaması bir EKSİKLİK DEĞİL, normal durumdur.
--
-- ⚠️  `Tenant.tip`'TEN TÜRETİLMEZ. Tip yapısal bir olgudur (tek yapı / toplu
--     yapı); derinlik ise POLİTİKA tercihidir. Büyük bir apartman çift
--     taraflı isteyebilir, küçük bir site basit isteyebilir. Tipten
--     türetilseydi ikisi de ifade edilemezdi.
--
--     Politika koda gömülmez — YAPIYA DA GÖMÜLMEZ.
--
-- ⚠️  `Tenant`'ta DEĞİL `MuhasebeParametresi`'nde: alan yalnızca muhasebe
--     bağlamında anlamlıdır ve o tablo zaten "bu proje muhasebeyi nasıl
--     yapıyor" sorusunun tek yeridir.

CREATE TYPE "MuhasebeDerinligi" AS ENUM ('BASIT', 'CIFT_TARAFLI');

ALTER TABLE muhasebe_parametresi
  ADD COLUMN muhasebe_derinligi "MuhasebeDerinligi" NOT NULL DEFAULT 'CIFT_TARAFLI';

COMMENT ON COLUMN muhasebe_parametresi.muhasebe_derinligi IS
  'BASIT: yalnizca kasa+banka, hesap plani/yevmiye/mizan YOK. CIFT_TARAFLI: '
  'hesap plani, yevmiye fisi, mizan, kontrol mutabakati. Kurulumda varsayilan '
  'Tenant.tip''ten gelir (SITE->CIFT_TARAFLI, APARTMAN->BASIT) ama KURAL '
  'degildir; sonradan degistirilebilir. docs/APARTMAN-SITE-AYRIMI.md §2.1';

-- ---------------------------------------------------------------------------
-- VAR OLAN KAYITLAR — DEĞERLERİ DEĞİŞTİRİLMEZ.
--
-- Varsayılan `CIFT_TARAFLI` seçildi çünkü bugüne kadar parametre kaydı açmış
-- her proje zaten hesap planıyla çalışıyordu; `BASIT` yazmak onların muhasebe
-- uçlarını 422'ye çevirir ve çalışan bir kurulumu SESSİZCE bozardı.
--
-- ⚠️  Apartman tipindeki projeler için otomatik `BASIT` ATAMASI YAPILMAZ.
--     Derinlik bir TERCİHTİR; tipten türetmek tam olarak bu migration'ın
--     reddettiği şeydir. Tercihi proje sahibi yapar.
-- ---------------------------------------------------------------------------
