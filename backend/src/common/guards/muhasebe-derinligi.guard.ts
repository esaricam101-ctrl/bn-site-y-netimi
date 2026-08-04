/**
 * MUHASEBE DERİNLİĞİ KAPISI — `BASIT` projede defter uçları kapalıdır.
 *
 * ⚠️  ÜÇ KAPI'YA DÖRDÜNCÜ EKLENMEDİ (ADR-0006 · BFS v1 §3). Bu bir yetki
 *     kapısı değildir ve global guard zincirine girmez; yalnızca
 *     `MuhasebeController` üzerine takılır. Üç kapı kimliği, kiracıyı ve
 *     izni sorar — burada üçü de geçilmiştir: kullanıcının hakkı vardır,
 *     istediği kavram O PROJEDE yoktur.
 *
 *     Bu yüzden 403 değil **422** döner: yetki sorunu değil, iş kuralı.
 *
 * ⚠️  NEDEN SUNUCUDA: menüden gizlemek görünürlük önlemidir. Adres çubuğuna
 *     yolu yazan ya da API'yi doğrudan çağıran onu görmez. Ölçüldü — kapı
 *     yokken `BASIT` projede yevmiye defteri ve mizan 200 + BOŞ dönüyordu.
 *     Boş dönmek en kötü cevaptır: kullanıcı "veri yok" sanır, oysa kavramın
 *     kendisi tanımsızdır (CT-24).
 *
 * ⚠️  KAYIT YOKLUĞU `BASIT` SAYILMAZ — burada. Parametre satırı olmayan bir
 *     proje kurulumunu HENÜZ YAPMAMIŞTIR; onu basit muhasebe saymak, hesap
 *     planını kurmak için girilen ekranı kendi kendine kilitlerdi (hesap yok
 *     → parametre yok → uç kapalı → hesap eklenemez).
 *
 *     ★ YAZMA yolunda tersi geçerlidir: `tahakkuk.command.service.ts`
 *       içindeki `ciftTarafliZorunluKil` kayıt yokluğunda `BASIT` sayar ve
 *       fiş KESMEZ. Fark bilinçlidir — belirsizlikte okumak zararsız,
 *       deftere kayıt üretmek geri alınamazdır.
 */
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IsKuraliIhlali } from '@bnos/core-domain';
import type { Principal } from '@bnos/kernel';
import { PrismaService } from '../prisma/prisma.service';
import { DERINLIK_MUAF_ANAHTARI } from '../decorators';

@Injectable()
export class MuhasebeDerinligiGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const muafiyet = this.reflector.get<string | undefined>(
      DERINLIK_MUAF_ANAHTARI, ctx.getHandler(),
    );
    if (muafiyet !== undefined) return true;

    const principal = ctx.switchToHttp()
      .getRequest<Request & { principal?: Principal }>().principal;

    // Kimlik çözülmemişse karar bu kapıya ait değildir: AuthGuard zaten
    // reddetmiş olmalıdır. Burada sessizce geçirmek, sıralamadaki bir
    // değişikliği fark edilmez kılardı — ama 500 fırlatmak da yanlış cevap
    // olurdu. Karar sahibine bırakılır.
    if (!principal) return true;

    const parametre = await this.prisma.tenantIslemi(
      (tx) => tx.muhasebeParametresi.findFirst({
        where: { tenantId: principal.tenantId },
        select: { muhasebeDerinligi: true },
      }),
      principal.tenantId,
    );

    if (parametre === null || parametre.muhasebeDerinligi === 'CIFT_TARAFLI') {
      return true;
    }

    throw new IsKuraliIhlali(
      'Bu proje basit muhasebe kullanıyor; hesap planı, yevmiye fişi ve '
        + 'mizan bu projede tanımlı değildir.',
      'Bunların bulunmaması bir eksiklik DEĞİLDİR: basit muhasebede yalnızca '
        + 'kasa ve banka izlenir, tahakkuk ve alacak takibi etkilenmez. '
        + 'Çift taraflı muhasebe gerekiyorsa Muhasebe → Parametreler '
        + 'ekranından derinliği yükseltin.',
    );
  }
}
