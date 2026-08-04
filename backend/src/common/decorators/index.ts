import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Izin } from '@bnos/core-domain';
import type { Principal } from '@bnos/kernel';

/** Üç kapıyı atlar. AÇIK ve GEREKÇELİ olmalıdır (BFS v1 §3). */
export const PUBLIC_ANAHTARI = 'bnos:public';
export const Public = (gerekce: string): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_ANAHTARI, gerekce);

/** Kapı 2'yi atlar — yalnızca tenant seçimi öncesi uçlar için. */
export const TENANTSIZ_ANAHTARI = 'bnos:tenantsiz';
export const Tenantsiz = (gerekce: string): MethodDecorator =>
  SetMetadata(TENANTSIZ_ANAHTARI, gerekce);

/**
 * MUHASEBE DERİNLİĞİ KAPISINDAN MUAF — `BASIT` projede de çalışır.
 *
 * ⚠️  ÜÇ KAPIDAN BİRİ DEĞİLDİR. Yetkiyle ilgisi yoktur: kullanıcının izni
 *     tamdır, o projede KAVRAM yoktur. Bu yüzden 403 değil 422 döner.
 *
 * Muafiyet GEREKÇE İSTER (`Public` ve `Tenantsiz` gibi). Sebebi yazılmayan
 * bir muafiyet, altı ay sonra "neden buradaydı" sorusuna cevap veremez ve
 * kopyala-yapıştır ile çoğalır.
 */
export const DERINLIK_MUAF_ANAHTARI = 'bnos:derinlik-muaf';
export const DerinliktenMuaf = (gerekce: string): MethodDecorator =>
  SetMetadata(DERINLIK_MUAF_ANAHTARI, gerekce);

/** Kapı 3 — gerekli izin. */
export const IZIN_ANAHTARI = 'bnos:izin';
export const RequirePermission = (...izinler: Izin[]): MethodDecorator =>
  SetMetadata(IZIN_ANAHTARI, izinler);

/**
 * İstek sınırı tanımı — pahalı ve kötüye kullanılabilir uçlar için.
 *
 * İki sayaç birden uygulanır ve İKİSİ DE geçilmelidir:
 *   · `ipLimiti`      — kaynak adres başına. NAT arkasındaki bir sitenin
 *                       tamamı tek adresten çıkabileceği için GEVŞEK tutulur.
 *   · `kimlikLimiti`  — gövdedeki kimlik alanı başına (e-posta gibi). Hedefli
 *                       parola denemesini kesen asıl sayaç budur, SIKI tutulur.
 */
export interface IstekSiniriTanimi {
  readonly ipLimiti: number;
  readonly kimlikLimiti: number;
  readonly pencereSn: number;
  /** Gövdede sayılacak alan adı. Verilmezse yalnızca IP sayılır. */
  readonly kimlikAlani?: string;
}

export const SINIR_ANAHTARI = 'bnos:istek-siniri';
export const IstekSiniri = (tanim: IstekSiniriTanimi): MethodDecorator =>
  SetMetadata(SINIR_ANAHTARI, tanim);

/** Çözülmüş principal. */
export const AktifPrincipal = createParamDecorator(
  (_veri: unknown, ctx: ExecutionContext): Principal => {
    const principal = ctx.switchToHttp().getRequest<{ principal?: Principal }>().principal;
    if (!principal) {
      throw new Error('Principal çözülmedi. AuthGuard önce çalışmalıdır.');
    }
    return principal;
  },
);
