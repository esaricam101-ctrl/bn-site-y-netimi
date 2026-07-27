/**
 * Borc sorumluluk zinciri — ADR v1.1 §5 · backlog Y-12
 *
 * KRITIK KURAL — SNAPSHOT:
 * Sorumlu kisiler borc OLUSTURULDUGU ANDA cozulur ve kayda yazilir.
 * Sorgu aninda hesaplanmaz. Kiraci Mart'ta tasinirsa Subat borcu eski kiracida kalir.
 *
 * Bu dosya cozumlemeyi yapar; sonucun kalici yazilmasi Command servisinin
 * transaction'i icindedir. Sorgu tarafinda yeniden cozumleme YAPILMAZ.
 */
import type { TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';
import type { GiderTuru } from '../gider/gider-turu.js';
import { borcAlicisiTipi } from '../gider/gider-turu.js';

export type SorumlulukSirasi = 'ASIL' | 'IKINCIL';

export interface BorcSorumlusu {
  readonly kisiId: string;
  readonly sira: SorumlulukSirasi;
  readonly rol: 'MALIK' | 'KIRACI';
  /** Cozumleme ani — snapshot kaniti. */
  readonly cozumlemeTarihi: TakvimTarihi;
}

export interface BolumIliskisi {
  readonly kisiId: string;
  readonly rol: 'MALIK' | 'KIRACI';
  readonly baslangic: TakvimTarihi;
  readonly bitis: TakvimTarihi | null;
}

/** Verilen tarihte gecerli iliskiler. */
export function tarihtekiIliskiler(
  iliskiler: readonly BolumIliskisi[],
  tarih: TakvimTarihi,
): readonly BolumIliskisi[] {
  return iliskiler.filter(
    (i) => i.baslangic <= tarih && (i.bitis === null || i.bitis >= tarih),
  );
}

/**
 * Acik uclu iliskinin bitisi yerine kullanilan ust sinir. TakvimTarihi
 * YYYY-MM-DD bicimindedir; sozlukse karsilastirma tarih sirasiyla ortusur.
 */
const ACIK_UC = '9999-12-31' as TakvimTarihi;

function araliklarKesisiyorMu(a: BolumIliskisi, b: BolumIliskisi): boolean {
  return a.baslangic <= (b.bitis ?? ACIK_UC) && b.baslangic <= (a.bitis ?? ACIK_UC);
}

/**
 * Ayni rolde zaman araligi cakismasini reddeder.
 *
 * NEDEN KRITIK: `borcSorumlulariniCoz` gecerli iliskiler arasindan
 * `.find(rol === 'MALIK')` ile TEK kayit secer. Iki malik kaydi ayni tarihte
 * gecerliyse dizideki ilki secilir — borc yanlis kisiye yazilir ve HATA
 * SESSIZDIR. Cozumleme tarafinda savunma yoktur; kural yazma aninda zorlanmak
 * zorundadir.
 *
 * Bir bolumde ayni anda en fazla bir malik ve en fazla bir kiraci bulunur.
 * Farkli roller serbestce ortusur — kiracili bir bolumun maliki de vardir.
 */
export function iliskiyiDogrula(
  mevcut: readonly BolumIliskisi[],
  yeni: BolumIliskisi,
): void {
  if (yeni.bitis !== null && yeni.bitis < yeni.baslangic) {
    throw new DogrulamaHatasi(
      `Iliski bitis tarihi (${yeni.bitis}) baslangictan (${yeni.baslangic}) once olamaz.`,
      'Tarihleri kontrol edin.',
    );
  }

  const cakisan = mevcut.find(
    (m) => m.rol === yeni.rol && araliklarKesisiyorMu(m, yeni),
  );
  if (cakisan) {
    const aralik = `${cakisan.baslangic} – ${cakisan.bitis ?? 'suresiz'}`;
    throw new DogrulamaHatasi(
      `Bu bolumde ${yeni.rol} rolu ${aralik} araliginda zaten dolu; tarihler cakisiyor.`,
      'Once mevcut iliskiyi sonlandirin, sonra yenisini baslatin.',
    );
  }
}

/**
 * Borc sorumlularini cozer.
 *
 *   MALIKE_AIT gider    -> yalnizca malik (ASIL). Kiraci zincire girmez.
 *   KULLANANA_AIT gider -> kiraci ASIL, malik IKINCIL. Kiraci yoksa malik ASIL.
 *
 * Malik her durumda zincirdedir: kiraci odemezse basvurulacak taraf kaybolmaz.
 */
export function borcSorumlulariniCoz(
  gider: GiderTuru,
  iliskiler: readonly BolumIliskisi[],
  tahakkukTarihi: TakvimTarihi,
): readonly BorcSorumlusu[] {
  const gecerli = tarihtekiIliskiler(iliskiler, tahakkukTarihi);
  const malik = gecerli.find((i) => i.rol === 'MALIK');
  const kiraci = gecerli.find((i) => i.rol === 'KIRACI');

  if (!malik) {
    throw new DogrulamaHatasi(
      `${tahakkukTarihi} tarihinde bagimsiz bolumun malik kaydi yok. Borc olusturulamaz.`,
      'Malik kaydini tamamlayip tahakkuku tekrar calistirin.',
    );
  }

  const alici = borcAlicisiTipi(gider, kiraci !== undefined);

  if (alici === 'MALIK') {
    return [
      { kisiId: malik.kisiId, sira: 'ASIL', rol: 'MALIK', cozumlemeTarihi: tahakkukTarihi },
    ];
  }

  // KULLANANA_AIT + kiraci var: kiraci asil, malik ikincil.
  return [
    { kisiId: (kiraci as BolumIliskisi).kisiId, sira: 'ASIL', rol: 'KIRACI', cozumlemeTarihi: tahakkukTarihi },
    { kisiId: malik.kisiId, sira: 'IKINCIL', rol: 'MALIK', cozumlemeTarihi: tahakkukTarihi },
  ];
}

/** Zincirdeki asil sorumlu — tahsilat once buradan istenir. */
export function asilSorumlu(zincir: readonly BorcSorumlusu[]): BorcSorumlusu {
  const asil = zincir.find((s) => s.sira === 'ASIL');
  if (!asil) throw new DogrulamaHatasi('Borc sorumluluk zincirinde ASIL sorumlu yok.');
  return asil;
}
