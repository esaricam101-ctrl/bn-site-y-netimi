# Ters vekil yapılandırması — ölçülmüş gerekçelerle

Bu belge **öneridir**, uygulanmış yapılandırma değildir. Her madde ölçüme
dayanır; ölçülmeyen hiçbir sayı yazılmamıştır.

## Neden var — ölçülen iki arıza

### 1. Uzun istek varsayılan zaman aşımında kesilir

Nginx 1.27, **varsayılan ayarlar**, doğrudan uygulamaya vekillik:

| iş | süre | sonuç |
|---|---|---|
| 5.000 bölümlük tahakkuk | 50,7 sn | 201 — 60 sn varsayılanın altında kaldı |
| 10.000 bölümlük tahakkuk | **60,1 sn** | **504 Gateway Time-out** |

`proxy_read_timeout` varsayılanı 60 sn'dir. 5.000 bölüm bugün payın **%85'ini**
yiyor.

### 2. ★ Bir uzun isteğin 504'ü BÜTÜN SİTEYİ 10 saniye düşürüyor

Nginx'in pasif sağlık denetimi varsayılanı `max_fails=1 fail_timeout=10s`'dir.
Tek bir 504'ten sonra arka uç **ölü** işaretlenir:

```text
2026/08/01 07:51:34 [error] upstream timed out … 504
2026/08/01 07:51:40 [error] no live upstreams while connecting to upstream … 502
```

O pencerede **hiçbir kullanıcı hizmet alamaz** — bir yöneticinin toplu
tahakkuku, hiçbir ilgisi olmayan sakinlere 502 döndürür.

> ⚠️ Ölçümdeki 502'nin bir kısmı Docker Desktop'ta `host.docker.internal`
> adresinin IPv6'ya da çözülmesinden kaynaklandı (`[fdc4:…]:3001 failed`).
> Bu ortama özgüdür. Ama `no live upstreams` satırı ortamdan bağımsız gerçek
> nginx davranışıdır.

## Öneri

```nginx
# Uzun işlem ucu ve normal trafik AYRI upstream tanımları kullanır.
# Aynı sunucuyu gösterseler bile nginx sağlık işaretlemesini upstream
# BAZINDA tutar: uzun işlemin 504'ü normal trafiği düşürmez.
upstream bnos_api {
    server 10.0.0.10:3001;
    # Sağlık kontrolü ve normal trafik burada. Tek arka uç varken pasif
    # işaretleme yalnızca zarar verir: yönlendirilecek başka sunucu yoktur,
    # nginx yalnızca 502 üretir.
    max_fails=0;
    keepalive 32;
}

upstream bnos_api_uzun {
    server 10.0.0.10:3001;
    max_fails=0;
    keepalive 8;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    # --- Uzun işlemler: toplu tahakkuk -----------------------------------
    # Ölçüm: 5.000 bölüm 50,7 sn · bölüm başına ≈10 ms · doğrusal.
    # 180 sn, ölçülen en büyük işin (10.000 bölüm ≈ 100 sn) üzerinde pay
    # bırakır. ★ Bu bir ÇÖZÜM DEĞİL, köprüdür: kalıcı çözüm ADR-0013'ün
    # partileme kararıdır. Zaman aşımını büyütmek, 3 dakika boş ekrana
    # bakan kullanıcıyı ortadan kaldırmaz.
    location = /api/v1/tahakkuk/calistir {
        proxy_pass http://bnos_api_uzun;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- Sağlık kontrolü: ASLA vekil sağlık işaretlemesine takılmasın ----
    # Ayrı location + kısa zaman aşımı. Yük dengeleyici bu ucu yoklar;
    # uzun bir tahakkuk yüzünden düğümün "sağlıksız" görünmesi, hizmeti
    # gerçekten kesintiye uğratırdı.
    location = /api/v1/saglik {
        proxy_pass http://bnos_api;
        proxy_read_timeout 5s;
        proxy_connect_timeout 2s;
        access_log off;
    }

    # --- Normal trafik ----------------------------------------------------
    # Ölçüm: 50 eşzamanlı kullanıcıda p99 ≈ 1,4–2,2 sn. 60 sn varsayılanı
    # fazlasıyla yeterli; kısaltmak yavaş bir sorguyu erken keser ve
    # kullanıcıya sebepsiz 504 gösterir.
    location / {
        proxy_pass http://bnos_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## `max_fails` / `fail_timeout` üretimde ne olmalı

| durum | öneri | gerekçe |
|---|---|---|
| **Tek arka uç** | `max_fails=0` (işaretleme kapalı) | Yönlendirilecek başka sunucu yoktur. İşaretleme yalnızca 502 üretir — ölçümde tam olarak bu oldu. |
| **Birden çok arka uç** | `max_fails=3 fail_timeout=30s` | Tek bir yavaş istek düğümü düşürmemeli. Üç ardışık başarısızlık gerçek arızayı gösterir. |
| Her durumda | uzun işlem ucu **ayrı upstream** | Uzun işlemin zaman aşımı normal trafiğin sağlık durumunu kirletmemeli. |

## Uygulanmadan önce doğrulanacaklar

- `TRUST_PROXY` değeri: `X-Forwarded-For` güvenilirliği istek sınırının ve
  denetim kaydındaki IP'nin doğruluğunu belirler (bkz. `env.schema.ts`).
- `/api/v1/saglik` ucunun gerçekten var olduğu (bu belge yazılırken uygulama
  `saglik` ucunu global önek altında sunuyordu).
- Bulut vekilleri (Cloudflare 100 sn, ALB 60 sn varsayılan) nginx'in
  **önünde** ayrı bir sınır koyar; 180 sn yalnızca nginx katmanında geçerlidir.
