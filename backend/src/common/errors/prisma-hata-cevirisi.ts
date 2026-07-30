/**
 * Prisma / PostgreSQL kısıt ihlallerini ANLAŞILIR HTTP hatasına çevirir.
 *
 * ⚠️  BU KATMAN YOKTU ve eksikliği her modülü etkiliyordu: veritabanı düzeyinde
 *     yakalanan HER kural ihlali istemciye **500 "beklenmeyen bir sorun oluştu"**
 *     olarak dönüyordu. Yani şemadaki bütün korumalar (kısmî unique index'ler,
 *     CHECK kısıtları, yabancı anahtarlar) kullanıcıya "sistem bozuldu" gibi
 *     görünüyordu; oysa hepsi kullanıcının düzeltebileceği kural ihlalleridir.
 *
 *     İlk kez `banka_eft_kodu_uq` ile görüldü: aynı EFT kodunu ikinci kez girmek
 *     500 döndürdü. Tek modüle özel bir ön kontrol yazmak bu sınıfı çözmez —
 *     depoda 20'den fazla kısmî unique index ve 30'dan fazla CHECK var; her biri
 *     için ön kontrol yazmak hem tekrar hem de YARIŞ DURUMUNA açıktır (kontrol
 *     ile yazma arasında başka bir istek araya girebilir). Doğru yer burasıdır:
 *     veritabanı kuralı zorlar, bu katman çevirir.
 *
 * ⚠️  KISMÎ UNIQUE INDEX'TE PRISMA ALAN ADI VERMEZ. `meta.target` "(not
 *     available)" olur çünkü index'ler elle yazılmıştır (BFS v1 §5.3 kural 1:
 *     `WHERE silinme_tarihi IS NULL`). Bu yüzden kısıt adı ÖNCE ham PostgreSQL
 *     mesajından okunur; bulunamazsa dürüst bir genel mesaj döner. Var olmayan
 *     bir alan adı UYDURULMAZ.
 */
import { Prisma } from '@prisma/client';
import { CakismaHatasi, IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';

/**
 * Kısıt adı → kullanıcı diline çeviri.
 *
 * Liste VERİ olarak burada durur (§33 kural 3). Eksik bir kayıt hatayı
 * gizlemez: kısıt adı ham hâliyle mesaja girer, yalnızca daha teknik görünür.
 */
const KISIT_ACIKLAMALARI: ReadonlyMap<string, { mesaj: string; eylem: string }> =
  new Map([
    // --- Banka (0016) ---
    ['banka_eft_kodu_uq', {
      mesaj: 'Bu EFT kodu bu tenant\'ta başka bir bankada tanımlı.',
      eylem: 'Aynı banka iki kez tanımlanamaz; mevcut kaydı kullanın.',
    }],
    ['banka_subesi_kodu_uq', {
      mesaj: 'Bu şube kodu aynı bankada zaten tanımlı.',
      eylem: 'Şube kodunu düzeltin ya da mevcut şubeyi kullanın.',
    }],
    ['banka_hesabi_iban_uq', {
      mesaj: 'Bu IBAN başka bir banka hesabında kayıtlı.',
      eylem: 'Aynı IBAN iki hesapta olursa mutabakat hangi hesaba yazacağını ' +
        'bilemez. Mevcut hesabı kullanın.',
    }],
    ['kiymetli_evrak_no_uq', {
      mesaj: 'Bu evrak numarası aynı borçlu için zaten kayıtlı.',
      eylem: 'Mükerrer çek/senet kaydı alacağı iki kez sayar. Mevcut kaydı ' +
        'kontrol edin.',
    }],
    ['ekstre_satiri_eslesen_hareket_uq', {
      mesaj: 'Bu banka hareketi başka bir ekstre satırıyla zaten eşleşmiş.',
      eylem: 'Aynı hareket iki satırla eşleşirse aynı para iki kez mutabık ' +
        'sayılır. Önce mevcut eşleşmeyi kaldırın.',
    }],
    ['banka_hareketi_tutar_pozitif', {
      mesaj: 'Hareket tutarı sıfırdan büyük olmalıdır.',
      eylem: 'Çıkış kaydı negatif tutarla değil yön alanıyla yazılır.',
    }],
    ['banka_hareketi_valor_sirasi', {
      mesaj: 'Valör tarihi işlem tarihinden önce olamaz.',
      eylem: 'Valör, paranın hesaba geçtiği gündür.',
    }],
    ['ekstre_satiri_fark_gerekce', {
      mesaj: 'Fark kabulü için gerekçe zorunludur.',
      eylem: 'Gerekçesi yazılmayan bir fark denetimde açıklanamaz.',
    }],
    ['ekstre_satiri_eslesti_tutarlilik', {
      mesaj: 'Eşleşmiş satır bir banka hareketine bağlanmak zorundadır.',
      eylem: 'Hareketsiz "eşleşti" işareti mutabakatı yalancı biçimde ' +
        'tamamlanmış gösterir.',
    }],
    ['kiymetli_evrak_tahsil_tutarlilik', {
      mesaj: 'Tahsil edilen evrak için hesap ve tahsil tarihi zorunludur.',
      eylem: 'Hangi hesaba ne zaman girdiği bilinmeyen bir tahsilat mutabık ' +
        'edilemez.',
    }],
    ['kiymetli_evrak_olumsuz_gerekce', {
      mesaj: 'Karşılıksız / iade durumu için gerekçe zorunludur.',
      eylem: 'Evrağın neden öyle işaretlendiği sonradan sorulabilir olmalıdır.',
    }],
    ['kiymetli_evrak_vade_sirasi', {
      mesaj: 'Vade tarihi alış tarihinden önce olamaz.',
      eylem: 'Geçmiş vadeli bir evrak portföye alınamaz.',
    }],
    // --- Muhasebe ---
    ['hesap_kod_uq', {
      mesaj: 'Bu hesap kodu zaten kullanılıyor.',
      eylem: 'Hesap planında kod tekildir; başka bir kod seçin.',
    }],
    // --- Kişi ve bölüm ---
    ['kisi_eposta_uq', {
      mesaj: 'Bu e-posta adresi başka bir kişide kayıtlı.',
      eylem: 'Mevcut kişiyi seçin ya da farklı bir e-posta girin.',
    }],
  ]);

/** PostgreSQL kısıt adını ham hata metninden okur. */
function kisitAdi(mesaj: string): string | null {
  // Postgres: `duplicate key value violates unique constraint "banka_eft_kodu_uq"`
  // ve `new row ... violates check constraint "banka_hareketi_tutar_pozitif"`
  const m = /violates (?:unique|check|foreign key) constraint "([a-z_0-9]+)"/iu.exec(mesaj)
    ?? /constraint "([a-z_0-9]+)"/iu.exec(mesaj)
    ?? /Unique constraint failed on the fields: \(`?([a-z_0-9,` ]+)`?\)/iu.exec(mesaj);
  return m?.[1] ?? null;
}

function hedefAlanlar(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return null;
  const hedef = (meta as { target?: unknown }).target;
  if (typeof hedef === 'string') {
    // Kısmî index'lerde Prisma bu değeri "(not available)" yazar; ALAN ADI
    // UYDURMAMAK için böyle bir değeri yok sayarız.
    return hedef.includes('not available') ? null : hedef;
  }
  if (Array.isArray(hedef)) {
    const alanlar = hedef.filter((h): h is string => typeof h === 'string');
    return alanlar.length > 0 ? alanlar.join(', ') : null;
  }
  return null;
}

/**
 * Prisma hatasını domain hatasına çevirir. Çevrilemiyorsa `null` döner ve
 * çağıran (istisna filtresi) 500'e düşer — SESSİZCE 4xx uydurulmaz.
 */
export function prismaHatasiniCevir(hata: unknown): Error | null {
  const ham = hata instanceof Error ? hata.message : '';
  const ad = kisitAdi(ham);
  const aciklama = ad === null ? undefined : KISIT_ACIKLAMALARI.get(ad);

  if (hata instanceof Prisma.PrismaClientKnownRequestError) {
    switch (hata.code) {
      case 'P2002': {
        // TEKİLLİK İHLALİ → 409. 500 değil: kullanıcının düzeltebileceği bir
        // durumdur ve istemci "zaten var" ile "sistem bozuk" arasında ayrım
        // yapmak zorundadır.
        if (aciklama) return new CakismaHatasi(aciklama.mesaj, aciklama.eylem);
        const alanlar = hedefAlanlar(hata.meta);
        if (alanlar !== null) {
          return new CakismaHatasi(
            `Bu değer zaten kayıtlı (${alanlar}).`,
            'Mevcut kaydı kullanın ya da değeri değiştirin.',
          );
        }
        return new CakismaHatasi(
          ad === null
            ? 'Aynı kayıt zaten var (tekillik kuralı).'
            : `Aynı kayıt zaten var (kural: ${ad}).`,
          'Mevcut kaydı kullanın ya da girdiğiniz değerlerden birini değiştirin.',
        );
      }
      case 'P2003':
        // YABANCI ANAHTAR → 422. Var olmayan bir kayda referans verilmiş ya da
        // bağımlı kaydı olan bir satır silinmeye çalışılmış.
        return new IsKuraliIhlali(
          'İlişkili kayıt bulunamadı ya da bu kayda bağlı başka kayıtlar var.',
          'Bağlantılı kayıtları kontrol edin.',
        );
      case 'P2025':
        return new KayitBulunamadi('İşlem yapılacak kayıt bulunamadı.');
      case 'P2000':
        return new IsKuraliIhlali(
          'Girilen değer alan için çok uzun.',
          'Daha kısa bir değer girin.',
        );
      default:
        return null;
    }
  }

  /*
   * CHECK KISITLARI Prisma'da tipli hata DEĞİLDİR: sürücü ham PostgreSQL
   * mesajını `PrismaClientUnknownRequestError` içinde taşır. Yalnızca tipli
   * hatalar çevrilseydi şemadaki bütün CHECK korumaları (banka hareketi
   * tutarı, virman bacakları, araç sahipliği, ekstre tutarlılığı…) 500 dönmeye
   * devam ederdi.
   */
  if (/violates check constraint/iu.test(ham)) {
    if (aciklama) return new IsKuraliIhlali(aciklama.mesaj, aciklama.eylem);
    return new IsKuraliIhlali(
      ad === null
        ? 'Veri bütünlüğü kuralı ihlal edildi.'
        : `Veri bütünlüğü kuralı ihlal edildi (kural: ${ad}).`,
      'Girdiğiniz değerleri kontrol edin.',
    );
  }

  if (/violates unique constraint/iu.test(ham)) {
    if (aciklama) return new CakismaHatasi(aciklama.mesaj, aciklama.eylem);
    return new CakismaHatasi(
      ad === null
        ? 'Aynı kayıt zaten var (tekillik kuralı).'
        : `Aynı kayıt zaten var (kural: ${ad}).`,
      'Mevcut kaydı kullanın ya da girdiğiniz değerlerden birini değiştirin.',
    );
  }

  return null;
}
