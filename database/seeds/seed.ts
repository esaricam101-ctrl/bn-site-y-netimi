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
  /** Doluysa daire kirada; borç zinciri kiracıyı da kapsar. */
  kiraci?: readonly [string, string];
}

interface ApartmanTohumu {
  kod: string;
  ad: string;
  bolumler: BolumTohumu[];
  /** Tahakkuk geçmişi üretilsin mi (demo sitesi için). */
  tahakkukGecmisi?: boolean;
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
      { kapiNo: '4',  kat: 2, m2: 105, pay: 80_000n, malik: ['Ali', 'Çelik'] },
      { kapiNo: '5',  kat: 2, m2: 105, pay: 80_000n, malik: ['Zeynep', 'Aydın'] },
      { kapiNo: '6',  kat: 2, m2: 120, pay: 90_000n, malik: ['Mustafa', 'Doğan'],
        kiraci: ['Burak', 'Öztürk'] },
      { kapiNo: '7',  kat: 3, m2: 105, pay: 80_000n, malik: ['Hatice', 'Arslan'] },
      { kapiNo: '8',  kat: 3, m2: 105, pay: 80_000n, malik: ['Hüseyin', 'Koç'] },
      { kapiNo: '9',  kat: 3, m2: 120, pay: 90_000n, malik: ['Emine', 'Kurt'] },
      { kapiNo: '10', kat: 4, m2: 105, pay: 80_000n, malik: ['İbrahim', 'Özdemir'] },
      { kapiNo: '11', kat: 4, m2: 105, pay: 80_000n, malik: ['Meryem', 'Aslan'],
        kiraci: ['Selin', 'Güneş'] },
      { kapiNo: '12', kat: 4, m2: 145, pay: 65_000n, malik: ['Ahmet', 'Polat'] },
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
}[] = [
  // md. 20/a — kapıcı, kaloriferci, bahçıvan, bekçi giderleri: EŞİT olarak.
  { kod: 'KAPICI', ad: 'Kapıcı gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  // md. 20/b — anagayrimenkulün sigortası, bakımı, korunması: ARSA PAYI oranında.
  //
  // ONARIM BİR OLAYDIR: aynı ay çatı akıntısı VE boya işi olabilir; ikincisi
  // ilkinin düzeltmesi değildir. İleride rutin bakım sözleşmesi (dönemsel) ile
  // arıza onarımı (olay bazlı) ayrı türlere bölünebilir — bugün zorunlu değil.
  { kod: 'ANA_BAKIM', ad: 'Anagayrimenkul bakım ve onarım', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', tahakkukSikligi: 'OLAY_BAZLI' },
  // POLİÇE TAKVİM AYINA OTURMAZ. Aynı ay ikinci poliçe (asansör sigortası,
  // DASK yenilemesi, ek teminat) meşrudur. Referans = poliçe numarası.
  { kod: 'SIGORTA', ad: 'Bina sigortası', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', tahakkukSikligi: 'OLAY_BAZLI' },
  // Yenileme fonu md. 72 — anagayrimenkule yapılan yatırımdır, malike aittir.
  { kod: 'YENILEME_FONU', ad: 'Yenileme fonu', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT', tahakkukSikligi: 'DONEMSEL' },
  // Isınma tüketime bağlıdır (5627 sayılı Enerji Verimliliği Kanunu md. 7/c);
  // paylaşım kuralı TUKETIM'dir ve sayaç okuması olmadan hesaplanamaz.
  //
  // ⚠️  ISITMA ile YAKIT AYNI PROJEDE BİRLİKTE KULLANILMAZ. Merkezi ısıtmada
  //     pay ölçer zorunluluğu belirli koşullara bağlıdır ve muaf yapılar
  //     vardır:
  //       · pay ölçerli site  → ISITMA (dönemsel, tüketim payına göre)
  //       · pay ölçersiz site → YAKIT  (olay bazlı, her dolum ayrı gider)
  //     Hangisinin kullanılacağı PROJE AYARIDIR, kod kararı değildir.
  { kod: 'ISITMA', ad: 'Isıtma gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL', grupKodu: 'ISINMA' },
  // HER TANKER DOLUMU AYRI BİR OLAYDIR; iki dolum birbirinin düzeltmesi
  // değildir. Referans = irsaliye/fatura numarası.
  //
  // Paylaşım kuralı ARSA_PAYI olarak tohumlanır; yönetim planı farklı
  // diyorsa proje bazında değiştirilir — kural VERİDİR, koda gömülü değildir.
  { kod: 'YAKIT', ad: 'Yakıt alımı', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'OLAY_BAZLI', grupKodu: 'ISINMA' },
  // ⚠️  BİLİNEN SINIR (ELEKTRIK_ORTAK · SU): tek abonelik varsayımıyla
  //     DONEMSEL. Çok abonelikli sitede (ortak alan + otopark + havuz ayrı
  //     sayaç) aynı ay iki fatura gelir ve türün ayrılması gerekir. Bu durum
  //     geldiğinde yeniden değerlendirilecektir.
  { kod: 'SU', ad: 'Su gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { kod: 'ASANSOR_ISLETME', ad: 'Asansör işletme gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { kod: 'ELEKTRIK_ORTAK', ad: 'Ortak alan elektriği', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { kod: 'TEMIZLIK', ad: 'Temizlik gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
  { kod: 'YONETIM', ad: 'Yönetim gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT', tahakkukSikligi: 'DONEMSEL' },
];

/** KMK bağlamına sadeleştirilmiş hesap planı (ADR-0003 Koşul 3). */
const HESAP_PLANI: { kod: string; ad: string; tip: Prisma.HesapCreateInput['tip'] }[] = [
  { kod: '100', ad: 'Kasa', tip: 'VARLIK' },
  { kod: '102', ad: 'Bankalar', tip: 'VARLIK' },
  { kod: '120', ad: 'Aidat Alacakları', tip: 'VARLIK' },
  { kod: '255', ad: 'Demirbaşlar', tip: 'VARLIK' },
  { kod: '320', ad: 'Tedarikçiler', tip: 'BORC' },
  { kod: '340', ad: 'Alınan Avanslar', tip: 'BORC' },
  { kod: '500', ad: 'Yenileme Fonu', tip: 'OZKAYNAK' },
  { kod: '600', ad: 'Aidat Gelirleri', tip: 'GELIR' },
  { kod: '602', ad: 'Gecikme Tazminatı Gelirleri', tip: 'GELIR' },
  { kod: '770', ad: 'Yönetim Giderleri', tip: 'GIDER' },
  { kod: '771', ad: 'Personel Giderleri', tip: 'GIDER' },
  { kod: '772', ad: 'Bakım Onarım Giderleri', tip: 'GIDER' },
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
async function tahakkukGecmisiOlustur(
  tenantId: string,
  sorumlular: ReadonlyMap<string, { kisiId: string; rol: 'MALIK' | 'KIRACI' }>,
): Promise<void> {
  const GIDER = 'KAPICI';                 // KULLANANA_AIT · EŞİT paylaşım
  const bolumIdler = [...sorumlular.keys()];
  let sira = 0;

  for (const d of DEMO_DONEMLER) {
    const calismaId = randomUUID();
    await prisma.tahakkukCalismasi.create({
      data: {
        id: calismaId, tenantId, giderTuruKodu: GIDER,
        donem: new Date(d.donem), tip: 'ASIL', sira: 1,
        toplamTutar: d.tutar * bolumIdler.length,
        bolumSayisi: bolumIdler.length,
      },
    });

    for (const bolumId of bolumIdler) {
      const sorumlu = sorumlular.get(bolumId);
      if (sorumlu === undefined) continue;
      sira += 1;
      const borcId = randomUUID();

      await prisma.borc.create({
        data: {
          id: borcId, tenantId, bolumId, calismaId,
          giderTuruKodu: GIDER,
          tahakkukNo: `THK-2026-${String(sira).padStart(6, '0')}`,
          tutar: d.tutar,
          odenen: d.kapali ? d.tutar : 0,
          vadeTarihi: new Date(d.vade),
          tahakkukDonemi: new Date(d.donem),
          kapandiMi: d.kapali,
        },
      });

      await prisma.borcSorumlusu.create({
        data: {
          id: randomUUID(), tenantId, borcId, kisiId: sorumlu.kisiId,
          sira: 'ASIL', rol: sorumlu.rol,
          cozumlemeTarihi: new Date(d.donem),
          pay: d.tutar, agirlik: 1n,
        },
      });
    }
  }

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

async function apartmanOlustur(t: ApartmanTohumu): Promise<string> {
  const tenantId = randomUUID();

  await prisma.tenant.create({
    data: {
      id: tenantId, kod: t.kod, ad: t.ad,
      tip: 'APARTMAN', durum: 'AKTIF',
      saatDilimi: 'Europe/Istanbul', paraBirimi: 'TRY',
      lisansKodu: 'BNOS-APT-V1',
    },
  });

  // RLS altında yazabilmek için tenant bağlamı kurulur.
  await prisma.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', false)`);

  await prisma.hesap.createMany({
    data: HESAP_PLANI.map((h) => ({
      id: randomUUID(), tenantId, kod: h.kod, ad: h.ad, tip: h.tip,
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

  const blokId = randomUUID();
  await prisma.blok.create({
    data: { id: blokId, tenantId, apartmanId, ad: 'A Blok' },
  });

  // Kat kayıtları bölümlerin kat numaralarından türetilir; elle liste tutmak
  // bölüm eklendiğinde güncellenmeyi unutulur.
  const katNolari = [...new Set(t.bolumler.map((b) => b.kat))].sort((a, b) => a - b);
  const katHaritasi = new Map<number, string>();
  for (const no of katNolari) {
    const katId = randomUUID();
    katHaritasi.set(no, katId);
    await prisma.kat.create({
      data: { id: katId, tenantId, blokId, no, ad: no === 0 ? 'Zemin' : null },
    });
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
      },
    });
  }

  /** Tahakkuk geçmişi için: bölüm → borcun yazılacağı kişi. */
  const borcSorumlusuHaritasi = new Map<string, { kisiId: string; rol: 'MALIK' | 'KIRACI' }>();

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

    await prisma.bagimsizBolum.create({
      data: {
        id: bolumId, tenantId, blokId, katId: katHaritasi.get(b.kat) ?? null,
        kapiNo: b.kapiNo, kat: b.kat, nitelik: 'MESKEN',
        brutM2: b.m2, netM2: Math.round(b.m2 * 0.85),
        arsaPayiPay: b.pay, arsaPayiPayda: 1_000_000n,
        aidatMuafiyeti: false,
      },
    });

    // Malik kaydı — hisse TAM (1/1); tek malikli daire.
    await prisma.malik.create({
      data: {
        id: randomUUID(), tenantId, bolumId, kisiId: malikId,
        hissePay: 1n, hissePayda: 1n,
        tapuTuru: 'KAT_MULKIYETI', tapuBaslangic: new Date('2024-01-01'),
      },
    });

    await prisma.bolumIliskisi.create({
      data: {
        id: randomUUID(), tenantId, bolumId, kisiId: malikId,
        rol: 'MALIK', baslangic: new Date('2024-01-01'), bitis: null,
      },
    });

    borcSorumlusuHaritasi.set(bolumId, { kisiId: malikId, rol: 'MALIK' });

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
      borcSorumlusuHaritasi.set(bolumId, { kisiId: kiraciId, rol: 'KIRACI' });
    }
  }

  if (t.tahakkukGecmisi === true) {
    await tahakkukGecmisiOlustur(tenantId, borcSorumlusuHaritasi);
  }

  console.log(`  ${t.ad}  (1 blok · ${katNolari.length} kat · ${t.bolumler.length} bağımsız bölüm)`);
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
