/**
 * CT-22 · ARAYÜZ SÖZLEŞMESİ — frontend tipleri gerçek API yanıtına uyuyor mu?
 *
 * ⚠️  NEDEN VAR: `frontend/web/lib/mock/veri.ts` içindeki tipler **`Mock`
 *     önekiyle** yazılmış ve `servis.ts` bunları GERÇEK API yanıtının tipi
 *     olarak da kullanıyor. Yani "API bu şekle uyuyor" bir VARSAYIMDI ve
 *     hiçbir yerde sınanmıyordu.
 *
 *     `MOCK_AKTIF=0` ölçümü (3 Ağustos) uçların 200 döndüğünü kanıtladı ama
 *     ŞEKLİ kanıtlamadı: eksik bir alan derleme zamanında görünmez (tip
 *     yalnızca iddiadır), çalışma anında `undefined` olur ve ekranda boş
 *     hücre olarak belirir. Sessiz bozulma.
 *
 * ⚠️  ALAN LİSTESİ ELLE YAZILMAZ, TİP KAYNAĞINDAN TÜRETİLİR. Elle yazılsaydı
 *     tip değiştiğinde test eski listeyi doğrulamaya devam eder ve YEŞİL
 *     kalırdı — koruduğunu sandığımız şeyi korumayan bir kapı.
 *
 * ⚠️  BOŞ DİZİ ŞEKLİ KANITLAMAZ. Tohumda örneği olmayan tipler için test
 *     KENDİ FİKSTÜRÜNÜ kurar; örnek bulunamazsa test DÜŞER, sessizce
 *     geçmez.
 *
 * PostgreSQL + tohum gerektirir.
 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { ProblemDetailsFilter } from '../../src/common/errors/problem-details.filter';

const prisma = new PrismaClient();

const SIFRE_HASH =
  'scrypt$131072$8$1$06dAft8lIJHsbeHFYucc8Q==$9GdovR26bdPFcpXtV96jbzSTjTcywpYL' +
  '/6gx4argmiuioNYMtEfo9FApnPK7FopBCy1xw+IJn78EIwJ+SJ0qiA==';

const T = randomUUID();
const EPOSTA = `ct22@${T.slice(0, 8)}.test`;
const DENETCI_EPOSTA = `ct22-denetci@${T.slice(0, 8)}.test`;
const kimlik = {
  apartmanId: randomUUID(), blokId: randomUUID(), katId: randomUUID(),
  bolumId: randomUUID(), malikKisi: randomUUID(), kiraciKisi: randomUUID(),
  sakinKisi: randomUUID(), malikId: randomUUID(), kiraciId: randomUUID(),
  hesapId: randomUUID(), personelId: randomUUID(), gorevliId: randomUUID(),
  sakinId: randomUUID(),
};

interface GirisYaniti { readonly accessToken: string }

/* ------------------------- TİP KAYNAĞINDAN TÜRETME ------------------------ */

/** Bir arayüz alanının bildirimi. */
interface Alan {
  readonly ad: string;
  /** `?` ile bildirilmiş ya da tipi `| null` içeriyorsa yanıt onu atlayabilir. */
  readonly istegeBagli: boolean;
  /** İç içe sözleşme tipi adayı — `TIPLER` içindeyse o tip de doğrulanır. */
  readonly icTip: string | null;
}

/**
 * Depo kökü — `.env` bulunana kadar yukarı yürünür.
 *
 * ⚠️  `import.meta` KULLANILMAZ: bu dosya `tsc` ile CommonJS hedefine de
 *     derlenir ve orada `TS1343` verir (ölçüldü). `test/setup.ts` aynı
 *     sorunu aynı yolla çözüyor; desen tekrarlanıyor, icat edilmiyor.
 */
function kokuBul(): string {
  let dizin = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dizin, '.env'))) return dizin;
    const ust = dirname(dizin);
    if (ust === dizin) break;
    dizin = ust;
  }
  throw new Error('Depo kökü bulunamadı (.env yok).');
}

/**
 * TİP KAYNAKLARI — İKİSİ BİRDEN.
 *
 * ⚠️  ÖNCE YALNIZCA `veri.ts` OKUNUYORDU VE BU BİR HATAYDI. Ekranların
 *     tükettiği muhasebe/portföy/iletişim tipleri `servis.ts` içinde
 *     bildirilmiş; oradakiler hiç doğrulanmıyordu.
 *
 * ⚠️  AYNI ADLA İKİ BİLDİRİM VAR: `PortfoyOzeti` hem `veri.ts`te hem
 *     `servis.ts`te. `servis.portfoyOzeti()` **servis.ts'tekini** döndürür;
 *     veri.ts'teki yalnızca mock'un iç şeklidir. Bu yüzden ÇAKIŞMADA
 *     `servis.ts` KAZANIR — tüketilen bildirim odur.
 *
 *     Bu ayrım ölçülmeden, CT-22 bir süre YANLIŞ BİLDİRİMİ doğruladı.
 */
const KOK = kokuBul();
const TIP_KAYNAKLARI = [
  join(KOK, 'frontend', 'web', 'lib', 'mock', 'veri.ts'),
  join(KOK, 'frontend', 'web', 'lib', 'servis.ts'),
] as const;

/**
 * `veri.ts` içindeki `export interface Mock… { … }` gövdelerini okur.
 *
 * ⚠️  TypeScript derleyicisi kullanılmadı: bu paket frontend'e bağımlı
 *     DEĞİLDİR ve olmamalıdır (paket sınırı · ADR v1.1 §40). Metin okuma,
 *     bağımlılık eklemeden tek kaynağa bakmayı sağlar.
 */
function tipleriOku(): ReadonlyMap<string, readonly Alan[]> {
  const tipler = new Map<string, readonly Alan[]>();
  // Sıra ÖNEMLİ: `servis.ts` sonra okunur ve çakışan adı EZER.
  for (const yol of TIP_KAYNAKLARI) tekDosyaOku(readFileSync(yol, 'utf8'), tipler);
  return tipler;
}

function tekDosyaOku(kaynak: string, tipler: Map<string, readonly Alan[]>): void {

  /*
   * ⚠️  DESEN `Mock\w+` DEĞİL, TÜM DIŞA VERİLEN ARAYÜZLER.
   *
   *     Tipler önce `Mock` önekiyle yazılmıştı; sözleşme doğrulandıktan
   *     sonra önek kaldırıldı (ad yanlış bilgi veriyordu: bunlar API
   *     sözleşmesidir, mock şekli değil). Desen `Mock\w+` kalsaydı
   *     ayrıştırıcı SIFIR tip bulur ve bütün sözleşme testleri SESSİZCE
   *     GEÇERDİ — test (0) bu yüzden var ve bu değişikliği o yakaladı.
   */
  const arayuz = /export interface (\w+)\s*\{([\s\S]*?)\n\}/gu;
  let e: RegExpExecArray | null;
  while ((e = arayuz.exec(kaynak)) !== null) {
    const ad = e[1] ?? '';
    const govde = e[2] ?? '';
    const alanlar: Alan[] = [];

    /*
     * ⚠️  SATIR İÇİ İÇ NESNELER ATLANIR — derinlik takibiyle.
     *
     *     `readonly tahsilatDurumu: { readonly tahakkuk: string; … }` gibi
     *     ADSIZ iç nesneler var. Derinlik takip edilmeseydi `tahakkuk`
     *     üst tipin alanı sanılır ve yanıtta bulunamadığı için YANLIŞ
     *     UYUMSUZLUK bildirilirdi — ölçüldü, `PortfoyOzeti` için tam
     *     olarak bu oldu.
     *
     *     Adsız iç nesnenin alanları AYRICA doğrulanmaz: adı olmayan tipin
     *     `TIPLER` içinde karşılığı yoktur. Bu bilinen bir sınırdır ve
     *     rapora yazıldı.
     */
    let derinlik = 0;
    for (const ham of govde.split('\n')) {
      const satir = ham.trim();
      const acilan = (satir.match(/\{/gu) ?? []).length;
      const kapanan = (satir.match(/\}/gu) ?? []).length;
      const satirBasiDerinlik = derinlik;
      derinlik += acilan - kapanan;

      // Yorum ve boş satırlar atlanır.
      if (satir === '' || satir.startsWith('//') || satir.startsWith('*')
        || satir.startsWith('/*')) continue;
      // İç nesnenin İÇİNDEKİ satırlar üst tipin alanı değildir.
      if (satirBasiDerinlik > 0) continue;

      const m = /^(?:readonly\s+)?(\w+)(\??)\s*:\s*([^;]+);/u.exec(satir);
      if (m === null) continue;

      const alanAdi = m[1] ?? '';
      const tipMetni = m[3] ?? '';
      /*
       * İç içe tip ADAYI — büyük harfle başlayan ilk ad. `string`/`number`
       * gibi ilkel tipler küçük harfle başlar, elenirler. Aday `TIPLER`
       * içinde yoksa `eksikAlanlar` ona İNMEZ (ör. `Date`); yani bilinmeyen
       * bir ad yanlış hata üretmez.
       */
      const icTipEsleme = /\b([A-Z]\w+)\b/u.exec(tipMetni);

      alanlar.push({
        ad: alanAdi,
        istegeBagli: m[2] === '?' || /\|\s*null/u.test(tipMetni),
        icTip: icTipEsleme?.[1] ?? null,
      });
    }
    tipler.set(ad, alanlar);
  }
}

const TIPLER = tipleriOku();

/**
 * Bir yanıt nesnesini tipe göre doğrular; İÇ İÇE alanlara da iner.
 *
 * ⚠️  YÜZEYSEL KONTROL YETMEZ: `daireKarti.malikler[0].hissePay` eksikse üst
 *     düzey alanlar tam görünür ama ekranda hisse boş çıkar.
 *
 * Dönüş: eksik alanların `Tip.alan` biçiminde listesi. Boş liste = uyuyor.
 */
function eksikAlanlar(
  tipAdi: string, deger: unknown, yol = tipAdi, derinlik = 0,
): readonly string[] {
  if (derinlik > 4) return [];
  const alanlar = TIPLER.get(tipAdi);
  if (alanlar === undefined) return [`${yol}: tip bulunamadı (${tipAdi})`];
  if (deger === null || typeof deger !== 'object') {
    return [`${yol}: nesne değil (${typeof deger})`];
  }

  const nesne = deger as Record<string, unknown>;
  const eksik: string[] = [];

  for (const a of alanlar) {
    const varMi = a.ad in nesne;
    if (!varMi) {
      // İsteğe bağlı alan yanıtta hiç bulunmayabilir — bu ihlal DEĞİLDİR.
      if (!a.istegeBagli) eksik.push(`${yol}.${a.ad}`);
      continue;
    }
    // Bilinmeyen ad (ör. `Date`) bir sözleşme tipi değildir; inilmez.
    if (a.icTip === null || !TIPLER.has(a.icTip)) continue;

    const ic = nesne[a.ad];
    if (Array.isArray(ic)) {
      // Boş dizi iç tipi kanıtlamaz; ilk öge varsa o denetlenir.
      if (ic.length > 0) {
        eksik.push(...eksikAlanlar(a.icTip, ic[0], `${yol}.${a.ad}[0]`, derinlik + 1));
      }
    } else if (ic !== null && ic !== undefined) {
      eksik.push(...eksikAlanlar(a.icTip, ic, `${yol}.${a.ad}`, derinlik + 1));
    }
  }
  return eksik;
}

/**
 * Sayfalı yanıttan ilk öğe.
 *
 * ⚠️  Sayfa anahtarı uçtan uca AYNI DEĞİL: `/bolumler` `kayitlar` döndürüyor,
 *     başkaları düz dizi. İlk yazımda yalnızca `veriler` aranmıştı ve test
 *     "örnek yok" diye düşmüştü — ölçüm hatasıydı, ürün hatası değil.
 *     ★ Anahtar tutarsızlığının kendisi ayrı bir bulgudur (§ rapora yazıldı).
 */
/**
 * İç içe tipin SINANABİLMESİ için dolu olması gereken diziler.
 *
 * ⚠️  Bu tablo olmadan `Sertifika` · `Zimmet` · `GorevliAraci` tipleri
 *     "doğrulandı" sayılırdı ama aslında hiç denetlenmemiş olurdu: fikstür
 *     o satırları yazmasaydı diziler boş gelir, doğrulayıcı içlerine inmez
 *     ve test yeşil kalırdı.
 */
const ZORUNLU_DOLU_DIZILER: Readonly<Record<string, readonly string[]>> = {
  SitePersoneli: ['sertifikalar', 'zimmetler'],
  DaireGorevlisi: ['araclari'],
  DaireKarti: ['malikler', 'kiracilar', 'sakinler'],
};

function sayfadanIlk(g: unknown): unknown {
  if (Array.isArray(g)) return g[0];
  const o = g as { kayitlar?: unknown[]; veriler?: unknown[]; satirlar?: unknown[] };
  return (o.kayitlar ?? o.veriler ?? o.satirlar ?? [])[0];
}

function baglamda<T2>(fn: (tx: Prisma.TransactionClient) => Promise<T2>): Promise<T2> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${T}', true)`);
    for (const a of ['app.kapsam_kisi_id', 'app.kapsam_bolumler', 'app.kapsam_mulk_bolumler']) {
      await tx.$executeRawUnsafe(`SELECT set_config('${a}', '', true)`);
    }
    return fn(tx);
  });
}

describe('CT-22 · Arayüz sözleşmesi', () => {
  let app: INestApplication;
  let jeton: string;
  let denetciJetonu: string;

  const sunucu = (): Server => app.getHttpServer() as Server;
  const al = (yol: string) =>
    request(sunucu()).get(`/api/v1${yol}`).set('Authorization', `Bearer ${jeton}`);

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: T, kod: `ct22-${T.slice(0, 8)}`, ad: 'CT-22 Sözleşme',
        tip: 'SITE', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    /*
     * ⚠️  KENDİ FİKSTÜRÜ. Tohumda `sakin` · `misafir` · `site_personeli` ·
     *     `daire_gorevlisi` HİÇ YOK (ölçüldü: 0 satır). O tipler tohumla
     *     sınansaydı boş dizi dönerdi ve test SESSİZCE geçerdi — hiçbir şey
     *     doğrulamadan.
     */
    await baglamda(async (tx) => {
      await tx.apartman.create({
        data: { id: kimlik.apartmanId, tenantId: T, ad: 'CT-22 Sitesi', adres: 'Deneme' },
      });
      await tx.blok.create({
        data: { id: kimlik.blokId, tenantId: T, apartmanId: kimlik.apartmanId, ad: 'A Blok' },
      });
      await tx.kat.create({
        data: { id: kimlik.katId, tenantId: T, blokId: kimlik.blokId, no: 1, ad: 'Birinci' },
      });
      await tx.bagimsizBolum.create({
        data: {
          id: kimlik.bolumId, tenantId: T, blokId: kimlik.blokId, katId: kimlik.katId,
          kapiNo: '1', kat: 1, nitelik: 'MESKEN', brutM2: 100, netM2: 85,
          arsaPayiPay: 1_000_000n, arsaPayiPayda: 1_000_000n,
        },
      });

      await tx.kisi.createMany({
        data: [
          { id: kimlik.malikKisi, tenantId: T, ad: 'Malik', soyad: 'Kişi' },
          { id: kimlik.kiraciKisi, tenantId: T, ad: 'Kiracı', soyad: 'Kişi' },
          { id: kimlik.sakinKisi, tenantId: T, ad: 'Sakin', soyad: 'Kişi' },
        ],
      });
      await tx.malik.create({
        data: {
          id: kimlik.malikId, tenantId: T, bolumId: kimlik.bolumId,
          kisiId: kimlik.malikKisi, hissePay: 1n, hissePayda: 1n,
          tapuTuru: 'KAT_MULKIYETI', tapuBaslangic: new Date('2024-01-01'),
        },
      });
      await tx.kiraci.create({
        data: {
          id: kimlik.kiraciId, tenantId: T, bolumId: kimlik.bolumId,
          kisiId: kimlik.kiraciKisi, baslangic: new Date('2025-01-01'),
        },
      });
      await tx.sakin.create({
        data: {
          id: kimlik.sakinId, tenantId: T, bolumId: kimlik.bolumId,
          kisiId: kimlik.sakinKisi, kiraciId: kimlik.kiraciId,
          yakinlikDerecesi: 'ES', girisTarihi: new Date('2025-01-01'),
        },
      });
      await tx.misafir.create({
        data: {
          id: randomUUID(), tenantId: T, bolumId: kimlik.bolumId,
          ad: 'Misafir', soyad: 'Kişi', girisTarihi: new Date('2026-08-01'),
          ziyaretNedeni: 'Aile ziyareti',
        },
      });
      /*
       * ⚠️  SERTİFİKA · ZİMMET · ARAÇ SATIRLARI ZORUNLU.
       *
       *     `SitePersoneli.sertifikalar` / `.zimmetler` ve
       *     `DaireGorevlisi.araclari` İÇ İÇE dizilerdir. Boş bırakılsalardı
       *     doğrulayıcı onlara HİÇ İNMEZ (boş dizi iç tipi kanıtlamaz) ve üç
       *     tip sınanmamış olduğu hâlde test YEŞİL görünürdü.
       *
       *     ★ İlk yazımda tam olarak bu olmuştu: kendi fikstürüm sessiz
       *       boşluk üretmişti.
       */
      await tx.sitePersoneli.create({
        data: {
          id: kimlik.personelId, tenantId: T, apartmanId: kimlik.apartmanId,
          ad: 'Personel', soyad: 'Kişi', gorev: 'TEMIZLIK',
          iseGirisTarihi: new Date('2025-06-01'),
          sertifikalar: {
            create: {
              id: randomUUID(), tenantId: T, ad: 'İş Güvenliği',
              kurum: 'MEB', belgeNo: 'IG-2025-1',
              verilisTarihi: new Date('2025-06-01'),
              gecerlilikBitisi: new Date('2027-06-01'),
            },
          },
          zimmetler: {
            create: {
              id: randomUUID(), tenantId: T, ad: 'Telsiz', seriNo: 'TL-01',
              adet: 1, zimmetTarihi: new Date('2025-06-02'),
            },
          },
        },
      });
      await tx.daireGorevlisi.create({
        data: {
          id: kimlik.gorevliId, tenantId: T, bolumId: kimlik.bolumId,
          isvereniTipi: 'MALIK', ad: 'Görevli', soyad: 'Kişi',
          gorev: 'TEMIZLIK', calismaBaslangic: new Date('2025-06-01'),
        },
      });
      await tx.arac.create({
        data: {
          id: randomUUID(), tenantId: T, bolumId: kimlik.bolumId,
          gorevliId: kimlik.gorevliId, plaka: '34ABC123', tur: 'OTOMOBIL',
          marka: 'Marka', model: 'Model', renk: 'Beyaz',
          baslangic: new Date('2025-06-01'),
        },
      });

      await tx.hesap.create({
        data: { id: kimlik.hesapId, tenantId: T, kod: '349', ad: 'Avanslar', tip: 'BORC' },
      });
      await tx.giderTuru.create({
        data: {
          id: randomUUID(), tenantId: T, kod: 'CT22_AIDAT', ad: 'Aidat',
          paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
          kuralKaynagi: 'KMK_VARSAYILAN', tahakkukSikligi: 'DONEMSEL',
          muhasebeHesapId: kimlik.hesapId,
        },
      });

      for (const [eposta, ad, rol] of [
        [EPOSTA, 'Yönetim', 'YONETIM_SIRKETI'],
        [DENETCI_EPOSTA, 'Denetçi', 'DENETCI'],
      ] as const) {
        const kisiId = randomUUID();
        await tx.kisi.create({ data: { id: kisiId, tenantId: T, ad: 'CT22', soyad: ad } });
        await tx.kullanici.create({
          data: {
            id: randomUUID(), tenantId: T, kisiId, eposta,
            sifreHash: SIFRE_HASH, aktif: true,
            roller: { create: { id: randomUUID(), tenantId: T, rolKodu: rol } },
          },
        });
      }
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const gir = async (eposta: string): Promise<string> => {
      const y = await request(sunucu())
        .post('/api/v1/oturum/giris').send({ eposta, sifre: 'bnos1234' });
      if (y.status >= 300) throw new Error(`Giriş başarısız (${eposta}): ${y.status}`);
      return (y.body as GirisYaniti).accessToken;
    };
    jeton = await gir(EPOSTA);
    denetciJetonu = await gir(DENETCI_EPOSTA);
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('(0) tip kaynağı okundu ve boş değil', () => {
    /*
     * Bu test bir KORUMADIR: `veri.ts` taşınır ya da biçimi değişirse
     * ayrıştırıcı 0 tip döner ve ÖTEKİ TESTLERİN HEPSİ SESSİZCE GEÇERDİ —
     * hiçbir şey doğrulamadan yeşil bir süit.
     */
    expect(TIPLER.size).toBeGreaterThan(20);
    expect(TIPLER.has('Bolum')).toBe(true);
    expect(TIPLER.has('DaireKarti')).toBe(true);
  });

  /**
   * Her satır: tip · uç · yanıttan örnek nesneyi çıkaran işlev.
   *
   * ⚠️  ÖRNEK BULUNAMAZSA TEST DÜŞER (aşağıdaki `expect`). Boş dizi şekli
   *     kanıtlamaz; "veri yoktu" ile "şekil uyuyor" karıştırılamaz.
   */
  const SOZLESMELER: readonly [string, string, (g: unknown) => unknown][] = [
    ['Apartman', '/apartmanlar', (g) => (g as unknown[])[0]],
    ['Blok', '/bloklar', (g) => (g as unknown[])[0]],
    ['Kat', `/katlar?blokId=${kimlik.blokId}`, (g) => (g as unknown[])[0]],
    ['Bolum', '/bolumler', (g) => sayfadanIlk(g)],
    ['YerlesimOzeti', '/bolumler/yerlesim-ozeti', (g) => g],
    ['ArsaPayiRaporu', '/bolumler/arsa-payi-durumu', (g) => g],
    ['DaireKarti', `/daireler/${kimlik.bolumId}/kart`, (g) => g],
    ['GiderTuru', '/gider-turleri', (g) => (g as unknown[])[0]],
    ['Misafir', '/misafirler', (g) => sayfadanIlk(g)],
    ['SitePersoneli', '/site-personeli', (g) => sayfadanIlk(g)],
    ['DaireGorevlisi', '/daire-gorevlileri', (g) => sayfadanIlk(g)],
    /*
     * ⚠️  `servis.ts` içinde bildirilen tipler de burada. Önce yalnızca
     *     `veri.ts` okunuyordu ve muhasebe/portföy tarafı hiç doğrulanmıyordu.
     */
    ['MuhasebeParametreleri', '/muhasebe/parametreler', (g) => g],
  ];

  for (const [tip, yol, ornekAl] of SOZLESMELER) {
    it(`(${tip}) gerçek API yanıtı tipe uyuyor — iç içe alanlar dâhil`, async () => {
      const y = await al(yol);
      expect(y.status, `${yol} → ${y.status}`).toBe(200);

      const ornek = ornekAl(y.body);
      // ★ Örnek yoksa test DÜŞER: boş dizi hiçbir şey kanıtlamaz.
      expect(ornek, `${yol}: doğrulanacak örnek yok (boş yanıt)`).toBeTruthy();

      const eksik = eksikAlanlar(tip, ornek);
      expect(eksik, `EKSİK ALANLAR → ${eksik.join(' · ')}`).toEqual([]);

      /*
       * ★ İÇ İÇE DİZİLER GERÇEKTEN DOLU MU?
       *
       *   `eksikAlanlar` boş diziye İNMEZ (boş dizi iç tipi kanıtlamaz).
       *   Bu kontrol olmasaydı fikstür o satırları yazmayı unuttuğunda test
       *   yeşil kalır ve iç tipler SINANMAMIŞ olduğu hâlde "doğrulandı"
       *   sanılırdı — testin kendi sessiz boşluğu.
       */
      const zorunluDolu = ZORUNLU_DOLU_DIZILER[tip];
      if (zorunluDolu !== undefined) {
        const o = ornek as Record<string, unknown>;
        for (const alan of zorunluDolu) {
          const dizi = o[alan];
          expect(
            Array.isArray(dizi) && dizi.length > 0,
            `${tip}.${alan} boş — iç tip sınanamadı, fikstür eksik`,
          ).toBe(true);
        }
      }
    }, 30_000);
  }

  it('(PortfoyOzeti · PortfoyProjesi) portföy özeti tipe uyuyor', async () => {
    /*
     * ⚠️  TOHUMUN YÖNETİM FİRMASI KULLANILIR, kendi fikstürü DEĞİL.
     *
     *     Portföy özeti bir YÖNETİM FİRMASI tenant'ı ve en az bir AÇIK DEVİR
     *     kaydı ister (ADR-0009). CT-22'nin kendi tenant'ı `SITE` tipindedir
     *     ve devir taşımaz; orada denenirse 422 gelir ve bu DOĞRU davranıştır.
     *     Tohum bu yapıyı zaten kuruyor — ikinci kez kurmak iki fikstürün
     *     ayrışmasına kapı açardı.
     */
    const g = await request(sunucu())
      .post('/api/v1/oturum/giris')
      .send({ eposta: 'portfoy@bn-yonetim.test', sifre: 'bnos1234' });
    expect(g.status, 'yönetim firması girişi başarısız — tohum kurulu mu?').toBe(201);

    const y = await request(sunucu())
      .get('/api/v1/portfoy/ozet')
      .set('Authorization', `Bearer ${(g.body as GirisYaniti).accessToken}`);
    expect(y.status).toBe(200);
    expect(eksikAlanlar('PortfoyOzeti', y.body)).toEqual([]);

    // ★ `projeler` boşsa iç tip SINANMAMIŞ olur; boş dizi kanıt değildir.
    const projeler = (y.body as { projeler?: unknown[] }).projeler ?? [];
    expect(projeler.length, 'portföyde proje yok — iç tip sınanamaz').toBeGreaterThan(0);
    expect(eksikAlanlar('PortfoyProjesi', projeler[0])).toEqual([]);
  }, 30_000);

  /*
   * ⛔ `MockSakinCikisSonucu` BİLEREK KAPSAM DIŞI.
   *
   *    Bir API sözleşmesi DEĞİL, mock'un kendi iç tipidir: `servis.sakinCikis`
   *    `Promise<void>` döner ve yanıt gövdesini HİÇ OKUMAZ
   *    (`servis.ts` · `gonder(... 'PATCH' ...)`). Uç `KomutSonucu` döndürüyor,
   *    bu tip ise mock'un toplu çıkış sayacını anlatıyor.
   *
   *    ★ Bu yüzden `Mock` öneki DOĞRUDUR ve kalır. Sözleşme testi yazmak,
   *      olmayan bir sözleşmeyi doğrulamak olurdu — ilk denemede tam olarak
   *      bu yapıldı ve test haklı olarak düştü.
   */

  it('(AuditSatiri) denetim kaydı tipe uyuyor', async () => {
    /*
     * ⚠️  DENETCI JETONU. `AUDIT_GORUNTULE` YALNIZCA `DENETCI` rolündedir
     *     (`roller.ts:107`); yönetim jetonuyla denendiğinde 403 gelir ve bu
     *     DOĞRU davranıştır — denetim kaydını görmek ayrı bir yetkidir.
     */
    /*
     * ⚠️  DENETİM KAYDI GERÇEK API YAZMASIYLA ÜRETİLİR. Fikstür doğrudan
     *     Prisma ile yazıldığı için denetim satırı OLUŞMUYOR — denetim izini
     *     servis katmanı yazar. İlk yazımda bu atlanmış ve test "denetim
     *     kaydı üretmemiş" diye düşmüştü; ürün hatası değil, fikstür hatasıydı.
     */
    const olustur = await request(sunucu())
      .post('/api/v1/katlar')
      .set('Authorization', `Bearer ${jeton}`)
      .set('Idempotency-Key', randomUUID())
      .send({ blokId: kimlik.blokId, no: 7, ad: 'Denetim Katı' });
    expect(olustur.status, 'kat oluşturulamadı').toBe(201);
    const katId = (olustur.body as { id: string }).id;

    const y = await request(sunucu())
      .get(`/api/v1/audit?varlik=Kat&varlikId=${katId}`)
      .set('Authorization', `Bearer ${denetciJetonu}`);
    expect(y.status).toBe(200);
    const g = y.body as { kayitlar?: unknown[] };
    const ornek = (g.kayitlar ?? [])[0];
    expect(ornek, 'Kat oluşturma denetim kaydı üretmemiş').toBeTruthy();
    expect(eksikAlanlar('AuditSatiri', ornek)).toEqual([]);
  }, 30_000);
});

