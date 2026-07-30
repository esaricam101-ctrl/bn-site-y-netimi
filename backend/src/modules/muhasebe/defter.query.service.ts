/**
 * Defterler ve dökümler — sorgu tarafı (CQRS).
 *
 * Yevmiye Defteri · Büyük Defter (muavin) · Kasa Defteri · Mizan.
 *
 * ⚠️  TASLAK FİŞ DEFTERE GİRMEZ. İşlenmemiş bir kayıt mali tabloya giremez;
 *     aksi hâlde yayımlanan mizan, henüz onaylanmamış kayıtları içerir.
 *     Parametre `taslakMizanaGirer` bunu bilinçli olarak açabilir.
 *
 * ⚠️  PARA DECIMAL İLE TOPLANIR, `Number` İLE DEĞİL. Kuruşu `Number`'a
 *     çevirip toplamak float yuvarlaması yapar ve mizan borç/alacak denkliği
 *     0,01 sapar — tam olarak yakalamak istediğimiz hata (ADR-0007).
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { dogalBakiyeYonu } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

/** Deftere giren fiş durumları. Taslak varsayılan olarak DIŞARIDA. */
function defterDurumlari(taslakDahil: boolean): readonly ('TASLAK' | 'ISLENDI' | 'TERS_KAYITLI')[] {
  // TERS_KAYITLI fiş DEFTERDE KALIR: storno onu iptal etmez, karşı kayıtla
  // etkisini sıfırlar. Defterden çıkarılsaydı ters kayıt tek taraflı kalır ve
  // mizan denk olmazdı.
  return taslakDahil ? ['TASLAK', 'ISLENDI', 'TERS_KAYITLI'] : ['ISLENDI', 'TERS_KAYITLI'];
}

export interface YevmiyeSatirDokumu {
  readonly fisId: string;
  readonly fisNo: string;
  readonly yevmiyeSiraNo: number | null;
  readonly tarih: string;
  readonly fisTuru: string;
  readonly durum: string;
  readonly fisAciklamasi: string;
  readonly hesapKodu: string;
  readonly hesapAdi: string;
  readonly satirAciklamasi: string | null;
  readonly borc: string;
  readonly alacak: string;
  readonly kapiNo: string | null;
}

export interface MuavinSatiri {
  readonly tarih: string;
  readonly fisNo: string;
  readonly yevmiyeSiraNo: number | null;
  readonly aciklama: string;
  readonly borc: string;
  readonly alacak: string;
  /** Yürüyen bakiye — satır satır birikimli. */
  readonly bakiye: string;
}

export interface MuavinDokumu {
  readonly hesapId: string;
  readonly hesapKodu: string;
  readonly hesapAdi: string;
  readonly hesapTipi: string;
  readonly bakiyeYonu: 'BORC' | 'ALACAK';
  /** Dönem başı devir — aralıktan ÖNCEKİ hareketlerin neti. */
  readonly acilisBakiyesi: string;
  readonly satirlar: readonly MuavinSatiri[];
  readonly borcToplam: string;
  readonly alacakToplam: string;
  readonly kapanisBakiyesi: string;
}

export interface MizanSatirDokumu {
  readonly hesapId: string;
  readonly kod: string;
  readonly ad: string;
  readonly tip: string;
  readonly seviye: number;
  readonly borcToplam: string;
  readonly alacakToplam: string;
  readonly borcBakiye: string;
  readonly alacakBakiye: string;
}

export interface MizanDokumu {
  readonly baslangic: string;
  readonly bitis: string;
  readonly satirlar: readonly MizanSatirDokumu[];
  readonly borcToplam: string;
  readonly alacakToplam: string;
  readonly borcBakiyeToplam: string;
  readonly alacakBakiyeToplam: string;
  /** Borç = alacak mı — false ise deftere denk olmayan fiş girmiş demektir. */
  readonly denkMi: boolean;
}

@Injectable()
export class DefterQueryServisi {
  constructor(private readonly prisma: PrismaService) {}

  private async taslakDahilMi(principal: Principal): Promise<boolean> {
    const p = await this.prisma.tenantIslemi(
      (tx) =>
        tx.muhasebeParametresi.findFirst({
          where: { tenantId: principal.tenantId },
          select: { taslakMizanaGirer: true },
        }),
      principal.tenantId,
    );
    return p?.taslakMizanaGirer ?? false;
  }

  /**
   * YEVMİYE DEFTERİ — tarih sırasına göre bütün fiş satırları.
   *
   * Sıralama: yevmiye sıra no varsa ONA göre, yoksa tarih + fiş no. VUK
   * md. 183 yevmiye defterinin tarih sırasıyla tutulmasını ister; sıra no
   * yeniden numaralandırmayla verilir (bkz. `DonemServisi`).
   */
  async yevmiyeDefteri(
    principal: Principal,
    aralik: { readonly baslangic: string; readonly bitis: string },
  ): Promise<readonly YevmiyeSatirDokumu[]> {
    const taslakDahil = await this.taslakDahilMi(principal);

    const fisler = await this.prisma.tenantIslemi(
      (tx) =>
        tx.yevmiyeFisi.findMany({
          where: {
            tenantId: principal.tenantId,
            tarih: { gte: new Date(aralik.baslangic), lte: new Date(aralik.bitis) },
            durum: { in: defterDurumlari(taslakDahil) as never },
          },
          include: {
            satirlar: {
              include: {
                hesap: { select: { kod: true, ad: true } },
              },
              orderBy: { borc: 'desc' },
            },
          },
          orderBy: [
            { yevmiyeSiraNo: 'asc' },
            { tarih: 'asc' },
            { fisNo: 'asc' },
          ],
        }),
      principal.tenantId,
    );

    // Kapı numaraları TEK SORGUDA çözülür: satır başına sorgu atmak N+1 üretir
    // ve yevmiye defteri binlerce satır olabilir.
    const bolumIdler = [
      ...new Set(
        fisler.flatMap((f) => f.satirlar.map((s) => s.bolumId).filter((b): b is string => b !== null)),
      ),
    ];
    const bolumler = bolumIdler.length === 0
      ? []
      : await this.prisma.tenantIslemi(
          (tx) =>
            tx.bagimsizBolum.findMany({
              where: { id: { in: bolumIdler }, tenantId: principal.tenantId },
              select: { id: true, kapiNo: true },
            }),
          principal.tenantId,
        );
    const kapiHaritasi = new Map(bolumler.map((b) => [b.id, b.kapiNo]));

    return fisler.flatMap((f) =>
      f.satirlar.map((s) => ({
        fisId: f.id,
        fisNo: f.fisNo,
        yevmiyeSiraNo: f.yevmiyeSiraNo,
        tarih: gun(f.tarih),
        fisTuru: f.fisTuru,
        durum: f.durum,
        fisAciklamasi: f.aciklama,
        hesapKodu: s.hesap.kod,
        hesapAdi: s.hesap.ad,
        satirAciklamasi: s.aciklama,
        // Para METİN döner (ADR-0007 · BFS v1 §11): JSON number float'tır.
        borc: s.borc.toFixed(2),
        alacak: s.alacak.toFixed(2),
        kapiNo: s.bolumId === null ? null : kapiHaritasi.get(s.bolumId) ?? null,
      })),
    );
  }

  /**
   * BÜYÜK DEFTER / MUAVİN — tek hesabın hareket dökümü.
   *
   * AÇILIŞ BAKİYESİ aralıktan ÖNCEKİ hareketlerin netidir. Hesaplanmasaydı
   * dönem içi döküm, hesabın devrini göstermez ve yürüyen bakiye yanlış
   * başlardı.
   */
  async muavin(
    principal: Principal,
    hesapId: string,
    aralik: { readonly baslangic: string; readonly bitis: string },
  ): Promise<MuavinDokumu | null> {
    const taslakDahil = await this.taslakDahilMi(principal);
    const durumlar = defterDurumlari(taslakDahil) as never;

    return this.prisma.tenantIslemi(async (tx) => {
      const hesap = await tx.hesap.findFirst({
        where: { id: hesapId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, kod: true, ad: true, tip: true },
      });
      if (!hesap) return null;

      // Açılış: aralıktan ÖNCEKİ hareketlerin neti.
      const oncesi = await tx.yevmiyeSatiri.aggregate({
        where: {
          tenantId: principal.tenantId, hesapId,
          fis: {
            tarih: { lt: new Date(aralik.baslangic) },
            durum: { in: durumlar },
          },
        },
        _sum: { borc: true, alacak: true },
      });
      const acilisBorc = oncesi._sum.borc ?? new Prisma.Decimal(0);
      const acilisAlacak = oncesi._sum.alacak ?? new Prisma.Decimal(0);
      // Prisma'nin `HesapTipi` enum'u domain tipiyle BIREBIR ayni; dönüşüm
      // gerekmez. Gereksiz bir `as` koyulsaydı ikisi ayrışsa da hata
      // görünmez olurdu — lint bunu yakaladı.
      const yon = dogalBakiyeYonu(hesap.tip);
      // Bakiye DOĞAL YÖNE göre işaretlenir: 100 Kasa borç bakiyeli çalışır,
      // 300 Krediler alacak bakiyeli. Tek yönlü hesaplansaydı özkaynak ve
      // borç hesapları negatif görünürdü.
      const acilis = yon === 'BORC'
        ? acilisBorc.sub(acilisAlacak)
        : acilisAlacak.sub(acilisBorc);

      const satirlar = await tx.yevmiyeSatiri.findMany({
        where: {
          tenantId: principal.tenantId, hesapId,
          fis: {
            tarih: { gte: new Date(aralik.baslangic), lte: new Date(aralik.bitis) },
            durum: { in: durumlar },
          },
        },
        include: {
          fis: { select: { fisNo: true, tarih: true, aciklama: true, yevmiyeSiraNo: true } },
        },
        orderBy: [{ fis: { tarih: 'asc' } }, { fis: { fisNo: 'asc' } }],
      });

      let yuruyen = acilis;
      let borcToplam = new Prisma.Decimal(0);
      let alacakToplam = new Prisma.Decimal(0);

      const dokum: MuavinSatiri[] = satirlar.map((s) => {
        borcToplam = borcToplam.add(s.borc);
        alacakToplam = alacakToplam.add(s.alacak);
        yuruyen = yon === 'BORC'
          ? yuruyen.add(s.borc).sub(s.alacak)
          : yuruyen.add(s.alacak).sub(s.borc);
        return {
          tarih: gun(s.fis.tarih),
          fisNo: s.fis.fisNo,
          yevmiyeSiraNo: s.fis.yevmiyeSiraNo,
          aciklama: s.aciklama ?? s.fis.aciklama,
          borc: s.borc.toFixed(2),
          alacak: s.alacak.toFixed(2),
          bakiye: yuruyen.toFixed(2),
        };
      });

      return {
        hesapId: hesap.id,
        hesapKodu: hesap.kod,
        hesapAdi: hesap.ad,
        hesapTipi: hesap.tip,
        bakiyeYonu: yon,
        acilisBakiyesi: acilis.toFixed(2),
        satirlar: dokum,
        borcToplam: borcToplam.toFixed(2),
        alacakToplam: alacakToplam.toFixed(2),
        kapanisBakiyesi: yuruyen.toFixed(2),
      };
    }, principal.tenantId);
  }

  /**
   * KASA DEFTERİ — özelliği KASA olan hesapların hareketleri.
   *
   * Hesap KODUNA bakılmaz: kod planı tenant'a göre değişir ve '100' her
   * tenant'ta kasa olmayabilir. Ayrım `hesap.ozellik` alanında VERİ olarak
   * durur (§33 kural 3). Aynı uç `ozellik=BANKA` ile Banka Defteri üretir.
   */
  async kasaDefteri(
    principal: Principal,
    aralik: { readonly baslangic: string; readonly bitis: string },
    ozellik: 'KASA' | 'BANKA' = 'KASA',
  ): Promise<readonly MuavinDokumu[]> {
    const hesaplar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.hesap.findMany({
          where: {
            tenantId: principal.tenantId, ozellik, silinmeTarihi: null,
          },
          select: { id: true },
          orderBy: { kod: 'asc' },
        }),
      principal.tenantId,
    );

    const dokumler: MuavinDokumu[] = [];
    for (const h of hesaplar) {
      const d = await this.muavin(principal, h.id, aralik);
      if (d !== null) dokumler.push(d);
    }
    return dokumler;
  }

  /**
   * MİZAN — bütün hesapların dönem toplamları ve bakiyeleri.
   *
   * `denkMi` yanıtta DÖNER ve gizlenmez: borç ≠ alacak ise deftere denk
   * olmayan bir fiş girmiş demektir ve kullanıcı bunu raporun kendisinden
   * görmelidir. Sessizce düzeltmek, hatanın kaynağını gizlerdi.
   */
  async mizan(
    principal: Principal,
    aralik: { readonly baslangic: string; readonly bitis: string },
  ): Promise<MizanDokumu> {
    const taslakDahil = await this.taslakDahilMi(principal);
    const durumlar = defterDurumlari(taslakDahil) as never;

    return this.prisma.tenantIslemi(async (tx) => {
      const hesaplar = await tx.hesap.findMany({
        where: { tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, kod: true, ad: true, tip: true },
        orderBy: { kod: 'asc' },
      });

      const gruplar = await tx.yevmiyeSatiri.groupBy({
        by: ['hesapId'],
        where: {
          tenantId: principal.tenantId,
          fis: {
            tarih: { gte: new Date(aralik.baslangic), lte: new Date(aralik.bitis) },
            durum: { in: durumlar },
          },
        },
        _sum: { borc: true, alacak: true },
      });
      const haritalar = new Map(
        gruplar.map((g) => [
          g.hesapId,
          {
            borc: g._sum.borc ?? new Prisma.Decimal(0),
            alacak: g._sum.alacak ?? new Prisma.Decimal(0),
          },
        ]),
      );

      let borcToplam = new Prisma.Decimal(0);
      let alacakToplam = new Prisma.Decimal(0);
      let borcBakiyeToplam = new Prisma.Decimal(0);
      let alacakBakiyeToplam = new Prisma.Decimal(0);

      const satirlar: MizanSatirDokumu[] = [];
      for (const h of hesaplar) {
        const t = haritalar.get(h.id);
        const borc = t?.borc ?? new Prisma.Decimal(0);
        const alacak = t?.alacak ?? new Prisma.Decimal(0);
        // Hareketsiz hesap mizanda GÖSTERİLMEZ: yüzlerce sıfır satır raporu
        // okunamaz kılar. Hesap planı dökümü ayrı bir uçtur.
        if (borc.isZero() && alacak.isZero()) continue;

        // Bakiye TEK TARAFTA gösterilir; iki tarafa da yazılsaydı mizan
        // toplamları aynı tutarı iki kez sayardı.
        const borcBakiye = borc.gt(alacak) ? borc.sub(alacak) : new Prisma.Decimal(0);
        const alacakBakiye = alacak.gt(borc) ? alacak.sub(borc) : new Prisma.Decimal(0);

        borcToplam = borcToplam.add(borc);
        alacakToplam = alacakToplam.add(alacak);
        borcBakiyeToplam = borcBakiyeToplam.add(borcBakiye);
        alacakBakiyeToplam = alacakBakiyeToplam.add(alacakBakiye);

        satirlar.push({
          hesapId: h.id, kod: h.kod, ad: h.ad, tip: h.tip,
          seviye: h.kod.split('.').length - 1,
          borcToplam: borc.toFixed(2),
          alacakToplam: alacak.toFixed(2),
          borcBakiye: borcBakiye.toFixed(2),
          alacakBakiye: alacakBakiye.toFixed(2),
        });
      }

      return {
        baslangic: aralik.baslangic,
        bitis: aralik.bitis,
        satirlar,
        borcToplam: borcToplam.toFixed(2),
        alacakToplam: alacakToplam.toFixed(2),
        borcBakiyeToplam: borcBakiyeToplam.toFixed(2),
        alacakBakiyeToplam: alacakBakiyeToplam.toFixed(2),
        denkMi: borcToplam.equals(alacakToplam),
      };
    }, principal.tenantId);
  }

  /** Fiş listesi — süzgeçli, sayfalı. Fiş detayı satırlarıyla döner. */
  async fisListele(
    principal: Principal,
    suzgec: {
      readonly baslangic?: string; readonly bitis?: string;
      readonly fisTuru?: string; readonly durum?: string;
      readonly arama?: string; readonly limit?: number;
    } = {},
  ): Promise<readonly {
    readonly id: string; readonly fisNo: string; readonly tarih: string;
    readonly fisTuru: string; readonly durum: string; readonly aciklama: string;
    readonly yevmiyeSiraNo: number | null; readonly kaynakTipi: string;
    readonly satirSayisi: number; readonly borcToplam: string;
  }[]> {
    const aramaMetni = suzgec.arama?.trim();

    const fisler = await this.prisma.tenantIslemi(
      (tx) =>
        tx.yevmiyeFisi.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.baslangic !== undefined && suzgec.bitis !== undefined
              ? { tarih: { gte: new Date(suzgec.baslangic), lte: new Date(suzgec.bitis) } }
              : {}),
            ...(suzgec.fisTuru ? { fisTuru: suzgec.fisTuru as never } : {}),
            ...(suzgec.durum ? { durum: suzgec.durum as never } : {}),
            ...(aramaMetni
              ? {
                  OR: [
                    { fisNo: { contains: aramaMetni, mode: 'insensitive' as const } },
                    { aciklama: { contains: aramaMetni, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          include: { satirlar: { select: { borc: true } } },
          orderBy: [{ tarih: 'desc' }, { fisNo: 'desc' }],
          // Sayfalama sınırı: sınırsız liste binlerce satırla tarayıcıyı kilitler.
          take: Math.min(suzgec.limit ?? 100, 500),
        }),
      principal.tenantId,
    );

    return fisler.map((f) => ({
      id: f.id,
      fisNo: f.fisNo,
      tarih: gun(f.tarih),
      fisTuru: f.fisTuru,
      durum: f.durum,
      aciklama: f.aciklama,
      yevmiyeSiraNo: f.yevmiyeSiraNo,
      kaynakTipi: f.kaynakTipi,
      satirSayisi: f.satirlar.length,
      borcToplam: f.satirlar
        .reduce((t, s) => t.add(s.borc), new Prisma.Decimal(0))
        .toFixed(2),
    }));
  }
}
