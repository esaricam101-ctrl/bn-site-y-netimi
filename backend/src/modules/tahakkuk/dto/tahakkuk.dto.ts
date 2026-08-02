import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsNumberString, IsOptional,
  IsString, IsUUID, Length, Matches, ValidateNested,
} from 'class-validator';

/**
 * EZİLEBİLİR DAĞITIM KURALLARI (ADR-0017 · K7b).
 *
 * Ölçüt tek: kural EK VERİ gerektiriyor mu? Aşağıdakilerin ortak yanı,
 * ağırlığın **bölüm kaydından** okunmasıdır — `arsaPayiPay/Payda`, `brutM2`,
 * `netM2` şemada `NOT NULL`'dır ve istek gövdesinden gelmez.
 *
 * ⛔ DIŞARIDA KALANLAR ve nedeni (`shared/apartman-domain/src/gider/paylastir.ts`):
 *   · TUKETIM         → `girdi.tuketim`        (bölüm başına ölçüm)
 *   · KULLANIM_BAZLI  → `girdi.kullaniyorMu`   (bölüm başına kullanım)
 *   · SABIT_TUTAR     → `girdi.sabitAgirlik`   (bölüm başına ağırlık)
 *   · MANUEL          → `girdi.manuelTutar`    (bölüm başına tutar)
 *   · BLOK_BAZLI      → `hedefBlokId`          (aşağıda ayrıca ele alınır)
 *   · KARMA           → `karmaBilesenler`      (gider türüne ait, istekte verilemez)
 *
 * ⚠️  BLOK_BAZLI listede VARDIR: gerektirdiği veri bölüm başına değil, TEK bir
 *     alandır (`hedefBlokId`) ve o alan bu DTO'da zaten mevcuttur. Eksikse
 *     `paylastir.ts` açık hata verir.
 */
export const EZILEBILIR_KURALLAR = [
  'ESIT', 'ARSA_PAYI', 'BRUT_M2', 'NET_M2', 'METREKARE', 'BLOK_BAZLI',
] as const;

/** Şemadaki `PaylasimKurali` enum'unun tamamı — DTO düzeyinde kabul edilir. */
export const TUM_KURALLAR = [
  ...EZILEBILIR_KURALLAR,
  'TUKETIM', 'SABIT_TUTAR', 'KULLANIM_BAZLI', 'MANUEL', 'KARMA',
] as const;

/**
 * Bölüme özel tahakkuk girdisi.
 *
 * Bu değerler GİDER TÜRÜNDE değil, TAHAKKUK ANINDA verilir: aynı asansör
 * onarımı ertesi ay başka blokta olabilir, aynı su gideri her ay farklı
 * tüketim taşır. Kuralın kendisi kalıcıdır, ölçüm değildir.
 */
export class BolumGirdisiDto {
  @ApiProperty()
  @IsUUID()
  bolumId!: string;

  @ApiPropertyOptional({
    example: '1250',
    description: 'TUKETIM kuralı için ölçüm (m³, kWh, kalori). Ölçek yok — tam sayı.',
  })
  @IsOptional()
  @IsNumberString({ no_symbols: true }, { message: 'Tüketim yalnızca rakam içermelidir.' })
  tuketim?: string;

  @ApiPropertyOptional({ example: '3', description: 'SABIT_TUTAR kuralı için ağırlık.' })
  @IsOptional()
  @IsNumberString({ no_symbols: true })
  sabitAgirlik?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'KULLANIM_BAZLI kuralı için: bölüm bu hizmeti kullanıyor mu?',
  })
  @IsOptional() @IsBoolean()
  kullaniyorMu?: boolean;

  /**
   * Para METİN taşınır (ADR-0007 · BFS v1 §11). JSON `number` çift duyarlıklı
   * float'tır; kuruş toplamı sessizce kayar.
   */
  @ApiPropertyOptional({ example: '1500.00', description: 'MANUEL kuralı için bölüme yazılan tutar.' })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,4})?$/u, { message: 'Tutar 1500.00 biçiminde olmalıdır.' })
  manuelTutar?: string;
}

export class TahakkukMuhasebelestirDto {
  @ApiPropertyOptional({
    description:
      'true ise fiş aynı işlemde İŞLENİR (deftere girer). Varsayılan TASLAK: ' +
      'işlenmemiş kayıt mizana girmez.',
  })
  @IsOptional() @IsBoolean()
  hemenIsle?: boolean;
}

export class TahakkukCalistirDto {
  @ApiProperty({ example: 'ISITMA', description: 'Gider türü KODU — tanımlı ve aktif olmalıdır.' })
  @IsString() @Length(2, 40)
  giderTuruKodu!: string;

  @ApiProperty({
    example: '18500.00',
    description: 'Dağıtılacak TOPLAM gider. Metin taşınır; float yuvarlaması yapılmaz.',
  })
  @Matches(/^\d+(\.\d{1,4})?$/u, { message: 'Tutar 18500.00 biçiminde olmalıdır.' })
  toplamTutar!: string;

  @ApiProperty({ example: '2026-07-01', description: 'Tahakkuk dönemi (ayın ilk günü).' })
  @IsDateString({}, { message: 'Dönem YYYY-MM-DD biçiminde olmalıdır.' })
  donem!: string;

  @ApiProperty({ example: '2026-07-31', description: 'Vade tarihi.' })
  @IsDateString({}, { message: 'Vade YYYY-MM-DD biçiminde olmalıdır.' })
  vadeTarihi!: string;

  @ApiPropertyOptional({
    description: 'BLOK_BAZLI kuralı için hedef blok. Gider yalnızca bu bloğun bölümlerine yazılır.',
  })
  @IsOptional() @IsUUID()
  hedefBlokId?: string;

  @ApiPropertyOptional({
    enum: TUM_KURALLAR,
    description:
      'DAĞITIM EZMESİ (ADR-0017 · K7). Verilmezse gider türünün kuralı ' +
      'kullanılır; kullanılan kural her hâlükârda çalışma kaydına yazılır.\n\n' +
      'EZME YALNIZCA EK VERİ GEREKTİRMEYEN KURALLARA AÇIKTIR. Veri gerektiren ' +
      'bir kurala ezme, veri sağlanmadan REDDEDİLİR ve hata EKSİK BÖLÜMLERİ ' +
      'SAYARAK döner — yönetici eksikleri tek tek denemeyle öğrenmemelidir.\n\n' +
      'KARMA hiç ezilemez: bileşen tanımı gider türüne aittir, istekte verilemez.',
  })
  @IsOptional()
  /*
   * ⚠️  BEYAZ LİSTE BURADA DEĞİL, SERVİSTE. Burada `IsIn(EZILEBILIR_KURALLAR)`
   *     yazılsaydı red 400 olurdu ve gövde yalnızca "geçersiz değer" derdi;
   *     hangi bölümlerde veri eksik olduğu SÖYLENEMEZDİ. Ezmenin kabul edilip
   *     edilmeyeceği bir doğrulama değil bir İŞ KURALIDIR (422).
   */
  @IsIn(TUM_KURALLAR, { message: 'Geçersiz paylaşım kuralı.' })
  paylasimKurali?: (typeof TUM_KURALLAR)[number];

  @ApiPropertyOptional({
    type: [BolumGirdisiDto],
    description: 'Kural bazlı bölüm girdileri (tüketim · kullanım · manuel tutar).',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(2000)
  @ValidateNested({ each: true }) @Type(() => BolumGirdisiDto)
  bolumGirdileri?: BolumGirdisiDto[];

  /**
   * Verilirse TUKETIM ağırlıkları sayaç okumalarından OTOMATİK doldurulur.
   *
   * Elle girilen `bolumGirdileri[].tuketim` değerlerinin yerini alır. Sayaç
   * değişimi olan bölümlerde iki sayacın tüketimi toplanır.
   *
   * Okuması olmayan bölüm varsa tahakkuk REDDEDİLİR — sessizce sıfır tüketim
   * yazmak o daireyi ısıtma giderinden tümüyle muaf tutar ve farkı diğer
   * dairelere yükler.
   */
  @ApiPropertyOptional({
    example: 'SU',
    description: 'TUKETIM kuralında ağırlıkları bu türdeki sayaçlardan oku.',
  })
  @IsOptional() @IsString() @Length(2, 20)
  sayacTuru?: string;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Sayaç okuma aralığı başlangıcı. Verilmezse `donem` kullanılır.',
  })
  @IsOptional() @IsDateString()
  okumaBaslangic?: string;

  @ApiPropertyOptional({
    example: '2026-07-31',
    description: 'Sayaç okuma aralığı bitişi. Verilmezse `vadeTarihi` kullanılır.',
  })
  @IsOptional() @IsDateString()
  okumaBitis?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'true ise borç YAZILMAZ, yalnızca dağıtım önizlemesi döner. ' +
      'Yönetici tahakkuku uygulamadan önce sonucu görebilir.',
  })
  @IsOptional() @IsBoolean()
  onizleme?: boolean;

  /**
   * EK / DÜZELTME TAHAKKUKU — açık niyet beyanı.
   *
   * Bir dönemde bir gider türü için ASIL tahakkuk yalnızca bir kez koşar
   * (veritabanı kısıtı `tahakkuk_calismasi_asil_uq`). Sonradan gelen bir fatura
   * için ikinci bir çalışma gerekiyorsa yönetici bunu AÇIKÇA istemek
   * zorundadır. Bayrak olmadan ikinci çalıştırma 409 döner — kesilen bir
   * isteğin ardından yapılan tekrar denemesi ile bilinçli bir ek tahakkuk
   * ancak böyle ayırt edilebilir.
   */
  @ApiPropertyOptional({
    example: false,
    description:
      'true ise dönemde ikinci bir tahakkuk ÇALIŞMASI açılır (ek/düzeltme). ' +
      'Kazayla mükerrer tahakkuku engellemek için varsayılan false.',
  })
  @IsOptional() @IsBoolean()
  ekTahakkuk?: boolean;

  /**
   * GİDER OLAYI REFERANSI — olay bazlı giderlerde ZORUNLU.
   *
   * Demirbaş alımı gibi giderler bir dönem değil bir OLAY karşılığıdır: aynı
   * ay içinde iki ayrı alım yapılabilir ve ikisi de meşrudur. Bunları ayıran
   * şey dönem olamaz; fatura ya da genel kurul karar numarasıdır.
   *
   * Aynı referans aynı dönemde ikinci kez tahakkuk edilemez (409) — mükerrer
   * koruması bu sınıfta bu eksende kurulur.
   *
   * Dönemsel giderler (aidat, yıl sonu kapanışı) bu alanı ALMAZ.
   */
  @ApiPropertyOptional({
    example: 'FTR-2026-0001',
    description:
      'Gider olayının iş anahtarı (fatura/karar no). Olay bazlı gider ' +
      'türlerinde zorunlu, dönemsel türlerde kabul edilmez.',
  })
  @IsOptional() @IsString() @Length(1, 120)
  referans?: string;
}
