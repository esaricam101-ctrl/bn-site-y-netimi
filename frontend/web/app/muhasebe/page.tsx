'use client';

/**
 * MUHASEBE — tek rota, beş sekme.
 *
 * ⚠️  TEKRAR EDEN EKRAN OLUŞTURULMADI. Fişler · Hesap Planı · Defterler ·
 *     Mizan · Dönem ayrı rotalar olsaydı beş kez aynı süzgeç/tablo/durum
 *     iskeleti yazılırdı. Sekme bileşeni (`components/sekmeler.tsx`) bu
 *     oturumda zaten kurulmuştu; yeniden kullanılıyor.
 *
 * ⚠️  MOCK YOKTUR. Öteki modüllerde mock, backend hazır olmadan arayüz
 *     geliştirmeyi sağlıyordu. Muhasebede aynı şeyi yapmak TEHLİKELİDİR:
 *     uydurma bir mizan gerçek bir mizan gibi görünür ve karar dayanağı
 *     sanılabilir. Backend kapalıysa ekran hata gösterir.
 *
 * ⚠️  PARA METİN OLARAK GÖSTERİLİR, `Number`'a ÇEVRİLMEZ. Biçimlemek için
 *     ondalığa çevirmek float yuvarlaması yapar ve mizan toplamı satır
 *     toplamlarına eşit çıkmaz (ADR-0007).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UygulamaKabugu } from '@/components/uygulama-kabugu';
import { BosDurum, HataDurumu, Yukleniyor } from '@/components/durumlar';
import { useBildirim } from '@/components/bildirim';
import { Sekmeler, type SekmeTanimi } from '@/components/sekmeler';
import {
  muhasebe,
  type Mizan, type MuhasebeDonemi, type MuhasebeFisiSatiri,
  type MuhasebeHesabi, type YevmiyeSatiri,
} from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const ALAN =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

function hataMetni(h: unknown, varsayilan: string): string {
  if (h instanceof ApiHatasi) return h.problem.detail;
  if (h instanceof Error) return h.message;
  return varsayilan;
}

/** Yılın ilk ve son günü — varsayılan rapor aralığı. */
function yilAraligi(): { readonly baslangic: string; readonly bitis: string } {
  const yil = new Date().getUTCFullYear();
  return { baslangic: `${String(yil)}-01-01`, bitis: `${String(yil)}-12-31` };
}

export default function MuhasebeSayfasi() {
  const t = useTranslations('muhasebe');
  const tn = useTranslations('navigasyon');
  const [etkinSekme, setEtkinSekme] = useState('fisler');

  const sekmeler: readonly SekmeTanimi[] = [
    { anahtar: 'fisler', etiket: t('fislerSekmesi'), icerik: <FisListesi /> },
    { anahtar: 'hesaplar', etiket: t('hesapPlaniSekmesi'), icerik: <HesapPlani /> },
    { anahtar: 'defterler', etiket: t('defterlerSekmesi'), icerik: <YevmiyeDefteri /> },
    { anahtar: 'mizan', etiket: t('mizanSekmesi'), icerik: <MizanDokumu /> },
    { anahtar: 'donem', etiket: t('donemSekmesi'), icerik: <DonemYonetimi /> },
  ];

  return (
    <UygulamaKabugu
      baslik={t('baslik')}
      kirintilar={[
        { etiket: tn('genelBakis'), yol: '/yonetim' },
        { etiket: tn('muhasebe') },
      ]}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[color:var(--muted)]">{t('aciklama')}</p>
        <Sekmeler sekmeler={sekmeler} etkinAnahtar={etkinSekme}
                  onDegisti={setEtkinSekme} etiket={t('baslik')} />
      </div>
    </UygulamaKabugu>
  );
}

/* ------------------------------- Fiş listesi ------------------------------ */

function FisListesi() {
  const t = useTranslations('muhasebe');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();

  const [satirlar, setSatirlar] = useState<readonly MuhasebeFisiSatiri[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [durum, setDurum] = useState('');
  const [arama, setArama] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    muhasebe
      .fisler({
        ...(durum === '' ? {} : { durum }),
        ...(arama.trim() === '' ? {} : { arama: arama.trim() }),
      })
      .then(setSatirlar)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [durum, arama]);

  useEffect(yukle, [yukle]);

  const isle = async (id: string) => {
    try {
      await muhasebe.fisIsle(id);
      bildirim.basari(t('fisIslendi'));
      yukle();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('fisIslenemedi')));
    }
  };

  const storno = async (id: string) => {
    const gerekce = window.prompt(t('stornoGerekcesi'));
    if (gerekce === null || gerekce.trim().length < 5) return;
    try {
      const s = await muhasebe.fisStorno(id, gerekce.trim());
      bildirim.basari(t('stornoOlusturuldu', { fisNo: s.tersFisNo }));
      yukle();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('stornoOlusturulamadi')));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/*
        FİŞ SİLME DÜĞMESİ YOK ve olmayacak: `yevmiye_fisi` FİNANSAL sınıftır,
        düzeltme yalnızca ters kayıtla yapılır (BFS v1 §5.1).
      */}
      <p className="text-xs text-[color:var(--muted)]">{t('fisIpucu')}</p>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
          {t('durum')}
          <select className={ALAN} value={durum} onChange={(e) => setDurum(e.target.value)}>
            <option value="">{t('tumDurumlar')}</option>
            <option value="TASLAK">{t('durum_TASLAK')}</option>
            <option value="ISLENDI">{t('durum_ISLENDI')}</option>
            <option value="TERS_KAYITLI">{t('durum_TERS_KAYITLI')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)] flex-1 min-w-[180px]">
          {t('ara')}
          <input className={ALAN} value={arama} placeholder={t('fisAramaIpucu')}
                 onChange={(e) => setArama(e.target.value)} />
        </label>
      </div>

      {yukleniyor ? <Yukleniyor />
        : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
          : satirlar.length === 0 ? <BosDurum aciklama={t('fisYok')} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[color:var(--muted-2)]">
                      <th className="p-2">{t('fisNo')}</th>
                      <th className="p-2">{t('yevmiyeSiraNo')}</th>
                      <th className="p-2">{t('tarih')}</th>
                      <th className="p-2">{t('fisTuru')}</th>
                      <th className="p-2">{t('durum')}</th>
                      <th className="p-2">{t('aciklamaAlani')}</th>
                      <th className="p-2 text-right">{t('tutar')}</th>
                      <th className="p-2">{tg('islemler')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((f) => (
                      <tr key={f.id} className="border-t border-[color:var(--line)]">
                        <td className="p-2 num">{f.fisNo}</td>
                        <td className="p-2 num">{f.yevmiyeSiraNo ?? '—'}</td>
                        <td className="p-2 num">{f.tarih}</td>
                        <td className="p-2">{t(`fisTuru_${f.fisTuru}`)}</td>
                        <td className="p-2">
                          <span style={{
                            color: f.durum === 'ISLENDI' ? 'var(--success)'
                              : f.durum === 'TASLAK' ? 'var(--warn)' : 'var(--muted-2)',
                          }}>
                            {t(`durum_${f.durum}`)}
                          </span>
                        </td>
                        <td className="p-2">{f.aciklama}</td>
                        {/* Para METİN gösterilir; Number'a çevrilmez (ADR-0007). */}
                        <td className="p-2 num text-right">{f.borcToplam} ₺</td>
                        <td className="p-2 flex gap-1">
                          {f.durum === 'TASLAK' && (
                            <button type="button" onClick={() => { void isle(f.id); }}
                                    className="px-2 h-8 text-xs rounded-[var(--rs)] border border-[color:var(--line)]">
                              {t('isle')}
                            </button>
                          )}
                          {f.durum === 'ISLENDI' && (
                            <button type="button" onClick={() => { void storno(f.id); }}
                                    className="px-2 h-8 text-xs rounded-[var(--rs)] border border-[color:var(--line)]">
                              {t('storno')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </div>
  );
}

/* ------------------------------- Hesap planı ------------------------------ */

function HesapPlani() {
  const t = useTranslations('muhasebe');

  const [satirlar, setSatirlar] = useState<readonly MuhasebeHesabi[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState('');

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    muhasebe
      .hesaplar({ ...(arama.trim() === '' ? {} : { arama: arama.trim() }) })
      .then(setSatirlar)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [arama]);

  useEffect(yukle, [yukle]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[color:var(--muted)]">{t('hesapPlaniIpucu')}</p>

      <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)] max-w-sm">
        {t('ara')}
        <input className={ALAN} value={arama} placeholder={t('hesapAramaIpucu')}
               onChange={(e) => setArama(e.target.value)} />
      </label>

      {yukleniyor ? <Yukleniyor />
        : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
          : satirlar.length === 0 ? <BosDurum aciklama={t('hesapYok')} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[color:var(--muted-2)]">
                      <th className="p-2">{t('kod')}</th>
                      <th className="p-2">{t('hesapAdi')}</th>
                      <th className="p-2">{t('tip')}</th>
                      <th className="p-2">{t('ozellik')}</th>
                      <th className="p-2 text-right">{t('hareket')}</th>
                      <th className="p-2">{t('durum')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((h) => (
                      <tr key={h.id} className="border-t border-[color:var(--line)]">
                        {/* Girinti KODDAN türetilen seviyeye göre: tekdüzen
                            planda hiyerarşi kod uzunluğuyla kurulur. */}
                        <td className="p-2 num" style={{ paddingLeft: `${8 + h.seviye * 16}px` }}>
                          {h.kod}
                        </td>
                        <td className="p-2" style={{ fontWeight: h.fisKesilebilirMi ? 400 : 600 }}>
                          {h.ad}
                          {!h.fisKesilebilirMi && (
                            <span className="ml-2 text-xs text-[color:var(--muted-2)]">
                              {t('araHesap')}
                            </span>
                          )}
                        </td>
                        <td className="p-2">{t(`tip_${h.tip}`)}</td>
                        <td className="p-2">
                          {h.ozellik === 'NORMAL' ? '—' : t(`ozellik_${h.ozellik}`)}
                        </td>
                        <td className="p-2 num text-right">{h.hareketSayisi}</td>
                        <td className="p-2">
                          {h.aktif ? t('aktif') : t('pasif')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </div>
  );
}

/* ------------------------------ Yevmiye defteri --------------------------- */

function YevmiyeDefteri() {
  const t = useTranslations('muhasebe');
  const varsayilan = yilAraligi();

  const [baslangic, setBaslangic] = useState(varsayilan.baslangic);
  const [bitis, setBitis] = useState(varsayilan.bitis);
  const [satirlar, setSatirlar] = useState<readonly YevmiyeSatiri[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    muhasebe
      .yevmiyeDefteri(baslangic, bitis)
      .then(setSatirlar)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [baslangic, bitis]);

  useEffect(yukle, [yukle]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[color:var(--muted)]">{t('yevmiyeIpucu')}</p>

      <div className="flex flex-wrap gap-2 items-end baski-gizle">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
          {t('baslangic')}
          <input type="date" className={ALAN} value={baslangic}
                 onChange={(e) => setBaslangic(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
          {t('bitis')}
          <input type="date" className={ALAN} value={bitis}
                 onChange={(e) => setBitis(e.target.value)} />
        </label>
        {/* Yazdırma: `@media print` stil sayfası zaten var. */}
        <button type="button" onClick={() => window.print()}
                className="px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('yazdir')}
        </button>
      </div>

      {yukleniyor ? <Yukleniyor />
        : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
          : satirlar.length === 0 ? <BosDurum aciklama={t('kayitYok')} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[color:var(--muted-2)]">
                      <th className="p-2">{t('yevmiyeSiraNo')}</th>
                      <th className="p-2">{t('tarih')}</th>
                      <th className="p-2">{t('fisNo')}</th>
                      <th className="p-2">{t('kod')}</th>
                      <th className="p-2">{t('hesapAdi')}</th>
                      <th className="p-2">{t('aciklamaAlani')}</th>
                      <th className="p-2 text-right">{t('borc')}</th>
                      <th className="p-2 text-right">{t('alacak')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((s, i) => (
                      <tr key={`${s.fisId}-${String(i)}`}
                          className="border-t border-[color:var(--line)]">
                        <td className="p-2 num">{s.yevmiyeSiraNo ?? '—'}</td>
                        <td className="p-2 num">{s.tarih}</td>
                        <td className="p-2 num">{s.fisNo}</td>
                        <td className="p-2 num">{s.hesapKodu}</td>
                        <td className="p-2">{s.hesapAdi}</td>
                        <td className="p-2">
                          {s.satirAciklamasi ?? s.fisAciklamasi}
                          {s.kapiNo !== null && (
                            <span className="ml-2 text-xs text-[color:var(--muted-2)]">
                              ({s.kapiNo})
                            </span>
                          )}
                        </td>
                        <td className="p-2 num text-right">{s.borc}</td>
                        <td className="p-2 num text-right">{s.alacak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </div>
  );
}

/* ---------------------------------- Mizan --------------------------------- */

function MizanDokumu() {
  const t = useTranslations('muhasebe');
  const varsayilan = yilAraligi();

  const [baslangic, setBaslangic] = useState(varsayilan.baslangic);
  const [bitis, setBitis] = useState(varsayilan.bitis);
  const [mizan, setMizan] = useState<Mizan | null>(null);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    muhasebe
      .mizan(baslangic, bitis)
      .then(setMizan)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, [baslangic, bitis]);

  useEffect(yukle, [yukle]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-end baski-gizle">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
          {t('baslangic')}
          <input type="date" className={ALAN} value={baslangic}
                 onChange={(e) => setBaslangic(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[color:var(--muted-2)]">
          {t('bitis')}
          <input type="date" className={ALAN} value={bitis}
                 onChange={(e) => setBitis(e.target.value)} />
        </label>
        <button type="button" onClick={() => window.print()}
                className="px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)]">
          {t('yazdir')}
        </button>
      </div>

      {/*
        DENKSİZLİK GİZLENMEZ. Borç ≠ alacak ise deftere denk olmayan bir fiş
        girmiş demektir; kullanıcı bunu raporun kendisinden görmelidir.
      */}
      {mizan !== null && !mizan.denkMi && (
        <p role="alert" className="text-sm px-3 py-2 rounded-[var(--rs)] border"
           style={{ borderColor: 'var(--crit)', color: 'var(--crit)' }}>
          {t('mizanDenkDegil')}
        </p>
      )}

      {yukleniyor ? <Yukleniyor />
        : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
          : mizan === null || mizan.satirlar.length === 0
            ? <BosDurum aciklama={t('kayitYok')} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[color:var(--muted-2)]">
                      <th className="p-2">{t('kod')}</th>
                      <th className="p-2">{t('hesapAdi')}</th>
                      <th className="p-2 text-right">{t('borc')}</th>
                      <th className="p-2 text-right">{t('alacak')}</th>
                      <th className="p-2 text-right">{t('borcBakiye')}</th>
                      <th className="p-2 text-right">{t('alacakBakiye')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mizan.satirlar.map((s) => (
                      <tr key={s.hesapId} className="border-t border-[color:var(--line)]">
                        <td className="p-2 num" style={{ paddingLeft: `${8 + s.seviye * 16}px` }}>
                          {s.kod}
                        </td>
                        <td className="p-2">{s.ad}</td>
                        <td className="p-2 num text-right">{s.borcToplam}</td>
                        <td className="p-2 num text-right">{s.alacakToplam}</td>
                        <td className="p-2 num text-right">{s.borcBakiye}</td>
                        <td className="p-2 num text-right">{s.alacakBakiye}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[color:var(--line)] font-semibold">
                      <td className="p-2" colSpan={2}>{t('toplam')}</td>
                      <td className="p-2 num text-right">{mizan.borcToplam}</td>
                      <td className="p-2 num text-right">{mizan.alacakToplam}</td>
                      <td className="p-2 num text-right">{mizan.borcBakiyeToplam}</td>
                      <td className="p-2 num text-right">{mizan.alacakBakiyeToplam}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
    </div>
  );
}

/* --------------------------------- Dönem ---------------------------------- */

function DonemYonetimi() {
  const t = useTranslations('muhasebe');
  const bildirim = useBildirim();

  const [donemler, setDonemler] = useState<readonly MuhasebeDonemi[]>([]);
  const [hata, setHata] = useState<unknown>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islemde, setIslemde] = useState<string | null>(null);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    setHata(null);
    muhasebe
      .donemler()
      .then(setDonemler)
      .catch(setHata)
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(yukle, [yukle]);

  const calistir = async (
    id: string, islem: () => Promise<unknown>, basariAnahtari: string,
  ) => {
    setIslemde(id);
    try {
      await islem();
      bildirim.basari(t(basariAnahtari));
      yukle();
    } catch (h) {
      bildirim.hata(hataMetni(h, t('islemBasarisiz')));
    } finally {
      setIslemde(null);
    }
  };

  const kapat = async (d: MuhasebeDonemi) => {
    // Kapanış GERİ ALINAMAZ; gerekçe zorunludur ve kullanıcıdan açıkça istenir.
    const gerekce = window.prompt(t('kapanisGerekcesi', { yil: d.maliYil }));
    if (gerekce === null || gerekce.trim().length < 10) {
      if (gerekce !== null) bildirim.hata(t('kapanisGerekcesiKisa'));
      return;
    }
    await calistir(d.id, () => muhasebe.donemKapat(d.id, gerekce.trim()), 'donemKapatildi');
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[color:var(--muted)]">{t('donemIpucu')}</p>

      {yukleniyor ? <Yukleniyor />
        : hata !== null ? <HataDurumu hata={hata} tekrarDene={yukle} />
          : donemler.length === 0 ? <BosDurum aciklama={t('donemYok')} />
            : (
              <div className="grid gap-3 md:grid-cols-2">
                {donemler.map((d) => (
                  <article key={d.id} className="glass p-[var(--cardpad)] flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{d.ad}</h3>
                        <p className="text-xs num text-[color:var(--muted-2)]">
                          {d.baslangic} – {d.bitis}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-[var(--rs)] border"
                            style={{
                              borderColor: d.durum === 'ACIK' ? 'var(--success)' : 'var(--muted-2)',
                              color: d.durum === 'ACIK' ? 'var(--success)' : 'var(--muted-2)',
                            }}>
                        {t(`donemDurum_${d.durum}`)}
                      </span>
                    </div>

                    <dl className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
                      <dt className="text-[color:var(--muted-2)]">{t('fisSayisi')}</dt>
                      <dd className="num">{d.fisSayisi}</dd>
                      <dt className="text-[color:var(--muted-2)]">{t('taslakFis')}</dt>
                      <dd className="num" style={{
                        color: d.taslakFisSayisi > 0 ? 'var(--warn)' : undefined,
                      }}>
                        {d.taslakFisSayisi}
                      </dd>
                      <dt className="text-[color:var(--muted-2)]">{t('numarasizFis')}</dt>
                      <dd className="num">{d.numarasizFisSayisi}</dd>
                    </dl>

                    {/* Taslak fiş varken kapanış ENGELLENİR ve nedeni yazılır:
                        gizlenen düğme kullanıcıya neden yapamadığını anlatmaz. */}
                    {d.taslakFisSayisi > 0 && d.durum === 'ACIK' && (
                      <p className="text-xs" style={{ color: 'var(--warn)' }}>
                        {t('taslakVarKapatilamaz', { sayi: d.taslakFisSayisi })}
                      </p>
                    )}

                    {d.durum === 'KAPALI' && d.kapanisGerekcesi !== null && (
                      <p className="text-xs text-[color:var(--muted)]">
                        {t('kapanisGerekcesiEtiket')}: {d.kapanisGerekcesi}
                      </p>
                    )}

                    {d.durum === 'ACIK' && (
                      <div className="flex flex-wrap gap-1 mt-auto">
                        <button type="button" disabled={islemde !== null}
                                onClick={() => {
                                  void calistir(d.id,
                                    () => muhasebe.yevmiyeNumarala(d.id), 'numaralandi');
                                }}
                                className="px-2 h-8 text-xs rounded-[var(--rs)] border border-[color:var(--line)] disabled:opacity-60">
                          {t('yevmiyeNumarala')}
                        </button>
                        <button type="button" disabled={islemde !== null || d.acilisFisiId !== null}
                                onClick={() => {
                                  void calistir(d.id,
                                    () => muhasebe.acilisFisi(d.id), 'acilisUretildi');
                                }}
                                className="px-2 h-8 text-xs rounded-[var(--rs)] border border-[color:var(--line)] disabled:opacity-60">
                          {t('acilisFisi')}
                        </button>
                        <button type="button" disabled={islemde !== null}
                                onClick={() => {
                                  void calistir(d.id,
                                    () => muhasebe.yansitmaFisi(d.id), 'yansitildi');
                                }}
                                className="px-2 h-8 text-xs rounded-[var(--rs)] border border-[color:var(--line)] disabled:opacity-60">
                          {t('yansitmaFisi')}
                        </button>
                        <button type="button"
                                disabled={islemde !== null || d.taslakFisSayisi > 0}
                                onClick={() => { void kapat(d); }}
                                className="px-2 h-8 text-xs rounded-[var(--rs)] text-white disabled:opacity-60"
                                style={{ backgroundImage: 'var(--grad)' }}>
                          {t('donemKapat')}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
    </div>
  );
}
