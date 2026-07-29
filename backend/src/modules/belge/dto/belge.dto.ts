import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString,
  IsUUID, Length, Min, MinLength, ValidateNested,
} from 'class-validator';

export const BELGE_TIPLERI = [
  'YONETIM_PLANI', 'GENEL_KURUL_KARARI', 'TAPU', 'KIRA_SOZLESMESI',
  'FATURA', 'MAKBUZ', 'SIGORTA_POLICESI', 'RUHSAT', 'TEKNIK_RAPOR',
  'YAZISMA', 'DIGER',
] as const;

/**
 * MALIK · KIRACI · SAKIN, KISI'den AYRIDIR: bir kira sözleşmesi kişiye değil,
 * o kişinin O BÖLÜMDEKİ kiracılık dönemine aittir.
 */
export const BELGE_KAPSAMLARI = [
  'TENANT', 'APARTMAN', 'BLOK', 'KAT', 'BOLUM', 'KISI', 'MALIK', 'KIRACI', 'SAKIN',
] as const;

export const BELGE_KATEGORILERI = ['HUKUKI', 'MALI', 'TEKNIK', 'KURUMSAL', 'KISISEL'] as const;

export const BELGE_GIZLILIKLERI = ['GENEL', 'YONETIM', 'KISIYE_OZEL'] as const;

/** Belgeyi ek bir kayda bağlar. Birincil kapsam DIŞINDAKİ bağlantılar. */
export class BelgeIliskisiDto {
  @ApiProperty({ enum: BELGE_KAPSAMLARI })
  @IsIn(BELGE_KAPSAMLARI)
  varlikTipi!: (typeof BELGE_KAPSAMLARI)[number];

  @ApiPropertyOptional({ description: 'TENANT tipinde boş bırakılır.' })
  @IsOptional() @IsUUID()
  varlikId?: string;
}

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

  /**
   * Türün varsayılanından YÜKSELTİLEBİLİR, düşürülemez. Kimlik fotokopisinin
   * varsayılanı KISIYE_OZEL'dir; tek bir yanlış tıkla herkese açılamamalıdır.
   */
  @ApiPropertyOptional({ enum: BELGE_GIZLILIKLERI })
  @IsOptional() @IsIn(BELGE_GIZLILIKLERI)
  gizlilik?: (typeof BELGE_GIZLILIKLERI)[number];

  @ApiPropertyOptional({ example: 'Avukat onayından geçti', description: 'Aramaya dahildir.' })
  @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['2026-genel-kurul', 'acil'],
    description: 'Serbest etiketler. Türkçe duyarlı küçük harfe normalize edilir.',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true })
  etiketler?: string[];

  @ApiPropertyOptional({
    type: [BelgeIliskisiDto],
    description:
      'Birincil kapsam DIŞINDAKİ bağlantılar. Kira sözleşmesinin sahibi ' +
      'BÖLÜM\'dür ama KİRACI ve MALİK ile de ilişkilidir.',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => BelgeIliskisiDto)
  iliskiler?: BelgeIliskisiDto[];
}

/** Üstveri düzeltme — DOSYA DEĞİŞTİRİLEMEZ (o bir yeni sürümdür). */
export class BelgeDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 2000)
  notlar?: string;

  @ApiPropertyOptional({ enum: BELGE_GIZLILIKLERI })
  @IsOptional() @IsIn(BELGE_GIZLILIKLERI)
  gizlilik?: (typeof BELGE_GIZLILIKLERI)[number];

  @ApiPropertyOptional({ example: '2027-01-15' })
  @IsOptional() @IsDateString()
  gecerlilikBitisi?: string;
}

export class EtiketDto {
  @ApiProperty({ example: 'acil' })
  @IsString() @Length(2, 40)
  etiket!: string;
}

/**
 * KVKK kalıcı silme — dosya nesne deposundan GERİ ALINAMAZ biçimde kaldırılır.
 *
 * Üstveri satırı KALIR: "bu belge şu tarihte imha edildi" sorusunun cevabı
 * kaydın kendisi silinirse kaybolur ve imha kanıtlanamaz.
 */
export class KaliciSilDto {
  @ApiProperty({
    example: 'KVKK md. 7 silme talebi — 2036/12 sayılı yönetim kararı',
    description: 'Kalıcı silme gerekçesi. Denetim kaydına yazılır.',
  })
  @IsString() @MinLength(20, {
    message: 'Kalıcı silme gerekçesi en az 20 karakter olmalıdır — geri alınamaz bir işlemdir.',
  })
  gerekce!: string;

  @ApiProperty({
    example: 'IMHA-ONAY',
    description: 'Yanlışlıkla tetiklemeyi önleyen onay dizesi. Tam olarak "IMHA-ONAY" olmalıdır.',
  })
  @IsIn(['IMHA-ONAY'], { message: 'Onay dizesi "IMHA-ONAY" olmalıdır.' })
  onay!: string;
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
