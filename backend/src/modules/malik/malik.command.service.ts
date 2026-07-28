/**
 * Malik Command servisi — hisseli mülkiyet (634 sayılı KMK · ADR v1.1 §5).
 *
 * KAYIT SİLİNMEZ. Devir olduğunda `tapuBitis` verilir ve dönem kapanır;
 * geçmiş malik tarihçede kalır. Borç sorumluluğu borcun oluştuğu anda çözülüp
 * yazılır (snapshot) — geçmiş tapu kaydını silmek o borcun dayanağını yok eder.
 *
 * HİSSE İNVARYANTI — iki yönlü değildir:
 *   Toplam > 1  → HER ZAMAN hatadır; aynı pay iki kişiye yazılmış demektir.
 *                 Yazma anında reddedilir.
 *   Toplam < 1  → EKSİK kayıttır, hata değil: malikler tek tek girilirken
 *                 toplam doğal olarak 1'in altındadır. Tahakkuk öncesi
 *                 `hisseleriZorunluKil` ile zorlanır.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  takvimTarihi, takvimTarihiniOku, takvimTarihiniOkuVeyaNull, takvimTarihiniYaz,
  type Principal,
} from '@bnos/kernel';
import { IsKuraliIhlali, KayitBulunamadi } from '@bnos/core-domain';
import { kesirleriTopla, tarihtekiMalikler, type MalikHissesi } from '@bnos/apartman-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { OutboxServisi } from '../../common/outbox/outbox.service';
import { mevcutBaglamiZorunluKil } from '../../common/context/request-context';
import type { MalikEkleDto } from './dto/malik.dto';
import type { KomutSonucu } from '../tenant/tenant.command.service';

@Injectable()
export class MalikCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditServisi,
    private readonly outbox: OutboxServisi,
  ) {}

  async ekle(bolumId: string, dto: MalikEkleDto, principal: Principal): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('malik.ekle');
    const id = randomUUID();

    const hissePay = BigInt(dto.hissePay);
    const hissePayda = BigInt(dto.hissePayda);
    const baslangic = takvimTarihi(dto.tapuBaslangic);
    const bitis = dto.tapuBitis === undefined ? null : takvimTarihi(dto.tapuBitis);

    if (hissePayda <= 0n) {
      throw new IsKuraliIhlali('Hisse paydası sıfırdan büyük olmalıdır.');
    }
    if (hissePay <= 0n || hissePay > hissePayda) {
      throw new IsKuraliIhlali(
        `Hisse geçerli bir kesir olmalıdır: ${hissePay}/${hissePayda}.`,
        'Payı 0 ile payda arasında verin.',
      );
    }
    if (bitis !== null && bitis < baslangic) {
      throw new IsKuraliIhlali(
        `Tapu bitiş tarihi (${bitis}) başlangıçtan (${baslangic}) önce olamaz.`,
      );
    }
    // Vekalet ya tumuyle vardir ya hic — yarim kayit vekilin yetkisini belirsiz
    // birakir. Ayni kisit veritabaninda da CHECK olarak durur.
    if ((dto.vekilKisiId === undefined) !== (dto.vekaletnameNo === undefined)) {
      throw new IsKuraliIhlali(
        'Vekil bilgisi eksik: vekil kişi ve vekâletname numarası birlikte verilmelidir.',
        'Ya ikisini de girin ya da ikisini de boş bırakın.',
      );
    }

    return this.prisma.tenantIslemi(async (tx) => {
      const bolum = await tx.bagimsizBolum.findFirst({
        where: { id: bolumId, tenantId: principal.tenantId },
        select: { id: true, kapiNo: true },
      });
      if (!bolum) throw new KayitBulunamadi(`Bağımsız bölüm bulunamadı: ${bolumId}`);

      // Kisi ve vekil tenant'a ait olmalidir — FK kontrolu RLS'i baypas eder.
      const kisi = await tx.kisi.findFirst({
        where: { id: dto.kisiId, tenantId: principal.tenantId }, select: { id: true },
      });
      if (!kisi) throw new KayitBulunamadi(`Kişi bulunamadı: ${dto.kisiId}`);

      if (dto.vekilKisiId !== undefined) {
        const vekil = await tx.kisi.findFirst({
          where: { id: dto.vekilKisiId, tenantId: principal.tenantId }, select: { id: true },
        });
        if (!vekil) throw new KayitBulunamadi(`Vekil kişi bulunamadı: ${dto.vekilKisiId}`);
      }

      const mevcutKayitlar = await tx.malik.findMany({
        where: { tenantId: principal.tenantId, bolumId },
        select: { kisiId: true, hissePay: true, hissePayda: true, tapuBaslangic: true, tapuBitis: true },
      });

      const mevcut: MalikHissesi[] = mevcutKayitlar.map((m) => ({
        kisiId: m.kisiId,
        hissePay: m.hissePay,
        hissePayda: m.hissePayda,
        baslangic: takvimTarihiniOku(m.tapuBaslangic),
        bitis: takvimTarihiniOkuVeyaNull(m.tapuBitis),
      }));

      const yeni: MalikHissesi = { kisiId: dto.kisiId, hissePay, hissePayda, baslangic, bitis };

      // Toplamin 1'i ASMASI her zaman hatadir. Baslangic gununde bakmak yeterli:
      // cakisma varsa o gun zaten gorunur.
      const oGunGecerli = [...tarihtekiMalikler(mevcut, baslangic), yeni];
      const toplam = kesirleriTopla(
        oGunGecerli.map((m) => ({ pay: m.hissePay, payda: m.hissePayda })),
      );
      if (toplam.pay > toplam.payda) {
        const oran = (Number(toplam.pay) / Number(toplam.payda)).toFixed(6);
        throw new IsKuraliIhlali(
          `'${bolum.kapiNo}' bölümünde ${baslangic} tarihli hisse toplamı ${oran} olur; 1'i aşamaz.`,
          'Önce devreden malikin tapu dönemini kapatın, sonra yenisini ekleyin.',
        );
      }

      await tx.malik.create({
        data: {
          id, tenantId: principal.tenantId, bolumId, kisiId: dto.kisiId,
          hissePay, hissePayda,
          tapuTuru: dto.tapuTuru ?? 'KAT_MULKIYETI',
          tapuBaslangic: takvimTarihiniYaz(baslangic),
          tapuBitis: bitis === null ? null : takvimTarihiniYaz(bitis),
          tapuYevmiyeNo: dto.tapuYevmiyeNo ?? null,
          vekilKisiId: dto.vekilKisiId ?? null,
          vekaletnameNo: dto.vekaletnameNo ?? null,
          vekaletBitisTarihi:
            dto.vekaletBitisTarihi === undefined
              ? null
              : takvimTarihiniYaz(takvimTarihi(dto.vekaletBitisTarihi)),
        },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'OLUSTUR',
        varlik: 'Malik', varlikId: id,
        sonrakiDeger: {
          bolumId, kapiNo: bolum.kapiNo, kisiId: dto.kisiId,
          // BigInt JSON'a serilestirilemez; denetim kaydinda metin tutulur.
          hisse: `${hissePay}/${hissePayda}`,
          tapuBaslangic: baslangic, tapuBitis: bitis,
        },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.malik.eklendi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Malik', id, version: 1 },
        payload: { bolumId, kisiId: dto.kisiId, hisse: `${hissePay}/${hissePayda}` },
      });

      return { id, durum: 'AKTIF' };
    });
  }

  /** Tapu dönemini kapatır. Kayıt silinmez — tarihçe korunur. */
  async devret(
    bolumId: string,
    malikId: string,
    tapuBitisMetni: string,
    principal: Principal,
  ): Promise<KomutSonucu> {
    const baglam = mevcutBaglamiZorunluKil('malik.devret');
    const tapuBitis = takvimTarihi(tapuBitisMetni);

    return this.prisma.tenantIslemi(async (tx) => {
      const kayit = await tx.malik.findFirst({
        where: { id: malikId, bolumId, tenantId: principal.tenantId },
        select: { id: true, kisiId: true, tapuBaslangic: true, tapuBitis: true },
      });
      if (!kayit) throw new KayitBulunamadi(`Malik kaydı bulunamadı: ${malikId}`);

      const baslangic = takvimTarihiniOku(kayit.tapuBaslangic);
      if (tapuBitis < baslangic) {
        throw new IsKuraliIhlali(
          `Tapu bitiş tarihi (${tapuBitis}) başlangıçtan (${baslangic}) önce olamaz.`,
        );
      }

      const oncekiBitis = takvimTarihiniOkuVeyaNull(kayit.tapuBitis);

      await tx.malik.update({
        where: { id: malikId },
        data: { tapuBitis: takvimTarihiniYaz(tapuBitis) },
      });

      await this.audit.yaz(tx, {
        tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
        varlik: 'Malik', varlikId: malikId,
        oncekiDeger: { tapuBitis: oncekiBitis }, sonrakiDeger: { tapuBitis },
        correlationId: baglam.correlationId,
        ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
      });

      await this.outbox.yayinla(tx, {
        eventType: 'apartman.malik.devredildi', eventVersion: 1,
        tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
        aggregate: { tip: 'Malik', id: malikId, version: 2 },
        payload: { bolumId, kisiId: kayit.kisiId, tapuBitis },
      });

      return { id: malikId, durum: 'DEVREDILDI' };
    });
  }
}
