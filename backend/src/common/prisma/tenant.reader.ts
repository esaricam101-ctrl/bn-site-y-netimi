/**
 * Tenant üyelik okuyucu — Kapı 2'nin veri kaynağı.
 *
 * ÖNBELLEK NOTU (ADR-0005 · BFS v1 §7):
 * Üyelik ve izin seti önbelleklenebilir (5 dk TTL). Finansal bakiye
 * önbeklenemez. Bu ayrım kasıtlıdır ve karıştırılmamalıdır.
 */
import { Injectable } from '@nestjs/common';
import { onbellekAnahtari, type OnbellekAnahtari, type TenantId } from '@bnos/kernel';
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

  /**
   * SATIR KAPSAMI — görüntüleyenin bağlı olduğu bölümler.
   *
   * ⚠️  ÖNBELLEKLENMEZ. Bir kiracının sözleşmesi bittiğinde ya da bir malik
   *     devrettiğinde kapsam DARALIR; bu bir yetki kaldırmadır ve 5 dakika
   *     geçerli görünmesi kabul edilemez (devir kaydıyla aynı gerekçe).
   *
   * ⚠️  YALNIZCA BUGÜN GEÇERLİ ilişkiler sayılır. Tapusu devredilmiş malik ya
   *     da tahliye olmuş kiracı, eski dairesinin verisini görmeye DEVAM
   *     ETMEMELİDİR — tarihçede kalması görünürlük vermez.
   *
   * ⚠️  Bu sorgu KAPSAM KURULMADAN ÖNCE koşar (bağlamda `kapsam` henüz yok),
   *     dolayısıyla kapsam politikası kendisini süzmez. Sıra tersine dönerse
   *     kullanıcı kendi bölümlerini bulamaz ve HİÇBİR ŞEY göremez.
   */
  /** Kapsam önbelleği — 5 dk. Aktif geçersizleştirme `kapsamiGecersizKil`. */
  private static readonly KAPSAM_TTL_SN = 300;

  private kapsamAnahtari(tid: TenantId, kisiId: string): OnbellekAnahtari {
    return onbellekAnahtari({ tenantId: tid, alan: 'kapsam', kimlik: kisiId, surum: 1 });
  }

  /**
   * KAPSAM GEÇERSİZLEŞTİRME — ilişki dönemleri değiştiğinde çağrılır.
   *
   * ⚠️  TTL TEK BAŞINA YETMEZ. Tahliye edilen kiracının 5 dakika daha daireyi
   *     görmesi kabul edilemez — `devirGecerliMi` aynı gerekçeyle hiç
   *     önbelleklenmiyor. Aktif silme birincil yoldur; TTL yalnızca AĞDIR,
   *     bir silme noktası unutulursa kalıcı açık doğmasın diye.
   */
  async kapsamiGecersizKil(tid: TenantId, kisiId: string): Promise<void> {
    await this.onbellek.sil(this.kapsamAnahtari(tid, kisiId));
  }

  async kapsamBolumleri(
    tid: TenantId, kisiId: string,
  ): Promise<{ readonly oturulan: readonly string[]; readonly mulk: readonly string[] }> {
    /*
     * ⚠️  ÖNBELLEK: bir malikin bölümleri saniyede değişmez ama liste HER
     *     İSTEKTE yeniden kuruluyordu. Ölçüm (800 bölüm): 4 sorgu 27 ms +
     *     serileştirme 0,4 ms — istek başına boşa giden ~28 ms.
     *
     *     Önbelleklenen şey BÖLÜM KİMLİKLERİDİR; finansal tutar, bakiye ya da
     *     borç durumu DEĞİL. ADR-0005'in yasak alan listesine takılmaz
     *     (`kapsam` o listede yoktur) — istisna gerekmedi.
     */
    const anahtar = this.kapsamAnahtari(tid, kisiId);
    const onbellekten = await this.onbellek.getir<{
      readonly oturulan: readonly string[]; readonly mulk: readonly string[];
    }>(anahtar);
    if (onbellekten) return onbellekten;

    const bugun = new Date(new Date().toISOString().slice(0, 10));

    const [malikler, kiracilar, sakinler, kiradakiler] = await this.prisma.tenantIslemi(
      (tx) => Promise.all([
        tx.malik.findMany({
          where: {
            tenantId: tid, kisiId,
            tapuBaslangic: { lte: bugun },
            OR: [{ tapuBitis: null }, { tapuBitis: { gte: bugun } }],
          },
          select: { bolumId: true },
        }),
        tx.kiraci.findMany({
          where: {
            tenantId: tid, kisiId, tahliyeTarihi: null,
            baslangic: { lte: bugun },
            OR: [{ bitis: null }, { bitis: { gte: bugun } }],
          },
          select: { bolumId: true },
        }),
        tx.sakin.findMany({
          where: {
            tenantId: tid, kisiId,
            girisTarihi: { lte: bugun },
            OR: [{ cikisTarihi: null }, { cikisTarihi: { gte: bugun } }],
          },
          select: { bolumId: true },
        }),
        // Kişinin MALİK olduğu bölümlerde BAŞKASININ kiracı olup olmadığı.
        tx.kiraci.findMany({
          where: {
            tenantId: tid,
            kisiId: { not: kisiId },
            tahliyeTarihi: null,
            baslangic: { lte: bugun },
            OR: [{ bitis: null }, { bitis: { gte: bugun } }],
          },
          select: { bolumId: true },
        }),
      ]),
      tid,
    );

    const malikBolumler = new Set(malikler.map((m) => m.bolumId));
    const kiradaOlanlar = new Set(kiradakiler.map((k) => k.bolumId));

    /*
     * ⚠️  KENDİ MÜLKÜ AMA KİRADA → yalnızca BORÇ/ÖDEME (mulk).
     *     Kirada DEĞİLSE malik orada oturuyor kabul edilir → tam hane
     *     görünürlüğü (oturulan).
     *
     *     Ayrım "kirada mı" sorusuyla kurulur çünkü hukuki menfaat orada
     *     değişir: kiracı varken malikin menfaati aidat borcudur (KMK md. 22
     *     müteselsil sorumluluk), kiracının ev hayatı değildir.
     */
    const oturulan = new Set<string>([
      ...kiracilar.map((k) => k.bolumId),
      ...sakinler.map((s) => s.bolumId),
      ...[...malikBolumler].filter((b) => !kiradaOlanlar.has(b)),
    ]);
    const mulk = new Set<string>(
      [...malikBolumler].filter((b) => kiradaOlanlar.has(b)),
    );

    const sonuc = { oturulan: [...oturulan], mulk: [...mulk] };
    await this.onbellek.yaz(anahtar, sonuc, TenantOkuyucu.KAPSAM_TTL_SN);
    return sonuc;
  }

  /**
   * DEVREDİLMİŞ PROJE ERİŞİMİ — Kapı 2'nin ikinci yolu (ADR-0009).
   *
   * Yönetim firmasının kullanıcısı, yönettiği projede AYRI BİR `kullanici`
   * kaydına sahip DEĞİLDİR (kimliği çoğaltmak, KVKK silme talebinde kişinin
   * kaç tenant'a yayıldığını takip edilemez kılardı). Erişim, firma tenant'ı
   * ile proje tenant'ı arasındaki **aktif devir** kaydından gelir.
   *
   * ⚠️  BU TEK KARAR NOKTASIDIR. İki yere kopyalanırsa biri güncellenmeyi
   *     unutur ve firma, devri sona ermiş bir projeyi okumaya devam eder —
   *     sessiz bir yetki aşımı.
   *
   * ⚠️  ÖNBELLEKLENMEZ. Üyelik 5 dk önbelleklenebilir çünkü değişimi
   *     nadirdir ve etkisi sınırlıdır; devrin sona ermesi bir YETKİ
   *     KALDIRMADIR ve 5 dakika boyunca geçerli görünmesi kabul edilemez.
   *
   * Sorgu, devir tablosunun İKİ TARAFLI politikası altında koşar: bağlam
   * firma tenant'ıyla kurulur, satır `yonetim_tenant_id` tarafından görünür.
   */
  async devirGecerliMi(
    yonetimTenantId: TenantId,
    projeTenantId: string,
    gun: string,
  ): Promise<{ readonly dayanak: string; readonly saatDilimi: string } | null> {
    const kayit = await this.prisma.tenantIslemi(
      (tx) =>
        tx.yonetimDelegasyonu.findFirst({
          where: {
            yonetimTenantId,
            projeTenantId,
            durum: 'AKTIF',
            baslangic: { lte: new Date(gun) },
            OR: [{ bitis: null }, { bitis: { gte: new Date(gun) } }],
          },
          select: {
            dayanak: true,
            projeTenant: { select: { saatDilimi: true, durum: true } },
          },
        }),
      yonetimTenantId,
    );

    if (!kayit || kayit.projeTenant.durum === 'ARSIV') return null;
    return { dayanak: kayit.dayanak, saatDilimi: kayit.projeTenant.saatDilimi };
  }
}
