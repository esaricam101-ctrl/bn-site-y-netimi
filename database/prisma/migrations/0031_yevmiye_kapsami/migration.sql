-- 0031 · YEVMİYE KAPSAMI — muhasebe defteri sakin sınıfı rollere kapalı
--
-- ⚠️  AÇIK ÖLÇÜLDÜ (CT-18). `yevmiye_fisi` ve `yevmiye_satiri` yalnızca TENANT
--     izolasyonu taşıyordu; satır kapsamı (ADR-0011) politikası YOKTU ve
--     muafiyet listesinde de değillerdi. Kısıtlı kapsamla koşulan sorgu
--     KOMŞU hanenin borç satırını okuyabiliyordu:
--
--       × KISITLI kapsamda YEVMİYE FİŞİ GÖRÜNMEZ         → expected 1 to be 0
--       × KISITLI kapsamda KOMŞU hanenin satırı GÖRÜNMEZ → got 1
--       × KISITLI kapsamda HİÇBİR yevmiye satırı görünmez → expected 2 to be 0
--
--     Aynı bağlamda `bagimsiz_bolum` DOĞRU süzülüyordu (kendi hane 1, komşu 0):
--     yani kapsam mekanizması çalışıyor, yevmiyeye UYGULANMAMIŞTI.
--
-- ⚠️  KORUMA BUGÜNE KADAR İZİN KATMANINDAYDI. `FINANS_YEVMIYE_GIRIS` izni
--     sakin sınıfı rollerde yok, bu yüzden sızıntı görünmüyordu. Ama bu,
--     verinin korunduğu anlamına gelmez: bir uç yanlışlıkla daha gevşek bir
--     izinle açılırsa defterin TAMAMI sızar. ADR-0002'nin gerekçesi burada da
--     geçerlidir — değeri uygulama koyar, kuralı veritabanı zorlar.

-- ⚠️⚠️  BİLİNÇLİ TUTARSIZLIK — "HİZALAMAYIN", AÇIK GERİ GELİR.
--
--     Bu iki politika `FOR ALL`; depodaki DİĞER 15 kapsam politikası (0022,
--     0023, 0025) `FOR SELECT`'tir. Yani bugün kısıtlı kapsamdaki bir rol
--     başka daireye ait bir `borc` satırını OKUYAMAZ ama teorik olarak
--     YAZABİLİR — o yol yalnızca Kapı 3 ile kapalıdır.
--
--     Bu fark bir gözden kaçma DEĞİL, ölçülmemiş etki alanı yüzünden
--     ertelenmiş bir iştir: 15 politikanın her biri için "meşru yazma yolu
--     hangi kapsamda koşuyor" ayrı ayrı ölçülmelidir (bu migration'da
--     yevmiye için yapıldı — CT-18'de negatif VE pozitif test var).
--
--     ⛔ Bu dosyayı "tutarlılık" gerekçesiyle `FOR SELECT`'e çevirmeyin.
--        Doğru yön TERSİDİR: ötekiler `FOR ALL`'a taşınacak. Yol
--        haritasında P1 olarak kayıtlıdır.

-- --- FİŞ ---------------------------------------------------------------
--
-- ⚠️  `FOR SELECT` DEĞİL `FOR ALL`. Aynı gerekçe yazmaya da uygulanır:
--     kısıtlı kapsamdaki bir rol, izin katmanı yanılırsa deftere KAYIT
--     ATABİLMEMELİDİR. Yazma yolu bugün Kapı 3 ile korunuyor ama koruma
--     yine izin katmanında kalırdı.
--
--     Meşru yazma yollarının hepsi kapsamı SERBEST bağlamda koşar:
--       · yönetim rolleri  → `tenantIslemi` `app.kapsam_kisi_id`'yi BOŞ yazar
--       · sistem işleri    → `sistemIslemi` ayarı hiç yazmaz (NULL)
--     `app_kapsam_serbest()` ikisinde de TRUE döner (0022: `v IS NULL OR v = ''`),
--     dolayısıyla bu politika meşru hiçbir yazmayı engellemez.
--
-- ⚠️  NEDEN `bolum_id IN (...)` DEĞİL. Yevmiye satırının `bolum_id`'si BOŞ
--     OLABİLİR (kasa/banka bacağı daireye bağlı değildir) — `borc`'ta bu durum
--     yoktur, orada `bolum_id` her zaman doludur. `IN` ile yazılsaydı NULL
--     karşılaştırması NULL döner, satır gizlenirdi; sonuç doğru ama SEBEBİ
--     tesadüfî olurdu ve biri `IS NULL OR` ekleyerek "düzeltmeye" kalkardı.
--
--     Asıl gerekçe kurgusaldır: muhasebe defteri PROJE seviyesinde bir
--     kayıttır ve sakin sınıfı roller kendi borcunu `borc` üzerinden görür
--     (`borc_kapsam`). Defterin kendisine erişimleri yoktur — ne satır
--     satır, ne kısmen. Bu yüzden kural tek koşuldur.
ALTER TABLE yevmiye_fisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_fisi FORCE ROW LEVEL SECURITY;

CREATE POLICY yevmiye_fisi_kapsam ON yevmiye_fisi
  AS RESTRICTIVE FOR ALL
  USING (app_kapsam_serbest())
  WITH CHECK (app_kapsam_serbest());

-- --- SATIR -------------------------------------------------------------
ALTER TABLE yevmiye_satiri ENABLE ROW LEVEL SECURITY;
ALTER TABLE yevmiye_satiri FORCE ROW LEVEL SECURITY;

CREATE POLICY yevmiye_satiri_kapsam ON yevmiye_satiri
  AS RESTRICTIVE FOR ALL
  USING (app_kapsam_serbest())
  WITH CHECK (app_kapsam_serbest());
