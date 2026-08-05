import type { Prisma } from '@prisma/client';

/**
 * BORÇ KAPATMA SIRASI — TEK KAYNAK.
 *
 * ⚠️  NEDEN AYRI DOSYA: bugün tek çağıran var (`tahsisOnerisi`). Ama otomatik
 *     tahsis üreten ikinci bir kanal geldiğinde (banka hareketi eşleştirme ·
 *     toplu tahsilat · DBS) o kanal kendi sıralamasını yazarsa iki yol
 *     ZAMANLA AYRIŞIR: aynı borç kümesi için öneri bir sıra, otomatik
 *     eşleştirme başka bir sıra üretir ve fark ancak mutabakat tutmadığında
 *     görülür. Tek karşılaştırıcı, iki çağıran.
 *
 * ★ SIRA DETERMİNİSTİK OLMAK ZORUNDA. Eskiden tek anahtar vardı
 *   (`vadeTarihi asc`); aynı vadeli borçlarda sıra veritabanına kalıyordu ve
 *   aynı istek iki çağrıda farklı sıra dönebiliyordu — yani öneri
 *   SINANAMAZDI. Ölçüldü: tohumda üç kalem de aynı gün vadeli. (CT-26 · 1)
 *
 * ⚠️  BU BİR İSTİKRAR GARANTİSİDİR, HUKUKİ ÖNCELİK DEĞİL.
 *
 *     "Aynı vadede önce hangi kalem kapanır" sorusunun mevzuat cevabı varsa
 *     — en bilinen adayı **gecikme tazminatının anaparadan önce mahsubu** —
 *     o cevap BURADAN GELMEZ. Bugünkü sıra yalnızca aynı girdinin aynı
 *     çıktıyı vermesini sağlar.
 *
 * ⛔ TAZMİNAT KALEMİ ÜRÜNE GİRDİĞİNDE BU LİSTE GÖZDEN GEÇİRİLMELİDİR.
 *    Aksi hâlde tazminatın anaparadan önce mi sonra mı kapanacağını
 *    `giderTuruKodu`'nun ALFABETİK sırası sessizce belirler ve CT-26 o gün
 *    yeşil kalarak YANLIŞ ŞEYİ korur. (Yol haritasında madde olarak duruyor.)
 *
 * `id` son anahtardır ve benzersizdir: ötekiler eşit olsa bile sıra tamdır.
 */
export const BORC_KAPATMA_SIRASI: readonly Prisma.BorcOrderByWithRelationInput[] = [
  { vadeTarihi: 'asc' },
  { tahakkukDonemi: 'asc' },
  { giderTuruKodu: 'asc' },
  { id: 'asc' },
];
