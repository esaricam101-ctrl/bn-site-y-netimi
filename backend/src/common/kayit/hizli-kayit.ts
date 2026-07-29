/**
 * Hızlı kayıt yardımcıları — kişi çözümleme ve plaka yazımı.
 *
 * Malik · kiracı · sakin · misafir · daire görevlisi eklerken kişi bilgileri
 * tek ekrandan girilir. Bu dosya o akışın iki ortak parçasını taşır:
 *   1. `kisiyiCoz` — mevcut kişiyi bulur ya da yenisini oluşturur.
 *   2. `plakalariYaz` — girilen plakaları tek araç kütüğüne yazar.
 *
 * Her ikisi de ÇAĞIRANIN TRANSACTION'I İÇİNDE çalışır (`tx` parametresi):
 * kişi oluşup ilişki kaydı hata verirse ortada sahipsiz bir `Kisi` satırı
 * kalmamalıdır.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { takvimTarihi, type TakvimTarihi } from '@bnos/kernel';
import { DogrulamaHatasi, IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { aracKaydiniDogrula, plakayiDogrula, type Arac } from '@bnos/apartman-domain';
import type { KisiGirdisiDto, PlakaGirdisiDto } from './kisi-girdisi.dto';

/**
 * Tek ekrandan hızlı kayıt sonucu.
 *
 * `kisiId` ve `kisiOlusturulduMu` yanıtta DÖNER: kullanıcı yeni kişi
 * girdiğini sanırken TC eşleşmesi nedeniyle mevcut bir kayda bağlanmış
 * olabilir. Hangi kişiye bağlandığını görmezse mükerrer sandığı kaydı
 * silmeye çalışır.
 */
export interface HizliKayitSonucu {
  readonly id: string;
  readonly durum: string;
  readonly kisiId: string;
  readonly kisiOlusturulduMu: boolean;
  readonly tcIleEslestiMi: boolean;
  readonly plakaSayisi: number;
}

export interface KisiCozumu {
  readonly kisiId: string;
  /** Yeni `Kisi` satırı açıldı mı — yanıtta kullanıcıya bildirilir. */
  readonly olusturulduMu: boolean;
  /**
   * Mevcut kişi TC kimlik numarasıyla eşleşerek bulunduysa doğrudur.
   * Kullanıcı yeni kişi girdiğini sanıyordu; hangi kaydın kullanıldığını
   * görmesi gerekir.
   */
  readonly tcIleEslestiMi: boolean;
}

function metin(deger: string | undefined): string | null {
  const kirpik = deger?.trim();
  return kirpik === undefined || kirpik === '' ? null : kirpik;
}

/**
 * E-postayı kullanan kişiyi döndürür.
 *
 * `kisi_eposta_uq` TENANT GENELİNDE tekildir. Bu yüzden e-posta, TC kimlik
 * numarası gibi bir KİMLİK ANAHTARIDIR: aynı e-postayla ikinci kişi kaydı
 * açılamaz. Denetim burada yapılmazsa veritabanı kısıtı 500 olarak döner ve
 * kullanıcı ne olduğunu anlamaz.
 */
async function epostaSahibi(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eposta: string,
): Promise<{ readonly id: string; readonly ad: string; readonly soyad: string } | null> {
  return tx.kisi.findFirst({
    where: { tenantId, eposta, silinmeTarihi: null },
    select: { id: true, ad: true, soyad: true },
  });
}

/**
 * Kişiyi bulur ya da oluşturur.
 *
 * SIRA:
 *   1. `kisiId` verildiyse o kişi kullanılır; diğer alanlar YOK SAYILIR.
 *   2. TC kimlik no verildiyse aynı numaralı MEVCUT kişi aranır ve varsa
 *      KULLANILIR — yeni satır açılmaz.
 *   3. Aksi hâlde yeni kişi oluşturulur.
 *
 * ⚠️  2. adım kritiktir. `kisiId` zorunluluğunun asıl işlevi mükerrer kimlik
 *     kaydını engellemekti. Aynı kişi iki `Kisi` satırına bölünürse borç
 *     geçmişi, tahakkuk sorumluluğu ve KVKK silme talebi iki kayda dağılır;
 *     "Ayşe Yılmaz'ın borcu" sorusunun tek bir cevabı kalmaz.
 *
 * ⚠️  Mevcut kişi bulunduğunda YALNIZCA BOŞ alanlar doldurulur. Dolu bir
 *     alanın üzerine yazmak, kiracı eklerken malikin telefonunu değiştirmek
 *     gibi görünmez veri kayıplarına yol açardı. Düzeltme `PATCH /kisiler/:id`
 *     ile yapılır.
 */
export async function kisiyiCoz(
  tx: Prisma.TransactionClient,
  tenantId: string,
  girdi: KisiGirdisiDto,
): Promise<KisiCozumu> {
  if (girdi.kisiId !== undefined) {
    // Soft delete uzantısı istemciye bağlı DEĞİL (bkz. SESSION_SUMMARY);
    // silinmişleri elemek AÇIKÇA yapılır.
    const mevcut = await tx.kisi.findFirst({
      where: { id: girdi.kisiId, tenantId, silinmeTarihi: null },
      select: { id: true },
    });
    if (!mevcut) throw new KayitBulunamadi(`Kişi bulunamadı: ${girdi.kisiId}`);
    return { kisiId: mevcut.id, olusturulduMu: false, tcIleEslestiMi: false };
  }

  const ad = metin(girdi.ad);
  const soyad = metin(girdi.soyad);
  if (ad === null || soyad === null) {
    throw new DogrulamaHatasi(
      'Kişi seçilmediyse ad ve soyad zorunludur.',
      'Ya mevcut bir kişi seçin ya da ad ve soyad girin.',
    );
  }

  const eposta = metin(girdi.eposta)?.toLowerCase() ?? null;

  if (girdi.tcKimlikNo !== undefined) {
    const ayniTc = await tx.kisi.findFirst({
      where: { tenantId, tcKimlikNo: girdi.tcKimlikNo, silinmeTarihi: null },
      select: {
        id: true, telefon: true, eposta: true, dogumTarihi: true,
        adres: true, notlar: true,
      },
    });
    if (ayniTc) {
      // E-posta doldurulacaksa önce SAHİBİ denetlenir. `kisi_eposta_uq` tenant
      // genelinde tekildir; başka birinin e-postasını buraya yazmak veritabanı
      // kısıtını ihlal eder ve 500 üretirdi. Sessizce atlamak da yanlış olurdu:
      // kullanıcı e-postayı girdiğini sanıp kayda geçmediğini görmezdi.
      if (eposta !== null && ayniTc.eposta === null) {
        const sahip = await epostaSahibi(tx, tenantId, eposta);
        if (sahip && sahip.id !== ayniTc.id) {
          throw new IsKuraliIhlali(
            `'${eposta}' e-posta adresi başka bir kişiye kayıtlı: ` +
              `${sahip.ad} ${sahip.soyad}.`,
            'E-posta alanını boş bırakın ya da farklı bir adres girin.',
          );
        }
      }

      // Yalnızca BOŞ alanları doldur.
      const doldur: Prisma.KisiUpdateInput = {
        ...(ayniTc.telefon === null && metin(girdi.telefon) !== null
          ? { telefon: metin(girdi.telefon) }
          : {}),
        ...(ayniTc.eposta === null && eposta !== null ? { eposta } : {}),
        ...(ayniTc.dogumTarihi === null && girdi.dogumTarihi !== undefined
          ? { dogumTarihi: new Date(takvimTarihi(girdi.dogumTarihi)) }
          : {}),
        ...(ayniTc.adres === null && metin(girdi.adres) !== null
          ? { adres: metin(girdi.adres) }
          : {}),
        ...(ayniTc.notlar === null && metin(girdi.notlar) !== null
          ? { notlar: metin(girdi.notlar) }
          : {}),
      };
      if (Object.keys(doldur).length > 0) {
        await tx.kisi.update({ where: { id: ayniTc.id }, data: doldur });
      }
      return { kisiId: ayniTc.id, olusturulduMu: false, tcIleEslestiMi: true };
    }
  }

  // TC eşleşmesi yoksa E-POSTA ikinci kimlik anahtarıdır: `kisi_eposta_uq`
  // tenant genelinde tekil olduğu için aynı adresle ikinci kişi zaten
  // açılamaz. Hata vermek yerine o kişiyi KULLANMAK doğrudur — TC ile aynı
  // gerekçe: kimliği ikiye bölmek borç geçmişini de böler.
  if (eposta !== null) {
    const sahip = await epostaSahibi(tx, tenantId, eposta);
    if (sahip) {
      return { kisiId: sahip.id, olusturulduMu: false, tcIleEslestiMi: false };
    }
  }

  const id = randomUUID();
  await tx.kisi.create({
    data: {
      id,
      tenantId,
      ad,
      soyad,
      tcKimlikNo: girdi.tcKimlikNo ?? null,
      telefon: metin(girdi.telefon),
      eposta,
      dogumTarihi:
        girdi.dogumTarihi === undefined
          ? null
          : new Date(takvimTarihi(girdi.dogumTarihi)),
      cinsiyet: girdi.cinsiyet ?? 'BELIRTILMEMIS',
      adres: metin(girdi.adres),
      notlar: metin(girdi.notlar),
    },
  });

  return { kisiId: id, olusturulduMu: true, tcIleEslestiMi: false };
}

/**
 * Aracın sahibi. TAM OLARAK BİRİ verilmelidir; `arac_tek_sahip` kısıtı
 * veritabanı düzeyinde de bunu zorlar.
 */
export interface AracSahibi {
  readonly kisiId?: string;
  readonly gorevliId?: string;
  readonly personelId?: string;
  readonly misafirId?: string;
}

export interface PlakaYazimIstegi {
  /**
   * Aracın kayıtlı olduğu bağımsız bölüm. SİTE PERSONELİNDE `null` verilir:
   * personel aracı yönetime kayıtlıdır, bir daireye değil (`arac_kapsam`).
   */
  readonly bolumId: string | null;
  readonly sahip: AracSahibi;
  readonly baslangic: TakvimTarihi;
  /** Görevli/misafir gibi süreli kayıtlarda araç da o tarihte kapanır. */
  readonly bitis?: TakvimTarihi | null;
  readonly plakalar: readonly PlakaGirdisiDto[];
}

/**
 * Girilen plakaları araç kütüğüne yazar.
 *
 * MÜKERRER PLAKA REDDEDİLİR — hem veritabanındaki mevcut kayıtlara hem AYNI
 * FORMDA iki kez yazılan plakaya karşı. Mükerrer plaka, bir aracın iki
 * daireye sayılması ve KULLANIM_BAZLI otopark giderinin fazla dağıtılması
 * demektir; bu yüzden yeni oluşturulanlar da denetim listesine eklenir.
 */
export async function plakalariYaz(
  tx: Prisma.TransactionClient,
  tenantId: string,
  istek: PlakaYazimIstegi,
): Promise<readonly string[]> {
  if (istek.plakalar.length === 0) return [];

  const sahipAlanSayisi = [
    istek.sahip.kisiId, istek.sahip.gorevliId,
    istek.sahip.personelId, istek.sahip.misafirId,
  ].filter((d) => d !== undefined).length;
  if (sahipAlanSayisi !== 1) {
    throw new DogrulamaHatasi(
      `Araç kaydında tam olarak bir sahip olmalıdır (verilen: ${sahipAlanSayisi}).`,
    );
  }

  // Kapsam kuralı (`arac_kapsam`): personel aracı yönetime, diğerleri bölüme.
  // Veritabanı kısıtı da bunu zorlar; burada durması hata mesajını anlaşılır
  // kılar — CHECK ihlali "23514" olarak dönerdi.
  const personelAraci = istek.sahip.personelId !== undefined;
  if (personelAraci && istek.bolumId !== null) {
    throw new DogrulamaHatasi(
      'Site personeli aracı yönetime kayıtlıdır, bir bağımsız bölüme yazılamaz.',
      'Bölüm bilgisini boş bırakın.',
    );
  }
  if (!personelAraci && istek.bolumId === null) {
    throw new DogrulamaHatasi(
      'Bu araç bir bağımsız bölüme kayıtlı olmalıdır.',
      'Bölüm seçin.',
    );
  }

  const normalPlakalar = istek.plakalar.map((p) => ({
    ...p,
    plaka: plakayiDogrula(p.plaka),
  }));

  // Aynı plakanın tenant içindeki mevcut kayıtları — çakışma denetimi bunlara
  // bakar. `bolumId` ile daraltılmaz: plaka tenant genelinde tekil olmalıdır,
  // yoksa aynı araç iki farklı daireye kayıtlı görünür.
  const mevcutlar = await tx.arac.findMany({
    where: { tenantId, plaka: { in: normalPlakalar.map((p) => p.plaka) } },
    select: {
      id: true, bolumId: true, kisiId: true, plaka: true, tur: true,
      marka: true, model: true, renk: true, otoparkYeri: true,
      baslangic: true, bitis: true,
    },
  });

  const gun = (d: Date): TakvimTarihi => takvimTarihi(d.toISOString().slice(0, 10));
  const denetimListesi: Arac[] = mevcutlar.map((m) => ({
    id: m.id, bolumId: m.bolumId, kisiId: m.kisiId, plaka: m.plaka,
    tur: m.tur, marka: m.marka, model: m.model, renk: m.renk,
    otoparkYeri: m.otoparkYeri,
    baslangic: gun(m.baslangic),
    bitis: m.bitis === null ? null : gun(m.bitis),
  }));

  const olusanlar: string[] = [];
  for (const p of normalPlakalar) {
    const id = randomUUID();
    const yeni: Arac = {
      id,
      bolumId: istek.bolumId,
      kisiId: istek.sahip.kisiId ?? null,
      gorevliId: istek.sahip.gorevliId ?? null,
      personelId: istek.sahip.personelId ?? null,
      misafirId: istek.sahip.misafirId ?? null,
      plaka: p.plaka,
      tur: p.tur ?? 'OTOMOBIL',
      marka: metin(p.marka),
      model: metin(p.model),
      renk: metin(p.renk),
      otoparkYeri: metin(p.otoparkYeri),
      baslangic: istek.baslangic,
      bitis: istek.bitis ?? null,
    };

    aracKaydiniDogrula(denetimListesi, yeni);

    await tx.arac.create({
      data: {
        id,
        tenantId,
        bolumId: istek.bolumId ?? null,
        kisiId: istek.sahip.kisiId ?? null,
        gorevliId: istek.sahip.gorevliId ?? null,
        personelId: istek.sahip.personelId ?? null,
        misafirId: istek.sahip.misafirId ?? null,
        plaka: p.plaka,
        tur: p.tur ?? 'OTOMOBIL',
        marka: metin(p.marka),
        model: metin(p.model),
        renk: metin(p.renk),
        otoparkYeri: metin(p.otoparkYeri),
        baslangic: new Date(istek.baslangic),
        bitis: istek.bitis === undefined || istek.bitis === null
          ? null
          : new Date(istek.bitis),
      },
    });

    // Aynı formda ikinci kez yazılan plaka da yakalanmalı.
    denetimListesi.push(yeni);
    olusanlar.push(id);
  }

  return olusanlar;
}
