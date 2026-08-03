'use client';

/**
 * Uygulama kabuğu — yan gezinme, üst çubuk, içerik alanı.
 *
 * Responsive: `md` altında yan menü gizlenir ve düğmeyle açılır. Mobilde
 * kalıcı bir yan menü içerik için yer bırakmaz.
 *
 * Erişilebilirlik: yan menü `<nav>`, etkin bağlantı `aria-current="page"`.
 * Mobil menü açıkken `Esc` kapatır — fare olmadan çıkış yolu bulunmalıdır.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { TemaAnahtari, YogunlukAnahtari } from './gorunum-anahtarlari';
import { KirintiYolu, type KirintiOgesi } from './kirinti-yolu';
import { servis } from '@/lib/servis';

interface MenuOgesi {
  readonly yol: string;
  readonly anahtar: string;
  readonly simge: string;
}

/** Öncelik sırası sprint tanımından gelir. */
const MENU: readonly MenuOgesi[] = [
  { yol: '/yonetim', anahtar: 'genelBakis', simge: '◈' },
  { yol: '/apartmanlar', anahtar: 'apartmanlar', simge: '▣' },
  { yol: '/bloklar', anahtar: 'bloklar', simge: '▤' },
  { yol: '/katlar', anahtar: 'katlar', simge: '▥' },
  { yol: '/bolumler', anahtar: 'bolumler', simge: '▦' },
  // İki AYRI modül: işvereni yönetim olan kadro ile malik/kiracının ücretli
  // çalıştırdığı ev hizmetleri görevlisi karıştırılmamalıdır.
  { yol: '/site-personeli', anahtar: 'sitePersoneli', simge: '◍' },
  { yol: '/daire-gorevlileri', anahtar: 'daireGorevlileri', simge: '◎' },
  { yol: '/misafirler', anahtar: 'misafirler', simge: '◐' },
  { yol: '/gider-turleri', anahtar: 'giderTurleri', simge: '₺' },
  { yol: '/muhasebe', anahtar: 'muhasebe', simge: '▩' },
  /*
   * ⚠️  `/belgeler` KALDIRILDI (3 Ağustos 2026).
   *
   *     Menüde vardı ama `app/belgeler` sayfası HİÇ YAZILMAMIŞTI: tıklayan
   *     kullanıcı 404 alıyordu. Backend'de 12 belge ucu çalışıyor.
   *
   *     ⛔ Ekran YAZILANA KADAR geri eklenmez: çalışmayan bir menü öğesi,
   *        eksik özelliği "var" gibi gösterir ve kullanıcıyı ürünün bozuk
   *        olduğuna inandırır. Yol haritasında "belge ekranı" olarak duruyor.
   */
];

/**
 * Yalnızca BASKIDA görünen başlık — ekranda yer kaplamaz (`.baski-basligi`).
 *
 * Basılan çıktı bir belgedir: yönetim kuruluna sunulur, dosyalanır, tebligat
 * ekine konur. Kâğıtta hangi ekranın, hangi tarihte basıldığı yazmazsa çıktı
 * altı ay sonra kime ait olduğu bilinmeyen bir liste olur.
 *
 * Tarih `useEffect` içinde yazılır: sunucuda üretilen HTML'e tarih koymak
 * hidrasyon uyuşmazlığı doğurur (sunucu ile istemcinin saati aynı anı
 * göstermez).
 */
function BaskiBasligi({ baslik }: { readonly baslik?: string }) {
  const tg = useTranslations('genel');
  const [tarih, setTarih] = useState('');

  useEffect(() => {
    setTarih(new Date().toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }, []);

  return (
    <div className="baski-basligi">
      <div className="font-bold">{tg('uygulamaAdi')}</div>
      {baslik !== undefined && <div>{baslik}</div>}
      {tarih !== '' && <div className="num text-xs">{tarih}</div>}
    </div>
  );
}

/**
 * AKTİF PROJE göstergesi — yalnızca bir portföy oturumunda görünür (ADR-0009).
 *
 * Yönetim firması bir projeye girdiğinde HANGİ projede olduğunu her ekranda
 * görmelidir: aksi hâlde iki proje arasında geçiş yapan kullanıcı, yanlış
 * projeye tahakkuk yazdığını fark etmez. "Portföye dön" firma jetonuna geri
 * geçer; jeton saklanmasaydı yeniden giriş yapmak gerekirdi.
 */
function AktifProje() {
  const t = useTranslations('navigasyon');
  const [projeAdi, setProjeAdi] = useState<string | null>(null);

  // `sessionStorage` yalnızca istemcide vardır; sunucuda okumak hidrasyon
  // uyuşmazlığı doğurur.
  useEffect(() => {
    setProjeAdi(sessionStorage.getItem('bnos.projeAdi'));
  }, []);

  if (projeAdi === null) return null;

  return (
    <span className="flex items-center gap-2 text-xs px-2 py-1 rounded-[var(--rs)] border border-[color:var(--line)]">
      <span className="text-[color:var(--muted-2)]">{t('aktifProje')}:</span>
      <span className="font-semibold truncate max-w-[10rem]">{projeAdi}</span>
      <Link href="/portfoy" className="underline"
            onClick={() => { servis.portfoyeDon(); }}>
        {t('portfoyeDon')}
      </Link>
    </span>
  );
}

export function UygulamaKabugu({
  children,
  kirintilar = [],
  baslik,
  eylemler,
}: {
  readonly children: ReactNode;
  readonly kirintilar?: readonly KirintiOgesi[];
  readonly baslik?: string;
  /** Sağ üstteki hızlı işlem düğmeleri. */
  readonly eylemler?: ReactNode;
}) {
  const t = useTranslations('navigasyon');
  const tg = useTranslations('genel');
  const yol = usePathname();
  const [menuAcik, setMenuAcik] = useState(false);

  // Yol degisince mobil menu kapanir; aksi halde gezinme sonrasi menu ekrani
  // kaplamaya devam eder.
  useEffect(() => setMenuAcik(false), [yol]);

  useEffect(() => {
    if (!menuAcik) return;
    const kapat = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAcik(false);
    };
    window.addEventListener('keydown', kapat);
    return () => window.removeEventListener('keydown', kapat);
  }, [menuAcik]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Yan gezinme */}
      <nav
        aria-label={t('anaMenu')}
        className={[
          'md:w-56 md:shrink-0 md:border-r border-[color:var(--line)]',
          'md:block',
          menuAcik ? 'block' : 'hidden',
        ].join(' ')}
        style={{ background: 'var(--darker)' }}
      >
        <div className="p-[var(--pad)]">
          <div className="text-sm font-extrabold mb-4 bg-clip-text text-transparent"
               style={{ backgroundImage: 'var(--grad)' }}>
            {tg('uygulamaAdi')}
          </div>
          <ul className="flex flex-col gap-1">
            {MENU.map((m) => {
              const etkin = yol === m.yol || yol.startsWith(`${m.yol}/`);
              return (
                <li key={m.yol}>
                  <Link
                    href={m.yol}
                    aria-current={etkin ? 'page' : undefined}
                    className={[
                      'flex items-center gap-2 px-3 rounded-[var(--rs)] text-sm',
                      'h-[var(--rowh)] transition-colors',
                      etkin
                        ? 'font-semibold text-[color:var(--text)] border border-[color:var(--line)]'
                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]',
                    ].join(' ')}
                    style={etkin ? { background: 'var(--glass-bg)' } : undefined}
                  >
                    <span aria-hidden="true">{m.simge}</span>
                    {t(m.anahtar)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Ust cubuk */}
        <header
          className="border-b border-[color:var(--line)] px-[var(--pad)] py-3 flex items-center gap-3 flex-wrap"
          style={{ background: 'var(--glass-bg)' }}
        >
          <button
            type="button"
            className="md:hidden text-lg px-2 rounded-[var(--rs)] border border-[color:var(--line)]"
            aria-expanded={menuAcik}
            aria-label={t('anaMenu')}
            onClick={() => setMenuAcik((a) => !a)}
          >
            <span aria-hidden="true">☰</span>
          </button>

          <div className="min-w-0 flex-1">
            <KirintiYolu ogeler={kirintilar} />
            {baslik !== undefined && (
              <h1 className="text-lg font-bold truncate">{baslik}</h1>
            )}
          </div>

          <div className="flex items-center gap-2 baski-gizle">
            <AktifProje />
            {eylemler}
            <YogunlukAnahtari />
            <TemaAnahtari />
          </div>
        </header>

        <main className="flex-1 p-[var(--pad)] min-w-0">
          <BaskiBasligi baslik={baslik} />
          {children}
        </main>
      </div>
    </div>
  );
}
