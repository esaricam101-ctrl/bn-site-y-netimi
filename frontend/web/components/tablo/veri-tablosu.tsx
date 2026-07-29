'use client';

/**
 * Veri tablosu — 15 yönetim ekranının ortak omurgası.
 *
 * Desteklenenler: hızlı arama · çoklu sıralama · kolon gizle/göster ·
 * kolon sırası · kolon genişliği · toplu seçim · CSV dışa aktarım · yazdırma ·
 * görünüm profili kaydetme.
 *
 * TASARIM KARARI — sıralama ve filtreleme İSTEMCİDE yapılır. Bir apartmanda
 * bağımsız bölüm sayısı yüzler mertebesindedir; sunucuya gidip gelmek
 * kullanıcıya sıralama başına 200 ms gecikme olarak yansır. Veri binlere
 * çıkarsa sunucu tarafına taşınmalıdır — o eşik `SUNUCU_ESIGI` ile görünür
 * kılınmıştır ve aşıldığında konsola uyarı düşer.
 *
 * Erişilebilirlik: başlıklar `aria-sort` taşır, seçim kutuları etiketlidir,
 * satır sayısı `aria-live` ile duyurulur (WCAG 4.1.3).
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { csvIndir } from './disa-aktar';
import { filtreleriUygula, kosulEtkinMi } from './filtre';
import { FiltrePaneli } from './filtre-paneli';
import type {
  FiltreBaglaci, FiltreKosulu, GorunumProfili, Kolon, SiralamaDurumu,
} from './tablo-tipleri';

const SUNUCU_ESIGI = 2000;

export interface VeriTablosuOzellikleri<T> {
  readonly kolonlar: readonly Kolon<T>[];
  readonly satirlar: readonly T[];
  readonly anahtarAl: (satir: T) => string;
  /** Görünüm profilinin saklanacağı ad — ekran başına benzersiz. */
  readonly profilAnahtari: string;
  readonly dosyaAdi?: string;
  readonly secimAktif?: boolean;
  readonly onSecimDegisti?: (secili: readonly string[]) => void;
  /** Satıra çift tıklama / Enter — detaya gitme. */
  readonly onSatirAcildi?: (satir: T) => void;
  /** Toplu işlem çubuğunda gösterilecek düğmeler. */
  readonly topluEylemler?: (secili: readonly string[]) => React.ReactNode;
}

interface Tercihler {
  readonly sira: readonly string[];
  readonly gizli: readonly string[];
  readonly genislikler: Readonly<Record<string, number>>;
  readonly siralama: readonly SiralamaDurumu[];
}

function tercihleriOku(anahtar: string, varsayilan: Tercihler): Tercihler {
  if (typeof window === 'undefined') return varsayilan;
  try {
    const ham = localStorage.getItem(`bnos.tablo.${anahtar}`);
    return ham === null ? varsayilan : { ...varsayilan, ...(JSON.parse(ham) as Tercihler) };
  } catch {
    // Bozuk tercih kaydi arayuzu kilitlememeli; varsayilana donulur.
    return varsayilan;
  }
}

export function VeriTablosu<T>({
  kolonlar, satirlar, anahtarAl, profilAnahtari,
  dosyaAdi = 'liste', secimAktif = false,
  onSecimDegisti, onSatirAcildi, topluEylemler,
}: VeriTablosuOzellikleri<T>) {
  const t = useTranslations('tablo');
  const tg = useTranslations('genel');
  const tf = useTranslations('filtre');
  const aramaId = useId();

  const varsayilan: Tercihler = useMemo(
    () => ({
      sira: kolonlar.map((k) => k.anahtar),
      gizli: kolonlar.filter((k) => k.varsayilanGizli === true).map((k) => k.anahtar),
      genislikler: {},
      siralama: [],
    }),
    [kolonlar],
  );

  const [tercih, setTercih] = useState<Tercihler>(varsayilan);
  const [arama, setArama] = useState('');
  const [secili, setSecili] = useState<readonly string[]>([]);
  const [ayarAcik, setAyarAcik] = useState(false);
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [kosullar, setKosullar] = useState<readonly FiltreKosulu[]>([]);
  const [baglac, setBaglac] = useState<FiltreBaglaci>('VE');
  const surukleneKolon = useRef<string | null>(null);

  // Tercih okumasi effect'te; sunucu ve ilk istemci render'i ayni kalir.
  useEffect(() => {
    setTercih(tercihleriOku(profilAnahtari, varsayilan));
  }, [profilAnahtari, varsayilan]);

  useEffect(() => {
    if (satirlar.length > SUNUCU_ESIGI) {
      // Sessizce yavaslamak yerine acikca uyarilir.
      console.warn(
        `VeriTablosu: ${satirlar.length} satır istemcide sıralanıyor. ` +
          `${SUNUCU_ESIGI} üzerinde sunucu tarafı sıralama gerekir.`,
      );
    }
  }, [satirlar.length]);

  const tercihYaz = (yeni: Tercihler) => {
    setTercih(yeni);
    localStorage.setItem(`bnos.tablo.${profilAnahtari}`, JSON.stringify(yeni));
  };

  const gorunurKolonlar = useMemo(() => {
    const harita = new Map(kolonlar.map((k) => [k.anahtar, k]));
    return tercih.sira
      .map((a) => harita.get(a))
      .filter((k): k is Kolon<T> => k !== undefined && !tercih.gizli.includes(k.anahtar));
  }, [kolonlar, tercih.sira, tercih.gizli]);

  const suzulmus = useMemo(() => {
    // Once kolon bazli filtre, sonra hizli arama: ikisi VE ile birlesir.
    // Sira onemlidir yalnizca performans acisindan — filtre genelde daha
    // cok satir eler, arama daha pahalidir (tum kolonlari gezer).
    const filtreli = filtreleriUygula(satirlar, kolonlar, kosullar, baglac);
    const q = arama.trim().toLocaleLowerCase('tr');
    if (q === '') return filtreli;
    // Arama TUM kolonlarda yapilir, yalnizca gorunurlerde degil: kullanici
    // gizledigi bir kolondaki degeri arayabilir.
    return filtreli.filter((s) =>
      kolonlar.some((k) => String(k.ham(s) ?? '').toLocaleLowerCase('tr').includes(q)),
    );
  }, [satirlar, kolonlar, arama, kosullar, baglac]);

  const etkinKosulSayisi = useMemo(
    () => kosullar.filter(kosulEtkinMi).length,
    [kosullar],
  );

  const siralanmis = useMemo(() => {
    if (tercih.siralama.length === 0) return suzulmus;
    const harita = new Map(kolonlar.map((k) => [k.anahtar, k]));
    return [...suzulmus].sort((a, b) => {
      for (const s of tercih.siralama) {
        const k = harita.get(s.anahtar);
        if (k === undefined) continue;
        const av = k.ham(a);
        const bv = k.ham(b);
        if (av === bv) continue;
        if (av === null) return 1;
        if (bv === null) return -1;
        const kars =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), 'tr');
        if (kars !== 0) return s.yon === 'artan' ? kars : -kars;
      }
      return 0;
    });
  }, [suzulmus, kolonlar, tercih.siralama]);

  const siralamayaBas = (anahtar: string, ekle: boolean) => {
    const mevcut = tercih.siralama.find((s) => s.anahtar === anahtar);
    const yeniDurum: SiralamaDurumu =
      mevcut === undefined || mevcut.yon === 'azalan'
        ? { anahtar, yon: 'artan' }
        : { anahtar, yon: 'azalan' };
    // Shift ile coklu siralama: onceki olcutler korunur.
    const digerleri = ekle ? tercih.siralama.filter((s) => s.anahtar !== anahtar) : [];
    tercihYaz({ ...tercih, siralama: [...digerleri, yeniDurum] });
  };

  const seciliDegistir = (yeni: readonly string[]) => {
    setSecili(yeni);
    onSecimDegisti?.(yeni);
  };

  const tumunuSec = (isaretli: boolean) => {
    seciliDegistir(isaretli ? siralanmis.map(anahtarAl) : []);
  };

  const kolonTasi = (kaynak: string, hedef: string) => {
    if (kaynak === hedef) return;
    const sira = [...tercih.sira];
    const kaynakIndeks = sira.indexOf(kaynak);
    const hedefIndeks = sira.indexOf(hedef);
    if (kaynakIndeks < 0 || hedefIndeks < 0) return;
    sira.splice(kaynakIndeks, 1);
    sira.splice(hedefIndeks, 0, kaynak);
    tercihYaz({ ...tercih, sira });
  };

  const profilKaydet = () => {
    const profil: GorunumProfili = {
      ad: profilAnahtari,
      kolonSirasi: tercih.sira,
      gizli: tercih.gizli,
      genislikler: tercih.genislikler,
      siralama: tercih.siralama,
    };
    localStorage.setItem(`bnos.profil.${profilAnahtari}`, JSON.stringify(profil));
  };

  const tumuSecili = siralanmis.length > 0 && secili.length === siralanmis.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Arac cubugu — kagida basilmaz (arama kutusu, dugmeler). */}
      <div className="flex flex-wrap items-center gap-2 baski-gizle">
        <label htmlFor={aramaId} className="sr">{t('ara')}</label>
        <input
          id={aramaId}
          type="search"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder={t('ara')}
          className="px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent min-w-0 flex-1 sm:flex-none sm:w-64"
        />

        <button type="button" onClick={() => setFiltreAcik((a) => !a)}
                aria-expanded={filtreAcik}
                className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border inline-flex items-center gap-2"
                style={{
                  borderColor: etkinKosulSayisi > 0 ? 'var(--primary)' : 'var(--line)',
                }}>
          {tf('baslik')}
          {/* Etkin filtre sayisi GORUNUR olmali: kapali panelde suzulmus bir
              listeye bakip "kayitlar kayboldu" sanmak en sik hatadir. */}
          {etkinKosulSayisi > 0 && (
            <span className="num text-xs px-1.5 rounded-full text-white"
                  style={{ background: 'var(--primary)' }}>
              {etkinKosulSayisi}
            </span>
          )}
        </button>

        <button type="button" onClick={() => setAyarAcik((a) => !a)}
                aria-expanded={ayarAcik}
                className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('kolonlar')}
        </button>

        <button type="button" onClick={() => csvIndir(dosyaAdi, gorunurKolonlar, siralanmis)}
                className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('csvAktar')}
        </button>

        <button type="button" onClick={() => window.print()}
                className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('yazdir')}
        </button>

        <button type="button" onClick={profilKaydet}
                className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('gorunumuKaydet')}
        </button>

        {/* Suzme varken TOPLAM da yazilir; aksi halde eksik liste tam liste
            sanilir ve eksik kayit "kaybolmus" diye aranir. */}
        <span aria-live="polite" className="text-xs text-[color:var(--muted)] ml-auto num">
          {siralanmis.length === satirlar.length
            ? t('satirSayisi', { sayi: siralanmis.length })
            : t('satirSayisiSuzulmus', { sayi: siralanmis.length, toplam: satirlar.length })}
        </span>
      </div>

      {/* Gelismis filtre */}
      {filtreAcik && (
        <FiltrePaneli
          kolonlar={kolonlar}
          kosullar={kosullar}
          baglac={baglac}
          profilAnahtari={profilAnahtari}
          onDegisti={(yeniKosullar, yeniBaglac) => {
            setKosullar(yeniKosullar);
            setBaglac(yeniBaglac);
            // Suzgec degisince secim TEMIZLENIR: gorunmeyen satirlar secili
            // kalirsa toplu islem, kullanicinin gormedigi kayitlara uygulanir.
            seciliDegistir([]);
          }}
        />
      )}

      {/* Kolon yonetimi */}
      {ayarAcik && (
        <div className="glass p-[var(--cardpad)] flex flex-wrap gap-3 baski-gizle">
          {kolonlar.map((k) => (
            <label key={k.anahtar} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!tercih.gizli.includes(k.anahtar)}
                onChange={(e) =>
                  tercihYaz({
                    ...tercih,
                    gizli: e.target.checked
                      ? tercih.gizli.filter((g) => g !== k.anahtar)
                      : [...tercih.gizli, k.anahtar],
                  })
                }
              />
              {k.baslik}
            </label>
          ))}
        </div>
      )}

      {/* Toplu islem cubugu — yalnizca secim varken gorunur. */}
      {secimAktif && secili.length > 0 && (
        <div role="region" aria-label={t('topluIslem')}
             className="glass p-[var(--cardpad)] flex flex-wrap items-center gap-2 baski-gizle">
          <span className="text-sm num">{t('seciliSayisi', { sayi: secili.length })}</span>
          {topluEylemler?.(secili)}
          <button type="button" onClick={() => seciliDegistir([])}
                  className="ml-auto text-sm underline">
            {t('secimiTemizle')}
          </button>
        </div>
      )}

      {/* Tablo — dar ekranda YATAY kaydirilir; sayfa govdesi kaymaz. */}
      <div className="overflow-x-auto glass">
        <table className="w-full text-sm border-collapse">
          <caption className="sr">{t('tabloAciklamasi', { sayi: siralanmis.length })}</caption>
          <thead>
            <tr>
              {secimAktif && (
                /* Secim kolonu KAGIDA BASILMAZ; basilirsa bos bir sutun
                   kalir ve tablo hizasi kayar. */
                <th scope="col" className="p-2 w-10 baski-gizle">
                  <input
                    type="checkbox"
                    checked={tumuSecili}
                    onChange={(e) => tumunuSec(e.target.checked)}
                    aria-label={t('tumunuSec')}
                  />
                </th>
              )}
              {gorunurKolonlar.map((k) => {
                const s = tercih.siralama.find((x) => x.anahtar === k.anahtar);
                const siralanabilir = k.siralanabilir !== false;
                return (
                  <th
                    key={k.anahtar}
                    scope="col"
                    aria-sort={
                      s === undefined ? 'none' : s.yon === 'artan' ? 'ascending' : 'descending'
                    }
                    draggable
                    onDragStart={() => { surukleneKolon.current = k.anahtar; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (surukleneKolon.current !== null) {
                        kolonTasi(surukleneKolon.current, k.anahtar);
                        surukleneKolon.current = null;
                      }
                    }}
                    style={{
                      width: tercih.genislikler[k.anahtar],
                      textAlign: k.hizalama === 'sag' ? 'right' : 'left',
                    }}
                    className="p-2 border-b border-[color:var(--line)] font-semibold whitespace-nowrap"
                  >
                    {siralanabilir ? (
                      <button
                        type="button"
                        onClick={(e) => siralamayaBas(k.anahtar, e.shiftKey)}
                        className="inline-flex items-center gap-1 hover:underline"
                        title={t('siralamaIpucu')}
                      >
                        {k.baslik}
                        <span aria-hidden="true" className="text-[color:var(--muted-2)]">
                          {s === undefined ? '↕' : s.yon === 'artan' ? '↑' : '↓'}
                        </span>
                      </button>
                    ) : (
                      k.baslik
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {siralanmis.length === 0 && (
              <tr>
                <td
                  colSpan={gorunurKolonlar.length + (secimAktif ? 1 : 0)}
                  className="p-6 text-center text-[color:var(--muted)]"
                >
                  {tg('veriYok')}
                </td>
              </tr>
            )}
            {siralanmis.map((satir) => {
              const anahtar = anahtarAl(satir);
              const isaretli = secili.includes(anahtar);
              return (
                <tr
                  key={anahtar}
                  onDoubleClick={() => onSatirAcildi?.(satir)}
                  className="border-b border-[color:var(--line)] hover:bg-[color:var(--glass-bg)]"
                  style={{ height: 'var(--rowh)' }}
                >
                  {secimAktif && (
                    <td className="p-2 baski-gizle">
                      <input
                        type="checkbox"
                        checked={isaretli}
                        onChange={(e) =>
                          seciliDegistir(
                            e.target.checked
                              ? [...secili, anahtar]
                              : secili.filter((s) => s !== anahtar),
                          )
                        }
                        aria-label={t('satiriSec')}
                      />
                    </td>
                  )}
                  {gorunurKolonlar.map((k) => (
                    <td
                      key={k.anahtar}
                      className="p-2"
                      style={{ textAlign: k.hizalama === 'sag' ? 'right' : 'left' }}
                    >
                      {k.hucre === undefined ? String(k.ham(satir) ?? '') : k.hucre(satir)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
