/**
 * Portföy Yönetim Merkezi — yönetim firmasının kontrol merkezi (ADR-0009).
 *
 * Yönetim firması sisteme girdiğinde doğrudan bir projeye düşmez; önce
 * yönettiği bütün projeleri tek ekranda görür ve oradan proje seçer.
 *
 * ⚠️  ÇAPRAZ-TENANT SORGU YOKTUR. Özet, PROJE BAŞINA AYRI SORGU + uygulama
 *     katmanında toplamadır. ADR-0002 bu bedeli açıkça kabul etti:
 *
 *       "Yönetim Şirketi dikeyi geldiğinde portföy raporu, tenant başına ayrı
 *        sorgu + uygulama katmanında toplama demektir. Yavaştır."
 *
 *     ve kolay yolu ismiyle yasakladı: "Portföy görünümü ileride RLS
 *     gevşetilerek çözülmeyecektir." `BYPASSRLS` yoktur ve CI'da denetlenir.
 *
 *     Hızlandırma yolu da yazılıdır (IMPLEMENTATION-ROADMAP R-4): RLS'i delmek
 *     değil, "indeksleme ve event ile bakımı yapılan özet tablolar". O geldiğinde
 *     bu servisin sözleşmesi değişmez, yalnızca okuma yolu hızlanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  takvimTarihi, tenantId, type Principal, type TakvimTarihi,
} from '@bnos/kernel';
import {
  DogrulamaHatasi, IsKuraliIhlali, KayitBulunamadi,
  devirGecerliMi, devriDogrula, devirSonlandirmayiDogrula,
  type YonetimDevri,
} from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { DevirEkleDto, DevirSonlandirDto } from './dto/portfoy.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

/** Bir projenin kontrol merkezinde görünen satırı. */
export interface ProjeSatiri {
  readonly tenantId: string;
  readonly kod: string;
  readonly ad: string;
  /** APARTMAN | SITE — kontrol merkezinde site/apartman sayımı buna dayanır. */
  readonly tip: string;
  readonly durum: string;
  readonly devirDayanagi: string;
  readonly devirBaslangic: string;
  readonly devirBitis: string | null;
  readonly apartmanSayisi: number;
  readonly bagimsizBolumSayisi: number;
  readonly malikSayisi: number;
  readonly kiraciSayisi: number;
  readonly sakinSayisi: number;
  readonly personelSayisi: number;
  readonly daireGorevlisiSayisi: number;
  readonly icerideMisafirSayisi: number;
  /**
   * Özet okunamadıysa doldurulur ve satır YİNE DÖNER.
   *
   * Tek projenin sorgusu düşerse bütün kontrol merkezi boş kalmamalıdır: 150
   * projeli bir firmada bir projenin arızası, öteki 149'un görünmesini
   * engellememelidir. Kısmî veri, sessiz sıfırdan iyidir.
   */
  readonly ozetHatasi: string | null;
}

export interface PortfoyOzeti {
  readonly yonetimTenantId: string;
  readonly yonetimAdi: string;
  /** Kullanıcının rolü portföy görmeye yetkili mi — ekran bunu gösterir. */
  readonly projeSayisi: number;
  readonly siteSayisi: number;
  readonly apartmanSayisi: number;
  readonly toplamApartmanBinasi: number;
  readonly toplamBagimsizBolum: number;
  readonly toplamMalik: number;
  readonly toplamKiraci: number;
  readonly toplamSakin: number;
  readonly toplamPersonel: number;
  readonly toplamDaireGorevlisi: number;
  readonly icerideMisafir: number;
  readonly acikIsEmri: number;
  readonly bekleyenTalep: number;
  readonly tahsilatDurumu: TahsilatDurumu;
  readonly kritikUyarilar: readonly KritikUyari[];
  readonly aiOnerileri: readonly string[];
  readonly projeler: readonly ProjeSatiri[];
  /** Özeti üretilemeyen proje sayısı — kısmî veri açıkça bildirilir. */
  readonly okunamayanProjeSayisi: number;
}

export interface TahsilatDurumu {
  /**
   * Para METİN taşınır (ADR-0007 · BFS v1 §11): JSON `number` çift duyarlıklı
   * float'tır ve tahsilat toplamı yuvarlanırsa rapor mutabakat tutmaz.
   * Toplama `Prisma.Decimal` ile yapılır — `Number`'a çevrilmez.
   */
  readonly tahakkuk: string;
  readonly tahsil: string;
  readonly kalan: string;
  /**
   * Tahsilat oranı BİNDE, tam sayı olarak taşınır (`847` = %84,7). Kesirli bir
   * oran float olurdu; oran para değildir ama para BÖLÜMÜDÜR ve yuvarlaması
   * raporlarda tutarsızlık üretir.
   */
  readonly oranBinde: number | null;
}

export interface KritikUyari {
  readonly projeTenantId: string;
  readonly projeAdi: string;
  readonly siddet: 'KRITIK' | 'UYARI';
  readonly konu: string;
  readonly mesaj: string;
}

interface ProjeOzeti {
  readonly apartmanSayisi: number;
  readonly bagimsizBolumSayisi: number;
  readonly malikSayisi: number;
  readonly kiraciSayisi: number;
  readonly sakinSayisi: number;
  readonly personelSayisi: number;
  readonly daireGorevlisiSayisi: number;
  readonly icerideMisafirSayisi: number;
  readonly tahakkuk: Prisma.Decimal;
  readonly tahsil: Prisma.Decimal;
  readonly gecikmisBorcSayisi: number;
  readonly sertifikasiDolanPersonel: number;
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

@Injectable()
export class PortfoyServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- okuma

  /**
   * Firmanın yönettiği projeler — devir kaydından okunur.
   *
   * Sorgu FİRMA bağlamında koşar; devir tablosunun iki taraflı politikası
   * satırı `yonetim_tenant_id` tarafından görünür kılar.
   */
  private async devirleriOku(
    principal: Principal,
  ): Promise<readonly (YonetimDevri & { readonly proje: {
    readonly kod: string; readonly ad: string;
    readonly tip: string; readonly durum: string;
  } })[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.yonetimDelegasyonu.findMany({
          where: { yonetimTenantId: principal.tenantId, durum: 'AKTIF' },
          include: {
            projeTenant: { select: { kod: true, ad: true, tip: true, durum: true } },
          },
          orderBy: { baslangic: 'asc' },
        }),
      principal.tenantId,
    );

    return kayitlar.map((d) => ({
      id: d.id,
      yonetimTenantId: d.yonetimTenantId,
      projeTenantId: d.projeTenantId,
      durum: d.durum,
      dayanak: d.dayanak,
      baslangic: gun(d.baslangic),
      bitis: d.bitis === null ? null : gun(d.bitis),
      proje: {
        kod: d.projeTenant.kod, ad: d.projeTenant.ad,
        tip: d.projeTenant.tip, durum: d.projeTenant.durum,
      },
    }));
  }

  /**
   * TEK PROJENİN özeti — kendi tenant bağlamında koşar.
   *
   * Buradaki her sorgu `tenantIslemi(projeTenantId)` içindedir: RLS her
   * sorguda TEK tenant görür. Çapraz-tenant `SELECT` yoktur.
   */
  private projeOzetiniOku(projeTenantId: string): Promise<ProjeOzeti> {
    const pid = tenantId(projeTenantId);
    const simdi = bugun();

    return this.prisma.tenantIslemi(async (tx) => {
      const [
        apartmanSayisi, bagimsizBolumSayisi, malikSayisi, kiraciSayisi,
        sakinSayisi, personelSayisi, daireGorevlisiSayisi, icerideMisafirSayisi,
      ] = await Promise.all([
        tx.apartman.count({ where: { tenantId: pid, silinmeTarihi: null } }),
        tx.bagimsizBolum.count({ where: { tenantId: pid, silinmeTarihi: null } }),
        // Malik/kiracı/sakin sayıları O GÜN GEÇERLİ olanlardır: dönemi kapanmış
        // kayıtlar tarihçede kalır ve toplamda sayılırsa devreden malik hâlâ
        // malik gibi görünür.
        tx.malik.count({
          where: {
            tenantId: pid,
            tapuBaslangic: { lte: new Date(simdi) },
            OR: [{ tapuBitis: null }, { tapuBitis: { gte: new Date(simdi) } }],
          },
        }),
        tx.kiraci.count({
          where: {
            tenantId: pid, tahliyeTarihi: null,
            baslangic: { lte: new Date(simdi) },
            OR: [{ bitis: null }, { bitis: { gte: new Date(simdi) } }],
          },
        }),
        tx.sakin.count({ where: { tenantId: pid, cikisTarihi: null } }),
        tx.sitePersoneli.count({
          where: { tenantId: pid, durum: 'AKTIF', silinmeTarihi: null },
        }),
        tx.daireGorevlisi.count({
          where: { tenantId: pid, durum: 'AKTIF', silinmeTarihi: null },
        }),
        tx.misafir.count({
          where: { tenantId: pid, cikisTarihi: null, silinmeTarihi: null },
        }),
      ]);

      // Tahsilat: borç FINANSAL sınıftır ve silinmez; toplam tahakkuk ile
      // tahsil edilen arasındaki fark kalan borçtur.
      //
      // Toplama `Prisma.Decimal` ile yapılır. `Number`'a çevirip toplamak
      // float yuvarlaması yapar ve portföy toplamı proje toplamlarının
      // toplamına eşit çıkmaz (ADR-0007).
      const borclar = await tx.borc.aggregate({
        where: { tenantId: pid },
        _sum: { tutar: true, odenen: true },
      });

      const gecikmisBorcSayisi = await tx.borc.count({
        where: {
          tenantId: pid,
          vadeTarihi: { lt: new Date(simdi) },
          kapandiMi: false,
        },
      });

      // Süresi dolmuş sertifikayla çalıştırmak idari yaptırım sebebidir;
      // portföy düzeyinde de görünür olmalı.
      const sertifikasiDolanPersonel = await tx.personelSertifikasi.count({
        where: {
          tenantId: pid,
          gecerlilikBitisi: { lt: new Date(simdi) },
          personel: { durum: 'AKTIF', silinmeTarihi: null },
        },
      });

      return {
        apartmanSayisi, bagimsizBolumSayisi, malikSayisi, kiraciSayisi,
        sakinSayisi, personelSayisi, daireGorevlisiSayisi, icerideMisafirSayisi,
        tahakkuk: borclar._sum.tutar ?? new Prisma.Decimal(0),
        tahsil: borclar._sum.odenen ?? new Prisma.Decimal(0),
        gecikmisBorcSayisi,
        sertifikasiDolanPersonel,
      };
    }, pid);
  }

  /**
   * KONTROL MERKEZİ ÖZETİ.
   *
   * Proje sorguları PARALEL koşar ama her biri kendi tenant bağlamındadır.
   * `Promise.allSettled`: bir projenin sorgusu düşerse öteki 149 yine görünür.
   */
  async ozet(principal: Principal): Promise<PortfoyOzeti> {
    const devirler = await this.devirleriOku(principal);
    const simdi = bugun();

    const firma = await this.prisma.tenantIslemi(
      (tx) =>
        tx.tenant.findFirst({
          where: { id: principal.tenantId },
          select: { ad: true, tip: true },
        }),
      principal.tenantId,
    );
    if (!firma) throw new KayitBulunamadi('Yönetim firması bulunamadı.');
    if (firma.tip !== 'YONETIM_SIRKETI') {
      throw new IsKuraliIhlali(
        'Portföy Yönetim Merkezi yalnızca yönetim firması hesaplarında açılır.',
        'Tek proje yönetiyorsanız doğrudan proje panelini kullanın.',
      );
    }

    // Devri bugün geçerli olmayanlar (ileri başlangıç / geçmiş bitiş) portföyde
    // GÖSTERİLMEZ: kontrol merkezi, bugün yetkili olduğun projeleri listeler.
    const gecerliler = devirler.filter((d) => devirGecerliMi(d, simdi));

    const sonuclar = await Promise.allSettled(
      gecerliler.map((d) => this.projeOzetiniOku(d.projeTenantId)),
    );

    const satirlar: ProjeSatiri[] = [];
    const uyarilar: KritikUyari[] = [];
    let okunamayan = 0;

    let toplamBina = 0;
    let toplamBolum = 0;
    let toplamMalik = 0;
    let toplamKiraci = 0;
    let toplamSakin = 0;
    let toplamPersonel = 0;
    let toplamGorevli = 0;
    let toplamMisafir = 0;
    let tahakkuk = new Prisma.Decimal(0);
    let tahsil = new Prisma.Decimal(0);
    let gecikmis = 0;

    gecerliler.forEach((d, i) => {
      const s = sonuclar[i];
      const temel = {
        tenantId: d.projeTenantId,
        kod: d.proje.kod,
        ad: d.proje.ad,
        tip: d.proje.tip,
        durum: d.proje.durum,
        devirDayanagi: d.dayanak,
        devirBaslangic: d.baslangic,
        devirBitis: d.bitis,
      };

      if (s === undefined || s.status === 'rejected') {
        okunamayan += 1;
        const sebep =
          s !== undefined && s.status === 'rejected'
            ? s.reason instanceof Error ? s.reason.message : String(s.reason)
            : 'Özet alınamadı.';
        satirlar.push({
          ...temel,
          apartmanSayisi: 0, bagimsizBolumSayisi: 0, malikSayisi: 0,
          kiraciSayisi: 0, sakinSayisi: 0, personelSayisi: 0,
          daireGorevlisiSayisi: 0, icerideMisafirSayisi: 0,
          ozetHatasi: sebep,
        });
        uyarilar.push({
          projeTenantId: d.projeTenantId, projeAdi: d.proje.ad,
          siddet: 'KRITIK', konu: 'Özet okunamadı',
          mesaj: `${d.proje.ad} projesinin özeti alınamadı; sayımlar eksik.`,
        });
        return;
      }

      const o = s.value;
      toplamBina += o.apartmanSayisi;
      toplamBolum += o.bagimsizBolumSayisi;
      toplamMalik += o.malikSayisi;
      toplamKiraci += o.kiraciSayisi;
      toplamSakin += o.sakinSayisi;
      toplamPersonel += o.personelSayisi;
      toplamGorevli += o.daireGorevlisiSayisi;
      toplamMisafir += o.icerideMisafirSayisi;
      tahakkuk = tahakkuk.add(o.tahakkuk);
      tahsil = tahsil.add(o.tahsil);
      gecikmis += o.gecikmisBorcSayisi;

      satirlar.push({
        ...temel,
        apartmanSayisi: o.apartmanSayisi,
        bagimsizBolumSayisi: o.bagimsizBolumSayisi,
        malikSayisi: o.malikSayisi,
        kiraciSayisi: o.kiraciSayisi,
        sakinSayisi: o.sakinSayisi,
        personelSayisi: o.personelSayisi,
        daireGorevlisiSayisi: o.daireGorevlisiSayisi,
        icerideMisafirSayisi: o.icerideMisafirSayisi,
        ozetHatasi: null,
      });

      if (o.bagimsizBolumSayisi === 0) {
        uyarilar.push({
          projeTenantId: d.projeTenantId, projeAdi: d.proje.ad,
          siddet: 'UYARI', konu: 'Bağımsız bölüm yok',
          mesaj: `${d.proje.ad} projesinde hiç bağımsız bölüm tanımlı değil; ` +
            'tahakkuk yapılamaz.',
        });
      }
      if (o.gecikmisBorcSayisi > 0) {
        uyarilar.push({
          projeTenantId: d.projeTenantId, projeAdi: d.proje.ad,
          siddet: 'UYARI', konu: 'Vadesi geçmiş borç',
          mesaj: `${d.proje.ad}: ${o.gecikmisBorcSayisi} borç kaydı vadesini geçti.`,
        });
      }
      if (o.sertifikasiDolanPersonel > 0) {
        uyarilar.push({
          projeTenantId: d.projeTenantId, projeAdi: d.proje.ad,
          siddet: 'KRITIK', konu: 'Sertifika süresi doldu',
          mesaj: `${d.proje.ad}: ${o.sertifikasiDolanPersonel} personelin ` +
            'sertifikası süresi dolmuş — süresi geçmiş belgeyle çalıştırmak ' +
            'idari yaptırım sebebidir.',
        });
      }
      if (d.proje.durum === 'KURULUM') {
        uyarilar.push({
          projeTenantId: d.projeTenantId, projeAdi: d.proje.ad,
          siddet: 'UYARI', konu: 'Kurulum tamamlanmadı',
          mesaj: `${d.proje.ad} hâlâ KURULUM durumunda; iş işlemi yapılamaz.`,
        });
      }
    });

    const kalan = tahakkuk.sub(tahsil);

    return {
      yonetimTenantId: principal.tenantId,
      yonetimAdi: firma.ad,
      projeSayisi: satirlar.length,
      siteSayisi: satirlar.filter((p) => p.tip === 'SITE').length,
      apartmanSayisi: satirlar.filter((p) => p.tip === 'APARTMAN').length,
      toplamApartmanBinasi: toplamBina,
      toplamBagimsizBolum: toplamBolum,
      toplamMalik: toplamMalik,
      toplamKiraci: toplamKiraci,
      toplamSakin: toplamSakin,
      toplamPersonel: toplamPersonel,
      toplamDaireGorevlisi: toplamGorevli,
      icerideMisafir: toplamMisafir,
      // AÇIK İŞ EMRİ ve BEKLEYEN TALEP: modülleri henüz yok. Uydurma sayı
      // üretilmez (BFS: sahte veri yasağı); -1 "veri yok" demektir ve arayüz
      // bunu "Hazır değil" olarak gösterir.
      acikIsEmri: -1,
      bekleyenTalep: -1,
      tahsilatDurumu: {
        // Para METİN döner (ADR-0007 · BFS v1 §11): JSON `number` float'tır.
        tahakkuk: tahakkuk.toFixed(2),
        tahsil: tahsil.toFixed(2),
        kalan: kalan.toFixed(2),
        // Oran Decimal aritmetiğiyle hesaplanıp SONRA tam sayıya indirilir;
        // `Number(tahsil) / Number(tahakkuk)` float yuvarlaması yapardı.
        oranBinde: tahakkuk.isZero()
          ? null
          : Number(tahsil.mul(1000).div(tahakkuk).toFixed(0)),
      },
      kritikUyarilar: uyarilar,
      // AI önerileri VERİDEN türetilir; model çağrısı yoktur. Uydurma bir
      // "yapay zekâ" metni üretmek, olmayan bir yeteneği varmış gibi gösterir.
      aiOnerileri: this.onerileriTuret(uyarilar, gecikmis, satirlar.length),
      projeler: satirlar,
      okunamayanProjeSayisi: okunamayan,
    };
  }

  /**
   * Kontrol merkezindeki öneriler — VERİDEN türetilir, model çağrısı YOKTUR.
   *
   * Bir dil modeline bağlanana kadar buradaki metinler kural tabanlıdır ve
   * bunu gizlemez. Sahte bir "AI cevabı" üretmek, olmayan bir yeteneği varmış
   * gibi gösterirdi.
   */
  private onerileriTuret(
    uyarilar: readonly KritikUyari[],
    gecikmisBorc: number,
    projeSayisi: number,
  ): readonly string[] {
    const oneriler: string[] = [];
    const kritik = uyarilar.filter((u) => u.siddet === 'KRITIK').length;

    if (kritik > 0) {
      oneriler.push(
        `${kritik} kritik uyarı var; en riskli projelerden başlanması önerilir.`,
      );
    }
    if (gecikmisBorc > 0) {
      oneriler.push(
        `Portföyde ${gecikmisBorc} vadesi geçmiş borç kaydı var. ` +
          'Gecikme tazminatı KMK md. 20/son uyarınca aylık %5\'i geçemez ve ' +
          'ANA BORÇTAN AYRI bir kalem olarak işletilmelidir.',
      );
    }
    const kurulum = uyarilar.filter((u) => u.konu === 'Kurulum tamamlanmadı').length;
    if (kurulum > 0) {
      oneriler.push(
        `${kurulum} proje hâlâ KURULUM durumunda; aktifleştirilmeden tahakkuk yapılamaz.`,
      );
    }
    if (oneriler.length === 0 && projeSayisi > 0) {
      oneriler.push('Portföyde açık kritik bulgu yok.');
    }
    return oneriler;
  }

  // ---------------------------------------------------------------- yazma

  /**
   * PROJEYE GİRİŞ — devredilmiş proje için kapsamlı jeton üretir.
   *
   * Firma kullanıcısının projede AYRI bir `kullanici` kaydı YOKTUR; jeton
   * `tid = proje` ve `dvr = firma` taşır, Kapı 2 devri doğrular. İzinler
   * firmadaki rolünden gelir ve KOPYALANMAZ — istekle birlikte gelen
   * `principal.izinler` kullanılır, böylece rol değişikliği bir sonraki
   * girişte etkisini gösterir.
   *
   * İşlem DENETİME YAZILIR: projede yapılan her şeyin "hangi firma adına"
   * yapıldığı sorulabilir olmalıdır.
   */
  async projeyeGir(
    projeTenantId: string,
    principal: Principal,
  ): Promise<{
    readonly accessToken: string;
    readonly projeTenantId: string;
    readonly projeAdi: string;
    readonly devirDayanagi: string;
  }> {
    const baglam = mevcutBaglamiZorunluKil('portfoy.projeyeGir');
    const simdi = bugun();

    const devir = await this.prisma.tenantIslemi(
      (tx) =>
        tx.yonetimDelegasyonu.findFirst({
          where: {
            yonetimTenantId: principal.tenantId,
            projeTenantId,
            durum: 'AKTIF',
          },
          include: { projeTenant: { select: { ad: true, durum: true } } },
        }),
      principal.tenantId,
    );
    if (!devir) {
      throw new KayitBulunamadi(
        `Bu projenin yönetimi firmanıza devredilmemiş: ${projeTenantId}`,
      );
    }

    const alan: YonetimDevri = {
      id: devir.id,
      yonetimTenantId: devir.yonetimTenantId,
      projeTenantId: devir.projeTenantId,
      durum: devir.durum,
      dayanak: devir.dayanak,
      baslangic: gun(devir.baslangic),
      bitis: devir.bitis === null ? null : gun(devir.bitis),
    };
    if (!devirGecerliMi(alan, simdi)) {
      throw new IsKuraliIhlali(
        `Devir ${simdi} tarihinde geçerli değil ` +
          `(${alan.baslangic} – ${alan.bitis ?? 'süresiz'}).`,
        'Devir tarihlerini güncelleyin ya da yeni devir kaydı açın.',
      );
    }

    // Jeton ömrü GİRİŞ jetonuyla aynıdır; devir oturumu ayrıcalıklı değildir.
    const accessToken = await this.jwt.signAsync(
      {
        sub: principal.id,
        tip: principal.tip,
        tid: projeTenantId,
        izinler: principal.izinler,
        dvr: principal.tenantId,
      },
      { expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m' },
    );

    await this.prisma.tenantIslemi(async (tx) => {
      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'YonetimDelegasyonu', varlikId: devir.id,
        sonrakiDeger: {
          islem: 'PROJEYE_GIRIS',
          projeTenantId,
          projeAdi: devir.projeTenant.ad,
          dayanak: devir.dayanak,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });
    }, principal.tenantId);

    return {
      accessToken,
      projeTenantId,
      projeAdi: devir.projeTenant.ad,
      devirDayanagi: devir.dayanak,
    };
  }

  /** Yeni devir kaydı — projenin yönetimini firmaya bağlar. */
  async devirEkle(dto: DevirEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('portfoy.devirEkle');
    const id = randomUUID();
    const baslangic = takvimTarihi(dto.baslangic);
    const bitis = dto.bitis === undefined ? null : takvimTarihi(dto.bitis);

    return this.prisma.tenantIslemi(async (tx) => {
      const firma = await tx.tenant.findFirst({
        where: { id: principal.tenantId }, select: { tip: true },
      });
      if (!firma) throw new KayitBulunamadi('Yönetim firması bulunamadı.');

      // Proje tenant'ı FİRMA bağlamında okunamaz — başka bir tenant'tır ve
      // `tenant` tablosu RLS taşımaz ama satırı okumak yine de politikaya
      // tabidir. Bu yüzden proje kendi bağlamında okunur.
      const proje = await this.prisma.tenantIslemi(
        (ptx) =>
          ptx.tenant.findFirst({
            where: { id: dto.projeTenantId }, select: { tip: true, ad: true },
          }),
        tenantId(dto.projeTenantId),
      );
      if (!proje) throw new KayitBulunamadi(`Proje bulunamadı: ${dto.projeTenantId}`);

      const mevcut = await tx.yonetimDelegasyonu.findFirst({
        where: { projeTenantId: dto.projeTenantId, durum: 'AKTIF' },
        select: {
          id: true, yonetimTenantId: true, projeTenantId: true, durum: true,
          dayanak: true, baslangic: true, bitis: true,
        },
      });

      devriDogrula(
        {
          yonetimTenantId: principal.tenantId,
          yonetimTenantTipi: firma.tip,
          projeTenantId: dto.projeTenantId,
          projeTenantTipi: proje.tip,
          dayanak: dto.dayanak,
          baslangic,
          bitis,
        },
        mevcut === null
          ? null
          : {
              id: mevcut.id,
              yonetimTenantId: mevcut.yonetimTenantId,
              projeTenantId: mevcut.projeTenantId,
              durum: mevcut.durum,
              dayanak: mevcut.dayanak,
              baslangic: gun(mevcut.baslangic),
              bitis: mevcut.bitis === null ? null : gun(mevcut.bitis),
            },
      );

      await tx.yonetimDelegasyonu.create({
        data: {
          id,
          yonetimTenantId: principal.tenantId,
          projeTenantId: dto.projeTenantId,
          durum: 'AKTIF',
          dayanak: dto.dayanak.trim(),
          baslangic: new Date(baslangic),
          bitis: bitis === null ? null : new Date(bitis),
          verenKullanici: principal.id,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'YonetimDelegasyonu', varlikId: id,
        sonrakiDeger: {
          projeTenantId: dto.projeTenantId, projeAdi: proje.ad,
          dayanak: dto.dayanak, baslangic, bitis,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    }, principal.tenantId);
  }

  /**
   * Devri sona erdirir — KAYIT SİLİNMEZ, durumu değişir.
   *
   * Hangi firmanın hangi tarihte yetkili olduğu, geçmişe dönük her tahakkukun
   * dayanağıdır; silinirse o dayanak kaybolur.
   */
  async devirSonlandir(
    id: string, dto: DevirSonlandirDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('portfoy.devirSonlandir');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.yonetimDelegasyonu.findFirst({
        where: { id, yonetimTenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Devir kaydı bulunamadı: ${id}`);

      const bitis = dto.bitis === undefined ? bugun() : takvimTarihi(dto.bitis);
      const baslangic = gun(kayit.baslangic);
      if (bitis < baslangic) {
        throw new DogrulamaHatasi(
          `Devir bitişi (${bitis}) başlangıçtan (${baslangic}) önce olamaz.`,
        );
      }

      devirSonlandirmayiDogrula(
        {
          id: kayit.id,
          yonetimTenantId: kayit.yonetimTenantId,
          projeTenantId: kayit.projeTenantId,
          durum: kayit.durum,
          dayanak: kayit.dayanak,
          baslangic,
          bitis: kayit.bitis === null ? null : gun(kayit.bitis),
        },
        dto.gerekce,
      );

      await tx.yonetimDelegasyonu.update({
        where: { id },
        data: {
          durum: dto.iptalMi === true ? 'IPTAL' : 'SONA_ERDI',
          bitis: new Date(bitis),
          sonaErdirmeGerekcesi: dto.gerekce.trim(),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'YonetimDelegasyonu', varlikId: id,
        oncekiDeger: { durum: 'AKTIF', bitis: kayit.bitis === null ? null : gun(kayit.bitis) },
        sonrakiDeger: { durum: dto.iptalMi === true ? 'IPTAL' : 'SONA_ERDI', bitis },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: dto.iptalMi === true ? 'IPTAL' : 'SONA_ERDI' };
    }, principal.tenantId);
  }
}
