/**
 * CT-21 · TAHAKKUKUN MUHASEBELEŞTİRİLMESİ + DAĞITIM EZMESİ (ADR-0017)
 *
 * ⚠️  NEDEN VAR: tahakkuk borç üretiyordu ama deftere HİÇ düşmüyordu. Ölçüldü:
 *     `borc` 36 satır · `yevmiye_fisi` 0 satır ·
 *     `kontrol-mutabakati` → {"fark":"23400.0000","mutabikMi":false}
 *
 *     Bu bir veri sorunu değildi — `Borc`/`TahakkukCalismasi` fiş bağı taşımıyor
 *     ve `muhasebelestir` ucu yoktu. ADR-0003'ün çift taraflı kayıt kararı,
 *     kayıt sisteminin ANA işlem türü için uygulanmamıştı.
 *
 * ⚠️  BİTİŞİN TEK KANITI (16): `mutabikMi: true`. Öteki testler mekanizmayı
 *     ölçer; mutabakat SONUCU ölçer.
 *
 * PostgreSQL gerektirir.
 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
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
const EPOSTA = `ct21@${T.slice(0, 8)}.test`;
const DONEM = '2026-03-01';
const VADE = '2026-03-31';

interface GirisYaniti { readonly accessToken: string }
interface HataGovdesi { readonly detail?: string; readonly sonrakiEylem?: string }

const kimlik = { hesap: {} as Record<string, string>, bolum: [] as string[] };

function baglamda<T2>(fn: (tx: Prisma.TransactionClient) => Promise<T2>): Promise<T2> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${T}', true)`);
    for (const a of ['app.kapsam_kisi_id', 'app.kapsam_bolumler', 'app.kapsam_mulk_bolumler']) {
      await tx.$executeRawUnsafe(`SELECT set_config('${a}', '', true)`);
    }
    return fn(tx);
  });
}

describe('CT-21 · Tahakkuk muhasebeleştirme', () => {
  let app: INestApplication;
  let jeton: string;

  const sunucu = (): Server => app.getHttpServer() as Server;
  const yetki = (): Record<string, string> => ({ Authorization: `Bearer ${jeton}` });

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: T, kod: `ct21-${T.slice(0, 8)}`, ad: 'CT-21 Tahakkuk',
        tip: 'APARTMAN', durum: 'AKTIF', saatDilimi: 'Europe/Istanbul',
        paraBirimi: 'TRY', lisansKodu: 'TEST',
      },
    });

    await baglamda(async (tx) => {
      for (const [kod, ad, tip, ozellik] of [
        ['100', 'Kasa', 'VARLIK', 'KASA'],
        ['120', 'Aidat Alacakları', 'VARLIK', 'CARI_KONTROL'],
        ['349', 'Alınan Ortak Gider Avansları', 'BORC', 'NORMAL'],
        ['600', 'Aidat Gelirleri', 'GELIR', 'NORMAL'],
      ] as const) {
        const id = randomUUID();
        kimlik.hesap[kod] = id;
        await tx.hesap.create({ data: { id, tenantId: T, kod, ad, tip, ozellik } });
      }

      await tx.muhasebeParametresi.create({
        data: {
          tenantId: T,
          varsayilanKasaHesapId: kimlik.hesap['100'] ?? null,
        },
      });
      await tx.muhasebeDonemi.create({
        data: {
          id: randomUUID(), tenantId: T, maliYil: 2026, ad: '2026',
          baslangic: new Date('2026-01-01'), bitis: new Date('2026-12-31'),
          durum: 'ACIK',
        },
      });

      const apartmanId = randomUUID();
      const blokId = randomUUID();
      await tx.apartman.create({ data: { id: apartmanId, tenantId: T, ad: 'CT-21' } });
      await tx.blok.create({ data: { id: blokId, tenantId: T, apartmanId, ad: 'A' } });

      /*
       * DÖRT BÖLÜM, FARKLI ARSA PAYI VE m². Eşit olmayan ölçüler bilinçli:
       * hepsi eşit olsaydı ESIT ile ARSA_PAYI aynı sonucu verir ve ezmenin
       * gerçekten çalışıp çalışmadığı ölçülemezdi.
       */
      const olculer = [
        { kapiNo: '1', pay: 100_000n, m2: 100 },
        { kapiNo: '2', pay: 200_000n, m2: 120 },
        { kapiNo: '3', pay: 300_000n, m2: 140 },
        { kapiNo: '4', pay: 400_000n, m2: 160 },
      ];
      for (const o of olculer) {
        const bolumId = randomUUID();
        const kisiId = randomUUID();
        kimlik.bolum.push(bolumId);
        await tx.bagimsizBolum.create({
          data: {
            id: bolumId, tenantId: T, blokId, kapiNo: o.kapiNo, kat: 1,
            nitelik: 'MESKEN', brutM2: o.m2, netM2: Math.round(o.m2 * 0.85),
            arsaPayiPay: o.pay, arsaPayiPayda: 1_000_000n,
          },
        });
        await tx.kisi.create({
          data: { id: kisiId, tenantId: T, ad: `Malik${o.kapiNo}`, soyad: 'CT21' },
        });
        await tx.malik.create({
          data: {
            id: randomUUID(), tenantId: T, bolumId, kisiId,
            hissePay: 1n, hissePayda: 1n,
            tapuTuru: 'KAT_MULKIYETI', tapuBaslangic: new Date('2024-01-01'),
          },
        });
        await tx.bolumIliskisi.create({
          data: {
            id: randomUUID(), tenantId: T, bolumId, kisiId,
            rol: 'MALIK', baslangic: new Date('2024-01-01'),
          },
        });
      }

      // AIDAT: ESIT varsayılan. Ezme testleri bunu ARSA_PAYI/TUKETIM'e çevirir.
      await tx.giderTuru.create({
        data: {
          id: randomUUID(), tenantId: T, kod: 'AIDAT', ad: 'Aidat',
          paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT',
          kuralKaynagi: 'KMK_VARSAYILAN', tahakkukSikligi: 'DONEMSEL',
          muhasebeHesapId: kimlik.hesap['349'] ?? '',
        },
      });

      const kisiId = randomUUID();
      await tx.kisi.create({ data: { id: kisiId, tenantId: T, ad: 'CT21', soyad: 'Yönetim' } });
      await tx.kullanici.create({
        data: {
          id: randomUUID(), tenantId: T, kisiId, eposta: EPOSTA,
          sifreHash: SIFRE_HASH, aktif: true,
          roller: { create: { id: randomUUID(), tenantId: T, rolKodu: 'YONETIM_SIRKETI' } },
        },
      });
    });

    const modul = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modul.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();

    const y = await request(sunucu())
      .post('/api/v1/oturum/giris').send({ eposta: EPOSTA, sifre: 'bnos1234' });
    if (y.status >= 300) throw new Error(`Giriş başarısız: ${y.status}`);
    jeton = (y.body as GirisYaniti).accessToken;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  const tahakkukCalistir = (
    govde: Record<string, unknown>,
  ): request.Test => request(sunucu())
    .post('/api/v1/tahakkuk/calistir')
    .set(yetki())
    .set('Idempotency-Key', randomUUID())
    .send({ giderTuruKodu: 'AIDAT', donem: DONEM, vadeTarihi: VADE, ...govde });

  // =====================================================================
  // A · GİDER TÜRÜ ↔ HESAP BAĞI (K1)
  // =====================================================================

  it('(1) gider türü ZORUNLU muhasebe hesabı taşır', async () => {
    const t = await baglamda((tx) => tx.giderTuru.findFirstOrThrow({
      where: { tenantId: T, kod: 'AIDAT' },
      select: { muhasebeHesapId: true },
    }));
    expect(t.muhasebeHesapId).toBe(kimlik.hesap['349']);
  });

  it('(2) hesapsız gider türü YAZILAMAZ — veritabanı reddeder', async () => {
    /*
     * Alan boş bırakılabilir olsaydı, karşılığı olmayan bir türün tahakkuku
     * ya sessizce muhasebeleşmez ya da rastgele bir hesaba yazılırdı.
     */
    await expect(baglamda((tx) => tx.$executeRawUnsafe(
      `INSERT INTO gider_turu (id, tenant_id, kod, ad, paylasim_kurali,
         sorumluluk_tipi, kural_kaynagi, guncelleme_tarihi)
       VALUES ('${randomUUID()}', '${T}', 'HESAPSIZ', 'Hesapsız', 'ESIT',
         'KULLANANA_AIT', 'KMK_VARSAYILAN', now())`,
    ))).rejects.toThrow();
  });

  // =====================================================================
  // B · DAĞITIM EZMESİ (K7)
  // =====================================================================

  it('(3) ezme YOKKEN varsayılan kural kayda yazılır, ezildi=false', async () => {
    const y = await tahakkukCalistir({ toplamTutar: '1000.00' });
    expect(y.status).toBe(201);

    const c = await baglamda((tx) => tx.tahakkukCalismasi.findFirstOrThrow({
      where: { tenantId: T, giderTuruKodu: 'AIDAT', donem: new Date(DONEM) },
      select: { kullanilanPaylasimKurali: true, paylasimKuraliEzildi: true },
    }));
    expect(c.kullanilanPaylasimKurali).toBe('ESIT');
    expect(c.paylasimKuraliEzildi).toBe(false);
  });

  it('(4) ESIT varsayılanı 1000 TL\'yi dörde eşit böler', async () => {
    const borclar = await baglamda((tx) => tx.borc.findMany({
      where: { tenantId: T, tahakkukDonemi: new Date(DONEM) },
      select: { tutar: true },
    }));
    expect(borclar).toHaveLength(4);
    expect(borclar.every((b) => b.tutar.toFixed(2) === '250.00')).toBe(true);
  });

  it('(5) ARSA_PAYI ile EZİLİR — dağıtım gerçekten değişir', async () => {
    const y = await tahakkukCalistir({
      toplamTutar: '1000.00', donem: '2026-04-01', vadeTarihi: '2026-04-30',
      paylasimKurali: 'ARSA_PAYI',
    });
    expect(y.status).toBe(201);

    const borclar = await baglamda((tx) => tx.borc.findMany({
      where: { tenantId: T, tahakkukDonemi: new Date('2026-04-01') },
      select: { tutar: true, bolum: { select: { kapiNo: true } } },
      orderBy: { bolum: { kapiNo: 'asc' } },
    }));
    // 100/200/300/400 binde → 100 / 200 / 300 / 400 TL
    expect(borclar.map((b) => b.tutar.toFixed(2)))
      .toEqual(['100.00', '200.00', '300.00', '400.00']);
  });

  it('(6) ezme kayda YAZILIR — ezildi=true', async () => {
    const c = await baglamda((tx) => tx.tahakkukCalismasi.findFirstOrThrow({
      where: { tenantId: T, donem: new Date('2026-04-01') },
      select: { kullanilanPaylasimKurali: true, paylasimKuraliEzildi: true },
    }));
    expect(c.kullanilanPaylasimKurali).toBe('ARSA_PAYI');
    expect(c.paylasimKuraliEzildi).toBe(true);
  });

  it('(6b) ★ GİDER TÜRÜ SONRADAN DEĞİŞSE DE eski tahakkuk ESKİ kuralla okunur', async () => {
    /*
     * SNAPSHOT'IN ASIL SEBEBİ BUDUR (ADR-0017 · K7a) ve bugüne dek
     * SINANMAMIŞTI: iki test kuralın YAZILDIĞINI ölçüyordu, kaydın gider
     * türünden BAĞIMSIZ kaldığını ölçen yoktu.
     *
     * Senaryo: yönetim kurulu kararıyla kapıcı gideri artık arsa payına
     * göre dağıtılacak. Gider türü güncellenir. Geçmiş dönemin tahakkuku
     * hâlâ eşit bölünmüş olarak kalmalıdır — aksi hâlde "bu daireye neden
     * bu tutar yazıldı" sorusu bir yıl sonra YANLIŞ cevaplanır ve itiraz
     * hâlinde yönetim kendi kaydıyla çelişir.
     *
     * ⚠️  Kural okunurken `giderTuru`ne JOIN atılsaydı bu test kırmızı
     *     olurdu; kolonun var olması tek başına yetmez, OKUMANIN da ondan
     *     yapılması gerekir.
     */
    const oncesi = await baglamda((tx) => tx.tahakkukCalismasi.findFirstOrThrow({
      where: { tenantId: T, giderTuruKodu: 'AIDAT', donem: new Date(DONEM) },
      select: { id: true, kullanilanPaylasimKurali: true, paylasimKuraliEzildi: true },
    }));
    expect(oncesi.kullanilanPaylasimKurali).toBe('ESIT');

    // Gider türünün kuralı DEĞİŞTİRİLİR — gerçek hayatta kurul kararıyla.
    await baglamda((tx) => tx.giderTuru.updateMany({
      where: { tenantId: T, kod: 'AIDAT' },
      data: { paylasimKurali: 'ARSA_PAYI' },
    }));

    const sonrasi = await baglamda((tx) => tx.tahakkukCalismasi.findFirstOrThrow({
      where: { id: oncesi.id },
      select: { kullanilanPaylasimKurali: true, paylasimKuraliEzildi: true },
    }));
    expect(
      sonrasi.kullanilanPaylasimKurali,
      'geçmiş tahakkuk gider türünün YENİ kuralını gösteriyor — snapshot tutmuyor',
    ).toBe('ESIT');
    // Ezme bayrağı da kaymamalı: o gün ezme YAPILMAMIŞTI.
    expect(sonrasi.paylasimKuraliEzildi).toBe(false);

    // Yazılmış borç tutarları da eşit bölünmüş kalmalıdır (4 × 250).
    const borclar = await baglamda((tx) => tx.borc.findMany({
      where: { tenantId: T, tahakkukDonemi: new Date(DONEM) },
      select: { tutar: true },
    }));
    expect(borclar.every((b) => b.tutar.toFixed(2) === '250.00')).toBe(true);

    // Eski hâline döndürülür: sonraki testler bu türü kullanıyor.
    await baglamda((tx) => tx.giderTuru.updateMany({
      where: { tenantId: T, kod: 'AIDAT' },
      data: { paylasimKurali: 'ESIT' },
    }));
  });

  it('(7) ★ TUKETIM ezmesi VERİSİZ reddedilir — eksik bölümler SAYILARAK', async () => {
    /*
     * `cariKontrolHesabi()` deseni: karşılığı yoksa TAHMİN ETME, dur ve çıkış
     * yolunu söyle. Tek tek değil LİSTE hâlinde: yönetici dört bölümü dört
     * denemede öğrenmemeli.
     */
    const y = await tahakkukCalistir({
      toplamTutar: '1000.00', donem: '2026-05-01', vadeTarihi: '2026-05-31',
      paylasimKurali: 'TUKETIM',
    });
    expect(y.status).toBe(422);
    const g = y.body as HataGovdesi;
    expect(g.detail).toMatch(/TUKETIM/);
    expect(g.sonrakiEylem ?? '').toMatch(/1, 2, 3, 4/);
  });

  it('(8) ★ KULLANIM_BAZLI ezmesi verisiz reddedilir', async () => {
    const y = await tahakkukCalistir({
      toplamTutar: '1000.00', donem: '2026-05-01', vadeTarihi: '2026-05-31',
      paylasimKurali: 'KULLANIM_BAZLI',
    });
    expect(y.status).toBe(422);
  });

  it('(9) ★ KARMA ezmesi HİÇ kabul edilmez — bileşen tanımı türe aittir', async () => {
    const y = await tahakkukCalistir({
      toplamTutar: '1000.00', donem: '2026-05-01', vadeTarihi: '2026-05-31',
      paylasimKurali: 'KARMA',
    });
    expect(y.status).toBe(422);
  });

  it('(10) BLOK_BAZLI ezmesi hedef blok verilirse KABUL edilir', async () => {
    const blok = await baglamda((tx) => tx.blok.findFirstOrThrow({
      where: { tenantId: T }, select: { id: true },
    }));
    const y = await tahakkukCalistir({
      toplamTutar: '800.00', donem: '2026-06-01', vadeTarihi: '2026-06-30',
      paylasimKurali: 'BLOK_BAZLI', hedefBlokId: blok.id,
    });
    expect(y.status).toBe(201);
  });

  // =====================================================================
  // C · MUHASEBELEŞTİRME (K2 · K3 · K5 · K6b)
  // =====================================================================

  const calismaId = async (donem: string): Promise<string> =>
    (await baglamda((tx) => tx.tahakkukCalismasi.findFirstOrThrow({
      where: { tenantId: T, donem: new Date(donem) }, select: { id: true },
    }))).id;

  it('(11) çalışma muhasebeleştirilir — TEK fiş, iki satır, DENK', async () => {
    const id = await calismaId(DONEM);
    const y = await request(sunucu())
      .post(`/api/v1/tahakkuk/calismalar/${id}/muhasebelestir`)
      .set(yetki()).set('Idempotency-Key', randomUUID()).send({});
    expect(y.status).toBe(201);

    const fis = await baglamda((tx) => tx.yevmiyeFisi.findFirstOrThrow({
      where: { tenantId: T, kaynakTipi: 'TAHAKKUK', kaynakId: id },
      select: { fisTuru: true, tarih: true, satirlar: { select: { hesapId: true, borc: true, alacak: true } } },
    }));
    expect(fis.satirlar).toHaveLength(2);
    const borcT = fis.satirlar.reduce((a, s) => a + Number(s.borc), 0);
    const alacakT = fis.satirlar.reduce((a, s) => a + Number(s.alacak), 0);
    expect(borcT).toBe(alacakT);
    expect(borcT).toBe(1000);
  });

  it('(12) borç tarafı CARI_KONTROL, alacak tarafı gider türünün hesabı', async () => {
    const id = await calismaId(DONEM);
    const fis = await baglamda((tx) => tx.yevmiyeFisi.findFirstOrThrow({
      where: { tenantId: T, kaynakTipi: 'TAHAKKUK', kaynakId: id },
      select: { satirlar: { select: { hesapId: true, borc: true, alacak: true } } },
    }));
    const borcSatiri = fis.satirlar.find((s) => Number(s.borc) > 0);
    const alacakSatiri = fis.satirlar.find((s) => Number(s.alacak) > 0);
    expect(borcSatiri?.hesapId).toBe(kimlik.hesap['120']);
    expect(alacakSatiri?.hesapId).toBe(kimlik.hesap['349']);
  });

  it('(13) fiş türü TAHAKKUK ve tarihi TAHAKKUK DÖNEMİ', async () => {
    /*
     * Vade seçilseydi gider ile karşılığı farklı döneme düşebilirdi.
     */
    const id = await calismaId(DONEM);
    const fis = await baglamda((tx) => tx.yevmiyeFisi.findFirstOrThrow({
      where: { tenantId: T, kaynakTipi: 'TAHAKKUK', kaynakId: id },
      select: { fisTuru: true, tarih: true },
    }));
    expect(fis.fisTuru).toBe('TAHAKKUK');
    expect(fis.tarih.toISOString().slice(0, 10)).toBe(DONEM);
  });

  it('(14) ★ MÜKERRER muhasebeleştirme reddedilir', async () => {
    const id = await calismaId(DONEM);
    const y = await request(sunucu())
      .post(`/api/v1/tahakkuk/calismalar/${id}/muhasebelestir`)
      .set(yetki()).set('Idempotency-Key', randomUUID()).send({});
    expect(y.status).toBe(422);
    expect((y.body as HataGovdesi).detail ?? '').toMatch(/zaten muhasebeleş/i);
  });

  it('(15) fiş bağı ÇALIŞMADA durur — Borc\'ta ayrı alan YOK (K6b)', async () => {
    /*
     * İki kaynak olsaydı biri güncellenmez ve sessizce yalan söylerdi.
     * Bir borcun muhasebeleşip muhasebeleşmediği çalışmasından TÜRETİLİR.
     */
    const id = await calismaId(DONEM);
    const c = await baglamda((tx) => tx.tahakkukCalismasi.findUniqueOrThrow({
      where: { id }, select: { yevmiyeFisiId: true },
    }));
    expect(c.yevmiyeFisiId).not.toBeNull();

    const sutunlar = await baglamda((tx) => tx.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'borc' AND column_name = 'yevmiye_fisi_id'`,
    ));
    expect(sutunlar).toHaveLength(0);
  });

  // =====================================================================
  // D · ★ BİTİŞİN TEK KANITI
  // =====================================================================

  it('(16) ★★ KONTROL MUTABAKATI — mutabikMi: true', async () => {
    /*
     * Bu test geçmeden ADR-0017 uygulanmış SAYILMAZ.
     *
     * Yardımcı defter (bölüm cari bakiyeleri toplamı) ile 120 kontrol hesabı
     * bakiyesi eşit olmalıdır. Tahakkuk deftere düşmediği sürece kontrol
     * hesabı 0 kalıyordu ve rapor HER projede false dönüyordu.
     */
    // Fişin deftere girmesi için işlenmesi gerekir; kalan çalışmalar da
    // muhasebeleştirilir ki yardımcı defterin tamamı karşılansın.
    const calismalar = await baglamda((tx) => tx.tahakkukCalismasi.findMany({
      where: { tenantId: T, yevmiyeFisiId: null }, select: { id: true },
    }));
    for (const c of calismalar) {
      const y = await request(sunucu())
        .post(`/api/v1/tahakkuk/calismalar/${c.id}/muhasebelestir`)
        .set(yetki()).set('Idempotency-Key', randomUUID())
        .send({ hemenIsle: true });
      expect(y.status).toBe(201);
    }
    await baglamda((tx) => tx.yevmiyeFisi.updateMany({
      where: { tenantId: T, kaynakTipi: 'TAHAKKUK' }, data: { durum: 'ISLENDI' },
    }));

    const y = await request(sunucu())
      .get('/api/v1/makbuzlar/rapor/kontrol-mutabakati').set(yetki());
    expect(y.status).toBe(200);
    const r = y.body as { mutabikMi: boolean; fark: string };
    expect(r.fark).toBe('0.0000');
    expect(r.mutabikMi).toBe(true);
  }, 60_000);
});
