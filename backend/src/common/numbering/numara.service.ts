/**
 * Numara tahsis servisi — ADR v1.1 §35 · BFS v1 §8
 *
 * İKİ AYRI MEKANİZMA. Karıştırılması veri bütünlüğü sorunudur:
 *
 *   BOŞLUKSUZ  → sayaç tablosu + advisory lock, kaydın transaction'ı İÇİNDE.
 *                PostgreSQL SEQUENCE KULLANILMAZ: sequence rollback'te geri
 *                sarmaz ve boşluk bırakır. Makbuz serisinde boşluk yasal sorundur.
 *
 *   BOŞLUKLU   → sequence yeterlidir. Kilitsiz, çok daha hızlı.
 *                Her numara boşluksuz olmak zorunda DEĞİLDİR; boşluksuzluk
 *                gereksiz yere uygulanırsa her tahakkuk tek sıraya dizilir.
 */
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { numaraBicimlendir, sayacAnahtari, seriTanimi } from '@bnos/core-domain';
import type { TenantId } from '@bnos/kernel';

export interface NumaraIstegi {
  readonly tenantId: TenantId;
  readonly seriKodu: string;
  readonly yil: number;
  readonly tip?: string;
}

@Injectable()
export class NumaraServisi {
  /**
   * Numara tahsis eder. ÇAĞIRANIN transaction'ı içinde çalışmalıdır —
   * ayrı transaction kullanılsaydı kayıt rollback olsa bile numara tüketilirdi.
   */
  async tahsisEt(tx: Prisma.TransactionClient, istek: NumaraIstegi): Promise<string> {
    const tanim = seriTanimi(istek.seriKodu);
    const anahtar = sayacAnahtari(tanim, istek.tenantId, istek.yil, istek.tip);

    if (tanim.tip === 'BOSLUKSUZ') {
      // Advisory lock: aynı seri için eşzamanlı tahsisleri sıraya dizer.
      // Transaction bitince OTOMATİK bırakılır (pg_advisory_xact_lock).
      const kilitAnahtari = this.kilitAnahtari(anahtar);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${kilitAnahtari}::bigint)`;
    }

    const sayac = await tx.numaraSayaci.upsert({
      where: {
        tenantId_seriKodu_kapsamAnahtari: {
          tenantId: istek.tenantId,
          seriKodu: tanim.kod,
          kapsamAnahtari: anahtar,
        },
      },
      create: {
        id: randomUUID(),
        tenantId: istek.tenantId,
        seriKodu: tanim.kod,
        kapsamAnahtari: anahtar,
        mevcutDeger: 1n,
      },
      update: { mevcutDeger: { increment: 1 } },
      select: { mevcutDeger: true },
    });

    return numaraBicimlendir(tanim, {
      yil: istek.yil,
      sira: Number(sayac.mevcutDeger),
      ...(istek.tip !== undefined ? { tip: istek.tip } : {}),
    });
  }

  /**
   * Metin anahtarını advisory lock'un beklediği 64-bit tam sayıya indirger.
   * Çakışma olasılığı düşüktür ve çakışma yalnızca gereksiz serileştirmeye
   * yol açar — yanlış numaraya değil.
   */
  private kilitAnahtari(anahtar: string): bigint {
    let h = 1469598103934665603n; // FNV-1a 64-bit offset basis
    for (const bayt of Buffer.from(anahtar, 'utf8')) {
      h ^= BigInt(bayt);
      h = (h * 1099511628211n) & 0xffff_ffff_ffff_ffffn;
    }
    // PostgreSQL bigint işaretlidir; en anlamlı biti düşür.
    return h & 0x7fff_ffff_ffff_ffffn;
  }
}
