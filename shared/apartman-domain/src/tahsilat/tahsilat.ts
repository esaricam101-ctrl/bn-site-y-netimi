/**
 * Tahsilat ve CARI YARDIMCI DEFTERI kurallari (ADR-0010).
 *
 * Cari hesap ayri bir varlik degildir: kontrol hesabi `120 Alicilar` ile
 * mutabik olan BOLUM BAZLI yardimci defterdir. Borc bolume aittir (KMK md. 22);
 * kisi ekstresi bir GORUNUMDUR.
 *
 * Para her yerde `Money` (olcekli bigint · ADR-0007).
 */
import { apiBicimi, cikar, sifir, topla, type Money, type TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type TahsilatKanali = 'NAKIT' | 'BANKA' | 'POS' | 'CEK' | 'SENET' | 'MAHSUP';
export type TahsilatDurumu = 'GECERLI' | 'IPTAL';

/* ------------------------------- Tahsilat -------------------------------- */

export interface TahsilatGirdisi {
  readonly kanal: TahsilatKanali;
  readonly tutar: Money;
  readonly tahsilatTarihi: TakvimTarihi;
  /** BANKA kanali icin ZORUNLU kanit. */
  readonly bankaHareketiVarMi: boolean;
  /** CEK/SENET kanali icin ZORUNLU kanit. */
  readonly kiymetliEvrakVarMi: boolean;
}

/**
 * Tahsilati dogrular.
 *
 * ⚠️  KANAL KANIT ISTER. "Banka" secilip banka hareketi baglanmazsa tahsilat
 *     mutabakatta GORUNMEZ: para hesaba girmis ama hangi borcu kapattigi
 *     kayitsiz kalir. Bu yuzden bag zorunludur ve hem burada hem veritabani
 *     CHECK'inde iki kez zorlanir — biri atlanirsa oteki tutar.
 *
 * ⚠️  NAKIT tahsilatin banka hareketi OLAMAZ. Olsaydi ayni para iki kez
 *     sayilirdi: bir kez kasa girisi, bir kez banka girisi.
 */
export function tahsilatiDogrula(g: TahsilatGirdisi, bugun: TakvimTarihi): void {
  if (g.tutar.kurus <= 0n) {
    throw new DogrulamaHatasi(
      'Tahsilat tutari sifirdan buyuk olmalidir.',
      'Iade, negatif tahsilat olarak yazilmaz — ayri bir kavramdir ve ' +
        'toplamlari bozar.',
    );
  }
  if (g.tahsilatTarihi > bugun) {
    throw new DogrulamaHatasi(
      `Tahsilat tarihi gelecekte olamaz (${g.tahsilatTarihi} > ${bugun}).`,
      'Ileri tarihli tahsilat, henuz alinmamis parayi alinmis gosterir.',
    );
  }
  if (g.kanal === 'BANKA' && !g.bankaHareketiVarMi) {
    throw new DogrulamaHatasi(
      'Banka kanaliyla tahsilat icin banka hareketi baglanmalidir.',
      'Bag olmadan tahsilat banka mutabakatinda gorunmez: para hesaba girer ' +
        'ama hangi borcu kapattigi kayitsiz kalir.',
    );
  }
  if (g.kanal === 'NAKIT' && g.bankaHareketiVarMi) {
    throw new DogrulamaHatasi(
      'Nakit tahsilata banka hareketi baglanamaz.',
      'Ayni para iki kez sayilir: bir kez kasa girisi, bir kez banka girisi.',
    );
  }
  if ((g.kanal === 'CEK' || g.kanal === 'SENET') && !g.kiymetliEvrakVarMi) {
    throw new DogrulamaHatasi(
      `${g.kanal} kanaliyla tahsilat icin kiymetli evrak baglanmalidir.`,
      'Hangi cek/senet ile odendigi bilinmeyen tahsilat, evrak tahsil ' +
        'edilemediginde geri alinamaz.',
    );
  }
}

/**
 * Muhasebelesmis tahsilat IPTAL EDILEMEZ.
 *
 * Tahsilat bir yevmiye fisine dayanak olmustur; iptal edilirse fis ile cari
 * defter ayrisir. Duzeltme yolu: once fisin ters kaydi (storno), sonra iptal.
 */
export function tahsilatIptalEdilebilirMi(t: {
  readonly durum: TahsilatDurumu;
  readonly yevmiyeFisiId: string | null;
}): void {
  if (t.durum === 'IPTAL') {
    throw new DogrulamaHatasi('Tahsilat zaten iptal edilmis.', 'Islem tekrarlanmaz.');
  }
  if (t.yevmiyeFisiId !== null) {
    throw new DogrulamaHatasi(
      'Muhasebelesmis tahsilat iptal edilemez.',
      'Once ilgili yevmiye fisini ters kayitla (storno) iptal edin; tahsilat ' +
        'iptali ancak ondan sonra yapilabilir.',
    );
  }
}

/* -------------------------------- Tahsis --------------------------------- */

export interface AcikBorc {
  readonly borcId: string;
  /** Hisseli mulkiyette pay sahibi; tek sorumluda `null`. */
  readonly borcSorumlusuId: string | null;
  /** Bu borc/pay icin ISTENEN tutar. */
  readonly tutar: Money;
  /** Bugune kadar TAHSIS EDILMIS tutar. */
  readonly odenen: Money;
  readonly vadeTarihi: TakvimTarihi;
}

export interface TahsisGirdisi {
  readonly borcId: string;
  readonly borcSorumlusuId: string | null;
  readonly tutar: Money;
}

/** Bir borcun/payin KALAN bakiyesi. */
export function kalanBakiye(b: AcikBorc): Money {
  return cikar(b.tutar, b.odenen);
}

/**
 * Tahsisleri dogrular.
 *
 * ⚠️  TOPLAM TAHSIS, TAHSILAT TUTARINA ESIT OLMAK ZORUNDA. Eksik olsaydi
 *     paranin bir kismi hicbir borca sayilmaz ve HICBIR YERDE GORUNMEZDI —
 *     kasada/bankada duran ama defterde olmayan para. Fazla olsaydi var
 *     olmayan para dagitilmis olurdu.
 *
 *     AVANS (borcu asan odeme) su an DESTEKLENMIYOR: avansin yazilacagi bir
 *     yukumluluk hesabi (340 Alinan Avanslar) ve karsilik kaydi yok. Bu yuzden
 *     fazla odeme REDDEDILIR — sessizce yutulmaz.
 *
 * ⚠️  BIR TAHSIS, BORCUN KALAN BAKIYESINI ASAMAZ. Asabilseydi borc "fazla
 *     kapanmis" gorunur, cari bakiye NEGATIFE duser ve yardimci defter kontrol
 *     hesabiyla tutmazdi.
 */
export function tahsisleriDogrula(
  tahsilatTutari: Money,
  tahsisler: readonly TahsisGirdisi[],
  acikBorclar: readonly AcikBorc[],
): void {
  if (tahsisler.length === 0) {
    throw new DogrulamaHatasi(
      'Tahsilat en az bir borca tahsis edilmelidir.',
      'Hicbir borca sayilmayan para, kasada duran ama defterde gorunmeyen ' +
        'paradir.',
    );
  }

  const anahtar = (t: { borcId: string; borcSorumlusuId: string | null }): string =>
    `${t.borcId}|${t.borcSorumlusuId ?? ''}`;

  const borcHaritasi = new Map(acikBorclar.map((b) => [anahtar(b), b]));
  const gorulen = new Set<string>();
  let toplam = sifir(tahsilatTutari.paraBirimi);

  for (const t of tahsisler) {
    if (t.tutar.kurus <= 0n) {
      throw new DogrulamaHatasi('Tahsis tutari sifirdan buyuk olmalidir.');
    }

    const k = anahtar(t);
    if (gorulen.has(k)) {
      throw new DogrulamaHatasi(
        'Ayni borc/pay icin iki tahsis satiri verilemez.',
        'Iki satir ayni parayi iki kez saydirir; tutarlari birlestirin.',
      );
    }
    gorulen.add(k);

    const borc = borcHaritasi.get(k);
    if (borc === undefined) {
      throw new DogrulamaHatasi(
        `Tahsis edilen borc acik borclar arasinda yok: ${t.borcId}.`,
        'Kapanmis ya da baska bolume ait bir borca tahsis yapilamaz.',
      );
    }

    const kalan = kalanBakiye(borc);
    if (t.tutar.kurus > kalan.kurus) {
      throw new DogrulamaHatasi(
        `Tahsis (${apiBicimi(t.tutar)}) borcun kalan bakiyesini ` +
          `(${apiBicimi(kalan)}) asiyor.`,
        'Borc fazla kapanirsa cari bakiye negatife duser ve yardimci defter ' +
          'kontrol hesabiyla tutmaz.',
      );
    }

    toplam = topla(toplam, t.tutar);
  }

  if (toplam.kurus !== tahsilatTutari.kurus) {
    const fark = cikar(tahsilatTutari, toplam);
    throw new DogrulamaHatasi(
      `Tahsis toplami (${apiBicimi(toplam)}) tahsilat tutarina ` +
        `(${apiBicimi(tahsilatTutari)}) esit degil; fark ${apiBicimi(fark)}.`,
      fark.kurus > 0n
        ? 'Kalan tutar hicbir borca sayilmadi. Avans (borcu asan odeme) su an ' +
          'desteklenmiyor: avansin yazilacagi yukumluluk hesabi yok. Odemeyi ' +
          'acik borc kadar girin.'
        : 'Tahsis toplami odenen paradan fazla — var olmayan para dagitiliyor.',
    );
  }
}

/**
 * OTOMATIK TAHSIS onerisi — EN ESKI VADE ONCE (FIFO).
 *
 * ⚠️  ONERIDIR, YAZMAZ. Kullanici gormeden uygulanmamalidir: hangi borcun
 *     kapatildigi faiz hesabini ve yasal takip sirasini etkiler.
 *
 * ⚠️  EN ESKI VADE ONCE kurali bilinclidir: en yeni borc once kapatilsaydi
 *     eski borc surekli acik kalir, gecikme faizi buyur ve borclu her ay
 *     odeme yapmasina ragmen "temerrutte" gorunurdu.
 *
 * Artan tutar `kalan` olarak doner — SESSIZCE YUTULMAZ.
 */
export function otomatikTahsis(
  tutar: Money,
  acikBorclar: readonly AcikBorc[],
): {
  readonly tahsisler: readonly TahsisGirdisi[];
  readonly kalan: Money;
} {
  const sirali = [...acikBorclar]
    .filter((b) => kalanBakiye(b).kurus > 0n)
    .sort((a, b) => (a.vadeTarihi < b.vadeTarihi ? -1 : a.vadeTarihi > b.vadeTarihi ? 1 : 0));

  const tahsisler: TahsisGirdisi[] = [];
  let kalanPara = tutar;

  for (const borc of sirali) {
    if (kalanPara.kurus <= 0n) break;
    const borcKalan = kalanBakiye(borc);
    const verilecek = kalanPara.kurus < borcKalan.kurus ? kalanPara : borcKalan;
    tahsisler.push({
      borcId: borc.borcId,
      borcSorumlusuId: borc.borcSorumlusuId,
      tutar: verilecek,
    });
    kalanPara = cikar(kalanPara, verilecek);
  }

  return { tahsisler, kalan: kalanPara };
}

/* ------------------------------ Cari ekstre ------------------------------ */

export type EkstreSatirTipi = 'BORC' | 'TAHSILAT';

export interface CariEkstreGirdisi {
  readonly tip: EkstreSatirTipi;
  readonly tarih: TakvimTarihi;
  readonly aciklama: string;
  readonly belgeNo: string;
  readonly tutar: Money;
}

export interface CariEkstreSatiri extends CariEkstreGirdisi {
  /** Yuruyen bakiye — BORC artirir, TAHSILAT azaltir. */
  readonly bakiye: Money;
}

/**
 * CARI EKSTRE — borc ve tahsilat satirlarini tarih sirasina dizip yuruyen
 * bakiye hesaplar.
 *
 * ⚠️  AYNI GUN icinde BORC once, TAHSILAT sonra gelir. Ters siralanirsa
 *     tahsilat henuz dogmamis bir borcu kapatiyor gibi gorunur ve yuruyen
 *     bakiye o satirda NEGATIF cikar — okuyan kisi "fazla odeme yapilmis"
 *     sanir.
 *
 * ⚠️  ACILIS BAKIYESI cagirandan gelir: ekstre bir TARIH ARALIGI icindir ve
 *     aralik oncesindeki net borc satirlarda GORUNMEZ. Sifir varsayilsaydi
 *     her ekstre borclunun gecmisini silerdi.
 */
export function cariEkstre(
  acilisBakiyesi: Money,
  satirlar: readonly CariEkstreGirdisi[],
): {
  readonly satirlar: readonly CariEkstreSatiri[];
  readonly borcToplam: Money;
  readonly tahsilatToplam: Money;
  readonly kapanisBakiyesi: Money;
} {
  const tipSirasi = (t: EkstreSatirTipi): number => (t === 'BORC' ? 0 : 1);
  const sirali = [...satirlar].sort((a, b) => {
    if (a.tarih !== b.tarih) return a.tarih < b.tarih ? -1 : 1;
    return tipSirasi(a.tip) - tipSirasi(b.tip);
  });

  const birim = acilisBakiyesi.paraBirimi;
  let bakiye = acilisBakiyesi;
  let borcToplam = sifir(birim);
  let tahsilatToplam = sifir(birim);
  const sonuc: CariEkstreSatiri[] = [];

  for (const s of sirali) {
    if (s.tip === 'BORC') {
      bakiye = topla(bakiye, s.tutar);
      borcToplam = topla(borcToplam, s.tutar);
    } else {
      bakiye = cikar(bakiye, s.tutar);
      tahsilatToplam = topla(tahsilatToplam, s.tutar);
    }
    sonuc.push({ ...s, bakiye });
  }

  return {
    satirlar: sonuc,
    borcToplam,
    tahsilatToplam,
    kapanisBakiyesi: bakiye,
  };
}

/* -------------------- Yardimci defter ↔ kontrol hesabi -------------------- */

export interface KontrolMutabakati {
  readonly yardimciDefterToplami: Money;
  readonly kontrolHesabiBakiyesi: Money;
  readonly fark: Money;
  readonly mutabikMi: boolean;
}

/**
 * YARDIMCI DEFTER ile KONTROL HESABI mutabakati (ADR-0010).
 *
 * Σ (bolum cari bakiyeleri) = `120 Alicilar` hesabinin mizan bakiyesi olmak
 * ZORUNDADIR.
 *
 * ⚠️  UYUSMAZLIK DONEM KAPANISINI BLOKE EDER. Kapanisa izin verilseydi
 *     yayimlanan bilancodaki alacak tutari, borclu bazinda dokumlenen
 *     tutarlarin toplamiyla tutmazdi — ve fark hangi daireden geldigi
 *     bilinmeden kalici hale gelirdi.
 *
 * Tolerans YOKTUR: cift kayit muhasebesinde bir kurus fark da farktir.
 */
export function kontrolMutabakati(
  yardimciDefterToplami: Money,
  kontrolHesabiBakiyesi: Money,
): KontrolMutabakati {
  const fark = cikar(yardimciDefterToplami, kontrolHesabiBakiyesi);
  return {
    yardimciDefterToplami,
    kontrolHesabiBakiyesi,
    fark,
    mutabikMi: fark.kurus === 0n,
  };
}

/**
 * Gecikmis borclar — vadesi gecmis ve KALANI olanlar.
 *
 * Kapanmis borc dislanir: `odenen >= tutar` olan borc artik beklenen bir
 * tahsilat degildir ve alacak yaslandirmasinda iki kez sayilmasi bakiyeyi
 * sisirir.
 */
export function gecikmisBorclar<T extends AcikBorc>(
  borclar: readonly T[],
  gun: TakvimTarihi,
): readonly T[] {
  return borclar.filter((b) => b.vadeTarihi < gun && kalanBakiye(b).kurus > 0n);
}

/**
 * ALACAK YASLANDIRMASI — kova bazli.
 *
 * Kovalar gun cinsinden UST SINIRLARIYLA verilir; son kova sinirsizdir.
 * Yaslandirma vadeye gore yapilir, borcun DOGDUGU tarihe gore degil: temerrut
 * vadeden itibaren isler (KMK md. 20/c).
 */
export function alacakYaslandirmasi<T extends AcikBorc>(
  borclar: readonly T[],
  gun: TakvimTarihi,
  kovaSinirlari: readonly number[] = [30, 60, 90],
): readonly {
  readonly etiket: string;
  readonly altGun: number;
  readonly ustGun: number | null;
  readonly tutar: Money;
  readonly adet: number;
}[] {
  const birim = borclar[0]?.tutar.paraBirimi ?? 'TRY';
  const bugunMs = Date.parse(`${gun}T00:00:00.000Z`);
  const gunFarki = (t: TakvimTarihi): number =>
    Math.floor((bugunMs - Date.parse(`${t}T00:00:00.000Z`)) / 86_400_000);

  // Tip ACIK yazilir: `ustGun` son kovada `null`dur (sinirsiz) ve dizi
  // elemanlarinin tipi cikarima birakilsaydi her elemana `as` yazmak gerekirdi.
  const kovalar: readonly {
    readonly etiket: string;
    readonly altGun: number;
    readonly ustGun: number | null;
  }[] = [
    { etiket: 'Vadesi gelmemis', altGun: -1, ustGun: 0 },
    ...kovaSinirlari.map((ust, i) => ({
      etiket: `${(kovaSinirlari[i - 1] ?? 0) + 1}-${ust} gun`,
      altGun: (kovaSinirlari[i - 1] ?? 0) + 1,
      ustGun: ust,
    })),
    {
      etiket: `${(kovaSinirlari[kovaSinirlari.length - 1] ?? 0) + 1}+ gun`,
      altGun: (kovaSinirlari[kovaSinirlari.length - 1] ?? 0) + 1,
      ustGun: null,
    },
  ];

  return kovalar.map((k) => {
    const icindekiler = borclar.filter((b) => {
      const kalan = kalanBakiye(b);
      if (kalan.kurus <= 0n) return false;
      const gecen = gunFarki(b.vadeTarihi);
      if (k.ustGun === 0) return gecen <= 0;
      if (k.ustGun === null) return gecen >= k.altGun;
      return gecen >= k.altGun && gecen <= k.ustGun;
    });
    return {
      etiket: k.etiket,
      altGun: k.altGun,
      ustGun: k.ustGun,
      adet: icindekiler.length,
      tutar: icindekiler.reduce((acc, b) => topla(acc, kalanBakiye(b)), sifir(birim)),
    };
  });
}
