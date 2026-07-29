'use client';

/**
 * Bağımsız bölümler listesi.
 *
 * Veri `servis` üzerinden gelir: backend hazır değilken mock, hazır olduğunda
 * gerçek uç — sayfa kodu değişmez (DEVLOG TODO-3).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { VeriTablosu } from '@/components/tablo/veri-tablosu';
import type { Kolon } from '@/components/tablo/tablo-tipleri';
import { DAIRE_TIPLERI, DURUMLAR, NITELIKLER } from '@/lib/kodlar';
import { servis, type Blok, type Bolum, type Kat } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const alanSinifi =
  'px-2 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

/**
 * Toplu taşıma — seçili bölümleri başka blok/kata alır.
 *
 * Neden toplu ve tek işlem: hiyerarşi denetiminin bulduğu uyuşmazlıklar
 * (bir katın bölümlerinin yanlış bloğa bağlı olması gibi) genelde bir grubu
 * birden ilgilendirir. Yarım kalan taşıma hiyerarşiyi denetimin bulduğundan
 * daha bozuk bırakır.
 *
 * Gerekçe zorunludur: taşıma bölümün adresini değiştirir ve tebligat,
 * tahakkuk ve sayaç kayıtları bu adrese bakar (BFS v1 §5.2).
 */
function TopluTasima({
  secili, onTamamlandi,
}: {
  readonly secili: readonly string[];
  readonly onTamamlandi: () => void;
}) {
  const t = useTranslations('bolum');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [acik, setAcik] = useState(false);
  const [bloklar, setBloklar] = useState<readonly Blok[]>([]);
  const [katlar, setKatlar] = useState<readonly Kat[]>([]);
  const [hedefBlokId, setHedefBlokId] = useState('');
  const [hedefKatId, setHedefKatId] = useState('');
  const [gerekce, setGerekce] = useState('');
  const [formHatasi, setFormHatasi] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!acik) return;
    servis.bloklar().then(setBloklar).catch(() => setBloklar([]));
  }, [acik]);

  useEffect(() => {
    if (hedefBlokId === '') { setKatlar([]); setHedefKatId(''); return; }
    servis.katlar(hedefBlokId).then(setKatlar).catch(() => setKatlar([]));
    setHedefKatId('');
  }, [hedefBlokId]);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hedefBlokId === '') { setFormHatasi(t('hataHedefBlok')); return; }
    if (gerekce.trim().length < 10) { setFormHatasi(t('hataGerekce')); return; }
    setFormHatasi(null);
    setGonderiliyor(true);
    try {
      await servis.bolumTasi(
        secili, hedefBlokId, hedefKatId === '' ? null : hedefKatId, gerekce.trim(),
      );
      bildirim.basari(t('tasindi', { sayi: secili.length }));
      setAcik(false);
      setGerekce('');
      onTamamlandi();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('tasinamadi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)}
              className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
        {t('tasi')}
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="w-full flex flex-col gap-3 pt-2 border-t border-[color:var(--line)]">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('hedefBlok')}</span>
          <select className={alanSinifi} value={hedefBlokId} required
                  onChange={(e) => setHedefBlokId(e.target.value)}>
            <option value="">{tg('veriYok')}</option>
            {bloklar.map((b) => (
              <option key={b.id} value={b.id}>{b.ad} — {b.apartmanAdi}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('hedefKat')}</span>
          <select className={alanSinifi} value={hedefKatId} disabled={hedefBlokId === ''}
                  onChange={(e) => setHedefKatId(e.target.value)}>
            <option value="">{t('katKaydiYok')}</option>
            {katlar.map((k) => (
              <option key={k.id} value={k.id}>{k.ad ?? t('katNo', { no: k.no })}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('tasimaGerekce')}</span>
          <input className={alanSinifi} value={gerekce} required
                 onChange={(e) => setGerekce(e.target.value)} />
        </label>
      </div>

      {hedefKatId !== '' && (
        <p className="text-xs text-[color:var(--muted)]">{t('katEsitlemeIpucu')}</p>
      )}

      {formHatasi !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{formHatasi}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={gonderiliyor}
                className="px-3 py-1.5 text-sm rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                style={{ backgroundImage: 'var(--grad)' }}>
          {gonderiliyor ? tg('yukleniyor') : t('tasiOnay', { sayi: secili.length })}
        </button>
        <button type="button" onClick={() => setAcik(false)}
                className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
          {tg('iptal')}
        </button>
      </div>
    </form>
  );
}

/**
 * Arsa payı toplamı uyarısı.
 *
 * Bozuk toplam TAHAKKUKU BOZAR: arsa payına göre paylaştırılan her gider
 * yanlış dağıtılır ve hata aylar sonra "aidatım neden farklı" sorusuyla
 * ortaya çıkar. Bu yüzden liste ekranında sürekli görünür — ayrı bir rapora
 * gidilmesi beklenmez.
 *
 * Toplam TAM ise hiçbir şey gösterilmez; her şey yolundayken de bir rozet
 * göstermek uyarıyı gürültüye çevirir.
 */
function ArsaPayiUyarisi() {
  const t = useTranslations('bolum');
  const [rapor, setRapor] = useState<{ gecerli: boolean; toplam: string } | null>(null);

  useEffect(() => {
    servis.arsaPayiDurumu()
      .then((r) => setRapor({ gecerli: r.gecerli, toplam: r.toplam }))
      // Sessiz gecilir: uyari BILGILENDIRICIDIR, listeyi engellememelidir.
      .catch(() => setRapor(null));
  }, []);

  if (rapor === null || rapor.gecerli) return null;

  return (
    <Link href="/bolumler/arsa-payi" role="status"
          className="px-3 py-1.5 text-sm rounded-[var(--rs)] border inline-flex items-center gap-2"
          style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
      <span aria-hidden="true">⚠</span>
      {t('arsaPayiBozuk', { toplam: rapor.toplam })}
    </Link>
  );
}

function Rozet({ metin, renk }: { readonly metin: string; readonly renk: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs whitespace-nowrap"
      style={{ background: 'var(--glass-bg)', border: `1px solid ${renk}`, color: renk }}
    >
      {metin}
    </span>
  );
}

export default function BolumlerSayfasi() {
  const t = useTranslations('bolum');
  const tn = useTranslations('navigasyon');
  const yonlendir = useRouter();

  const [satirlar, setSatirlar] = useState<readonly Bolum[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis
      .bolumler()
      .then((s) => setSatirlar(s.kayitlar))
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  // Durum rengi TEK BASINA anlam tasimaz; metin de yazilir (WCAG 1.4.1).
  const durumRengi = (durum: string): string => {
    if (durum === 'AKTIF') return 'var(--success)';
    if (durum === 'TADILATTA') return 'var(--warn)';
    if (durum === 'KULLANIM_DISI') return 'var(--crit)';
    return 'var(--muted)';
  };

  // Secenek listeleri ENUM'dan turetilir; elle yazilan liste enum buyudugunde
  // sessizce eksik kalir ve kullanici var olan kayitlari suzemez.
  const secenek = (kok: string, kodlar: readonly string[]) =>
    kodlar.map((k) => ({ deger: k, etiket: t(`${kok}_${k}`) }));

  const kolonlar: readonly Kolon<Bolum>[] = [
    { anahtar: 'kapiNo', baslik: t('kapiNo'), ham: (b) => b.kapiNo },
    { anahtar: 'kat', baslik: t('kat'), ham: (b) => b.kat, hizalama: 'sag', filtreTipi: 'sayi' },
    {
      anahtar: 'nitelik', baslik: t('nitelik'),
      ham: (b) => b.nitelik,
      hucre: (b) => t(`nitelik_${b.nitelik}`),
      filtreTipi: 'secim',
      secenekler: secenek('nitelik', NITELIKLER),
    },
    {
      anahtar: 'daireTipi', baslik: t('daireTipi'),
      ham: (b) => b.daireTipi,
      hucre: (b) => (b.daireTipi === null ? '—' : t(`daireTipi_${b.daireTipi}`)),
      filtreTipi: 'secim',
      secenekler: secenek('daireTipi', DAIRE_TIPLERI),
    },
    {
      anahtar: 'durum', baslik: t('durum'),
      ham: (b) => b.durum,
      hucre: (b) => <Rozet metin={t(`durum_${b.durum}`)} renk={durumRengi(b.durum)} />,
      filtreTipi: 'secim',
      secenekler: secenek('durum', DURUMLAR),
    },
    {
      anahtar: 'brutM2', baslik: t('brutM2'), ham: (b) => b.brutM2,
      hizalama: 'sag', filtreTipi: 'sayi',
    },
    {
      anahtar: 'netM2', baslik: t('netM2'), ham: (b) => b.netM2,
      hizalama: 'sag', varsayilanGizli: true, filtreTipi: 'sayi',
    },
    {
      anahtar: 'arsaPayi', baslik: t('arsaPayi'), ham: (b) => b.arsaPayi,
      hizalama: 'sag',
    },
    {
      anahtar: 'icKapiNo', baslik: t('icKapiNo'),
      ham: (b) => b.icKapiNo, varsayilanGizli: true,
      hucre: (b) => b.icKapiNo ?? '—',
    },
  ];

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[{ etiket: tn('genelBakis'), yol: '/yonetim' }, { etiket: tn('bolumler') }]}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/bolumler/ice-aktar"
              className="px-4 h-[var(--rowh)] inline-flex items-center rounded-[var(--rs)] text-white font-semibold"
              style={{ backgroundImage: 'var(--grad)' }}>
          {t('iceAktar')}
        </Link>
        <Link href="/bolumler/arsa-payi"
              className="px-4 h-[var(--rowh)] inline-flex items-center rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('arsaPayiDuzelt')}
        </Link>
        <ArsaPayiUyarisi />
      </div>

      {yukleniyor && <Yukleniyor satir={6} />}

      {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}

      {!yukleniyor && hata === null && satirlar.length === 0 && (
        <BosDurum aciklama={t('bosAciklama')} />
      )}

      {!yukleniyor && hata === null && satirlar.length > 0 && (
        <VeriTablosu
          kolonlar={kolonlar}
          satirlar={satirlar}
          anahtarAl={(b) => b.id}
          profilAnahtari="bolumler"
          dosyaAdi={t('baslik')}
          secimAktif
          onSatirAcildi={(b) => yonlendir.push(`/daireler/${b.id}`)}
          topluEylemler={(secili) => (
            <TopluTasima secili={secili} onTamamlandi={yukle} />
          )}
        />
      )}
    </UygulamaKabugu>
  );
}
