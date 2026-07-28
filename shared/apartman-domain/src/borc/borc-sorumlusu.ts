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

/**
 * Bolumle iliskili kisi rolu.
 *
 * SAKIN, yonetim plani ya da genel kurul karari borcu FIILEN OTURANA yazdiginda
 * zincire girer (SorumlulukTipi.SAKINE_AIT). Kiraci bir sirket olup dairede
 * calisani oturuyorsa su/isinma gideri sakine yansitilabilir.
 */
export type BolumRolu = 'MALIK' | 'KIRACI' | 'SAKIN';

export interface BorcSorumlusu {
  readonly kisiId: string;
  readonly sira: SorumlulukSirasi;
  readonly rol: BolumRolu;
  /** Cozumleme ani — snapshot kaniti. */
  readonly cozumlemeTarihi: TakvimTarihi;
}

export interface BolumIliskisi {
  readonly kisiId: string;
  readonly rol: BolumRolu;
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
 * Iliski tarihlerini ve tekillik kurallarini dogrular.
 *
 * ROLE GORE FARKLI KURAL:
 *
 * `KIRACI` — bir bolumde ayni anda EN FAZLA BIR kiraci bulunur. Iki gecerli
 * kira iliskisi olursa `borcSorumlulariniCoz` dizideki ilkini secer ve digerini
 * sessizce yok sayar; kullanana ait gider yanlis kisiye yazilir.
 *
 * `MALIK` — cakisma SERBESTTIR. Hisseli mulkiyet gercektir (miras, ortak alim,
 * esler arasi paylasim) ve birden cok malik ayni anda gecerlidir. Buradaki
 * koruma tekillik degil, hisse toplaminin tami etmesidir — `hisseleriDogrula`
 * (malik/malik.ts) bu isi yapar ve tahakkuk oncesi zorlanir.
 *
 * NOT: Oturum 5'te malik icin de tekillik zorlaniyordu. Coklu malik
 * gereksinimiyle birlikte o kural KALDIRILMADI, YERI DEGISTI: tekillik yerine
 * hisse butunlugu invaryanti gelir. Iki kural da ayni seyi korur — bir bolumun
 * borcunun tam olarak bir kez ve dogru kisilere yazilmasini.
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

  if (yeni.rol !== 'KIRACI') return;

  const cakisan = mevcut.find(
    (m) => m.rol === 'KIRACI' && araliklarKesisiyorMu(m, yeni),
  );
  if (cakisan) {
    const aralik = `${cakisan.baslangic} – ${cakisan.bitis ?? 'suresiz'}`;
    throw new DogrulamaHatasi(
      `Bu bolumde KIRACI rolu ${aralik} araliginda zaten dolu; tarihler cakisiyor.`,
      'Once mevcut kira iliskisini sonlandirin, sonra yenisini baslatin.',
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
  // Coklu malik desteklenir; TEK malik durumunda cikti eskisiyle birebir aynidir.
  const malikler = gecerli.filter((i) => i.rol === 'MALIK');
  const kiraci = gecerli.find((i) => i.rol === 'KIRACI');
  const sakin = gecerli.find((i) => i.rol === 'SAKIN');

  if (malikler.length === 0) {
    throw new DogrulamaHatasi(
      `${tahakkukTarihi} tarihinde bagimsiz bolumun malik kaydi yok. Borc olusturulamaz.`,
      'Malik kaydini tamamlayip tahakkuku tekrar calistirin.',
    );
  }

  const alici = borcAlicisiTipi(gider, {
    kiraciVarMi: kiraci !== undefined,
    sakinVarMi: sakin !== undefined,
  });

  const malikSorumlulari = (sira: SorumlulukSirasi): readonly BorcSorumlusu[] =>
    malikler.map((m) => ({
      kisiId: m.kisiId, sira, rol: 'MALIK' as const, cozumlemeTarihi: tahakkukTarihi,
    }));

  // MALIKE_AIT: kiraci ve sakin zincire hic girmez, tum malikler asil sorumludur.
  if (alici === 'MALIK') return malikSorumlulari('ASIL');

  // Asil sorumlu kiraci ya da sakindir; MALIKLER HER DURUMDA IKINCIL olarak
  // zincirdedir — odenmezse basvurulacak taraf kaybolmaz (KMK md. 22).
  //
  // SAKINE_AIT'te kiraci da varsa zincir uc katmanlidir: sakin asil, kiraci ve
  // malikler ikincil. Kiraci sozlesmenin tarafidir; sakin odemezse ondan
  // istenir, o da odemezse malikten.
  const asil = alici === 'SAKIN' ? (sakin as BolumIliskisi) : (kiraci as BolumIliskisi);
  const araKatman: readonly BorcSorumlusu[] =
    alici === 'SAKIN' && kiraci !== undefined
      ? [{ kisiId: kiraci.kisiId, sira: 'IKINCIL', rol: 'KIRACI', cozumlemeTarihi: tahakkukTarihi }]
      : [];

  return [
    { kisiId: asil.kisiId, sira: 'ASIL', rol: alici, cozumlemeTarihi: tahakkukTarihi },
    ...araKatman,
    ...malikSorumlulari('IKINCIL'),
  ];
}

/** Zincirdeki tum asil sorumlular — tahsilat once bunlardan istenir. */
export function asilSorumlular(zincir: readonly BorcSorumlusu[]): readonly BorcSorumlusu[] {
  const asillar = zincir.filter((s) => s.sira === 'ASIL');
  if (asillar.length === 0) {
    throw new DogrulamaHatasi('Borc sorumluluk zincirinde ASIL sorumlu yok.');
  }
  return asillar;
}

/**
 * Zincirdeki TEK asil sorumlu.
 *
 * Coklu malik geldiginde MALIKE_AIT bir giderde birden fazla ASIL bulunur ve
 * "ilkini al" davranisi tam olarak kacinilmak istenen sessiz secimdir: borcun
 * bir kismi gorunmez olur. Bu yuzden belirsizlik HATA verir; cagiran taraf
 * `asilSorumlular()` kullanmalidir.
 */
export function asilSorumlu(zincir: readonly BorcSorumlusu[]): BorcSorumlusu {
  const asillar = asilSorumlular(zincir);
  if (asillar.length > 1) {
    throw new DogrulamaHatasi(
      `Zincirde ${asillar.length} asil sorumlu var; tek sorumlu varsayilamaz. ` +
        'Hisseli mulkiyette borc maliklere bolunur — asilSorumlular() kullanin.',
      'Tahsilati kisi bazinda ele alin.',
    );
  }
  return asillar[0] as BorcSorumlusu;
}
