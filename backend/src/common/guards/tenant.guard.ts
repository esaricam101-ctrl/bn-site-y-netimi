/**
 * KAPI 2 — KİRACI (ADR-0006 · BFS v1 §3)
 *
 * Principal'ın tenant üyeliği doğrulanır ve TenantContext kurulur.
 * Bu kapı geçilmeden Kapı 3 çalışamaz: izinler tenant'a görelidir.
 *
 * ÖNEMLİ: Bu kapı RLS'in yerine geçmez. RLS son savunma hattıdır —
 * bu kapı unutulursa veritabanı bağlamsız sorguyu reddeder.
 *
 * ÜYELİĞİN İKİ YOLU VAR (ADR-0009):
 *   1. DOĞRUDAN — kullanıcının jetondaki tenant'ta `kullanici` kaydı var.
 *   2. AÇIK DEVİR — kullanıcı bir YÖNETİM FİRMASI tenant'ının üyesidir ve o
 *      firma, jetondaki proje tenant'ını yönetmek üzere aktif bir devir
 *      kaydına sahiptir. Jeton bu durumda `dvr` (devir) claim'i taşır.
 *
 * İkinci yol RLS'i GEVŞETMEZ: yalnızca yetkilendirmeyi genişletir. Sorgular
 * yine tek tenant bağlamında koşar ve devir kaydı silinse bile RLS ayakta
 * kalır — güvenlik iki bağımsız katmandadır (ADR-0002'nin yazdığı yol).
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tenantId, type Principal, type TenantBaglami } from '@bnos/kernel';
import { PUBLIC_ANAHTARI, TENANTSIZ_ANAHTARI } from '../decorators';
import { mevcutBaglam } from '../context/request-context';
import { TenantOkuyucu } from '../prisma/tenant.reader';

/** Devir geçerliliği TAKVİM GÜNÜNE göre bakılır (BFS v1 §4.2). */
function bugun(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly okuyucu: TenantOkuyucu,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<string | undefined>(PUBLIC_ANAHTARI, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    if (this.reflector.getAllAndOverride<string | undefined>(TENANTSIZ_ANAHTARI, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }

    const istek = ctx.switchToHttp().getRequest<Request & { principal?: Principal; tenant?: TenantBaglami }>();
    const principal = istek.principal;
    if (!principal) {
      // Kapı 1 çalışmadıysa burası da geçilemez — sıra korunur.
      throw new ForbiddenException({ mesaj: 'Kimlik çözülmeden tenant bağlamı kurulamaz.' });
    }

    // Tenant KİMLİĞİ TOKEN CLAIM'İNDEN gelir, istek parametresinden ASLA (BFS v1 §12).
    const uyelik = await this.okuyucu.uyelikVarMi(principal.tenantId, principal.id);

    let saatDilimi = uyelik?.saatDilimi;

    if (!uyelik) {
      // İkinci yol: AÇIK DEVİR. `dvr` claim'i de TOKEN'DAN gelir; istek
      // parametresinden okunsaydı kullanıcı istediği firmayı yazıp devri
      // kendisi uydurabilirdi.
      const yonetimTenantId = istek.principal?.devirYonetimTenantId;
      if (yonetimTenantId === undefined) {
        // Kapsam dışı istek 403 döner, filtrelenmiş 200 DEĞİL.
        throw new ForbiddenException({
          mesaj: 'Bu projeye erişim yetkiniz yok.',
          sonrakiEylem: 'Yöneticinizden erişim talep edin.',
        });
      }

      // Firma üyeliği ÖNCE doğrulanır: devir kaydı varken firmanın üyesi
      // olmayan biri projeye giremez.
      const firmaUyeligi = await this.okuyucu.uyelikVarMi(
        tenantId(yonetimTenantId), principal.id,
      );
      if (!firmaUyeligi) {
        throw new ForbiddenException({
          mesaj: 'Yönetim firmasında etkin bir kullanıcı kaydınız yok.',
          sonrakiEylem: 'Yöneticinizden erişim talep edin.',
        });
      }

      const devir = await this.okuyucu.devirGecerliMi(
        tenantId(yonetimTenantId), principal.tenantId, bugun(),
      );
      if (!devir) {
        throw new ForbiddenException({
          mesaj: 'Bu projenin yönetimi firmanıza devredilmemiş ya da devir sona ermiş.',
          sonrakiEylem: 'Portföy Yönetim Merkezi\'nden erişilebilir projeleri görün.',
        });
      }
      saatDilimi = devir.saatDilimi;
    }

    const tenant: TenantBaglami = {
      tenantId: principal.tenantId,
      saatDilimi: saatDilimi as string,
    };
    istek.tenant = tenant;
    const baglam = mevcutBaglam();
    if (baglam) Object.assign(baglam, { tenant });
    return true;
  }
}
