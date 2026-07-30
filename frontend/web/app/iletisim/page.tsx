'use client';

/**
 * İLETİŞİM — tek rota, kanal SEKMELERİ.
 *
 * ⚠️  WHATSAPP · SMS · E-POSTA AYRI EKRAN DEĞİLDİR. Üçü de "bir mesajı, bir
 *     alıcıya, bir kanaldan gönder"dir; gönderim formu, geçmiş tablosu ve
 *     durum raporu birebir aynıdır. Ayrı rotalar olsaydı bu iskelet üç kez
 *     yazılır ve biri düzeltildiğinde ötekiler sessizce eski davranırdı.
 *
 * ⚠️  SAĞLAYICI DURUMU GİZLENMEZ. Gerçek API bağlı değilken ekranın üstünde
 *     kalıcı bir uyarı durur: "kaydedilir ama GÖNDERİLMEZ". Gizlenseydi
 *     yönetici duyurunun gittiğini sanardı.
 *
 * ⚠️  MOCK YOKTUR. Uydurma bir gönderim geçmişi, gerçek bir geçmiş gibi
 *     görünür ve "bu kişiye haber verdik" sanılırdı.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { Sekmeler, type SekmeTanimi } from '@/components/sekmeler';
import {
  iletisim,
  type IletisimDurumRaporu, type MesajSablonuSatiri, type MesajSatiri,
} from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const ALAN =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

const KANALLAR = [
  { anahtar: 'WHATSAPP', etiket: 'WhatsApp' },
  { anahtar: 'SMS', etiket: 'SMS' },
  { anahtar: 'EPOSTA', etiket: 'E-posta' },
] as const;

const HEDEFLER = [
  'TUM_SITE', 'BLOK', 'KAT', 'DAIRE', 'MALIK', 'KIRACI', 'SAKIN',
  'DAIRE_GOREVLISI', 'YONETIM_KURULU', 'KISILER',
] as const;

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

export default function IletisimSayfasi() {
  const t = useTranslations('iletisim');
  const tn = useTranslations('navigasyon');
  const [etkinKanal, setEtkinKanal] = useState<string>('WHATSAPP');
  const [saglayici, setSaglayici] = useState<{ ad: string; etkinMi: boolean } | null>(null);

  useEffect(() => {
    iletisim.saglayici().then(setSaglayici).catch(() => setSaglayici(null));
  }, []);

  const sekmeler: readonly SekmeTanimi[] = KANALLAR.map((k) => ({
    anahtar: k.anahtar,
    etiket: k.etiket,
    icerik: <KanalPaneli kanal={k.anahtar} />,
  }));

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: t('baslik') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>

        {/*
          SAĞLAYICI UYARISI — kalıcı ve gizlenemez. Gerçek API bağlanana kadar
          hiçbir mesaj gitmez; bu bilgi ekranın en üstünde durmalıdır.
        */}
        {saglayici !== null && !saglayici.etkinMi && (
          <div className="rounded-[var(--rs)] border border-[color:var(--danger)] p-3 text-sm text-[color:var(--danger)]">
            {t('saglayiciYokUyarisi')}
          </div>
        )}

        <Sekmeler
          sekmeler={sekmeler}
          etkinAnahtar={etkinKanal}
          onDegisti={setEtkinKanal}
          etiket={t('baslik')}
        />
      </div>
    </UygulamaKabugu>
  );
}

/** Bir kanalın paneli: gönderim formu · durum raporu · geçmiş. */
function KanalPaneli({ kanal }: { kanal: string }) {
  const t = useTranslations('iletisim');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [sablonlar, setSablonlar] = useState<readonly MesajSablonuSatiri[]>([]);
  const [mesajlar, setMesajlar] = useState<readonly MesajSatiri[]>([]);
  const [rapor, setRapor] = useState<IletisimDurumRaporu | null>(null);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [hedefTipi, setHedefTipi] = useState<string>('TUM_SITE');
  const [sablonId, setSablonId] = useState('');
  const [govde, setGovde] = useState('');
  const [arama, setArama] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    Promise.all([
      iletisim.sablonlar(kanal),
      iletisim.mesajlar({ kanal, limit: 50, ...(arama === '' ? {} : { arama }) }),
      iletisim.durumRaporu(kanal),
    ])
      .then(([s, m, r]) => {
        setSablonlar(s);
        setMesajlar(m);
        setRapor(r);
      })
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [kanal, arama]);

  useEffect(yukle, [yukle]);

  const gonder = (): void => {
    if (sablonId === '' && govde.trim().length < 2) {
      bildirim.hata(t('govdeGerekli'));
      return;
    }
    setGonderiliyor(true);
    iletisim
      .gonderimOlustur({
        kanal, hedefTipi,
        ...(sablonId === '' ? { govde: govde.trim() } : { sablonId }),
      })
      .then((s) => {
        // ⚠️ UYARILAR GİZLENMEZ: "gönderildi" demek yerine gerçekte ne olduğu
        //    söylenir. `kuyruklanan = 0` ise kimse bilgilendirilmemiştir.
        if (s.uyarilar.length > 0) {
          for (const u of s.uyarilar) bildirim.hata(u);
        } else {
          bildirim.basari(t('gonderimOlusturuldu', { adet: s.kuyruklanan }));
        }
        setGovde('');
        yukle();
      })
      .catch((h: unknown) => bildirim.hata(hataMetni(h, t('gonderimHatasi'))))
      .finally(() => setGonderiliyor(false));
  };

  const yenidenGonder = (id: string): void => {
    iletisim
      .yenidenGonder(id)
      .then(() => { bildirim.basari(t('yenidenGonderildi')); yukle(); })
      .catch((h: unknown) => bildirim.hata(hataMetni(h, t('yenidenGonderimHatasi'))));
  };

  if (yukleniyor) return <Yukleniyor />;
  if (hata !== null) return <HataDurumu hata={hata} tekrarDene={yukle} />;

  return (
    <div className="flex flex-col gap-5">
      {/* --------------------------- Durum raporu --------------------------- */}
      {rapor !== null && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('durumRaporu')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <Kutu etiket={t('toplam')} deger={String(rapor.toplam)} />
            <Kutu etiket={t('basarili')} deger={String(rapor.basarili)} />
            <Kutu etiket={t('basarisiz')} deger={String(rapor.basarisiz)} />
            <Kutu etiket={t('bekleyen')} deger={String(rapor.bekleyen)} />
            <Kutu etiket={t('saglayiciYok')} deger={String(rapor.saglayiciYok)} />
            <Kutu etiket={t('izinYok')} deger={String(rapor.izinYok)} />
            <Kutu etiket={t('kontor')} deger={String(rapor.toplamKontor)} />
            {/*
              ⚠️ Başarı oranı `null` ise "%0" YAZILMAZ: hiç gönderim yok ile
                 hepsi başarısız aynı şey değildir.
            */}
            <Kutu
              etiket={t('basariOrani')}
              deger={rapor.basariOrani === null ? t('denenmedi') : `%${rapor.basariOrani}`}
            />
          </div>
          <p className="text-xs text-[color:var(--muted)]">
            {t('gunlukAylik', { gunluk: rapor.gunlukSayi, aylik: rapor.aylikSayi })}
          </p>
        </section>
      )}

      {/* ---------------------------- Gönderim ------------------------------ */}
      <section className="flex flex-col gap-2 baski-gizle">
        <h3 className="text-sm font-medium">{t('yeniGonderim')}</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs">
            {t('hedef')}
            <select className={ALAN} value={hedefTipi}
                    onChange={(e) => setHedefTipi(e.target.value)}>
              {HEDEFLER.map((h) => (
                <option key={h} value={h}>{t(`hedef_${h}`)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            {t('sablon')}
            <select className={ALAN} value={sablonId}
                    onChange={(e) => setSablonId(e.target.value)}>
              <option value="">{t('sablonsuz')}</option>
              {sablonlar.filter((s) => s.aktif).map((s) => (
                <option key={s.id} value={s.id}>{s.kod} — {s.ad}</option>
              ))}
            </select>
          </label>
        </div>
        {sablonId === '' && (
          <textarea
            className="px-3 py-2 rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full"
            rows={3} value={govde} placeholder={t('govdeIpucu')}
            onChange={(e) => setGovde(e.target.value)}
          />
        )}
        <div>
          <button type="button" className="underline" disabled={gonderiliyor}
                  onClick={gonder}>
            {gonderiliyor ? tg('bekleyin') : t('gonder')}
          </button>
        </div>
      </section>

      {/* ----------------------------- Geçmiş ------------------------------- */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t('sonGonderilenler')}</h3>
          <input
            className={`${ALAN} max-w-xs baski-gizle`} value={arama}
            placeholder={t('aramaIpucu')}
            onChange={(e) => setArama(e.target.value)}
          />
        </div>

        {mesajlar.length === 0 ? (
          <BosDurum baslik={t('mesajYok')} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[color:var(--muted)]">
                <th className="py-2">{t('tarih')}</th>
                <th>{t('alici')}</th>
                <th>{t('numara')}</th>
                <th>{t('ozet')}</th>
                <th>{t('durum')}</th>
                <th className="text-right">{t('parca')}</th>
                <th className="baski-gizle" />
              </tr>
            </thead>
            <tbody>
              {mesajlar.map((m) => (
                <tr key={m.id} className="border-t border-[color:var(--line)]">
                  <td className="py-2">{m.tarih.slice(0, 16).replace('T', ' ')}</td>
                  <td>{m.aliciAdi}</td>
                  <td className="font-mono">{m.numara}</td>
                  <td>{m.ozet}</td>
                  <td>
                    {/* Hata varsa GEREKÇE gösterilir; yalnızca "başarısız"
                        yazmak kullanıcıya hiçbir şey anlatmaz. */}
                    <span
                      className={
                        ['BASARISIZ', 'IZIN_YOK', 'SAGLAYICI_YOK'].includes(m.durum)
                          ? 'text-[color:var(--danger)]' : ''
                      }
                      title={m.hataMesaji ?? ''}
                    >
                      {t(`durum_${m.durum}`)}
                    </span>
                  </td>
                  <td className="text-right">{m.parcaSayisi}</td>
                  <td className="text-right baski-gizle">
                    {m.yenidenGonderilebilirMi && (
                      <button type="button" className="underline"
                              onClick={() => yenidenGonder(m.id)}>
                        {t('yenidenGonder')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kutu({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="rounded-[var(--rs)] border border-[color:var(--line)] p-2">
      <div className="text-xs text-[color:var(--muted)]">{etiket}</div>
      <div className="text-lg font-mono">{deger}</div>
    </div>
  );
}
