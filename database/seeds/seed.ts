/**
 * Tohum verisi — Faz 0 dikey dilimi.
 *
 * İKİ tenant oluşturur. Bu kasıtlıdır: tenant izolasyon testinin
 * çalışabilmesi için en az iki apartman gerekir (sözleşme testi CT-01).
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Geliştirme şifresi: 'bnos1234'. Üretimde ASLA kullanılmaz.
 *
 * scrypt$N$r$p$tuz$ozet — SifreServisi ile aynı biçim (Node çekirdeği,
 * native bağımlılık yok). Bu özet üretilip doğrulanmıştır.
 */
const GELISTIRME_SIFRE_HASH =
  'scrypt$131072$8$1$06dAft8lIJHsbeHFYucc8Q==$9GdovR26bdPFcpXtV96jbzSTjTcywpYL/6gx4argmiuioNYMtEfo9FApnPK7FopBCy1xw+IJn78EIwJ+SJ0qiA==';

interface ApartmanTohumu {
  kod: string;
  ad: string;
  bolumler: { kapiNo: string; kat: number; m2: number; pay: bigint }[];
}

const APARTMANLAR: ApartmanTohumu[] = [
  {
    kod: 'guzel-apartmani',
    ad: 'Güzel Apartmanı',
    bolumler: [
      { kapiNo: '1', kat: 1, m2: 110, pay: 250_000n },
      { kapiNo: '2', kat: 1, m2: 110, pay: 250_000n },
      { kapiNo: '3', kat: 2, m2: 130, pay: 250_000n },
      { kapiNo: '4', kat: 2, m2: 130, pay: 250_000n },
    ],
  },
  {
    kod: 'yesil-vadi-apartmani',
    ad: 'Yeşil Vadi Apartmanı',
    bolumler: [
      { kapiNo: '1', kat: 1, m2: 95, pay: 500_000n },
      { kapiNo: '2', kat: 2, m2: 95, pay: 500_000n },
    ],
  },
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
const GIDER_TURLERI: {
  kod: string;
  ad: string;
  paylasimKurali: Prisma.GiderTuruCreateInput['paylasimKurali'];
  sorumlulukTipi: Prisma.GiderTuruCreateInput['sorumlulukTipi'];
}[] = [
  // md. 20/a — kapıcı, kaloriferci, bahçıvan, bekçi giderleri: EŞİT olarak.
  { kod: 'KAPICI', ad: 'Kapıcı gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT' },
  // md. 20/b — anagayrimenkulün sigortası, bakımı, korunması: ARSA PAYI oranında.
  { kod: 'ANA_BAKIM', ad: 'Anagayrimenkul bakım ve onarım', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT' },
  { kod: 'SIGORTA', ad: 'Bina sigortası', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT' },
  // Yenileme fonu md. 72 — anagayrimenkule yapılan yatırımdır, malike aittir.
  { kod: 'YENILEME_FONU', ad: 'Yenileme fonu', paylasimKurali: 'ARSA_PAYI', sorumlulukTipi: 'MALIKE_AIT' },
  // Isınma tüketime bağlıdır (5627 sayılı Enerji Verimliliği Kanunu md. 7/c);
  // paylaşım kuralı TUKETIM'dir ve sayaç okuması olmadan hesaplanamaz.
  { kod: 'ISITMA', ad: 'Isıtma gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT' },
  { kod: 'SU', ad: 'Su gideri', paylasimKurali: 'TUKETIM', sorumlulukTipi: 'KULLANANA_AIT' },
  { kod: 'ASANSOR_ISLETME', ad: 'Asansör işletme gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT' },
  { kod: 'ELEKTRIK_ORTAK', ad: 'Ortak alan elektriği', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT' },
  { kod: 'TEMIZLIK', ad: 'Temizlik gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT' },
  { kod: 'YONETIM', ad: 'Yönetim gideri', paylasimKurali: 'ESIT', sorumlulukTipi: 'KULLANANA_AIT' },
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
  for (const g of GIDER_TURLERI) {
    await prisma.giderTuru.create({
      data: {
        id: randomUUID(), tenantId, kod: g.kod, ad: g.ad,
        paylasimKurali: g.paylasimKurali, sorumlulukTipi: g.sorumlulukTipi,
        kuralKaynagi: 'KMK_VARSAYILAN', malikPaylasimi: 'HISSE_ORANI',
      },
    });
  }

  for (const b of t.bolumler) {
    const bolumId = randomUUID();
    const malikId = randomUUID();

    await prisma.kisi.create({
      data: {
        id: malikId, tenantId,
        ad: `Malik${b.kapiNo}`, soyad: t.kod.split('-')[0] ?? 'Test',
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
  }

  console.log(`  ${t.ad}  (1 blok · ${katNolari.length} kat · ${t.bolumler.length} bağımsız bölüm)`);
  console.log(`     giriş: yonetici@${t.kod}.test / bnos1234`);
  return tenantId;
}

async function main(): Promise<void> {
  console.log('BNOS Apartman — tohum verisi yükleniyor\n');

  const mevcut = await prisma.tenant.count();
  if (mevcut > 0) {
    console.log(`Veritabanında zaten ${mevcut} apartman var. Önce "pnpm db:reset" çalıştırın.`);
    return;
  }

  const idler: string[] = [];
  for (const a of APARTMANLAR) idler.push(await apartmanOlustur(a));

  console.log('\nİki apartman kasıtlı olarak oluşturuldu:');
  console.log('tenant izolasyon testi (CT-01) en az iki tenant gerektirir.');
  console.log(`\n  ${idler[0]}\n  ${idler[1]}\n`);
}

main()
  .catch((h: unknown) => {
    console.error('Tohum verisi yüklenemedi:', h);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
