/**
 * Belge servisi — BFS v1 §5 silme standardı ile hizalı.
 *
 * BELGE SİLİNMEZ, VERSİYONLANIR. Yeni sürüm eskisini geçersiz kılar ama yok
 * etmez: "hangi yönetim planına göre karar verildi?" sorusunun cevabı eski
 * sürümdedir.
 *
 * Dosyanın kendisi nesne deposundadır; burada yalnızca üstveri ve anahtar
 * tutulur. Yükleme iki adımlıdır (önimzalı URL → kayıt) ve kayıt açılmadan
 * önce nesnenin GERÇEKTEN yüklendiği doğrulanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IZINLER, IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  etiketNormalle, etiketiDogrula, gecerliligiDolanlar, gizliligiDogrula,
  silinebilirMi, yeniSurumuDogrula,
  type Belge, type BelgeTipiPolitikasi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { NesneDeposuServisi } from '../../common/storage/nesne-deposu.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type {
  BelgeKaydetDto, PolitikaGuncelleDto, YeniSurumDto, YuklemeIzniDto,
} from './dto/belge.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface BelgeIliskiSatiri {
  readonly varlikTipi: string;
  readonly varlikId: string | null;
  readonly birincilMi: boolean;
}

export interface BelgeSatiri {
  readonly id: string;
  readonly tip: string;
  /** Türün kategorisi — dosyalama düzeyi. */
  readonly kategori: string;
  readonly kapsam: string;
  readonly hedefId: string | null;
  readonly ad: string;
  readonly notlar: string | null;
  readonly gizlilik: string;
  readonly surum: number;
  readonly oncekiSurumId: string | null;
  readonly belgeTarihi: string;
  readonly gecerlilikBitisi: string | null;
  readonly dosyaBoyutu: number;
  readonly icerikTipi: string;
  readonly arsivMi: boolean;
  readonly etiketler: readonly string[];
  readonly iliskiler: readonly BelgeIliskiSatiri[];
  /** Tarayıcıda açılabilir mi — HTML/SVG asla önizlenmez. */
  readonly onizlenebilirMi: boolean;
  /** Dosya KVKK kapsamında imha edildi mi; üstveri kanıt olarak durur. */
  readonly dosyaImhaEdildiMi: boolean;
  /** Geçerliliği bugün itibarıyla dolmuş mu — poliçe/ruhsat takibi için. */
  readonly gecerliligiDolduMu: boolean;
  readonly silinebilirMi: boolean;
  readonly silinemezNedeni: string;
}

/** Listeleme süzgeci. Hepsi isteğe bağlıdır ve VE ile birleşir. */
export interface BelgeSuzgeci {
  readonly kapsam?: string;
  readonly hedefId?: string;
  readonly tip?: string;
  readonly kategori?: string;
  readonly etiket?: string;
  /** `ad` ve `notlar` içinde Türkçe duyarlı arama. */
  readonly arama?: string;
  readonly tarihBaslangic?: string;
  readonly tarihBitis?: string;
  readonly arsiviDahilEt?: boolean;
  readonly silinmisleriDahilEt?: boolean;
}

export interface PolitikaSatiri {
  readonly tip: string;
  readonly kategori: string;
  readonly varsayilanGizlilik: string;
  readonly saklamaYili: number | null;
  readonly finansalMi: boolean;
  readonly kaynakReferansi: string | null;
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

interface BelgeKaydi {
  id: string; tip: string; kapsam: string; hedefId: string | null;
  ad: string; surum: number; oncekiSurumId: string | null;
  belgeTarihi: Date; gecerlilikBitisi: Date | null;
  dosyaAnahtari: string; dosyaBoyutu: number; icerikTipi: string;
  arsivMi: boolean;
}

function domaine(k: BelgeKaydi): Belge {
  return {
    id: k.id,
    tip: k.tip as Belge['tip'],
    kapsam: k.kapsam as Belge['kapsam'],
    hedefId: k.hedefId,
    ad: k.ad,
    surum: k.surum,
    oncekiSurumId: k.oncekiSurumId,
    belgeTarihi: gun(k.belgeTarihi),
    gecerlilikBitisi: k.gecerlilikBitisi === null ? null : gun(k.gecerlilikBitisi),
    dosyaAnahtari: k.dosyaAnahtari,
    dosyaBoyutu: k.dosyaBoyutu,
    icerikTipi: k.icerikTipi,
    arsivMi: k.arsivMi,
  };
}

@Injectable()
export class BelgeServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly depo: NesneDeposuServisi,
  ) {}

  // ------------------------------------------------------------- politika

  private async politikalar(
    tx: Parameters<Parameters<PrismaService['tenantIslemi']>[0]>[0],
    principal: Principal,
  ): Promise<readonly BelgeTipiPolitikasi[]> {
    const kayitlar = await tx.belgeTipiPolitikasi.findMany({
      where: { tenantId: principal.tenantId },
    });
    // Prisma enum'u domain birlik tipiyle BIREBIR ortusur (migration 0006);
    // donusum gerekmez.
    //
    // `kategori` ve `varsayilanGizlilik` DE ESLENIR: atlandiginda cagiran
    // `p?.kategori ?? 'KURUMSAL'` geri dususune duser ve HER belge KURUMSAL
    // gorunur — kategori suzgeci sessizce yanlis sonuc verir.
    return kayitlar.map((p) => ({
      tip: p.tip,
      kategori: p.kategori,
      varsayilanGizlilik: p.varsayilanGizlilik,
      saklamaYili: p.saklamaYili,
      finansalMi: p.finansalMi,
      kaynakReferansi: p.kaynakReferansi,
    }));
  }

  async politikalariListele(principal: Principal): Promise<readonly PolitikaSatiri[]> {
    return this.prisma.tenantIslemi(
      async (tx) => {
        const p = await this.politikalar(tx, principal);
        return p.map((x) => ({
          tip: x.tip,
          kategori: x.kategori ?? 'KURUMSAL',
          varsayilanGizlilik: x.varsayilanGizlilik ?? 'YONETIM',
          saklamaYili: x.saklamaYili,
          finansalMi: x.finansalMi,
          kaynakReferansi: x.kaynakReferansi,
        }));
      },
      principal.tenantId,
    );
  }

  /**
   * Saklama süresi değiştirilir; `finansalMi` DEĞİŞTİRİLEMEZ.
   *
   * Finansal sınıf bir mevzuat sonucudur (VUK md. 253), yönetim tercihi
   * değil. Kapatılabilseydi bir yönetici faturaları silinebilir hale
   * getirip mali denetim izini yok edebilirdi.
   */
  async politikaGuncelle(
    tip: string, dto: PolitikaGuncelleDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.politika');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.belgeTipiPolitikasi.findFirst({
        where: { tenantId: principal.tenantId, tip: tip as never },
      });
      if (!kayit) throw new KayitBulunamadi(`Belge politikası bulunamadı: ${tip}`);

      await tx.belgeTipiPolitikasi.update({
        where: { id: kayit.id },
        data: {
          saklamaYili: dto.saklamaYili ?? null,
          ...(dto.kaynakReferansi === undefined
            ? {}
            : { kaynakReferansi: dto.kaynakReferansi.trim() }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'BelgeTipiPolitikasi', varlikId: kayit.id,
        oncekiDeger: { saklamaYili: kayit.saklamaYili, kaynakReferansi: kayit.kaynakReferansi },
        sonrakiDeger: {
          saklamaYili: dto.saklamaYili ?? null,
          kaynakReferansi: dto.kaynakReferansi ?? kayit.kaynakReferansi,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: kayit.id, durum: 'GUNCELLENDI' };
    });
  }

  // -------------------------------------------------------------- listeleme

  /**
   * Belgeleri listeler ve süzer.
   *
   * GİZLİLİK SÜZGECİ EN SONDA UYGULANIR ve izinden AYRIDIR: `belge.view`
   * izni olan bir yönetim kurulu üyesi, kendisiyle ilgisi olmayan
   * KISIYE_OZEL bir kimlik fotokopisini göremez (KVKK md. 4/1-ç veri
   * minimizasyonu). İzin "belge modülüne erişebilir mi", gizlilik "BU
   * belgeye erişebilir mi" sorusudur.
   *
   * Etiket ve ilişki süzgeçleri ALT SORGUYLA değil, `some` ile yapılır:
   * ilişki tablosu belge başına birkaç satır taşır, join maliyeti önemsizdir
   * ve okunabilirlik kazanılır.
   */
  async listele(
    principal: Principal,
    suzgec: BelgeSuzgeci = {},
  ): Promise<readonly BelgeSatiri[]> {
    const aramaMetni = suzgec.arama?.trim();

    return this.prisma.tenantIslemi(
      async (tx) => {
        const politikalar = await this.politikalar(tx, principal);
        const kayitlar = await tx.belge.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.tip ? { tip: suzgec.tip as never } : {}),
            ...(suzgec.arsiviDahilEt === true ? {} : { arsivMi: false }),
            // Silinmiş belge VARSAYILAN OLARAK gizlenir; denetim için açıkça
            // istenebilir (imha kaydı da böyle görülür).
            //
            // Koşul AÇIKÇA yazılır, merkezî uzantıya güvenilmez: uzantı
            // `PrismaService` üzerinde bağlı DEĞİLDİR (`$extends` yeni istemci
            // döndürür, `this`'i değiştirmez) ve sihirli bayrak Prisma'ya
            // bilinmeyen alan olarak gider.
            ...(suzgec.silinmisleriDahilEt === true ? {} : { silinmeTarihi: null }),
            // Kapsam süzgeci İLİŞKİ TABLOSU üzerinden: belge birden çok
            // kayda bağlı olabilir ve "bu dairenin belgeleri" sorgusu
            // yalnızca birincil kapsama bakarsa eksik sonuç verir.
            ...(suzgec.kapsam || suzgec.hedefId
              ? {
                  iliskiler: {
                    some: {
                      ...(suzgec.kapsam ? { varlikTipi: suzgec.kapsam as never } : {}),
                      ...(suzgec.hedefId ? { varlikId: suzgec.hedefId } : {}),
                    },
                  },
                }
              : {}),
            ...(suzgec.etiket
              ? { etiketler: { some: { etiket: etiketNormalle(suzgec.etiket) } } }
              : {}),
            ...(aramaMetni
              ? {
                  OR: [
                    { ad: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { notlar: { contains: aramaMetni, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
            ...(suzgec.tarihBaslangic || suzgec.tarihBitis
              ? {
                  belgeTarihi: {
                    ...(suzgec.tarihBaslangic
                      ? { gte: new Date(takvimTarihi(suzgec.tarihBaslangic)) }
                      : {}),
                    ...(suzgec.tarihBitis
                      ? { lte: new Date(takvimTarihi(suzgec.tarihBitis)) }
                      : {}),
                  },
                }
              : {}),
          },
          include: {
            etiketler: { select: { etiket: true }, orderBy: { etiket: 'asc' } },
            iliskiler: {
              select: { varlikTipi: true, varlikId: true, birincilMi: true },
              orderBy: { birincilMi: 'desc' },
            },
          },
          orderBy: [{ belgeTarihi: 'desc' }, { surum: 'desc' }],
        });

        const simdi = bugun();
        const dolanlar = new Set(
          gecerliligiDolanlar(kayitlar.map(domaine), simdi).map((b) => b.id),
        );

        const satirlar = kayitlar.map((k) => {
          const b = domaine(k);
          const s = silinebilirMi(politikalar, b, simdi);
          const p = politikalar.find((x) => x.tip === k.tip);
          return {
            id: k.id,
            tip: k.tip,
            kategori: p?.kategori ?? 'KURUMSAL',
            kapsam: k.kapsam,
            hedefId: k.hedefId,
            ad: k.ad,
            notlar: k.notlar,
            gizlilik: k.gizlilik,
            surum: k.surum,
            oncekiSurumId: k.oncekiSurumId,
            belgeTarihi: gun(k.belgeTarihi),
            gecerlilikBitisi: k.gecerlilikBitisi === null ? null : gun(k.gecerlilikBitisi),
            dosyaBoyutu: k.dosyaBoyutu,
            icerikTipi: k.icerikTipi,
            arsivMi: k.arsivMi,
            etiketler: k.etiketler.map((e) => e.etiket),
            iliskiler: k.iliskiler.map((i) => ({
              varlikTipi: i.varlikTipi,
              varlikId: i.varlikId,
              birincilMi: i.birincilMi,
            })),
            onizlenebilirMi:
              k.dosyaImhaTarihi === null &&
              NesneDeposuServisi.onizlenebilirMi(k.icerikTipi),
            dosyaImhaEdildiMi: k.dosyaImhaTarihi !== null,
            gecerliligiDolduMu: dolanlar.has(k.id),
            silinebilirMi: s.silinebilir,
            silinemezNedeni: s.mesaj,
          };
        });

        // Kategori süzgeci tür politikasından türetilir; kategori belgede
        // değil TÜRDE tanımlıdır (tek kaynak).
        const kategoriliSuzulmus =
          suzgec.kategori === undefined
            ? satirlar
            : satirlar.filter((x) => x.kategori === suzgec.kategori);

        return this.gizlilikSuz(kategoriliSuzulmus, principal);
      },
      principal.tenantId,
    );
  }

  /**
   * Gizlilik süzgeci — KVKK veri minimizasyonu.
   *
   * `belge.manage` yetkisi olan (yönetici) her şeyi görür; sorumluluk onda.
   * Yalnızca `belge.view` olan biri KISIYE_OZEL belgeyi ancak KENDİSİYLE
   * ilişkiliyse görebilir.
   *
   * Süzme veritabanında değil burada yapılır: ilişkinin "bu principal'ın
   * kişisi mi" sorusu kullanıcı→kişi eşlemesi gerektirir ve SQL'de ifade
   * etmek sorguyu okunamaz kılardı. Belge sayısı tenant başına binlerle
   * ifade edilir; maliyet önemsizdir.
   */
  private gizlilikSuz(
    satirlar: readonly BelgeSatiri[],
    principal: Principal,
  ): readonly BelgeSatiri[] {
    if (principal.izinler.includes(IZINLER.BELGE_YUKLE)) return satirlar;

    return satirlar.filter((b) => {
      if (b.gizlilik === 'GENEL') return true;
      if (b.gizlilik === 'YONETIM') return false;
      // KISIYE_OZEL: yalnızca principal'ın kendi kaydına bağlıysa.
      return b.iliskiler.some(
        (i) => i.varlikTipi === 'KISI' && i.varlikId === principal.id,
      );
    });
  }

  /** Sürüm zinciri — en yeniden en eskiye. */
  async surumGecmisi(id: string, principal: Principal): Promise<readonly BelgeSatiri[]> {
    const hepsi = await this.listele(principal, { arsiviDahilEt: true });
    const harita = new Map(hepsi.map((b) => [b.id, b]));
    const baslangic = harita.get(id);
    if (baslangic === undefined) throw new KayitBulunamadi(`Belge bulunamadı: ${id}`);

    // Once en yeni surume cikilir, sonra zincir geriye izlenir.
    let enYeni = baslangic;
    for (;;) {
      const sonraki = hepsi.find((b) => b.oncekiSurumId === enYeni.id);
      if (sonraki === undefined) break;
      enYeni = sonraki;
    }

    const zincir: BelgeSatiri[] = [];
    let imlec: BelgeSatiri | undefined = enYeni;
    while (imlec !== undefined) {
      zincir.push(imlec);
      imlec = imlec.oncekiSurumId === null ? undefined : harita.get(imlec.oncekiSurumId);
    }
    return zincir;
  }

  // ----------------------------------------------------------------- yazma

  /**
   * Yükleme izni — önimzalı PUT URL'i.
   *
   * Bu aşamada veritabanına HİÇBİR ŞEY yazılmaz: kullanıcı vazgeçerse ortada
   * dosyasız kayıt kalmaz. Anahtar, kayıt adımında geri gönderilir.
   */
  async yuklemeIzni(
    dto: YuklemeIzniDto, principal: Principal,
  ): Promise<{ readonly dosyaAnahtari: string; readonly url: string; readonly omurSaniye: number }> {
    const gecici = randomUUID();
    const anahtar = this.depo.anahtarUret(principal.tenantId, gecici, dto.dosyaAdi);
    const url = await this.depo.yuklemeUrl(anahtar, dto.icerikTipi);
    return { dosyaAnahtari: anahtar, url, omurSaniye: 300 };
  }

  async indirmeIzni(
    id: string, principal: Principal,
  ): Promise<{ readonly url: string; readonly omurSaniye: number }> {
    const kayit = await this.prisma.tenantIslemi(
      (tx) => tx.belge.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { dosyaAnahtari: true, ad: true },
      }),
      principal.tenantId,
    );
    if (!kayit) throw new KayitBulunamadi(`Belge bulunamadı: ${id}`);
    const url = await this.depo.indirmeUrl(kayit.dosyaAnahtari, kayit.ad);
    return { url, omurSaniye: 300 };
  }

  /**
   * Belgenin ilişkilerini ve etiketlerini yazar.
   *
   * BİRİNCİL İLİŞKİ HER ZAMAN YAZILIR: `belge.kapsam`/`hedefId` ile aynı
   * kayıttır ama listeleme ilişki tablosundan süzer. Yazılmasaydı yeni
   * belgeler "bu dairenin belgeleri" sorgusunda GÖRÜNMEZDİ — süzgeç sessizce
   * boş dönerdi.
   */
  private async iliskileriYaz(
    tx: Parameters<Parameters<PrismaService['tenantIslemi']>[0]>[0],
    principal: Principal,
    belgeId: string,
    birincil: { readonly varlikTipi: string; readonly varlikId: string | null },
    ekIliskiler: readonly { readonly varlikTipi: string; readonly varlikId?: string }[],
    etiketler: readonly string[],
  ): Promise<void> {
    await tx.belgeIliskisi.create({
      data: {
        id: randomUUID(), tenantId: principal.tenantId, belgeId,
        varlikTipi: birincil.varlikTipi as never,
        varlikId: birincil.varlikId,
        birincilMi: true,
      },
    });

    // MÜKERRER BAĞLANTI SESSİZCE ATLANIR, hata verilmez: kullanıcı aynı
    // kaydı hem kapsam hem ek ilişki olarak seçebilir ve yeni sürümde
    // devralınan ilişki elle eklenenle çakışabilir. Unique index bunu
    // reddederdi ve işlem tümüyle düşerdi.
    const gorulen = new Set<string>([
      `${birincil.varlikTipi}:${birincil.varlikId ?? ''}`,
    ]);

    for (const i of ekIliskiler) {
      const hedef = await this.hedefiDogrula(tx, principal, i.varlikTipi, i.varlikId);
      const anahtar = `${i.varlikTipi}:${hedef ?? ''}`;
      if (gorulen.has(anahtar)) continue;
      gorulen.add(anahtar);

      await tx.belgeIliskisi.create({
        data: {
          id: randomUUID(), tenantId: principal.tenantId, belgeId,
          varlikTipi: i.varlikTipi as never, varlikId: hedef, birincilMi: false,
        },
      });
    }

    // Etiketler normalize edilir ve TEKİLLEŞTİRİLİR: "Acil" ve "acil" aynı
    // etikettir, ikisi de gönderilirse unique index'e takılırdı.
    const tekil = [...new Set(etiketler.map(etiketiDogrula))];
    for (const e of tekil) {
      await tx.belgeEtiketi.create({
        data: { id: randomUUID(), tenantId: principal.tenantId, belgeId, etiket: e },
      });
    }
  }

  /** Hedefin gerçekten var olduğunu denetler — tipli FK yerine geçer. */
  private async hedefiDogrula(
    tx: Parameters<Parameters<PrismaService['tenantIslemi']>[0]>[0],
    principal: Principal,
    kapsam: string,
    hedefId: string | undefined,
  ): Promise<string | null> {
    if (kapsam === 'TENANT') {
      if (hedefId !== undefined) {
        throw new IsKuraliIhlali(
          'TENANT kapsamlı belge hedef kimliği taşımaz.',
          'Hedef alanını boş bırakın.',
        );
      }
      return null;
    }
    if (hedefId === undefined) {
      throw new IsKuraliIhlali(
        `${kapsam} kapsamlı belge bir hedef kimliği taşımalıdır.`,
        'Belgeyi bağlayacağınız kaydı seçin.',
      );
    }

    // Dokuz varlık tipinin her biri AYRI tabloda; tipli FK kurulamaz.
    // MALIK · KIRACI · SAKIN kendi tablolarındadır ve KISI'den ayrıdır:
    // bir kira sözleşmesi kişiye değil, o kişinin O BÖLÜMDEKİ kiracılık
    // dönemine bağlanır.
    const kosul = { id: hedefId, tenantId: principal.tenantId };
    const varMi =
      kapsam === 'APARTMAN' ? await tx.apartman.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'BLOK' ? await tx.blok.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'KAT' ? await tx.kat.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'BOLUM' ? await tx.bagimsizBolum.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'MALIK' ? await tx.malik.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'KIRACI' ? await tx.kiraci.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'SAKIN' ? await tx.sakin.findFirst({ where: kosul, select: { id: true } })
      : await tx.kisi.findFirst({ where: kosul, select: { id: true } });

    if (!varMi) {
      throw new KayitBulunamadi(`${kapsam} kaydı bulunamadı: ${hedefId}`);
    }
    return hedefId;
  }

  async kaydet(dto: BelgeKaydetDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.kaydet');
    const id = randomUUID();

    // NESNE GERÇEKTEN YÜKLENDİ Mİ — kayıttan ÖNCE. Doğrulanmasaydı, önimzalı
    // URL alıp dosyayı yüklemeyen bir istemci "belge var" diyen ama
    // indirilemeyen bir satır bırakırdı.
    const nesne = await this.depo.nesneVarMi(dto.dosyaAnahtari);
    if (nesne === null) {
      throw new IsKuraliIhlali(
        'Dosya nesne deposunda bulunamadı; yükleme tamamlanmamış olabilir.',
        'Dosyayı yükleyip tekrar deneyin.',
      );
    }

    // Anahtar BU tenant'ın önekini taşımalıdır: başka bir tenant'ın anahtarı
    // gönderilerek onun dosyasına kayıt açılamaz.
    if (!dto.dosyaAnahtari.startsWith(`${principal.tenantId}/`)) {
      throw new IsKuraliIhlali(
        'Dosya anahtarı bu yerleşkeye ait değil.',
        'Yükleme iznini yeniden alın.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const hedefId = await this.hedefiDogrula(tx, principal, dto.kapsam, dto.hedefId);

      // Gizlilik türün varsayılanından YÜKSELTİLEBİLİR, düşürülemez:
      // kimlik fotokopisi tek bir yanlış tıkla herkese açılamamalıdır.
      const politikalar = await this.politikalar(tx, principal);
      const varsayilanGizlilik =
        politikalar.find((p) => p.tip === dto.tip)?.varsayilanGizlilik ?? 'YONETIM';
      const gizlilik = dto.gizlilik ?? varsayilanGizlilik;
      gizliligiDogrula(varsayilanGizlilik, gizlilik);

      await tx.belge.create({
        data: {
          id, tenantId: principal.tenantId,
          tip: dto.tip, kapsam: dto.kapsam, hedefId,
          gizlilik, notlar: dto.notlar?.trim() ?? null,
          ad: dto.ad.trim(), surum: 1, oncekiSurumId: null,
          belgeTarihi: new Date(takvimTarihi(dto.belgeTarihi)),
          gecerlilikBitisi:
            dto.gecerlilikBitisi === undefined
              ? null
              : new Date(takvimTarihi(dto.gecerlilikBitisi)),
          dosyaAnahtari: dto.dosyaAnahtari,
          dosyaBoyutu: nesne.boyut,
          icerikTipi: nesne.icerikTipi,
          dosyaOzeti: nesne.etag,
          yukleyenKullanici: principal.id,
        },
      });

      await this.iliskileriYaz(
        tx, principal, id,
        { varlikTipi: dto.kapsam, varlikId: hedefId },
        dto.iliskiler ?? [],
        dto.etiketler ?? [],
      );

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Belge', varlikId: id,
        sonrakiDeger: {
          tip: dto.tip, kapsam: dto.kapsam, hedefId, ad: dto.ad,
          surum: 1, dosyaBoyutu: nesne.boyut, gizlilik,
          etiketler: dto.etiketler ?? [],
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /**
   * Yeni sürüm yayınlar. Eski sürüm ARŞİVLENİR, silinmez.
   *
   * Sürüm zinciri kuralları domain'dedir (`yeniSurumuDogrula`): aynı tip,
   * aynı kapsam/hedef, bir artan sürüm numarası ve önceki sürüm referansı.
   */
  async yeniSurum(
    oncekiId: string, dto: YeniSurumDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.yeniSurum');
    const id = randomUUID();

    const nesne = await this.depo.nesneVarMi(dto.dosyaAnahtari);
    if (nesne === null) {
      throw new IsKuraliIhlali(
        'Dosya nesne deposunda bulunamadı; yükleme tamamlanmamış olabilir.',
        'Dosyayı yükleyip tekrar deneyin.',
      );
    }
    if (!dto.dosyaAnahtari.startsWith(`${principal.tenantId}/`)) {
      throw new IsKuraliIhlali(
        'Dosya anahtarı bu yerleşkeye ait değil.',
        'Yükleme iznini yeniden alın.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const onceki = await tx.belge.findFirst({
        where: { id: oncekiId, tenantId: principal.tenantId },
      });
      if (!onceki) throw new KayitBulunamadi(`Belge bulunamadı: ${oncekiId}`);

      // Zincirin UCU bulunur: arşivlenmiş bir sürüme yeni sürüm bağlamak,
      // aynı numarada iki dal oluşturur ve "güncel sürüm hangisi?" sorusu
      // cevapsız kalır.
      const dahaYenisi = await tx.belge.findFirst({
        where: { tenantId: principal.tenantId, oncekiSurumId: oncekiId },
        select: { id: true, surum: true },
      });
      if (dahaYenisi) {
        throw new IsKuraliIhlali(
          `Bu sürümün zaten bir ardılı var (sürüm ${dahaYenisi.surum}).`,
          'Yeni sürümü zincirin en son halkasına bağlayın.',
        );
      }

      const hedefId = await this.hedefiDogrula(tx, principal, dto.kapsam, dto.hedefId);

      const yeni: Belge = {
        // DTO birlik tipleri domain'inkilerle birebir ayni listeden gelir.
        id, tip: dto.tip, kapsam: dto.kapsam,
        hedefId, ad: dto.ad.trim(),
        surum: onceki.surum + 1, oncekiSurumId: oncekiId,
        belgeTarihi: takvimTarihi(dto.belgeTarihi),
        gecerlilikBitisi:
          dto.gecerlilikBitisi === undefined ? null : takvimTarihi(dto.gecerlilikBitisi),
        dosyaAnahtari: dto.dosyaAnahtari,
        dosyaBoyutu: nesne.boyut,
        icerikTipi: nesne.icerikTipi,
        arsivMi: false,
      };

      yeniSurumuDogrula(domaine(onceki), yeni);

      await tx.belge.create({
        data: {
          id, tenantId: principal.tenantId,
          tip: yeni.tip, kapsam: yeni.kapsam, hedefId,
          ad: yeni.ad, surum: yeni.surum, oncekiSurumId: oncekiId,
          belgeTarihi: new Date(yeni.belgeTarihi),
          gecerlilikBitisi:
            yeni.gecerlilikBitisi === null ? null : new Date(yeni.gecerlilikBitisi),
          dosyaAnahtari: dto.dosyaAnahtari,
          dosyaBoyutu: nesne.boyut,
          icerikTipi: nesne.icerikTipi,
          dosyaOzeti: nesne.etag,
          gizlilik: onceki.gizlilik,
          notlar: dto.notlar?.trim() ?? onceki.notlar,
          yukleyenKullanici: principal.id,
        },
      });

      // İLİŞKİ ve ETİKETLER DEVRALINIR. Devralınmasaydı yeni sürüm, eski
      // sürümün bağlı olduğu kiracı/malik kayıtlarından KOPARDI ve "bu
      // dairenin belgeleri" listesinde görünmezdi — güncel sürüm kaybolur,
      // arşivdeki eski sürüm görünmeye devam ederdi.
      const devralinanEtiketler = await tx.belgeEtiketi.findMany({
        where: { tenantId: principal.tenantId, belgeId: oncekiId },
        select: { etiket: true },
      });
      const devralinanIliskiler = await tx.belgeIliskisi.findMany({
        where: { tenantId: principal.tenantId, belgeId: oncekiId, birincilMi: false },
        select: { varlikTipi: true, varlikId: true },
      });

      await this.iliskileriYaz(
        tx, principal, id,
        { varlikTipi: yeni.kapsam, varlikId: hedefId },
        [
          ...devralinanIliskiler.map((i) => ({
            varlikTipi: i.varlikTipi,
            ...(i.varlikId === null ? {} : { varlikId: i.varlikId }),
          })),
          ...(dto.iliskiler ?? []),
        ],
        [...devralinanEtiketler.map((e) => e.etiket), ...(dto.etiketler ?? [])],
      );

      // Eski surum ARSIVLENIR — silinmez. "Hangi yonetim planina gore karar
      // verildi?" sorusunun cevabi burada durur.
      await tx.belge.update({ where: { id: oncekiId }, data: { arsivMi: true } });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Belge', varlikId: id,
        oncekiDeger: { oncekiSurumId: oncekiId, surum: onceki.surum },
        sonrakiDeger: { surum: yeni.surum, ad: yeni.ad, tip: yeni.tip },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /**
   * Silme — domain kuralı geçerse.
   *
   * FİNANSAL belgeler ASLA silinmez. Diğerleri yalnızca arşivdeyse ve
   * saklama süresi dolduysa silinebilir. Silme yine SOFT DELETE'tir: nesne
   * deposundaki dosya da bırakılır, çünkü hard delete geri alınamaz ve
   * yanlış bir karar kanıtı yok eder.
   */
  async sil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.sil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.belge.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Belge bulunamadı: ${id}`);

      const politikalar = await this.politikalar(tx, principal);
      const sonuc = silinebilirMi(politikalar, domaine(kayit), bugun());
      if (!sonuc.silinebilir) {
        throw new IsKuraliIhlali(
          sonuc.mesaj,
          'Düzeltme gerekiyorsa yeni sürüm yayınlayın.',
        );
      }

      await tx.belge.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Belge', varlikId: id,
        oncekiDeger: { silindiMi: false }, sonrakiDeger: { silindiMi: true },
        gerekce, correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SILINDI' };
    });
  }

  /**
   * Önizleme izni — tarayıcıda AÇMAK için.
   *
   * Yalnızca betik taşıyamayan içerik tiplerinde verilir (PDF, resim, düz
   * metin). HTML ve SVG asla önizlenmez: nesne deposunun alan adında
   * çalıştırılan bir betik oradaki oturum bağlamına erişebilir.
   */
  async onizlemeIzni(
    id: string, principal: Principal,
  ): Promise<{ readonly url: string; readonly omurSaniye: number }> {
    const kayit = await this.prisma.tenantIslemi(
      (tx) => tx.belge.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { dosyaAnahtari: true, icerikTipi: true, dosyaImhaTarihi: true },
      }),
      principal.tenantId,
    );
    if (!kayit) throw new KayitBulunamadi(`Belge bulunamadı: ${id}`);

    if (kayit.dosyaImhaTarihi !== null) {
      throw new IsKuraliIhlali(
        'Bu belgenin dosyası KVKK kapsamında imha edilmiş; önizlenemez.',
        'Üstveri kaydı imha kanıtı olarak durmaktadır.',
      );
    }
    if (!NesneDeposuServisi.onizlenebilirMi(kayit.icerikTipi)) {
      throw new IsKuraliIhlali(
        `'${kayit.icerikTipi}' türü tarayıcıda önizlenemez.`,
        'Dosyayı indirerek açın.',
      );
    }

    const url = await this.depo.onizlemeUrl(kayit.dosyaAnahtari, kayit.icerikTipi);
    return { url, omurSaniye: 300 };
  }

  /** Üstveri düzeltme. DOSYA DEĞİŞMEZ — dosya değişikliği yeni sürümdür. */
  async duzelt(
    id: string,
    dto: {
      readonly ad?: string; readonly notlar?: string;
      readonly gizlilik?: string; readonly gecerlilikBitisi?: string;
    },
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.duzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.belge.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Belge bulunamadı: ${id}`);

      if (dto.gizlilik !== undefined) {
        const politikalar = await this.politikalar(tx, principal);
        const varsayilan =
          politikalar.find((p) => p.tip === kayit.tip)?.varsayilanGizlilik ?? 'YONETIM';
        gizliligiDogrula(varsayilan, dto.gizlilik as never);
      }

      await tx.belge.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.notlar === undefined ? {} : { notlar: dto.notlar.trim() }),
          ...(dto.gizlilik === undefined ? {} : { gizlilik: dto.gizlilik as never }),
          ...(dto.gecerlilikBitisi === undefined
            ? {}
            : { gecerlilikBitisi: new Date(takvimTarihi(dto.gecerlilikBitisi)) }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Belge', varlikId: id,
        oncekiDeger: { ad: kayit.ad, notlar: kayit.notlar, gizlilik: kayit.gizlilik },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad,
          notlar: dto.notlar ?? kayit.notlar,
          gizlilik: dto.gizlilik ?? kayit.gizlilik,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  async etiketEkle(id: string, etiket: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.etiketEkle');
    const normal = etiketiDogrula(etiket);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.belge.findFirst({
        where: { id, tenantId: principal.tenantId }, select: { id: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Belge bulunamadı: ${id}`);

      const mevcut = await tx.belgeEtiketi.findFirst({
        where: { belgeId: id, etiket }, select: { id: true },
      });
      // Var olan etiketi yeniden eklemek HATA DEĞİLDİR; sonuç aynıdır.
      if (mevcut === null) {
        await tx.belgeEtiketi.create({
          data: { id: randomUUID(), tenantId: principal.tenantId, belgeId: id, etiket: normal },
        });
      }

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Belge', varlikId: id,
        sonrakiDeger: { etiketEklendi: normal },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  async etiketKaldir(id: string, etiket: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.etiketKaldir');
    const normal = etiketNormalle(etiket);

    return this.prisma.tenantIslemi(async (tx) => {
      await tx.belgeEtiketi.deleteMany({
        where: { tenantId: principal.tenantId, belgeId: id, etiket: normal },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Belge', varlikId: id,
        sonrakiDeger: { etiketKaldirildi: normal },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * KVKK KALICI SİLME (md. 7) — dosya nesne deposundan GERİ ALINAMAZ
   * biçimde kaldırılır.
   *
   * ÜSTVERİ SATIRI KALIR ve `dosyaImhaTarihi` ile işaretlenir. Kaydın kendisi
   * de silinseydi "bu belge şu tarihte, şu gerekçeyle imha edildi" sorusunun
   * cevabı kaybolur ve imha KANITLANAMAZDI — KVKK'nın istediği de budur:
   * verinin silinmesi, silme işleminin izsiz kalması değil.
   *
   * Ön koşullar (üçü de zorunlu):
   *   1. Belge soft-delete edilmiş olmalı (`silinebilirMi` denetiminden geçmiş).
   *   2. FİNANSAL sınıf olmamalı — o belgeler hiçbir koşulda silinmez.
   *   3. Çağıran açık onay dizesi göndermeli.
   */
  async kaliciSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('belge.kaliciSil');

    const anahtar = await this.prisma.tenantIslemi(async (tx) => {
      // `silinmeTarihi: { not: null }` ÖN KOŞULU İFADE EDER: kalıcı silme
      // yalnızca önce soft-delete edilmiş belgede yapılır. Ayrıca sihirli
      // `__silinmisleriDahilEt` bayrağı KULLANILMAZ — o bayrak Prisma'ya
      // bilinmeyen alan olarak gider ve doğrulama hatası verir
      // (bkz. SESSION_SUMMARY: soft delete uzantısı bağlı değil).
      const kayit = await tx.belge.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: { not: null } },
      });
      if (!kayit) {
        throw new IsKuraliIhlali(
          'Kalıcı silme yalnızca önce arşivlenip silinmiş belgelerde yapılabilir.',
          'Önce belgeyi normal yolla silin; saklama süresi ve finansal sınıf orada denetlenir.',
        );
      }
      if (kayit.dosyaImhaTarihi !== null) {
        throw new IsKuraliIhlali(
          `Bu belgenin dosyası ${gun(kayit.dosyaImhaTarihi)} tarihinde zaten imha edilmiş.`,
          'İşlem tekrarlanmaz.',
        );
      }

      const politikalar = await this.politikalar(tx, principal);
      const p = politikalar.find((x) => x.tip === kayit.tip);
      if (p?.finansalMi === true) {
        throw new IsKuraliIhlali(
          `'${kayit.tip}' finansal sınıftadır; dosyası imha edilemez (BFS v1 §5.1).`,
          'Mali denetim izi korunmak zorundadır.',
        );
      }

      await tx.belge.update({
        where: { id },
        data: { dosyaImhaTarihi: new Date() },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'Belge', varlikId: id,
        oncekiDeger: { dosyaAnahtari: kayit.dosyaAnahtari, dosyaImhaTarihi: null },
        sonrakiDeger: { dosyaImhaTarihi: new Date().toISOString(), kaliciImha: true },
        gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return kayit.dosyaAnahtari;
    }, principal.tenantId);

    // Nesne, VERİTABANI İŞLEMİ BAŞARIYLA KAPANDIKTAN SONRA silinir. İşlem
    // içinde silinseydi ve transaction geri alınsaydı dosya yok olur ama
    // kayıt "dosya duruyor" demeye devam ederdi — geri alınamaz bir tutarsızlık.
    await this.depo.nesneyiSil(anahtar);

    return { id, durum: 'IMHA_EDILDI' };
  }

  /** Geçerliliği dolmuş belgeler — poliçe ve ruhsat takibi. */
  async gecerliligiDolanlar(principal: Principal): Promise<readonly BelgeSatiri[]> {
    const hepsi = await this.listele(principal);
    return hepsi.filter((b) => b.gecerliligiDolduMu);
  }
}
