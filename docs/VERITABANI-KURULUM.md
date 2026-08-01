# Veritabanı kurulum yordamı

**Geliştirme/CI ile üretim yapılandırması AYRIDIR.** Aradaki tek fark şema
sahipliğidir ve bu fark bilinçlidir — aşağıda gerekçesiyle yazılıdır.

---

## Ortak — her ortamda

İki rol vardır ve **ikisinin de `BYPASSRLS` yetkisi yoktur** (ADR-0002):

| rol | ne yapar |
|---|---|
| `bnos_app` | çalışma zamanı. Yalnızca veri okur/yazar. RLS ona uygulanır. |
| `bnos_migrator` | şema değiştirir. Migration'ları uygular. RLS ona da uygulanır. |

```sql
CREATE ROLE bnos_app      WITH LOGIN PASSWORD '…' NOBYPASSRLS;
CREATE ROLE bnos_migrator WITH LOGIN PASSWORD '…' NOBYPASSRLS;

GRANT CONNECT ON DATABASE <db> TO bnos_app, bnos_migrator;
GRANT CREATE  ON SCHEMA public TO bnos_migrator;
GRANT USAGE   ON SCHEMA public TO bnos_app;

ALTER DEFAULT PRIVILEGES FOR ROLE bnos_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bnos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE bnos_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bnos_app;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Geliştirme ve CI — şema sahipliği GEREKLİ

```sql
ALTER SCHEMA public OWNER TO bnos_migrator;
```

### Neden

`prisma migrate reset` önce `DROP SCHEMA public CASCADE` dener. Sahiplik
olmadan bu adım şununla düşer:

```text
ERROR:  must be owner of schema public
```

Bunun üzerine Prisma **CASCADE'siz tek tek düşürmeye** geri düşer ve o yol
çapraz tabloya bakan iki RLS politikasına takılır:

```text
Error: P3016  The fallback method for database resets failed…
ERROR: cannot drop table borc because other objects depend on it
DETAIL: policy tahsilat_kapsam on table tahsilat depends on table borc
        policy borc_sorumlusu_kapsam on table borc_sorumlusu depends on table borc
```

⚠️ **Politikalar kök sebep değildir** — geri düşüş yolunun takıldığı engeldir.
Sahiplik verilince birincil yol çalışır, geri düşüşe hiç girilmez ve
politikalara dokunmak gerekmez. (Politikaları yeniden yazmak seçeneği
bilinçli olarak REDDEDİLDİ: kapsam mantığını değiştirmek güvenlik davranışını
gereksiz yere riske atardı.)

Docker geliştirme ortamında bu satır
[`database/init/01-roles.sql`](../database/init/01-roles.sql) içindedir ve
**yalnızca boş bir veri dizininde** çalışır (`docker-entrypoint-initdb.d`).

### Zaten kurulmuş bir geliştirme veritabanı için — tek seferlik

Veri dizini silinmeden kurulmuş bir ortamda init betiği tekrar koşmaz.
Süper kullanıcıyla bir kez çalıştırın:

```bash
docker exec -e PGPASSWORD=<postgres_parolasi> bnos-postgres \
  psql -U postgres -d bnos_apartman \
  -c "ALTER SCHEMA public OWNER TO bnos_migrator;"
```

Doğrulama — `bnos_migrator` dönmelidir:

```bash
docker exec -e PGPASSWORD=<postgres_parolasi> bnos-postgres \
  psql -U postgres -d bnos_apartman -At \
  -c "SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='public';"
```

### CI

CI'da veritabanı her koşuda sıfırdan kurulur; `01-roles.sql` init betiği
olarak bağlanmalıdır. Bağlanmazsa migration adımı geçer ama **reset adımı
sessizce kırık kalır** — bu yüzden CI iş akışı şema sahibini açıkça
doğrular.

---

## ★ ÜRETİM — şema sahipliği VERİLMEZ

```sql
-- ALTER SCHEMA public OWNER TO bnos_migrator;   ← ÜRETİMDE ÇALIŞTIRILMAZ
```

**Gerekçe:** migration uygulamak için `CREATE ON SCHEMA public` yeterlidir.
Sahiplik yalnızca `migrate reset` içindir ve **üretimde reset
çalıştırılmaz** — üretim yolu `prisma migrate deploy`'dur ve hiçbir şey
düşürmez.

Sahiplik verilirse yanlış ya da kötü niyetli tek bir komut
(`DROP SCHEMA public CASCADE`) tüm şemayı düşürebilir. Kazanılan hiçbir şey
yokken taşınan bir risktir.

Üretimde şema sahibi ayrı bir yönetim rolü (ya da `postgres`) olmalıdır.

### Üretim kurulum sırası

1. Veritabanı ve roller oluşturulur (yukarıdaki **Ortak** bölüm).
2. `ALTER SCHEMA public OWNER TO …` **atlanır**.
3. `prisma migrate deploy` — yalnızca bekleyen migration'ları uygular.
4. Uygulama `bnos_app` kimliğiyle bağlanır.

`migrate reset` ve `migrate dev` üretimde **hiçbir koşulda** çalıştırılmaz.

---

## Şema bağımlılık envanteri

Aynı taramayı tekrar yapmak zorunda kalmamak için (1 Ağustos 2026 itibarıyla,
migration 0030 sonrası):

| nesne | adet | not |
|---|---|---|
| RLS politikası (toplam) | 72 | tenant izolasyonu + satır kapsamı |
| **çapraz tabloya bakan politika** | **2** | `borc_sorumlusu_kapsam → borc` · `tahsilat_kapsam → borc, tahsilat_tahsisi` |
| view / materialized view | **0** | — |
| üretilmiş kolon | 1 | `tahakkuk_calismasi.referans_norm`; yalnızca kendi tablosuna bağlı, çapraz bağımlılık üretmez |
| trigger (kullanıcı tanımlı) | 2 | `audit_kaydi_degistirilemez` · `kullanici_oturum_dizini` |
| fonksiyon (public) | 9 | `app_tenant_id`, 6 kapsam fonksiyonu, 2 trigger fonksiyonu |
| enum tipi | 50 | — |
| `SELECT` içeren CHECK kısıtı | 0 | — |

Yalnızca ilk iki satır reset davranışını etkiler; ikisi de sahiplik
düzeltildikten sonra **etkisizdir** çünkü `DROP SCHEMA CASCADE` hepsini
birlikte düşürür.
