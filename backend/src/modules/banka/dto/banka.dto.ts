import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length,
  Matches, Max, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const POS_TIPLERI = ['FIZIKI', 'SANAL'] as const;
export const HAREKET_YONLERI = ['GIRIS', 'CIKIS'] as const;
export const BANKA_ISLEM_TIPLERI = [
  'HAVALE', 'EFT', 'FAST', 'VIRMAN', 'MASRAF', 'FAIZ',
  'POS_TAHSILAT', 'CEK_TAHSIL', 'SENET_TAHSIL', 'NAKIT', 'DIGER',
] as const;
export const EKSTRE_KAYNAKLARI = ['ELLE', 'DOSYA', 'ONLINE'] as const;
export const EVRAK_TIPLERI = ['CEK', 'SENET'] as const;
export const EVRAK_DURUMLARI = [
  'PORTFOYDE', 'TAHSILDE', 'TAHSIL_EDILDI', 'KARSILIKSIZ',
  'CIRO_EDILDI', 'IADE_EDILDI',
] as const;

const TAKVIM_TARIHI = /^\d{4}-\d{2}-\d{2}$/;
const TARIH_MESAJI = 'Tarih YYYY-MM-DD biçiminde olmalıdır (saat bilgisi taşıyamaz).';
/** Para METİN taşınır — JSON `number` float'tır (ADR-0007 · BFS v1 §11). */
const PARA = /^\d+(\.\d{1,4})?$/;
const PARA_MESAJI = 'Tutar en fazla 4 ondalık basamaklı pozitif sayı olmalıdır.';

const SILME_GEREKCESI = {
  example: 'Hesap kapatıldı; bakiyesi 102.02 hesabına devredildi',
  description: 'Soft delete gerekçesi zorunludur (BFS v1 §5.2).',
};

export class SilDto {
  @ApiProperty(SILME_GEREKCESI)
  @IsString() @MinLength(10, { message: 'Silme gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

/* --------------------------------- Banka --------------------------------- */

export class BankaEkleDto {
  @ApiProperty({ example: 'Ziraat Bankası' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional({
    example: '0010',
    description:
      'TCMB EFT kodu (4 hane). IBAN\'ın 5-8. haneleriyle eşleşir; mutabakatta ' +
      'hareketin hangi bankadan geldiğini bu kod söyler.',
  })
  @IsOptional() @Matches(/^\d{4}$/, { message: 'EFT kodu 4 haneli sayı olmalıdır.' })
  eftKodu?: string;

  @ApiPropertyOptional({ example: 'TCZBTR2A' })
  @IsOptional() @IsString() @Length(8, 11)
  swift?: string;
}

export class BankaDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}$/, { message: 'EFT kodu 4 haneli sayı olmalıdır.' })
  eftKodu?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(8, 11)
  swift?: string;
}

/* --------------------------------- Şube ---------------------------------- */

export class SubeEkleDto {
  @ApiProperty() @IsUUID()
  bankaId!: string;

  @ApiProperty({ example: 'Kadıköy Şubesi' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional({ example: '0345' })
  @IsOptional() @IsString() @Length(1, 10)
  subeKodu?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;
}

export class SubeDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 10)
  subeKodu?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(5, 500)
  adres?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(7, 32)
  telefon?: string;
}

/* ------------------------------ Banka hesabı ----------------------------- */

export class BankaHesabiEkleDto {
  @ApiProperty() @IsUUID()
  bankaId!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  subeId?: string;

  @ApiProperty({
    description:
      'Muhasebe karşılığı. ZORUNLUDUR ve hesabın `ozellik` alanı BANKA olmak ' +
      'zorundadır: bağ olmasaydı banka bakiyesi ile 102 Bankalar hesabının ' +
      'bakiyesi bağımsız iki sayı olur ve mutabakat yapılamazdı.',
  })
  @IsUUID()
  muhasebeHesapId!: string;

  @ApiProperty({ example: 'Ziraat — Aidat Hesabı' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional({
    example: 'TR33 0006 1005 1978 6457 8413 26',
    description:
      'IBAN mod-97 saklama toplamıyla DOĞRULANIR. Uzunluk denetimi yetmez: tek ' +
      'hane yanlış girilmiş bir IBAN biçimsel olarak kusursuz görünür ve hata ' +
      'ancak para başka hesaba gittiğinde anlaşılır.',
  })
  @IsOptional() @IsString() @Length(15, 42)
  iban?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(4, 32)
  hesapNo?: string;

  @ApiPropertyOptional({ example: 'TRY' })
  @IsOptional() @Matches(/^[A-Z]{3}$/, { message: 'Para birimi ISO 4217 üç harfli kod olmalıdır.' })
  paraBirimi?: string;

  @ApiPropertyOptional({
    example: '0',
    description:
      'Hesabın banka nezdindeki açılış bakiyesi. Muhasebe açılış fişinden ' +
      'AYRIDIR: banka gerçeği ile defterin başlangıç noktası farklı olabilir ve ' +
      'fark mutabakatta görünmelidir.',
  })
  @IsOptional() @Matches(PARA, { message: PARA_MESAJI })
  acilisBakiyesi?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  acilisTarihi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  notlar?: string;
}

export class BankaHesabiDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(15, 42)
  iban?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(4, 32)
  hesapNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  subeId?: string;

  @ApiPropertyOptional({ description: 'Pasif hesaba yeni hareket girilemez.' })
  @IsOptional() @IsBoolean()
  aktif?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  notlar?: string;
}

/* ---------------------------------- POS ---------------------------------- */

export class PosEkleDto {
  @ApiProperty() @IsUUID()
  bankaHesabiId!: string;

  @ApiPropertyOptional({
    enum: POS_TIPLERI,
    description:
      'Sanal POS\'un fizikiden tek farkı budur; alan kümesi aynıdır. Ayrı ' +
      'kayıt tipi yapılsaydı komisyon hesabı iki yerde yazılırdı.',
  })
  @IsOptional() @IsIn(POS_TIPLERI)
  tip?: (typeof POS_TIPLERI)[number];

  @ApiProperty({ example: 'Giriş Kapısı POS' })
  @IsString() @Length(2, 120)
  ad!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 32)
  terminalNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 32)
  uyeIsyeriNo?: string;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Komisyon oranı BİNDE tam sayıdır: 25 = binde 25 = %2,5. Binde tutulur ' +
      'çünkü gerçek POS sözleşmeleri %1,79 gibi kesirli oranlar içerir; yüzde ' +
      'tam sayı olsaydı temsil edilemezdi. Ondalık `number` float sapması ' +
      'yapardı (ADR-0007).',
  })
  @IsOptional() @IsInt() @Min(0) @Max(1000)
  komisyonBinde?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Valör: paranın hesaba geçtiği gün sayısı. 0 = aynı gün.',
  })
  @IsOptional() @IsInt() @Min(0) @Max(90)
  valorGunu?: number;
}

export class PosDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120)
  ad?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 32)
  terminalNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 32)
  uyeIsyeriNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1000)
  komisyonBinde?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(90)
  valorGunu?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  aktif?: boolean;
}

/* -------------------------------- Hareket -------------------------------- */

export class HareketEkleDto {
  @ApiProperty() @IsUUID()
  bankaHesabiId!: string;

  @ApiProperty({
    enum: BANKA_ISLEM_TIPLERI,
    example: 'HAVALE',
    description:
      'HAVALE · EFT · FAST · MASRAF ayrı kayıt tipi DEĞİLDİR; hepsi bir banka ' +
      'hesabına para giriş/çıkışıdır ve alan kümeleri aynıdır.\n\n' +
      'VIRMAN buraya YAZILAMAZ: iki bacağı vardır, `POST /banka/virman` ' +
      'kullanılır.',
  })
  @IsIn(BANKA_ISLEM_TIPLERI)
  islemTipi!: (typeof BANKA_ISLEM_TIPLERI)[number];

  @ApiProperty({
    enum: HAREKET_YONLERI,
    description:
      'Yön AYRI alandır ve tutar İŞARETSİZDİR. Negatif tutarla çıkış yazmak ' +
      'mümkün olsaydı "toplam giriş" sorgusu negatifleri de toplardı.',
  })
  @IsIn(HAREKET_YONLERI)
  yon!: (typeof HAREKET_YONLERI)[number];

  @ApiProperty({ example: '1500.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;

  @ApiProperty({ example: '2026-07-30' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  islemTarihi!: string;

  @ApiPropertyOptional({
    example: '2026-08-02',
    description:
      'Paranın hesaba geçtiği gün. İşlem tarihinden AYRIDIR: POS tahsilatı ' +
      'bugün olur ama para üç gün sonra geçer. Bakiye valöre, ekstre işlem ' +
      'tarihine göre okunur.',
  })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  valorTarihi?: string;

  @ApiProperty({ example: 'Temmuz aidat tahsilatı — A-3' })
  @IsString() @Length(3, 500)
  aciklama!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200)
  karsiTaraf?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(15, 42)
  karsiIban?: string;

  @ApiPropertyOptional({
    description:
      'Banka referans/dekont numarası — mutabakatın BİRİNCİL eşleştirme ' +
      'anahtarıdır. Girilirse otomatik eşleştirme çok daha güvenilir çalışır.',
  })
  @IsOptional() @IsString() @Length(1, 64)
  referansNo?: string;

  @ApiPropertyOptional({ description: 'POS tahsilatında ilgili POS tanımı.' })
  @IsOptional() @IsUUID()
  posTanimiId?: string;

  @ApiPropertyOptional({ description: 'Çek/senet tahsilinde ilgili kıymetli evrak.' })
  @IsOptional() @IsUUID()
  kiymetliEvrakId?: string;
}

/**
 * Hareket düzeltme. Yalnızca MUHASEBELEŞMEMİŞ hareket düzeltilebilir; hesap
 * ve yön değiştirilemez.
 *
 * Hesap değişse hareket iki hesabın bakiyesini birden etkilerdi (eski hesaptan
 * çıkıp yenisine girer); bu durumda kayıt düzeltmesi değil iki ayrı hareket
 * gerekir. Yön değişse tutarın anlamı tersine döner ve mutabakat geçmişi
 * anlamsızlaşır.
 */
export class HareketDuzeltDto {
  @ApiPropertyOptional() @IsOptional() @Matches(PARA, { message: PARA_MESAJI })
  tutar?: string;

  @ApiPropertyOptional() @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  islemTarihi?: string;

  @ApiPropertyOptional() @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  valorTarihi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 500)
  aciklama?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 200)
  karsiTaraf?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 64)
  referansNo?: string;
}

export class VirmanDto {
  @ApiProperty({ description: 'Paranın çıktığı hesap.' })
  @IsUUID()
  kaynakHesapId!: string;

  @ApiProperty({ description: 'Paranın girdiği hesap. Kaynakla AYNI OLAMAZ.' })
  @IsUUID()
  hedefHesapId!: string;

  @ApiProperty({ example: '5000.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;

  @ApiProperty({ example: '2026-07-30' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  islemTarihi!: string;

  @ApiProperty({ example: 'Vadesiz hesaptan aidat hesabına aktarım' })
  @IsString() @Length(3, 500)
  aciklama!: string;
}

export class MuhasebelestirDto {
  @ApiProperty({
    description:
      'KARŞI HESAP. Banka tarafı hesabın kendi muhasebe karşılığına yazılır; ' +
      'karşı taraf çağırandan gelir çünkü aynı para girişi aidat tahsilatı da ' +
      'kira geliri de olabilir ve bunu sistem bilemez.',
  })
  @IsUUID()
  karsiHesapId!: string;

  @ApiPropertyOptional({
    description:
      'true ise fiş aynı işlemde İŞLENİR (deftere girer). Varsayılan TASLAK: ' +
      'işlenmemiş kayıt mizana girmez.',
  })
  @IsOptional() @IsBoolean()
  hemenIsle?: boolean;
}

/* --------------------------- Ekstre · mutabakat -------------------------- */

export class EkstreSatirEkleDto {
  @ApiProperty({ example: '2026-07-15' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  islemTarihi!: string;

  @ApiPropertyOptional() @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  valorTarihi?: string;

  @ApiProperty({ enum: HAREKET_YONLERI })
  @IsIn(HAREKET_YONLERI)
  yon!: (typeof HAREKET_YONLERI)[number];

  @ApiProperty({ example: '1500.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;

  @ApiProperty({ example: 'GELEN HAVALE - AHMET YILMAZ' })
  @IsString() @Length(1, 500)
  aciklama!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 64)
  referansNo?: string;

  @ApiPropertyOptional({ description: 'Bankanın satır sonrası bakiyesi.' })
  @IsOptional() @Matches(PARA, { message: PARA_MESAJI })
  bakiye?: string;
}

export class EkstreEkleDto {
  @ApiProperty() @IsUUID()
  bankaHesabiId!: string;

  @ApiProperty({ example: '2026-07-01' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  baslangic!: string;

  @ApiProperty({ example: '2026-07-31' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  bitis!: string;

  @ApiProperty({
    example: '10000.00',
    description: 'BANKANIN beyan ettiği açılış bakiyesi — bizim hesabımız değil.',
  })
  @Matches(PARA, { message: PARA_MESAJI })
  acilisBakiyesi!: string;

  @ApiProperty({
    example: '12500.00',
    description:
      'BANKANIN beyan ettiği kapanış bakiyesi. Mutabakat özeti bunu sistem ' +
      'bakiyesiyle karşılaştırır; satırların hepsi eşleşse bile fark varsa ' +
      'mutabakat TAMAMLANMIŞ SAYILMAZ.',
  })
  @Matches(PARA, { message: PARA_MESAJI })
  kapanisBakiyesi!: string;

  @ApiPropertyOptional({ enum: EKSTRE_KAYNAKLARI })
  @IsOptional() @IsIn(EKSTRE_KAYNAKLARI)
  kaynak?: (typeof EKSTRE_KAYNAKLARI)[number];

  @ApiPropertyOptional({ description: 'Dosya/online kaynakta özgün dosya adı — denetim izi.' })
  @IsOptional() @IsString() @Length(1, 200)
  kaynakReferansi?: string;

  @ApiProperty({ type: [EkstreSatirEkleDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => EkstreSatirEkleDto)
  satirlar!: EkstreSatirEkleDto[];
}

export class EslestirDto {
  @ApiProperty({ description: 'Eşleştirilecek sistem hareketi.' })
  @IsUUID()
  hareketId!: string;
}

export class FarkKabulDto {
  @ApiProperty({
    example: 'Banka masrafı sistemde ayrı hareket olarak girilmemiş; 2026/8 kararı',
    description:
      'FARK KABUL GEREKÇESİ ZORUNLUDUR. Bir farkı "kabul edildi" diye ' +
      'kapatmak, gerekçesi yazılmazsa denetimde açıklanamaz.',
  })
  @IsString() @MinLength(10, { message: 'Fark gerekçesi en az 10 karakter olmalıdır.' })
  gerekce!: string;
}

/* ----------------------------- Kıymetli evrak ---------------------------- */

export class KiymetliEvrakEkleDto {
  @ApiProperty({
    enum: EVRAK_TIPLERI,
    description:
      'Çek ve senet AYNI kayıt tipidir; alan kümesi birebir aynıdır. Ayrı ' +
      'tutulsaydı durum makinesi iki yerde yazılır ve biri güncellenmeyi ' +
      'unuturdu.',
  })
  @IsIn(EVRAK_TIPLERI)
  tip!: (typeof EVRAK_TIPLERI)[number];

  @ApiProperty({ example: '0012345' })
  @IsString() @Length(1, 64)
  evrakNo!: string;

  @ApiProperty({ example: '25000.00' })
  @Matches(PARA, { message: PARA_MESAJI })
  tutar!: string;

  @ApiProperty({ example: '2026-10-15' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  vadeTarihi!: string;

  @ApiProperty({ example: '2026-07-30' })
  @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  alisTarihi!: string;

  @ApiProperty({
    example: 'Ahmet Yılmaz İnşaat Ltd. Şti.',
    description:
      'Çeki/senedi VEREN taraf. Serbest metin ZORUNLUDUR: dışarıdan gelen ' +
      'çekin borçlusunun kişi kaydı olmayabilir.',
  })
  @IsString() @Length(3, 200)
  borcluAdi!: string;

  @ApiPropertyOptional({ description: 'Borçlu sistemde kayıtlıysa kişi bağı.' })
  @IsOptional() @IsUUID()
  borcluKisiId?: string;

  @ApiPropertyOptional({ description: 'Çekte banka bilgisi vardır, senette olmayabilir.' })
  @IsOptional() @IsUUID()
  bankaId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  subeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 1000)
  notlar?: string;
}

export class EvrakDurumDto {
  @ApiProperty({
    enum: EVRAK_DURUMLARI,
    description:
      'DURUM MAKİNESİ ATLAMA KABUL ETMEZ:\n' +
      '  PORTFOYDE → TAHSILDE → TAHSIL_EDILDI | KARSILIKSIZ\n' +
      '  KARSILIKSIZ → TAHSILDE (yeniden ibraz)\n' +
      '  PORTFOYDE → CIRO_EDILDI | IADE_EDILDI\n\n' +
      'PORTFOYDE\'den doğrudan TAHSIL_EDILDI\'ye geçilemez: bankaya verilmemiş ' +
      'bir çek tahsil edilmiş olamaz ve "tahsilde bekleyenler" listesi bir daha ' +
      'doğru olmazdı.',
  })
  @IsIn(EVRAK_DURUMLARI)
  hedefDurum!: (typeof EVRAK_DURUMLARI)[number];

  @ApiPropertyOptional({
    description: 'TAHSIL_EDILDI için ZORUNLU — hangi hesaba girdiği.',
  })
  @IsOptional() @IsUUID()
  tahsilHesabiId?: string;

  @ApiPropertyOptional({ description: 'TAHSIL_EDILDI için ZORUNLU.' })
  @IsOptional() @Matches(TAKVIM_TARIHI, { message: TARIH_MESAJI })
  tahsilTarihi?: string;

  @ApiPropertyOptional({
    description:
      'KARSILIKSIZ ve IADE_EDILDI için ZORUNLU (en az 5 karakter): karşılıksız ' +
      'çıkan bir çekin neden öyle işaretlendiği sonradan sorulabilir olmalıdır.',
  })
  @IsOptional() @IsString() @Length(5, 1000)
  gerekce?: string;
}

/* ------------------------------ Parametreler ----------------------------- */

export class BankaParametreKaydetDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  varsayilanBankaHesabiId?: string;

  @ApiPropertyOptional({ description: 'Banka masraflarının yazıldığı gider hesabı.' })
  @IsOptional() @IsUUID()
  masrafGiderHesapId?: string;

  @ApiPropertyOptional({ description: 'POS komisyonunun yazıldığı gider hesabı.' })
  @IsOptional() @IsUUID()
  posKomisyonHesapId?: string;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Otomatik eşleştirmede kabul edilen tutar toleransı (KURUŞ). 0 = tam ' +
      'eşleşme zorunlu ve varsayılan budur: makine kuruş farkını sessizce ' +
      'yutarsa gerçek bir eksik tahsilat mutabık görünür.',
  })
  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  mutabakatToleransKurus?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Otomatik eşleştirmede tarih penceresi (gün) — valör gecikmesi payı.',
  })
  @IsOptional() @IsInt() @Min(0) @Max(30)
  mutabakatGunPenceresi?: number;
}
