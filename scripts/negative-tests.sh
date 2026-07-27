#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Negatif test paketi — denetleyicilerin GERCEKTEN calistigini kanitlar.
#
# Yesil bir kontrol, hicbir sey kontrol etmiyorsa anlamsizdir. Bu betik her
# denetleyiciye kasitli bir ihlal enjekte eder, yakalandigini dogrular ve
# degisikligi GERI ALIR.
#
# Faz 0 sirasinda boundary.mjs'in yol desenleri eskimis ve denetleyici
# hicbir dosyayla eslesmedigi icin YESIL YANMISTI. Bu betik o sinif hatayi
# yakalamak icin vardir.
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."

TSC="${TSC:-tsc}"
gecti=0; kaldi=0

kontrol() {
  if [ "$1" = "OK" ]; then
    printf '  \033[32m✓\033[0m %s\n' "$2"; gecti=$((gecti + 1))
  else
    printf '  \033[31m✗\033[0m %s — YAKALANMADI\n' "$2"; kaldi=$((kaldi + 1))
  fi
}

echo "Negatif test paketi — kasıtlı ihlaller enjekte ediliyor"
echo

# --- N-1  TypeScript tip denetimi ---
echo 'export const x: number = "y";' > shared/kernel/src/__neg.ts
$TSC -b --pretty false >/dev/null 2>&1 && r=FAIL || r=OK
rm -f shared/kernel/src/__neg.ts
kontrol "$r" "N-1  tsc — tip uyuşmazlığı (TS2322)"

# --- N-2..N-4  Paket sınırı ---
printf "import type {} from '@bnos/apartman-domain';\nexport {};\n" > shared/core-domain/src/__neg.ts
node scripts/boundary.mjs >/dev/null 2>&1 && r=FAIL || r=OK
rm -f shared/core-domain/src/__neg.ts
kontrol "$r" "N-2  boundary — core-domain → apartman-domain (ADR v1.1 §40)"

printf "import type {} from '@bnos/core-domain';\nexport {};\n" > shared/kernel/src/__neg.ts
node scripts/boundary.mjs >/dev/null 2>&1 && r=FAIL || r=OK
rm -f shared/kernel/src/__neg.ts
kontrol "$r" "N-3  boundary — kernel yaprak paket ihlali (BFS v1 §1.2)"

printf "import type {} from '@prisma/client';\nexport {};\n" > shared/apartman-domain/src/__neg.ts
node scripts/boundary.mjs >/dev/null 2>&1 && r=FAIL || r=OK
rm -f shared/apartman-domain/src/__neg.ts
kontrol "$r" "N-4  boundary — domain katmanı framework sızıntısı (BFS v1 §1.3)"

# --- N-5  Boş eşleşme koruması ---
cp scripts/boundary.mjs /tmp/bnos-boundary.bak
sed -i 's|kaynak: /\^shared\\/ui-tokens\\//|kaynak: /^OLMAYAN-KLASOR\\//|' scripts/boundary.mjs
node scripts/boundary.mjs >/dev/null 2>&1 && r=FAIL || r=OK
cp /tmp/bnos-boundary.bak scripts/boundary.mjs && rm -f /tmp/bnos-boundary.bak
kontrol "$r" "N-5  boundary — BOŞ EŞLEŞME KORUMASI"

# --- N-6..N-7  Önbellek anahtarı ---
mkdir -p shared/core-domain/src/__neg
printf "declare const redis: { get(k: string): Promise<string|null> };\nexport const a = () => redis.get('bakiye:daire-3');\n" > shared/core-domain/src/__neg/k.ts
node scripts/cache-key-scan.mjs >/dev/null 2>&1 && r=FAIL || r=OK
kontrol "$r" "N-6  cache-key — finansal alan önbeklenemez (ADR-0005)"

printf "declare const redis: { get(k: string): Promise<string|null> };\nexport const a = () => redis.get('kullanici:izinler');\n" > shared/core-domain/src/__neg/k.ts
node scripts/cache-key-scan.mjs >/dev/null 2>&1 && r=FAIL || r=OK
rm -rf shared/core-domain/src/__neg
kontrol "$r" "N-7  cache-key — tenantId taşımayan anahtar (BFS v1 §7.1)"

# --- N-8..N-9  Yapılandırma ---
cp database/init/01-roles.sql /tmp/bnos-roles.bak
sed -i 's/NOBYPASSRLS;/BYPASSRLS;/' database/init/01-roles.sql
node scripts/config-check.mjs >/dev/null 2>&1 && r=FAIL || r=OK
cp /tmp/bnos-roles.bak database/init/01-roles.sql && rm -f /tmp/bnos-roles.bak
kontrol "$r" "N-8  config — BYPASSRLS yetkisi (ADR-0002)"

cp .github/workflows/ci.yml /tmp/bnos-ci.bak
printf '\n  bozuk: [ acik parantez\n' >> .github/workflows/ci.yml
node scripts/config-check.mjs >/dev/null 2>&1 && r=FAIL || r=OK
cp /tmp/bnos-ci.bak .github/workflows/ci.yml && rm -f /tmp/bnos-ci.bak
kontrol "$r" "N-9  config — geçersiz YAML sözdizimi"

# --- N-10  Event kataloğu ---
node --input-type=module -e "
const CD = await import('./shared/core-domain/dist/index.js');
const K  = await import('./shared/kernel/dist/index.js');
const TID = K.tenantId('11111111-2222-3333-4444-555555555555');
try {
  CD.eventOlustur({ eventType:'core.hayali.olusturuldu', eventVersion:1, tenantId:TID,
    principal:{id:'p',tip:'INSAN',tenantId:TID,izinler:[]}, correlationId:'c',
    aggregate:{tip:'X',id:'x',version:1}, payload:{} }, 'e', new Date());
  process.exit(1);
} catch { process.exit(0); }
" >/dev/null 2>&1 && r=OK || r=FAIL
kontrol "$r" "N-10 event — katalogda olmayan event üretilemez (AIS v1 §4.3)"

# --- N-11  Şifre doğrulaması yanlış parolayı kabul etmemeli ---
node --input-type=module -e "
const S = await import('./tests/.derleme/security/sifre.js');
const ozet = await S.sifreOzetle('DogruParola');
if (await S.sifreDogrula('YanlisParola', ozet)) process.exit(1);
if (!(await S.sifreDogrula('DogruParola', ozet))) process.exit(1);
process.exit(0);
" >/dev/null 2>&1 && r=OK || r=FAIL
kontrol "$r" "N-11 sifre — yanlış parola reddedilir, doğru parola kabul edilir"

# --- N-12  Bozulmuş tohum özeti doğrulanmamalı ---
OZET=$(grep -o "scrypt\$[^']*" database/seeds/seed.ts | head -1)
BOZUK="${OZET%??}AA"
if [ "$OZET" = "$BOZUK" ]; then BOZUK="${OZET%??}BB"; fi
BNOS_OZET="$BOZUK" node --input-type=module -e "
const S = await import('./tests/.derleme/security/sifre.js');
const ok = await S.sifreDogrula('bnos1234', process.env.BNOS_OZET);
process.exit(ok ? 1 : 0);
" >/dev/null 2>&1 && r=OK || r=FAIL
kontrol "$r" "N-12 sifre — bozulmuş tohum özeti doğrulanmaz"

# --- N-13  Kırık belge bağlantısı ---
# markdownlint bicimi denetler, HEDEFI denetlemez. Bu sinif hata bu depoda
# iki kez gerceklesti (DEVLOG TODO-6).
printf '# Negatif\n\n[kirik](olmayan-dosya-xyz.md)\n' > docs/__neg.md
node scripts/link-check.mjs >/dev/null 2>&1 && r=FAIL || r=OK
rm -f docs/__neg.md
kontrol "$r" "N-13 link-check — kırık belge bağlantısı (DEVLOG TODO-6)"

# --- N-14  Kod bloğu içindeki bağlantı SAYILMAMALI ---
# Ters yon: her seyi isaretleyen bir denetleyici, hicbir seyi isaretlemeyen
# kadar bozuktur. Belgeler kirik baglantiyi ornek olarak gostermek zorunda
# kalir; bunlar yanlis pozitif uretirse denetleyici devre disi birakilir.
printf '# Negatif\n\n```\n[a](yok-blok.md)\n```\n\nSatir ici: `[b](yok-satir.md)`\n' > docs/__neg.md
node scripts/link-check.mjs >/dev/null 2>&1 && r=OK || r=FAIL
rm -f docs/__neg.md
kontrol "$r" "N-14 link-check — kod bloğundaki bağlantı yanlış pozitif ÜRETMEZ"

echo
echo "Negatif test: $gecti geçti, $kaldi yakalanmadı"
if [ "$kaldi" -ne 0 ]; then
  echo "En az bir denetleyici ihlali yakalamıyor — yeşil sonuçlarına güvenilemez."
  exit 1
fi
echo "Tüm denetleyiciler gerçekten çalışıyor."
