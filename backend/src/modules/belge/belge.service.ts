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
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  gecerliligiDolanlar, silinebilirMi, yeniSurumuDogrula,
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

export interface BelgeSatiri {
  readonly id: string;
  readonly tip: string;
  readonly kapsam: string;
  readonly hedefId: string | null;
  readonly ad: string;
  readonly surum: number;
  readonly oncekiSurumId: string | null;
  readonly belgeTarihi: string;
  readonly gecerlilikBitisi: string | null;
  readonly dosyaBoyutu: number;
  readonly icerikTipi: string;
  readonly arsivMi: boolean;
  /** Geçerliliği bugün itibarıyla dolmuş mu — poliçe/ruhsat takibi için. */
  readonly gecerliligiDolduMu: boolean;
  readonly silinebilirMi: boolean;
  readonly silinemezNedeni: string;
}

export interface PolitikaSatiri {
  readonly tip: string;
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
    return kayitlar.map((p) => ({
      tip: p.tip,
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

  async listele(
    principal: Principal,
    suzgec: {
      readonly kapsam?: string; readonly hedefId?: string;
      readonly tip?: string; readonly arsiviDahilEt?: boolean;
    } = {},
  ): Promise<readonly BelgeSatiri[]> {
    return this.prisma.tenantIslemi(
      async (tx) => {
        const politikalar = await this.politikalar(tx, principal);
        const kayitlar = await tx.belge.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.kapsam ? { kapsam: suzgec.kapsam as never } : {}),
            ...(suzgec.hedefId ? { hedefId: suzgec.hedefId } : {}),
            ...(suzgec.tip ? { tip: suzgec.tip as never } : {}),
            ...(suzgec.arsiviDahilEt === true ? {} : { arsivMi: false }),
          },
          orderBy: [{ belgeTarihi: 'desc' }, { surum: 'desc' }],
        });

        const simdi = bugun();
        const dolanlar = new Set(
          gecerliligiDolanlar(kayitlar.map(domaine), simdi).map((b) => b.id),
        );

        return kayitlar.map((k) => {
          const b = domaine(k);
          const s = silinebilirMi(politikalar, b, simdi);
          return {
            id: k.id,
            tip: k.tip,
            kapsam: k.kapsam,
            hedefId: k.hedefId,
            ad: k.ad,
            surum: k.surum,
            oncekiSurumId: k.oncekiSurumId,
            belgeTarihi: gun(k.belgeTarihi),
            gecerlilikBitisi: k.gecerlilikBitisi === null ? null : gun(k.gecerlilikBitisi),
            dosyaBoyutu: k.dosyaBoyutu,
            icerikTipi: k.icerikTipi,
            arsivMi: k.arsivMi,
            gecerliligiDolduMu: dolanlar.has(k.id),
            silinebilirMi: s.silinebilir,
            silinemezNedeni: s.mesaj,
          };
        });
      },
      principal.tenantId,
    );
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

    const kosul = { id: hedefId, tenantId: principal.tenantId };
    const varMi =
      kapsam === 'APARTMAN' ? await tx.apartman.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'BLOK' ? await tx.blok.findFirst({ where: kosul, select: { id: true } })
      : kapsam === 'BOLUM' ? await tx.bagimsizBolum.findFirst({ where: kosul, select: { id: true } })
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

      await tx.belge.create({
        data: {
          id, tenantId: principal.tenantId,
          tip: dto.tip, kapsam: dto.kapsam, hedefId,
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

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Belge', varlikId: id,
        sonrakiDeger: {
          tip: dto.tip, kapsam: dto.kapsam, hedefId, ad: dto.ad,
          surum: 1, dosyaBoyutu: nesne.boyut,
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
          yukleyenKullanici: principal.id,
        },
      });

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

  /** Geçerliliği dolmuş belgeler — poliçe ve ruhsat takibi. */
  async gecerliligiDolanlar(principal: Principal): Promise<readonly BelgeSatiri[]> {
    const hepsi = await this.listele(principal);
    return hepsi.filter((b) => b.gecerliligiDolduMu);
  }
}
