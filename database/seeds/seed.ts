/**
 * Tohum verisi — Faz 0 dikey dilimi.
 *
 * İKİ tenant oluşturur. Bu kasıtlıdır: tenant izolasyon testinin
 * çalışabilmesi için en az iki apartman gerekir (sözleşme testi CT-01).
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
// Belge saklama politikaları TEK KAYNAKTAN gelir: domain katmanı. Burada
// tekrar yazılsaydı biri güncellenip diğeri unutulurdu.
import { VARSAYILAN_BELGE_POLITIKALARI as BELGE_POLITIKALARI } from '@bnos/apartman-domain';

const prisma = new PrismaClient();

/**
 * Geliştirme şifresi: 'bnos1234'. Üretimde ASLA kullanılmaz.
 *
 * scrypt$N$r$p$tuz$ozet — SifreServisi ile aynı biçim (Node çekirdeği,
 * native bağımlılık yok). Bu özet üretilip doğrulanmıştır.
 */
const GELISTIRME_SIFRE_HASH =
  'scrypt$131072$8$1$06dAft8lIJHsbeHFYucc8Q==$9GdovR26bdPFcpXtV96jbzSTjTcywpYL/6gx4argmiuioNYMtEfo9FApnPK7FopBCy1xw+IJn78EIwJ+SJ0qiA==';

/**
 * ⚠️  BU TOHUM AYNI ZAMANDA DEMO FİKSTÜRÜDÜR.
 *
 *     CI'ın kullandığı tohum ile sunumda gösterilen veri AYNI olmak zorunda:
 *     iki ayrı fikstür tutulsaydı biri güncellenir, öteki sessizce eskir ve
 *     demo günü "bende çalışıyordu" denirdi.
 *
 *     Bu yüzden isimler söylenebilir, borçlar gerçekçi ve tahakkuk geçmişi
 *     doludur — sunumda boş ekran çıkmaz.
 */
interface BolumTohumu {
  kapiNo: string;
  kat: number;
  m2: number;
  pay: bigint;
  /** Malik adı — sunumda okunur. */
  malik: readonly [string, string];
  /**
   * HİSSELİ MÜLKİYET — malikin payı. Verilmezse 1/1 (tek malikli daire).
   *
   * ⚠️  Bu alan olmadan `borc_sorumlusu.pay` mantığı HİÇ SINANMIYORDU:
   *     12 dairenin hepsi tek malikti, bütün paylar borcun tamamına eşitti.
   *     Pay bazında tahsis kodda vardı ama hiçbir fikstür ona dokunmuyordu.
   */
  malikHissesi?: readonly [bigint, bigint];
  /** Ek hissedarlar. Payları malikinkiyle birlikte 1'e TAMAMLANMALIDIR. */
  ortaklar?: readonly { ad: readonly [string, string]; hisse: readonly [bigint, bigint] }[];
  /** Doluysa daire kirada; borç zinciri kiracıyı da kapsar. */
  kiraci?: readonly [string, string];
  /** Site tarafında hangi blok. Verilmezse ilk blok. */
  blok?: string;
}

interface ApartmanTohumu {
  kod: string;
  ad: string;
  /**
   * ⚠️  VARSAYILAN `APARTMAN`. Tohumda uzun süre HİÇ `SITE` yoktu ve bu bir
   *     sessiz boşluktu: çift taraflı muhasebe, iki kademeli gider paylaşımı
   *     ve işletme projesi zinciri SİTE tarafının konusudur — hiçbir fikstür
   *     o tarafı temsil etmiyordu. Site için yazılan kod test edilemiyordu.
   */
  tip?: 'APARTMAN' | 'SITE';
  /**
   * MUHASEBE DERİNLİĞİ (0034 · docs/APARTMAN-SITE-AYRIMI.md §2.1).
   * Verilmezse tipten TÜRETİLİR: `SITE → CIFT_TARAFLI`, `APARTMAN → BASIT`.
   * Bu bir VARSAYILANDIR, kural değil.
   */
  muhasebeDerinligi?: 'BASIT' | 'CIFT_TARAFLI';
  bolumler: BolumTohumu[];
  /** Tahakkuk geçmişi üretilsin mi (demo sitesi için). */
  tahakkukGecmisi?: boolean;
  /** Blok adları — birden çoksa site yapısı kurulur. */
  bloklar?: readonly string[];
}

const APARTMANLAR: ApartmanTohumu[] = [
  {
    // ⚠️  KOD SABİT: CT-04 `yonetici@guzel-apartmani.test` ile giriş yapar.
    kod: 'guzel-apartmani',
    ad: 'Güzel Apartmanı',
    tahakkukGecmisi: true,
    bolumler: [
      { kapiNo: '1',  kat: 1, m2: 105, pay: 80_000n, malik: ['Ayşe', 'Demir'] },
      { kapiNo: '2',  kat: 1, m2: 105, pay: 80_000n, malik: ['Mehmet', 'Yıldız'],
        kiraci: ['Elif', 'Kaya'] },
      { kapiNo: '3',  kat: 1, m2: 120, pay: 90_000n, malik: ['Fatma', 'Şahin'] },
      // HİSSELİ — iki kardeş yarı yarıya. 1.800/2 ve 1.950/2 tam bölünür;
      // tohum bir yuvarlama politikası ÜRETMEZ (o ayrı bir karardır).
      { kapiNo: '4',  kat: 2, m2: 105, pay: 80_000n, malik: ['Ali', 'Çelik'],
        malikHissesi: [1n, 2n],
        ortaklar: [{ ad: ['Veli', 'Çelik'], hisse: [1n, 2n] }] },
      { kapiNo: '5',  kat: 2, m2: 105, pay: 80_000n, malik: ['Zeynep', 'Aydın'] },
      { kapiNo: '6',  kat: 2, m2: 120, pay: 90_000n, malik: ['Mustafa', 'Doğan'],
        kiraci: ['Burak', 'Öztürk'] },
      { kapiNo: '7',  kat: 3, m2: 105, pay: 80_000n, malik: ['Hatice', 'Arslan'] },
      { kapiNo: '8',  kat: 3, m2: 105, pay: 80_000n, malik: ['Hüseyin', 'Koç'] },
      // HİSSELİ — miras yoluyla üç eşit hissedar.
      { kapiNo: '9',  kat: 3, m2: 120, pay: 90_000n, malik: ['Emine', 'Kurt'],
        malikHissesi: [1n, 3n],
        ortaklar: [
          { ad: ['Osman', 'Kurt'], hisse: [1n, 3n] },
          { ad: ['Leyla', 'Kurt'], hisse: [1n, 3n] },
        ] },
      { kapiNo: '10', kat: 4, m2: 105, pay: 80_000n, malik: ['İbrahim', 'Özdemir'] },
      { kapiNo: '11', kat: 4, m2: 105, pay: 80_000n, malik: ['Meryem', 'Aslan'],
        kiraci: ['Selin', 'Güneş'] },
      // HİSSELİ — EŞİT OLMAYAN paylar. Eşit paylı fikstür, "pay = tutar/n"
      // varsayan bir hatayı yakalayamaz; bu satır onu yakalar.
      { kapiNo: '12', kat: 4, m2: 145, pay: 65_000n, malik: ['Ahmet', 'Polat'],
        malikHissesi: [3n, 4n],
        ortaklar: [{ ad: ['Sema', 'Polat'], hisse: [1n, 4n] }] },
    ],
  },
  {
    kod: 'yesil-vadi-apartmani',
    ad: 'Yeşil Vadi Apartmanı',
    bolumler: [
      { kapiNo: '1', kat: 1, m2: 95, pay: 500_000n, malik: ['Kemal', 'Erdem'] },
      { kapiNo: '2', kat: 2, m2: 95, pay: 500_000n, malik: ['Nurten', 'Bilgin'] },
    ],
  },
  /*
   * ★ TOPLU YAPI — çift taraflı muhasebenin FİKSTÜRÜ.
   *
   * ⚠️  BU TENANT OLMADAN SİTE TARAFI TEST EDİLEMİYORDU. Tohumda uzun süre
   *     yalnızca `APARTMAN` tipi vardı; çift taraflı muhasebe, iki kademeli
   *     gider paylaşımı ve işletme projesi zinciri site tarafının konusudur
   *     ve hiçbir fikstür o tarafı temsil etmiyordu (docs/
   *     APARTMAN-SITE-AYRIMI.md §5).
   *
   * İki blok bilinçli: tek bloklu "site" blok bazlı gider ayrımını sınamaz.
   */
  {
    kod: 'papatya-sitesi',
    ad: 'Papatya Sitesi',
    tip: 'SITE',
    muhasebeDerinligi: 'CIFT_TARAFLI',
    bloklar: ['A Blok', 'B Blok'],
    tahakkukGecmisi: true,
    bolumler: [
      { kapiNo: '1', kat: 1, m2: 110, pay: 120_000n, malik: ['Sinan', 'Yalçın'], blok: 'A Blok' },
      { kapiNo: '2', kat: 1, m2: 110, pay: 120_000n, malik: ['Derya', 'Tunç'], blok: 'A Blok',
        kiraci: ['Onur', 'Bayrak'] },
      { kapiNo: '3', kat: 2, m2: 130, pay: 140_000n, malik: ['Gülay', 'Sezer'], blok: 'A Blok' },
      { kapiNo: '4', kat: 2, m2: 130, pay: 140_000n, malik: ['Tolga', 'Ekinci'], blok: 'A Blok' },
      { kapiNo: '5', kat: 1, m2: 100, pay: 110_000n, malik: ['Neriman', 'Aksu'], blok: 'B Blok' },
      { kapiNo: '6', kat: 1, m2: 100, pay: 110_000n, malik: ['Kadir', 'Uçar'], blok: 'B Blok' },
      // Sitede de hisseli mülkiyet var: pay mantığı tek fikstüre bağlı kalmasın.
      { kapiNo: '7', kat: 2, m2: 125, pay: 130_000n, malik: ['Şule', 'Baran'], blok: 'B Blok',
        malikHissesi: [1n, 2n],
        ortaklar: [{ ad: ['Cem', 'Baran'], hisse: [1n, 2n] }] },
      { kapiNo: '8', kat: 2, m2: 125, pay: 130_000n, malik: ['Levent', 'Kara'], blok: 'B Blok' },
    ],
  },
];

/**
 * DEMO TAHAKKUK GEÇMİŞİ — sunumda gösterilecek üç dönem.
 *
 * Son dönem AÇIK ve VADESİ GEÇMİŞ bırakılır: tahsilat akışı ancak gecikmiş
 * borç varsa gösterilebilir. Önceki iki dönem kapalıdır (ödenmiş), böylece
 * ekstre ve yürüyen bakiye de dolu görünür.
 */
const DEMO_DONEMLER: readonly {
  donem: string; vade: string; tutar: number; kapali: boolean;
}[] = [
  { donem: '2026-05-01', vade: '2026-05-31', tutar: 1_800, kapali: true },
  { donem: '2026-06-01', vade: '2026-06-30', tutar: 1_800, kapali: true },
  // ⚠️ Vadesi geçmiş ve AÇIK — gecikmiş borç listesi ve tahsilat ekranı
  //    bu satırlar olmadan boş görünür.
  { donem: '2026-07-01', vade: '2026-07-31', tutar: 1_950, kapali: false },
];

/**
 * KMK varsayılan gider türleri — 634 sayılı Kat Mülkiyeti Kanunu md. 20.
 *
 * KRİTİK: bu liste bir VARSAYILANDIR, kural değildir. Yönetim planı ya da
 * genel kurul kararı her satırı değiştirebilir (KMK md. 20/son: "aksine
 * sözleşme yoksa"). Bu yüzden `kural_kaynagi` alanı vardır ve override
 * daima `kaynak_referansi` taşımak zorundadır — bir aidat kaleminin neden
 * öyle hesaplandığı sorulduğunda cevap veritabanında bulunmalıdır.
 *
 * Hangi giderin kime ait olduğu KANUNÎ bir ayrımdır, teknik tercih değil:
 *   - Anagayrimenkulün BAKIMI ve KORUNMASI → malike aittir (md. 20/b).
 *   - KULLANMADAN doğan giderler (ısınma, su, asansör işletme) → kullanana.
 * Yanlış atama, kiracıdan tahsil edilemeyecek bir borcu kiracıya yazar ya da
 * malike ait bir gideri kiracıya yükler; ikisi de icra safhasında düşer.
 */
/*
 * TAHAKKUK SIKLIĞI ÖLÇÜTÜ (ADR-0014 · migration 0027):
 *   "Aynı ay içinde bu türden ikinci bir gider NORMAL Mİ?"
 *   Evetse OLAY_BAZLI — ve o türde `referans` (fatura/poliçe/irsaliye no)
 *   ZORUNLUDUR; mükerrer koruması dönem ekseninde değil, gider olayı
 *   ekseninde kurulur.
 */
/*
 * KARŞILIKLI DIŞLAYAN GİDER TÜRÜ KÜMELERİ (0030).
 *
 * Aynı gruba bağlı türler birbirinin ALTERNATİFİDİR. İkisi aynı dönemde
 * tahakkuk edilirse motor uyarı üretir — ENGELLEMEZ. Çakışma tanımı burada
 * VERİ olarak durur; motor hiçbir gider türü kodu bilmez.
 */
const GIDER_TURU_GRUPLARI: {
  kod: string;
  ad: string;
  cakismaSiddeti: string;
  cakismaAciklamasi: string;
}[] = [
  {
    kod: 'ISINMA',
    ad: 'Isınma gideri modeli',
    cakismaSiddeti: 'DIKKAT',
    cakismaAciklamasi:
      'Pay ölçerli sitede ISITMA, pay ölçersiz sitede YAKIT kullanılır. ' +
      'İkisi aynı dönemde tahakkuk edilirse ısınma gideri sakinlere iki kez ' +
      'yansımış olabilir. Dönemin tahakkuklarını kontrol edin.',
  },
];

const GIDER_TURLERI: {
  kod: string;
  ad: string;
  paylasimKurali: Prisma.GiderTuruCreateInput['paylasimKurali'];
  sorumlulukTipi: Prisma.GiderTuruCreateInput['sorumlulukTipi'];
  tahakkukSikligi: Prisma.GiderTuruCreateInput['tahakkukSikligi'];
  /** Karşılıklı dışlayan küme. Verilmezse tür hiçbir kümeye ait değildir. */
  grupKodu?: string;
  /**
   * TAHAKKUK FİŞİNİN ALACAK TARAFI — zorunlu (ADR-0017 · K1).
   *
   * ⚠️  TOHUM **AVANS** YAKLAŞIMINI GÖSTERİR (`349`). Gerekçe: KMK md. 20
   *     aidatı *"toplanacak avans"* olarak adlandırır ve yönetim kâr amacı
   *     gütmez. Ürün bu tercihi DAYATMAZ — `600 Aidat Gelirleri` hesap
   *     planında duruyor ve gelir yaklaşımını benimseyen bir proje türleri
   *     oraya bağlayabilir. Seçim veridir, kod değildir (§33 kural 3).
   */
  hesapKodu: string;
}[] = [
  // md. 20/a — kapıcı, kaloriferci, bahçıvan, bekçi giderleri: EŞİT olarak.
  { hesapKodu: '349', kod: 'KAPICI', ad: 'Kapıcı gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  // md. 20/b — anagayrimenkulün sigortası, bakımı, korunması: ARSA PAYI oranında.
  //
  // ONARIM BİR OLAYDIR: aynı ay çatı akıntısı VE boya işi olabilir; ikincisi
  // ilkinin düzeltmesi değildir. İleride rutin bakım sözleşmesi (dönemsel) ile
  // arıza onarımı (olay bazlı) ayrı türlere bölünebilir — bugün zorunlu değil.
  { hesapKodu: '349', kod: 'ANA_BAKIM', ad: 'Anagayrimenkul bakım ve onarım', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', tahakkukSikligi: 'OLAY_BAZLI' },
  // POLİÇE TAKVİM AYINA OTURMAZ. Aynı ay ikinci poliçe (asansör sigortası,
  // DASK yenilemesi, ek teminat) meşrudur. Referans = poliçe numarası.
  { hesapKodu: '349', kod: 'SIGORTA', ad: 'Bina sigortası', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', tahakkukSikligi: 'OLAY_BAZLI' },
  // Yenileme fonu md. 72 — anagayrimenkule yapılan yatırımdır, malike aittir.
  { hesapKodu: '500', kod: 'YENILEME_FONU', ad: 'Yenileme fonu', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', tahakkukSikligi: 'DONEMSEL' },
  // Isınma tüketime bağlıdır (5627 sayılı Enerji Verimliliği Kanunu md. 7/c);
  // paylaşım kuralı TUKETIM'dir ve sayaç okuması olmadan hesaplanamaz.
  //
  // ⚠️  ISITMA ile YAKIT AYNI PROJEDE BİRLİKTE KULLANILMAZ. Merkezi ısıtmada
  //     pay ölçer zorunluluğu belirli koşullara bağlıdır ve muaf yapılar
  //     vardır:
  //       · pay ölçerli site  → ISITMA (dönemsel, tüketim payına göre)
  //       · pay ölçersiz site → YAKIT  (olay bazlı, her dolum ayrı gider)
  //     Hangisinin kullanılacağı PROJE AYARIDIR, kod kararı değildir.
  { hesapKodu: '349', kod: 'ISITMA', ad: 'Isıtma gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL', grupKodu: 'ISINMA' },
  // HER TANKER DOLUMU AYRI BİR OLAYDIR; iki dolum birbirinin düzeltmesi
  // değildir. Referans = irsaliye/fatura numarası.
  //
  // Paylaşım kuralı ARSA_PAYI olarak tohumlanır; yönetim planı farklı
  // diyorsa proje bazında değiştirilir — kural VERİDİR, koda gömülü değildir.
  { hesapKodu: '349', kod: 'YAKIT', ad: 'Yakıt alımı', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'OLAY_BAZLI', grupKodu: 'ISINMA' },
  // ⚠️  BİLİNEN SINIR (ELEKTRIK_ORTAK · SU): tek abonelik varsayımıyla
  //     DONEMSEL. Çok abonelikli sitede (ortak alan + otopark + havuz ayrı
  //     sayaç) aynı ay iki fatura gelir ve türün ayrılması gerekir. Bu durum
  //     geldiğinde yeniden değerlendirilecektir.
  { hesapKodu: '349', kod: 'SU', ad: 'Su gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { hesapKodu: '349', kod: 'ASANSOR_ISLETME', ad: 'Asansör işletme gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { hesapKodu: '349', kod: 'ELEKTRIK_ORTAK', ad: 'Ortak alan elektriği', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { hesapKodu: '349', kod: 'TEMIZLIK', ad: 'Temizlik gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { hesapKodu: '349', kod: 'YONETIM', ad: 'Yönetim gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
];

/**
 * KMK bağlamına sadeleştirilmiş hesap planı (ADR-0003 Koşul 3).
 *
 * ⚠️  `ozellik` ATLANMAZ. Hangi hesabın kasa, banka, cari kontrol ya da
 *     yansıtma olduğu hesap KODUNDAN çıkarılmaz — bu alandan okunur (§33
 *     kural 3). Alan boş bırakılırsa hesap planı dolu görünür ama proje
 *     ÇALIŞMAZ: tahsilat "Varsayılan kasa hesabı tanımlı değil" ile düşer,
 *     kasa/banka defteri sessizce boş döner. Ölçüldü, CT-20 ile korunuyor.
 */
const HESAP_PLANI: {
  kod: string; ad: string;
  tip: Prisma.HesapCreateInput['tip'];
  ozellik?: Prisma.HesapCreateInput['ozellik'];
}[] = [
  { kod: '100', ad: 'Kasa', tip: 'VARLIK', ozellik: 'KASA' },
  { kod: '102', ad: 'Bankalar', tip: 'VARLIK', ozellik: 'BANKA' },
  // Yardımcı defterin (bölüm cari bakiyeleri toplamı) mutabık olması gereken
  // kontrol hesabı — ADR-0010. TEK hesap işaretlenir; ikincisi mutabakatı
  // anlamsız kılar.
  { kod: '120', ad: 'Aidat Alacakları', tip: 'VARLIK', ozellik: 'CARI_KONTROL' },
  { kod: '255', ad: 'Demirbaşlar', tip: 'VARLIK' },
  { kod: '320', ad: 'Tedarikçiler', tip: 'BORC' },
  { kod: '340', ad: 'Alınan Avanslar', tip: 'BORC' },
  // ORTAK GİDER AVANSI — tahakkukun karşı tarafı (ADR-0017 · K1).
  // KMK md. 20 aidatı "toplanacak avans" der; yönetim kâr amacı gütmez.
  { kod: '349', ad: 'Alınan Ortak Gider Avansları', tip: 'BORC' },
  // ⚠️ OZKAYNAK DEĞİL, BORC (ADR-0017 · K4). Fon kat maliklerine ait İADE
  //    EDİLEBİLİR EMANETTİR. VUK md. 328'deki teknik "yenileme fonu"
  //    (amortismana tabi kıymet satış kârının 549'da izlenmesi) ile
  //    karıştırılmaz — o, bilanço esasına tabi ticari işletmelere özgüdür.
  { kod: '500', ad: 'Yenileme Fonu', tip: 'BORC' },
  /*
   * ⚠️  Bu hesap YALNIZCA parametreler ekranının seçim yapabilmesi için
   *     vardır. Dönem kapanış kuralı ADR-0015'te AÇIKTIR ve bu hesabın
   *     varlığı o kararı belirlemez.
   *
   *     Tohum bir hesap planı ÖRNEĞİ sunar, kapanış KURALINI tanımlamaz:
   *     "yıl sonu artı bakiye nereye gider" sorusu burada cevaplanmaz.
   *
   *     `500` ADR-0017 K4 ile OZKAYNAK'tan BORC'a çevrilince hesap planında
   *     hiç özkaynak hesabı kalmamıştı; parametreler ekranındaki "Dönem
   *     Kârı" kutusu boş ve devre dışı kalıyor, ekran kalıcı olarak
   *     "kurulum eksik" gösteriyordu (ölçüldü). Tek eksik hesap yüzünden
   *     bir ekranın gösterilemez kalması, karar beklemekten zararlıdır.
   */
  { kod: '590', ad: 'Dönem Net Sonucu', tip: 'OZKAYNAK' },
  { kod: '600', ad: 'Aidat Gelirleri', tip: 'GELIR' },
  { kod: '602', ad: 'Gecikme Tazminatı Gelirleri', tip: 'GELIR' },
  { kod: '770', ad: 'Yönetim Giderleri', tip: 'GIDER' },
  { kod: '771', ad: 'Personel Giderleri', tip: 'GIDER' },
  { kod: '772', ad: 'Bakım Onarım Giderleri', tip: 'GIDER' },
  // Dönem sonu gider yansıtması (7/A). Demo veri üretmez; hesap planında
  // TANIMLI olması yeterlidir — karşı hesap kullanıcının seçimidir ve
  // otomatik tahmin edilmez (donem.service · yansitmaFisiUret).
  { kod: '781', ad: 'Gider Yansıtma Hesabı', tip: 'GIDER', ozellik: 'YANSITMA' },
];

/**
 * DEMO TAHAKKUK GEÇMİŞİ — üç dönemlik aidat, gerçek yoldan yazılır.
 *
 * ⚠️  ÇALIŞMA KAYDI ATLANMAZ. `borc.calisma_id` zorunludur ve mükerrer
 *     koruması oradadır (ADR-0014 · migration 0026). Borçları çalışma kaydı
 *     olmadan yazmak, tohumu üretimde imkânsız bir duruma sokardı.
 *
 * ⚠️  NUMARA SAYACI DA İLERLETİLİR. Tohum `THK-2026-000001`den başlayıp
 *     numara verir; sayaç güncellenmezse ilk gerçek tahakkuk aynı numaradan
 *     başlar ve `borc_tahakkuk_no_uq` ihlaliyle düşerdi.
 */
/** Borcun yazılacağı taraf. Hisseli mülkiyette bölüm başına birden çok olur. */
interface BorcTarafi {
  kisiId: string;
  rol: 'MALIK' | 'KIRACI';
  pay: bigint;
  payda: bigint;
}

/**
 * TOHUMUN MUHASEBELEŞTİRMESİ — yalnızca CIFT_TARAFLI projede (ADR-0017).
 *
 * ⚠️  BU FONKSİYON OLMADAN DEMO BAKİYE FARKI GÖSTERİYORDU. Ölçüldü:
 *     `kontrol-mutabakati` → `{"fark":"15600.0000","mutabikMi":false}` —
 *     yani aylardır kapatmaya çalıştığımız şeyin tam tersi ekranda duruyordu.
 *
 * ⚠️  ÜRETİLEN BİÇİM, `muhasebelestir` UCUNUN ÜRETTİĞİNİN AYNISIDIR:
 *     tahakkuk → borç `CARI_KONTROL` / alacak `giderTuru.muhasebeHesapId`,
 *     tahsilat → borç `KASA` / alacak `CARI_KONTROL`, `fisTuru` ve
 *     `kaynakTipi`/`kaynakId` dâhil. Tohum ürünün YAPMADIĞI bir şeyi
 *     göstermez — tahakkuk geçmişinde uygulanan disiplinin aynısı.
 *
 * ⚠️  FİŞLER `ISLENDI`: taslak fiş mizana girmez (`taslakMizanaGirer=false`)
 *     ve girmediği sürece kontrol hesabı boş kalırdı.
 */
async function muhasebelestir(
  tenantId: string, hesapIdler: ReadonlyMap<string, string>,
): Promise<void> {
  const donemler = await prisma.muhasebeDonemi.findMany({
    where: { tenantId }, select: { id: true, maliYil: true },
  });
  const donemIdBul = (tarih: Date): string | null =>
    donemler.find((d) => d.maliYil === tarih.getUTCFullYear())?.id ?? null;

  const kontrolId = hesapIdler.get('120');
  const kasaId = hesapIdler.get('100');
  if (kontrolId === undefined || kasaId === undefined) {
    throw new Error('Kontrol/kasa hesabı yok; tohum muhasebeleştiremez.');
  }

  let sira = 0;
  const fisYaz = async (
    tarih: Date, aciklama: string,
    fisTuru: 'TAHAKKUK' | 'TAHSILAT', kaynakId: string,
    borcHesapId: string, alacakHesapId: string, tutar: Prisma.Decimal,
  ): Promise<string> => {
    const donemId = donemIdBul(tarih);
    if (donemId === null) throw new Error(`${tarih.toISOString()} için dönem yok.`);
    sira += 1;
    const fisId = randomUUID();
    await prisma.yevmiyeFisi.create({
      data: {
        id: fisId, tenantId,
        fisNo: `YEV-${tarih.getUTCFullYear()}-${String(sira).padStart(6, '0')}`,
        tarih, aciklama, fisTuru, kaynakTipi: fisTuru, kaynakId,
        durum: 'ISLENDI', islenmeAni: new Date(), donemId,
        satirlar: {
          create: [
            { id: randomUUID(), tenantId, hesapId: borcHesapId, borc: tutar, alacak: 0 },
            { id: randomUUID(), tenantId, hesapId: alacakHesapId, borc: 0, alacak: tutar },
          ],
        },
      },
    });
    return fisId;
  };

  // --- Tahakkuklar: çalışma başına TEK fiş (K3) ------------------------------
  const calismalar = await prisma.tahakkukCalismasi.findMany({
    where: { tenantId, yevmiyeFisiId: null },
    select: { id: true, donem: true, giderTuruKodu: true },
    orderBy: { donem: 'asc' },
  });
  for (const c of calismalar) {
    // Deftere giren rakam, borçluların GERÇEKTEN borçlandığı rakamdır —
    // `toplamTutar` istekte gelen tutardır ve kuruş artığıyla ayrışabilir.
    const toplam = await prisma.borc.aggregate({
      where: { tenantId, calismaId: c.id }, _sum: { tutar: true },
    });
    const tutar = toplam._sum.tutar;
    if (tutar === null || tutar.isZero()) continue;

    const tur = await prisma.giderTuru.findFirstOrThrow({
      where: { tenantId, kod: c.giderTuruKodu },
      select: { ad: true, muhasebeHesapId: true },
    });
    const donemMetni = c.donem.toISOString().slice(0, 10);
    const fisId = await fisYaz(
      c.donem, `Tahakkuk — ${tur.ad} (${donemMetni} dönemi)`,
      'TAHAKKUK', c.id, kontrolId, tur.muhasebeHesapId, tutar,
    );
    await prisma.tahakkukCalismasi.update({
      where: { id: c.id }, data: { yevmiyeFisiId: fisId },
    });
  }

  // --- Tahsilatlar: makbuz başına fiş ---------------------------------------
  //
  // ⚠️  TAHSİLAT DA MUHASEBELEŞMEK ZORUNDA. Yalnızca tahakkuk deftere
  //     girseydi kontrol hesabı Σ borç'ta kalır, yardımcı defter ise
  //     Σ(borç − ödenen) olurdu; mutabakat ÖDENEN KADAR sapardı.
  const tahsilatlar = await prisma.tahsilat.findMany({
    where: { tenantId, yevmiyeFisiId: null, durum: 'GECERLI' },
    select: { id: true, makbuzNo: true, tutar: true, tahsilatTarihi: true },
    orderBy: { tahsilatTarihi: 'asc' },
  });
  for (const t of tahsilatlar) {
    const fisId = await fisYaz(
      t.tahsilatTarihi, `Tahsilat makbuzu ${t.makbuzNo}`,
      'TAHSILAT', t.id, kasaId, kontrolId, t.tutar,
    );
    await prisma.tahsilat.update({
      where: { id: t.id }, data: { yevmiyeFisiId: fisId },
    });
  }

  await prisma.numaraSayaci.create({
    data: {
      id: randomUUID(), tenantId, seriKodu: 'YEVMIYE',
      kapsamAnahtari: `${tenantId}:YEVMIYE:2026`,
      mevcutDeger: BigInt(sira),
    },
  });

  console.log(
    `     muhasebe: ${calismalar.length} tahakkuk + ${tahsilatlar.length} tahsilat fişi`,
  );
}

interface TahsilEdilecek {
  borcId: string; sorumluId: string; bolumId: string;
  kisiId: string; tutar: number; tarih: string;
}

/**
 * DEMO TAHSİLAT GEÇMİŞİ — kapanmış borçların KARŞILIĞI.
 *
 * ⚠️  BU FONKSİYON OLMADAN TOHUM TUTARSIZDI. Ölçüldü: 24 borç `kapandi_mi`
 *     işaretliydi ve `Σ odenen = 43.200` idi, ama `tahsilat` tablosu BOŞTU.
 *     Cari ekstre bunu ekranda gösteriyordu — üç BORÇ satırı, hiç TAHSİLAT
 *     satırı yok, `tahsilatToplam: "0.0000"`. Yani `odenen` alanı ile
 *     ekstrenin kendisi birbirini yalanlıyordu.
 *
 * ⚠️  `odenen` ve `kapandiMi` BURADAN, tahsis satırlarından türetilir; borç
 *     yazılırken elle konmaz. Tek kaynak: `TahsilatTahsisi`.
 *
 * ⚠️  MUHASEBELEŞTİRİLMEZ (`yevmiyeFisiId` boş). Bu bilinçlidir ve gerçek bir
 *     durumdur: "tahsilat kaydedildi, henüz deftere girmedi". Yalnızca
 *     tahsilatı muhasebeleştirmek 120 kontrol hesabını ALACAKLANDIRIR ve
 *     mutabakat farkını BÜYÜTÜR — tahakkuk tarafı deftere hiç düşmediği için
 *     (ADR-0017). Karar verilene kadar defter dürüstçe boş kalır.
 */
async function tahsilatGecmisiOlustur(
  tenantId: string, kayitlar: readonly TahsilEdilecek[],
): Promise<void> {
  if (kayitlar.length === 0) return;

  let no = 0;
  for (const k of kayitlar) {
    no += 1;
    const tahsilatId = randomUUID();
    await prisma.tahsilat.create({
      data: {
        id: tahsilatId, tenantId,
        makbuzNo: `MKB-2026-${String(no).padStart(6, '0')}`,
        /*
         * ⚠️ HEPSİ NAKİT — bilinçli. `tahsilat_kanal_banka` CHECK kısıtı
         *    BANKA kanalında `banka_hareketi_id` ZORUNLU kılıyor ve tohumda
         *    henüz banka hesabı yok. Kısıt DOĞRU çalışıyor: banka tahsilatı
         *    hareketine bağlanmazsa mutabakatta görünmez. Gevşetmek yerine
         *    kanal daraltıldı; banka fikstürü ayrı iştir.
         */
        kanal: 'NAKIT',
        durum: 'GECERLI',
        tutar: k.tutar,
        tahsilatTarihi: new Date(k.tarih),
        aciklama: 'Aidat tahsilatı',
        odeyenKisiId: k.kisiId,
      },
    });

    await prisma.tahsilatTahsisi.create({
      data: {
        id: randomUUID(), tenantId, tahsilatId,
        borcId: k.borcId, borcSorumlusuId: k.sorumluId, tutar: k.tutar,
      },
    });

    // Türetilen alanlar — kaynağı yukarıdaki tahsis satırıdır.
    await prisma.borcSorumlusu.update({
      where: { id: k.sorumluId }, data: { odenen: k.tutar },
    });
  }

  /*
   * ⚠️  BORÇ DÜZEYİ TAHSİS SATIRLARINDAN TOPLANIR, tek tahsilattan değil.
   *     Hisseli mülkiyette bir borcu birden çok makbuz kapatır; her makbuzda
   *     `odenen = k.tutar` yazılsaydı üç hissedarlı dairede borç ilk ödemede
   *     kapanmış görünürdü — ötekilerin borcu AÇIK kalmalıdır.
   */
  const borcIdler = [...new Set(kayitlar.map((k) => k.borcId))];
  for (const borcId of borcIdler) {
    const toplam = await prisma.tahsilatTahsisi.aggregate({
      where: { borcId, tenantId }, _sum: { tutar: true },
    });
    const borc = await prisma.borc.findUniqueOrThrow({
      where: { id: borcId }, select: { tutar: true },
    });
    const odenen = toplam._sum.tutar ?? 0;
    await prisma.borc.update({
      where: { id: borcId },
      data: { odenen, kapandiMi: borc.tutar.equals(odenen) },
    });
  }

  await prisma.numaraSayaci.create({
    data: {
      id: randomUUID(), tenantId, seriKodu: 'MAKBUZ',
      kapsamAnahtari: `${tenantId}:MAKBUZ:2026`,
      mevcutDeger: BigInt(no),
    },
  });

  console.log(`     tahsilat: ${no} makbuz · muhasebeleşmemiş (ADR-0017)`);
}

async function tahakkukGecmisiOlustur(
  tenantId: string,
  sorumlular: ReadonlyMap<string, readonly BorcTarafi[]>,
): Promise<void> {
  const GIDER = 'KAPICI';                 // KULLANANA_AIT · EŞİT paylaşım
  const bolumIdler = [...sorumlular.keys()];
  let sira = 0;
  const tahsilEdilecek: TahsilEdilecek[] = [];

  for (const d of DEMO_DONEMLER) {
    const calismaId = randomUUID();
    await prisma.tahakkukCalismasi.create({
      data: {
        id: calismaId, tenantId, giderTuruKodu: GIDER,
        donem: new Date(d.donem), tip: 'ASIL', sira: 1,
        // DAĞITIM SNAPSHOT'I (ADR-0017 · K7a). Türün kuralı sonradan
        // değişirse geçmiş tahakkuk yine doğru okunur. Tohum ezme yapmaz.
        kullanilanPaylasimKurali: 'ESIT',
        paylasimKuraliEzildi: false,
        toplamTutar: d.tutar * bolumIdler.length,
        bolumSayisi: bolumIdler.length,
      },
    });

    for (const bolumId of bolumIdler) {
      const taraflar = sorumlular.get(bolumId);
      if (taraflar === undefined || taraflar.length === 0) continue;
      sira += 1;
      const borcId = randomUUID();

      await prisma.borc.create({
        data: {
          id: borcId, tenantId, bolumId, calismaId,
          giderTuruKodu: GIDER,
          tahakkukNo: `THK-2026-${String(sira).padStart(6, '0')}`,
          tutar: d.tutar,
          // ⚠️ `odenen` BURADA YAZILMAZ. Tahsis satırlarından TÜRETİLİR
          //    (0017 · ADR-0010, schema `Borc.odenen` notu). Elle yazıldığında
          //    ödeme kaydı olmadan da "ödenmiş" görünüyordu — ölçüldü:
          //    24 borç kapalı, Σ odenen 43.200, `tahsilat` tablosu BOŞTU.
          vadeTarihi: new Date(d.vade),
          tahakkukDonemi: new Date(d.donem),
        },
      });

      /*
       * PAY DAĞITIMI — hisseli mülkiyette borç maliklere BÖLÜNÜR.
       *
       * ⚠️  SON HİSSEDAR ARTIĞI ALIR. Σ pay = borc.tutar olmak ZORUNDADIR
       *     (ADR-0016 tutarlılık kuralı); tek tek yuvarlansaydı toplam
       *     kuruş kadar sapar ve borcun bir kısmı hiç kimseye yazılmazdı.
       *     Bu bir DAĞITIM tekniğidir, yuvarlama POLİTİKASI değil — politika
       *     kararı tohumun işi değildir.
       */
      const kurus = BigInt(Math.round(d.tutar * 100));
      let dagitilan = 0n;
      for (const [i, taraf] of taraflar.entries()) {
        const sonMu = i === taraflar.length - 1;
        const payKurus = sonMu
          ? kurus - dagitilan
          : (kurus * taraf.pay) / taraf.payda;
        dagitilan += payKurus;

        const sorumluId = randomUUID();
        await prisma.borcSorumlusu.create({
          data: {
            id: sorumluId, tenantId, borcId, kisiId: taraf.kisiId,
            sira: 'ASIL', rol: taraf.rol,
            cozumlemeTarihi: new Date(d.donem),
            pay: Number(payKurus) / 100, agirlik: taraf.pay,
          },
        });

        if (d.kapali) {
          tahsilEdilecek.push({
            borcId, sorumluId, bolumId, kisiId: taraf.kisiId,
            tutar: Number(payKurus) / 100, tarih: d.vade,
          });
        }
      }
    }
  }

  await tahsilatGecmisiOlustur(tenantId, tahsilEdilecek);

  // Sayaç, tohumun verdiği son numaranın üstüne kurulur.
  await prisma.numaraSayaci.create({
    data: {
      id: randomUUID(), tenantId, seriKodu: 'TAHAKKUK',
      kapsamAnahtari: `${tenantId}:TAHAKKUK:2026`,
      mevcutDeger: BigInt(sira),
    },
  });

  const acik = DEMO_DONEMLER.filter((d) => !d.kapali).length * bolumIdler.length;
  console.log(
    `     tahakkuk: ${DEMO_DONEMLER.length} dönem · ${sira} borç kaydı · ` +
      `${acik} tanesi AÇIK ve vadesi geçmiş`,
  );
}

/**
 * Derinlik VARSAYILANI tipten türetilir, KURAL DEĞİLDİR (0034).
 * Tek yerde durur ki tohumun iki ayrı noktasında ayrışmasın.
 */
function derinlikSec(t: ApartmanTohumu): 'BASIT' | 'CIFT_TARAFLI' {
  return t.muhasebeDerinligi ?? (t.tip === 'SITE' ? 'CIFT_TARAFLI' : 'BASIT');
}

async function apartmanOlustur(t: ApartmanTohumu): Promise<string> {
  const tenantId = randomUUID();

  await prisma.tenant.create({
    data: {
      id: tenantId, kod: t.kod, ad: t.ad,
      tip: t.tip ?? 'APARTMAN', durum: 'AKTIF',
      saatDilimi: 'Europe/Istanbul', paraBirimi: 'TRY',
      lisansKodu: 'BNOS-APT-V1',
    },
  });

  // RLS altında yazabilmek için tenant bağlamı kurulur.
  await prisma.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', false)`);

  const hesapIdler = new Map<string, string>();
  await prisma.hesap.createMany({
    data: HESAP_PLANI.map((h) => {
      const id = randomUUID();
      hesapIdler.set(h.kod, id);
      return { id, tenantId, kod: h.kod, ad: h.ad, tip: h.tip, ozellik: h.ozellik ?? 'NORMAL' };
    }),
  });

  /*
   * MUHASEBE PARAMETRELERİ — kurulumun ikinci yarısı.
   *
   * ⚠️  `hesap.ozellik` işaretlemesi TEK BAŞINA YETMEZ. Tahsilat yolu
   *     varsayılan kasa/banka hesabını özellikten değil BU KAYITTAN okur:
   *     "KASA özellikli hesap" birden fazla olabilir (ana kasa, şube kasası),
   *     hangisine nakit yazılacağı bir SEÇİMDİR. Kayıt hiç açılmazsa
   *     muhasebeleştirme "Varsayılan kasa hesabı tanımlı değil" ile düşer —
   *     iki ayrı boşluktu, ikisi de kapatıldı.
   */
  await prisma.muhasebeParametresi.create({
    data: {
      tenantId,
      varsayilanKasaHesapId: hesapIdler.get('100') ?? null,
      varsayilanBankaHesapId: hesapIdler.get('102') ?? null,
      /*
       * DERİNLİK — VARSAYILAN tipten türetilir, KURAL DEĞİLDİR (0034).
       * `SITE → CIFT_TARAFLI`, `APARTMAN → BASIT`. Tohum bu varsayılanı
       * gösterir; proje sonradan değiştirebilir.
       *
       * ⚠️  BASIT projede de parametre kaydı AÇILIR: kasa/banka varsayılanları
       *     orada da gerekir (apartman kasa ve banka tutar). Açılmaması
       *     "kurulum yapılmamış" ile "basit muhasebe" ayrımını kaybettirirdi.
       */
      muhasebeDerinligi: derinlikSec(t),
      /*
       * Dönem kârı hesabı BİLİNÇLİ olarak boş: kâr/zararın hangi özkaynak
       * hesabına aktarılacağı yönetimin kararıdır, tohum adına verilemez.
       *
       * ⚠️  SEÇENEK ARTIK VAR ama SEÇİM YOK. Hesap planına `590` eklendi
       *     (yukarıdaki nota bakın) — böylece parametreler ekranındaki
       *     açılır kutu boş kalmıyor ve yönetici seçimi TEK TIKLA
       *     yapabiliyor. Seçimi tohumun yapması, "hangi hesap" sorusunu
       *     yöneticinin yerine cevaplamak olurdu; ekran o eksiği açıkça
       *     gösterir ve nasıl giderileceğini söyler.
       */
    },
  });

  /*
   * MUHASEBE DÖNEMİ — kurulumun üçüncü yarısı; bu da eksikti.
   *
   * ⚠️  Hesaplar işaretli ve parametreler dolu olsa bile, İÇİNDE BULUNULAN
   *     GÜNÜ kapsayan açık dönem yoksa hiçbir fiş kesilemez:
   *     "2026-08-02 tarihini kapsayan bir muhasebe dönemi yok." Ölçüldü.
   *
   * ⚠️  DEMO YILINA SABİTLENMEZ. `DEMO_DONEMLER` 2026'ya sabit ama tohum
   *     başka bir yılda kurulabilir; o zaman bugünü kapsayan dönem yine
   *     olmazdı. Bu yüzden kurulum yılı ile demo yılı AYRI AYRI açılır.
   */
  const demoYil = new Date(DEMO_DONEMLER[0]?.donem ?? '2026-01-01').getUTCFullYear();
  const yillar = [...new Set([new Date().getUTCFullYear(), demoYil])];
  await prisma.muhasebeDonemi.createMany({
    data: yillar.map((yil) => ({
      id: randomUUID(), tenantId, maliYil: yil, ad: String(yil),
      baslangic: new Date(Date.UTC(yil, 0, 1)),
      bitis: new Date(Date.UTC(yil, 11, 31)),
      // Hepsi AÇIK: kapalı dönem gösterimi dönem kapanışı akışının konusudur,
      // tohumun kapalı dönem üretmesi kullanıcıyı çıkışsız bırakır.
      durum: 'ACIK' as const,
    })),
  });

  const yoneticiKisiId = randomUUID();
  await prisma.kisi.create({
    data: {
      id: yoneticiKisiId, tenantId,
      ad: 'Yönetici', soyad: t.ad.split(' ')[0] ?? 'Test',
      eposta: `yonetici@${t.kod}.test`,
    },
  });

  const kullaniciId = randomUUID();
  await prisma.kullanici.create({
    data: {
      id: kullaniciId, tenantId, kisiId: yoneticiKisiId,
      eposta: `yonetici@${t.kod}.test`,
      sifreHash: GELISTIRME_SIFRE_HASH, aktif: true,
      roller: { create: { id: randomUUID(), tenantId, rolKodu: 'APARTMAN_YONETICISI' } },
    },
  });

  // --- Hiyerarşi: Apartman → Blok → Kat (ADR-0008) --------------------------
  //
  // Bölümler doğrudan tenant'a bağlanamaz. Hiyerarşi kurulmazsa apartman ve
  // blok ekranları boş açılır ve `bagimsiz_bolum.blok_id` NULL kalır; kapı no
  // tekilliği blok bazlı olduğu için mükerrer kapı numarası ENGELLENEMEZ.
  const apartmanId = randomUUID();
  await prisma.apartman.create({
    data: { id: apartmanId, tenantId, ad: t.ad, adres: `${t.ad} — geliştirme adresi` },
  });

  /*
   * BLOK — site tarafında birden çok olur.
   *
   * ⚠️  "Blok" YALNIZCA site içindeki yapı birimidir (BFS v1 §13.1). Tek
   *     yapılı projede de bir blok kaydı açılır çünkü `bagimsiz_bolum.blok_id`
   *     olmadan kapı no tekilliği kurulamaz — ama o projenin YÖNETİMİNE
   *     "blok yönetimi" DENMEZ, apartman yönetimi denir.
   */
  const blokAdlari = t.bloklar ?? ['A Blok'];
  const blokHaritasi = new Map<string, string>();
  for (const ad of blokAdlari) {
    const id = randomUUID();
    blokHaritasi.set(ad, id);
    await prisma.blok.create({ data: { id, tenantId, apartmanId, ad } });
  }
  const varsayilanBlokId = blokHaritasi.get(blokAdlari[0] ?? 'A Blok') ?? '';

  // Kat kayıtları bölümlerin kat numaralarından türetilir; elle liste tutmak
  // bölüm eklendiğinde güncellenmeyi unutulur.
  //
  // ⚠️  KAT BLOĞA AİTTİR. Çok bloklu sitede her bloğun kendi katları vardır;
  //     tek listeye konsaydı B blokun 3. katındaki daire A blokun katına
  //     bağlanırdı.
  const katHaritasi = new Map<string, string>();
  for (const [blokAdi, blokId] of blokHaritasi) {
    const katNolari = [...new Set(
      t.bolumler.filter((b) => (b.blok ?? blokAdlari[0]) === blokAdi).map((b) => b.kat),
    )].sort((a, b) => a - b);
    for (const no of katNolari) {
      const katId = randomUUID();
      katHaritasi.set(`${blokAdi}|${no}`, katId);
      await prisma.kat.create({
        data: { id: katId, tenantId, blokId, no, ad: no === 0 ? 'Zemin' : null },
      });
    }
  }

  // --- Gider türleri: KMK varsayılanları ------------------------------------
  //
  // Kurallar VERİDİR, koda gömülmez. Buradakiler 634 sayılı KMK md. 20'nin
  // varsayılanıdır; yönetim planı veya genel kurul kararı bunları DEĞİŞTİREBİLİR
  // ve o durumda `kural_kaynagi` ile birlikte `kaynak_referansi` zorunlu olur.
  // --- Belge saklama politikaları ------------------------------------------
  //
  // Politikasız bir tenant'ta `tipPolitikasi` güvenli GÖRÜNEN bir varsayılana
  // düşer (`finansalMi: false`) ve fatura arşivlendiğinde silinebilir hale
  // gelir. Mali denetim izi sessizce kaybolur; bu yüzden her tenant açılırken
  // yazılır.
  for (const p of BELGE_POLITIKALARI) {
    await prisma.belgeTipiPolitikasi.create({
      data: {
        id: randomUUID(), tenantId, tip: p.tip,
        // Kategori ve varsayılan gizlilik de TEK KAYNAKTAN gelir. Atlanırsa
        // sütun varsayılanına düşer (KURUMSAL/YONETIM) ve tapu ile kira
        // sözleşmesi KISIYE_OZEL olmaz — kişisel belge herkese açılır.
        ...(p.kategori === undefined ? {} : { kategori: p.kategori }),
        ...(p.varsayilanGizlilik === undefined
          ? {}
          : { varsayilanGizlilik: p.varsayilanGizlilik }),
        saklamaYili: p.saklamaYili,
        finansalMi: p.finansalMi,
        kaynakReferansi: p.kaynakReferansi,
      },
    });
  }

  /*
   * KARŞILIKLI DIŞLAYAN GRUPLAR. Çakışma tanımı VERİDİR: uyarının kodu
   * (`{kod}_CAKISMASI`), şiddeti ve metni buradan gelir; tahakkuk motoru
   * hiçbir gider türü kodu bilmez.
   */
  const grupKimlikleri = new Map<string, string>();
  for (const grup of GIDER_TURU_GRUPLARI) {
    const id = randomUUID();
    grupKimlikleri.set(grup.kod, id);
    await prisma.giderTuruGrubu.create({
      data: {
        id, tenantId, kod: grup.kod, ad: grup.ad,
        cakismaSiddeti: grup.cakismaSiddeti,
        cakismaAciklamasi: grup.cakismaAciklamasi,
      },
    });
  }

  for (const g of GIDER_TURLERI) {
    await prisma.giderTuru.create({
      data: {
        id: randomUUID(), tenantId, kod: g.kod, ad: g.ad,
        paylasimKurali: g.paylasimKurali, sorumlulukTipi: g.sorumlulukTipi,
        tahakkukSikligi: g.tahakkukSikligi,
        ...(g.grupKodu === undefined
          ? {}
          : { grupId: grupKimlikleri.get(g.grupKodu) }),
        kuralKaynagi: 'KMK_VARSAYILAN', malikPaylasimi: 'HISSE_ORANI',
        muhasebeHesapId: hesapIdler.get(g.hesapKodu) ?? '',
      },
    });
  }

  /**
   * Tahakkuk geçmişi için: bölüm → borcun yazılacağı kişi(ler).
   *
   * ⚠️  DİZİ, tek kayıt değil. Hisseli mülkiyette borç maliklere BÖLÜNÜR ve
   *     bir malik kendi payını ödediğinde ötekilerin borcu AÇIK kalmalıdır
   *     (schema · `TahsilatTahsisi.borcSorumlusuId` notu).
   */
  const borcSorumlusuHaritasi = new Map<string, BorcTarafi[]>();

  for (const b of t.bolumler) {
    const bolumId = randomUUID();
    const malikId = randomUUID();

    await prisma.kisi.create({
      data: {
        id: malikId, tenantId,
        ad: b.malik[0], soyad: b.malik[1],
        eposta: `malik${b.kapiNo}@${t.kod}.test`,
      },
    });

    const bolumBlokAdi = b.blok ?? blokAdlari[0] ?? 'A Blok';
    await prisma.bagimsizBolum.create({
      data: {
        id: bolumId, tenantId,
        blokId: blokHaritasi.get(bolumBlokAdi) ?? varsayilanBlokId,
        katId: katHaritasi.get(`${bolumBlokAdi}|${b.kat}`) ?? null,
        kapiNo: b.kapiNo, kat: b.kat, nitelik: 'MESKEN',
        brutM2: b.m2, netM2: Math.round(b.m2 * 0.85),
        arsaPayiPay: b.pay, arsaPayiPayda: 1_000_000n,
        aidatMuafiyeti: false,
      },
    });

    const [malikPay, malikPayda] = b.malikHissesi ?? [1n, 1n];
    const hissedarlar: { kisiId: string; pay: bigint; payda: bigint }[] = [
      { kisiId: malikId, pay: malikPay, payda: malikPayda },
    ];

    for (const [i, o] of (b.ortaklar ?? []).entries()) {
      const ortakId = randomUUID();
      await prisma.kisi.create({
        data: {
          id: ortakId, tenantId, ad: o.ad[0], soyad: o.ad[1],
          eposta: `ortak${b.kapiNo}-${i + 1}@${t.kod}.test`,
        },
      });
      hissedarlar.push({ kisiId: ortakId, pay: o.hisse[0], payda: o.hisse[1] });
    }

    /*
     * ⚠️ TOPLAM 1 OLMAK ZORUNDA. Eksik hisse, borcun bir kısmının HİÇ KİMSEYE
     *    yazılmaması demektir; fazlası bölümü olduğundan borçlu gösterir.
     *    Tohum hatalı fikstür üretmektense DURUR.
     */
    const ortakPayda = hissedarlar.reduce((a, h) => a * h.payda, 1n);
    const toplamPay = hissedarlar.reduce((a, h) => a + (h.pay * ortakPayda) / h.payda, 0n);
    if (toplamPay !== ortakPayda) {
      throw new Error(
        `Daire ${b.kapiNo}: hisse toplamı 1 değil (${toplamPay}/${ortakPayda}).`,
      );
    }

    for (const h of hissedarlar) {
      await prisma.malik.create({
        data: {
          id: randomUUID(), tenantId, bolumId, kisiId: h.kisiId,
          hissePay: h.pay, hissePayda: h.payda,
          tapuTuru: 'KAT_MULKIYETI', tapuBaslangic: new Date('2024-01-01'),
        },
      });
      await prisma.bolumIliskisi.create({
        data: {
          id: randomUUID(), tenantId, bolumId, kisiId: h.kisiId,
          rol: 'MALIK', baslangic: new Date('2024-01-01'), bitis: null,
        },
      });
    }

    borcSorumlusuHaritasi.set(bolumId, hissedarlar.map((h) => ({
      kisiId: h.kisiId, rol: 'MALIK' as const, pay: h.pay, payda: h.payda,
    })));

    // KİRACI — aidat KULLANANA_AIT olduğunda borç zincirinde ASIL odur.
    if (b.kiraci !== undefined) {
      const kiraciId = randomUUID();
      await prisma.kisi.create({
        data: {
          id: kiraciId, tenantId,
          ad: b.kiraci[0], soyad: b.kiraci[1],
          eposta: `kiraci${b.kapiNo}@${t.kod}.test`,
        },
      });
      await prisma.kiraci.create({
        data: {
          id: randomUUID(), tenantId, bolumId, kisiId: kiraciId,
          baslangic: new Date('2025-01-01'),
        },
      });
      await prisma.bolumIliskisi.create({
        data: {
          id: randomUUID(), tenantId, bolumId, kisiId: kiraciId,
          rol: 'KIRACI', baslangic: new Date('2025-01-01'), bitis: null,
        },
      });
      /*
       * ⚠️ KİRACI HİSSELİ MÜLKİYETİ EZER. Aidat KULLANANA_AIT olduğunda borç
       *    tek kişiye — kiracıya — yazılır; malikler arasındaki hisse dağılımı
       *    bu borcu bölmez. Malikin hissesi mülkiyetin ölçüsüdür, kullanımın
       *    değil.
       */
      borcSorumlusuHaritasi.set(bolumId, [
        { kisiId: kiraciId, rol: 'KIRACI', pay: 1n, payda: 1n },
      ]);
    }
  }

  if (t.tahakkukGecmisi === true) {
    await tahakkukGecmisiOlustur(tenantId, borcSorumlusuHaritasi);

    /*
     * ⚠️  YALNIZCA CIFT_TARAFLI PROJEDE. `BASIT` derinlikte yevmiye fişi diye
     *     bir kavram yoktur ve bunun eksik olması DOĞRU DAVRANIŞTIR
     *     (docs/APARTMAN-SITE-AYRIMI.md §2.1). Apartman tenant'ında
     *     muhasebeleştirme yapılsaydı tohum, ürünün o projede REDDETTİĞİ bir
     *     durumu üretmiş olurdu.
     */
    if (derinlikSec(t) === 'CIFT_TARAFLI') {
      await muhasebelestir(tenantId, hesapIdler);
    }
  }

  const derinlik = derinlikSec(t);
  console.log(
    `  ${t.ad}  (${t.tip ?? 'APARTMAN'} · ${blokAdlari.length} blok · ` +
      `${katHaritasi.size} kat · ${t.bolumler.length} bağımsız bölüm · ${derinlik})`,
  );
  console.log(`     giriş: yonetici@${t.kod}.test / bnos1234`);
  return tenantId;
}

/**
 * YÖNETİM FİRMASI tenant'ı + yönettiği projelere AÇIK DEVİR (ADR-0009).
 *
 * Portföy Yönetim Merkezi'nin demo edilebilmesi için gerekir: firma hesabı
 * girdiğinde doğrudan bir projeye düşmez, önce kontrol merkezini görür.
 *
 * ⚠️  DEVİR KAYDI, PROJE BAĞLAMINDA yazılır. `yonetim_delegasyonu` politikası
 *     iki taraflıdır (`yonetim_tenant_id = app_tenant_id() OR proje_tenant_id
 *     = app_tenant_id()`); herhangi bir taraf yazabilir. Firma bağlamı
 *     seçildi çünkü devri kaydeden kullanıcı firmadadır.
 */
async function yonetimFirmasiOlustur(projeTenantIdleri: readonly string[]): Promise<string> {
  const firmaId = randomUUID();
  const kod = 'bn-yonetim';

  await prisma.tenant.create({
    data: {
      id: firmaId, kod, ad: 'BN Yönetim A.Ş.',
      tip: 'YONETIM_SIRKETI', durum: 'AKTIF',
      saatDilimi: 'Europe/Istanbul', paraBirimi: 'TRY',
      lisansKodu: 'BNOS-YS-V1',
    },
  });

  await prisma.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${firmaId}', false)`);

  const kisiId = randomUUID();
  await prisma.kisi.create({
    data: {
      id: kisiId, tenantId: firmaId,
      ad: 'Portföy', soyad: 'Yöneticisi',
      eposta: `portfoy@${kod}.test`,
    },
  });

  await prisma.kullanici.create({
    data: {
      id: randomUUID(), tenantId: firmaId, kisiId,
      eposta: `portfoy@${kod}.test`,
      sifreHash: GELISTIRME_SIFRE_HASH, aktif: true,
      // YONETIM_SIRKETI rolü `tenant.setup` iznini taşır (bkz. roller.ts);
      // devir kaydı açmak bir onboarding işlemidir.
      roller: { create: { id: randomUUID(), tenantId: firmaId, rolKodu: 'YONETIM_SIRKETI' } },
    },
  });

  for (const [i, projeId] of projeTenantIdleri.entries()) {
    await prisma.yonetimDelegasyonu.create({
      data: {
        id: randomUUID(),
        yonetimTenantId: firmaId,
        projeTenantId: projeId,
        durum: 'AKTIF',
        // Dayanak ZORUNLUDUR: dayanağı olmayan devir, hangi kararla verildiği
        // sorulduğunda cevapsız kalır (KMK md. 34 · yönetici seçimi).
        dayanak: `Yönetim sözleşmesi 2026/${String(i + 1).padStart(2, '0')}`,
        baslangic: new Date('2026-01-01'),
      },
    });
  }

  console.log('\nYönetim firması oluşturuldu (Portföy Yönetim Merkezi):');
  console.log(`  BN Yönetim A.Ş. — ${projeTenantIdleri.length} projeye açık devir`);
  console.log(`     giriş: portfoy@${kod}.test / bnos1234`);
  return firmaId;
}

async function main(): Promise<void> {
  console.log('BNOS Apartman — tohum verisi yükleniyor\n');

  const mevcut = await prisma.tenant.count();
  if (mevcut > 0) {
    console.log(`Veritabanında zaten ${mevcut} tenant var. Önce "pnpm db:reset" çalıştırın.`);
    return;
  }

  const idler: string[] = [];
  for (const a of APARTMANLAR) idler.push(await apartmanOlustur(a));

  console.log('\nİki apartman kasıtlı olarak oluşturuldu:');
  console.log('tenant izolasyon testi (CT-01) en az iki tenant gerektirir.');
  console.log(`\n  ${idler[0]}\n  ${idler[1]}\n`);

  await yonetimFirmasiOlustur(idler);
}

main()
  .catch((h: unknown) => {
    console.error('Tohum verisi yüklenemedi:', h);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());


