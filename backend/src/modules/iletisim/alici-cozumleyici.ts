/**
 * ALICI ÇÖZÜMLEYİCİ — hedef tanımından kişi/numara listesi üretir.
 *
 * ⚠️  TEK YERDE. WhatsApp ve SMS için ayrı yazılsaydı "blok bazlı duyuru"
 *     mantığı iki yerde durur ve biri düzeltildiğinde öteki SESSİZCE eski
 *     davranmaya devam ederdi.
 *
 * ⚠️  DAİRE GÖREVLİSİ BİR `Kisi` DEĞİLDİR (0010). Kendi ad/telefon alanlarını
 *     taşır ve `kisi` tablosuna bağlı değildir; bu yüzden `kisiId` boş döner
 *     ve izin denetimi (kişiye bağlı) onun için uygulanamaz — bu durum
 *     çağırana açıkça bildirilir.
 */
import type { Prisma } from '@prisma/client';

export type HedefTipi =
  | 'TUM_SITE' | 'BLOK' | 'KAT' | 'DAIRE'
  | 'MALIK' | 'KIRACI' | 'SAKIN' | 'DAIRE_GOREVLISI' | 'YONETIM_KURULU'
  | 'KISILER' | 'GRUP';

export interface Alici {
  readonly kisiId: string | null;
  readonly ad: string;
  /** Ham numara — normalizasyon çağıranda yapılır. */
  readonly telefon: string | null;
  readonly whatsappNo: string | null;
  readonly bolumId: string | null;
}

/** Kişi kayıtlarını alıcıya çevirir (tekilleştirme çağıranda). */
function kisidenAlici(
  k: { id: string; ad: string; soyad: string; telefon: string | null; whatsappNo: string | null },
  bolumId: string | null,
): Alici {
  return {
    kisiId: k.id,
    ad: `${k.ad} ${k.soyad}`,
    telefon: k.telefon,
    whatsappNo: k.whatsappNo,
    bolumId,
  };
}

/**
 * Hedefi alıcılara çözer.
 *
 * ⚠️  TEKİLLEŞTİRME ZORUNLU. Aynı kişi hem malik hem sakin olabilir; hem
 *     "Tüm Site" hem "Malikler" hedefinde iki kez görünürse aynı duyuruyu iki
 *     kez alır ve iki kontör düşer.
 */
export async function aliciCozumle(
  tx: Prisma.TransactionClient,
  tenantId: string,
  hedefTipi: HedefTipi,
  referans: Readonly<Record<string, unknown>>,
): Promise<{ readonly alicilar: readonly Alici[]; readonly uyari: string | null }> {
  const bolumSuzgeci = await bolumSuzgeciKur(tx, tenantId, hedefTipi, referans);

  if (hedefTipi === 'GRUP') {
    // ⚠️ GRUP KAVRAMI SİSTEMDE YOK. Boş liste dönmek sessiz başarısızlık
    //    olurdu: kullanıcı gönderdiğini sanır, kimse mesaj almaz.
    throw new Error(
      'GRUP hedefi desteklenmiyor: sistemde kişi grubu kavramı tanımlı değil. ' +
        'Belirli kişileri seçin (KISILER) ya da blok/kat/daire hedefi kullanın.',
    );
  }

  if (hedefTipi === 'KISILER') {
    const idler = Array.isArray(referans['kisiIdler'])
      ? (referans['kisiIdler'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    if (idler.length === 0) {
      throw new Error('KISILER hedefi için en az bir kişi seçilmelidir.');
    }
    const kisiler = await tx.kisi.findMany({
      where: { id: { in: idler }, tenantId, silinmeTarihi: null },
      select: { id: true, ad: true, soyad: true, telefon: true, whatsappNo: true },
    });
    return {
      alicilar: kisiler.map((k) => kisidenAlici(k, null)),
      uyari: kisiler.length < idler.length
        ? `${idler.length - kisiler.length} kişi bulunamadı ya da arşivlenmiş.`
        : null,
    };
  }

  if (hedefTipi === 'DAIRE_GOREVLISI') {
    const gorevliler = await tx.daireGorevlisi.findMany({
      where: {
        tenantId, silinmeTarihi: null,
        // Kopyalanmadan verilirse Prisma `readonly` diziyi kabul etmez.
        ...(bolumSuzgeci === null ? {} : { bolumId: { in: [...bolumSuzgeci] } }),
      },
      select: {
        id: true, ad: true, soyad: true, telefon: true, whatsappNo: true, bolumId: true,
      },
    });
    return {
      alicilar: gorevliler.map((g) => ({
        // Daire görevlisi bir `Kisi` DEĞİLDİR; izin kaydı kişiye bağlı olduğu
        // için onun adına izin denetimi yapılamaz.
        kisiId: null,
        ad: `${g.ad} ${g.soyad}`,
        telefon: g.telefon,
        whatsappNo: g.whatsappNo,
        bolumId: g.bolumId,
      })),
      uyari: gorevliler.length === 0
        ? null
        : 'Daire görevlileri `Kisi` kaydı olmadığı için İYS izin denetimine ' +
          'tabi tutulamaz; yalnızca BİLGİLENDİRME gönderin.',
    };
  }

  if (hedefTipi === 'YONETIM_KURULU') {
    const roller = await tx.kullaniciRolu.findMany({
      where: { tenantId, rolKodu: { in: ['YK_BASKANI', 'YK_UYESI'] } },
      select: {
        kullanici: {
          select: {
            kisi: {
              select: { id: true, ad: true, soyad: true, telefon: true, whatsappNo: true },
            },
          },
        },
      },
    });
    const kisiler = roller
      .map((r) => r.kullanici.kisi)
      .filter((k): k is NonNullable<typeof k> => k !== null);
    return { alicilar: kisiler.map((k) => kisidenAlici(k, null)), uyari: null };
  }

  // Rol bazlı hedefler (MALIK · KIRACI · SAKIN) ve yerleşke hedefleri
  // (TUM_SITE · BLOK · KAT · DAIRE) aynı sorgu iskeletini kullanır: ikisi de
  // "şu bölümlerdeki şu roldeki kişiler"dir.
  const roller: readonly ('MALIK' | 'KIRACI' | 'SAKIN')[] =
    hedefTipi === 'MALIK' ? ['MALIK']
      : hedefTipi === 'KIRACI' ? ['KIRACI']
        : hedefTipi === 'SAKIN' ? ['SAKIN']
          : ['MALIK', 'KIRACI', 'SAKIN'];

  /*
   * ⚠️  MALİK · KİRACI · SAKİN SOFT DELETE TAŞIMAZ. Bunlar İLİŞKİ
   *     kayıtlarıdır ve "artık geçerli değil" bilgisi kendi BİTİŞ
   *     alanlarındadır: `tapuBitis` · `bitis` · `cikisTarihi`.
   *
   *     İlk yazımda hepsine `silinmeTarihi: null` konmuştu ve sorgu çalışma
   *     zamanında patladı (canlı testte yakalandı). Ama asıl mesele tip hatası
   *     değil ANLAM: bu alan doğru kabul edilseydi bile TAŞINMIŞ KİRACIYA
   *     duyuru gitmeye devam ederdi — evinden çıkmış birine "aidat borcunuz
   *     var" mesajı, hem yanlış hem KVKK açısından sorunludur.
   *
   *     Bitiş tarihi GELECEKTE olan ilişki hâlâ geçerlidir (ör. sözleşmesi
   *     ay sonunda bitecek kiracı); bu yüzden `null` VEYA `>= bugün` aranır.
   */
  const bugun = new Date(new Date().toISOString().slice(0, 10));
  const bolumKosulu = bolumSuzgeci === null
    ? {} : { bolumId: { in: [...bolumSuzgeci] } };
  const surenIliski = { OR: [{ bitis: null }, { bitis: { gte: bugun } }] };
  // Select NESNESİ PAYLAŞILMAZ: Prisma dönüş tipini `select` literalinden
  // türetir; ortak bir değişkene alınınca tip genişler ve `k.kisi` "yok"
  // görünür. Bu yüzden her sorguda inline yazılır.
  const kisiSecimi = {
    id: true, ad: true, soyad: true, telefon: true, whatsappNo: true,
  } as const;

  const toplanan: Alici[] = [];
  if (roller.includes('MALIK')) {
    // Malikte bitiş alanı `tapuBitis`tir: tapusu devredilmiş eski malik
    // duyuru almaz.
    const kayitlar = await tx.malik.findMany({
      where: {
        tenantId, ...bolumKosulu,
        OR: [{ tapuBitis: null }, { tapuBitis: { gte: bugun } }],
      },
      select: { bolumId: true, kisi: { select: kisiSecimi } },
    });
    toplanan.push(...kayitlar.map((k) => kisidenAlici(k.kisi, k.bolumId)));
  }
  if (roller.includes('KIRACI')) {
    const kayitlar = await tx.kiraci.findMany({
      where: { tenantId, ...bolumKosulu, ...surenIliski },
      select: { bolumId: true, kisi: { select: kisiSecimi } },
    });
    toplanan.push(...kayitlar.map((k) => kisidenAlici(k.kisi, k.bolumId)));
  }
  if (roller.includes('SAKIN')) {
    // Sakinde bitiş alanı `cikisTarihi`dir.
    const kayitlar = await tx.sakin.findMany({
      where: {
        tenantId, ...bolumKosulu,
        OR: [{ cikisTarihi: null }, { cikisTarihi: { gte: bugun } }],
      },
      select: { bolumId: true, kisi: { select: kisiSecimi } },
    });
    toplanan.push(...kayitlar.map((k) => kisidenAlici(k.kisi, k.bolumId)));
  }

  // TEKİLLEŞTİRME — aynı kişi hem malik hem sakin olabilir.
  const harita = new Map<string, Alici>();
  for (const a of toplanan) {
    if (a.kisiId === null) continue;
    if (!harita.has(a.kisiId)) harita.set(a.kisiId, a);
  }

  return {
    alicilar: [...harita.values()],
    uyari: toplanan.length > harita.size
      ? `${toplanan.length - harita.size} mükerrer alıcı tekilleştirildi ` +
        '(aynı kişi birden çok rolde).'
      : null,
  };
}

/**
 * Hedefe göre bölüm kimlikleri. `null` = bölüm süzgeci yok (tüm site).
 *
 * BLOK ve KAT hedefleri hiyerarşiden çözülür (ADR-0008: Apartman → Blok →
 * Kat → BagimsizBolum).
 */
async function bolumSuzgeciKur(
  tx: Prisma.TransactionClient,
  tenantId: string,
  hedefTipi: HedefTipi,
  referans: Readonly<Record<string, unknown>>,
): Promise<readonly string[] | null> {
  const id = typeof referans['id'] === 'string' ? referans['id'] : null;

  if (hedefTipi === 'DAIRE') {
    if (id === null) throw new Error('DAIRE hedefi için bölüm kimliği gerekir.');
    return [id];
  }
  if (hedefTipi === 'KAT') {
    if (id === null) throw new Error('KAT hedefi için kat kimliği gerekir.');
    const bolumler = await tx.bagimsizBolum.findMany({
      where: { tenantId, katId: id, silinmeTarihi: null },
      select: { id: true },
    });
    if (bolumler.length === 0) throw new Error('Bu katta bağımsız bölüm yok.');
    return bolumler.map((b) => b.id);
  }
  if (hedefTipi === 'BLOK') {
    if (id === null) throw new Error('BLOK hedefi için blok kimliği gerekir.');
    // `blokId` bağımsız bölümde DOĞRUDAN durur; kat üzerinden dolaşmaya gerek
    // yok. (`kat` bir Int alanıdır — kat NUMARASI, ilişki değil.)
    const bolumler = await tx.bagimsizBolum.findMany({
      where: { tenantId, blokId: id, silinmeTarihi: null },
      select: { id: true },
    });
    if (bolumler.length === 0) throw new Error('Bu blokta bağımsız bölüm yok.');
    return bolumler.map((b) => b.id);
  }
  return null;
}
