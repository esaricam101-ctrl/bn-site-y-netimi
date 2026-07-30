/**
 * DAYANAĞI SONA EREN SAKİNLERE OTOMATİK ÇIKIŞ.
 *
 * Sakin, bir malike ya da kiracıya DAYANARAK oturur (0021). Dayanak sona
 * erdiğinde — tapu devredildiğinde ya da kiracı tahliye edildiğinde — o
 * dayanağa bağlı sakinlerin oturma hakkı da sona erer.
 *
 * ⚠️  ELLE YAPILMASI BEKLENSEYDİ UNUTULURDU. Kiracı tahliye edilir, ailesi
 *     listede "hâlen oturuyor" olarak kalır; acil durum listesi, "kim
 *     oturuyor" raporu ve daire kartı AYLARCA yanlış çalışırdı. Hata SESSİZ
 *     olurdu: kayıt hâlâ geçerli görünür, kimse bir şey fark etmez.
 *
 * ⚠️  TEK YERDE YAZILIR. Malik devri ve kiracı tahliyesi için ayrı ayrı
 *     yazılsaydı biri düzeltildiğinde öteki eski davranmaya devam ederdi.
 *
 * ⚠️  ÇIKIŞ TARİHİ, DAYANAĞIN BİTİŞ TARİHİDİR — bugün değil. Kiracı 30.06'da
 *     tahliye edildiyse ailesi de o gün çıkmıştır; "bugün" yazılsaydı aradaki
 *     günler boyunca oturuyor görünürlerdi.
 */
import {
  takvimTarihiniOku, takvimTarihiniYaz,
  type Principal, type TakvimTarihi,
} from '@bnos/kernel';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditServisi } from '../audit/audit.service';
import type { OutboxServisi } from '../outbox/outbox.service';
import type { IstekBaglami } from '../context/request-context';

/** `tenantIslemi` geri çağrısının aldığı işlem istemcisi. */
type Islem = Parameters<Parameters<PrismaService['tenantIslemi']>[0]>[0];

/** Çıkışı verilemeyen tek bir kayıt. */
export interface CikarilamayanSakin {
  readonly sakinId: string;
  readonly kisiAdi: string;
  readonly girisTarihi: TakvimTarihi;
  readonly gerekce: string;
}

export interface OtomatikCikisSonucu {
  /** Çıkışı verilen sakin sayısı. */
  readonly cikarilan: number;
  /**
   * ÇIKARILAMAYAN kayıtlar — girişi, dayanağın bitişinden SONRA olanlar.
   *
   * ⚠️  SESSİZCE ATLANMAZ, çağırana bildirilir ve yanıtta görünür. Çıkış
   *     girişten önce yazılsaydı "eksi gün oturmuş" bir kayıt doğardı; bugüne
   *     çekilseydi kişi dayanağı bittikten sonra da oturmuş görünürdü. İkisi
   *     de veriyi bozar — kararı kullanıcı verir.
   */
  readonly cikarilamayan: readonly CikarilamayanSakin[];
}

export interface OtomatikCikisGirdisi {
  readonly bolumId: string;
  /** Dayanak — ikisinden TAM OLARAK biri verilir. */
  readonly malikId?: string;
  readonly kiraciId?: string;
  /** Dayanağın bitiş tarihi; sakinlerin çıkış tarihi de budur. */
  readonly cikisTarihi: TakvimTarihi;
  /** Denetim kaydına yazılan sebep ("malik devri" · "kiracı tahliyesi"). */
  readonly sebep: string;
}

/**
 * Dayanağa bağlı AÇIK sakin kayıtlarına çıkış verir.
 *
 * Çıkışı zaten verilmiş kayıtlara DOKUNULMAZ: işlem tekrarlansa bile eski
 * çıkış tarihleri değişmez.
 *
 * Çağıranın işlemi içinde çalışır — dayanağın kapanışı ile sakinlerin çıkışı
 * ya birlikte olur ya hiç olmaz. Ayrı işlemde yapılsaydı araya düşen bir hata
 * "kiracı gitmiş ama ailesi hâlâ oturuyor" durumunu KALICI hâle getirirdi.
 */
export async function dayanakSakinleriniCikar(
  tx: Islem,
  audit: AuditServisi,
  outbox: OutboxServisi,
  principal: Principal,
  baglam: IstekBaglami,
  girdi: OtomatikCikisGirdisi,
): Promise<OtomatikCikisSonucu> {
  const sakinler = await tx.sakin.findMany({
    where: {
      tenantId: principal.tenantId,
      bolumId: girdi.bolumId,
      cikisTarihi: null,
      ...(girdi.malikId === undefined ? {} : { malikId: girdi.malikId }),
      ...(girdi.kiraciId === undefined ? {} : { kiraciId: girdi.kiraciId }),
    },
    select: {
      id: true, kisiId: true, girisTarihi: true,
      kisi: { select: { ad: true, soyad: true } },
    },
    orderBy: { girisTarihi: 'asc' },
  });

  const cikarilamayan: CikarilamayanSakin[] = [];
  let cikarilan = 0;

  for (const sakin of sakinler) {
    const girisTarihi = takvimTarihiniOku(sakin.girisTarihi);

    // ⚠️ Giriş, dayanağın bitişinden SONRAYSA çıkış yazılamaz: "çıkış girişten
    //    önce olamaz" değişmezini bozardı. Kayıt AÇIK bırakılır, raporlanır.
    if (girisTarihi > girdi.cikisTarihi) {
      cikarilamayan.push({
        sakinId: sakin.id,
        kisiAdi: `${sakin.kisi.ad} ${sakin.kisi.soyad}`,
        girisTarihi,
        gerekce:
          `Giriş tarihi (${girisTarihi}), dayanağın bitiş tarihinden ` +
          `(${girdi.cikisTarihi}) sonra olduğu için otomatik çıkış ` +
          'verilemedi; çıkışı elle vermeniz gerekir.',
      });
      continue;
    }

    await tx.sakin.update({
      where: { id: sakin.id },
      data: { cikisTarihi: takvimTarihiniYaz(girdi.cikisTarihi) },
    });
    cikarilan += 1;

    // HER KAYIT AYRI DENETLENİR. Tek toplu satır yazılsaydı "benim sakin
    // kaydımı kim, ne zaman kapattı" sorusu kişi bazında yanıtlanamazdı.
    await audit.yaz(tx, {
      tenantId: principal.tenantId, principal, eylem: 'GUNCELLE',
      varlik: 'Sakin', varlikId: sakin.id,
      oncekiDeger: { cikisTarihi: null },
      sonrakiDeger: {
        cikisTarihi: girdi.cikisTarihi, otomatikMi: true, sebep: girdi.sebep,
      },
      gerekce: `Otomatik çıkış — ${girdi.sebep}`,
      correlationId: baglam.correlationId,
      ip: baglam.ip, kullaniciAjani: baglam.kullaniciAjani,
    });

    // Elle çıkışla AYNI olay yayınlanır; tüketiciler otomatik/elle ayrımı
    // yapmak zorunda kalmasın diye fark `payload.otomatikMi` ile taşınır.
    await outbox.yayinla(tx, {
      eventType: 'apartman.sakin.cikti', eventVersion: 1,
      tenantId: principal.tenantId, principal, correlationId: baglam.correlationId,
      aggregate: { tip: 'Sakin', id: sakin.id, version: 2 },
      payload: {
        bolumId: girdi.bolumId,
        kisiId: sakin.kisiId,
        cikisTarihi: girdi.cikisTarihi,
        otomatikMi: true,
        sebep: girdi.sebep,
      },
    });
  }

  return { cikarilan, cikarilamayan };
}
