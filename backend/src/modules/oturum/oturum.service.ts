/**
 * Oturum servisi — Kapı 1'in (Kimlik) token üreticisi.
 *
 * Tek giriş ekranı, rol bazlı yönlendirme (ADR v1.1 §10):
 * kullanıcı giriş yaptıktan sonra rolüne uygun panele yönlendirilir.
 *
 * GÜVENLİK KURALLARI:
 *   1. Hatalı e-posta ile hatalı şifre AYIRT EDİLMEZ — kullanıcı sayımını önler.
 *   2. Kullanıcı bulunmasa bile şifre doğrulaması ÇALIŞTIRILIR — zamanlama sızıntısını önler.
 *   3. Token'daki `tid` claim'i tenant kimliğinin TEK kaynağıdır; istek
 *      gövdesinden veya sorgu parametresinden ASLA okunmaz (BFS v1 §12).
 *   4. İzinler token'a GÖMÜLÜR ve kısa ömürlüdür (15 dk). Yetki değişikliği
 *      en geç bir yenileme döngüsünde etkili olur.
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { izinleriBirlestir, varsayilanPanel, type RolKodu } from '@bnos/core-domain';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SifreServisi } from '../../common/security/sifre.service';
import { AuditServisi } from '../../common/audit/audit.service';
import { mevcutBaglam } from '../../common/context/request-context';
import { tenantId } from '@bnos/kernel';
import type { GirisDto } from './dto/oturum.dto';

export interface GirisYaniti {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly varsayilanPanel: string;
  readonly kullanici: {
    readonly id: string;
    readonly adSoyad: string;
    readonly tenantId: string;
    readonly tenantAdi: string;
    readonly roller: readonly string[];
  };
}

/** Kullanıcı yokken de aynı işi yapmak için kullanılan sahte özet. */
const KUKLA_OZET =
  'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

@Injectable()
export class OturumServisi {
  private readonly logger = new Logger('Oturum');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sifre: SifreServisi,
    private readonly jwt: JwtService,
    private readonly audit: AuditServisi,
  ) {}

  async giris(dto: GirisDto): Promise<GirisYaniti> {
    const baglam = mevcutBaglam();

    // Tenant seçimi ÖNCESİ okuma: kullanıcı tablosu RLS taşır, bu yüzden
    // giriş sorgusu sistem işlemi olarak çalışır ve YALNIZCA e-posta eşleşmesi yapar.
    const kullanici = await this.prisma.sistemIslemi((tx) =>
      tx.kullanici.findFirst({
        where: { eposta: dto.eposta.toLowerCase().trim(), aktif: true, silindiMi: false },
        select: {
          id: true, tenantId: true, sifreHash: true,
          kisi: { select: { ad: true, soyad: true } },
          roller: { select: { rolKodu: true } },
          tenant: { select: { ad: true, durum: true } },
        },
      }),
    );

    // Kullanıcı yoksa da doğrulama çalışır — zamanlama farkı sızdırmaz.
    const gecerli = await this.sifre.dogrula(dto.sifre, kullanici?.sifreHash ?? KUKLA_OZET);

    if (!kullanici || !gecerli) {
      this.logger.warn(`[${baglam?.correlationId ?? 'yok'}] Başarısız giriş denemesi`);
      // Hatalı e-posta ile hatalı şifre AYIRT EDİLMEZ.
      throw new UnauthorizedException({
        mesaj: 'E-posta veya şifre hatalı.',
        sonrakiEylem: 'Bilgilerinizi kontrol edip tekrar deneyin.',
      });
    }

    if (kullanici.tenant.durum === 'ARSIV' || kullanici.tenant.durum === 'ASKIDA') {
      throw new UnauthorizedException({
        mesaj: 'Bu apartmanın hesabı şu anda etkin değil.',
        sonrakiEylem: 'Yönetim şirketinizle iletişime geçin.',
      });
    }

    const roller = kullanici.roller.map((r) => r.rolKodu as RolKodu);
    const izinler = izinleriBirlestir(roller);
    const tid = tenantId(kullanici.tenantId);

    const accessToken = await this.jwt.signAsync(
      { sub: kullanici.id, tip: 'INSAN', tid: kullanici.tenantId, izinler },
      { expiresIn: process.env['JWT_ACCESS_TTL'] ?? '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: kullanici.id, tid: kullanici.tenantId, jti: randomUUID(), tur: 'refresh' },
      { expiresIn: process.env['JWT_REFRESH_TTL'] ?? '7d' },
    );

    await this.prisma.tenantIslemi(async (tx) => {
      await tx.kullanici.update({
        where: { id: kullanici.id },
        data: { sonGirisAni: new Date() },
      });
      await this.audit.yaz(tx, {
        tenantId: tid,
        principal: { id: kullanici.id, tip: 'INSAN', tenantId: tid, izinler },
        eylem: 'GIRIS', varlik: 'Kullanici', varlikId: kullanici.id,
        correlationId: baglam?.correlationId ?? randomUUID(),
        ip: baglam?.ip ?? null, kullaniciAjani: baglam?.kullaniciAjani ?? null,
      });
    }, tid);

    return {
      accessToken,
      refreshToken,
      varsayilanPanel: varsayilanPanel(roller),
      kullanici: {
        id: kullanici.id,
        adSoyad: `${kullanici.kisi.ad} ${kullanici.kisi.soyad}`,
        tenantId: kullanici.tenantId,
        tenantAdi: kullanici.tenant.ad,
        roller,
      },
    };
  }

  /** Yenileme: izinler VERİTABANINDAN tazelenir, eski token'dan kopyalanmaz. */
  async yenile(refreshToken: string): Promise<{ accessToken: string }> {
    let yuk: { sub: string; tid: string; tur?: string };
    try {
      yuk = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException({
        mesaj: 'Oturum yenilenemedi.',
        sonrakiEylem: 'Yeniden giriş yapın.',
      });
    }
    if (yuk.tur !== 'refresh') {
      throw new UnauthorizedException({ mesaj: 'Geçersiz yenileme belirteci.' });
    }

    const kullanici = await this.prisma.sistemIslemi((tx) =>
      tx.kullanici.findFirst({
        where: { id: yuk.sub, aktif: true, silindiMi: false },
        select: { id: true, tenantId: true, roller: { select: { rolKodu: true } } },
      }),
    );
    if (!kullanici) {
      throw new UnauthorizedException({
        mesaj: 'Kullanıcı artık etkin değil.',
        sonrakiEylem: 'Yöneticinizle iletişime geçin.',
      });
    }

    const izinler = izinleriBirlestir(kullanici.roller.map((r) => r.rolKodu as RolKodu));
    const accessToken = await this.jwt.signAsync(
      { sub: kullanici.id, tip: 'INSAN', tid: kullanici.tenantId, izinler },
      { expiresIn: process.env['JWT_ACCESS_TTL'] ?? '15m' },
    );
    return { accessToken };
  }
}
