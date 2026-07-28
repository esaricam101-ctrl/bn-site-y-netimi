'use client';

/**
 * 360° Daire Kartı — bir bağımsız bölümün tüm bilgisi tek ekranda.
 *
 * Veri kaynağı `GET /daireler/:bolumId/kart`: bölüm · malikler · hisse durumu ·
 * kiracılar · sakinler TEK çağrıda gelir. Dört ayrı istek, ekranın dört ayrı
 * anlık görüntüyü birleştirmesi demektir.
 *
 * Denetim kayıtları ayrı uçtan (`GET /audit`) ve YALNIZCA sekmesi açıldığında
 * çekilir — kart açılışında herkesin ihtiyaç duymadığı bir sorgu atmak
 * gereksiz gecikmedir.
 *
 * Araç · Sayaç · Belge · Not sekmeleri için BACKEND YOKTUR (tablo yok,
 * migration bekliyor). Bu sekmeler sahte veri göstermez; ne eksik olduğunu
 * açıkça yazar.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { SekmeCubugu, SekmePaneli, type Sekme } from '@/components/daire/sekmeler';
import { HazirDegil } from '@/components/daire/hazir-degil';
import { MalikEkleFormu } from '@/components/malik/malik-ekle-formu';
import { MalikEylemleri } from '@/components/malik/malik-eylemleri';
import { servis, type AuditSatiri, type DaireKarti } from '@/lib/servis';

function Alan({ etiket, deger }: { readonly etiket: string; readonly deger: string }) {
  return (
    <div>
      <dt className="text-xs text-[color:var(--muted-2)]">{etiket}</dt>
      <dd className="text-sm mt-0.5">{deger}</dd>
    </div>
  );
}

function Kutu({ baslik, children }: { readonly baslik: string; readonly children: React.ReactNode }) {
  return (
    <section className="glass p-[var(--cardpad)]">
      <h2 className="font-semibold mb-3">{baslik}</h2>
      {children}
    </section>
  );
}

export default function DaireKartiSayfasi({
  params,
}: {
  readonly params: { readonly bolumId: string };
}) {
  const t = useTranslations('daire');
  const tb = useTranslations('bolum');
  const tm = useTranslations('malik');
  const tn = useTranslations('navigasyon');
  const tg = useTranslations('genel');

  const [kart, setKart] = useState<DaireKarti | null>(null);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [etkinSekme, setEtkinSekme] = useState('ozet');

  const [audit, setAudit] = useState<readonly AuditSatiri[] | null>(null);
  const [auditYukleniyor, setAuditYukleniyor] = useState(false);
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    servis.daireKarti(params.bolumId).then(setKart).catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [params.bolumId]);

  useEffect(yukle, [yukle]);

  // Denetim kayitlari YALNIZCA sekme acilinca cekilir.
  useEffect(() => {
    if (etkinSekme !== 'gecmis' || audit !== null || auditYukleniyor) return;
    setAuditYukleniyor(true);
    servis
      .auditKayitlari('BagimsizBolum', params.bolumId)
      .then((s) => setAudit(s.kayitlar))
      .catch(() => setAudit([]))
      .finally(() => setAuditYukleniyor(false));
  }, [etkinSekme, audit, auditYukleniyor, params.bolumId]);

  if (yukleniyor) {
    return <UygulamaKabugu baslik={t('baslik')}><Yukleniyor satir={8} /></UygulamaKabugu>;
  }
  if (hata !== null) {
    return (
      <UygulamaKabugu baslik={t('baslik')}>
        <HataDurumu hata={hata} tekrarDene={yukle} />
      </UygulamaKabugu>
    );
  }
  if (kart === null) {
    return <UygulamaKabugu baslik={t('baslik')}><BosDurum /></UygulamaKabugu>;
  }

  const b = kart.bolum;
  const gecerliMalikler = kart.malikler.filter((m) => m.gecerliMi);
  const gecerliKiracilar = kart.kiracilar.filter((k) => k.gecerliMi);
  const gecerliSakinler = kart.sakinler.filter((s) => s.gecerliMi);

  const sekmeler: readonly Sekme[] = [
    { anahtar: 'ozet', baslik: t('sekmeOzet') },
    { anahtar: 'malikler', baslik: t('sekmeMalikler'), rozet: gecerliMalikler.length },
    { anahtar: 'kiracilar', baslik: t('sekmeKiracilar'), rozet: gecerliKiracilar.length },
    { anahtar: 'sakinler', baslik: t('sekmeSakinler'), rozet: gecerliSakinler.length },
    { anahtar: 'gecmis', baslik: t('sekmeGecmis') },
    { anahtar: 'araclar', baslik: t('sekmeAraclar'), hazirDegil: true },
    { anahtar: 'sayaclar', baslik: t('sekmeSayaclar'), hazirDegil: true },
    { anahtar: 'belgeler', baslik: t('sekmeBelgeler'), hazirDegil: true },
    { anahtar: 'notlar', baslik: t('sekmeNotlar'), hazirDegil: true },
  ];

  return (
    <UygulamaKabugu
      baslik={`${t('baslik')} — ${b.kapiNo}`}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('bolumler'), yol: '/bolumler' },
        { etiket: b.kapiNo },
      ]}
    >
      {/* Hisse uyarisi — tahakkuk oncesi kapi, en ustte durur. */}
      {!kart.hisseDurumu.gecerli && (
        <div role="alert" className="glass p-[var(--cardpad)] mb-4 border-l-4"
             style={{ borderLeftColor: 'var(--crit)' }}>
          <p className="font-semibold">{t('hisseUyarisi')}</p>
          <p className="text-sm mt-1">{kart.hisseDurumu.mesaj}</p>
        </div>
      )}

      <SekmeCubugu sekmeler={sekmeler} etkin={etkinSekme} onDegisti={setEtkinSekme} />

      {/* --- Özet --- */}
      <SekmePaneli anahtar="ozet" etkin={etkinSekme}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Kutu baslik={t('kimlik')}>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Alan etiket={tb('kapiNo')} deger={b.kapiNo} />
              <Alan etiket={tb('icKapiNo')} deger={b.icKapiNo ?? '—'} />
              <Alan etiket={tb('kat')} deger={String(b.kat)} />
              <Alan etiket={tb('nitelik')} deger={tb(`nitelik_${b.nitelik}`)} />
              <Alan etiket={tb('daireTipi')}
                    deger={b.daireTipi === null ? '—' : tb(`daireTipi_${b.daireTipi}`)} />
              <Alan etiket={tb('durum')} deger={tb(`durum_${b.durum}`)} />
            </dl>
          </Kutu>

          <Kutu baslik={t('olculer')}>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Alan etiket={tb('brutM2')} deger={`${b.brutM2} m²`} />
              <Alan etiket={tb('netM2')} deger={`${b.netM2} m²`} />
              <Alan etiket={tb('arsaPayi')} deger={b.arsaPayi} />
            </dl>
          </Kutu>

          {/*
            Tapu bilgileri gercek uctan gelir ancak mock katmani bu alanlari
            tasimaz; gercek API'ye gecince dolar.
          */}
          <Kutu baslik={t('konum')}>
            <p className="text-sm text-[color:var(--muted)]">{t('haritaHazir')}</p>
            <div
              className="mt-3 h-32 rounded-[var(--rs)] border border-dashed border-[color:var(--line)] flex items-center justify-center text-[color:var(--muted-2)] text-sm"
              role="img"
              aria-label={t('haritaYerTutucu')}
            >
              {t('haritaYerTutucu')}
            </div>
          </Kutu>

          <Kutu baslik={t('fotograflar')}>
            <p className="text-sm text-[color:var(--muted)]">{t('fotografHazir')}</p>
          </Kutu>
        </div>
      </SekmePaneli>

      {/* --- Malikler --- */}
      <SekmePaneli anahtar="malikler" etkin={etkinSekme}>
        <div className="flex flex-col gap-4">
          {!formAcik && (
            <button
              type="button"
              onClick={() => setFormAcik(true)}
              className="self-start px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold"
              style={{ backgroundImage: 'var(--grad)' }}
            >
              {tm('yeniMalik')}
            </button>
          )}

          {formAcik && (
            <MalikEkleFormu
              bolumId={params.bolumId}
              onEklendi={() => { setFormAcik(false); yukle(); }}
              onIptal={() => setFormAcik(false)}
            />
          )}

          {kart.malikler.length === 0 ? (
            <BosDurum aciklama={t('malikYok')} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {kart.malikler.map((m) => (
                <div key={m.id} className="glass p-[var(--cardpad)]"
                     style={{ opacity: m.gecerliMi ? 1 : 0.6 }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{m.kisiAdi}</p>
                    <span className="text-sm num">{m.hisse}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 mt-3">
                    <Alan etiket={t('tapuTuru')} deger={t(`tapuTuru_${m.tapuTuru}`)} />
                    <Alan etiket={t('tapuBaslangic')} deger={m.tapuBaslangic} />
                    <Alan etiket={t('tapuBitis')} deger={m.tapuBitis ?? t('surüyor')} />
                    <Alan etiket={t('yevmiyeNo')} deger={m.tapuYevmiyeNo ?? '—'} />
                  </dl>
                  {m.vekilAdi !== null && (
                    <p className="text-sm mt-3 pt-3 border-t border-[color:var(--line)]">
                      <span className="text-[color:var(--muted-2)]">{t('vekil')}: </span>
                      {m.vekilAdi} ({m.vekaletnameNo})
                    </p>
                  )}
                  {!m.gecerliMi && (
                    <p className="text-xs mt-2 text-[color:var(--muted-2)]">{t('gecmisKayit')}</p>
                  )}

                  {/* Devret ve Duzelt AYRI eylemlerdir — bkz. malik-eylemleri.tsx */}
                  <MalikEylemleri bolumId={params.bolumId} malik={m} onDegisti={yukle} />
                </div>
              ))}
            </div>
          )}
        </div>
      </SekmePaneli>

      {/* --- Kiracılar --- */}
      <SekmePaneli anahtar="kiracilar" etkin={etkinSekme}>
        {kart.kiracilar.length === 0 ? (
          <BosDurum aciklama={t('kiraciYok')} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {kart.kiracilar.map((k) => (
              <div key={k.id} className="glass p-[var(--cardpad)]"
                   style={{ opacity: k.gecerliMi ? 1 : 0.6 }}>
                <p className="font-semibold">{k.kisiAdi}</p>
                <dl className="grid grid-cols-2 gap-2 mt-3">
                  <Alan etiket={t('sozlesmeNo')} deger={k.sozlesmeNo ?? '—'} />
                  <Alan etiket={t('sozlesmeTarihi')} deger={k.sozlesmeTarihi ?? '—'} />
                  <Alan etiket={t('baslangic')} deger={k.baslangic} />
                  <Alan etiket={t('bitis')} deger={k.bitis ?? t('surüyor')} />
                  <Alan etiket={t('depozito')} deger={k.depozito ?? '—'} />
                  <Alan etiket={t('tahliye')} deger={k.tahliyeTarihi ?? '—'} />
                </dl>
                {k.tahliyeGerekcesi !== null && (
                  <p className="text-sm mt-3 pt-3 border-t border-[color:var(--line)]">
                    <span className="text-[color:var(--muted-2)]">{t('tahliyeGerekcesi')}: </span>
                    {k.tahliyeGerekcesi}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SekmePaneli>

      {/* --- Sakinler --- */}
      <SekmePaneli anahtar="sakinler" etkin={etkinSekme}>
        {kart.sakinler.length === 0 ? (
          <BosDurum aciklama={t('sakinYok')} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {kart.sakinler.map((s) => (
              <div key={s.id} className="glass p-[var(--cardpad)]"
                   style={{ opacity: s.gecerliMi ? 1 : 0.6 }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{s.kisiAdi}</p>
                  <span className="text-xs text-[color:var(--muted)]">
                    {t(`yakinlik_${s.yakinlikDerecesi}`)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 mt-3">
                  <Alan etiket={t('telefon')} deger={s.telefon ?? '—'} />
                  <Alan etiket={t('eposta')} deger={s.eposta ?? '—'} />
                  <Alan etiket={t('girisTarihi')} deger={s.girisTarihi} />
                  <Alan etiket={t('cikisTarihi')} deger={s.cikisTarihi ?? t('oturuyor')} />
                </dl>
                {s.acilDurumKisiAdi !== null && (
                  <p className="text-sm mt-3 pt-3 border-t border-[color:var(--line)]">
                    <span className="text-[color:var(--muted-2)]">{t('acilDurum')}: </span>
                    {s.acilDurumKisiAdi} — {s.acilDurumTelefon}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SekmePaneli>

      {/* --- Geçmiş işlemler --- */}
      <SekmePaneli anahtar="gecmis" etkin={etkinSekme}>
        {auditYukleniyor && <Yukleniyor satir={4} />}
        {!auditYukleniyor && audit !== null && audit.length === 0 && (
          <BosDurum aciklama={t('gecmisYok')} />
        )}
        {!auditYukleniyor && audit !== null && audit.length > 0 && (
          <ol className="flex flex-col gap-2">
            {audit.map((a) => (
              <li key={a.id} className="glass p-[var(--cardpad)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm">{t(`eylem_${a.eylem}`)}</span>
                  <time className="text-xs num text-[color:var(--muted-2)]" dateTime={a.olusmaAni}>
                    {new Date(a.olusmaAni).toLocaleString('tr-TR')}
                  </time>
                </div>
                <p className="text-xs mt-1 text-[color:var(--muted)]">
                  {t('yapan')}: {a.principalId} ({a.principalTipi})
                </p>
                {a.gerekce !== null && (
                  <p className="text-sm mt-1">
                    <span className="text-[color:var(--muted-2)]">{tg('sil')}: </span>
                    {a.gerekce}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </SekmePaneli>

      {/* --- Backend'i olmayan sekmeler: SAHTE VERİ YOK --- */}
      <SekmePaneli anahtar="araclar" etkin={etkinSekme}>
        <HazirDegil baslik={t('sekmeAraclar')} gerekce={t('gerekceArac')} />
      </SekmePaneli>
      <SekmePaneli anahtar="sayaclar" etkin={etkinSekme}>
        <HazirDegil baslik={t('sekmeSayaclar')} gerekce={t('gerekceSayac')} />
      </SekmePaneli>
      <SekmePaneli anahtar="belgeler" etkin={etkinSekme}>
        <HazirDegil baslik={t('sekmeBelgeler')} gerekce={t('gerekceBelge')} />
      </SekmePaneli>
      <SekmePaneli anahtar="notlar" etkin={etkinSekme}>
        <HazirDegil baslik={t('sekmeNotlar')} gerekce={t('gerekceNot')} />
      </SekmePaneli>
    </UygulamaKabugu>
  );
}
