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
import { MOCK_AKTIF, muhasebe, servis } from '@/lib/servis';

interface MenuOgesi {
  readonly yol: string;
  readonly anahtar: string;
  readonly simge: string;
  /**
   * `true` ise yalnızca ÇİFT TARAFLI muhasebe kullanan projede görünür
   * (docs/MENU-HARITASI.md §5).
   */
  readonly ciftTarafliGerektirir?: boolean;
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
  /*
   * ⚠️  BASIT muhasebeli projede GÖRÜNMEZ. Apartman tarafında hesap planı,
   *     yevmiye ve mizan diye bir kavram yoktur ve bunların bulunmaması bir
   *     eksiklik değildir (docs/APARTMAN-SITE-AYRIMI.md).
   *
   *     ⛔ BU BİR KORUMA DEĞİLDİR, görünürlük kararıdır. Asıl kapı sunucudadır
   *        (`MuhasebeDerinligiGuard`, 422) — adres çubuğuna yolu yazan
   *        kullanıcı bu satırı görmez. CT-24 ikisini ayrı ayrı ölçer.
   */
  { yol: '/muhasebe', anahtar: 'muhasebe', simge: '▩', ciftTarafliGerektirir: true },
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

/**
 * Projenin muhasebe derinliği — YALNIZCA menü filtresi için.
 *
 * ⚠️  BİLİNMİYORSA MENÜ GİZLENMEZ. `parametreler` ucu `FINANS_AYAR` ister;
 *     DENETCI ve YONETIM_KURULU bu izne sahip DEĞİLDİR ama çift taraflı
 *     projede muhasebe defterlerini görmeye hakları vardır. Okuma
 *     başarısız diye modülü gizlemek, denetçiye "böyle bir şey yok"
 *     demek olurdu.
 *
 *     Yanlış gizlemek, gereksiz göstermekten KÖTÜDÜR: gereksiz gösterilen
 *     bağlantı sunucudan 422 alır ve sebebini yazar; yanlış gizlenen modül
 *     ise hiç var olmamış gibi görünür ve kullanıcı aramayı bırakır.
 *
 * ⚠️  Bu bir güvenlik kontrolü DEĞİLDİR (bkz. MENU içindeki not).
 */
function useCiftTarafliMi(): boolean {
  // Başlangıç `true`: ilk çizimde menü kaybolup sonra belirmez. Titreşim,
  // kullanıcıya bağlantının kaybolduğunu düşündürür.
  const [ciftTarafli, setCiftTarafli] = useState(true);

  useEffect(() => {
    let iptal = false;
    muhasebe.parametreler()
      .then((p) => {
        if (!iptal) setCiftTarafli(p.muhasebeDerinligi !== 'BASIT');
      })
      .catch(() => {
        // Okunamadı (izin yok, ağ hatası) → menü OLDUĞU GİBİ kalır.
      });
    return () => { iptal = true; };
  }, []);

  return ciftTarafli;
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
  const ciftTarafli = useCiftTarafliMi();
  const gorunenMenu = MENU.filter((m) => ciftTarafli || m.ciftTarafliGerektirir !== true);

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
    <div className="min-h-screen flex flex-col">
      <SahteVeriBandi />
      <div className="flex-1 flex flex-col md:flex-row">
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
            {gorunenMenu.map((m) => {
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
    </div>
  );
}

/**
 * SAHTE VERİ UYARI BANDI.
 *
 * ⚠️  KAPATILAMAZ ve bu bilinçlidir. Kapatılabilseydi geliştirici ilk gün
 *     kapatır, bir sonraki oturumda mock'un açık olduğunu unuturdu — tam
 *     olarak önlemeye çalıştığımız durum. Kapatma düğmesi EKLENMEYECEK.
 *
 * ⚠️  Ekranı KAPATMAZ, yalnızca üstte bir şerittir: engelleyici bir kip
 *     (modal) geliştirmeyi yavaşlatır ve tıklanıp geçilmeye alışılır.
 *
 * ⚠️  `baski-gizle` YOK: çıktıya da basılır. Sahte veriyle alınmış bir
 *     ekran görüntüsü ya da PDF, gerçek sanılabilir — kâğıtta uyarı
 *     ekrandakinden daha gereklidir.
 */
function SahteVeriBandi() {
  if (!MOCK_AKTIF) return null;
  return (
    <div
      role="status"
      className="px-3 py-2 text-sm font-semibold text-center"
      style={{ background: 'var(--warn)', color: '#0F172A' }}
    >
      Sahte veri modu — gösterilen kayıtlar gerçek değildir
    </div>
  );
}
