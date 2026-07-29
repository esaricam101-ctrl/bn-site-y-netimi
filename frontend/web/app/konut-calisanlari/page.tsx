'use client';

/**
 * Konut çalışanları — sitede/apartmanda çalışan personel.
 *
 * MALİK · KİRACI · SAKİN ekranlarından tümüyle AYRIDIR: personel bir istihdam
 * kaydıdır, ötekiler bağımsız bölüme bağlı hak sahipliği kayıtlarıdır.
 *
 * İKİ UYARI HER ZAMAN ÜSTTE:
 *   1. Süresi dolmuş sertifika — süresi geçmiş güvenlik kartıyla çalıştırmak
 *      idari yaptırım sebebidir ve ancak takip edilirse görülür.
 *   2. Açık zimmet — işten ayrılan personelin üzerinde kalan telsiz/anahtar.
 * İkisi de listede gizlenmez; sayıları başlıkta durur.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { PERSONEL_GOREVLERI, PERSONEL_DURUMLARI, VARDIYALAR } from '@/lib/kodlar';
import { servis, type KonutCalisani } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const alanSinifi =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function KonutCalisanlariSayfasi() {
  const t = useTranslations('personel');
  const tn = useTranslations('navigasyon');

  const [satirlar, setSatirlar] = useState<readonly KonutCalisani[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);

  const [gorev, setGorev] = useState('');
  const [durum, setDurum] = useState('AKTIF');
  const [arama, setArama] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis
      .konutCalisanlari({
        ...(gorev === '' ? {} : { gorev }),
        ...(durum === '' ? {} : { durum }),
        ...(arama.trim() === '' ? {} : { arama: arama.trim() }),
      })
      .then(setSatirlar)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [gorev, durum, arama]);

  useEffect(yukle, [yukle]);

  const sertifikaUyarisi = useMemo(
    () => satirlar.filter((c) => c.suresiDolanSertifikaSayisi > 0).length,
    [satirlar],
  );
  const zimmetUyarisi = useMemo(
    () => satirlar.filter((c) => c.acikZimmetSayisi > 0).length,
    [satirlar],
  );

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('konutCalisanlari') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {/* Uyarılar listenin ÜSTÜNDE: takip edilmezse görülmezler. */}
        {(sertifikaUyarisi > 0 || zimmetUyarisi > 0) && (
          <div className="flex flex-wrap gap-2" aria-live="polite">
            {sertifikaUyarisi > 0 && (
              <span className="px-3 py-1.5 text-sm rounded-[var(--rs)] border"
                    style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
                ⚠ {t('sertifikaUyarisi', { sayi: sertifikaUyarisi })}
              </span>
            )}
            {zimmetUyarisi > 0 && (
              <span className="px-3 py-1.5 text-sm rounded-[var(--rs)] border"
                    style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
                {t('zimmetUyarisi', { sayi: zimmetUyarisi })}
              </span>
            )}
          </div>
        )}

        {/* Süzgeçler */}
        <div className="flex flex-wrap items-end gap-2 baski-gizle">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('gorev')}</span>
            <select className={`${alanSinifi} w-48`} value={gorev}
                    onChange={(e) => setGorev(e.target.value)}>
              <option value="">{t('tumGorevler')}</option>
              {PERSONEL_GOREVLERI.map((g) => (
                <option key={g} value={g}>{t(`gorev_${g}`)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('durum')}</span>
            <select className={`${alanSinifi} w-40`} value={durum}
                    onChange={(e) => setDurum(e.target.value)}>
              <option value="">{t('tumDurumlar')}</option>
              {PERSONEL_DURUMLARI.map((d) => (
                <option key={d} value={d}>{t(`durum_${d}`)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 flex-1 min-w-48">
            <span className="text-xs text-[color:var(--muted-2)]">{t('ara')}</span>
            <input type="search" className={alanSinifi} value={arama}
                   placeholder={t('aramaIpucu')}
                   onChange={(e) => setArama(e.target.value)} />
          </label>

          {!formAcik && (
            <button type="button" onClick={() => setFormAcik(true)}
                    className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
                    style={{ backgroundImage: 'var(--grad)' }}>
              {t('yeniPersonel')}
            </button>
          )}
        </div>

        {formAcik && (
          <PersonelFormu
            onKaydedildi={() => { setFormAcik(false); yukle(); }}
            onIptal={() => setFormAcik(false)}
          />
        )}

        {yukleniyor && <Yukleniyor satir={5} />}
        {!yukleniyor && hata !== null && <HataDurumu hata={hata} tekrarDene={yukle} />}
        {!yukleniyor && hata === null && satirlar.length === 0 && (
          <BosDurum aciklama={t('bosAciklama')} />
        )}

        {!yukleniyor && hata === null && satirlar.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {satirlar.map((c) => (
              <PersonelKarti key={c.id} calisan={c} onDegisti={yukle} />
            ))}
          </div>
        )}
      </div>
    </UygulamaKabugu>
  );
}

function PersonelKarti({
  calisan, onDegisti,
}: {
  readonly calisan: KonutCalisani;
  readonly onDegisti: () => void;
}) {
  const t = useTranslations('personel');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [ayrilAcik, setAyrilAcik] = useState(false);
  const [tarih, setTarih] = useState('');
  const [gerekce, setGerekce] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const ayrildi = calisan.istenAyrilisTarihi !== null;

  const ayril = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gerekce.trim().length < 5) { bildirim.hata(t('hataGerekce')); return; }
    setGonderiliyor(true);
    try {
      await servis.calisanAyril(calisan.id, tarih, gerekce.trim());
      bildirim.basari(t('ayrildi'));
      setAyrilAcik(false);
      onDegisti();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('ayrilamadi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="glass p-[var(--cardpad)] flex flex-col gap-3"
         style={{ opacity: ayrildi ? 0.65 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{calisan.adSoyad}</h2>
          <p className="text-sm text-[color:var(--muted)]">
            {t(`gorev_${calisan.gorev}`)}
            {calisan.departman !== null && ` · ${calisan.departman}`}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap"
              style={{
                borderColor: ayrildi ? 'var(--muted)' : 'var(--success)',
                color: ayrildi ? 'var(--muted)' : 'var(--success)',
              }}>
          {t(`durum_${calisan.durum}`)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-[color:var(--muted-2)]">{t('vardiya')}</dt>
        <dd>{t(`vardiya_${calisan.vardiya}`)}</dd>
        <dt className="text-[color:var(--muted-2)]">{t('iseGiris')}</dt>
        <dd className="num">{calisan.iseGirisTarihi}</dd>
        {ayrildi && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('ayrilis')}</dt>
            <dd className="num">{calisan.istenAyrilisTarihi}</dd>
          </>
        )}
        {calisan.telefon !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('telefon')}</dt>
            <dd className="num">{calisan.telefon}</dd>
          </>
        )}
        {calisan.apartmanAdi !== null && (
          <>
            <dt className="text-[color:var(--muted-2)]">{t('calistigiYer')}</dt>
            <dd>{calisan.apartmanAdi}</dd>
          </>
        )}
      </dl>

      {/* Sertifika ve zimmet SAYILARLA gösterilir; sorun varsa renklenir. */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('sertifikaSayisi', { sayi: calisan.sertifikalar.length })}
        </span>
        {calisan.suresiDolanSertifikaSayisi > 0 && (
          <span className="px-2 py-1 rounded-[var(--rs)] border"
                style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
            {t('sertifikaDolan', { sayi: calisan.suresiDolanSertifikaSayisi })}
          </span>
        )}
        <span className="px-2 py-1 rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('zimmetSayisi', { sayi: calisan.zimmetler.length })}
        </span>
        {calisan.acikZimmetSayisi > 0 && (
          <span className="px-2 py-1 rounded-[var(--rs)] border"
                style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
            {t('zimmetAcik', { sayi: calisan.acikZimmetSayisi })}
          </span>
        )}
      </div>

      {!ayrildi && !ayrilAcik && (
        <button type="button" onClick={() => setAyrilAcik(true)}
                className="self-start px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)] baski-gizle">
          {t('ayrilisKaydet')}
        </button>
      )}

      {ayrilAcik && (
        <form onSubmit={(e) => { void ayril(e); }}
              className="flex flex-col gap-2 pt-2 border-t border-[color:var(--line)] baski-gizle">
          {/* Açık zimmet ENGELLEMEZ ama UYARIR: teslim edilmemiş telsiz,
              kaydı kapatmamak için sebep değildir; görünür olması yeter. */}
          {calisan.acikZimmetSayisi > 0 && (
            <p className="text-xs" style={{ color: 'var(--warn)' }}>
              {t('ayrilisZimmetUyarisi', { sayi: calisan.acikZimmetSayisi })}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('ayrilisTarihi')}</span>
            <input type="date" className={alanSinifi} value={tarih} required
                   min={calisan.iseGirisTarihi}
                   onChange={(e) => setTarih(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[color:var(--muted-2)]">{t('ayrilisGerekce')}</span>
            <input className={alanSinifi} value={gerekce} required
                   onChange={(e) => setGerekce(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={gonderiliyor}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
                    style={{ backgroundImage: 'var(--grad)' }}>
              {gonderiliyor ? tg('yukleniyor') : t('ayrilisKaydet')}
            </button>
            <button type="button" onClick={() => setAyrilAcik(false)}
                    className="px-3 py-1.5 text-sm rounded-[var(--rs)] border border-[color:var(--line)]">
              {tg('iptal')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function PersonelFormu({
  onKaydedildi, onIptal,
}: {
  readonly onKaydedildi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('personel');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [gorev, setGorev] = useState<string>('GUVENLIK');
  const [departman, setDepartman] = useState('');
  const [telefon, setTelefon] = useState('');
  const [eposta, setEposta] = useState('');
  const [tcKimlikNo, setTcKimlikNo] = useState('');
  const [sgkNo, setSgkNo] = useState('');
  const [iseGirisTarihi, setIseGirisTarihi] = useState('');
  const [vardiya, setVardiya] = useState<string>('GUNDUZ');
  const [notlar, setNotlar] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  // Gönderim engelleri AÇIKÇA hesaplanır; düğme neden kapalı yazılır.
  const engel: string | null = (() => {
    if (ad.trim().length < 2) return t('hataAd');
    if (soyad.trim().length < 2) return t('hataSoyad');
    if (iseGirisTarihi === '') return t('hataIseGiris');
    if (tcKimlikNo !== '' && !/^[0-9]{11}$/u.test(tcKimlikNo)) return t('hataTc');
    return null;
  })();

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (engel !== null) { bildirim.hata(engel); return; }
    setGonderiliyor(true);
    try {
      await servis.calisanEkle({
        ad: ad.trim(), soyad: soyad.trim(), gorev,
        ...(departman.trim() === '' ? {} : { departman: departman.trim() }),
        ...(telefon.trim() === '' ? {} : { telefon: telefon.trim() }),
        ...(eposta.trim() === '' ? {} : { eposta: eposta.trim() }),
        ...(tcKimlikNo === '' ? {} : { tcKimlikNo }),
        ...(sgkNo.trim() === '' ? {} : { sgkNo: sgkNo.trim() }),
        iseGirisTarihi, vardiya,
        ...(notlar.trim() === '' ? {} : { notlar: notlar.trim() }),
      });
      bildirim.basari(t('eklendi'));
      onKaydedildi();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('eklenemedi')));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h2 className="font-semibold">{t('yeniPersonel')}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('ad')}</span>
          <input className={alanSinifi} value={ad} required
                 onChange={(e) => setAd(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('soyad')}</span>
          <input className={alanSinifi} value={soyad} required
                 onChange={(e) => setSoyad(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('gorev')}</span>
          <select className={alanSinifi} value={gorev}
                  onChange={(e) => setGorev(e.target.value)}>
            {PERSONEL_GOREVLERI.map((g) => (
              <option key={g} value={g}>{t(`gorev_${g}`)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('departman')}</span>
          <input className={alanSinifi} value={departman}
                 onChange={(e) => setDepartman(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('telefon')}</span>
          <input className={alanSinifi} value={telefon}
                 onChange={(e) => setTelefon(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('eposta')}</span>
          <input type="email" className={alanSinifi} value={eposta}
                 onChange={(e) => setEposta(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('tcKimlikNo')}</span>
          <input className={`${alanSinifi} num`} value={tcKimlikNo} inputMode="numeric"
                 maxLength={11}
                 onChange={(e) => setTcKimlikNo(e.target.value.replace(/\D/gu, ''))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('sgkNo')}</span>
          <input className={`${alanSinifi} num`} value={sgkNo}
                 onChange={(e) => setSgkNo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('iseGiris')}</span>
          <input type="date" className={alanSinifi} value={iseGirisTarihi} required
                 onChange={(e) => setIseGirisTarihi(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-[color:var(--muted-2)]">{t('vardiya')}</span>
          <select className={alanSinifi} value={vardiya}
                  onChange={(e) => setVardiya(e.target.value)}>
            {VARDIYALAR.map((v) => (
              <option key={v} value={v}>{t(`vardiya_${v}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-[color:var(--muted-2)]">{t('notlar')}</span>
          <input className={alanSinifi} value={notlar}
                 onChange={(e) => setNotlar(e.target.value)} />
        </label>
      </div>

      {/* KVKK: TC kimlik no zorunlu DEĞİLDİR. Bordro için gerekmiyorsa
          toplanmamalıdır — veri minimizasyonu (md. 4/1-ç). */}
      <p className="text-xs text-[color:var(--muted)]">{t('kvkkIpucu')}</p>

      {engel !== null && (
        <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>{engel}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={gonderiliyor || engel !== null}
                className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-50"
                style={{ backgroundImage: 'var(--grad)' }}>
          {gonderiliyor ? tg('yukleniyor') : tg('kaydet')}
        </button>
        <button type="button" onClick={onIptal}
                className="px-4 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
          {tg('iptal')}
        </button>
      </div>
    </form>
  );
}
