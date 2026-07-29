import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min, MinLength,
} from 'class-validator';

export const BELGE_TIPLERI = [
  'YONETIM_PLANI', 'GENEL_KURUL_KARARI', 'TAPU', 'KIRA_SOZLESMESI',
  'FATURA', 'MAKBUZ', 'SIGORTA_POLICESI', 'RUHSAT', 'TEKNIK_RAPOR',
  'YAZISMA', 'DIGER',
] as const;

export const BELGE_KAPSAMLARI = ['TENANT', 'APARTMAN', 'BLOK', 'BOLUM', 'KISI'] as const;

export class YuklemeIzniDto {
  @ApiProperty({ example: 'yonetim-plani-2026.pdf' })
  @IsString() @Length(1, 200)
  dosyaAdi!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString() @Length(3, 120)
  icerikTipi!: string;
}

export class BelgeKaydetDto {
  @ApiProperty({ enum: BELGE_TIPLERI })
  @IsIn(BELGE_TIPLERI)
  tip!: (typeof BELGE_TIPLERI)[number];

  @ApiProperty({ enum: BELGE_KAPSAMLARI })
  @IsIn(BELGE_KAPSAMLARI)
  kapsam!: (typeof BELGE_KAPSAMLARI)[number];

  @ApiPropertyOptional({
    description: 'Kapsamın işaret ettiği kaydın kimliği. TENANT kapsamında boş bırakılır.',
  })
  @IsOptional() @IsUUID()
  hedefId?: string;

  @ApiProperty({ example: 'Yönetim Planı 2026' })
  @IsString() @Length(2, 200)
  ad!: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString({}, { message: 'Belge tarihi YYYY-MM-DD biçiminde olmalıdır.' })
  belgeTarihi!: string;

  @ApiPropertyOptional({
    example: '2027-01-15',
    description: 'Geçerlilik bitişi — poliçe, ruhsat gibi belgelerde anlamlıdır.',
  })
  @IsOptional() @IsDateString()
  gecerlilikBitisi?: string;

  /**
   * `yukleme-izni` ucundan dönen anahtar. Kayıt açılmadan önce nesnenin
   * gerçekten yüklendiği doğrulanır — dosyası olmayan belge kaydı, "belge
   * var" diyen ama indirilemeyen bir satır bırakır.
   */
  @ApiProperty({ description: 'Yükleme izninden dönen nesne anahtarı.' })
  @IsString() @Length(5, 300)
  dosyaAnahtari!: string;
}

export class YeniSurumDto extends BelgeKaydetDto {}

export class BelgeSilDto {
  @ApiProperty({
    example: 'Saklama süresi doldu, arşiv temizliği kararı 2036/4',
    description: 'Silme gerekçesi zorunludur (BFS v1 §5.2).',
  })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

export class PolitikaGuncelleDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Yıl cinsinden asgari saklama. Boş bırakılırsa SÜRESİZ saklanır.',
  })
  @IsOptional() @IsInt() @Min(0)
  saklamaYili?: number;

  @ApiPropertyOptional({
    example: '2026/7 sayılı genel kurul kararı',
    description: 'Varsayılandan sapan her politika kaynak referansı taşımalıdır.',
  })
  @IsOptional() @IsString() @Length(3, 200)
  kaynakReferansi?: string;
}
