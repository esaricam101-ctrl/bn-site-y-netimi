/**
 * İstek bağlamı — AsyncLocalStorage ile taşınır.
 *
 * Tenant bağlamı buradan okunur ve her transaction başında
 * `SET LOCAL app.tenant_id` çalıştırılır (BFS v1 §2.3).
 * Bağlam yoksa sorgu sessizce geçmez — hata verir.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Principal, TenantBaglami } from '@bnos/kernel';

/**
 * SATIR KAPSAMI — tenant izolasyonunun İKİNCİ EKSENİ.
 *
 * Tenant ekseni "hangi sitenin verisi" sorusunu yanıtlar; bu eksen "o sitenin
 * içinde hangi HANE" sorusunu. İkisi de aynı yerde kurulur ve aynı yerde
 * (veritabanı politikası) zorlanır.
 *
 * `undefined` = KISITSIZ. Yönetici, denetçi ve sistem işleri bu durumdadır.
 * Kısıtsızlık BİLİNÇLİ olmalıdır: `TenantGuard` rolleri okuyup karar verir,
 * çağrı yerleri değil.
 */
export interface KapsamBaglami {
  /** Görüntüleyenin kişi kaydı. Kendi kaydını her zaman görür. */
  readonly kisiId: string;
  /**
   * OTURULAN bölümler — kişinin fiilen bağlı olduğu hane.
   *
   * Kiracı ve sakin ilişkileri ile, KİRADA OLMAYAN kendi mülkü. Bu bölümlerde
   * hane görünürlüğü tamdır: kişiler, araçlar, misafirler, sakinler.
   */
  readonly oturulanBolumler: readonly string[];
  /**
   * KİRAYA VERİLMİŞ mülk — yalnızca BORÇ ve ÖDEME görünür.
   *
   * ⚠️  Malikin bu bölümdeki hukuki menfaati AİDAT BORCUDUR: KMK md. 22
   *     uyarınca kiracı ödemezse borç malike döner, bu yüzden ödeme durumunu
   *     görmek hakkıdır. Ama kiracının kimliği, sözleşme koşulları, ailesi,
   *     aracı ve misafiri bu hakkın KAPSAMINDA DEĞİLDİR — malik kiracısının
   *     ev hayatını site yazılımından izleyemez (KVKK veri minimizasyonu).
   *
   *     Ayrım tam olarak bu yüzden İKİ AYRI LİSTEDİR; tek liste olsaydı
   *     "borcu görebiliyorsa her şeyi görebilir" sonucu çıkardı.
   */
  readonly mulkBolumler: readonly string[];
}

export interface IstekBaglami {
  readonly correlationId: string;
  readonly principal?: Principal;
  readonly tenant?: TenantBaglami;
  /** Yalnızca `yalnizcaKendiVerisi` rollerinde dolu olur. */
  readonly kapsam?: KapsamBaglami;
  readonly ip: string | null;
  readonly kullaniciAjani: string | null;
}

const depo = new AsyncLocalStorage<IstekBaglami>();

export const baglamIcinde = <T>(baglam: IstekBaglami, fn: () => T): T =>
  depo.run(baglam, fn);

export const mevcutBaglam = (): IstekBaglami | undefined => depo.getStore();

export function mevcutBaglamiZorunluKil(islem: string): IstekBaglami {
  const b = depo.getStore();
  if (!b) throw new Error(`İstek bağlamı yok: '${islem}' çalıştırılamaz.`);
  return b;
}
