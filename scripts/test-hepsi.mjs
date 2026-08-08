/**
 * TEK KAPI — iki koşucuyu sırayla çağırır ve İKİ SAYACI AYRI yazar.
 *
 * ⚠️  NEDEN VAR: `pnpm test` eskiden `pnpm -r test` idi ve YALNIZCA
 *     backend'in sözleşme süitini koşuyordu (`vitest --dir test/contract`).
 *     Kök `tests/unit/` dizini HİÇ ÇALIŞMIYORDU. Yani "tek kapı" vardı ama
 *     bir yolu kaçırıyordu: `pnpm test` yazan biri 189 görüp her şeyin
 *     koştuğunu sanıyordu.
 *
 * ⚠️  İKİ KOŞUCU BİRLEŞTİRİLMEDİ ve bu bilinçlidir (R1). Birim testleri
 *     `.mjs` + `dist/` deseniyle yazılmıştır; o desen kök `tsconfig`in
 *     `files: []` olması yüzünden seçilmişti (`.test.ts` ESLint'te düşüyor).
 *     Taşıma bir İYİLEŞTİRME, düzeltme değil — yol haritasında P2.
 *
 * ⚠️  ÇIKIŞ KODU YUTULMAZ. Biri düşerse burası da düşer; aksi hâlde tek
 *     kapı, kırmızıyı gizleyen bir örtüye dönerdi.
 *
 * CI BU BETİĞİ KULLANMAZ — orada iki adım zaten ayrı ayrı çağrılıyor
 * (`pnpm test:unit` ve sözleşme adımı). Bu kapı YEREL kullanım içindir.
 */
import { spawnSync } from 'node:child_process';

/*
 * ⚠️  `shell: true` ZORUNLU, tercih değil. Node 22+ güvenlik gereği
 *     `.cmd`/`.bat` dosyalarını kabuk olmadan çalıştırmayı REDDEDER
 *     (CVE-2024-27980) ve Windows'ta `pnpm` bir `.cmd` shim'idir.
 *     Kabuksuz çağrıldığında iki adım da ÇIKTISIZ düşüyordu — ölçüldü.
 *
 * ⚠️  Komutlar SABİT metindir; dışarıdan gelen hiçbir değer birleştirilmez,
 *     dolayısıyla kabuk enjeksiyonu yüzeyi yoktur.
 */

/** Koşucunun kendi çıktısındaki test sayısını yakalar; bulamazsa `null`. */
function sayiyiCikar(metin, desen) {
  const e = metin.match(desen);
  return e === null ? null : e[1];
}

const adimlar = [
  {
    ad: 'Birim testleri',
    komut: 'pnpm test:unit',
    // node:test özeti: "ℹ pass 352"
    desen: /^\D*pass (\d+)/m,
  },
  {
    ad: 'Sözleşme testleri',
    komut: 'pnpm test:contract',
    // vitest özeti: "Tests  189 passed (189)"
    desen: /Tests\s+(\d+) passed/,
  },
];

const sonuclar = [];
let dusenVar = false;

for (const adim of adimlar) {
  console.log(`\n=== ${adim.ad} ===`);
  const c = spawnSync(adim.komut, { encoding: 'utf8', shell: true });

  // Çıktı OLDUĞU GİBİ basılır: özet, ayrıntının yerini tutmaz.
  if (c.stdout) process.stdout.write(c.stdout);
  if (c.stderr) process.stderr.write(c.stderr);

  const gecti = c.status === 0;
  if (!gecti) dusenVar = true;

  sonuclar.push({
    ad: adim.ad,
    gecti,
    /*
     * ⚠️  Sayı BULUNAMAZSA "0" YAZILMAZ. Sıfır, "hiç test yok" demektir ve
     *     "sayıyı okuyamadım" ile aynı şey değildir — ikisini aynı
     *     göstermek, koşucu çıktısı değişince sessiz bir yanlış rapor
     *     üretirdi.
     */
    sayi: sayiyiCikar(`${c.stdout ?? ''}${c.stderr ?? ''}`, adim.desen) ?? 'okunamadı',
  });
}

console.log(`\n${'='.repeat(46)}`);
for (const s of sonuclar) {
  console.log(`  ${s.gecti ? 'GECTI' : 'DUSTU'}  ${s.ad.padEnd(20)} ${s.sayi}`);
}
console.log('='.repeat(46));

if (dusenVar) {
  console.error('\nEn az bir koşucu düştü.');
  process.exit(1);
}
console.log('\nIki kosucu da yesil.');
