import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches,
  MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CINSIYETLER, PlakaGirdisiDto } from '../../../common/kayit/kisi-girdisi.dto';

export class MisafirEkleDto {
  @ApiProperty({ description: 'Ziyaret edilen bağımsız bölüm.' })
  @IsUUID()
  bolumId!: string;

  @ApiProperty({ example: 'Kemal' })
  @IsString() @Length(2, 60)
  ad!: string;

  @ApiProperty({ example: 'Aksoy' })
  @IsString() @Length(2, 60)
  soyad!: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @Matches(/^[0-9]{11}$/u, { message: 'TC kimlik no 11 haneli ve yalnızca rakam olmalıdır.' })
  tcKimlikNo?: string;

  @ApiPropertyOptional({ example: '05321234567' })
  @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional({ example: 'kemal@ornek.test' })
  @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  @ApiPropertyOptional({ example: '1978-11-30' })
  @IsOptional() @IsDateString({}, { message: 'Doğum tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  dogumTarihi?: string;

  @ApiPropertyOptional({ enum: CINSIYETLER })
  @IsOptional() @IsIn(CINSIYETLER)
  cinsiyet?: (typeof CINSIYETLER)[number];

  @ApiPropertyOptional({ example: 'Ankara Çankaya' })
  @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional({ example: 'Otopark yeri gerekmiyor' })
  @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;

  @ApiPropertyOptional({
    type: [PlakaGirdisiDto],
    description:
      'Misafir aracı. Otopark sayımında yer kapladığı için aynı araç ' +
      'kütüğüne yazılır; çıkışta kapatılır.',
  })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlakaGirdisiDto)
  plakalar?: PlakaGirdisiDto[];

  @ApiProperty({ example: '2026-08-05' })
  @IsDateString({}, { message: 'Giriş tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  girisTarihi!: string;

  @ApiPropertyOptional({
    example: '2026-08-09',
    description:
      'Boş bırakılırsa misafir HÂLEN İÇERİDE sayılır ve güvenlik listesinde ' +
      'görünür. Çıkış sonradan `/cikis` ile işlenir.',
  })
  @IsOptional() @IsDateString()
  cikisTarihi?: string;

  @ApiPropertyOptional({ example: 'Aile ziyareti' })
  @IsOptional() @IsString() @Length(2, 200)
  ziyaretNedeni?: string;
}

export class MisafirDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 60)
  soyad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 180)
  eposta?: string;

  @ApiPropertyOptional({ enum: CINSIYETLER })
  @IsOptional() @IsIn(CINSIYETLER)
  cinsiyet?: (typeof CINSIYETLER)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200)
  ziyaretNedeni?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;
}

export class MisafirCikisDto {
  @ApiProperty({ example: '2026-08-09' })
  @IsDateString({}, { message: 'Çıkış tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  cikisTarihi!: string;
}

export class MisafirSilDto {
  @ApiProperty({
    example: 'KVKK md. 7 silme talebi — 2026/18 sayılı yönetim kararı',
    description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}
