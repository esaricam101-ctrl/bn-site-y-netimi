import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID,
  Length, Matches, Max, Min, MinLength,
} from 'class-validator';

export const KANALLAR = ['WHATSAPP', 'SMS', 'EPOSTA'] as const;
export const ILETI_TURLERI = ['BILGILENDIRME', 'TICARI'] as const;
export const HEDEF_TIPLERI = [
  'TUM_SITE', 'BLOK', 'KAT', 'DAIRE',
  'MALIK', 'KIRACI', 'SAKIN', 'DAIRE_GOREVLISI', 'YONETIM_KURULU',
  'KISILER', 'GRUP',
] as const;

const ISO_ANI = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;

export class SablonEkleDto {
  @ApiProperty({ example: 'AIDAT_HATIRLATMA' })
  @IsString() @Length(2, 60)
  kod!: string;

  @ApiProperty({ example: 'Aidat hatırlatma mesajı' })
  @IsString() @Length(2, 160)
  ad!: string;

  @ApiPropertyOptional({
    enum: KANALLAR,
    description:
      'Boş bırakılırsa şablon HER kanalda kullanılabilir. SMS\'e özel kısa ' +
      'metin ile WhatsApp\'a özel uzun metin AYRI şablonlardır.',
  })
  @IsOptional() @IsIn(KANALLAR)
  kanal?: (typeof KANALLAR)[number];

  @ApiPropertyOptional({
    enum: ILETI_TURLERI,
    description:
      'BİLGİLENDİRME hizmet ilişkisinden doğar ve İYS iznine tabi DEĞİLDİR; ' +
      'TİCARİ ileti önceden izin ister (6563 s. K. md. 6).',
  })
  @IsOptional() @IsIn(ILETI_TURLERI)
  iletiTuru?: (typeof ILETI_TURLERI)[number];

  @ApiProperty({
    example: 'Sayın {{ad}}, {{donem}} dönemi {{tutar}} TL aidat borcunuz bulunmaktadır.',
    description:
      'Değişkenler `{{ad}}` biçimindedir. ÇÖZÜLMEYEN DEĞİŞKEN GÖNDERİMİ ' +
      'ENGELLER: ham `{{ad}}` metninin gitmesi yönetime olan güveni tek ' +
      'seferde bitirir.',
  })
  @IsString() @Length(2, 4000)
  govde!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  aciklama?: string;
}

export class SablonDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 160)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 4000)
  govde?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  aciklama?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  aktif?: boolean;
}

export class SilDto {
  @ApiProperty({ example: 'Şablon kullanımdan kaldırıldı; yerine AIDAT_V2 açıldı' })
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

export class GonderimOlusturDto {
  @ApiProperty({ enum: KANALLAR })
  @IsIn(KANALLAR)
  kanal!: (typeof KANALLAR)[number];

  @ApiPropertyOptional({ enum: ILETI_TURLERI })
  @IsOptional() @IsIn(ILETI_TURLERI)
  iletiTuru?: (typeof ILETI_TURLERI)[number];

  @ApiProperty({
    enum: HEDEF_TIPLERI,
    description:
      'Tüm Site · Blok · Kat · Daire · Malik · Kiracı · Sakin · Daire ' +
      'Görevlisi · Yönetim Kurulu · Belirli Kişiler.\n\n' +
      '⚠️  GRUP hedefi DESTEKLENMİYOR: sistemde kişi grubu kavramı yok. Boş ' +
      'liste dönmek sessiz başarısızlık olurdu.',
  })
  @IsIn(HEDEF_TIPLERI)
  hedefTipi!: (typeof HEDEF_TIPLERI)[number];

  @ApiPropertyOptional({
    description:
      'Hedef kimliği. BLOK/KAT/DAIRE için `{ "id": "<uuid>" }`, KISILER için ' +
      '`{ "kisiIdler": ["<uuid>", ...] }`.',
    example: { id: '00000000-0000-4000-8000-000000000000' },
  })
  @IsOptional() @IsObject()
  hedefReferansi?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Şablon kullanılacaksa kimliği.' })
  @IsOptional() @IsUUID()
  sablonId?: string;

  @ApiPropertyOptional({
    description: 'Şablon verilmediyse ZORUNLU — doğrudan gönderilecek metin.',
  })
  @IsOptional() @IsString() @Length(2, 4000)
  govde?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200)
  baslik?: string;

  @ApiPropertyOptional({
    description:
      'Şablon değişkenlerinin SABİT değerleri. Alıcıya göre değişenler ' +
      '(`ad`, `daire`) sistem tarafından doldurulur.',
  })
  @IsOptional() @IsObject()
  degiskenler?: Record<string, string>;

  @ApiPropertyOptional({
    example: '2026-08-01T09:00:00.000Z',
    description:
      'Verilirse gönderim ZAMANLANIR. ⚠️ Zamanlanmış gönderimi çalıştıracak ' +
      'planlayıcı HENÜZ YOK: kayıt oluşur ama kendiliğinden gönderilmez.',
  })
  @IsOptional() @Matches(ISO_ANI, { message: 'Zaman ISO-8601 biçiminde olmalıdır.' })
  zamanlanmaAni?: string;

  @ApiPropertyOptional({ description: 'İlişkili kayıt tipi (Tahsilat · Borc · Talep…).' })
  @IsOptional() @IsString() @Length(2, 60)
  ilgiliVarlik?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  ilgiliVarlikId?: string;
}

export class GonderimIptalDto {
  @ApiProperty({ example: 'Yanlış hedef seçildi; doğru duyuru yeniden hazırlanacak' })
  @IsString() @MinLength(10, { message: 'İptal gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

export class IzinKaydetDto {
  @ApiProperty() @IsUUID()
  kisiId!: string;

  @ApiProperty({ enum: KANALLAR })
  @IsIn(KANALLAR)
  kanal!: (typeof KANALLAR)[number];

  @ApiProperty({ enum: ILETI_TURLERI })
  @IsIn(ILETI_TURLERI)
  iletiTuru!: (typeof ILETI_TURLERI)[number];

  @ApiProperty({
    enum: ['IZIN', 'RET'],
    description:
      '⚠️ RET, İZİN YOKLUĞUNDAN FARKLIDIR: RET ilgili kanalda BİLGİLENDİRME ' +
      'dahil her şeyi kapatır (kişi açıkça istememiştir).',
  })
  @IsIn(['IZIN', 'RET'])
  durum!: 'IZIN' | 'RET';

  @ApiProperty({
    example: 'Yönetim planı eki · imzalı onay formu 2026/14',
    description:
      'İZİN KANITI. Kanıtı olmayan izin, denetimde izin sayılmaz.',
  })
  @IsString() @Length(3, 120)
  kaynak!: string;

  @ApiProperty({ example: '2026-07-30' })
  @Matches(TAKVIM_TARIHI, { message: 'Tarih YYYY-MM-DD biçiminde olmalıdır.' })
  beyanTarihi!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  gerekce?: string;
}

export class KuralKaydetDto {
  @ApiProperty({ example: 'tahakkuk.olusturuldu' })
  @IsString() @Length(3, 80)
  olayKodu!: string;

  @ApiProperty({ enum: KANALLAR })
  @IsIn(KANALLAR)
  kanal!: (typeof KANALLAR)[number];

  @ApiProperty() @IsUUID()
  sablonId!: string;

  @ApiPropertyOptional({
    description:
      '⚠️ `aktif = true` olsa bile ŞU AN HİÇBİR ŞEY OTOMATİK GÖNDERİLMEZ: ' +
      'olay tüketicisi henüz yazılmadı.',
  })
  @IsOptional() @IsBoolean()
  aktif?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  aciklama?: string;
}

export class MesajFiltresiDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  baslangic?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  bitis?: string;

  @ApiPropertyOptional({ enum: KANALLAR })
  @IsOptional() @IsIn(KANALLAR)
  kanal?: (typeof KANALLAR)[number];

  @ApiPropertyOptional() @IsOptional() @IsString()
  durum?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  kisiId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120)
  arama?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray()
  siralama?: string[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(500)
  limit?: number;
}
