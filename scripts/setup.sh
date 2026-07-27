#!/usr/bin/env bash
# BNOS Apartman Yönetimi — ilk kurulum
set -euo pipefail

echo "BNOS Apartman Yönetimi — kurulum"
echo

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  .env oluşturuldu (.env.example kopyalandı)"
  echo "  UYARI: JWT_SECRET değerini değiştirin."
else
  echo "  .env zaten var, dokunulmadı"
fi

echo
echo "Bağımlılıklar kuruluyor…"
pnpm install

echo
echo "Altyapı başlatılıyor (postgres · redis · minio)…"
docker compose up -d postgres redis minio

echo "  PostgreSQL hazır olması bekleniyor…"
until docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

echo
echo "Veritabanı şeması uygulanıyor…"
pnpm --filter @bnos/database generate
pnpm --filter @bnos/database migrate

echo
echo "Tohum verisi yükleniyor…"
pnpm --filter @bnos/database seed

echo
echo "Doğrulama zinciri çalıştırılıyor…"
pnpm verify

cat <<'SON'

Kurulum tamamlandı.

  pnpm dev            backend (3001) + web (3000)
  pnpm verify         mimari kural doğrulaması
  pnpm test:contract  sözleşme testleri

  API dokümantasyonu: http://localhost:3001/api/v1/docs
  Web arayüzü:        http://localhost:3000

  Geliştirme girişi:  yonetici@guzel-apartmani.test / bnos1234
SON
