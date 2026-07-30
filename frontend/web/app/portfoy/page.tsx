'use client';

/**
 * PORTFÖY YÖNETİM MERKEZİ — yönetim firmasının kontrol merkezi (ADR-0009).
 *
 * ⚠️  YÖNETİM FİRMASI GİRİŞ YAPTIĞINDA DOĞRUDAN BİR PROJEYE YÖNLENDİRİLMEZ.
 *     `YONETIM_SIRKETI` rolünün varsayılan paneli `/portfoy`'dur. Tek projeye
 *     düşmek, hangi projeye düşüleceğini belirsiz bırakır ve firmanın öteki
 *     projelerini görünmez kılar.
 *
 * Proje seçildiğinde `servis.projeyeGir` proje kapsamlı bir jeton alır ve
 * oturuma yazar; sonraki bütün istekler o projenin bağlamında koşar. Firma
 * jetonu saklanır, "Portföye dön" ile geri dönülür.
 *
 * ⚠️  ÇAPRAZ-TENANT SORGU YOKTUR. Özet proje başına ayrı sorgunun uygulama
 *     katmanında toplanmasıdır (ADR-0002'nin kabul ettiği bedel). Özeti
 *     okunamayan proje satır olarak YİNE gösterilir: bir projenin arızası
 *     öteki projelerin görünmesini engellememelidir.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { servis, type PortfoyOzeti, type PortfoyProjesi } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

/** `-1` = modül henüz yok. Uydurma sayı üretilmez; "Hazır değil" gösterilir. */
const HAZIR_DEGIL = -1;

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

/** Binde tam sayıyı yüzde metnine çevirir (`846` → `%84,6`). */
function oranMetni(binde: number | null): string {
  if (binde === null) return '—';
  const tam = Math.floor(binde / 10);
  const ondalik = binde % 10;
  return `%${tam},${ondalik}`;
}

export default function PortfoySayfasi() {
  const t = useTranslations('portfoy');
  const router = useRouter();
  const bildirim = useBildirim();

  const [ozet, setOzet] = useState<PortfoyOzeti | null>(null);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [giriliyor, setGiriliyor] = useState<string | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis
      .portfoyOzeti()
      .then(setOzet)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  const projeyeGit = async (proje: PortfoyProjesi) => {
    setGiriliyor(proje.tenantId);
    try {
      await servis.projeyeGir(proje.tenantId);
      bildirim.basari(t('projeyeGirildi', { proje: proje.ad }));
      // Proje seçildikten sonra yalnızca o projenin verisi görünür.
      router.push('/yonetim');
    } catch (h) {
      bildirim.hata(hataMetni(h, t('projeyeGirilemedi')));
    } finally {
      setGiriliyor(null);
    }
  };

  if (yukleniyor) {
    return <main className="p-6"><Yukleniyor /></main>;
  }
  if (hata !== null) {
    return (
      <main className="p-6">
        <HataDurumu hata={hata} tekrarDene={yukle} />
      </main>
    );
  }
  if (ozet === null) return null;

  const kritikSayisi = ozet.kritikUyarilar.filter((u) => u.siddet === 'KRITIK').length;

  return (
    // Kontrol merkezi UYGULAMA KABUĞU KULLANMAZ: kabuktaki menü tek projenin
    // modüllerini gösterir ve burada henüz proje seçilmemiştir. Menüyü burada
    // göstermek, seçilmemiş bir projenin ekranlarına gitmeye davet ederdi.
    <main className="min-h-screen p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">
            {t('ustBaslik')}
          </p>
          <h1 className="text-2xl font-semibold">{t('baslik')}</h1>
          <p className="text-sm text-[color:var(--muted)]">{ozet.yonetimAdi}</p>
        </div>
        <p className="text-xs text-[color:var(--muted)] max-w-lg">{t('aciklama')}</p>
      </header>

      {/* Kısmî veri AÇIKÇA bildirilir: sessiz sıfır, eksik veriyi tam gösterir. */}
      {ozet.okunamayanProjeSayisi > 0 && (
        <p role="alert" className="text-sm px-3 py-2 rounded-[var(--rs)] border"
           style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
          {t('okunamayanProje', { sayi: ozet.okunamayanProjeSayisi })}
        </p>
      )}

      {/* --- Kontrol merkezi göstergeleri --- */}
      <section aria-label={t('gostergeler')}
               className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <Gosterge etiket={t('yonetilenSite')} deger={ozet.siteSayisi} />
        <Gosterge etiket={t('yonetilenApartman')} deger={ozet.apartmanSayisi} />
        <Gosterge etiket={t('toplamProje')} deger={ozet.projeSayisi} vurgu />
        <Gosterge etiket={t('toplamBolum')} deger={ozet.toplamBagimsizBolum} />
        <Gosterge etiket={t('toplamMalik')} deger={ozet.toplamMalik} />
        <Gosterge etiket={t('toplamKiraci')} deger={ozet.toplamKiraci} />
        <Gosterge etiket={t('toplamSakin')} deger={ozet.toplamSakin} />
        <Gosterge etiket={t('toplamPersonel')} deger={ozet.toplamPersonel} />
        <Gosterge etiket={t('daireGorevlisi')} deger={ozet.toplamDaireGorevlisi} />
        <Gosterge etiket={t('icerideMisafir')} deger={ozet.icerideMisafir} />
        <Gosterge etiket={t('acikIsEmri')} deger={ozet.acikIsEmri}
                  hazirDegilMetni={t('hazirDegil')} />
        <Gosterge etiket={t('bekleyenTalep')} deger={ozet.bekleyenTalep}
                  hazirDegilMetni={t('hazirDegil')} />
      </section>

      {/* --- Tahsilat durumu --- */}
      <section className="glass p-[var(--cardpad)] flex flex-col gap-2"
               aria-label={t('tahsilatDurumu')}>
        <h2 className="font-semibold">{t('tahsilatDurumu')}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Para etiket={t('tahakkuk')} deger={ozet.tahsilatDurumu.tahakkuk} />
          <Para etiket={t('tahsil')} deger={ozet.tahsilatDurumu.tahsil} />
          <Para etiket={t('kalan')} deger={ozet.tahsilatDurumu.kalan} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('tahsilatOrani')}</span>
            <span className="num text-lg font-semibold">
              {oranMetni(ozet.tahsilatDurumu.oranBinde)}
            </span>
          </div>
        </div>
        {/*
          Para METİN olarak taşınır ve METİN olarak gösterilir: `Number`'a
          çevirip biçimlemek float yuvarlaması yapar ve portföy toplamı proje
          toplamlarının toplamına eşit çıkmaz (ADR-0007).
        */}
        <p className="text-xs text-[color:var(--muted)]">{t('paraIpucu')}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Kritik uyarılar --- */}
        <section className="glass p-[var(--cardpad)] flex flex-col gap-2"
                 aria-label={t('kritikUyarilar')}>
          <h2 className="font-semibold">
            {t('kritikUyarilar')}
            {kritikSayisi > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-[var(--rs)] border"
                    style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
                {kritikSayisi}
              </span>
            )}
          </h2>
          {ozet.kritikUyarilar.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">{t('uyariYok')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ozet.kritikUyarilar.map((u, i) => (
                <li key={`${u.projeTenantId}-${u.konu}-${String(i)}`}
                    className="text-sm flex flex-col gap-0.5 border-l-2 pl-2"
                    style={{
                      borderColor: u.siddet === 'KRITIK' ? 'var(--crit)' : 'var(--warn)',
                    }}>
                  <span className="text-xs text-[color:var(--muted-2)]">
                    {u.projeAdi} · {u.konu}
                  </span>
                  <span>{u.mesaj}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Öneriler --- */}
        <section className="glass p-[var(--cardpad)] flex flex-col gap-2"
                 aria-label={t('aiOnerileri')}>
          <h2 className="font-semibold">{t('aiOnerileri')}</h2>
          {/*
            Öneriler VERİDEN türetilir; model çağrısı yoktur. Bunu gizlememek
            gerekir: sahte bir "yapay zekâ cevabı" üretmek, olmayan bir
            yeteneği varmış gibi gösterirdi.
          */}
          <p className="text-xs text-[color:var(--muted)]">{t('aiKaynagi')}</p>
          <ul className="flex flex-col gap-1.5">
            {ozet.aiOnerileri.map((o, i) => (
              <li key={`oneri-${String(i)}`} className="text-sm">• {o}</li>
            ))}
          </ul>
        </section>
      </div>

      {/* --- Proje seçimi --- */}
      <section className="flex flex-col gap-3" aria-label={t('projeSecimi')}>
        <div>
          <h2 className="font-semibold">{t('projeSecimi')}</h2>
          <p className="text-xs text-[color:var(--muted)]">{t('projeSecimiIpucu')}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ozet.projeler.map((p) => (
            <article key={p.tenantId} className="glass p-[var(--cardpad)] flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.ad}</h3>
                  <p className="text-xs text-[color:var(--muted-2)]">
                    {t(`tip_${p.tip}`)} · {p.kod}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-[var(--rs)] border"
                      style={{
                        borderColor: p.durum === 'AKTIF' ? 'var(--ok)' : 'var(--warn)',
                        color: p.durum === 'AKTIF' ? 'var(--ok)' : 'var(--warn)',
                      }}>
                  {t(`durum_${p.durum}`)}
                </span>
              </div>

              {p.ozetHatasi !== null ? (
                <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>
                  {t('projeOzetiOkunamadi')}: {p.ozetHatasi}
                </p>
              ) : (
                <dl className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
                  <dt className="text-[color:var(--muted-2)]">{t('bolum')}</dt>
                  <dd className="num">{p.bagimsizBolumSayisi}</dd>
                  <dt className="text-[color:var(--muted-2)]">{t('malik')}</dt>
                  <dd className="num">{p.malikSayisi}</dd>
                  <dt className="text-[color:var(--muted-2)]">{t('kiraci')}</dt>
                  <dd className="num">{p.kiraciSayisi}</dd>
                  <dt className="text-[color:var(--muted-2)]">{t('personel')}</dt>
                  <dd className="num">{p.personelSayisi}</dd>
                </dl>
              )}

              <p className="text-xs text-[color:var(--muted)]">
                {t('devirDayanagi')}: {p.devirDayanagi}
              </p>

              <button type="button" disabled={giriliyor !== null}
                      onClick={() => { void projeyeGit(p); }}
                      className="mt-auto px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                      style={{ backgroundImage: 'var(--grad)' }}>
                {giriliyor === p.tenantId ? t('giriliyor') : t('projeyeGir')}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Gosterge({
  etiket, deger, vurgu, hazirDegilMetni,
}: {
  readonly etiket: string;
  readonly deger: number;
  readonly vurgu?: boolean;
  /** `-1` geldiğinde gösterilecek metin — sahte sıfır basılmaz. */
  readonly hazirDegilMetni?: string;
}) {
  const hazirDegil = deger === HAZIR_DEGIL;
  return (
    <div className="glass p-[var(--cardpad)] flex flex-col gap-1">
      <span className="text-xs text-[color:var(--muted-2)]">{etiket}</span>
      {hazirDegil ? (
        <span className="text-sm text-[color:var(--muted)]">
          {hazirDegilMetni ?? '—'}
        </span>
      ) : (
        <span className={`num ${vurgu === true ? 'text-2xl' : 'text-xl'} font-semibold`}>
          {deger}
        </span>
      )}
    </div>
  );
}

function Para({ etiket, deger }: { readonly etiket: string; readonly deger: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[color:var(--muted-2)]">{etiket}</span>
      <span className="num text-lg font-semibold">{deger} ₺</span>
    </div>
  );
}
