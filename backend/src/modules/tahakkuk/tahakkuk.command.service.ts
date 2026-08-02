/**
 * Tahakkuk servisi — bir gideri bölümlere paylaştırıp borç yazar.
 *
 * ZİNCİR (her adım ayrı bir domain kuralıdır):
 *   1. Gider türü okunur — kural VERİDİR, koda gömülü değildir (KMK md. 20).
 *   2. `gideriPaylastir` gideri BÖLÜMLERE dağıtır (Eksen 1).
 *   3. `borcSorumlulariniCoz` her bölüm için borcun KİME yazılacağını
 *      çözer (Eksen 2) — malik / kiracı / sakin zinciri.
 *   4. `malikBorcunuBol` bölüme düşen payı MALİKLER ARASINDA böler (Eksen 4).
 *
 * İKİ KRİTİK KURAL:
 *
 * SNAPSHOT — sorumlu kişiler borç oluşturulduğu ANDA çözülür ve kayda
 * yazılır; sorgu anında yeniden hesaplanmaz. Kiracı Mart'ta taşınırsa Şubat
 * borcu eski kiracıda kalır. Yeniden hesaplasaydık, geçmiş borçlar taşınma
 * anında sessizce el değiştirirdi.
 *
 * TEK İŞLEM — bütün bölümlerin borcu tek transaction'da yazılır. Yarım kalan
 * bir tahakkuk, bazı dairelerin borçlandığı bazılarının borçlanmadığı bir
 * dönem bırakır; hangisinin eksik olduğu aylar sonra fark edilir.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  apiBicimi, money, moneyKurustan, takvimTarihi,
  type Principal, type TakvimTarihi,
} from '@bnos/kernel';
import { CakismaHatasi, IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  BagimsizBolum, borcSorumlulariniCoz, gideriPaylastir, malikBorcunuBol,
  type BolumIliskisi, type GiderTuru, type MalikHissesi, type PaylasimGirdisi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { NumaraServisi } from '../../common/numbering/numara.service';
import { SayacServisi } from '../sayac/sayac.service';
import { FisCommandServisi } from '../muhasebe/fis.command.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { EZILEBILIR_KURALLAR } from './dto/tahakkuk.dto';
import type {
  BolumGirdisiDto, TahakkukCalistirDto, TahakkukMuhasebelestirDto,
} from './dto/tahakkuk.dto';

export interface TahakkukSatiri {
  readonly bolumId: string;
  readonly kapiNo: string;
  readonly tutar: string;
  readonly tahakkukNo: string | null;
  readonly sorumlular: readonly {
    readonly kisiId: string;
    readonly kisiAdi: string;
    readonly rol: string;
    readonly sira: string;
    readonly pay: string;
  }[];
}

/**
 * Tahakkuk uyarısı — işlem TAMAMLANIR, engellenmez.
 *
 * ⚠️  Bu bir hata değil, görünürlük aracıdır. Engellemenin doğru olmadığı
 *     ama sessizliğin de kabul edilemez olduğu durumlar için: yönetici
 *     riski o an görür, sakin aylar sonra fark etmek zorunda kalmaz.
 */
export interface TahakkukUyarisi {
  /** `{GRUP_KODU}_CAKISMASI` — gruptan TÜRETİLİR, koda gömülü değildir. */
  readonly kod: string;
  readonly mesaj: string;
  readonly siddet: 'BILGI' | 'DIKKAT';
}

export interface TahakkukSonucu {
  readonly onizlemeMi: boolean;
  readonly giderTuruKodu: string;
  readonly donem: string;
  readonly toplamTutar: string;
  /** Dağıtılan toplam. `toplamTutar` ile EŞİT olmak zorundadır. */
  readonly dagitilanToplam: string;
  readonly bolumSayisi: number;
  readonly satirlar: readonly TahakkukSatiri[];
  /**
   * HER ZAMAN döner — uyarı yoksa boş dizi. Alanın bazen var bazen yok
   * olması istemcide sessiz `undefined` hatası üretirdi.
   */
  readonly uyarilar: readonly TahakkukUyarisi[];
}

@Injectable()
export class TahakkukCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
    private readonly numara: NumaraServisi,
    // TUKETIM kuralinda agirliklar sayac okumalarindan gelir.
    private readonly sayac: SayacServisi,
    /*
     * Fiş üretimi KOPYALANMAZ, buradan çağrılır. Tahsilat tarafında da aynı
     * servis kullanılıyor; denklik, kapalı dönem yasağı ve numaralandırma
     * tek yerde durur.
     */
    private readonly fis: FisCommandServisi,
  ) {}

  async calistir(dto: TahakkukCalistirDto, principal: Principal): Promise<TahakkukSonucu> {
    const baglam = mevcutBaglamiZorunluKil('tahakkuk.calistir');
    const donem = takvimTarihi(dto.donem);
    const vade = takvimTarihi(dto.vadeTarihi);
    const toplam = money(dto.toplamTutar);
    const onizleme = dto.onizleme === true;

    if (vade < donem) {
      throw new IsKuraliIhlali(
        'Vade tarihi tahakkuk döneminden önce olamaz.',
        'Vade tarihini dönem başlangıcından sonraya alın.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      // --- 1) Kural okunur --------------------------------------------------
      const turKaydi = await tx.giderTuru.findFirst({
        where: {
          tenantId: principal.tenantId,
          kod: dto.giderTuruKodu.trim().toLocaleUpperCase('tr'),
          aktifMi: true,
        },
      });
      if (!turKaydi) {
        throw new KayitBulunamadi(
          `Aktif gider türü bulunamadı: ${dto.giderTuruKodu}. ` +
            'Tahakkuk, tanımlı bir kural olmadan çalıştırılamaz.',
        );
      }

      /*
       * --- 1b) DAĞITIM EZMESİ (ADR-0017 · K7) -------------------------------
       *
       * Gider türünün kuralı VARSAYILANDIR; istek onu ezebilir. Ama ezme
       * yalnızca EK VERİ GEREKTİRMEYEN kurallara açıktır — ölçüt bu, kuralın
       * adı değil. Reddin gövdesi eksikleri SAYAR: yönetici dört bölümü dört
       * denemede öğrenmemelidir (`cariKontrolHesabi()` deseni).
       */
      const ezme = dto.paylasimKurali;
      const ezildi = ezme !== undefined && ezme !== turKaydi.paylasimKurali;

      /*
       * KARMA tek MUTLAK yasaktır: bileşen tanımı (`karmaBilesenler`) gider
       * türüne aittir ve istek gövdesinden verilemez. Ötekiler veri gelirse
       * kabul edilir — kontrol bölümler yüklendikten SONRA yapılır ki eksik
       * bölümler adlarıyla sayılabilsin (bkz. 3c).
       */
      if (ezme === 'KARMA') {
        throw new IsKuraliIhlali(
          'KARMA dağıtımı tahakkukta seçilemez.',
          'KARMA bileşenleri gider türünün tanımına aittir; gider türünü düzenleyin.',
        );
      }
      const etkinKural = ezme ?? turKaydi.paylasimKurali;

      const gider: GiderTuru = {
        kod: turKaydi.kod,
        ad: turKaydi.ad,
        paylasimKurali: etkinKural,
        sorumlulukTipi: turKaydi.sorumlulukTipi,
        kuralKaynagi: turKaydi.kuralKaynagi,
        kaynakReferansi: turKaydi.kaynakReferansi,
        // JSON sütunu `unknown` şeklindedir; alanlar AÇIKÇA seçilir. Doğrudan
        // cast, sütuna elle yazılmış bozuk bir yapının dağıtıma sızmasına
        // izin verirdi.
        ...(Array.isArray(turKaydi.karmaBilesenler)
          ? {
              karmaBilesenler: (turKaydi.karmaBilesenler as unknown[]).map((b) => {
                const o = b as { kural: string; yuzde: number };
                return { kural: o.kural, yuzde: o.yuzde };
              }) as GiderTuru['karmaBilesenler'],
            }
          : {}),
        malikPaylasimi: turKaydi.malikPaylasimi as GiderTuru['malikPaylasimi'],
      };

      /*
       * --- 2) ÇALIŞMA KAYDI — MÜKERRER KORUMASI (0026) --------------------
       *
       * ⚠️  ESKİ YOL YARIŞA AÇIKTI. Burada `borc.count()` ile bir sayım
       *     yapılıyordu. Uzun bir tahakkuk ters vekilde kesildiğinde iş arka
       *     planda sürer, kullanıcı tekrar dener ve ikinci istek ilk işlem
       *     COMMIT ETMEDEN gelir — sayım commit edilmemiş satırları göremez.
       *     5.000 bölümlük bir sitede ölçülen sonuç: 10.000 borç satırı.
       *
       *     Koruma artık VERİTABANINDADIR. Çalışma satırı işlemin İLK yazması
       *     olarak eklenir; kısmi benzersiz indeks
       *     (`tahakkuk_calismasi_asil_uq`) ikinci işlemi kısıt üzerinde
       *     BLOKLAR ve ilk işlem commit edince ihlalle düşürür. Pencere yok.
       *
       *     ÖNCE YAZILMASI ŞARTTIR: dağıtım hesabından sonra yazılsaydı iki
       *     işlem de hesabı bitirir, kilit yalnızca en sonda alınırdı ve
       *     boşa geçen iş süresi kadar pencere açık kalırdı.
       *
       * Kapsam PROJE bütünüdür; blok benzersizliğin parçası değildir.
       */
      /*
       * İKİ SINIF, İKİ EKSEN (0027):
       *
       *   DÖNEMSEL   aidat, yıl sonu kapanışı — dönemde TEK. İkincisi
       *              mükerrerdir; açık `ekTahakkuk` beyanı ister.
       *   OLAY BAZLI demirbaş alımı gibi bir defalık giderler — dönemde
       *              birden çok kez koşabilir. Ayırt eden şey dönem değil,
       *              GİDER OLAYIDIR; bu yüzden `referans` zorunludur ve
       *              benzersizlik onun üzerindedir.
       */
      const olayBazli = turKaydi.tahakkukSikligi === 'OLAY_BAZLI';
      const referans = dto.referans?.trim();
      if (olayBazli && !referans) {
        throw new IsKuraliIhlali(
          `'${gider.kod}' olay bazlı bir giderdir; hangi gider olayına ait ` +
            'olduğu belirtilmeden tahakkuk edilemez.',
          'Fatura ya da karar numarasını `referans` alanına yazın.',
        );
      }
      if (!olayBazli && referans) {
        throw new IsKuraliIhlali(
          `'${gider.kod}' dönemsel bir giderdir ve dönemde bir kez tahakkuk ` +
            'edilir; gider olayı referansı almaz.',
          'Referans gerekiyorsa gider türünü olay bazlı olarak tanımlayın.',
        );
      }

      /*
       * --- 2b) ÇAKIŞMA UYARISI — ENGELLEME DEĞİL ---------------------------
       *
       * Karşılıklı dışlayan türler `gider_turu_grubu` altında toplanır
       * (0030). Soru tek: bu dönemde AYNI GRUPTAN FARKLI bir tür tahakkuk
       * edilmiş mi? Gider türü kodu burada geçmez — çakışma tanımı veridir.
       *
       * İki sıra da doğal olarak çalışır: ikinci çalıştırma birincisini
       * görür. Farklı dönemlerde uyarı çıkmaz — pay ölçer yıl ortasında
       * takılabilir ve o geçiş meşrudur.
       */
      const uyarilar: TahakkukUyarisi[] = [];
      if (turKaydi.grupId) {
        const kardesKodlar = (await tx.giderTuru.findMany({
          where: {
            tenantId: principal.tenantId, grupId: turKaydi.grupId,
            kod: { not: gider.kod },
          },
          select: { kod: true },
        })).map((t) => t.kod);

        if (kardesKodlar.length > 0) {
          const cakisan = await tx.tahakkukCalismasi.findFirst({
            where: {
              tenantId: principal.tenantId, donem: new Date(donem),
              giderTuruKodu: { in: kardesKodlar },
            },
            select: { giderTuruKodu: true },
          });
          if (cakisan) {
            const grup = await tx.giderTuruGrubu.findFirst({
              where: { id: turKaydi.grupId },
              select: { kod: true, cakismaSiddeti: true, cakismaAciklamasi: true },
            });
            if (grup) {
              uyarilar.push({
                kod: `${grup.kod}_CAKISMASI`,
                mesaj:
                  `${donem} döneminde '${cakisan.giderTuruKodu}' tahakkuku zaten var; ` +
                  `şimdi '${gider.kod}' tahakkuk ediliyor. ${grup.cakismaAciklamasi}`,
                siddet: grup.cakismaSiddeti === 'BILGI' ? 'BILGI' : 'DIKKAT',
              });
            }
          }
        }
      }

      const ekTahakkuk = dto.ekTahakkuk === true;
      let calismaId = '';
      if (!onizleme) {
        // Sıra yalnızca DÖNEMSEL zincirde anlamlıdır; olay bazlı her çalışma
        // kendi gider olayıdır ve sira=1 ile açılır.
        const sonSira = olayBazli ? { _max: { sira: 0 } } : await tx.tahakkukCalismasi.aggregate({
          where: {
            tenantId: principal.tenantId, giderTuruKodu: gider.kod,
            donem: new Date(donem), referans: null,
          },
          _max: { sira: true },
        });
        if (!olayBazli && !ekTahakkuk && (sonSira._max.sira ?? 0) > 0) {
          throw new CakismaHatasi(
            `'${gider.kod}' için ${donem} dönemi zaten tahakkuk edilmiş.`,
            'Ek bir gider geldiyse "Ek Tahakkuk" işlemini başlatın; ' +
              'aksi hâlde mevcut tahakkuku iptal edin ya da farklı dönem seçin.',
          );
        }
        calismaId = randomUUID();
        try {
          await tx.tahakkukCalismasi.create({
            data: {
              id: calismaId, tenantId: principal.tenantId, giderTuruKodu: gider.kod,
              donem: new Date(donem),
              tip: !olayBazli && ekTahakkuk ? 'EK' : 'ASIL',
              sira: !olayBazli && ekTahakkuk ? (sonSira._max.sira ?? 0) + 1 : 1,
              ...(referans ? { referans } : {}),
              toplamTutar: new Prisma.Decimal(apiBicimi(toplam)),
              bolumSayisi: 0,
              /*
               * DAĞITIM SNAPSHOT'I (ADR-0017 · K7a). Ezme yapılmasa bile
               * yazılır: gider türünün kuralı sonradan değişirse geçmiş
               * tahakkuk yine doğru okunur. `cozumlemeTarihi` mantığı.
               */
              kullanilanPaylasimKurali: etkinKural,
              paylasimKuraliEzildi: ezildi,
            },
          });
        } catch (e) {
          // P2002: benzersizlik ihlali — eşzamanlı ikinci çalıştırma.
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new CakismaHatasi(
              referans
                ? `'${gider.kod}' için ${referans} referanslı gider ${donem} ` +
                    'döneminde zaten tahakkuk edilmiş.'
                : `'${gider.kod}' için ${donem} dönemi zaten tahakkuk edilmiş.`,
              'Aynı tahakkuk başka bir istekte çalıştırılmış olabilir. ' +
                'Sonucu görmek için tahakkuk listesini yenileyin.',
            );
          }
          throw e;
        }
      }

      // --- 3) Bölümler ve ilişkiler ----------------------------------------
      const bolumKayitlari = await tx.bagimsizBolum.findMany({
        where: {
          tenantId: principal.tenantId,
          ...(dto.hedefBlokId ? { blokId: dto.hedefBlokId } : {}),
        },
        select: {
          id: true, kapiNo: true, kat: true, nitelik: true, durum: true,
          brutM2: true, netM2: true, arsaPayiPay: true, arsaPayiPayda: true,
          aidatMuafiyeti: true, blokId: true,
        },
        orderBy: { kapiNo: 'asc' },
      });

      if (bolumKayitlari.length === 0) {
        throw new IsKuraliIhlali(
          'Tahakkuk edilecek bağımsız bölüm yok.',
          'Bölüm kayıtlarını tamamlayıp tekrar deneyin.',
        );
      }

      const girdiHaritasi = new Map<string, BolumGirdisiDto>(
        (dto.bolumGirdileri ?? []).map((g) => [g.bolumId, g]),
      );

      // --- 3b) TUKETIM ağırlıkları sayaçtan --------------------------------
      //
      // `sayacTuru` verilirse ölçüm elle girilmez, okumalardan gelir. Sayaç
      // değişimi olan bölümlerde iki sayacın tüketimi toplanır.
      //
      // OKUMASI OLMAYAN BÖLÜM VARSA TAHAKKUK REDDEDİLİR. Sessizce sıfır
      // tüketim yazmak o daireyi ısıtma giderinden tümüyle muaf tutar ve
      // farkı diğer dairelere yükler — hata, faturalar dağıtıldıktan sonra
      // ve ancak sakin itiraz ederse fark edilir.
      if (dto.sayacTuru !== undefined) {
        if (gider.paylasimKurali !== 'TUKETIM' && gider.paylasimKurali !== 'KARMA') {
          throw new IsKuraliIhlali(
            `'${gider.kod}' türünün paylaşım kuralı ${gider.paylasimKurali}; ` +
              'sayaç okuması yalnızca TUKETIM (ya da TUKETIM bileşeni olan KARMA) ' +
              'kuralında kullanılır.',
            'Sayaç türünü kaldırın ya da gider türünün kuralını düzeltin.',
          );
        }

        const tuketimler = await this.sayac.donemTuketimi(
          principal,
          dto.sayacTuru,
          dto.okumaBaslangic ?? donem,
          dto.okumaBitis ?? vade,
        );

        const kapsanan = new Set(bolumKayitlari.map((b) => b.id));
        const eksikler = tuketimler
          .filter((t) => kapsanan.has(t.bolumId) && t.okumaYokMu)
          .map((t) => t.kapiNo);

        if (eksikler.length > 0) {
          throw new IsKuraliIhlali(
            `${eksikler.length} bölümde ${dto.sayacTuru} okuması yok: ` +
              `${eksikler.join(', ')}.`,
            'Eksik okumaları girip tahakkuku tekrar çalıştırın. Okuması olmayan ' +
              'bölüme sıfır tüketim yazmak, o dairenin payını diğerlerine yükler.',
          );
        }

        for (const t of tuketimler) {
          if (!kapsanan.has(t.bolumId)) continue;
          const mevcut = girdiHaritasi.get(t.bolumId);
          girdiHaritasi.set(t.bolumId, {
            ...(mevcut ?? { bolumId: t.bolumId }),
            bolumId: t.bolumId,
            tuketim: t.tuketim,
          });
        }
      }

      /*
       * --- 3c) EZME ÖN KONTROLÜ (ADR-0017 · K7c) ---------------------------
       *
       * ⚠️  NEDEN ÖN KONTROL: `paylastir.ts` eksik veriyi zaten yakalıyor ama
       *     İLK bölümde durup atıyor. Yönetici dört eksik daireyi dört ayrı
       *     denemede öğreniyordu. Burada hepsi BİR KEREDE sayılır.
       *
       *     Yalnızca EZME yolunda çalışır: gider türünün kendi kuralıyla
       *     çalıştırılan tahakkuk bugünkü davranışını korur.
       */
      if (ezme !== undefined && !EZILEBILIR_KURALLAR.includes(
        ezme as (typeof EZILEBILIR_KURALLAR)[number],
      )) {
        const alan = {
          TUKETIM: 'tuketim', SABIT_TUTAR: 'sabitAgirlik',
          KULLANIM_BAZLI: 'kullaniyorMu', MANUEL: 'manuelTutar',
        }[ezme as 'TUKETIM' | 'SABIT_TUTAR' | 'KULLANIM_BAZLI' | 'MANUEL'];

        const eksikBolumler = bolumKayitlari
          .filter((b) => {
            const g = girdiHaritasi.get(b.id) as Record<string, unknown> | undefined;
            return g === undefined || g[alan] === undefined || g[alan] === null;
          })
          .map((b) => b.kapiNo);

        if (eksikBolumler.length > 0) {
          throw new IsKuraliIhlali(
            `${ezme} dağıtımı için her bölümün değeri gereklidir.`,
            `Şu bölümlerde veri yok: ${eksikBolumler.join(', ')}. ` +
              (ezme === 'TUKETIM'
                ? 'Sayaç okumalarını tamamlayın ya da `sayacTuru` vererek ' +
                  'ölçümlerin okumalardan gelmesini sağlayın.'
                : 'Eksik bölümlerin değerlerini girin.') +
              ' Eksik bölüme sıfır yazmak, o dairenin payını diğerlerine yükler.',
          );
        }
      }

      const bolumler = new Map<string, BagimsizBolum>();
      const girdiler: PaylasimGirdisi[] = [];

      for (const k of bolumKayitlari) {
        const bolum = BagimsizBolum.olustur({
          id: k.id, tenantId: principal.tenantId,
          blokId: k.blokId, katId: null,
          kapiNo: k.kapiNo, icKapiNo: null, kat: k.kat,
          nitelik: k.nitelik, daireTipi: null, kullanimAmaci: null,
          durum: k.durum,
          brutM2: k.brutM2.toNumber(), netM2: k.netM2.toNumber(),
          arsaPayiPay: k.arsaPayiPay, arsaPayiPayda: k.arsaPayiPayda,
          aidatMuafiyeti: k.aidatMuafiyeti,
          tapu: {
            ada: null, parsel: null, pafta: null,
            bagimsizBolumNo: null, cilt: null, sahife: null,
          },
        });
        bolumler.set(k.id, bolum);

        const g = girdiHaritasi.get(k.id);
        girdiler.push({
          bolum,
          ...(g?.tuketim === undefined ? {} : { tuketim: BigInt(g.tuketim) }),
          ...(g?.sabitAgirlik === undefined ? {} : { sabitAgirlik: BigInt(g.sabitAgirlik) }),
          ...(g?.kullaniyorMu === undefined ? {} : { kullaniyorMu: g.kullaniyorMu }),
          ...(g?.manuelTutar === undefined ? {} : { manuelTutar: money(g.manuelTutar) }),
          blokId: k.blokId,
        });
      }

      // --- 4) Dağıtım (Eksen 1) --------------------------------------------
      const paylar = gideriPaylastir(
        gider, toplam, girdiler,
        dto.hedefBlokId ? { hedefBlokId: dto.hedefBlokId } : {},
      );

      // --- 5) Sorumluluk ve malik bölüşümü (Eksen 2 + 4) -------------------
      const ilgiliBolumIdler = paylar.map((p) => p.bolumId);

      const [malikKayitlari, kiraciKayitlari, sakinKayitlari, kisiler] = await Promise.all([
        tx.malik.findMany({
          where: { tenantId: principal.tenantId, bolumId: { in: ilgiliBolumIdler } },
          select: {
            bolumId: true, kisiId: true, hissePay: true, hissePayda: true,
            tapuBaslangic: true, tapuBitis: true,
          },
        }),
        tx.kiraci.findMany({
          where: { tenantId: principal.tenantId, bolumId: { in: ilgiliBolumIdler } },
          select: { bolumId: true, kisiId: true, baslangic: true, bitis: true, tahliyeTarihi: true },
        }),
        tx.sakin.findMany({
          where: { tenantId: principal.tenantId, bolumId: { in: ilgiliBolumIdler } },
          select: { bolumId: true, kisiId: true, girisTarihi: true, cikisTarihi: true },
        }),
        tx.kisi.findMany({
          where: { tenantId: principal.tenantId },
          select: { id: true, ad: true, soyad: true },
        }),
      ]);

      const kisiAdi = new Map(kisiler.map((k) => [k.id, `${k.ad} ${k.soyad}`]));
      const gun = (d: Date): TakvimTarihi =>
        takvimTarihi(d.toISOString().slice(0, 10));

      const iliskiHaritasi = new Map<string, BolumIliskisi[]>();
      const hisseHaritasi = new Map<string, MalikHissesi[]>();

      for (const m of malikKayitlari) {
        const liste = iliskiHaritasi.get(m.bolumId) ?? [];
        liste.push({
          kisiId: m.kisiId, rol: 'MALIK',
          baslangic: gun(m.tapuBaslangic),
          bitis: m.tapuBitis === null ? null : gun(m.tapuBitis),
        });
        iliskiHaritasi.set(m.bolumId, liste);
      }
      for (const k of kiraciKayitlari) {
        // Tahliye edilmiş sözleşme, bitiş tarihi ne olursa olsun TAHLİYE
        // gününde kapanır; aksi halde tahliye sonrası aylarda kiracı hâlâ
        // sorumlu görünür.
        const bitis = k.tahliyeTarihi ?? k.bitis;
        const liste = iliskiHaritasi.get(k.bolumId) ?? [];
        liste.push({
          kisiId: k.kisiId, rol: 'KIRACI',
          baslangic: gun(k.baslangic),
          bitis: bitis === null ? null : gun(bitis),
        });
        iliskiHaritasi.set(k.bolumId, liste);
      }
      for (const s of sakinKayitlari) {
        const liste = iliskiHaritasi.get(s.bolumId) ?? [];
        liste.push({
          kisiId: s.kisiId, rol: 'SAKIN',
          baslangic: gun(s.girisTarihi),
          bitis: s.cikisTarihi === null ? null : gun(s.cikisTarihi),
        });
        iliskiHaritasi.set(s.bolumId, liste);
      }
      for (const m of malikKayitlari) {
        const liste = hisseHaritasi.get(m.bolumId) ?? [];
        liste.push({
          kisiId: m.kisiId,
          hissePay: m.hissePay,
          hissePayda: m.hissePayda,
          baslangic: gun(m.tapuBaslangic),
          bitis: m.tapuBitis === null ? null : gun(m.tapuBitis),
        });
        hisseHaritasi.set(m.bolumId, liste);
      }

      const satirlar: TahakkukSatiri[] = [];
      let dagitilanKurus = 0n;

      for (const pay of paylar) {
        dagitilanKurus += pay.tutar.kurus;
        const iliskiler = iliskiHaritasi.get(pay.bolumId) ?? [];
        const zincir = borcSorumlulariniCoz(gider, iliskiler, donem);

        // Bölüme düşen pay MALİKLER ARASINDA bölünür. Zincirde birden çok
        // ASIL varsa (hisseli mülkiyet) her malik yalnızca kendi payından
        // sorumludur; biri ödediğinde diğerlerinin borcu AÇIK kalır.
        const asillar = zincir.filter((s) => s.sira === 'ASIL');
        const hisseler = hisseHaritasi.get(pay.bolumId) ?? [];
        // Tahakkuk dönemindeki GEÇERLİ hisseler. Devredilmiş bir tapu payı
        // dönem dışındaysa bölüşüme girmez; aksi halde eski malik bugünkü
        // borcun bir kısmından sorumlu görünür.
        const donemHisseleri = hisseler.filter(
          (h) => h.baslangic <= donem && (h.bitis === null || h.bitis >= donem),
        );

        const asilPaylari =
          asillar.length > 1 && donemHisseleri.length === asillar.length
            ? malikBorcunuBol(
                pay.tutar, donemHisseleri, gider.malikPaylasimi ?? 'HISSE_ORANI',
              )
            : null;

        const sorumlular = zincir.map((s, i) => {
          const asilIndeksi = asillar.findIndex((a) => a.kisiId === s.kisiId);
          const kendiPayi =
            s.sira === 'ASIL' && asilPaylari !== null && asilIndeksi >= 0
              ? asilPaylari[asilIndeksi]?.tutar ?? pay.tutar
              : pay.tutar;
          return {
            kisiId: s.kisiId,
            kisiAdi: kisiAdi.get(s.kisiId) ?? '—',
            rol: s.rol,
            sira: s.sira,
            pay: apiBicimi(kendiPayi),
            agirlik:
              s.sira === 'ASIL' && asilPaylari !== null && asilIndeksi >= 0
                ? (asilPaylari[asilIndeksi]?.agirlik ?? 1n)
                : 1n,
            sirano: i,
          };
        });

        satirlar.push({
          bolumId: pay.bolumId,
          kapiNo: pay.kapiNo,
          tutar: apiBicimi(pay.tutar),
          tahakkukNo: null,
          sorumlular: sorumlular.map((s) => ({
            kisiId: s.kisiId, kisiAdi: s.kisiAdi, rol: s.rol,
            sira: s.sira, pay: s.pay,
          })),
        });

        if (onizleme) continue;

        // --- 6) Yazma ------------------------------------------------------
        const tahakkukNo = await this.numara.tahsisEt(tx, {
          tenantId: principal.tenantId,
          seriKodu: 'TAHAKKUK',
          yil: Number(donem.slice(0, 4)),
        });
        const borcId = randomUUID();

        await tx.borc.create({
          data: {
            id: borcId, tenantId: principal.tenantId, bolumId: pay.bolumId,
            calismaId,
            giderTuruKodu: gider.kod, tahakkukNo,
            tutar: new Prisma.Decimal(apiBicimi(pay.tutar)),
            vadeTarihi: new Date(vade),
            tahakkukDonemi: new Date(donem),
          },
        });

        for (const s of sorumlular) {
          await tx.borcSorumlusu.create({
            data: {
              id: randomUUID(), tenantId: principal.tenantId,
              borcId, kisiId: s.kisiId,
              // Tipler domain'den gelir ve Prisma enum'larıyla birebir örtüşür;
              // dönüşüm gerekmez (`IliskiRolu` SAKIN'i migration 0003'te aldı).
              sira: s.sira,
              rol: s.rol,
              cozumlemeTarihi: new Date(donem),
              pay: new Prisma.Decimal(s.pay),
              agirlik: s.agirlik,
            },
          });
        }

        satirlar[satirlar.length - 1] = {
          ...(satirlar[satirlar.length - 1] as TahakkukSatiri),
          tahakkukNo,
        };
      }

      // Dağıtılan toplam giderin TAMAMINA eşit olmalıdır. `dagit()` yuvarlama
      // farkını kaybetmez ama KARMA/MANUEL yollarında bir hata olursa fark
      // burada yakalanır — sessizce eksik tahsilat yapılmaz.
      if (dagitilanKurus !== toplam.kurus) {
        throw new IsKuraliIhlali(
          `Dağıtılan toplam (${dagitilanKurus}) gider toplamına (${toplam.kurus}) eşit değil.`,
          'Gider türü tanımını ve bölüm girdilerini kontrol edin.',
        );
      }

      if (!onizleme) {
        // Çalışma satırı artık KALICIDIR (0026) ve denetim kaydı onun
        // kimliğini taşır: audit `varlik_id` sütunu `uuid` tipindedir ve
        // `${kod}:${donem}` gibi bileşik bir anahtar yazma anında patlardı.
        const calistirmaId = calismaId;
        await tx.tahakkukCalismasi.update({
          where: { id: calismaId },
          data: { bolumSayisi: paylar.length },
        });

        await this.audit.yaz(tx, {
          tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
          varlik: 'Tahakkuk', varlikId: calistirmaId,
          sonrakiDeger: {
            giderTuruKodu: gider.kod, donem, vade,
            toplamTutar: apiBicimi(toplam), bolumSayisi: paylar.length,
            paylasimKurali: gider.paylasimKurali,
            sorumlulukTipi: gider.sorumlulukTipi,
            // Uyarı denetim kaydına da girer: "yönetici bunu görmüştü" sorusu
            // aylar sonra ancak buradan cevaplanabilir.
            uyarilar,
          },
          correlationId: baglam.correlationId,
          ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
        });

        await this.outbox.yayinla(tx, {
          eventType: 'apartman.tahakkuk.calistirildi', eventVersion: 1,
          tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
          aggregate: { tip: 'Tahakkuk', id: calistirmaId, version: 1 },
          payload: {
            giderTuruKodu: gider.kod, donem,
            toplamTutar: apiBicimi(toplam), bolumSayisi: paylar.length,
          },
        });
      }

      return {
        onizlemeMi: onizleme,
        giderTuruKodu: gider.kod,
        donem,
        toplamTutar: apiBicimi(toplam),
        // `moneyKurustan` — Number'a çevirip bölmek FLOAT yuvarlaması yapar
        // ve doğrulama için hesaplanan toplamın kendisi bozulur (ADR-0007).
        dagitilanToplam: apiBicimi(moneyKurustan(dagitilanKurus)),
        bolumSayisi: paylar.length,
        satirlar,
        uyarilar,
      };
    });
  }

  /**
   * TAHAKKUKU DEFTERE GEÇİR (ADR-0017).
   *
   * Fiş: **borç `CARI_KONTROL` / alacak `giderTuru.muhasebeHesapId`**.
   * Tahsilat tam tersini yazar (`tahsilat.command.service.ts:390-392`); ikisi
   * birlikte cari hesabı açar ve kapatır. Mutabakat ancak böyle tutar.
   *
   * ⚠️  ÇALIŞMA BAŞINA TEK FİŞ (K3). Yevmiyede toplam durur, daire kırılımı
   *     yardımcı defterdedir (ADR-0010). Borç başına fiş üretilseydi 5.000
   *     bölümlü bir sitede tek tahakkuk 5.000 fiş yazardı ve yevmiye defteri
   *     okunamaz hâle gelirdi.
   *
   * ⚠️  FİŞ TARİHİ `tahakkukDonemi`dir, vade DEĞİL. Vade seçilseydi gider ile
   *     karşılığı farklı döneme düşebilirdi.
   *
   * ⚠️  MÜKERRER KORUMASI `calisma.yevmiyeFisiId` alanındadır (K6b) — `borc`ta
   *     ayrı bir alan YOKTUR. Düzeltme storno ile yapılır.
   */
  async muhasebelestir(
    calismaId: string, dto: TahakkukMuhasebelestirDto, principal: Principal,
  ): Promise<{
    readonly id: string; readonly durum: string;
    readonly fisId: string; readonly fisNo: string;
  }> {
    const baglam = mevcutBaglamiZorunluKil('tahakkuk.muhasebelestir');

    return this.prisma.tenantIslemi(async (tx) => {
      const calisma = await tx.tahakkukCalismasi.findFirst({
        where: { id: calismaId, tenantId: principal.tenantId },
        select: {
          id: true, giderTuruKodu: true, donem: true, toplamTutar: true,
          tip: true, sira: true, referans: true, yevmiyeFisiId: true,
        },
      });
      if (!calisma) {
        throw new KayitBulunamadi(`Tahakkuk çalışması bulunamadı: ${calismaId}`);
      }
      /*
       * DERİNLİK KAPISI (ADR-0017 · K8). `BASIT` projede yevmiye fişi diye
       * bir kavram YOKTUR ve bu bir eksiklik değildir.
       *
       * ⚠️  SESSİZ ATLAMA DEĞİL, AÇIK HATA. Ucu menüden kaldırmak bir
       *     görünürlük önlemidir; doğrudan çağıran biri sessiz sonuç
       *     almamalıdır.
       *
       * ⚠️  Derinlik `Principal`'dan OKUNMAZ, buradan okunur. Jetona
       *     gömülseydi ayar değiştiğinde elindeki eski jetonla gelen
       *     kullanıcı yanlış tarafa düşerdi.
       */
      await this.ciftTarafliZorunluKil(tx, principal);

      if (calisma.yevmiyeFisiId !== null) {
        throw new IsKuraliIhlali(
          'Bu tahakkuk zaten muhasebeleştirilmiş.',
          'Aynı tahakkuk iki kez muhasebeleştirilse aynı borç iki kez deftere ' +
            'girer. Düzeltme için ilgili fişi storno edin.',
        );
      }

      /*
       * BORÇ TOPLAMI ÇALIŞMADAN DEĞİL, BORÇ SATIRLARINDAN gelir.
       * `toplamTutar` istekte gelen tutardır; dağıtımda kuruş artığı son
       * bölüme verildiği için ikisi teorik olarak ayrışabilir. Deftere giren
       * rakam, borçluların gerçekten borçlandığı rakam olmalıdır.
       */
      const borcToplami = await tx.borc.aggregate({
        where: { tenantId: principal.tenantId, calismaId },
        _sum: { tutar: true },
      });
      const tutar = borcToplami._sum.tutar;
      if (tutar === null || tutar.isZero()) {
        throw new IsKuraliIhlali(
          'Muhasebeleştirilecek borç yok.',
          'Bu çalışma hiç borç üretmemiş; önizleme kaydı muhasebeleşmez.',
        );
      }

      const tur = await tx.giderTuru.findFirst({
        where: { tenantId: principal.tenantId, kod: calisma.giderTuruKodu },
        select: { ad: true, muhasebeHesapId: true },
      });
      if (!tur) {
        throw new KayitBulunamadi(
          `Gider türü bulunamadı: ${calisma.giderTuruKodu}. ` +
            'Tahakkukun karşı hesabı türden okunur; tür silinmişse fiş kesilemez.',
        );
      }

      /*
       * Kontrol hesabı KODLA DEĞİL `ozellik` ile bulunur (§33 kural 3):
       * '120' her tenant'ta alıcılar hesabı olmayabilir. Yoksa TAHMİN
       * EDİLMEZ — durulur ve çıkış yolu söylenir.
       */
      const kontrol = await tx.hesap.findFirst({
        where: {
          tenantId: principal.tenantId, ozellik: 'CARI_KONTROL',
          aktif: true, silinmeTarihi: null,
        },
        select: { id: true },
      });
      if (!kontrol) {
        throw new IsKuraliIhlali(
          'Cari kontrol hesabı tanımlı değil.',
          'Hesap planında bir hesabı "Cari Kontrol" olarak işaretleyin; ' +
            'tahakkuk bu hesabı borçlandırır.',
        );
      }
      if (kontrol.id === tur.muhasebeHesapId) {
        throw new IsKuraliIhlali(
          'Borç ve alacak tarafı aynı hesap olamaz.',
          'Gider türünün muhasebe hesabı, cari kontrol hesabıyla aynı seçilmiş.',
        );
      }

      const donemMetni = calisma.donem.toISOString().slice(0, 10);
      const tutarMetni = tutar.toFixed(4);
      const etiket = calisma.referans === null
        ? `${donemMetni} dönemi`
        : `${donemMetni} · ${calisma.referans}`;

      const fis = await this.fis.ekleIslemde(
        tx,
        {
          tarih: donemMetni,
          aciklama: `Tahakkuk — ${tur.ad} (${etiket})`,
          fisTuru: 'TAHAKKUK',
          kaynakTipi: 'TAHAKKUK',
          kaynakId: calisma.id,
          ...(dto.hemenIsle === undefined ? {} : { hemenIsle: dto.hemenIsle }),
          satirlar: [
            { hesapId: kontrol.id, borc: tutarMetni, aciklama: `Tahakkuk ${etiket}` },
            {
              hesapId: tur.muhasebeHesapId, alacak: tutarMetni,
              aciklama: `${tur.ad} ${etiket}`,
            },
          ],
        },
        principal,
        baglam,
      );

      await tx.tahakkukCalismasi.update({
        where: { id: calisma.id }, data: { yevmiyeFisiId: fis.id },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'TahakkukCalismasi', varlikId: calisma.id,
        oncekiDeger: { yevmiyeFisiId: null },
        sonrakiDeger: {
          yevmiyeFisiId: fis.id, fisNo: fis.fisNo,
          giderTuruKodu: calisma.giderTuruKodu, donem: donemMetni,
          tutar: tutarMetni,
          borcHesapId: kontrol.id, alacakHesapId: tur.muhasebeHesapId,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id: calisma.id, durum: 'MUHASEBELESTI',
        fisId: fis.id, fisNo: fis.fisNo,
      };
    });
  }

  /**
   * MUHASEBE DERİNLİĞİ KAPISI — `BASIT` projede çift taraflı kayıt yoktur.
   *
   * Parametre kaydı hiç yoksa da `BASIT` sayılır: kurulum yapılmamış bir
   * projede yevmiye fişi kesmek, hangi hesaba yazılacağı belirsizken deftere
   * kayıt üretmek olurdu.
   */
  private async ciftTarafliZorunluKil(
    tx: Prisma.TransactionClient, principal: Principal,
  ): Promise<void> {
    const p = await tx.muhasebeParametresi.findFirst({
      where: { tenantId: principal.tenantId },
      select: { muhasebeDerinligi: true },
    });
    if (p !== null && p.muhasebeDerinligi === 'CIFT_TARAFLI') return;

    throw new IsKuraliIhlali(
      'Bu proje basit muhasebe kullanıyor; tahakkuk deftere geçirilmez.',
      p === null
        ? 'Muhasebe parametreleri henüz kurulmamış. Çift taraflı muhasebe ' +
          'kullanılacaksa önce hesap planını ve parametreleri tanımlayın.'
        : 'Basit muhasebede yalnızca kasa ve banka izlenir; hesap planı ve ' +
          'yevmiye fişi yoktur. Tahakkuk ve alacak takibi ETKİLENMEZ — ' +
          'yalnızca deftere düşmez. Çift taraflı muhasebeye geçmek için ' +
          'Muhasebe → Parametreler ekranından derinliği değiştirin.',
    );
  }
}
