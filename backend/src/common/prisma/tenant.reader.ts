/**
 * Tenant üyelik okuyucu — Kapı 2'nin veri kaynağı.
 *
 * ÖNBELLEK NOTU (ADR-0005 · BFS v1 §7):
 * Üyelik ve izin seti önbelleklenebilir (5 dk TTL). Finansal bakiye
 * önbeklenemez. Bu ayrım kasıtlıdır ve karıştırılmamalıdır.
 */
import { Injectable } from '@nestjs/common';
import { onbellekAnahtari, type TenantId } from '@bnos/kernel';
import { PrismaService } from './prisma.service';
import { OnbellekServisi } from './cache.service';

export interface UyelikBilgisi {
  readonly kisiId: string;
  readonly saatDilimi: string;
  readonly roller: readonly string[];
}

@Injectable()
export class TenantOkuyucu {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onbellek: OnbellekServisi,
  ) {}

  async uyelikVarMi(tid: TenantId, kullaniciId: string): Promise<UyelikBilgisi | null> {
    const anahtar = onbellekAnahtari({
      tenantId: tid, alan: 'uyelik', kimlik: kullaniciId, surum: 1,
    });

    const onbellekten = await this.onbellek.getir<UyelikBilgisi>(anahtar);
    if (onbellekten) return onbellekten;

    // TENANT İŞLEMİ ZORUNLUDUR. `kullanici` RLS taşır; bağlam kurulmadan
    // yapılan sorgu "Tenant baglami kurulmadan..." ile düşer ve Kapı 2 her
    // istekte 500 verir.
    //
    // Bağlam, TOKEN'DAKİ `tid` ile kurulur — istek gövdesinden değil. Sorgu
    // ayrıca `tenantId: tid` koşulunu KORUR: RLS son savunma hattıdır,
    // tek savunma değil (BFS v1 §2.2).
    const kayit = await this.prisma.tenantIslemi(
      (tx) =>
        tx.kullanici.findFirst({
          where: { id: kullaniciId, tenantId: tid, aktif: true },
          select: {
            kisiId: true,
            roller: { select: { rolKodu: true } },
            tenant: { select: { saatDilimi: true, durum: true } },
          },
        }),
      tid,
    );

    if (!kayit || kayit.tenant.durum === 'ARSIV') return null;

    const bilgi: UyelikBilgisi = {
      kisiId: kayit.kisiId,
      saatDilimi: kayit.tenant.saatDilimi,
      roller: kayit.roller.map((r) => r.rolKodu),
    };

    await this.onbellek.yaz(anahtar, bilgi, 300);
    return bilgi;
  }
}
