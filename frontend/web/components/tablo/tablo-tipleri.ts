/**
 * Veri tablosu sözleşmesi.
 *
 * Kolon tanımı VERİDİR: hangi kolonların görüneceği, sırası ve genişliği
 * kullanıcı tercihidir ve kaydedilir. Bu yüzden kolon bilgisi JSX içinde
 * değil, serileştirilebilir bir nesnede tutulur.
 */
import type { ReactNode } from 'react';

export type SiralamaYonu = 'artan' | 'azalan';

export interface Kolon<T> {
  /** Kolonun kalıcı kimliği. Görünüm profillerinde bu değer saklanır. */
  readonly anahtar: string;
  /** Başlık — i18n anahtarı DEĞİL, çözülmüş metin (CT-05 çağıranda uygulanır). */
  readonly baslik: string;
  /** Hücre içeriği. Verilmezse `ham` sonucu metin olarak basılır. */
  readonly hucre?: (satir: T) => ReactNode;
  /**
   * Sıralama ve dışa aktarım için ham değer.
   * `hucre` görsel, `ham` veridir; Excel'e rozet değil değer gider.
   */
  readonly ham: (satir: T) => string | number | boolean | null;
  readonly siralanabilir?: boolean;
  /** Piksel. Kullanıcı sürükleyerek değiştirebilir. */
  readonly genislik?: number;
  readonly hizalama?: 'sol' | 'sag';
  /** Varsayılan olarak gizli başlar; kullanıcı açabilir. */
  readonly varsayilanGizli?: boolean;
  /**
   * Gelişmiş filtrede hangi işleçlerin sunulacağını belirler.
   * Verilmezse `metin` varsayılır — her kolon en azından "içerir" ile
   * süzülebilir.
   */
  readonly filtreTipi?: FiltreVeriTipi;
  /**
   * `filtreTipi: 'secim'` için seçenek listesi. Serbest metin yerine açılır
   * liste sunulur; kullanıcı "KIRACI" yerine "kiraci" yazıp boş sonuç almaz.
   */
  readonly secenekler?: readonly FiltreSecenegi[];
  /** Filtre panelinde hiç görünmez (örn. eylem düğmeleri kolonu). */
  readonly filtrelenebilir?: boolean;
}

export interface SiralamaDurumu {
  readonly anahtar: string;
  readonly yon: SiralamaYonu;
}

/* ------------------------- Gelişmiş filtreleme ------------------------- */

/**
 * Filtre veri tipi — hangi işleçlerin anlamlı olduğunu belirler.
 *
 * `tarih` ayrı bir tiptir çünkü tarihler `YYYY-MM-DD` biçiminde tutulur ve
 * bu biçim sözlük sırasında da doğru sıralanır; metin olarak "içerir"
 * aramak ise kullanıcıya yanlış sonuç verir (`2026-01` ayı aramak istediğini
 * sanır, `-01` günü de gelir).
 */
export type FiltreVeriTipi = 'metin' | 'sayi' | 'tarih' | 'secim' | 'mantik';

export type FiltreOperatoru =
  | 'icerir'
  | 'icermez'
  | 'esittir'
  | 'esitDegildir'
  | 'baslar'
  | 'buyuk'
  | 'kucuk'
  | 'aralik'
  | 'bos'
  | 'dolu';

/**
 * Açılır listede sunulan seçenek.
 *
 * `deger` ham kod (`AKTIF`), `etiket` kullanıcıya görünen metindir (`Aktif`).
 * İkisi ayrıdır çünkü süzme HAM değer üzerinde yapılır — kullanıcıya kod
 * göstermek ise ekranın geri kalanıyla çelişir.
 */
export interface FiltreSecenegi {
  readonly deger: string;
  readonly etiket: string;
}

/** Kullanıcının kurduğu tek bir süzme koşulu. */
export interface FiltreKosulu {
  /** Hangi kolon — `Kolon.anahtar`. */
  readonly anahtar: string;
  readonly operator: FiltreOperatoru;
  readonly deger: string;
  /** Yalnızca `aralik` işlecinde kullanılır (üst sınır). */
  readonly deger2?: string;
}

/** Koşullar arası bağlaç. Karışık öncelik yok: tümü VE ya da tümü VEYA. */
export type FiltreBaglaci = 'VE' | 'VEYA';

/**
 * Adlandırılmış, yeniden kullanılabilir filtre.
 *
 * Kullanıcı "borçlu kiracılar"ı bir kez kurar, adlandırır ve her ay tek
 * tıkla açar. Görünüm profilinden (`GorunumProfili`) AYRIDIR: profil neyin
 * nasıl *gösterileceğini*, filtre neyin *listeleneceğini* saklar. Aynı
 * görünüm farklı filtrelerle kullanılır.
 */
export interface KayitliFiltre {
  readonly ad: string;
  readonly baglac: FiltreBaglaci;
  readonly kosullar: readonly FiltreKosulu[];
}

/**
 * Kaydedilebilir görünüm profili.
 *
 * Kolon sırası, genişlikleri, gizlenenler ve sıralama birlikte saklanır —
 * kullanıcı "borçlu daireler" görünümünü bir kez kurup adlandırır.
 */
export interface GorunumProfili {
  readonly ad: string;
  readonly kolonSirasi: readonly string[];
  readonly gizli: readonly string[];
  readonly genislikler: Readonly<Record<string, number>>;
  /** Çoklu sıralama: dizideki sıra öncelik sırasıdır. */
  readonly siralama: readonly SiralamaDurumu[];
}
