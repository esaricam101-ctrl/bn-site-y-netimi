/**
 * GENEL GERİ AL (UNDO) — hangi işlem geri alınabilir, hangisi alınamaz.
 *
 * Kural katmanı core-domain'dedir çünkü geri alma TEK BİR MODÜLE ait değildir:
 * kişi · daire · belge · tahsilat · fiş · banka hareketi — hepsi aynı kurala
 * tabidir. Her modüle ayrı yazılsaydı biri unutulur ve o modülde finansal bir
 * kayıt SESSİZCE silinebilirdi.
 *
 * ⚠️  FİNANSAL KAYIT GERİ ALINIRKEN SİLİNMEZ. Geri alma, ters kayıt üretir
 *     (fiş storno · makbuz iptali). Doğrudan silme, denetim izini yok eder ve
 *     BFS v1 §5.1'i ihlal eder.
 */

export type GeriAlmaYontemi =
  | 'TERS_KAYIT' | 'GERI_YUKLE' | 'ARSIVLE' | 'ALAN_GERI_AL';

/** Denetim kaydındaki eylem — geri alınabilirlik buna göre belirlenir. */
export type AuditEylemKodu =
  | 'OLUSTUR' | 'GUNCELLE' | 'SOFT_SIL' | 'ANONIMLESTIR'
  | 'OKU' | 'DISA_AKTAR' | 'ONAYLA' | 'REDDET' | 'GIRIS' | 'CIKIS';

/**
 * Varlığın SİLME SINIFI (BFS v1 §5). Geri alma yolu buna göre değişir.
 *
 * Liste VERİ olarak burada durur (§33 kural 3). Kodda `if (varlik ===
 * 'Tahsilat')` biçiminde dağıtılsaydı yeni bir finansal varlık eklendiğinde
 * güncellenmesi unutulur ve o varlık yanlışlıkla ANA_VERI gibi davranırdı.
 */
export const VARLIK_SINIFLARI: Readonly<Record<string, 'FINANSAL' | 'ANA_VERI' | 'BELGE'>> = {
  // --- FİNANSAL: asla silinmez, düzeltme ters kayıtla ---
  Tahsilat: 'FINANSAL',
  YevmiyeFisi: 'FINANSAL',
  BankaHareketi: 'FINANSAL',
  Borc: 'FINANSAL',
  KiymetliEvrak: 'FINANSAL',
  BankaEkstresi: 'FINANSAL',
  EkstreSatiri: 'FINANSAL',
  MuhasebeDonemi: 'FINANSAL',

  // --- BELGE: silinmez, yeni sürüm oluşturulur ---
  Belge: 'BELGE',

  // --- ANA_VERI: soft delete ---
  Kisi: 'ANA_VERI',
  Malik: 'ANA_VERI',
  Kiraci: 'ANA_VERI',
  Sakin: 'ANA_VERI',
  Misafir: 'ANA_VERI',
  DaireGorevlisi: 'ANA_VERI',
  SitePersoneli: 'ANA_VERI',
  BagimsizBolum: 'ANA_VERI',
  Apartman: 'ANA_VERI',
  Blok: 'ANA_VERI',
  Kat: 'ANA_VERI',
  Arac: 'ANA_VERI',
  Sayac: 'ANA_VERI',
  GiderTuru: 'ANA_VERI',
  Hesap: 'ANA_VERI',
  Banka: 'ANA_VERI',
  BankaSubesi: 'ANA_VERI',
  BankaHesabi: 'ANA_VERI',
  PosTanimi: 'ANA_VERI',
};

/**
 * GERİ ALINAMAYAN eylemler ve gerekçeleri.
 *
 * ⚠️  "Geri alınamaz" demek YETMEZ; NEDEN alınamadığı kullanıcıya söylenir.
 *     Gerekçesiz ret, kullanıcıyı aynı işlemi tekrar denemeye iter.
 */
const OKUMA_EYLEMLERI: readonly AuditEylemKodu[] = ['OKU', 'DISA_AKTAR', 'GIRIS', 'CIKIS'];

export interface GeriAlinabilirlikGirdisi {
  readonly varlik: string;
  readonly eylem: AuditEylemKodu;
  /** Denetim kaydını yazan kullanıcı. */
  readonly islemSahibiId: string;
  /** Geri almak isteyen kullanıcı. */
  readonly talepEdenId: string;
  /** Bu denetim kaydı daha önce geri alındı mı. */
  readonly zatenGeriAlindiMi: boolean;
  /**
   * Varlığın ARDINDAN başka değişiklik oldu mu (daha yeni denetim kaydı var
   * mı). Varsa güncelleme geri alınamaz.
   */
  readonly dahaYeniDegisiklikVarMi: boolean;
  /** Finansal kayıt zaten ters kayıtlanmış/iptal edilmiş mi. */
  readonly zatenTersKayitliMi?: boolean;
  /** Muhasebeleşmiş mi (fişe dayanak olmuş mu). */
  readonly muhasebelestiMi?: boolean;
  /** Kaydın dönemi kapalı mı. */
  readonly donemKapaliMi?: boolean;
}

export interface GeriAlinabilirlikSonucu {
  readonly geriAlinabilirMi: boolean;
  readonly yontem: GeriAlmaYontemi | null;
  /** Alınamıyorsa GEREKÇE — kullanıcıya gösterilir. */
  readonly gerekce: string | null;
  /** Kullanıcıya gösterilecek onay metni. */
  readonly onayMetni: string | null;
}

function ret(gerekce: string): GeriAlinabilirlikSonucu {
  return { geriAlinabilirMi: false, yontem: null, gerekce, onayMetni: null };
}

/**
 * Bir denetim kaydının geri alınıp alınamayacağını belirler.
 *
 * Sıra ÖNEMLİ: en kesin engeller önce denenir. "Başkasının işlemi" ile
 * "zaten geri alınmış" aynı anda doğruysa, kullanıcıya yetki gerekçesi
 * gösterilir — kendi işlemi olmayan bir kayıt hakkında ayrıntı vermek gereksiz
 * bilgi sızdırır.
 */
export function geriAlinabilirMi(
  g: GeriAlinabilirlikGirdisi,
): GeriAlinabilirlikSonucu {
  // 1. KULLANICI BAZLI: yalnızca kendi işlemi.
  if (g.islemSahibiId !== g.talepEdenId) {
    return ret(
      'Bu işlem başka bir kullanıcı tarafından yapılmış. Geri alma yalnızca ' +
        'kendi işlemleriniz için çalışır.',
    );
  }

  if (g.zatenGeriAlindiMi) {
    return ret(
      'Bu işlem zaten geri alınmış. Aynı işlem iki kez geri alınamaz: ' +
        'alınabilseydi arada yapılan başka değişiklikler sessizce silinirdi.',
    );
  }

  // 2. OKUMA eylemleri geri alınamaz — geri alınacak bir değişiklik yok.
  if (OKUMA_EYLEMLERI.includes(g.eylem)) {
    return ret(
      `'${g.eylem}' bir okuma/oturum kaydıdır; geri alınacak bir değişiklik yok.`,
    );
  }

  // 3. ANONİMLEŞTİRME GERİ ALINAMAZ — KVKK gereği veri geri döndürülemez
  //    biçimde silinmiştir. "Geri al" düğmesi sunulsaydı kullanıcı verinin
  //    hâlâ durduğunu sanardı.
  if (g.eylem === 'ANONIMLESTIR') {
    return ret(
      'Anonimleştirme geri alınamaz: KVKK uyarınca veri geri döndürülemez ' +
        'biçimde temizlenmiştir.',
    );
  }

  if (g.eylem === 'ONAYLA' || g.eylem === 'REDDET') {
    return ret(
      `'${g.eylem}' bir iş akışı kararıdır; geri alma ile değil karşı kararla ` +
        'düzeltilir.',
    );
  }

  const sinif = VARLIK_SINIFLARI[g.varlik];
  if (sinif === undefined) {
    // ⚠️ BİLİNMEYEN VARLIK REDDEDİLİR. "Muhtemelen ana veridir" varsayımıyla
    //    devam edilseydi, listeye eklenmeyi unutmuş FİNANSAL bir varlık
    //    silinebilirdi.
    return ret(
      `'${g.varlik}' için geri alma kuralı tanımlı değil; işlem güvenli ` +
        'olmadığı için reddedildi.',
    );
  }

  // 4. DÖNEM KAPALIYSA hiçbir finansal düzeltme yapılamaz.
  if (g.donemKapaliMi === true) {
    return ret(
      'Kaydın muhasebe dönemi KAPALI. Kapanmış bir mali yılın kaydı ' +
        'değiştirilemez; düzeltme açık dönemde ters kayıtla yapılır.',
    );
  }

  // 5. FİNANSAL: ters kayıt yolu.
  if (sinif === 'FINANSAL') {
    if (g.eylem !== 'OLUSTUR') {
      return ret(
        `Finansal kayıtta '${g.eylem}' işlemi geri alınamaz. Düzeltme yalnızca ` +
          'ters kayıtla (storno / iptal) yapılır ve bu ancak OLUŞTURMA ' +
          'işlemi için anlamlıdır.',
      );
    }
    if (g.zatenTersKayitliMi === true) {
      return ret('Bu finansal kayıt zaten ters kayıtlanmış ya da iptal edilmiş.');
    }
    if (g.muhasebelestiMi === true) {
      return ret(
        'Kayıt muhasebeleşmiş (bir yevmiye fişine dayanak olmuş). Önce fişi ' +
          'ters kayıtla (storno) iptal edin; kayıt ancak ondan sonra geri ' +
          'alınabilir.',
      );
    }
    return {
      geriAlinabilirMi: true,
      yontem: 'TERS_KAYIT',
      gerekce: null,
      onayMetni:
        `Bu finansal kayıt SİLİNMEYECEK. Yerine ters kayıt üretilecek ve iki ` +
        `kayıt da defterde kalacak. Onaylıyor musunuz?`,
    };
  }

  // 6. BELGE: silinmez, sürümlenir. Yükleme geri alınırsa sürüm arşivlenir.
  if (sinif === 'BELGE') {
    if (g.eylem === 'SOFT_SIL') {
      return {
        geriAlinabilirMi: true, yontem: 'GERI_YUKLE', gerekce: null,
        onayMetni: 'Arşivlenen belge geri yüklenecek. Onaylıyor musunuz?',
      };
    }
    if (g.eylem === 'OLUSTUR') {
      return {
        geriAlinabilirMi: true, yontem: 'ARSIVLE', gerekce: null,
        onayMetni:
          'Yüklenen belge ARŞİVLENECEK; dosya silinmeyecek ve sürüm geçmişi ' +
          'korunacak. Onaylıyor musunuz?',
      };
    }
    return ret(
      'Belge güncellemesi geri alınamaz: belgeler üzerine yazılmaz, yeni ' +
        'sürüm oluşturulur. Önceki sürüme dönmek için sürüm geçmişini kullanın.',
    );
  }

  // 7. ANA_VERI.
  if (g.eylem === 'SOFT_SIL') {
    return {
      geriAlinabilirMi: true, yontem: 'GERI_YUKLE', gerekce: null,
      onayMetni: 'Arşivlenen kayıt geri yüklenecek. Onaylıyor musunuz?',
    };
  }
  if (g.eylem === 'OLUSTUR') {
    return {
      geriAlinabilirMi: true, yontem: 'ARSIVLE', gerekce: null,
      onayMetni:
        'Oluşturulan kayıt ARŞİVLENECEK (soft delete); veri silinmeyecek. ' +
        'Onaylıyor musunuz?',
    };
  }

  // GUNCELLE — yalnızca ARADA BAŞKA DEĞİŞİKLİK YOKSA.
  // ⚠️ Varsa geri alma, sonraki değişikliği de sessizce siler: kullanıcı
  //    kendi eski işlemini geri aldığını sanırken başkasının yeni düzeltmesini
  //    yok eder.
  if (g.dahaYeniDegisiklikVarMi) {
    return ret(
      'Bu kayıt sonradan tekrar değiştirilmiş. Eski bir güncellemeyi geri ' +
        'almak, sonraki değişiklikleri de sessizce siler. Önce en son ' +
        'değişikliği geri alın.',
    );
  }

  return {
    geriAlinabilirMi: true, yontem: 'ALAN_GERI_AL', gerekce: null,
    onayMetni: 'Değiştirilen alanlar önceki değerlerine döndürülecek. Onaylıyor musunuz?',
  };
}

/**
 * Geri alınacak alanları hesaplar: `oncekiDeger`de olup `sonrakiDeger`de
 * DEĞİŞMİŞ olanlar.
 *
 * ⚠️  YALNIZCA DEĞİŞEN ALANLAR yazılır. `oncekiDeger`in tamamı yazılsaydı,
 *     denetim kaydına girmemiş ama sonradan değişmiş alanlar da eski değere
 *     dönerdi — kullanıcının hiç dokunmadığı veriyi geri almış olurduk.
 */
export function geriAlinacakAlanlar(
  oncekiDeger: Readonly<Record<string, unknown>> | null,
  sonrakiDeger: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> {
  if (oncekiDeger === null) return {};
  const sonuc: Record<string, unknown> = {};
  for (const [alan, eski] of Object.entries(oncekiDeger)) {
    const yeni = sonrakiDeger?.[alan];
    if (JSON.stringify(eski) !== JSON.stringify(yeni)) sonuc[alan] = eski;
  }
  return sonuc;
}
