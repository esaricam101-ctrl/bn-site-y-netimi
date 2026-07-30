import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length,
  Matches, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TAHSILAT_KANALLARI = [
  'NAKIT', 'BANKA', 'POS', 'CEK', 'SENET', 'MAHSUP',
] as const;

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';
/** Para METİN taşınır — JSON `number` float'tır (ADR-0007 · BFS v1 §11). */
const PARA = /^\d+(\.\d{1,4})?$/;
const PARA_MESAJI = 'Tutar en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.';

export class TahsisDto {
  @ApiProperty({ description: 'Kapatılacak borç.' })
  @IsUUID()
  borcId!: string;

  @ApiPropertyOptional({
    description:
      'HİSSELİ MÜLKİYETTE ZORUNLU AYRIM: borç maliklere bölünür ve bir malik ' +
      'kendi payını ödediğinde ötekilerin borcu AÇIK kalmalıdır. Tek sorumlu ' +
      'varsa boş bırakılabilir.',
  })
  @IsOptional() @IsUUID()
  borcSorumlusuId?: string;

  @ApiProperty({ example: '750.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;
}

export class TahsilatEkleDto {
  @ApiProperty({
    enum: TAHSILAT_KANALLARI,
    description:
      'Her kanal farklı bir KANIT ister: BANKA → `bankaHareketiId`, ' +
      'CEK/SENET → `kiymetliEvrakId`. NAKIT kanalına banka hareketi ' +
      'BAĞLANAMAZ (aynı para iki kez sayılır).',
  })
  @IsIn(TAHSILAT_KANALLARI)
  kanal!: (typeof TAHSILAT_KANALLARI)[number];

  @ApiProperty({ example: '1500.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;

  @ApiProperty({ example: '2026-07-30' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tahsilatTarihi!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 500)
  aciklama?: string;

  @ApiPropertyOptional({
    description:
      'Ödemeyi FİİLEN yapan kişi. Borçlu ile aynı olmak zorunda DEĞİLDİR: ' +
      'komşusu ya da akrabası adına ödeme yapılabilir.',
  })
  @IsOptional() @IsUUID()
  odeyenKisiId?: string;

  @ApiPropertyOptional({
    description:
      'BANKA kanalı için ZORUNLU. Bu bağ olmadan tahsilat banka ' +
      'mutabakatında görünmez: para hesaba girer ama hangi borcu kapattığı ' +
      'kayıtsız kalır.',
  })
  @IsOptional() @IsUUID()
  bankaHareketiId?: string;

  @ApiPropertyOptional({ description: 'CEK/SENET kanalı için ZORUNLU.' })
  @IsOptional() @IsUUID()
  kiymetliEvrakId?: string;

  @ApiProperty({
    type: [TahsisDto],
    description:
      'TAHSİS TOPLAMI TAHSİLAT TUTARINA EŞİT OLMAK ZORUNDA. Eksik olsaydı ' +
      'paranın bir kısmı hiçbir borca sayılmaz ve hiçbir yerde görünmezdi — ' +
      'kasada/bankada duran ama defterde olmayan para.\n\n' +
      'Boş bırakılırsa `otomatikTahsis` ucundan öneri alınabilir (EN ESKİ ' +
      'VADE önce); öneri YAZMAZ.',
  })
  @IsArray() @ValidateNested({ each: true }) @Type(() => TahsisDto)
  tahsisler!: TahsisDto[];
}

export class TahsilatIptalDto {
  @ApiProperty({
    example: 'Mükerrer kayıt; doğru makbuz MKB-2026-000142 — yönetim kararı 2026/9',
    description:
      'İPTAL GEREKÇESİ ZORUNLUDUR (en az 10 karakter). Bir tahsilatı iptal ' +
      'etmek parayı geri vermek değildir; hangi kararla iptal edildiği ' +
      'denetimde sorulabilir olmalıdır.',
  })
  @IsString() @MinLength(10, { message: 'İptal gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

export class TahsilatMuhasebelestirDto {
  @ApiPropertyOptional({
    description:
      'true ise fiş aynı işlemde İŞLENİR (deftere girer). Varsayılan TASLAK: ' +
      'işlenmemiş kayıt mizana girmez.',
  })
  @IsOptional() @IsBoolean()
  hemenIsle?: boolean;
}

export class OtomatikTahsisDto {
  @ApiProperty({ example: '1500.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;

  @ApiProperty({ description: 'Hangi bağımsız bölümün borçları taranacak.' })
  @IsUUID()
  bolumId!: string;

  @ApiPropertyOptional({
    description:
      'Belirli bir sorumluya (hissedara) ait paylar. Boşsa bölümün bütün ' +
      'açık borçları taranır.',
  })
  @IsOptional() @IsUUID()
  kisiId?: string;
}
