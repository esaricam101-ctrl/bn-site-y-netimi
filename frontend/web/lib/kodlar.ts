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
