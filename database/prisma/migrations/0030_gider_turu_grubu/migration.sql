-- 0030 · GİDER TÜRÜ GRUBU — karşılıklı dışlayan türler ve çakışma uyarısı
--
-- ⚠️  NEDEN: merkezi ısıtmada iki dağıtım modeli vardır ve ikisi AYNI PROJEDE
--     kullanılmamalıdır:
--       · pay ölçerli site  → ISITMA (dönemsel, tüketim payına göre)
--       · pay ölçersiz site → YAKIT  (olay bazlı, her dolum ayrı gider)
--     İkisi aynı dönemde tahakkuk edilirse ısınma gideri sakinlere İKİ KEZ
--     yansır. Mükerrer tahakkukla aynı sınıf mali hatadır.
--
-- ⚠️  ENGELLEME DEĞİL, UYARI. Geçiş dönemi meşrudur (yıl ortasında pay ölçer
--     takılabilir) ve kısmi pay ölçerli siteler vardır. Bu aslında bir
--     TAHAKKUK ANI kuralı değil, PROJE YAPILANDIRMASI kuralıdır; kalıcı
--     çözüm ısınma modeli ayarıdır (ADR-0014). Katı bir kural bugün meşru
--     kullanımı bloklardı.
--
-- ★ ÇAKIŞMA TANIMI VERİDİR, KODA GÖMÜLÜ DEĞİLDİR.
--
--   Çakışma bir İLİŞKİ değil, bir KÜME ÜYELİĞİDİR: "ısınma gideri şu
--   türlerden BİRİYLE dağıtılır". Bu yüzden ikili bir çakışma tablosu ya da
--   `yerine_gecen_tur` gibi kendine referans KULLANILMADI: ikisi de simetriyi
--   ELLE sürdürmeyi gerektirir. Bir yön yazılıp diğeri unutulursa
--   `ISITMA → YAKIT` uyarır, ters sıra SESSİZCE uyarmaz — bu depoda tekrar
--   tekrar kapatılan hata sınıfının aynısı. Grup üyeliğinde simetri
--   kurgudan gelir, sürdürülmez; üçüncü bir üye eklemek tek satırdır.

CREATE TABLE gider_turu_grubu (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  kod                varchar(40) NOT NULL,
  ad                 varchar(120) NOT NULL,
  -- Uyarının şiddeti ve metni GRUPTAN gelir; motor metin üretmez.
  cakisma_siddeti    varchar(16) NOT NULL DEFAULT 'DIKKAT',
  cakisma_aciklamasi text NOT NULL,
  olusturulma_tarihi timestamptz(6) NOT NULL DEFAULT now(),
  guncelleme_tarihi  timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT gider_turu_grubu_siddet
    CHECK (cakisma_siddeti IN ('BILGI', 'DIKKAT'))
);

CREATE UNIQUE INDEX gider_turu_grubu_kod_uq
  ON gider_turu_grubu (tenant_id, kod);

ALTER TABLE gider_turu ADD COLUMN grup_id uuid REFERENCES gider_turu_grubu(id);

CREATE INDEX gider_turu_grup_idx ON gider_turu (tenant_id, grup_id);

-- --- RLS ------------------------------------------------------------------
ALTER TABLE gider_turu_grubu ENABLE ROW LEVEL SECURITY;
ALTER TABLE gider_turu_grubu FORCE ROW LEVEL SECURITY;

CREATE POLICY gider_turu_grubu_tenant_isolation ON gider_turu_grubu
  USING (tenant_id = app_tenant_id())
  WITH CHECK (tenant_id = app_tenant_id());

-- Satır kapsamı: grup tanımı bir KURAL kaydıdır, bölüm taşımaz ve kişisel
-- veri içermez. Gider türünün kendisi gibi tüm rollere açıktır; kapsam
-- politikası RESTRICTIVE zinciri eksiksiz kalsın diye AÇIKÇA yazılır.
CREATE POLICY gider_turu_grubu_kapsam ON gider_turu_grubu
  AS RESTRICTIVE FOR SELECT
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON gider_turu_grubu TO bnos_app;
