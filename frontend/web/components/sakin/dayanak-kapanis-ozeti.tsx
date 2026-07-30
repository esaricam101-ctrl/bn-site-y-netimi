/**
 * Dayanağı kapanan sakinlerin otomatik çıkış özeti.
 *
 * Malik devri ve kiracı tahliyesi, o dayanağa bağlı sakinlere de çıkış verir.
 *
 * ⚠️  BU ÖZET GÖSTERİLMEK ZORUNDA. Yönetici "tahliye edildi" bildirimini görüp
 *     kapatsa, aynı işlemin üç sakin kaydını daha kapattığını hiç öğrenmezdi;
 *     daire beklenmedik biçimde boş göründüğünde nedenini arayacak yer olmazdı.
 *
 * ⚠️  ÇIKARILAMAYAN kayıtlar KALICI bir panelde durur, bildirim balonunda
 *     değil: bunlar kullanıcının ELLE yapması gereken bir işi anlatır ve balon
 *     beş saniyede kaybolur. Kaybolan bir uyarı, hiç verilmemiş uyarıdır.
 *
 * Malik ve kiracı ekranlarının ikisi de bunu kullanır — ayrı ayrı yazılsaydı
 * biri düzeltildiğinde öteki eski hâliyle kalırdı.
 */
'use client';

import { useTranslations } from 'next-intl';
import type { DayanakKapanisSonucu } from '@/lib/servis';

export function DayanakKapanisOzeti({
  sonuc,
}: {
  readonly sonuc: DayanakKapanisSonucu['sakinCikisi'] | null;
}) {
  const t = useTranslations('sakinYonetim');
  if (sonuc === null) return null;
  if (sonuc.cikarilan === 0 && sonuc.cikarilamayan.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {sonuc.cikarilan > 0 && (
        <p className="text-xs p-2 rounded-[var(--rs)]"
           style={{ background: 'var(--glass-bg)', color: 'var(--muted)' }}>
          {t('otomatikCikisOzeti', { adet: sonuc.cikarilan })}
        </p>
      )}

      {sonuc.cikarilamayan.length > 0 && (
        <div role="alert" className="text-xs p-2 rounded-[var(--rs)] border-l-4"
             style={{ borderColor: 'var(--warn)', background: 'var(--glass-bg)' }}>
          <p className="font-semibold" style={{ color: 'var(--warn)' }}>
            {t('otomatikCikisEksik', { adet: sonuc.cikarilamayan.length })}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {sonuc.cikarilamayan.map((k) => (
              <li key={k.sakinId} className="text-[color:var(--muted)]">
                <span className="font-medium">{k.kisiAdi}</span> — {k.gerekce}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
