/**
 * Sayaç servisi — TUKETIM paylaşım kuralının girdisi.
 *
 * `gideriPaylastir` TUKETIM kuralında ağırlık olarak tüketim değerini alır.
 * O değer BURADA hesaplanır; yanlış hesaplanırsa yanlış dağıtım SESSİZDİR:
 * toplam gider korunur, yalnızca kişiler arasındaki paylar bozulur ve kimse
 * fark etmez.
 *
 * ÜÇ KURAL — üçü de domain katmanında (`shared/apartman-domain/src/sayac`)
 * tanımlıdır; burada yalnızca kalıcılık ve sıralama vardır:
 *
 *   1. SAYAÇ GERİYE GİTMEZ. Küçülen okuma reddedilir.
 *   2. DEVİR AÇIK BAYRAK İSTER. 99998 → 3 okuması ya devirdir ya hatadır;
 *      tahmin edilirse tüketim 100 000 kat yanlış hesaplanır.
 *   3. DEĞİŞİM DÖNEMİNDE TÜKETİM İKİ PARÇANIN TOPLAMIDIR. Yalnızca yeni
 *      sayaca bakmak, eski sayacın son günlerini sessizce kaybettirir.
 *
 * TÜKETİM SAKLANIR (snapshot). Sorgu anında yeniden hesaplansaydı, bir okuma
 * sonradan düzeltildiğinde geçmiş dönemlerin dağıtımı kendiliğinden değişir
 * ve tahsil edilmiş aidatla tutmazdı.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { takvimTarihi, type Principal, type TakvimTarihi } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  degisimDonemiTuketimi, sayacAktifMi, tuketimHesapla, tuketimMetni,
  type Sayac, type SayacOkumasi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { OkumaEkleDto, SayacSokDto, SayacTakDto } from './dto/sayac.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface SayacSatiri {
  readonly id: string;
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly tur: string;
  readonly seriNo: string;
  readonly basamak: number;
  readonly olcekBasamak: number;
  readonly takilmaTarihi: string;
  readonly sokulmeTarihi: string | null;
  readonly ilkDeger: string;
  readonly oncekiSayacId: string | null;
  readonly aktifMi: boolean;
  /** En son okunan gösterge değeri. Okuma yoksa `ilkDeger`. */
  readonly sonDeger: string;
  readonly sonOkumaTarihi: string | null;
  readonly okumaSayisi: number;
}

export interface OkumaSatiri {
  readonly id: string;
  readonly tarih: string;
  readonly deger: string;
  readonly devirMi: boolean;
  readonly tuketim: string;
  /** Ölçeğe göre biçimlendirilmiş tüketim — YALNIZCA gösterim için. */
  readonly tuketimMetni: string;
  readonly kaynak: string;
  readonly notu: string | null;
}

export interface BolumTuketimi {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly tur: string;
  readonly tuketim: string;
  readonly tuketimMetni: string;
  /** Dönemde kaç sayaç katkı verdi — 1'den büyükse sayaç değişmiştir. */
  readonly sayacSayisi: number;
  /** Dönemde hiç okuma yoksa true; tahakkuk bu bölümü ATLAYAMAZ, uyarmalıdır. */
  readonly okumaYokMu: boolean;
}

function gun(d: Date): TakvimTarihi {
  return takvimTarihi(d.toISOString().slice(0, 10));
}

function bugun(): TakvimTarihi {
  return takvimTarihi(new Date().toISOString().slice(0, 10));
}

/** Prisma satırını domain `Sayac` şekline çevirir. */
interface SayacKaydi {
  id: string; bolumId: string; tur: string; seriNo: string;
  basamak: number; olcekBasamak: number;
  takilmaTarihi: Date; sokulmeTarihi: Date | null; ilkDeger: bigint;
}

function domaine(k: SayacKaydi): Sayac {
  return {
    id: k.id,
    bolumId: k.bolumId,
    tur: k.tur as Sayac['tur'],
    seriNo: k.seriNo,
    basamak: k.basamak,
    olcekBasamak: k.olcekBasamak,
    takilmaTarihi: gun(k.takilmaTarihi),
    sokulmeTarihi: k.sokulmeTarihi === null ? null : gun(k.sokulmeTarihi),
    ilkDeger: k.ilkDeger,
  };
}

@Injectable()
export class SayacServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
  ) {}

  // ---------------------------------------------------------------- listeleme

  async listele(
    principal: Principal,
    suzgec: { readonly bolumId?: string; readonly tur?: string; readonly yalnizcaAktif?: boolean } = {},
  ): Promise<readonly SayacSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      (tx) =>
        tx.sayac.findMany({
          where: {
            tenantId: principal.tenantId,
            ...(suzgec.bolumId ? { bolumId: suzgec.bolumId } : {}),
            ...(suzgec.tur ? { tur: suzgec.tur as never } : {}),
            ...(suzgec.yalnizcaAktif === true ? { sokulmeTarihi: null } : {}),
          },
          include: {
            bolum: { select: { kapiNo: true } },
            // Son okuma: gösterge değeri buradan gelir. Ayrı sorgu atmak
            // sayaç başına bir gidiş geliş demek olurdu (N+1).
            okumalar: {
              select: { tarih: true, deger: true },
              orderBy: { tarih: 'desc' },
              take: 1,
            },
            _count: { select: { okumalar: true } },
          },
          orderBy: [{ sokulmeTarihi: 'asc' }, { seriNo: 'asc' }],
        }),
      principal.tenantId,
    );

    const simdi = bugun();
    return kayitlar.map((s) => {
      const son = s.okumalar[0];
      return {
        id: s.id,
        bolumId: s.bolumId,
        kapiNo: s.bolum.kapiNo,
        tur: s.tur,
        seriNo: s.seriNo,
        basamak: s.basamak,
        olcekBasamak: s.olcekBasamak,
        takilmaTarihi: gun(s.takilmaTarihi),
        sokulmeTarihi: s.sokulmeTarihi === null ? null : gun(s.sokulmeTarihi),
        ilkDeger: s.ilkDeger.toString(),
        oncekiSayacId: s.oncekiSayacId,
        aktifMi: sayacAktifMi(domaine(s), simdi),
        sonDeger: (son?.deger ?? s.ilkDeger).toString(),
        sonOkumaTarihi: son === undefined ? null : gun(son.tarih),
        okumaSayisi: s._count.okumalar,
      };
    });
  }

  async okumalar(sayacId: string, principal: Principal): Promise<readonly OkumaSatiri[]> {
    const kayitlar = await this.prisma.tenantIslemi(
      async (tx) => {
        const sayac = await tx.sayac.findFirst({
          where: { id: sayacId, tenantId: principal.tenantId },
        });
        if (!sayac) throw new KayitBulunamadi(`Sayaç bulunamadı: ${sayacId}`);
        const okumalar = await tx.sayacOkumasi.findMany({
          where: { tenantId: principal.tenantId, sayacId },
          orderBy: { tarih: 'desc' },
        });
        return { sayac, okumalar };
      },
      principal.tenantId,
    );

    const s = domaine(kayitlar.sayac);
    return kayitlar.okumalar.map((o) => ({
      id: o.id,
      tarih: gun(o.tarih),
      deger: o.deger.toString(),
      devirMi: o.devirMi,
      tuketim: o.tuketim.toString(),
      tuketimMetni: tuketimMetni(s, o.tuketim),
      kaynak: o.kaynak,
      notu: o.notu,
    }));
  }

  // ------------------------------------------------------------------- yazma

  /**
   * Sayaç takar. `oncekiSayacId` verilirse eski sayaç AYNI İŞLEMDE sökülür
   * ve zincir kurulur — iki ayrı çağrıda yapılsaydı, arada kalan sürede iki
   * sayaç birden aktif görünür ve tüketim iki kez sayılırdı.
   */
  async tak(dto: SayacTakDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sayac.tak');
    const takilma = takvimTarihi(dto.takilmaTarihi);
    const id = randomUUID();
    const ilkDeger = BigInt(dto.ilkDeger ?? '0');

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: dto.bolumId, tenantId: principal.tenantId },
        select: { id: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${dto.bolumId}`);

      // İlk değer gösterge sınırını aşamaz; aşarsa devir hesabı anlamsızlaşır.
      const sinir = 10n ** BigInt(dto.basamak);
      if (ilkDeger >= sinir) {
        throw new IsKuraliIhlali(
          `İlk değer (${ilkDeger}) ${dto.basamak} basamağı aşıyor.`,
          'Basamak sayısını ya da ilk değeri düzeltin.',
        );
      }

      let oncekiSayacId: string | null = null;
      if (dto.oncekiSayacId !== undefined) {
        const eski = await tx.sayac.findFirst({
          where: { id: dto.oncekiSayacId, tenantId: principal.tenantId },
        });
        if (!eski) throw new KayitBulunamadi(`Önceki sayaç bulunamadı: ${dto.oncekiSayacId}`);

        // Değişim ZİNCİRİ aynı bölüm ve aynı tür olmalıdır: farklı türdeki
        // sayaçların tüketimi toplanamaz (domain `degisimDonemiTuketimi`
        // bunu ayrıca reddeder).
        if (eski.bolumId !== dto.bolumId) {
          throw new IsKuraliIhlali(
            'Değiştirilen sayaç başka bir bağımsız bölüme ait.',
            'Doğru sayacı seçin.',
          );
        }
        if (eski.tur !== dto.tur) {
          throw new IsKuraliIhlali(
            `Değişimde sayaç türleri aynı olmalıdır (${eski.tur} / ${dto.tur}).`,
            'Farklı türdeki sayaçların tüketimi toplanmaz.',
          );
        }
        if (eski.sokulmeTarihi === null) {
          await tx.sayac.update({
            where: { id: eski.id },
            data: { sokulmeTarihi: new Date(takilma) },
          });
        }
        oncekiSayacId = eski.id;
      }

      await tx.sayac.create({
        data: {
          id, tenantId: principal.tenantId, bolumId: dto.bolumId,
          tur: dto.tur, seriNo: dto.seriNo.trim(),
          basamak: dto.basamak,
          olcekBasamak: dto.olcekBasamak ?? 0,
          takilmaTarihi: new Date(takilma),
          ilkDeger,
          oncekiSayacId,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Sayac', varlikId: id,
        sonrakiDeger: {
          seriNo: dto.seriNo, tur: dto.tur, bolumId: dto.bolumId,
          takilmaTarihi: takilma, ilkDeger: ilkDeger.toString(),
          oncekiSayacId,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** Sayacı söker. Kayıt SİLİNMEZ — geçmiş dönemin dağıtımı buna dayanır. */
  async sok(id: string, dto: SayacSokDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('sayac.sok');
    const sokulme = takvimTarihi(dto.sokulmeTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sayac.findFirst({
        where: { id, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Sayaç bulunamadı: ${id}`);
      if (kayit.sokulmeTarihi !== null) {
        throw new IsKuraliIhlali(
          `'${kayit.seriNo}' sayacı ${gun(kayit.sokulmeTarihi)} tarihinde zaten sökülmüş.`,
          'Yeni bir sayaç kaydı açın.',
        );
      }
      if (sokulme < gun(kayit.takilmaTarihi)) {
        throw new IsKuraliIhlali(
          `Sökülme (${sokulme}) takılma tarihinden (${gun(kayit.takilmaTarihi)}) önce olamaz.`,
          'Sökülme tarihini düzeltin.',
        );
      }

      // Sökülme tarihinden SONRAYA okuma varsa kayıt tutarsız kalır: sayaç
      // sökülmüşken okunmuş görünür ve tüketim yanlış döneme yazılır.
      const sonrakiOkuma = await tx.sayacOkumasi.findFirst({
        where: { tenantId: principal.tenantId, sayacId: id, tarih: { gt: new Date(sokulme) } },
        select: { tarih: true },
      });
      if (sonrakiOkuma) {
        throw new IsKuraliIhlali(
          `Sökülme tarihinden sonra okuma var (${gun(sonrakiOkuma.tarih)}).`,
          'Önce okumayı düzeltin ya da sökülme tarihini o günden sonraya alın.',
        );
      }

      await tx.sayac.update({
        where: { id },
        data: { sokulmeTarihi: new Date(sokulme) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Sayac', varlikId: id,
        oncekiDeger: { sokulmeTarihi: null }, sonrakiDeger: { sokulmeTarihi: sokulme },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'SOKULDU' };
    });
  }

  /**
   * Okuma ekler ve tüketimi hesaplayıp SAKLAR.
   *
   * Tüketim, bir önceki okumaya (yoksa `ilkDeger`) göre hesaplanır. Okumalar
   * TARİH SIRASINA göre eklenmelidir: araya geçmiş tarihli bir okuma
   * sokulursa sonraki okumaların tüketimi yanlış kalır. Bu yüzden son
   * okumadan ÖNCEKİ bir tarihe okuma girişi reddedilir.
   */
  async okumaEkle(
    sayacId: string, dto: OkumaEkleDto, principal: Principal,
  ): Promise<KomutSonucu & { tuketim: string; tuketimMetni: string }> {
    const baglam = mevcutBaglamiZorunluKil('sayac.okuma');
    const tarih = takvimTarihi(dto.tarih);
    const deger = BigInt(dto.deger);
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.sayac.findFirst({
        where: { id: sayacId, tenantId: principal.tenantId },
      });
      if (!kayit) throw new KayitBulunamadi(`Sayaç bulunamadı: ${sayacId}`);

      const sayac = domaine(kayit);

      if (tarih < sayac.takilmaTarihi) {
        throw new IsKuraliIhlali(
          `Okuma tarihi (${tarih}) sayacın takılma tarihinden (${sayac.takilmaTarihi}) önce.`,
          'Okuma tarihini düzeltin.',
        );
      }
      if (sayac.sokulmeTarihi !== null && tarih > sayac.sokulmeTarihi) {
        throw new IsKuraliIhlali(
          `Okuma tarihi (${tarih}) sayacın sökülme tarihinden (${sayac.sokulmeTarihi}) sonra.`,
          'Sökülmüş sayaca okuma girilemez; yeni sayaca girin.',
        );
      }

      const sonOkuma = await tx.sayacOkumasi.findFirst({
        where: { tenantId: principal.tenantId, sayacId },
        orderBy: { tarih: 'desc' },
        select: { tarih: true, deger: true },
      });

      if (sonOkuma !== null && tarih <= gun(sonOkuma.tarih)) {
        throw new IsKuraliIhlali(
          `Bu sayacın son okuması ${gun(sonOkuma.tarih)} tarihli; ` +
            `daha eski ya da aynı tarihe okuma eklenemez.`,
          'Araya geçmiş tarihli okuma girmek sonraki tüketimleri yanlış bırakır. ' +
            'Yanlış bir okumayı düzeltmek gerekiyorsa kaydı silmeden yeni okuma ekleyin.',
        );
      }

      const oncekiDeger = sonOkuma?.deger ?? sayac.ilkDeger;

      // TÜM KURAL DOMAIN'DE: geriye gitme reddi, devir hesabı ve basamak
      // sınırı burada tekrar YAZILMAZ.
      const okuma: SayacOkumasi = {
        sayacId,
        tarih,
        deger,
        ...(dto.devirMi === undefined ? {} : { devirMi: dto.devirMi }),
      };
      const tuketim = tuketimHesapla(sayac, oncekiDeger, okuma);

      await tx.sayacOkumasi.create({
        data: {
          id, tenantId: principal.tenantId, sayacId,
          tarih: new Date(tarih), deger,
          devirMi: dto.devirMi ?? false,
          tuketim,
          kaynak: dto.kaynak ?? 'ELLE',
          notu: dto.notu?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'SayacOkumasi', varlikId: id,
        sonrakiDeger: {
          sayacId, seriNo: sayac.seriNo, tarih,
          deger: deger.toString(), devirMi: dto.devirMi ?? false,
          oncekiDeger: oncekiDeger.toString(), tuketim: tuketim.toString(),
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id, durum: 'OKUNDU',
        tuketim: tuketim.toString(),
        tuketimMetni: tuketimMetni(sayac, tuketim),
      };
    });
  }

  // -------------------------------------------------------------- tüketim

  /**
   * Dönem tüketimi — tahakkukun TUKETIM kuralı için bölüm bölüm ağırlık.
   *
   * SAYAÇ DEĞİŞİMİ BURADA ÇÖZÜLÜR: bir bölümde dönem içinde birden çok sayaç
   * varsa tüketim hepsinin toplamıdır. Yalnızca güncel sayaca bakmak, eski
   * sayacın son günlerini sessizce kaybettirir ve o daire eksik faturalanır.
   *
   * OKUMASI OLMAYAN BÖLÜM GİZLENMEZ: `okumaYokMu` ile işaretlenir. Sessizce
   * sıfır tüketim yazmak, o daireyi ısıtma giderinden tümüyle muaf tutar ve
   * farkı diğer dairelere yükler.
   */
  async donemTuketimi(
    principal: Principal,
    tur: string,
    baslangic: string,
    bitis: string,
  ): Promise<readonly BolumTuketimi[]> {
    const bas = takvimTarihi(baslangic);
    const bit = takvimTarihi(bitis);
    if (bit < bas) {
      throw new IsKuraliIhlali(
        'Dönem bitişi başlangıçtan önce olamaz.',
        'Tarih aralığını düzeltin.',
      );
    }

    const veri = await this.prisma.tenantIslemi(
      async (tx) => {
        const bolumler = await tx.bagimsizBolum.findMany({
          where: { tenantId: principal.tenantId },
          select: { id: true, kapiNo: true },
          orderBy: { kapiNo: 'asc' },
        });
        const sayaclar = await tx.sayac.findMany({
          where: { tenantId: principal.tenantId, tur: tur as never },
          include: {
            okumalar: {
              where: { tarih: { gte: new Date(bas), lte: new Date(bit) } },
              orderBy: { tarih: 'asc' },
              select: { tuketim: true },
            },
          },
        });
        return { bolumler, sayaclar };
      },
      principal.tenantId,
    );

    const bolumeGore = new Map<string, { toplam: bigint; sayacSayisi: number; olcek: number }>();
    for (const s of veri.sayaclar) {
      // Dönemde HİÇ okuma yoksa sayaç katkı vermez ve sayılmaz; dönem
      // içindeki okumaların tüketimi zaten kaydedilmiş (snapshot) değerdir.
      if (s.okumalar.length === 0) continue;
      const toplam = s.okumalar.reduce((t, o) => t + o.tuketim, 0n);
      const mevcut = bolumeGore.get(s.bolumId);
      bolumeGore.set(s.bolumId, {
        toplam: (mevcut?.toplam ?? 0n) + toplam,
        sayacSayisi: (mevcut?.sayacSayisi ?? 0) + 1,
        olcek: s.olcekBasamak,
      });
    }

    return veri.bolumler.map((b) => {
      const kayit = bolumeGore.get(b.id);
      const toplam = kayit?.toplam ?? 0n;
      const olcek = kayit?.olcek ?? 0;
      return {
        bolumId: b.id,
        kapiNo: b.kapiNo,
        tur,
        tuketim: toplam.toString(),
        tuketimMetni: tuketimMetni(
          { olcekBasamak: olcek } as Sayac,
          toplam,
        ),
        sayacSayisi: kayit?.sayacSayisi ?? 0,
        okumaYokMu: kayit === undefined,
      };
    });
  }

  /**
   * Sayaç değişimi olan bir dönemin tüketimini AÇIKÇA iki parça olarak
   * hesaplar — denetim ve itiraz için.
   *
   * `donemTuketimi` zaten toplar; bu uç, toplamın nasıl oluştuğunu gösterir.
   * "Bu ay neden iki kalem var?" sorusunun cevabı buradadır.
   */
  async degisimTuketimi(
    yeniSayacId: string,
    principal: Principal,
  ): Promise<{
    readonly eskiSeriNo: string;
    readonly yeniSeriNo: string;
    readonly toplam: string;
    readonly toplamMetni: string;
  }> {
    return this.prisma.tenantIslemi(async (tx) => {
      const yeni = await tx.sayac.findFirst({
        where: { id: yeniSayacId, tenantId: principal.tenantId },
      });
      if (!yeni) throw new KayitBulunamadi(`Sayaç bulunamadı: ${yeniSayacId}`);
      if (yeni.oncekiSayacId === null) {
        throw new IsKuraliIhlali(
          `'${yeni.seriNo}' bir değişim sayacı değil; önceki sayaç kaydı yok.`,
          'Değişim hesabı yalnızca zincire bağlı sayaçlar için yapılır.',
        );
      }

      const eski = await tx.sayac.findFirst({
        where: { id: yeni.oncekiSayacId, tenantId: principal.tenantId },
      });
      if (!eski) throw new KayitBulunamadi(`Önceki sayaç bulunamadı: ${yeni.oncekiSayacId}`);

      const eskiOkumalar = await tx.sayacOkumasi.findMany({
        where: { tenantId: principal.tenantId, sayacId: eski.id },
        orderBy: { tarih: 'asc' },
      });
      const yeniOkumalar = await tx.sayacOkumasi.findMany({
        where: { tenantId: principal.tenantId, sayacId: yeni.id },
        orderBy: { tarih: 'asc' },
      });

      const eskiSon = eskiOkumalar[eskiOkumalar.length - 1];
      const yeniSon = yeniOkumalar[yeniOkumalar.length - 1];
      if (eskiSon === undefined || yeniSon === undefined) {
        throw new IsKuraliIhlali(
          'Değişim hesabı için her iki sayaçta da en az bir okuma gerekir.',
          'Eksik okumayı girin.',
        );
      }

      // Eski sayacın dönem başı değeri: son okumadan önceki okuma, yoksa
      // sayacın ilk değeri.
      const eskiOncekiOkuma = eskiOkumalar[eskiOkumalar.length - 2];
      const eskiDonemBasi = eskiOncekiOkuma?.deger ?? eski.ilkDeger;

      const toplam = degisimDonemiTuketimi(
        domaine(eski),
        eskiDonemBasi,
        { sayacId: eski.id, tarih: gun(eskiSon.tarih), deger: eskiSon.deger, devirMi: eskiSon.devirMi },
        domaine(yeni),
        { sayacId: yeni.id, tarih: gun(yeniSon.tarih), deger: yeniSon.deger, devirMi: yeniSon.devirMi },
      );

      return {
        eskiSeriNo: eski.seriNo,
        yeniSeriNo: yeni.seriNo,
        toplam: toplam.toString(),
        toplamMetni: tuketimMetni(domaine(yeni), toplam),
      };
    }, principal.tenantId);
  }
}
