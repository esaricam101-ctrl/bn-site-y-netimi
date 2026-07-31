-- GERCEK URETIM DAGILIMI: buyuk tenant, kucuk kapsam
-- 5.000 bolum · 4.700 malik kisi (4.985 malik kaydi) · 3.000 kiraci · ~5.300 sakin
\timing on
\pset pager off
SET statement_timeout = '600s';

-- TEMIZLIK: RLS'li tabloya dokunmadan ONCE baglam kurulur.
DO $$
DECLARE eski uuid;
BEGIN
  SELECT id INTO eski FROM tenant WHERE kod='gercek-5000';
  IF eski IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.tenant_id', eski::text, false);
  PERFORM set_config('app.kapsam_kisi_id','',false);
  PERFORM set_config('app.kapsam_bolumler','',false);
  PERFORM set_config('app.kapsam_mulk_bolumler','',false);
  DELETE FROM sakin  WHERE tenant_id=eski;
  DELETE FROM kiraci WHERE tenant_id=eski;
  DELETE FROM malik  WHERE tenant_id=eski;
  DELETE FROM kisi   WHERE tenant_id=eski;
  DELETE FROM bagimsiz_bolum WHERE tenant_id=eski;
  DELETE FROM kat    WHERE tenant_id=eski;
  DELETE FROM blok   WHERE tenant_id=eski;
  DELETE FROM apartman WHERE tenant_id=eski;
  DELETE FROM outbox_kayit WHERE tenant_id=eski;
  DELETE FROM tenant WHERE id=eski;
END $$;

DO $$
DECLARE
  t uuid := gen_random_uuid();
  ap uuid := gen_random_uuid();
BEGIN
  INSERT INTO tenant(id,kod,ad,tip,durum,saat_dilimi,para_birimi,lisans_kodu,
                     olusturulma_tarihi,guncelleme_tarihi)
  VALUES (t,'gercek-5000','Gercek Dagilim 5000','SITE','AKTIF',
          'Europe/Istanbul','TRY','TEST',now(),now());

  PERFORM set_config('app.tenant_id', t::text, false);
  PERFORM set_config('app.kapsam_kisi_id','',false);
  PERFORM set_config('app.kapsam_bolumler','',false);
  PERFORM set_config('app.kapsam_mulk_bolumler','',false);

  INSERT INTO apartman(id,tenant_id,ad,olusturulma_tarihi,guncelleme_tarihi)
    VALUES (ap,t,'Site',now(),now());

  -- 10 blok × 500 daire
  INSERT INTO blok(id,tenant_id,apartman_id,ad,olusturulma_tarihi)
  SELECT gen_random_uuid(),t,ap,'B'||i,now() FROM generate_series(1,10) i;

  INSERT INTO kat(id,tenant_id,blok_id,no,olusturulma_tarihi)
  SELECT gen_random_uuid(),t,b.id,k,now()
  FROM blok b, generate_series(1,10) k WHERE b.tenant_id=t;

  INSERT INTO bagimsiz_bolum(id,tenant_id,blok_id,kat_id,kapi_no,kat,nitelik,
        brut_m2,net_m2,arsa_payi_pay,arsa_payi_payda,aidat_muafiyeti,durum,
        olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(), t, k.blok_id, k.id,
         'K' || k.no || 'D' || d, k.no, 'MESKEN',
         100, 85, 200, 1000000, false, 'AKTIF', now(), now()
  FROM kat k, generate_series(1,50) d WHERE k.tenant_id=t;

  -- KISILER: 4700 malik + 3000 kiraci + 5300 sakin = 13.000
  INSERT INTO kisi(id,tenant_id,ad,soyad,anonim_mi,silindi_mi,
        olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,'M'||i,'Malik'||i,false,false,now(),now()
  FROM generate_series(1,4700) i;
  INSERT INTO kisi(id,tenant_id,ad,soyad,anonim_mi,silindi_mi,
        olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,'K'||i,'Kiraci'||i,false,false,now(),now()
  FROM generate_series(1,3000) i;
  INSERT INTO kisi(id,tenant_id,ad,soyad,anonim_mi,silindi_mi,
        olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,'S'||i,'Sakin'||i,false,false,now(),now()
  FROM generate_series(1,5300) i;

  RAISE NOTICE 'tenant: %', t;
END $$;

-- ---- MALIK dagilimi: 4500x1 · 150x2 · 45x3 · 5x10 = 4985 kayit ------------
DO $$
DECLARE t uuid; BEGIN
  SELECT id INTO t FROM tenant WHERE kod='gercek-5000';
  PERFORM set_config('app.tenant_id', t::text, false);

  DROP TABLE IF EXISTS _b; CREATE TEMP TABLE _b AS
    SELECT id, row_number() OVER (ORDER BY blok_id, kat, kapi_no) rn FROM bagimsiz_bolum WHERE tenant_id=t;
  DROP TABLE IF EXISTS _m; CREATE TEMP TABLE _m AS
    SELECT id, row_number() OVER (ORDER BY soyad) rn FROM kisi
    WHERE tenant_id=t AND soyad LIKE 'Malik%';

  -- kisi rn 1..4500 -> 1 daire   (bolum rn 1..4500)
  INSERT INTO malik(id,tenant_id,bolum_id,kisi_id,hisse_pay,hisse_payda,
        tapu_turu,tapu_baslangic,olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,b.id,m.id,1,1,'KAT_MULKIYETI',DATE '2024-01-01',now(),now()
  FROM _m m JOIN _b b ON b.rn=m.rn WHERE m.rn<=4500;

  -- kisi rn 4501..4650 (150 kisi) -> 2 daire  (bolum 4501..4800)
  INSERT INTO malik(id,tenant_id,bolum_id,kisi_id,hisse_pay,hisse_payda,
        tapu_turu,tapu_baslangic,olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,b.id,m.id,1,1,'KAT_MULKIYETI',DATE '2024-01-01',now(),now()
  FROM _m m JOIN generate_series(0,1) k ON true
       JOIN _b b ON b.rn = 4500 + (m.rn-4501)*2 + k + 1
  WHERE m.rn BETWEEN 4501 AND 4650;

  -- kisi rn 4651..4695 (45 kisi) -> 3 daire  (bolum 4801..4935)
  INSERT INTO malik(id,tenant_id,bolum_id,kisi_id,hisse_pay,hisse_payda,
        tapu_turu,tapu_baslangic,olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,b.id,m.id,1,1,'KAT_MULKIYETI',DATE '2024-01-01',now(),now()
  FROM _m m JOIN generate_series(0,2) k ON true
       JOIN _b b ON b.rn = 4800 + (m.rn-4651)*3 + k + 1
  WHERE m.rn BETWEEN 4651 AND 4695;

  -- kisi rn 4696..4700 (5 kisi) -> 10 daire  (bolum 4936..4985)
  INSERT INTO malik(id,tenant_id,bolum_id,kisi_id,hisse_pay,hisse_payda,
        tapu_turu,tapu_baslangic,olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,b.id,m.id,1,1,'KAT_MULKIYETI',DATE '2024-01-01',now(),now()
  FROM _m m JOIN generate_series(0,9) k ON true
       JOIN _b b ON b.rn = 4935 + (m.rn-4696)*10 + k + 1
  WHERE m.rn BETWEEN 4696 AND 4700;

  -- KIRACI: ilk 3000 bolum kirada
  DROP TABLE IF EXISTS _k; CREATE TEMP TABLE _k AS
    SELECT id, row_number() OVER (ORDER BY soyad) rn FROM kisi
    WHERE tenant_id=t AND soyad LIKE 'Kiraci%';
  INSERT INTO kiraci(id,tenant_id,bolum_id,kisi_id,baslangic,
        olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,b.id,k.id,DATE '2025-01-01',now(),now()
  FROM _k k JOIN _b b ON b.rn=k.rn WHERE k.rn<=3000;

  -- SAKIN: 5300 kisi, dayanak MALIK (0021 CHECK: tam olarak biri)
  DROP TABLE IF EXISTS _s; CREATE TEMP TABLE _s AS
    SELECT id, row_number() OVER (ORDER BY soyad) rn FROM kisi
    WHERE tenant_id=t AND soyad LIKE 'Sakin%';
  INSERT INTO sakin(id,tenant_id,bolum_id,kisi_id,malik_id,yakinlik_derecesi,
        giris_tarihi,olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(), t, mk.bolum_id, s.id, mk.id,
         ((ARRAY['ES','COCUK','ANNE'])[1 + (s.rn % 3)])::"YakinlikDerecesi", DATE '2025-01-01', now(), now()
  FROM _s s
  JOIN (SELECT id, bolum_id, row_number() OVER (ORDER BY bolum_id) rn
          FROM malik WHERE tenant_id=t) mk
    ON mk.rn = 1 + ((s.rn - 1) % 4985);
END $$;

ANALYZE kisi; ANALYZE malik; ANALYZE kiraci; ANALYZE sakin; ANALYZE bagimsiz_bolum;

\echo '######## GERCEK SATIR SAYILARI'
SELECT set_config('app.tenant_id',(SELECT id::text FROM tenant WHERE kod='gercek-5000'),false);
SELECT set_config('app.kapsam_kisi_id','',false);
SELECT set_config('app.kapsam_bolumler','',false);
SELECT set_config('app.kapsam_mulk_bolumler','',false);

SELECT 'bagimsiz_bolum' AS tablo, count(*) FROM bagimsiz_bolum WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'blok', count(*) FROM blok WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'kat', count(*) FROM kat WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'kisi', count(*) FROM kisi WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'malik (kayit)', count(*) FROM malik WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'malik (tekil kisi)', count(DISTINCT kisi_id) FROM malik WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'kiraci', count(*) FROM kiraci WHERE tenant_id=app_tenant_id()
UNION ALL SELECT 'sakin', count(*) FROM sakin WHERE tenant_id=app_tenant_id();

\echo '######## MALIK DAGILIMI (kac daireli kac kisi)'
SELECT daire_sayisi, count(*) AS kisi_sayisi FROM (
  SELECT kisi_id, count(*) daire_sayisi FROM malik WHERE tenant_id=app_tenant_id()
  GROUP BY kisi_id) s
GROUP BY daire_sayisi ORDER BY daire_sayisi;
