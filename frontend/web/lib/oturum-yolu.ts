/**
 * OTURUM YÖNLENDİRME KARARLARI — saf fonksiyonlar, yan etki yok.
 *
 * ⚠️  NEDEN AYRI DOSYA: `api.ts` içinde `class ApiHatasi` bir TypeScript
 *     *parametre özelliği* kullanıyor (`constructor(readonly problem: …)`)
 *     ve Node'un tip-soyma kipi bunu ayrıştıramıyor. Birim testleri `.mjs`
 *     olduğu ve `.ts` dosyasını doğrudan içe aldığı için `api.ts` test
 *     edilemez hâlde. Kararlar buraya alındı; **davranış değil, konum**
 *     değişti.
 *
 *     (Yol haritasındaki *".mjs testinden .ts import"* kırılganlığı bu
 *     dosyada tetiklenmiyor: burada sınıf ya da dekoratör yok.)
 */

/**
 * 401 alındığında giriş sayfasına yönlendirilmeli mi?
 *
 * ⚠️  GİRİŞ UCU MUAF ve bu ÖLÇÜLDÜ: `POST /oturum/giris` yanlış şifrede
 *     **401** döner (çok kısa şifre 400 verir — o doğrulama hatasıdır).
 *     Muafiyet olmasaydı her yanlış şifre denemesi sayfayı yeniler ve
 *     kullanıcı "E-posta veya şifre hatalı" mesajını HİÇ göremezdi.
 *
 * ⚠️  Zaten `/giris`teysek yönlendirme yok — sonsuz döngü olurdu.
 */
export function oturumYonlendirmesiGerekliMi(
  istekYolu: string, suankiSayfa: string,
): boolean {
  if (istekYolu.startsWith('/oturum/')) return false;
  if (suankiSayfa.startsWith('/giris')) return false;
  return true;
}

/**
 * Giriş sonrası dönülecek yol güvenli mi?
 *
 * ⚠️  AÇIK YÖNLENDİRME (open redirect) KORUMASI. `?donus=` değeri adres
 *     çubuğundan gelir; doğrudan kullanılsaydı saldırgan kullanıcıyı giriş
 *     sonrası kendi kopya sayfasına atabilirdi.
 *
 *     `//baska-site` biçimi tarayıcıda **dış adrestir**; yalnızca "`/` ile
 *     başlıyor mu" diye bakan bir kontrol bunu KAÇIRIR.
 */
export function donusYoluGuvenliMi(donus: string | null): donus is string {
  if (donus === null || donus === '') return false;
  return donus.startsWith('/') && !donus.startsWith('//');
}
