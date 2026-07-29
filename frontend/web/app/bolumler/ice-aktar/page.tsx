'use client';

/**
 * CSV içe aktarma sihirbazı — bağımsız bölümler.
 *
 * Kırk daireli bir binayı tek tek girmek operasyonel olarak kullanılamaz;
 * yönetim devralınırken veri genelde bir Excel dosyasındadır.
 *
 * Akış üç adımdır ve GERİ dönülebilir: hedef → eşleştirme → önizleme.
 * Önizleme adımı, gönderilmeden ÖNCE tüm hataları birden gösterir. Sunucu
 * tek işlem uygular (bir satır geçersizse hiçbiri yazılmaz); hataları
 * teker teker öğrenmek 40 satırlık dosyada 40 tur demektir.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { csvAyristir } from '@/components/tablo/csv-oku';
import {
  ICE_AKTARIM_ALANLARI, ZORUNLU_ALANLAR, otomatikEsle, sablonCsv, satirlariCoz,
  type IceAktarimAlani, type SatirSonucu,
} from '@/components/bolum/ice-aktar-sozlesme';
import { servis, type Blok, type Kat } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const alanSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent';

/** Sunucunun iş kuralı mesajı AYNEN gösterilir; genelleştirilmez. */
function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function IceAktarSayfasi() {
  return (
    <Suspense fallback={<UygulamaKabugu><Yukleniyor satir={3} /></UygulamaKabugu>}>
      <IceAktarIcerik />
    </Suspense>
  );
}

function IceAktarIcerik() {
  const t = useTranslations('iceAktar');
  const tb = useTranslations('bolum');
  const tg = useTranslations('genel');
  const tn = useTranslations('navigasyon');
  const bildirim = useBildirim();
  const yonlendir = useRouter();
  const parametreler = useSearchParams();

  const [adim, setAdim] = useState<1 | 2 | 3>(1);

  // Adim 1 — hedef
  const [bloklar, setBloklar] = useState<readonly Blok[]>([]);
  const [blokId, setBlokId] = useState(parametreler.get('blokId') ?? '');
  const [katlar, setKatlar] = useState<readonly Kat[]>([]);
  const [katId, setKatId] = useState('');
  const [katNo, setKatNo] = useState('0');

  // Adim 2 — dosya ve eslestirme
  const [hamMetin, setHamMetin] = useState('');
  const [baslikVar, setBaslikVar] = useState(true);
  const [eslesme, setEslesme] = useState<Record<IceAktarimAlani, number>>(
    () => Object.fromEntries(
      ICE_AKTARIM_ALANLARI.map((a) => [a, -1]),
    ) as Record<IceAktarimAlani, number>,
  );

  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    servis.bloklar().then((b) => {
      setBloklar(b);
      // Tek blok varsa secim sorulmaz; kullaniciyi bos bir karara zorlamaz.
      // Islevsel guncelleme: URL'den gelen secim varsa EZILMEZ.
      setBlokId((mevcut) => (mevcut === '' && b.length === 1 ? (b[0]?.id ?? '') : mevcut));
    }).catch(() => setBloklar([]));
  }, []);

  useEffect(() => {
    if (blokId === '') { setKatlar([]); return; }
    servis.katlar(blokId).then(setKatlar).catch(() => setKatlar([]));
    setKatId('');
  }, [blokId]);

  const cozum = useMemo(() => {
    if (hamMetin.trim() === '') return null;
    return csvAyristir(hamMetin);
  }, [hamMetin]);

  const basliklar = useMemo<readonly string[]>(() => {
    const ilk = cozum?.satirlar[0];
    if (ilk === undefined) return [];
    return baslikVar ? ilk : ilk.map((_, i) => t('kolonNo', { no: i + 1 }));
  }, [cozum, baslikVar, t]);

  const satirlar: readonly SatirSonucu[] = useMemo(() => {
    if (cozum === null) return [];
    return satirlariCoz(cozum.satirlar, eslesme, baslikVar);
  }, [cozum, eslesme, baslikVar]);

  const gecerliler = satirlar.filter((s) => s.deger !== null);
  const hataliSayisi = satirlar.length - gecerliler.length;
  const eksikZorunlu = ZORUNLU_ALANLAR.filter((a) => eslesme[a] < 0);

  const dosyaOku = useCallback((dosya: File) => {
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      const metin = typeof okuyucu.result === 'string' ? okuyucu.result : '';
      setHamMetin(metin);
      const ayristirilmis = csvAyristir(metin);
      const ilk = ayristirilmis.satirlar[0];
      if (ilk !== undefined) setEslesme(otomatikEsle(ilk));
    };
    // UTF-8 okunur; BOM ayristiricida atilir.
    okuyucu.readAsText(dosya, 'utf-8');
  }, []);

  const sablonIndir = () => {
    const blob = new Blob([sablonCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const bag = document.createElement('a');
    bag.href = url;
    bag.download = 'bolum-sablonu.csv';
    bag.click();
    URL.revokeObjectURL(url);
  };

  const gonder = async () => {
    const secilenKat = katlar.find((k) => k.id === katId);
    const no = secilenKat === undefined ? Number(katNo) : secilenKat.no;
    if (!Number.isInteger(no) || no < -10 || no > 200) {
      bildirim.hata(t('hataKatNo'));
      return;
    }
    setGonderiliyor(true);
    try {
      await servis.bolumTopluOlustur(
        blokId,
        secilenKat === undefined ? null : secilenKat.id,
        no,
        gecerliler.map((s) => s.deger as NonNullable<SatirSonucu['deger']>),
      );
      bildirim.basari(t('aktarildi', { sayi: gecerliler.length }));
      yonlendir.push('/bolumler');
    } catch (h) {
      bildirim.hata(hataMetni(h, t('aktarilamadi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('bolumler'), yol: '/bolumler' },
        { etiket: t('baslik') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <AdimGostergesi adim={adim} />

        {/* --- Adim 1: hedef --- */}
        {adim === 1 && (
          <div className="glass p-[var(--cardpad)] flex flex-col gap-4">
            <h2 className="font-semibold">{t('adim1')}</h2>
            <p className="text-sm text-[color:var(--muted)]">{t('adim1Aciklama')}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--muted-2)]">{t('blok')}</span>
                <select className={alanSinifi} value={blokId}
                        onChange={(e) => setBlokId(e.target.value)}>
                  <option value="">{t('seciniz')}</option>
                  {bloklar.map((b) => (
                    <option key={b.id} value={b.id}>{b.ad} — {b.apartmanAdi}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--muted-2)]">{t('kat')}</span>
                <select className={alanSinifi} value={katId} disabled={blokId === ''}
                        onChange={(e) => setKatId(e.target.value)}>
                  <option value="">{t('katKaydiYok')}</option>
                  {katlar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad ?? t('katNo', { no: k.no })}
                    </option>
                  ))}
                </select>
              </label>

              {/* Kat KAYDI secilmediyse numara elle girilir; bolumun `kat`
                  alani zorunludur ve kat kaydi olmadan da anlamlidir. */}
              {katId === '' && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[color:var(--muted-2)]">{t('katNoAlani')}</span>
                  <input className={alanSinifi} type="number" value={katNo}
                         min={-10} max={200}
                         onChange={(e) => setKatNo(e.target.value)} />
                </label>
              )}
            </div>

            {katId !== '' && (
              <p className="text-xs text-[color:var(--muted)]">{t('katEsitlemeIpucu')}</p>
            )}

            <div className="flex gap-2">
              <button type="button" disabled={blokId === ''} onClick={() => setAdim(2)}
                      className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-50"
                      style={{ backgroundImage: 'var(--grad)' }}>
                {t('devam')}
              </button>
              <Link href="/bolumler"
                    className="px-4 h-[var(--rowh)] inline-flex items-center rounded-[var(--rs)] border border-[color:var(--line)]">
                {tg('iptal')}
              </Link>
            </div>
          </div>
        )}

        {/* --- Adim 2: dosya ve eslestirme --- */}
        {adim === 2 && (
          <div className="glass p-[var(--cardpad)] flex flex-col gap-4">
            <h2 className="font-semibold">{t('adim2')}</h2>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--muted-2)]">{t('dosyaSec')}</span>
                <input type="file" accept=".csv,text/csv" className="text-sm"
                       onChange={(e) => {
                         const d = e.target.files?.[0];
                         if (d !== undefined) dosyaOku(d);
                       }} />
              </label>

              <button type="button" onClick={sablonIndir}
                      className="px-3 h-[var(--rowh)] text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
                {t('sablonIndir')}
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-[color:var(--muted-2)]">{t('yapistir')}</span>
              <textarea
                className="px-3 py-2 rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent font-mono text-xs"
                rows={6} value={hamMetin}
                onChange={(e) => {
                  setHamMetin(e.target.value);
                  const ilk = csvAyristir(e.target.value).satirlar[0];
                  if (ilk !== undefined) setEslesme(otomatikEsle(ilk));
                }}
              />
            </label>

            {cozum !== null && (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={baslikVar}
                         onChange={(e) => setBaslikVar(e.target.checked)} />
                  {t('ilkSatirBaslik')}
                </label>

                <p className="text-xs text-[color:var(--muted)]">
                  {t('ayiriciSezildi', {
                    ayirici: cozum.ayirici === '\t' ? t('sekme') : cozum.ayirici,
                  })}
                </p>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ICE_AKTARIM_ALANLARI.map((alan) => {
                    const zorunlu = ZORUNLU_ALANLAR.includes(alan);
                    const eksik = zorunlu && eslesme[alan] < 0;
                    return (
                      <label key={alan} className="flex flex-col gap-1">
                        <span className="text-xs text-[color:var(--muted-2)]">
                          {t(`alan_${alan}`)}{zorunlu ? ' *' : ''}
                        </span>
                        <select
                          className={alanSinifi}
                          value={eslesme[alan]}
                          aria-invalid={eksik}
                          style={eksik ? { borderColor: 'var(--crit)' } : undefined}
                          onChange={(e) =>
                            setEslesme((m) => ({ ...m, [alan]: Number(e.target.value) }))}
                        >
                          <option value={-1}>{t('eslesmeYok')}</option>
                          {basliklar.map((b, i) => (
                            <option key={`${b}-${i}`} value={i}>{b}</option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>

                {eksikZorunlu.length > 0 && (
                  <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>
                    {t('zorunluEksik', {
                      alanlar: eksikZorunlu.map((a) => t(`alan_${a}`)).join(', '),
                    })}
                  </p>
                )}
              </>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setAdim(1)}
                      className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
                {t('geri')}
              </button>
              <button type="button" onClick={() => setAdim(3)}
                      disabled={cozum === null || eksikZorunlu.length > 0}
                      className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-50"
                      style={{ backgroundImage: 'var(--grad)' }}>
                {t('onizle')}
              </button>
            </div>
          </div>
        )}

        {/* --- Adim 3: onizleme --- */}
        {adim === 3 && (
          <div className="glass p-[var(--cardpad)] flex flex-col gap-4">
            <h2 className="font-semibold">{t('adim3')}</h2>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="num">{t('gecerliSayisi', { sayi: gecerliler.length })}</span>
              <span className="num" style={hataliSayisi > 0 ? { color: 'var(--crit)' } : undefined}>
                {t('hataliSayisi', { sayi: hataliSayisi })}
              </span>
            </div>

            {/* Hatali satirlar SESSIZCE ATLANMAZ; gonderilmeyecegi yazilir. */}
            {hataliSayisi > 0 && (
              <p className="text-xs p-2 rounded-[var(--rs)]"
                 style={{ border: '1px solid var(--crit)', color: 'var(--crit)' }}>
                {t('hataliAtlanir')}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <caption className="sr">{t('onizlemeTablosu')}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-2 text-left border-b border-[color:var(--line)]">
                      {t('satirNo')}
                    </th>
                    {ICE_AKTARIM_ALANLARI.map((a) => (
                      <th key={a} scope="col"
                          className="p-2 text-left border-b border-[color:var(--line)] whitespace-nowrap">
                        {t(`alan_${a}`)}
                      </th>
                    ))}
                    <th scope="col" className="p-2 text-left border-b border-[color:var(--line)]">
                      {t('durum')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {satirlar.map((s) => (
                    <tr key={s.satirNo} className="border-b border-[color:var(--line)]">
                      <td className="p-2 num">{s.satirNo}</td>
                      {ICE_AKTARIM_ALANLARI.map((a) => (
                        <td key={a} className="p-2 whitespace-nowrap">
                          {eslesme[a] < 0 ? '—' : (s.ham[eslesme[a]] ?? '')}
                        </td>
                      ))}
                      <td className="p-2">
                        {s.hatalar.length === 0 ? (
                          <span style={{ color: 'var(--success)' }}>{t('gecerli')}</span>
                        ) : (
                          <ul className="text-xs" style={{ color: 'var(--crit)' }}>
                            {s.hatalar.map((h, i) => (
                              <li key={`${h.alan}-${i}`}>
                                {t(`alan_${h.alan}`)}: {t(h.anahtar, h.baglam ?? {})}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[color:var(--muted)]">{t('arsaPayiIpucu')}</p>

            <div className="flex gap-2">
              <button type="button" onClick={() => setAdim(2)}
                      className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
                {t('geri')}
              </button>
              <button type="button" onClick={() => { void gonder(); }}
                      disabled={gecerliler.length === 0 || gonderiliyor}
                      className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-50"
                      style={{ backgroundImage: 'var(--grad)' }}>
                {gonderiliyor
                  ? tg('yukleniyor')
                  : t('aktar', { sayi: gecerliler.length })}
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-[color:var(--muted)]">{tb('baslik')} · {t('tekIslemIpucu')}</p>
      </div>
    </UygulamaKabugu>
  );
}

function AdimGostergesi({ adim }: { readonly adim: 1 | 2 | 3 }) {
  const t = useTranslations('iceAktar');
  const adimlar = [t('adim1Kisa'), t('adim2Kisa'), t('adim3Kisa')];
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label={t('adimlar')}>
      {adimlar.map((ad, i) => {
        const sira = i + 1;
        const aktif = sira === adim;
        return (
          <li key={ad}
              aria-current={aktif ? 'step' : undefined}
              className="px-3 py-1 rounded-[var(--rs)] border"
              style={{
                borderColor: aktif ? 'var(--primary)' : 'var(--line)',
                color: sira <= adim ? 'var(--text)' : 'var(--muted-2)',
              }}>
            <span className="num">{sira}.</span> {ad}
          </li>
        );
      })}
    </ol>
  );
}
