'use client';

/**
 * Form sekmeleri — tek formu bölümlere ayırır, İKİYE BÖLMEZ.
 *
 * ⚠️  TEK FORM, TEK KAYDET. Sekmeler yalnızca hangi bölümün görüneceğini
 *     değiştirir; her sekme kendi "kaydet" düğmesini taşımaz. Varsayılan
 *     kullanım hâlâ TEK EKRANDAN HIZLI KAYITTIR: kullanıcı ilk sekmeyi
 *     doldurup Kaydet'e basabilir.
 *
 * ⚠️  GİZLİ SEKMEDEKİ HATA GÖRÜNMEZ — bu, sekmeli formların asıl tuzağıdır.
 *     Kullanıcı Kaydet'e basar, hiçbir şey olmaz ve nedenini göremez. İki
 *     koruma birlikte uygulanır:
 *       1. Sekme başlığı, o sekmedeki hata sayısını ROZET olarak gösterir.
 *       2. Gönderim başarısızsa çağıran taraf `etkinAnahtar`'ı hatalı ilk
 *          sekmeye çevirir (bkz. `ilkHataliSekme`).
 *
 * ⚠️  PANELLER KALDIRILMAZ, `hidden` ile gizlenir. Ağaçtan çıkarılsaydı
 *     sekme değiştikçe alanların DOM durumu (odak, seçim) sıfırlanırdı.
 *     Değerler zaten çağıranın state'inde tutulur.
 *
 * ⚠️  GİZLİ ALANDA `required` KULLANILMAZ. Tarayıcı gizli bir zorunlu alanı
 *     odaklayamaz ve gönderimi "An invalid form control is not focusable"
 *     ile sessizce durdurur. Zorunluluk bizim doğrulamamızla uygulanır.
 */
import { useId, useRef, type ReactNode } from 'react';

// Hata yönlendirme mantığı `lib/sekme-hata.ts` içindedir: JSX taşıyan bir
// modül `node --test` ile içe alınamaz ve o iki fonksiyon test edilmeliydi.
// Buradan yeniden dışa verilir; çağıranlar tek yerden içe alır.
export { ilkHataliSekme, sekmeHataSayisi } from '@/lib/sekme-hata';

export interface SekmeTanimi {
  readonly anahtar: string;
  readonly etiket: string;
  /** Bu sekmeye ait doğrulama hatası sayısı — başlıkta rozet olur. */
  readonly hataSayisi?: number;
  readonly icerik: ReactNode;
}

export function Sekmeler({
  sekmeler, etkinAnahtar, onDegisti, etiket,
}: {
  readonly sekmeler: readonly SekmeTanimi[];
  readonly etkinAnahtar: string;
  readonly onDegisti: (anahtar: string) => void;
  /** `aria-label` — birden çok sekme grubu varsa ayırt edilebilmeli. */
  readonly etiket: string;
}) {
  const temelId = useId();
  const dugmeler = useRef<Map<string, HTMLButtonElement>>(new Map());

  const sekmeId = (a: string) => `${temelId}-sekme-${a}`;
  const panelId = (a: string) => `${temelId}-panel-${a}`;

  /**
   * Klavye gezinmesi (WAI-ARIA tabs deseni): oklar sekme değiştirir,
   * Home/End uçlara gider. Yalnızca fareyle gezilebilen sekme, klavye
   * kullanıcısını formun bir bölümüne hiç ulaştırmaz.
   */
  const tusaBas = (e: React.KeyboardEvent, indeks: number) => {
    const son = sekmeler.length - 1;
    let hedef: number | null = null;
    if (e.key === 'ArrowRight') hedef = indeks === son ? 0 : indeks + 1;
    else if (e.key === 'ArrowLeft') hedef = indeks === 0 ? son : indeks - 1;
    else if (e.key === 'Home') hedef = 0;
    else if (e.key === 'End') hedef = son;
    if (hedef === null) return;

    e.preventDefault();
    const anahtar = sekmeler[hedef]?.anahtar;
    if (anahtar === undefined) return;
    onDegisti(anahtar);
    dugmeler.current.get(anahtar)?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={etiket}
           className="flex flex-wrap gap-1 border-b border-[color:var(--line)]">
        {sekmeler.map((s, i) => {
          const etkin = s.anahtar === etkinAnahtar;
          const hata = s.hataSayisi ?? 0;
          return (
            <button
              key={s.anahtar}
              ref={(el) => {
                if (el) dugmeler.current.set(s.anahtar, el);
                else dugmeler.current.delete(s.anahtar);
              }}
              type="button"
              role="tab"
              id={sekmeId(s.anahtar)}
              aria-selected={etkin}
              aria-controls={panelId(s.anahtar)}
              // Etkin olmayan sekme sekme sırasından ÇIKARILIR: WAI-ARIA
              // deseninde sekme listesi tek durak, içinde oklarla gezilir.
              tabIndex={etkin ? 0 : -1}
              onClick={() => onDegisti(s.anahtar)}
              onKeyDown={(e) => tusaBas(e, i)}
              className="px-3 py-2 text-sm rounded-t-[var(--rs)] border-b-2 flex items-center gap-2"
              // Yeni renk TANIMLANMAZ; dondurulmuş token setinden okunur.
              style={{
                borderBottomColor: etkin ? 'var(--primary)' : 'transparent',
                color: etkin ? 'var(--text)' : 'var(--muted-2)',
                fontWeight: etkin ? 600 : 400,
              }}
            >
              {s.etiket}
              {hata > 0 && (
                // Rozet, gizli sekmedeki hatayı GÖRÜNÜR kılar. `aria-label`
                // ekran okuyucuya sayının ne olduğunu söyler; çıplak sayı
                // "3" olarak okunur ve anlamsızdır.
                <span
                  aria-label={`${hata} hata`}
                  className="num text-xs px-1.5 rounded-full"
                  style={{ background: 'var(--crit)', color: '#fff' }}
                >
                  {hata}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sekmeler.map((s) => (
        <div
          key={s.anahtar}
          role="tabpanel"
          id={panelId(s.anahtar)}
          aria-labelledby={sekmeId(s.anahtar)}
          hidden={s.anahtar !== etkinAnahtar}
          className="flex flex-col gap-3"
        >
          {s.icerik}
        </div>
      ))}
    </div>
  );
}
