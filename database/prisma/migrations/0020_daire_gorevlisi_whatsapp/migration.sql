-- ===========================================================================
-- BNOS Apartman Yönetimi — 0020_daire_gorevlisi_whatsapp
--
-- 0019 WhatsApp numarasını yalnızca `kisi` tablosuna ekledi. Ama DAİRE
-- GÖREVLİSİ BİR `Kisi` DEĞİLDİR (0010): kendi `ad` · `soyad` · `telefon`
-- alanlarını taşır ve `kisi` tablosuna bağlı değildir — yalnızca İŞVEREN'i
-- bir kişidir.
--
-- Kullanıcı "Malik, Kiracı, Sakin ve Daire Görevlisi kartlarında WhatsApp
-- Numarası bulunsun" dedi. İlk üçü `Kisi` üzerinden karşılanır; dördüncüsü
-- KENDİ ALANINI ister.
--
-- ⚠️  BU EKSİKLİK ŞEMA ile VERİTABANI ARASINDA SESSİZ BİR AYRIŞMA olarak
--     yakalandı: Prisma modeline alan eklenmiş ama migration'a eklenmemişti.
--     Böyle bir sapma derleme hatası vermez; yalnızca o alan ilk kez
--     okunduğunda çalışma zamanında patlar.
-- ===========================================================================

ALTER TABLE "daire_gorevlisi" ADD COLUMN "whatsapp_no" VARCHAR(24);
