'use client';

/**
 * "Kişi Bilgileri" bölümü — malik · kiracı · sakin · misafir · daire görevlisi
 * formlarının PAYLAŞTIĞI ilk bölüm.
 *
 * KİŞİ SEÇME ZORUNLU DEĞİLDİR. Eskiden malik/kiracı/sakin eklemek için önce
 * "Kişiler" ekranına gidip kayıt açmak, sonra o kişiyi seçmek gerekiyordu; bu
 * iki ekranlı akış, sahada tek işlem olan bir şeyi (daireye yeni kiracı girdi)
 * ikiye bölüyordu. Artık bilgiler doğrudan girilir.
 *
 * ⚠️  MÜKERRER KİMLİK KAYDI TC ÜZERİNDEN ÖNLENİR. Sunucu, girilen TC kimlik
 *     numarasıyla kayıtlı bir kişi bulursa YENİ SATIR AÇMAZ, o kişiyi
 *     kullanır ve yanıtta bildirir. Aynı kişi iki `Kisi` satırına bölünürse
 *     borç geçmişi ve KVKK silme talebi iki kayda dağılır.
 *
 * Buradaki doğrulamalar kullanıcıya HIZLI geri bildirim içindir; güvenlik
 * sınırı sunucudadır.
 */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { KisiGirdisi, PlakaGirdisi } from '@/lib/servis';

const CINSIYETLER = ['KADIN', 'ERKEK', 'BELIRTILMEMIS'] as const;
const ARAC_TURLERI = ['OTOMOBIL', 'MOTOSIKLET', 'TICARI', 'BISIKLET', 'DIGER'] as const;

/** Türkiye plaka biçimi — sunucudaki `plakayiDogrula` ile aynı kural. */
const PLAKA = /^(0[1-9]|[1-7][0-9]|8[01])([A-Z]{1,3})([0-9]{1,5})$/;

export interface KisiFormDurumu {
  kisiId: string;
  ad: string;
  soyad: string;
  tcKimlikNo: string;
  telefon: string;
  eposta: string;
  dogumTarihi: string;
  cinsiyet: string;
  adres: string;
  notlar: string;
  plakalar: readonly PlakaSatiri[];
}

export interface PlakaSatiri {
  plaka: string;
  tur: string;
  marka: string;
  model: string;
  renk: string;
  otoparkYeri: string;
}

export function bosPlakaSatiri(): PlakaSatiri {
  return { plaka: '', tur: 'OTOMOBIL', marka: '', model: '', renk: '', otoparkYeri: '' };
}

export function bosKisiFormu(): KisiFormDurumu {
  return {
    kisiId: '', ad: '', soyad: '', tcKimlikNo: '', telefon: '', eposta: '',
    dogumTarihi: '', cinsiyet: 'BELIRTILMEMIS', adres: '', notlar: '', plakalar: [],
  };
}

function bos(d: string): boolean {
  return d.trim() === '';
}

/** Plakayı sunucudaki normalleştirmeyle aynı biçime getirir. */
export function plakaNormalle(ham: string): string {
  return ham.toUpperCase().replace(/[\s-]/gu, '');
}

/**
 * Kişi bölümünün doğrulaması.
 *
 * `kisiId` seçilmişse diğer alanlara BAKILMAZ — sunucu da öyle davranır ve
 * mevcut kişinin bilgilerini yan kapıdan güncellemez.
 */
export function kisiFormunuDogrula(
  d: KisiFormDurumu,
  ceviri: (anahtar: string) => string,
): Readonly<Record<string, string>> {
  const h: Record<string, string> = {};
  if (!bos(d.kisiId)) return h;

  if (d.ad.trim().length < 2) h['ad'] = ceviri('hataAd');
  if (d.soyad.trim().length < 2) h['soyad'] = ceviri('hataSoyad');
  if (!bos(d.tcKimlikNo) && !/^[0-9]{11}$/u.test(d.tcKimlikNo.trim())) {
    h['tcKimlikNo'] = ceviri('hataTc');
  }

  d.plakalar.forEach((p, i) => {
    if (bos(p.plaka)) return;
    const normal = plakaNormalle(p.plaka);
    const e = PLAKA.exec(normal);
    const toplam = e === null ? 0 : (e[2]?.length ?? 0) + (e[3]?.length ?? 0);
    if (e === null || toplam < 5 || toplam > 6) h[`plaka-${i}`] = ceviri('hataPlaka');
  });

  return h;
}

/** Form durumunu sunucu gövdesine çevirir. Boş alanlar GÖNDERİLMEZ. */
export function kisiGirdisineCevir(d: KisiFormDurumu): {
  readonly kisiId?: string;
  readonly kisi?: KisiGirdisi;
} {
  if (!bos(d.kisiId)) return { kisiId: d.kisiId };

  const plakalar: PlakaGirdisi[] = d.plakalar
    .filter((p) => !bos(p.plaka))
    .map((p) => ({
      plaka: plakaNormalle(p.plaka),
      tur: p.tur,
      ...(bos(p.marka) ? {} : { marka: p.marka.trim() }),
      ...(bos(p.model) ? {} : { model: p.model.trim() }),
      ...(bos(p.renk) ? {} : { renk: p.renk.trim() }),
      ...(bos(p.otoparkYeri) ? {} : { otoparkYeri: p.otoparkYeri.trim() }),
    }));

  return {
    kisi: {
      ad: d.ad.trim(),
      soyad: d.soyad.trim(),
      ...(bos(d.tcKimlikNo) ? {} : { tcKimlikNo: d.tcKimlikNo.trim() }),
      ...(bos(d.telefon) ? {} : { telefon: d.telefon.trim() }),
      ...(bos(d.eposta) ? {} : { eposta: d.eposta.trim() }),
      ...(bos(d.dogumTarihi) ? {} : { dogumTarihi: d.dogumTarihi }),
      ...(d.cinsiyet === 'BELIRTILMEMIS' ? {} : { cinsiyet: d.cinsiyet }),
      ...(bos(d.adres) ? {} : { adres: d.adres.trim() }),
      ...(bos(d.notlar) ? {} : { notlar: d.notlar.trim() }),
      ...(plakalar.length === 0 ? {} : { plakalar }),
    },
  };
}

const GIRDI =
  'px-3 h-[var(--rowh)] rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full';

export function KisiBilgileriBolumu({
  durum, setDurum, hatalar, kisiler, plakaGosterme,
}: {
  readonly durum: KisiFormDurumu;
  readonly setDurum: (d: KisiFormDurumu) => void;
  readonly hatalar: Readonly<Record<string, string>>;
  /** Mevcut kişi listesi. Boşsa yalnızca doğrudan giriş sunulur. */
  readonly kisiler?: readonly { readonly id: string; readonly adSoyad: string }[];
  /** Misafir gibi araç kaydı istenmeyen akışlarda `true` verilir. */
  readonly plakaGosterme?: boolean;
}) {
  const t = useTranslations('kisiBilgileri');
  const formId = useId();
  const mevcutSecili = durum.kisiId.trim() !== '';

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

  const plakaDegistir = (i: number, yama: Partial<PlakaSatiri>) => {
    setDurum({
      ...durum,
      plakalar: durum.plakalar.map((p, j) => (j === i ? { ...p, ...yama } : p)),
    });
  };

  return (
    <fieldset className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-3">
      <legend className="text-sm font-semibold px-1">{t('baslik')}</legend>
      <p className="text-xs text-[color:var(--muted)]">{t('aciklama')}</p>

      {kisiler !== undefined && kisiler.length > 0 && (
        <Alan ad="kisiId" etiket={t('mevcutKisi')}>
          {(id) => (
            <select id={id} className={GIRDI} value={durum.kisiId}
                    onChange={(e) => setDurum({ ...durum, kisiId: e.target.value })}>
              <option value="">{t('mevcutKisiBos')}</option>
              {kisiler.map((k) => (
                <option key={k.id} value={k.id}>{k.adSoyad}</option>
              ))}
            </select>
          )}
        </Alan>
      )}

      {/*
        Mevcut kişi seçiliyse alanlar KİLİTLENİR. Sunucu da onları yok sayar;
        açık bırakmak, kullanıcıya var olan kişinin bilgilerini burada
        değiştirebileceği izlenimini verirdi.
      */}
      <div className={`grid gap-3 sm:grid-cols-2 ${mevcutSecili ? 'opacity-50' : ''}`}>
        <Alan ad="ad" etiket={t('ad')}>
          {(id, hataId) => (
            <input id={id} className={GIRDI} value={durum.ad} disabled={mevcutSecili}
                   onChange={(e) => setDurum({ ...durum, ad: e.target.value })}
                   aria-invalid={hataId !== undefined} aria-describedby={hataId} />
          )}
        </Alan>

        <Alan ad="soyad" etiket={t('soyad')}>
          {(id, hataId) => (
            <input id={id} className={GIRDI} value={durum.soyad} disabled={mevcutSecili}
                   onChange={(e) => setDurum({ ...durum, soyad: e.target.value })}
                   aria-invalid={hataId !== undefined} aria-describedby={hataId} />
          )}
        </Alan>

        <Alan ad="tcKimlikNo" etiket={t('tcKimlikNo')}>
          {(id, hataId) => (
            <input id={id} className={`${GIRDI} num`} value={durum.tcKimlikNo}
                   inputMode="numeric" maxLength={11} disabled={mevcutSecili}
                   onChange={(e) => setDurum({ ...durum, tcKimlikNo: e.target.value })}
                   aria-invalid={hataId !== undefined} aria-describedby={hataId} />
          )}
        </Alan>

        <Alan ad="telefon" etiket={t('telefon')}>
          {(id) => (
            <input id={id} className={GIRDI} value={durum.telefon} disabled={mevcutSecili}
                   inputMode="tel"
                   onChange={(e) => setDurum({ ...durum, telefon: e.target.value })} />
          )}
        </Alan>

        <Alan ad="eposta" etiket={t('eposta')}>
          {(id) => (
            <input id={id} type="email" className={GIRDI} value={durum.eposta}
                   disabled={mevcutSecili}
                   onChange={(e) => setDurum({ ...durum, eposta: e.target.value })} />
          )}
        </Alan>

        <Alan ad="dogumTarihi" etiket={t('dogumTarihi')}>
          {(id) => (
            <input id={id} type="date" className={GIRDI} value={durum.dogumTarihi}
                   disabled={mevcutSecili}
                   onChange={(e) => setDurum({ ...durum, dogumTarihi: e.target.value })} />
          )}
        </Alan>

        <Alan ad="cinsiyet" etiket={t('cinsiyet')}>
          {(id) => (
            <select id={id} className={GIRDI} value={durum.cinsiyet} disabled={mevcutSecili}
                    onChange={(e) => setDurum({ ...durum, cinsiyet: e.target.value })}>
              {CINSIYETLER.map((c) => (
                <option key={c} value={c}>{t(`cinsiyet_${c}`)}</option>
              ))}
            </select>
          )}
        </Alan>

        <Alan ad="adres" etiket={t('adres')}>
          {(id) => (
            <input id={id} className={GIRDI} value={durum.adres} disabled={mevcutSecili}
                   onChange={(e) => setDurum({ ...durum, adres: e.target.value })} />
          )}
        </Alan>
      </div>

      <Alan ad="notlar" etiket={t('notlar')}>
        {(id) => (
          <textarea id={id} rows={2} disabled={mevcutSecili}
                    className="px-3 py-2 rounded-[var(--rs)] border border-[color:var(--line)] bg-transparent w-full"
                    value={durum.notlar}
                    onChange={(e) => setDurum({ ...durum, notlar: e.target.value })} />
        )}
      </Alan>

      <p className="text-xs text-[color:var(--muted)]">{t('kvkkIpucu')}</p>

      {plakaGosterme !== false && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('plakalar')}</span>
            <button type="button"
                    className="px-3 h-8 text-xs rounded-[var(--rs)] border border-[color:var(--line)]"
                    onClick={() =>
                      setDurum({ ...durum, plakalar: [...durum.plakalar, bosPlakaSatiri()] })}>
              + {t('plakaEkle')}
            </button>
          </div>
          <p className="text-xs text-[color:var(--muted)]">{t('plakaIpucu')}</p>

          {durum.plakalar.map((p, i) => (
            // Dizin anahtarı: satırların kendi kimliği yok ve sıra yalnızca
            // sondan eklenip aradan silinerek değişir.
            <div key={`plaka-${String(i)}`}
                 className="grid gap-2 sm:grid-cols-6 items-end border border-[color:var(--line)] rounded-[var(--rs)] p-2">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-[color:var(--muted-2)]"
                       htmlFor={`${formId}-plaka-${String(i)}`}>
                  {t('plaka')}
                </label>
                <input id={`${formId}-plaka-${String(i)}`} className={`${GIRDI} num`}
                       value={p.plaka} placeholder="34ABC123"
                       onChange={(e) => plakaDegistir(i, { plaka: e.target.value })}
                       aria-invalid={hatalar[`plaka-${String(i)}`] !== undefined} />
                {hatalar[`plaka-${String(i)}`] !== undefined && (
                  <p role="alert" className="text-xs" style={{ color: 'var(--crit)' }}>
                    {hatalar[`plaka-${String(i)}`]}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[color:var(--muted-2)]"
                       htmlFor={`${formId}-tur-${String(i)}`}>
                  {t('aracTuru')}
                </label>
                <select id={`${formId}-tur-${String(i)}`} className={GIRDI} value={p.tur}
                        onChange={(e) => plakaDegistir(i, { tur: e.target.value })}>
                  {ARAC_TURLERI.map((tt) => (
                    <option key={tt} value={tt}>{t(`aracTuru_${tt}`)}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[color:var(--muted-2)]"
                       htmlFor={`${formId}-marka-${String(i)}`}>
                  {t('marka')}
                </label>
                <input id={`${formId}-marka-${String(i)}`} className={GIRDI} value={p.marka}
                       onChange={(e) => plakaDegistir(i, { marka: e.target.value })} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-[color:var(--muted-2)]"
                       htmlFor={`${formId}-otopark-${String(i)}`}>
                  {t('otoparkYeri')}
                </label>
                <input id={`${formId}-otopark-${String(i)}`} className={GIRDI}
                       value={p.otoparkYeri}
                       onChange={(e) => plakaDegistir(i, { otoparkYeri: e.target.value })} />
              </div>

              <button type="button"
                      className="px-3 h-[var(--rowh)] text-xs rounded-[var(--rs)] border border-[color:var(--line)]"
                      onClick={() =>
                        setDurum({
                          ...durum,
                          plakalar: durum.plakalar.filter((_, j) => j !== i),
                        })}>
                {t('plakaKaldir')}
              </button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
