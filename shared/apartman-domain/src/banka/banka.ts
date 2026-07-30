/**
 * Banka cekirdegi — IBAN · hareket yonu · mutabakat · kiymetli evrak.
 *
 * Para her yerde `Money` (olcekli bigint · ADR-0007). Komisyon ve tolerans
 * BINDE tam sayidir; ondalik oran float olurdu ve komisyon kurus sapardi.
 */
import { cikar, sifir, topla, type Money, type TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi } from '@bnos/core-domain';

export type HareketYonu = 'GIRIS' | 'CIKIS';
export type BankaIslemTipi =
  | 'HAVALE' | 'EFT' | 'FAST' | 'VIRMAN' | 'MASRAF' | 'FAIZ'
  | 'POS_TAHSILAT' | 'CEK_TAHSIL' | 'SENET_TAHSIL' | 'NAKIT' | 'DIGER';
export type PosTipi = 'FIZIKI' | 'SANAL';
export type MutabakatDurumu = 'ESLESMEDI' | 'ESLESTI' | 'FARK_KABUL';
export type KiymetliEvrakTipi = 'CEK' | 'SENET';
export type KiymetliEvrakDurumu =
  | 'PORTFOYDE' | 'TAHSILDE' | 'TAHSIL_EDILDI' | 'KARSILIKSIZ'
  | 'CIRO_EDILDI' | 'IADE_EDILDI';

/* ------------------------------- IBAN ---------------------------------- */

/**
 * IBAN DOGRULAMASI — mod-97 saglama toplamiyla.
 *
 * ⚠️  UZUNLUK VE ONEK DENETIMI YETMEZ. Tek hane yanlis girilmis bir IBAN
 *     bicimsel olarak kusursuz gorunur; mod-97 olmadan bu hata ancak para
 *     BASKA BIR HESABA gittiginde anlasilir. Saglama toplami, tek hane
 *     hatalarinin ve komsu hane yer degistirmelerinin tamamini yakalar
 *     (ISO 13616).
 *
 * Turkiye IBAN'i 26 karakterdir: TR + 2 kontrol + 5 banka + 1 rezerv +
 * 16 hesap. Ulke kodu TR'ye SABITLENMEZ: yurt disi havale karsi IBAN'i da
 * bu fonksiyonla dogrulanir.
 */
export function ibaniDogrula(ham: string): string {
  const normal = ham.replace(/\s/gu, '').toUpperCase();

  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/u.test(normal)) {
    throw new DogrulamaHatasi(
      `Gecersiz IBAN bicimi: '${ham}'. Bicim: iki harf ulke kodu + iki kontrol ` +
        'hanesi + hesap bolumu.',
      'IBAN\'i bosluksuz ve eksiksiz girin.',
    );
  }
  if (normal.startsWith('TR') && normal.length !== 26) {
    throw new DogrulamaHatasi(
      `Turkiye IBAN'i 26 karakter olmalidir; verilen ${normal.length} karakter.`,
    );
  }

  // ISO 13616: ilk dort karakter sona tasinir, harfler sayiya cevrilir
  // (A=10 … Z=35), sonuc mod 97 = 1 olmalidir.
  const tasinmis = normal.slice(4) + normal.slice(0, 4);
  let kalan = 0;
  for (const ch of tasinmis) {
    const kod = ch.charCodeAt(0);
    // 0-9 -> '0'..'9' (48-57), A-Z -> 10..35
    const parca = kod >= 48 && kod <= 57
      ? String(kod - 48)
      : String(kod - 55);
    // Basamak basamak mod alinir: 30+ haneli sayiyi BigInt'e cevirmek de
    // dogru olurdu ama bu yol tahsis yapmaz ve tasma riski tasimaz.
    for (const d of parca) {
      kalan = (kalan * 10 + Number(d)) % 97;
    }
  }
  if (kalan !== 1) {
    throw new DogrulamaHatasi(
      `IBAN saglama toplami gecersiz: '${ham}'.`,
      'Tek hane yanlis girilmis bir IBAN bicimsel olarak dogru gorunur; ' +
        'numarayi dekonttan tekrar okuyun.',
    );
  }
  return normal;
}

/** IBAN'in 5-8. haneleri banka (EFT) kodudur. Mutabakatta kaynak bankayi verir. */
export function ibandanBankaKodu(iban: string): string | null {
  const normal = iban.replace(/\s/gu, '').toUpperCase();
  if (!normal.startsWith('TR') || normal.length !== 26) return null;
  return normal.slice(4, 9);
}

/* --------------------------- Hareket ve bakiye -------------------------- */

export interface BankaHareketi {
  readonly id: string;
  readonly bankaHesabiId: string;
  readonly islemTipi: BankaIslemTipi;
  readonly yon: HareketYonu;
  /** ISARETSIZ tutar; yon `yon` alanindadir. */
  readonly tutar: Money;
  readonly islemTarihi: TakvimTarihi;
  readonly valorTarihi: TakvimTarihi | null;
  readonly referansNo: string | null;
  /** Muhasebelesmis hareket DEGISTIRILEMEZ. */
  readonly yevmiyeFisiId: string | null;
}

export interface HareketGirdisi {
  readonly islemTipi: BankaIslemTipi;
  readonly yon: HareketYonu;
  readonly tutar: Money;
  readonly islemTarihi: TakvimTarihi;
  readonly valorTarihi: TakvimTarihi | null;
}

/**
 * Hareketi dogrular.
 *
 * ⚠️  TUTAR POZITIF OLMAK ZORUNDA. Negatif tutarla cikis yazmak mumkun
 *     olsaydi "toplam giris" sorgusu negatifleri de toplar ve bakiye isaret
 *     karisikligiyla bozulurdu. Yon AYRI alandir.
 */
export function hareketiDogrula(g: HareketGirdisi, bugun: TakvimTarihi): void {
  if (g.tutar.kurus <= 0n) {
    throw new DogrulamaHatasi(
      'Banka hareketi tutari sifirdan buyuk olmalidir.',
      'Cikis kaydi negatif tutarla DEGIL yon alaniyla yazilir.',
    );
  }
  if (g.islemTarihi > bugun) {
    throw new DogrulamaHatasi(
      `Islem tarihi gelecekte olamaz (${g.islemTarihi} > ${bugun}).`,
    );
  }
  if (g.valorTarihi !== null && g.valorTarihi < g.islemTarihi) {
    throw new DogrulamaHatasi(
      `Valor tarihi (${g.valorTarihi}) islem tarihinden (${g.islemTarihi}) once olamaz.`,
      'Valor, paranin hesaba gectigi gundur; islemden once olamaz.',
    );
  }
  // VIRMAN tek basina yazilamaz: iki bacagi vardir ve `virmaniDogrula`
  // uzerinden gecmelidir.
  if (g.islemTipi === 'VIRMAN') {
    throw new DogrulamaHatasi(
      'Virman tek hareket olarak yazilamaz.',
      'Virman IKI hareket uretir (cikis + giris) ve iki hesap birbirinden ' +
        'farkli olmalidir; virman ucunu kullanin.',
    );
  }
}

/**
 * Muhasebelesmis hareket DEGISTIRILEMEZ / SILINEMEZ.
 *
 * Hareket bir yevmiye fisine dayanak olmustur; degisirse fis ile banka
 * gercegi ayrisir ve mutabakat kalici olarak tutmaz. Duzeltme, fisin
 * storno'su + yeni hareket ile yapilir.
 */
export function hareketDegistirilebilirMi(h: BankaHareketi): void {
  if (h.yevmiyeFisiId !== null) {
    throw new DogrulamaHatasi(
      'Muhasebelesmis banka hareketi degistirilemez.',
      'Once ilgili yevmiye fisini ters kayitla iptal edin, sonra hareketi ' +
        'yeniden girin.',
    );
  }
}

export interface VirmanGirdisi {
  readonly kaynakHesapId: string;
  readonly hedefHesapId: string;
  readonly tutar: Money;
  readonly islemTarihi: TakvimTarihi;
}

/**
 * VIRMAN — kendi hesaplari arasi transfer.
 *
 * Iki hareket uretir ve ikisi birbirine referans verir. Tek kayit olsaydi
 * iki hesabin bakiyesi tek satirdan turetilmek zorunda kalir ve hesap bazli
 * ekstre eksik cikardi.
 */
export function virmaniDogrula(g: VirmanGirdisi, bugun: TakvimTarihi): void {
  if (g.kaynakHesapId === g.hedefHesapId) {
    throw new DogrulamaHatasi(
      'Virmanda kaynak ve hedef hesap ayni olamaz.',
      'Ayni hesaba virman, bakiyeyi degistirmeyen iki gurultu satiri uretir.',
    );
  }
  hareketiDogrula(
    {
      islemTipi: 'HAVALE', yon: 'CIKIS', tutar: g.tutar,
      islemTarihi: g.islemTarihi, valorTarihi: null,
    },
    bugun,
  );
}

/**
 * Hesap bakiyesi. Aciliş bakiyesi + girisler - cikislar.
 *
 * ⚠️  VALOR mi ISLEM tarihi mi? Cagiran karar verir ve hareketleri ona gore
 *     suzer. Ikisi karistirilirsa POS tahsilati henuz hesaba gecmemisken
 *     bakiyede gorunur ve harcanabilir sanilir.
 */
export function hesapBakiyesi(
  acilis: Money,
  hareketler: readonly { readonly yon: HareketYonu; readonly tutar: Money }[],
): Money {
  let bakiye = acilis;
  for (const h of hareketler) {
    bakiye = h.yon === 'GIRIS' ? topla(bakiye, h.tutar) : cikar(bakiye, h.tutar);
  }
  return bakiye;
}

/**
 * POS komisyonu. Oran BINDE tam sayidir: `25` = binde 25 = %2,5.
 *
 * BINDE tutulur cunku gercek POS sozlesmeleri %2,5 · %1,79 gibi kesirli oranlar
 * icerir; yuzde tam sayi olsaydi bunlar temsil edilemezdi. Oran `number` yerine
 * ondalik tutulsaydi (0.025) her tahsilatta float sapmasi kurusa yansirdi.
 *
 * Bolme BigInt tam bolmesidir: sonuc olcegin son hanesinde ASAGI kirpilir.
 * Kirpilan miktar olcek 4'te kurusun onbinde biridir ve daima uye isyeri
 * lehinedir; komisyon fazla hesaplanip aidat sahibinden eksik tahsil edilmez.
 */
export function posKomisyonu(brutTutar: Money, komisyonBinde: number): Money {
  if (komisyonBinde < 0 || komisyonBinde > 1000) {
    throw new DogrulamaHatasi(
      `Gecersiz komisyon orani: binde ${komisyonBinde}. 0 ile 1000 arasi olmalidir.`,
    );
  }
  if (komisyonBinde === 0) return sifir(brutTutar.paraBirimi);
  // BigInt aritmetigi: (tutar * binde) / 1000. Number'a cevirip carpmak
  // float yuvarlamasi yapardi.
  const kurus = (brutTutar.kurus * BigInt(komisyonBinde)) / 1000n;
  return { kurus, paraBirimi: brutTutar.paraBirimi, kur: brutTutar.kur };
}

/* ------------------------------ Mutabakat ------------------------------- */

export interface EkstreSatiri {
  readonly id: string;
  readonly islemTarihi: TakvimTarihi;
  readonly yon: HareketYonu;
  readonly tutar: Money;
  readonly referansNo: string | null;
  readonly mutabakatDurumu: MutabakatDurumu;
  readonly eslesenHareketId: string | null;
}

export interface EslestirmeAdayi {
  readonly hareketId: string;
  readonly yon: HareketYonu;
  readonly tutar: Money;
  readonly islemTarihi: TakvimTarihi;
  readonly referansNo: string | null;
  /** Zaten baska bir satirla eslesmis mi. */
  readonly esleshmisMi: boolean;
}

export interface EslestirmeAyari {
  /** Kabul edilen tutar farki (kurus). 0 = tam eslesme zorunlu. */
  readonly toleransKurus: number;
  /** Tarih penceresi (gun). Banka valor yuzunden bir-iki gun kayabilir. */
  readonly gunPenceresi: number;
}

/**
 * Bir ekstre satiri icin EN IYI eslestirme adayini bulur.
 *
 * Sira: (1) referans no tam eslesmesi, (2) yon + tutar + tarih penceresi.
 * Referans once denenir cunku banka dekont numarasi tekildir; tutar/tarih
 * eslesmesi ayni gun ayni tutarli iki havalede YANLIS eslesme uretebilir.
 *
 * ⚠️  ZATEN ESLESMIS hareket aday DEGILDIR. Olsaydi ayni para iki kez
 *     mutabik sayilir ve gercek fark gizlenirdi.
 *
 * ⚠️  BIRDEN COK ADAY varsa `null` doner — otomatik secim YAPILMAZ.
 *     Belirsizligi kullanici cozer; makine tahmin ederse yanlis eslesme
 *     sessizce mutabakati tamamlanmis gosterir.
 */
export function eslestirmeAdayiBul(
  satir: EkstreSatiri,
  adaylar: readonly EslestirmeAdayi[],
  ayar: EslestirmeAyari,
): { readonly hareketId: string; readonly yontem: 'REFERANS' | 'TUTAR_TARIH' } | null {
  const uygun = adaylar.filter((a) => !a.esleshmisMi && a.yon === satir.yon);

  if (satir.referansNo !== null && satir.referansNo.trim() !== '') {
    const referansla = uygun.filter((a) => a.referansNo === satir.referansNo);
    if (referansla.length === 1) {
      const tek = referansla[0];
      if (tek !== undefined) return { hareketId: tek.hareketId, yontem: 'REFERANS' };
    }
    // Ayni referansla birden cok hareket varsa BELIRSIZDIR; tutara dusmek
    // yanlis eslesme riskini artirir, kullaniciya birakilir.
    if (referansla.length > 1) return null;
  }

  const tolerans = BigInt(ayar.toleransKurus);
  const tutarTarihle = uygun.filter((a) => {
    const fark = a.tutar.kurus > satir.tutar.kurus
      ? a.tutar.kurus - satir.tutar.kurus
      : satir.tutar.kurus - a.tutar.kurus;
    if (fark > tolerans) return false;
    return gunFarki(a.islemTarihi, satir.islemTarihi) <= ayar.gunPenceresi;
  });

  if (tutarTarihle.length === 1) {
    const tek = tutarTarihle[0];
    if (tek !== undefined) return { hareketId: tek.hareketId, yontem: 'TUTAR_TARIH' };
  }
  return null;
}

/** Iki takvim tarihi arasindaki gun sayisi (isaretsiz). */
export function gunFarki(a: TakvimTarihi, b: TakvimTarihi): number {
  const t1 = Date.parse(`${a}T00:00:00.000Z`);
  const t2 = Date.parse(`${b}T00:00:00.000Z`);
  return Math.abs(Math.round((t1 - t2) / 86_400_000));
}

/**
 * Eslestirmeyi dogrular.
 *
 * ⚠️  YON AYNI OLMAK ZORUNDA. Girisi cikisla eslestirmek, iki hatayi
 *     birbirine mahsup ederek ikisini de gizler.
 */
export function eslestirmeyiDogrula(
  satir: EkstreSatiri,
  aday: EslestirmeAdayi,
  ayar: EslestirmeAyari,
): void {
  if (satir.mutabakatDurumu !== 'ESLESMEDI') {
    throw new DogrulamaHatasi(
      'Bu ekstre satiri zaten mutabik edilmis.',
      'Once mevcut eslesmeyi kaldirin.',
    );
  }
  if (aday.esleshmisMi) {
    throw new DogrulamaHatasi(
      'Bu banka hareketi baska bir ekstre satiriyla zaten eslesmis.',
      'Ayni hareket iki satirla eslesirse ayni para iki kez mutabik sayilir ' +
        've gercek fark gizlenir.',
    );
  }
  if (aday.yon !== satir.yon) {
    throw new DogrulamaHatasi(
      `Yonler uyusmuyor (ekstre: ${satir.yon}, hareket: ${aday.yon}).`,
      'Girisi cikisla eslestirmek iki hatayi birbirine mahsup eder ve ' +
        'ikisini de gizler.',
    );
  }
  const fark = aday.tutar.kurus > satir.tutar.kurus
    ? aday.tutar.kurus - satir.tutar.kurus
    : satir.tutar.kurus - aday.tutar.kurus;
  if (fark > BigInt(ayar.toleransKurus)) {
    throw new DogrulamaHatasi(
      `Tutar farki tolerans disinda (fark ${fark} kurus, tolerans ` +
        `${ayar.toleransKurus} kurus).`,
      'Fark kabul edilecekse FARK_KABUL durumunu gerekce ile kullanin.',
    );
  }
}

export interface MutabakatOzeti {
  readonly satirSayisi: number;
  readonly eslesenSayisi: number;
  readonly farkKabulSayisi: number;
  readonly eslesmeyenSayisi: number;
  /** Bankanin beyan ettigi kapanis ile sistem bakiyesi arasindaki fark. */
  readonly bakiyeFarki: Money;
  readonly mutabikMi: boolean;
}

/**
 * Mutabakat ozeti.
 *
 * ⚠️  `mutabikMi` yalnizca (a) eslesmeyen satir kalmadiginda VE (b) bakiye
 *     farki sifir oldugunda dogrudur. Yalnizca satir sayisina bakilsaydi,
 *     ekstrede hic gorunmeyen bir sistem hareketi (bizde var bankada yok)
 *     mutabakati tamamlanmis gosterirdi.
 */
export function mutabakatOzeti(
  satirlar: readonly EkstreSatiri[],
  bankaKapanisBakiyesi: Money,
  sistemBakiyesi: Money,
): MutabakatOzeti {
  const eslesen = satirlar.filter((s) => s.mutabakatDurumu === 'ESLESTI').length;
  const farkKabul = satirlar.filter((s) => s.mutabakatDurumu === 'FARK_KABUL').length;
  const eslesmeyen = satirlar.filter((s) => s.mutabakatDurumu === 'ESLESMEDI').length;
  const bakiyeFarki = cikar(bankaKapanisBakiyesi, sistemBakiyesi);

  return {
    satirSayisi: satirlar.length,
    eslesenSayisi: eslesen,
    farkKabulSayisi: farkKabul,
    eslesmeyenSayisi: eslesmeyen,
    bakiyeFarki,
    mutabikMi: eslesmeyen === 0 && bakiyeFarki.kurus === 0n,
  };
}

/* --------------------------- Kiymetli evrak ----------------------------- */

/**
 * Cek/senet durum makinesi. ATLAMA KABUL ETMEZ.
 *
 *   PORTFOYDE → TAHSILDE      (bankaya tahsile verildi)
 *   PORTFOYDE → CIRO_EDILDI   (baskasina devredildi)
 *   PORTFOYDE → IADE_EDILDI   (borcluya geri verildi)
 *   TAHSILDE  → TAHSIL_EDILDI (para hesaba gecti)
 *   TAHSILDE  → KARSILIKSIZ   (banka odemedi)
 *   TAHSILDE  → PORTFOYDE     (tahsilden geri alindi)
 *
 * ⚠️  PORTFOYDE'den dogrudan TAHSIL_EDILDI'ye gecilemez: cek bankaya
 *     verilmediyse tahsil edilmis olamaz. Bu atlamaya izin verilseydi
 *     "tahsilde bekleyen cekler" listesi hicbir zaman dogru olmazdi.
 */
const GECERLI_GECISLER: Readonly<Record<KiymetliEvrakDurumu, readonly KiymetliEvrakDurumu[]>> = {
  PORTFOYDE: ['TAHSILDE', 'CIRO_EDILDI', 'IADE_EDILDI'],
  TAHSILDE: ['TAHSIL_EDILDI', 'KARSILIKSIZ', 'PORTFOYDE'],
  // Ucu kapali durumlar: tahsil edilmis bir cek geri donmez.
  TAHSIL_EDILDI: [],
  CIRO_EDILDI: [],
  IADE_EDILDI: [],
  // Karsiliksiz cek tekrar tahsile verilebilir (yasal takip / yeniden ibraz).
  KARSILIKSIZ: ['TAHSILDE'],
};

/** Olumsuz sonuclanan durumlar gerekce ISTER. */
const GEREKCE_ISTEYEN: readonly KiymetliEvrakDurumu[] = ['KARSILIKSIZ', 'IADE_EDILDI'];

export interface DurumGecisiGirdisi {
  readonly mevcut: KiymetliEvrakDurumu;
  readonly hedef: KiymetliEvrakDurumu;
  readonly gerekce: string | null;
  /** TAHSIL_EDILDI icin hesap ve tarih zorunludur. */
  readonly tahsilHesabiVarMi: boolean;
  readonly tahsilTarihiVarMi: boolean;
}

export function durumGecisiniDogrula(g: DurumGecisiGirdisi): void {
  if (g.mevcut === g.hedef) {
    throw new DogrulamaHatasi(
      `Evrak zaten ${g.hedef} durumunda.`,
      'Islem tekrarlanmaz.',
    );
  }
  const izinli = GECERLI_GECISLER[g.mevcut];
  if (!izinli.includes(g.hedef)) {
    throw new DogrulamaHatasi(
      `${g.mevcut} durumundan ${g.hedef} durumuna gecilemez. ` +
        `Izinli gecisler: ${izinli.length === 0 ? 'yok (kapali durum)' : izinli.join(', ')}.`,
      g.hedef === 'TAHSIL_EDILDI' && g.mevcut === 'PORTFOYDE'
        ? 'Cek/senet once TAHSILDE durumuna alinmalidir: bankaya verilmemis ' +
          'bir evrak tahsil edilmis olamaz.'
        : 'Durum makinesi atlama kabul etmez.',
    );
  }
  if (GEREKCE_ISTEYEN.includes(g.hedef) && (g.gerekce === null || g.gerekce.trim().length < 5)) {
    throw new DogrulamaHatasi(
      `${g.hedef} durumu icin gerekce zorunludur (en az 5 karakter).`,
      'Karsiliksiz cikan ya da iade edilen bir evragin neden oyle ' +
        'isaretlendigi sonradan sorulabilir olmalidir.',
    );
  }
  if (g.hedef === 'TAHSIL_EDILDI' && (!g.tahsilHesabiVarMi || !g.tahsilTarihiVarMi)) {
    throw new DogrulamaHatasi(
      'Tahsil icin hesap ve tahsil tarihi zorunludur.',
      'Hangi hesaba ve ne zaman girdigi bilinmeyen bir tahsilat mutabik ' +
        'edilemez.',
    );
  }
}

export interface KiymetliEvrakGirdisi {
  readonly tip: KiymetliEvrakTipi;
  readonly tutar: Money;
  readonly vadeTarihi: TakvimTarihi;
  readonly alisTarihi: TakvimTarihi;
  readonly borcluAdi: string;
  readonly evrakNo: string;
}

export function kiymetliEvrakiDogrula(g: KiymetliEvrakGirdisi): void {
  if (g.tutar.kurus <= 0n) {
    throw new DogrulamaHatasi('Kiymetli evrak tutari sifirdan buyuk olmalidir.');
  }
  if (g.vadeTarihi < g.alisTarihi) {
    throw new DogrulamaHatasi(
      `Vade (${g.vadeTarihi}) alis tarihinden (${g.alisTarihi}) once olamaz.`,
      'Gecmis vadeli bir cek zaten tahsil edilmis ya da karsiliksiz kalmistir; ' +
        'portfoye alinamaz.',
    );
  }
  if (g.borcluAdi.trim().length < 3) {
    throw new DogrulamaHatasi(
      'Borclu adi zorunludur (en az 3 karakter).',
      'Borclusu bilinmeyen bir evrak icin yasal takip yapilamaz.',
    );
  }
  if (g.evrakNo.trim().length < 1) {
    throw new DogrulamaHatasi('Evrak numarasi zorunludur.');
  }
}

/**
 * Vadesi gelen/gecen evrak. `gun` tarihinde vadesi dolmus ve HALA tahsil
 * edilmemis olanlar.
 *
 * Kapali durumlar (tahsil edilmis · ciro · iade) DISLANIR: onlar artik
 * beklenen bir tahsilat degildir.
 */
export function vadesiGelenler<T extends {
  readonly vadeTarihi: TakvimTarihi; readonly durum: KiymetliEvrakDurumu;
}>(evraklar: readonly T[], gun: TakvimTarihi): readonly T[] {
  const acik: readonly KiymetliEvrakDurumu[] = ['PORTFOYDE', 'TAHSILDE', 'KARSILIKSIZ'];
  return evraklar.filter((e) => acik.includes(e.durum) && e.vadeTarihi <= gun);
}
