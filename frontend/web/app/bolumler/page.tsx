'use client';

/**
 * Bağımsız bölümler listesi.
 *
 * Veri `servis` üzerinden gelir: backend hazır değilken mock, hazır olduğunda
 * gerçek uç — sayfa kodu değişmez (DEVLOG TODO-3).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { VeriTablosu } from '@/components/tablo/veri-tablosu';
import type { Kolon } from '@/components/tablo/tablo-tipleri';
import { DAIRE_TIPLERI, DURUMLAR, NITELIKLER } from '@/lib/kodlar';
import { servis, type Bolum } from '@/lib/servis';

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
        />
      )}
    </UygulamaKabugu>
  );
}
