/**
 * İSTEK SINIRI — kaba kuvvet ve bellek tükenmesi koruması.
 *
 * ⚠️  NEDEN GEREKLİ: giriş ucu HER denemede scrypt çalıştırır — kullanıcı
 *     bulunamasa bile, çünkü zamanlama sızıntısını önlemek için kukla özetle
 *     doğrulama yapılır (`oturum.service.ts`, doğru bir tasarım). scrypt
 *     parametreleri `N=2^17, r=8`; çalışma belleği `128 × N × r` ≈ **134 MB**.
 *     Sınır olmadığında tek bir istemci, önemsiz bir maliyetle süreci
 *     düşürebilir.
 *
 * ⚠️  ÇÖZÜM SINIRLAMADIR, MALİYETİ AZALTMAK DEĞİL. scrypt parametreleri
 *     düşürülerek "çözülmez": `N=2^17` OWASP 2024 asgarisidir ve bilinçle
 *     seçilmiştir. Parametreyi düşürmek DoS'u hafifletirken parola kırmayı
 *     ucuzlatır — bir açığı kapatıp daha kötüsünü açar.
 *
 * ⚠️  SAYAÇ REDIS'TEDİR, BELLEKTE DEĞİL. Bellek içi bir sayaç çok örnekli
 *     dağıtımda sessizce yanlış çalışır: 3 replikada etkin sınır 3× olur ve
 *     hata görünmez — koruma "var" görünürken üçte bir gücündedir.
 *
 * ⚠️  İKİ AYRI SAYAÇ: IP ve KİMLİK (e-posta). Yalnızca IP sayılsaydı, NAT
 *     arkasındaki bir sitenin bütün sakinleri tek adresten çıktığı için
 *     birbirini kilitlerdi. Yalnızca e-posta sayılsaydı, saldırgan her denemede
 *     farklı e-posta yazarak sınırı hiç görmezdi. İkisi birlikte gerekir.
 *
 * ⚠️  BU KORUMA HIZI SINIRLAR, EŞZAMANLILIĞI DEĞİL — ve fark önemlidir.
 *     Pencere başına N istek demek, o N isteğin AYNI ANDA gelemeyeceği
 *     anlamına gelmez: IP limiti 20 ise en kötü durumda 20 eşzamanlı scrypt
 *     ≈ 2,7 GB'dır. Sınırsız hâle göre büyük kazanç ama sıfır risk değil.
 *     Kalan boşluk, scrypt çağrılarına bir eşzamanlılık kapısı (semafor)
 *     koymakla kapanır; bu AYRI bir iştir ve bu düzeltmenin kapsamında
 *     değildir. Burada yazılı olması, "çözüldü" sanılmasın diyedir.
 */
import {
  CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import type { Request } from 'express';
import { SINIR_ANAHTARI, type IstekSiniriTanimi } from '../decorators';

/**
 * Sayacı ATOMİK artırır ve İLK artışta ömür verir.
 *
 * ⚠️  `INCR` + `EXPIRE` iki ayrı gidiş-dönüş olarak yazılamaz: ikisi arasında
 *     bağlantı koparsa anahtar ÖMÜRSÜZ kalır ve o kimlik KALICI OLARAK
 *     kilitlenir. Hata sessizdir — kullanıcı "şifremi unuttum" akışına gider ve
 *     orada da kilitli kalır. Tek betik bu yarışı tümüyle kaldırır.
 *
 * Dönen değer: pencere içindeki güncel sayım.
 */
const SAYAC_BETIGI = `
local sayim = redis.call('INCR', KEYS[1])
if sayim == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return sayim
`;

/** Kalan saniye — istemciye `Retry-After` olarak bildirilir. */
const KALAN_BETIGI = `
local kalan = redis.call('TTL', KEYS[1])
if kalan < 0 then return 0 end
return kalan
`;

@Injectable()
export class IstekSiniriGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger('IstekSiniri');
  private readonly redis: Redis;

  constructor(private readonly reflector: Reflector) {
    this.redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      /*
       * ⚠️  BAĞLANTI TEMBELDİR ve bu iki nedenle böyledir:
       *
       *   1. Yapıcının YAN ETKİSİ OLMAMALI. Eager bağlanan bir yapıcı, sınıfı
       *      birim testinde kurulamaz kılar: soket açılır, olay döngüsü ayakta
       *      kalır ve test ASILIR. (Bu tam olarak yaşandı.)
       *   2. Bu guard FAIL-OPEN'dır. Açılışta Redis'e bağlanmayı zorunlu kılmak,
       *      "Redis yoksa istek geçsin" politikasıyla çelişirdi: uygulama
       *      açılamadığı için istek hiç gelmezdi.
       *
       * İlk komutta bağlanır; bağlanamazsa aşağıdaki fail-open dalı çalışır.
       */
      lazyConnect: true,
    });
    this.redis.on('error', (h) => this.logger.warn(`Redis hatası: ${h.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    // Tembel bağlantı hiç kurulmamış olabilir (`wait` durumu); o hâlde `quit()`
    // bağlanmayı dener ve kapanışı gereksizce geciktirir. Kapatma kapanışı
    // engellememeli — hata yutulur ama sessiz kalmaz.
    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      this.redis.disconnect();
      return;
    }
    try {
      await this.redis.quit();
    } catch (hata) {
      this.logger.warn(`Redis kapatılamadı: ${(hata as Error).message}`);
    }
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const tanim = this.reflector.getAllAndOverride<IstekSiniriTanimi | undefined>(
      SINIR_ANAHTARI, [ctx.getHandler(), ctx.getClass()],
    );
    // İŞARETSİZ UÇ SINIRLANMAZ. Genel bir sınır, toplu tahakkuk ve toplu
    // gönderim gibi meşru yoğun işleri sessizce keserdi; hangi uçların
    // sınırlanacağı açık bir karardır (`@RequirePermission` ile aynı desen).
    if (!tanim) return true;

    const istek = ctx.switchToHttp().getRequest<Request>();
    const yol = `${istek.method}:${ctx.getClass().name}.${ctx.getHandler().name}`;

    const sayaclar: { readonly ad: string; readonly kimlik: string; readonly limit: number }[] = [];

    const ip = istek.ip ?? 'bilinmiyor';
    sayaclar.push({ ad: 'ip', kimlik: ip, limit: tanim.ipLimiti });

    // Gövdedeki kimlik alanı (e-posta gibi). ÖZETLENİR: ham e-posta Redis'e
    // yazılmaz — sınır sayacı, kişisel veri deposu değildir (KVKK).
    if (tanim.kimlikAlani !== undefined) {
      const govde = istek.body as Record<string, unknown> | undefined;
      const ham = govde?.[tanim.kimlikAlani];
      if (typeof ham === 'string' && ham.length > 0) {
        const ozet = createHash('sha256').update(ham.toLowerCase().trim()).digest('hex').slice(0, 32);
        sayaclar.push({ ad: 'kimlik', kimlik: ozet, limit: tanim.kimlikLimiti });
      }
    }

    for (const s of sayaclar) {
      const anahtar = `sinir:${yol}:${s.ad}:${s.kimlik}`;
      let sayim: number;
      try {
        /*
         * `eval` ile ATOMİK sayaç. Anahtar TENANT KAPSAMLI DEĞİLDİR ve bu
         * bilinçlidir: giriş ucu tenant seçiminden ÖNCE çalışır, o noktada
         * tenant kimliği HENÜZ YOKTUR. Anahtar tenant verisi de taşımaz —
         * yalnızca bir sayaçtır (kimlik özetlenmiştir).
         */
        sayim = Number(await this.redis.eval(SAYAC_BETIGI, 1, anahtar, String(tanim.pencereSn)));
      } catch (hata) {
        /*
         * REDIS DÜŞTÜYSE İSTEK GEÇER (fail-open) ama SESSİZ KALMAZ.
         *
         * Fail-closed seçilseydi bir Redis kesintisi, tüm kullanıcıların giriş
         * yapamadığı TAM BİR KİMLİK KESİNTİSİNE dönüşürdü. Kabul edilen bedel:
         * kesinti süresince kaba kuvvet koruması yoktur. Bu yüzden ERROR
         * seviyesinde loglanır — alarm kurulacak yer burasıdır.
         */
        this.logger.error(
          `İstek sınırı sayacı okunamadı (${anahtar}): ${(hata as Error).message}. ` +
            'Bu istek SINIRSIZ geçti — Redis erişimi düzeltilmelidir.',
        );
        continue;
      }

      if (sayim > s.limit) {
        let kalan = tanim.pencereSn;
        try {
          kalan = Number(await this.redis.eval(KALAN_BETIGI, 1, anahtar)) || tanim.pencereSn;
        } catch { /* TTL okunamadıysa pencerenin tamamı bildirilir */ }

        this.logger.warn(
          `Sınır aşıldı: ${yol} · ${s.ad} · ${sayim}/${s.limit} · ${kalan} sn kaldı`,
        );

        const yanit = ctx.switchToHttp().getResponse<{ setHeader: (a: string, b: string) => void }>();
        yanit.setHeader('Retry-After', String(kalan));

        throw new HttpException(
          {
            // Hangi sayacın dolduğu SÖYLENMEZ: "bu e-posta için sınır doldu"
            // demek, e-postanın kayıtlı olduğunu doğrulardı — giriş ucunun
            // kullanıcı numaralandırmayı engelleme çabasını boşa çıkarır.
            mesaj: 'Çok fazla deneme yapıldı.',
            sonrakiEylem: `${kalan} saniye bekleyip tekrar deneyin.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }
}
