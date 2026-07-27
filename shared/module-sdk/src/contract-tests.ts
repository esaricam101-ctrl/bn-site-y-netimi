/**
 * Sozlesme testleri — ADR v1.1 §40 · BFS v1 §14.1
 * Her modul bu kontrollerin TAMAMINDAN gecmek zorundadir.
 */

export interface SozlesmeTesti {
  readonly kod: string;
  readonly ad: string;
  readonly kaynak: string;
  readonly kritik: boolean;
}

export const SOZLESME_TESTLERI: readonly SozlesmeTesti[] = [
  { kod: 'CT-01', ad: 'Tenant izolasyonu — RLS altinda capraz okuma reddedilir', kaynak: 'ADR-0002 · BFS v1 §2', kritik: true },
  { kod: 'CT-02', ad: 'Her mutasyon Audit Log a yazar', kaynak: 'ADR v1.1 §40', kritik: true },
  { kod: 'CT-03', ad: 'Yayinlanan her event standart zarfa uyar ve katalogda kayitlidir', kaynak: 'AIS v1 §4', kritik: true },
  { kod: 'CT-04', ad: 'Her korumali endpoint uc kapidan gecer', kaynak: 'ADR-0006 · BFS v1 §3', kritik: true },
  { kod: 'CT-05', ad: 'Tum kullaniciya gorunen metin i18n anahtaridir', kaynak: 'ADR v1.1 §40', kritik: false },
  { kod: 'CT-06', ad: 'Soft delete standardina uyum — kismi unique index kuruldu', kaynak: 'BFS v1 §5', kritik: true },
  { kod: 'CT-07', ad: 'Zaman standardina uyum — DATE / timestamptz dogru tiplendi', kaynak: 'BFS v1 §4', kritik: true },
  { kod: 'CT-08', ad: 'Onbellek anahtarlari tenantId tasir; finansal bakiye onbeklenmez', kaynak: 'ADR-0005 · BFS v1 §7', kritik: true },
  { kod: 'CT-09', ad: 'core-domain -> apartman-domain bagimliligi yok', kaynak: 'ADR v1.1 §40', kritik: true },
  { kod: 'CT-10', ad: 'Command servisi tam okuma modeli dondurmez', kaynak: 'ADR v1.1 §32 · BFS v1 §6', kritik: false },
  { kod: 'CT-11', ad: 'Uygulama veritabani rolunun BYPASSRLS yetkisi yok', kaynak: 'ADR-0002', kritik: true },
  { kod: 'CT-12', ad: 'AI boru hattinda LLM ilk bilesen degildir', kaynak: 'ADR-0004 · AIS v1 §3', kritik: true },
  { kod: 'CT-13', ad: 'BOSLUKSUZ numara serisi escamanli tahsiste bosluk birakmaz', kaynak: 'ADR v1.1 §35 · BFS v1 §8', kritik: true },
  { kod: 'CT-14', ad: 'Hatali e-posta ile hatali sifre ayirt edilmez', kaynak: 'BFS v1 §3', kritik: true },
];

export const KRITIK_TESTLER: readonly SozlesmeTesti[] =
  SOZLESME_TESTLERI.filter((t) => t.kritik);
