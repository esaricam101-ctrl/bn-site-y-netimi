import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsNumberString, IsOptional,
  IsString, IsUUID, Length, Matches, ValidateNested,
} from 'class-validator';

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
}
