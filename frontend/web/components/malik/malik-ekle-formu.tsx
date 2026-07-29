'use client';

/**
 * Malik ekleme formu — TEK EKRANDAN HIZLI KAYIT.
 *
 * KİŞİ SEÇME ZORUNLU DEĞİLDİR. İlk bölüm "Kişi Bilgileri"dir (paylaşılan
 * bileşen: ad, soyad, TC, telefon, e-posta, doğum tarihi, cinsiyet, adres,
 * not, araç plakaları) ve ardından tapuya özel alanlar gelir. Eskiden önce
 * "Kişiler" ekranında kayıt açmak gerekiyordu; bu, sahada tek işlem olan bir
 * şeyi ikiye bölüyordu.
 *
 * Hisse pay/payda AYRI iki alandır ve METİN taşınır. Tek bir "yüzde" alanı
 * olsaydı üç eşit hisse (1/3) 33,33 girilir ve toplam asla %100 etmezdi;
 * tahakkuk kalıcı olarak bloke olurdu (ADR-0007 gerekçesi).
 *
 * Doğrulama sunucuda da yapılır — buradaki kontroller kullanıcıya HIZLI geri
 * bildirim içindir, güvenlik sınırı değildir.
 */
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBildirim } from '@/components/bildirim';
import {
  KisiBilgileriBolumu, bosKisiFormu, kisiFormunuDogrula, kisiGirdisineCevir,
  type KisiFormDurumu,
} from '@/components/kisi/kisi-bilgileri-bolumu';
import { servis, type MalikEkleGirdisi } from '@/lib/servis';
import { ApiHatasi } from '@/lib/api';

const TAPU_TURLERI = [
  'KAT_MULKIYETI', 'KAT_IRTIFAKI', 'ARSA_PAYLI', 'MIRAS_ISTIRAK', 'DIGER',
] as const;

const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;

export function MalikEkleFormu({
  bolumId, onEklendi, onIptal,
}: {
  readonly bolumId: string;
  readonly onEklendi: () => void;
  readonly onIptal: () => void;
}) {
  const t = useTranslations('malik');
  const td = useTranslations('daire');
  const tk = useTranslations('kisiBilgileri');
  const tg = useTranslations('genel');
  const bildirim = useBildirim();
  const formId = useId();

  const [kisi, setKisi] = useState<KisiFormDurumu>(bosKisiFormu());
  const [hissePay, setHissePay] = useState('1');
  const [hissePayda, setHissePayda] = useState('1');
  const [tapuTuru, setTapuTuru] = useState<string>('KAT_MULKIYETI');
  const [tapuBaslangic, setTapuBaslangic] = useState('');
  const [yevmiyeNo, setYevmiyeNo] = useState('');

  const [hatalar, setHatalar] = useState<Readonly<Record<string, string>>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const dogrula = (): Readonly<Record<string, string>> => {
    // Kişi bölümünün doğrulaması PAYLAŞILAN: beş formda aynı kural geçerli
    // olmalı, yoksa biri TC biçimini denetlerken öteki denetlemez.
    const h: Record<string, string> = { ...kisiFormunuDogrula(kisi, tk) };

    const pay = Number(hissePay);
    const payda = Number(hissePayda);
    if (!/^\d+$/.test(hissePay) || pay <= 0) h['hissePay'] = t('hataPay');
    if (!/^\d+$/.test(hissePayda) || payda <= 0) h['hissePayda'] = t('hataPayda');
    if (h['hissePay'] === undefined && h['hissePayda'] === undefined && pay > payda) {
      h['hissePay'] = t('hataPayBuyuk');
    }

    if (!TARIH_BICIMI.test(tapuBaslangic)) h['tapuBaslangic'] = t('hataTarih');
    return h;
  };

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = dogrula();
    setHatalar(h);
    if (Object.keys(h).length > 0) return;

    const girdi: MalikEkleGirdisi = {
      ...kisiGirdisineCevir(kisi),
      hissePay, hissePayda, tapuTuru, tapuBaslangic,
      ...(yevmiyeNo.trim() === '' ? {} : { tapuYevmiyeNo: yevmiyeNo.trim() }),
    };

    setGonderiliyor(true);
    try {
      await servis.malikEkle(bolumId, girdi);
      bildirim.basari(t('eklendi'));
      const plakaSayisi = girdi.kisi?.plakalar?.length ?? 0;
      if (plakaSayisi > 0) bildirim.basari(tk('plakaEklendi', { sayi: plakaSayisi }));
      onEklendi();
    } catch (hata) {
      // Sunucu is kurali ihlali dondurmus olabilir (ornegin hisse toplami 1'i
      // asiyor); mesaji AYNEN gosteririz — kendi metnimizi uydurmayiz.
      bildirim.hata(hata instanceof ApiHatasi ? hata.problem.detail : t('eklenemedi'));
    } finally {
      setGonderiliyor(false);
    }
  };

  const Alan = ({
    ad, etiket, children,
  }: {
    readonly ad: string;
    readonly etiket: string;
    readonly children: (id: string, hataId: string | undefined) => React.ReactNode;
  }) => {
    const id = `${formId}-${ad}`;
    const hata = hatalar[ad];
    const hataId = hata === undefined ? undefined : `${id}-hata`;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-xs text-[color:var(--muted-2)]">{etiket}</label>
        {children(id, hataId)}
        {hata !== undefined && (
          <p id={hataId} role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>
            {hata}
          </p>
        )}
      </div>
    );
  };

  const girdiSinifi =
    'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent';

  return (
    // `void`: onSubmit void bekler, `gonder` Promise doner. Isaretlenmezse
    // reddedilen bir promise sessizce kaybolur (no-misused-promises).
    // `preventDefault` ilk await'ten once, senkron olarak calisir.
    <form onSubmit={(e) => { void gonder(e); }}
          className="glass p-[var(--cardpad)] flex flex-col gap-4">
      <h3 className="font-semibold">{t('yeniMalik')}</h3>

      {/* Formun İLK bölümü kişi bilgileridir; beş modülde aynı bileşen. */}
      <KisiBilgileriBolumu durum={kisi} setDurum={setKisi} hatalar={hatalar} />

      <div className="grid gap-3 sm:grid-cols-2 border-t border-[color:var(--line)] pt-3">
        <Alan ad="tapuTuru" etiket={td('tapuTuru')}>
          {(id) => (
            <select id={id} className={girdiSinifi} value={tapuTuru}
                    onChange={(e) => setTapuTuru(e.target.value)}>
              {TAPU_TURLERI.map((tt) => (
                <option key={tt} value={tt}>{td(`tapuTuru_${tt}`)}</option>
              ))}
            </select>
          )}
        </Alan>

        {/*
          Pay ve payda AYRI: tek "yuzde" alani 1/3 hissede toplami bozar.
          inputMode="numeric" mobilde sayi klavyesi acar.
        */}
        <Alan ad="hissePay" etiket={t('hissePay')}>
          {(id, hataId) => (
            <input id={id} className={`${girdiSinifi} num`} value={hissePay}
                   inputMode="numeric" onChange={(e) => setHissePay(e.target.value)}
                   aria-invalid={hataId !== undefined} aria-describedby={hataId} required />
          )}
        </Alan>

        <Alan ad="hissePayda" etiket={t('hissePayda')}>
          {(id, hataId) => (
            <input id={id} className={`${girdiSinifi} num`} value={hissePayda}
                   inputMode="numeric" onChange={(e) => setHissePayda(e.target.value)}
                   aria-invalid={hataId !== undefined} aria-describedby={hataId} required />
          )}
        </Alan>

        <Alan ad="tapuBaslangic" etiket={td('tapuBaslangic')}>
          {(id, hataId) => (
            <input id={id} type="date" className={girdiSinifi} value={tapuBaslangic}
                   onChange={(e) => setTapuBaslangic(e.target.value)}
                   aria-invalid={hataId !== undefined} aria-describedby={hataId} required />
          )}
        </Alan>

        <Alan ad="yevmiyeNo" etiket={td('yevmiyeNo')}>
          {(id) => (
            <input id={id} className={girdiSinifi} value={yevmiyeNo}
                   onChange={(e) => setYevmiyeNo(e.target.value)} />
          )}
        </Alan>
      </div>

      <p className="text-xs text-[color:var(--muted)]">{t('hisseIpucu')}</p>

      <div className="flex gap-2">
        <button type="submit" disabled={gonderiliyor}
                className="px-4 h-[var(--rowh)] rounded-[var(--rs)] text-white font-semibold disabled:opacity-60"
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
