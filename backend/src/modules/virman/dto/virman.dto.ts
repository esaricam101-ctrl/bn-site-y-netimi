import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length,
  Matches, ValidateNested,
} from 'class-validator';

export const VIRMAN_TURLERI = ['KASA_BANKA', 'HESAP', 'CARI'] as const;
export const SORUMLULUK_SIRALARI = ['ASIL', 'IKINCIL'] as const;

/** Para METİN taşınır — JSON `number` float'tır (ADR-0007 · BFS v1 §11). */
const PARA = /^\d+(\.\d{1,4})?$/u;
const PARA_MESAJI = 'Tutar en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.';
const TAKVIM = /^\d{4}-\d{2}-\d{2}$/u;

export class VirmanSatirDto {
  @ApiProperty()
  @IsUUID()
  hesapId!: string;

  @ApiPropertyOptional({
    description:
      'Cari virmanda ZORUNLU sayılır: aynı hesabın iki bölüm arasında ' +
      'taşınması meşrudur ve kaynak (hesap, bölüm) ÇİFTİDİR.',
  })
  @IsOptional() @IsUUID()
  bolumId?: string;

  @ApiProperty({ example: '250.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  borc!: string;

  @ApiProperty({ example: '0.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  alacak!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Length(1, 500)
  aciklama?: string;
}

export class VirmanPayDto {
  @ApiProperty({ description: 'Payı değişecek borç.' })
  @IsUUID()
  borcId!: string;

  @ApiProperty({ description: 'Bu paydan sorumlu kişi.' })
  @IsUUID()
  kisiId!: string;

  @ApiProperty({
    enum: SORUMLULUK_SIRALARI,
    description:
      'ASIL = bu kişiden istenir. IKINCIL = asıldan alınamazsa istenir.\n\n' +
      'Taşınmada İKİSİ DE ASIL\'dır: her kiracı kendi oturduğu dönemden ' +
      'DOĞRUDAN sorumludur, biri ötekinin kefili değildir. IKINCIL yazılsaydı ' +
      'tahsilat ve icra yanlış sıra izlerdi.',
  })
  @IsIn(SORUMLULUK_SIRALARI)
  sira!: (typeof SORUMLULUK_SIRALARI)[number];

  @ApiProperty({ example: '250.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  pay!: string;
}

/**
 * ⚠️  İKİ AYRI DİZİ, tek dizi DEĞİL.
 *
 *     `satirlar` deftere yazılanı, `paylar` yardımcı deftere yazılanı anlatır.
 *     Tek dizide toplansaydı her satırın hangi tarafa ait olduğu tip
 *     düzeyinde belirsizleşir ve doğrulama koşullu dallara bölünürdü.
 *
 * ⚠️  `satirlar` BOŞ BIRAKILABİLİR ve bu bilinçlidir: TAŞINMA VİRMANI FİŞ
 *     ÜRETMEZ. Kiracı taşındığında borcun toplamı da hangi hesapta durduğu da
 *     değişmez; yalnızca paylar bölünür. Deftere yazılacak DENK bir kayıt
 *     yoktur (ADR-0016 · "virmanın iki davranışı").
 */
export class VirmanEkleDto {
  @ApiProperty({ enum: VIRMAN_TURLERI })
  @IsIn(VIRMAN_TURLERI)
  tur!: (typeof VIRMAN_TURLERI)[number];

  @ApiProperty({
    example: 'YANLIS_DAIRE_DUZELTMESI',
    description:
      'Sebep kodu VERİDİR ve tür başına ayrı listeden gelir: bir türün meşru ' +
      'sebebi ötekinde anlamsızdır. Tek liste olsaydı hiçbir şey engellenmezdi.',
  })
  @IsString() @Length(3, 60)
  sebepKodu!: string;

  @ApiProperty({ example: '2026-08-20' })
  @Matches(TAKVIM, { message: 'Tarih YYYY-MM-DD biçiminde olmalıdır.' })
  tarih!: string;

  @ApiProperty({
    example: 'Kiracı 15 Ağustos\'ta taşındı; aidat payı bölündü.',
    description:
      'ZORUNLU. Boş bırakılabilen zorunlu alan zorunlu değildir: sebep kodu ' +
      'sınıflandırmadır, açıklama OLGUDUR.',
  })
  @IsString() @Length(1, 1000)
  aciklama!: string;

  @ApiPropertyOptional({ type: [VirmanSatirDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => VirmanSatirDto)
  satirlar?: VirmanSatirDto[];

  @ApiPropertyOptional({ type: [VirmanPayDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => VirmanPayDto)
  paylar?: VirmanPayDto[];
}
