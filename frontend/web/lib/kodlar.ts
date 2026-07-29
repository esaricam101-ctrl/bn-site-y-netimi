/**
 * Enum kod listeleri — arayüz aynası.
 *
 * KAYNAK OTORİTE `shared/apartman-domain` içindeki birlik tipleridir
 * (`BolumNiteligi`, `BolumDurumu`, `DaireTipi`). Web paketi domain paketine
 * bağımlı değildir (ADR v1.1 §40 · paket sınırı); bu yüzden kodlar burada
 * aynalanır — tıpkı `messages/tr.json` içindeki `nitelik_*` anahtarlarının
 * aynalandığı gibi.
 *
 * Aynalamanın bedeli: domain'e yeni bir kod eklenirse buraya da eklenmelidir.
 * Eklenmezse ne olur — kayıt listede DOĞRU görünür (etiketi i18n'den gelir),
 * yalnızca filtre açılır listesinde seçenek çıkmaz. Sessiz veri kaybı değil,
 * görünür bir eksiklik olur.
 *
 * TODO: Kodlar backend'den `GET /kodlar` ile gelmeli; o zaman bu dosya
 * silinir. Bugün böyle bir uç yok ve uydurma uç yazılmaz.
 */

export const NITELIKLER = [
  'MESKEN', 'ISYERI', 'DEPO', 'OTOPARK', 'ORTAK_ALAN',
] as const;

export const DURUMLAR = [
  'AKTIF', 'BOS', 'TADILATTA', 'KULLANIM_DISI',
] as const;

export const DAIRE_TIPLERI = [
  'STUDYO', 'BIR_SIFIR', 'BIR_BIR', 'IKI_BIR', 'UC_BIR',
  'DORT_BIR', 'BES_BIR', 'DUBLEKS', 'DIGER',
] as const;

/* ------------------------- Gider türü eksenleri ------------------------- */
/*
 * Dört BAĞIMSIZ eksen (KMK md. 20 · `shared/apartman-domain/src/gider`):
 *   1. paylaşım kuralı  — gider BÖLÜMLERE nasıl dağıtılır
 *   2. sorumluluk tipi  — borç KİME yazılır
 *   3. kural kaynağı    — kuralı kim koydu
 *   4. malik paylaşımı  — bölümün payı MALİKLER ARASINDA nasıl bölünür
 */

export const PAYLASIM_KURALLARI = [
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'TUKETIM',
  'SABIT_TUTAR', 'KULLANIM_BAZLI', 'BLOK_BAZLI', 'MANUEL', 'KARMA',
] as const;

/**
 * KARMA içinde kullanılamayanlar: KARMA'nın kendisi (özyineleme) ve MANUEL.
 * MANUEL oransal değildir — bölüm bölüm verilen tutarlardır ve bir yüzdenin
 * içine yerleştirilemez.
 */
export const KARMA_BILESEN_KURALLARI = [
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'TUKETIM',
  'SABIT_TUTAR', 'KULLANIM_BAZLI', 'BLOK_BAZLI',
] as const;

export const SORUMLULUK_TIPLERI = ['MALIKE_AIT', 'KULLANANA_AIT', 'SAKINE_AIT'] as const;

export const KURAL_KAYNAKLARI = [
  'KMK_VARSAYILAN', 'YONETIM_PLANI', 'GENEL_KURUL_KARARI',
] as const;

export const MALIK_PAYLASIMLARI = ['ESIT', 'HISSE_ORANI', 'MANUEL'] as const;

/* --------------------------- Daire görevlileri --------------------------- */

export const GOREV_TURLERI = [
  'SITE_MUDURU', 'YONETICI', 'GUVENLIK', 'TEMIZLIK', 'TEKNIK',
  'BAHCIVAN', 'VALE', 'RESEPSIYON', 'HAVUZ_GOREVLISI', 'DIGER',
] as const;

export const GOREVLI_DURUMLARI = ['AKTIF', 'PASIF'] as const;

export const VARDIYALAR = ['GUNDUZ', 'AKSAM', 'GECE', 'TAM_GUN', 'DONUSUMLU'] as const;
