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
}

export interface SiralamaDurumu {
  readonly anahtar: string;
  readonly yon: SiralamaYonu;
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
