-- ===========================================================================
-- BNOS Apartman Yönetimi — 0013_arac_kapsami
--
-- ARAÇ KİME KAYITLI:
--   · Malik · kiracı · sakin aracı → İLGİLİ BAĞIMSIZ BÖLÜME.
--   · Daire görevlisi aracı        → hizmet verdiği BAĞIMSIZ BÖLÜME.
--   · Misafir aracı                → ziyaret ettiği BAĞIMSIZ BÖLÜME.
--   · Site personeli aracı         → **YÖNETİME**, bir daireye değil.
--
-- 0011'de `bolum_id` NOT NULL kaldığı için site personelinin aracı zorunlu
-- olarak bir daireye yazılıyordu. Bu YANLIŞTI: güvenlik görevlisinin aracını
-- 12 numaraya yazmak, o dairenin otopark hakkını tüketmiş gösterir ve
-- KULLANIM_BAZLI dağıtımda o daireye fazla pay çıkarır.
--
-- Çözüm: `bolum_id` isteğe bağlı olur ve KAPSAM KISITI eklenir —
--   personel aracı  ⇒ bolum_id BOŞ  (yönetim kapsamı)
--   diğer sahipler  ⇒ bolum_id DOLU (bölüm kapsamı)
--
-- İki alanı da serbest bırakmak, kapsamı belirsiz araç kayıtları üretirdi:
-- otopark sayımı "bu araç hangi hakka sayılacak?" sorusunu cevaplayamazdı.
-- ===========================================================================

ALTER TABLE arac ALTER COLUMN bolum_id DROP NOT NULL;

ALTER TABLE arac ADD CONSTRAINT arac_kapsam
  CHECK (
    (personel_id IS NOT NULL AND bolum_id IS NULL)
    OR (personel_id IS NULL AND bolum_id IS NOT NULL)
  );

-- Yönetim kapsamındaki araçlar — personel otoparkı listesi. Kısmî index:
-- kayıtların büyük çoğunluğu bölüm kapsamındadır ve bu listede hiç okunmaz.
CREATE INDEX arac_tenant_id_yonetim_idx
  ON arac (tenant_id, plaka) WHERE bolum_id IS NULL;
