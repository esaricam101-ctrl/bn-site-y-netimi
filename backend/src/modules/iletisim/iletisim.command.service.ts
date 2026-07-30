/**
 * İletişim — komut tarafı (CQRS). WhatsApp · SMS · (ileride e-posta).
 *
 * ⚠️  KANAL BİR ALANDIR, AYRI SERVİS DEĞİL. WhatsApp ve SMS için ayrı komut
 *     servisleri yazılsaydı alıcı çözümü, izin denetimi ve şablon çözümü iki
 *     yerde durur ve biri düzeltildiğinde öteki SESSİZCE eski davranırdı.
 *
 * ⚠️  HİÇBİR MESAJ GERÇEKTEN GÖNDERİLMEZ (bu faz). Sağlayıcı portu var,
 *     gerçek adaptör yok; mesajlar `SAGLAYICI_YOK` durumunda kalır ve bu
 *     durum raporda AYRI sayılır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { silmeyiDogrula, type Principal } from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import {
  iletiIzniniDenetle, numarayiNormalle, sablonuCoz, smsKontoru,
  yenidenGonderilebilirMi,
} from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import { MesajSaglayicisi } from './saglayici/mesaj-saglayici.port';
import { aliciCozumle, type Alici } from './alici-cozumleyici';
import type {
  GonderimIptalDto, GonderimOlusturDto, IzinKaydetDto, KuralKaydetDto,
  SablonDuzeltDto, SablonEkleDto,
} from './dto/iletisim.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

export interface GonderimSonucu extends KomutSonucu {
  readonly aliciSayisi: number;
  readonly kuyruklanan: number;
  readonly izinYok: number;
  readonly numarasiz: number;
  readonly toplamKontor: number;
  /** Sağlayıcı yoksa hiçbir mesaj GÖNDERİLMEZ; bu alan gizlenmez. */
  readonly saglayiciEtkinMi: boolean;
  readonly uyarilar: readonly string[];
}

@Injectable()
export class IletisimCommandServisi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly saglayici: MesajSaglayicisi,
  ) {}

  /* -------------------------------- Şablon ------------------------------- */

  async sablonEkle(dto: SablonEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.sablonEkle');
    const id = randomUUID();

    return this.prisma.tenantIslemi(async (tx) => {
      await tx.mesajSablonu.create({
        data: {
          id, tenantId: principal.tenantId,
          kod: dto.kod.trim().toUpperCase(),
          ad: dto.ad.trim(),
          kanal: dto.kanal ?? null,
          iletiTuru: dto.iletiTuru ?? 'BILGILENDIRME',
          govde: dto.govde,
          aciklama: dto.aciklama?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'MesajSablonu', varlikId: id,
        sonrakiDeger: { kod: dto.kod, ad: dto.ad, kanal: dto.kanal ?? null },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'AKTIF' };
    });
  }

  async sablonDuzelt(
    id: string, dto: SablonDuzeltDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.sablonDuzelt');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.mesajSablonu.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true, ad: true, govde: true, aktif: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Şablon bulunamadı: ${id}`);

      await tx.mesajSablonu.update({
        where: { id },
        data: {
          ...(dto.ad === undefined ? {} : { ad: dto.ad.trim() }),
          ...(dto.govde === undefined ? {} : { govde: dto.govde }),
          ...(dto.aciklama === undefined ? {} : { aciklama: dto.aciklama.trim() }),
          ...(dto.aktif === undefined ? {} : { aktif: dto.aktif }),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'MesajSablonu', varlikId: id,
        oncekiDeger: { ad: kayit.ad, govde: kayit.govde, aktif: kayit.aktif },
        sonrakiDeger: {
          ad: dto.ad ?? kayit.ad,
          govde: dto.govde ?? kayit.govde,
          aktif: dto.aktif ?? kayit.aktif,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'GUNCELLENDI' };
    });
  }

  /**
   * Şablonu arşivler.
   *
   * KULLANILMIŞ ŞABLON ARŞİVLENEMEZ: geçmiş gönderimler ona bağlıdır ve
   * silinirse "bu mesaj hangi şablondan üretildi" sorusu cevapsız kalır.
   */
  async sablonSil(id: string, gerekce: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.sablonSil');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.mesajSablonu.findFirst({
        where: { id, tenantId: principal.tenantId, silinmeTarihi: null },
        select: {
          id: true, kod: true,
          _count: { select: { gonderimler: true, kurallar: true } },
        },
      });
      if (!kayit) throw new KayitBulunamadi(`Şablon bulunamadı: ${id}`);

      const engeller: { readonly aciklama: string; readonly kontrol: string }[] = [];
      if (kayit._count.gonderimler > 0) {
        engeller.push({
          aciklama: `${kayit._count.gonderimler} gönderim bu şablondan üretilmiş.`,
          kontrol: 'SABLON_GONDERIM_VAR',
        });
      }
      if (kayit._count.kurallar > 0) {
        engeller.push({
          aciklama: `${kayit._count.kurallar} otomatik bildirim kuralı bu şablonu kullanıyor.`,
          kontrol: 'SABLON_KURAL_VAR',
        });
      }

      silmeyiDogrula(
        { varlik: 'MesajSablonu', sinif: 'ANA_VERI', engelleyenBagimliliklar: engeller },
        gerekce,
      );

      await tx.mesajSablonu.update({
        where: { id },
        data: {
          silindiMi: true, silinmeTarihi: new Date(),
          silenKullanici: principal.id, silmeGerekcesi: gerekce.trim(),
          aktif: false,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'SOFT_SIL',
        varlik: 'MesajSablonu', varlikId: id,
        oncekiDeger: { kod: kayit.kod }, gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'ARSIVLENDI' };
    });
  }

  /* ------------------------------- Gönderim ------------------------------ */

  /**
   * Gönderim oluşturur: hedefi çözer, izinleri denetler, mesajları yazar.
   *
   * ⚠️  İZİNSİZ ALICI ATLANMAZ, `IZIN_YOK` DURUMUYLA KAYDEDİLİR. Atlansaydı
   *     "500 kişiye gönderdim" denir ama 80'ine gitmediği hiçbir yerde
   *     görünmezdi. Kayıt, kime NEDEN gönderilmediğini gösterir.
   *
   * ⚠️  NUMARASI OLMAYAN ALICI DA KAYDEDİLİR (`BASARISIZ` + gerekçe). Sessizce
   *     düşürülseydi eksik numara hiç fark edilmezdi.
   */
  async gonderimOlustur(
    dto: GonderimOlusturDto, principal: Principal,
  ): Promise<GonderimSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.gonderimOlustur');
    const gonderimId = randomUUID();
    const kanal = dto.kanal;
    const iletiTuru = dto.iletiTuru ?? 'BILGILENDIRME';
    const uyarilar: string[] = [];

    return this.prisma.tenantIslemi(async (tx) => {
      // --- Gövde: şablon ya da doğrudan metin ---
      let hamGovde = dto.govde ?? '';
      let sablonId: string | null = null;
      if (dto.sablonId !== undefined) {
        const sablon = await tx.mesajSablonu.findFirst({
          where: {
            id: dto.sablonId, tenantId: principal.tenantId,
            silinmeTarihi: null, aktif: true,
          },
          select: { id: true, govde: true, kanal: true },
        });
        if (!sablon) {
          throw new KayitBulunamadi(`Şablon bulunamadı ya da pasif: ${dto.sablonId}`);
        }
        // Şablon başka bir kanala özelse kullanılamaz: SMS için yazılmış kısa
        // metin WhatsApp'ta anlamsız, tersi ise kontörü patlatır.
        if (sablon.kanal !== null && sablon.kanal !== kanal) {
          throw new IsKuraliIhlali(
            `Şablon ${sablon.kanal} kanalına özel; ${kanal} gönderiminde kullanılamaz.`,
            'Bu kanal için ayrı şablon oluşturun.',
          );
        }
        hamGovde = sablon.govde;
        sablonId = sablon.id;
      }
      if (hamGovde.trim() === '') {
        throw new IsKuraliIhlali(
          'Mesaj gövdesi boş olamaz.',
          'Şablon seçin ya da metni doğrudan girin.',
        );
      }

      // --- Alıcılar ---
      let cozum: { alicilar: readonly Alici[]; uyari: string | null };
      try {
        cozum = await aliciCozumle(
          tx, principal.tenantId, dto.hedefTipi,
          dto.hedefReferansi ?? {},
        );
      } catch (h) {
        throw new IsKuraliIhlali(
          h instanceof Error ? h.message : 'Hedef çözülemedi.',
          'Hedef seçimini kontrol edin.',
        );
      }
      if (cozum.uyari !== null) uyarilar.push(cozum.uyari);
      if (cozum.alicilar.length === 0) {
        throw new IsKuraliIhlali(
          'Seçilen hedefte alıcı bulunamadı.',
          'Boş bir gönderim oluşturmak, gönderildiğini sanmanıza yol açardı.',
        );
      }

      // --- İzinler (kişi bazlı; daire görevlisinin kişi kaydı yoktur) ---
      const kisiIdler = cozum.alicilar
        .map((a) => a.kisiId)
        .filter((k): k is string => k !== null);
      const izinler = kisiIdler.length === 0 ? [] : await tx.iletisimIzni.findMany({
        where: { tenantId: principal.tenantId, kisiId: { in: kisiIdler } },
        select: { kisiId: true, kanal: true, iletiTuru: true, durum: true },
      });
      const izinHaritasi = new Map<string, typeof izinler>();
      for (const i of izinler) {
        const mevcut = izinHaritasi.get(i.kisiId) ?? [];
        izinHaritasi.set(i.kisiId, [...mevcut, i]);
      }

      await tx.mesajGonderimi.create({
        data: {
          id: gonderimId, tenantId: principal.tenantId,
          kanal, iletiTuru,
          durum: dto.zamanlanmaAni === undefined ? 'GONDERILIYOR' : 'ZAMANLANDI',
          sablonId,
          baslik: dto.baslik?.trim() ?? null,
          govde: hamGovde,
          hedefTipi: dto.hedefTipi,
          hedefReferansi: (dto.hedefReferansi ?? {}) as Prisma.InputJsonValue,
          zamanlanmaAni: dto.zamanlanmaAni === undefined
            ? null : new Date(dto.zamanlanmaAni),
          baslamaAni: dto.zamanlanmaAni === undefined ? new Date() : null,
          ilgiliVarlik: dto.ilgiliVarlik ?? null,
          ilgiliVarlikId: dto.ilgiliVarlikId ?? null,
          olusturan: principal.id,
        },
      });

      // --- Mesajlar ---
      let kuyruklanan = 0;
      let izinYok = 0;
      let numarasiz = 0;
      let toplamKontor = 0;

      for (const alici of cozum.alicilar) {
        const hamNumara = kanal === 'WHATSAPP'
          ? (alici.whatsappNo ?? alici.telefon)
          : alici.telefon;

        let numara: string | null = null;
        let hataMesaji: string | null = null;
        try {
          numara = hamNumara === null ? null : numarayiNormalle(hamNumara);
          if (numara === null) hataMesaji = 'Alıcının numarası kayıtlı değil.';
        } catch (h) {
          hataMesaji = h instanceof Error ? h.message : 'Numara geçersiz.';
        }

        // İzin denetimi — daire görevlisinin kişi kaydı yoksa BİLGİLENDİRME
        // dışında gönderim yapılmaz.
        let izinSonucu = { gonderilebilirMi: true, gerekce: null as string | null };
        if (alici.kisiId !== null) {
          izinSonucu = iletiIzniniDenetle(
            kanal, iletiTuru, izinHaritasi.get(alici.kisiId) ?? [],
          );
        } else if (iletiTuru === 'TICARI') {
          izinSonucu = {
            gonderilebilirMi: false,
            gerekce: 'Kişi kaydı olmayan alıcıya TİCARİ ileti gönderilemez ' +
              '(izin kaydı tutulamaz).',
          };
        }

        const govde = sablonuCozGuvenli(hamGovde, {
          ...(dto.degiskenler ?? {}),
          ad: alici.ad,
        });

        const kontor = kanal === 'SMS' ? smsKontoru(govde.metin).parcaSayisi : 1;

        let durum: 'BEKLIYOR' | 'IZIN_YOK' | 'BASARISIZ' = 'BEKLIYOR';
        let hataKodu: string | null = null;
        if (numara === null) {
          durum = 'BASARISIZ';
          hataKodu = 'NUMARA_YOK';
          numarasiz += 1;
        } else if (!izinSonucu.gonderilebilirMi) {
          durum = 'IZIN_YOK';
          hataKodu = 'IZIN_YOK';
          hataMesaji = izinSonucu.gerekce;
          izinYok += 1;
        } else if (!govde.cozuldu) {
          durum = 'BASARISIZ';
          hataKodu = 'SABLON_COZULEMEDI';
          hataMesaji = govde.hata;
        } else {
          kuyruklanan += 1;
          toplamKontor += kontor;
        }

        await tx.mesaj.create({
          data: {
            id: randomUUID(), tenantId: principal.tenantId,
            gonderimId,
            kisiId: alici.kisiId,
            aliciAdi: alici.ad,
            numara: numara ?? '-',
            kanal, durum,
            govde: govde.metin,
            parcaSayisi: kontor,
            hataKodu, hataMesaji,
          },
        });
      }

      // Sağlayıcı yoksa kuyruktakiler SAGLAYICI_YOK'a çevrilir. Sahte bir
      // "gönderildi" yazılsaydı yönetici sakinleri bilgilendirdiğini sanardı.
      if (!this.saglayici.etkinMi && kuyruklanan > 0) {
        await tx.mesaj.updateMany({
          where: { gonderimId, durum: 'BEKLIYOR' },
          data: {
            durum: 'SAGLAYICI_YOK',
            saglayici: this.saglayici.ad,
            hataKodu: 'SAGLAYICI_YOK',
            hataMesaji:
              'Gerçek mesaj sağlayıcısı tanımlı değil. Mesaj KAYDEDİLDİ ama ' +
              'GÖNDERİLMEDİ; sağlayıcı bağlandığında yeniden kuyruğa alınabilir.',
          },
        });
        uyarilar.push(
          `Sağlayıcı tanımlı olmadığı için ${kuyruklanan} mesaj KAYDEDİLDİ ama ` +
          'GÖNDERİLMEDİ.',
        );
      }

      /*
       * ⚠️  ULAŞILAMAYAN ALICILAR AYRICA UYARILIR.
       *
       *     Canlı testte görüldü: dört alıcının dördünün de numarası yoktu,
       *     `kuyruklanan = 0` olduğu için hiçbir uyarı üretilmedi ve yanıt
       *     "oluşturuldu" dedi. Sayılar (`numarasiz: 4`) yanıtta vardı ama
       *     kimse okumak zorunda değildi — yönetici duyurunun gittiğini
       *     sanabilirdi.
       *
       *     Sayı ile uyarı AYNI ŞEY DEĞİLDİR: sayı veridir, uyarı iddiadır.
       */
      if (numarasiz > 0) {
        uyarilar.push(
          `${numarasiz} alıcının ${kanal === 'WHATSAPP' ? 'WhatsApp numarası' : 'telefonu'} ` +
          'kayıtlı değil ya da geçersiz; bu kişilere mesaj GİTMEDİ. Kişi ' +
          'kartlarındaki numaraları tamamlayın.',
        );
      }
      if (izinYok > 0) {
        uyarilar.push(
          `${izinYok} alıcı ileti izni bulunmadığı için ATLANDI (İYS · 6563 ` +
          's. K.). Ayrıntı için mesaj geçmişinde `IZIN_YOK` durumuna bakın.',
        );
      }
      if (kuyruklanan === 0) {
        uyarilar.push(
          'HİÇBİR ALICIYA MESAJ GİTMEDİ. Gönderim kaydı denetim için ' +
          'oluşturuldu ama kimse bilgilendirilmedi.',
        );
      }

      if (dto.zamanlanmaAni !== undefined) {
        uyarilar.push(
          'Gönderim ZAMANLANDI ama zamanlanmış gönderimleri çalıştıracak ' +
          'planlayıcı henüz yok; kayıt kendiliğinden gönderilmez.',
        );
      } else {
        await tx.mesajGonderimi.update({
          where: { id: gonderimId },
          data: { durum: 'TAMAMLANDI', bitisAni: new Date() },
        });
      }

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'MesajGonderimi', varlikId: gonderimId,
        sonrakiDeger: {
          kanal, iletiTuru, hedefTipi: dto.hedefTipi,
          aliciSayisi: cozum.alicilar.length,
          kuyruklanan, izinYok, numarasiz, toplamKontor,
          saglayiciEtkinMi: this.saglayici.etkinMi,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return {
        id: gonderimId,
        durum: dto.zamanlanmaAni === undefined ? 'TAMAMLANDI' : 'ZAMANLANDI',
        aliciSayisi: cozum.alicilar.length,
        kuyruklanan, izinYok, numarasiz, toplamKontor,
        saglayiciEtkinMi: this.saglayici.etkinMi,
        uyarilar,
      };
    });
  }

  async gonderimIptal(
    id: string, dto: GonderimIptalDto, principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.gonderimIptal');

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.mesajGonderimi.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, durum: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Gönderim bulunamadı: ${id}`);
      if (kayit.durum === 'IPTAL') {
        throw new IsKuraliIhlali('Gönderim zaten iptal edilmiş.', 'İşlem tekrarlanmaz.');
      }

      // ⚠️ GÖNDERİLMİŞ MESAJ GERİ ÇAĞRILAMAZ. Yalnızca henüz gönderilmemişler
      //    iptal edilir; iptal, gidenleri geri getirmez.
      const iptalEdilen = await tx.mesaj.updateMany({
        where: { gonderimId: id, durum: { in: ['BEKLIYOR', 'KUYRUKTA', 'SAGLAYICI_YOK'] } },
        data: { durum: 'IPTAL' },
      });

      await tx.mesajGonderimi.update({
        where: { id },
        data: { durum: 'IPTAL', iptalGerekcesi: dto.gerekce.trim(), bitisAni: new Date() },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'MesajGonderimi', varlikId: id,
        oncekiDeger: { durum: kayit.durum },
        sonrakiDeger: { durum: 'IPTAL', iptalEdilenMesaj: iptalEdilen.count },
        gerekce: dto.gerekce,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: 'IPTAL' };
    });
  }

  /** Tek mesajı yeniden gönderir. */
  async mesajYenidenGonder(id: string, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.yenidenGonder');

    return this.prisma.tenantIslemi(async (tx) => {
      const mesaj = await tx.mesaj.findFirst({
        where: { id, tenantId: principal.tenantId },
        select: { id: true, durum: true, denemeSayisi: true, numara: true },
      });
      if (!mesaj) throw new KayitBulunamadi(`Mesaj bulunamadı: ${id}`);

      yenidenGonderilebilirMi(mesaj.durum, mesaj.denemeSayisi);

      const durum = this.saglayici.etkinMi ? 'KUYRUKTA' : 'SAGLAYICI_YOK';
      await tx.mesaj.update({
        where: { id },
        data: {
          durum,
          denemeSayisi: { increment: 1 },
          ...(this.saglayici.etkinMi
            ? { hataKodu: null, hataMesaji: null }
            : {}),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Mesaj', varlikId: id,
        oncekiDeger: { durum: mesaj.durum, denemeSayisi: mesaj.denemeSayisi },
        sonrakiDeger: { durum, denemeSayisi: mesaj.denemeSayisi + 1 },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum };
    });
  }

  /* --------------------------------- İzin -------------------------------- */

  async izinKaydet(dto: IzinKaydetDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.izinKaydet');

    return this.prisma.tenantIslemi(async (tx) => {
      const kisi = await tx.kisi.findFirst({
        where: { id: dto.kisiId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true },
      });
      if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.kisiId}`);

      const id = randomUUID();
      await tx.iletisimIzni.upsert({
        where: {
          tenantId_kisiId_kanal_iletiTuru: {
            tenantId: principal.tenantId, kisiId: dto.kisiId,
            kanal: dto.kanal, iletiTuru: dto.iletiTuru,
          },
        },
        create: {
          id, tenantId: principal.tenantId, kisiId: dto.kisiId,
          kanal: dto.kanal, iletiTuru: dto.iletiTuru, durum: dto.durum,
          kaynak: dto.kaynak.trim(),
          beyanTarihi: new Date(dto.beyanTarihi),
          gerekce: dto.gerekce?.trim() ?? null,
        },
        update: {
          durum: dto.durum,
          kaynak: dto.kaynak.trim(),
          beyanTarihi: new Date(dto.beyanTarihi),
          gerekce: dto.gerekce?.trim() ?? null,
        },
      });

      // İzin değişikliği DENETİME YAZILIR: "bu kişiye neden mesaj gitti/gitmedi"
      // sorusunun cevabı budur.
      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'IletisimIzni', varlikId: dto.kisiId,
        sonrakiDeger: {
          kanal: dto.kanal, iletiTuru: dto.iletiTuru, durum: dto.durum,
          kaynak: dto.kaynak, beyanTarihi: dto.beyanTarihi,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id: dto.kisiId, durum: dto.durum };
    });
  }

  /* ---------------------------- Otomatik kural --------------------------- */

  async kuralKaydet(dto: KuralKaydetDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('iletisim.kuralKaydet');

    return this.prisma.tenantIslemi(async (tx) => {
      const sablon = await tx.mesajSablonu.findFirst({
        where: { id: dto.sablonId, tenantId: principal.tenantId, silinmeTarihi: null },
        select: { id: true },
      });
      if (!sablon) throw new KayitBulunamadi(`Şablon bulunamadı: ${dto.sablonId}`);

      const id = randomUUID();
      await tx.otomatikBildirimKurali.upsert({
        where: {
          tenantId_olayKodu_kanal: {
            tenantId: principal.tenantId, olayKodu: dto.olayKodu.trim(), kanal: dto.kanal,
          },
        },
        create: {
          id, tenantId: principal.tenantId,
          olayKodu: dto.olayKodu.trim(), kanal: dto.kanal, sablonId: dto.sablonId,
          aktif: dto.aktif ?? false,
          aciklama: dto.aciklama?.trim() ?? null,
        },
        update: {
          sablonId: dto.sablonId,
          aktif: dto.aktif ?? false,
          aciklama: dto.aciklama?.trim() ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'OtomatikBildirimKurali', varlikId: id,
        sonrakiDeger: {
          olayKodu: dto.olayKodu, kanal: dto.kanal, aktif: dto.aktif ?? false,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      return { id, durum: dto.aktif === true ? 'AKTIF' : 'PASIF' };
    });
  }
}

/**
 * Şablonu çözer ama İSTİSNA FIRLATMAZ: toplu gönderimde tek bir alıcının
 * eksik verisi bütün gönderimi düşürmemelidir. Çözülemeyen mesaj `BASARISIZ`
 * olarak KAYDEDİLİR ve gerekçesi görünür.
 */
function sablonuCozGuvenli(
  govde: string, degerler: Readonly<Record<string, string | null | undefined>>,
): { readonly metin: string; readonly cozuldu: boolean; readonly hata: string | null } {
  try {
    return { metin: sablonuCoz(govde, degerler), cozuldu: true, hata: null };
  } catch (h) {
    return {
      metin: govde,
      cozuldu: false,
      hata: h instanceof Error ? h.message : 'Şablon çözülemedi.',
    };
  }
}
