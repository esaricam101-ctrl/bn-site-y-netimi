-- ===========================================================================
-- BNOS Apartman Yönetimi — 0002_oturum_dizini
--
-- SORUN: Giriş, tenant'ı BİLMEDEN kullanıcıyı bulmak zorundadır. `kullanici`
-- tablosu RLS taşır ve `app_tenant_id()` bağlam yoksa exception atar; uygulama
-- rolü NOBYPASSRLS'tir (ADR-0002). Sonuç: giriş sorgusu HİÇBİR ZAMAN
-- çalışamazdı — `POST /oturum/giris` her çağrıda 500 dönüyordu.
--
-- Kodda "sistem işlemi olarak çalışır" yazıyordu; `sistemIslemi` RLS'i
-- ATLAMAZ, yalnızca tenant bağlamı KURMAZ. İki şey karıştırılmıştı.
--
-- ÇÖZÜM: tenant çözümlemesi için RLS taşımayan bir dizin katalogu.
-- `tenant` tablosuyla aynı gerekçeli istisnadır (BFS v1 §2.4): tenant
-- seçiminden ÖNCE okunur, bu yüzden tenant'a göre süzülemez.
--
-- REDDEDİLEN ALTERNATİFLER:
--   - BYPASSRLS'li rol: o rol ele geçirildiğinde izolasyon tümüyle kalkar.
--   - SECURITY DEFINER fonksiyon: tabloların sahibi `bnos_migrator`'dır ve
--     `FORCE ROW LEVEL SECURITY` sahibi de politikaya tabi kılar; fonksiyon
--     yine engellenirdi.
--   - Girişte tüm tenant'ları dolaşmak: 10 000 tenant'ta her giriş denemesi
--     10 000 sorgu demektir.
--
-- DİZİNDE PAROLA YOKTUR. Yalnızca e-posta → tenant eşlemesi tutulur; parola
-- doğrulaması tenant bağlamı kurulduktan SONRA `kullanici` üzerinde yapılır.
-- ===========================================================================

CREATE TABLE oturum_dizini (
  kullanici_id uuid PRIMARY KEY,
  eposta       varchar(180) NOT NULL,
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- E-posta SİSTEM GENELİNDE tekildir. Tenant içinde tekil olsaydı aynı e-posta
-- iki apartmanda kayıtlı olabilir ve giriş hangi tenant'a ait olduğunu
-- belirleyemezdi — kullanıcı rastgele birine düşerdi.
CREATE UNIQUE INDEX oturum_dizini_eposta_uq ON oturum_dizini (lower(eposta));
CREATE INDEX oturum_dizini_tenant_idx ON oturum_dizini (tenant_id);

-- ---------------------------------------------------------------------------
-- Senkron TRIGGER ile tutulur, uygulama koduyla DEĞİL.
--
-- Uygulama katmanında tutulsaydı: yeni bir kullanıcı oluşturma yolu eklendiğinde
-- dizine yazmayı unutmak mümkün olurdu ve o kullanıcı SESSİZCE giriş yapamazdı.
-- Trigger, tohum verisi dahil her yazma yolunda çalışır.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION oturum_dizini_esitle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM oturum_dizini WHERE kullanici_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Pasif ve silinmiş kullanıcı dizinden ÇIKARILIR: giriş denemesi tenant
  -- çözümlemesinde durur, parola doğrulamasına hiç ulaşmaz.
  IF NEW.aktif = false OR NEW.silindi_mi = true THEN
    DELETE FROM oturum_dizini WHERE kullanici_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO oturum_dizini (kullanici_id, eposta, tenant_id)
  VALUES (NEW.id, NEW.eposta, NEW.tenant_id)
  ON CONFLICT (kullanici_id)
  DO UPDATE SET eposta = EXCLUDED.eposta, tenant_id = EXCLUDED.tenant_id;

  RETURN NEW;
END $$;

CREATE TRIGGER kullanici_oturum_dizini
  AFTER INSERT OR UPDATE OR DELETE ON kullanici
  FOR EACH ROW EXECUTE FUNCTION oturum_dizini_esitle();

-- Mevcut kullanıcılar dizine alınır (tohum verisi migration'dan önce
-- yüklenmiş olabilir).
--
-- TENANT DÖNGÜSÜ ZORUNLUDUR: `kullanici` üzerinde `FORCE ROW LEVEL SECURITY`
-- vardır ve migration rolü de politikaya tabidir — düz bir SELECT
-- "Tenant baglami kurulmadan sorgu calistirilamaz" ile düşer. Bu, RLS'in
-- sahibi bile olsanız çalıştığının kanıtıdır.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM tenant LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    INSERT INTO oturum_dizini (kullanici_id, eposta, tenant_id)
    SELECT id, eposta, tenant_id FROM kullanici
    WHERE aktif = true AND silindi_mi = false
    ON CONFLICT (kullanici_id) DO NOTHING;
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON oturum_dizini TO bnos_app;
