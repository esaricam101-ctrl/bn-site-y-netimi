/**
 * Kiracı Command servisi — kira sözleşmesi (ADR v1.1 §5).
 *
 * Kiracı, SAKİN ile aynı şey değildir: şirket kiracı olup hiç oturmayabilir,
 * kiracının ailesi oturur. Fiilen oturanlar `Sakin` tablosundadır.
 *
 * KAYIT SİLİNMEZ. Tahliyede sözleşme kapanır; geçmiş kiracı tarihçede kalır —
 * "Şubat borcu neden eski kiracıda?" sorusunun cevabı budur.
 *
 * TEKİLLİK: Bir bölümde aynı anda EN FAZLA BİR kiracı bulunur. İki geçerli
 * kira ilişkisi olursa kullanana ait gider yanlış kişiye yazılır ve hata
 * sessizdir; kural `iliskiyiDogrula` ile yazma anında zorlanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { iliskiyiDogrula, type BolumIliskisi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { KiraciEkleDto, KiraciTahliyeDto } from './dto/kiraci.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class KiraciCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async ekle(bolumId: string, dto: KiraciEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kiraci.ekle');
    const id = randomUUID();

    const baslangic = takvimTarihi(dto.baslangic);
    const bitis = dto.bitis === undefined ? null : takvimTarihi(dto.bitis);

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      const kisi = await tx.kisi.findFirst({
        where: { id: dto.kisiId, tenantId: principal.tenantId }, select: { id: true },
      });
      if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.kisiId}`);

      // Cakisma kontrolu domain'e aittir; kiraci tekilligi orada tanimli.
      const mevcutKayitlar = await tx.kiraci.findMany({
        where: { tenantId: principal.tenantId, bolumId },
        select: { kisiId: true, baslangic: true, bitis: true },
      });

      const mevcut: BolumIliskisi[] = mevcutKayitlar.map((k) => ({
        kisiId: k.kisiId,
        rol: 'KIRACI' as const,
        baslangic: takvimTarihiniOku(k.baslangic),
        bitis: takvimTarihiniOkuVeyaNull(k.bitis),
      }));

      iliskiyiDogrula(mevcut, {
        kisiId: dto.kisiId, rol: 'KIRACI', baslangic, bitis,
      });

      await tx.kiraci.create({
        data: {
          id, tenantId: principal.tenantId, bolumId, kisiId: dto.kisiId,
          baslangic: takvimTarihiniYaz(baslangic),
          bitis: bitis === null ? null : takvimTarihiniYaz(bitis),
          sozlesmeNo: dto.sozlesmeNo ?? null,
          sozlesmeTarihi:
            dto.sozlesmeTarihi === undefined
              ? null
              : takvimTarihiniYaz(takvimTarihi(dto.sozlesmeTarihi)),
          depozito: dto.depozito ?? null,
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Kiraci', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId: dto.kisiId,
          baslangic, bitis, sozlesmeNo: dto.sozlesmeNo ?? null,
          depozito: dto.depozito ?? null,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.kiraci.eklendi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kiraci', id, version: 1 },
        payload: { bolumId, kisiId: dto.kisiId, baslangic },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** Tahliye — sözleşme kapanır, kayıt silinmez. */
  async tahliyeEt(
    bolumId: string,
    kiraciId: string,
    dto: KiraciTahliyeDto,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('kiraci.tahliye');
    const tahliyeTarihi = takvimTarihi(dto.tahliyeTarihi);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.kiraci.findFirst({
        where: { id: kiraciId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, baslangic: true, bitis: true, tahliyeTarihi: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Kiracı kaydı bulunamadı: ${kiraciId}`);

      const baslangic = takvimTarihiniOku(kayit.baslangic);
      if (tahliyeTarihi < baslangic) {
        throw new IsKuraliIhlali(
          `Tahliye tarihi (${tahliyeTarihi}) sözleşme başlangıcından (${baslangic}) önce olamaz.`,
        );
      }
      if (kayit.tahliyeTarihi !== null) {
        throw new IsKuraliIhlali(
          `Bu kira sözleşmesi ${takvimTarihiniOku(kayit.tahliyeTarihi)} tarihinde zaten tahliye edilmiş.`,
          'Yeni bir kira sözleşmesi oluşturun.',
        );
      }

      // Tahliye sozlesmeyi de kapatir: bitis bos kalirsa iliski suresiz
      // gorunur ve yeni kiraci eklenemez.
      await tx.kiraci.update({
        where: { id: kiraciId },
        data: {
          tahliyeTarihi: takvimTarihiniYaz(tahliyeTarihi),
          tahliyeGerekcesi: dto.tahliyeGerekcesi,
          bitis: takvimTarihiniYaz(tahliyeTarihi),
          depozitoIadeTarihi:
            dto.depozitoIadeTarihi === undefined
              ? null
              : takvimTarihiniYaz(takvimTarihi(dto.depozitoIadeTarihi)),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Kiraci', varlikId: kiraciId,
        oncekiDeger: { bitis: takvimTarihiniOkuVeyaNull(kayit.bitis), tahliyeTarihi: null },
        sonrakiDeger: { bitis: tahliyeTarihi, tahliyeTarihi },
        gerekce: dto.tahliyeGerekcesi,
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.kiraci.tahliye_edildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Kiraci', id: kiraciId, version: 2 },
        payload: { bolumId, kisiId: kayit.kisiId, tahliyeTarihi },
      });

      return { id: kiraciId, durum: 'TAHLIYE_EDILDI' };
    });
  }
}
