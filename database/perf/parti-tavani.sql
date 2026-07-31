-- TOPLU TAHAKKUK TAVANI: farkli buyuklukte bloklar tek tenant'ta.
\pset pager off
SET statement_timeout='300s';

DO $$
DECLARE eski uuid;
BEGIN
  SELECT id INTO eski FROM tenant WHERE kod='perf-parti';
  IF eski IS NULL THEN RETURN; END IF;
  PERFORM set_config('app.tenant_id', eski::text, false);
  PERFORM set_config('app.kapsam_kisi_id','',false);
  PERFORM set_config('app.kapsam_bolumler','',false);
  PERFORM set_config('app.kapsam_mulk_bolumler','',false);
  DELETE FROM borc_sorumlusu WHERE tenant_id=eski;
  DELETE FROM borc WHERE tenant_id=eski;
  DELETE FROM kullanici_rolu WHERE tenant_id=eski;
  DELETE FROM kullanici WHERE tenant_id=eski;
  DELETE FROM malik WHERE tenant_id=eski;
  DELETE FROM kisi WHERE tenant_id=eski;
  DELETE FROM bagimsiz_bolum WHERE tenant_id=eski;
  DELETE FROM kat WHERE tenant_id=eski;
  DELETE FROM blok WHERE tenant_id=eski;
  DELETE FROM gider_turu WHERE tenant_id=eski;
  DELETE FROM apartman WHERE tenant_id=eski;
  DELETE FROM outbox_kayit WHERE tenant_id=eski;
  DELETE FROM tenant WHERE id=eski;
END $$;

DO $$
DECLARE
  t uuid := gen_random_uuid();
  ap uuid := gen_random_uuid();
  bo uuid; ka uuid; n int; toplam int := 0;
BEGIN
  INSERT INTO tenant(id,kod,ad,tip,durum,saat_dilimi,para_birimi,lisans_kodu,
                     olusturulma_tarihi,guncelleme_tarihi)
  VALUES (t,'perf-parti','Parti Tavani','SITE','AKTIF','Europe/Istanbul','TRY','TEST',now(),now());
  PERFORM set_config('app.tenant_id', t::text, false);
  PERFORM set_config('app.kapsam_kisi_id','',false);
  PERFORM set_config('app.kapsam_bolumler','',false);
  PERFORM set_config('app.kapsam_mulk_bolumler','',false);

  INSERT INTO apartman(id,tenant_id,ad,olusturulma_tarihi,guncelleme_tarihi)
    VALUES (ap,t,'Site',now(),now());

  FOREACH n IN ARRAY ARRAY[25,50,100,200,300,400] LOOP
    bo := gen_random_uuid(); ka := gen_random_uuid();
    INSERT INTO blok(id,tenant_id,apartman_id,ad,olusturulma_tarihi) VALUES (bo,t,ap,'B'||n,now());
    INSERT INTO kat(id,tenant_id,blok_id,no,olusturulma_tarihi) VALUES (ka,t,bo,1,now());
    INSERT INTO bagimsiz_bolum(id,tenant_id,blok_id,kat_id,kapi_no,kat,nitelik,brut_m2,net_m2,
          arsa_payi_pay,arsa_payi_payda,aidat_muafiyeti,durum,olusturulma_tarihi,guncelleme_tarihi)
    SELECT gen_random_uuid(),t,bo,ka,'B'||n||'D'||d,1,'MESKEN',100,85,200,1000000,false,'AKTIF',now(),now()
    FROM generate_series(1,n) d;
    toplam := toplam + n;
  END LOOP;

  -- her bolume bir malik
  INSERT INTO kisi(id,tenant_id,ad,soyad,anonim_mi,silindi_mi,olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,'P'||i,'Parti'||i,false,false,now(),now() FROM generate_series(1,toplam) i;

  INSERT INTO malik(id,tenant_id,bolum_id,kisi_id,hisse_pay,hisse_payda,tapu_turu,tapu_baslangic,
        olusturulma_tarihi,guncelleme_tarihi)
  SELECT gen_random_uuid(),t,b.id,k.id,1,1,'KAT_MULKIYETI',DATE '2024-01-01',now(),now()
  FROM (SELECT id,row_number() OVER (ORDER BY kapi_no) rn FROM bagimsiz_bolum WHERE tenant_id=t) b
  JOIN (SELECT id,row_number() OVER (ORDER BY soyad) rn FROM kisi WHERE tenant_id=t) k ON k.rn=b.rn;

  INSERT INTO gider_turu(id,tenant_id,kod,ad,paylasim_kurali,sorumluluk_tipi,kural_kaynagi,
        malik_paylasimi,aktif_mi,olusturulma_tarihi,guncelleme_tarihi)
  VALUES (gen_random_uuid(),t,'PERF_BLOK','Parti Blok','BLOK_BAZLI','MALIKE_AIT','KMK_VARSAYILAN',
          'HISSE_ORANI',true,now(),now());

  RAISE NOTICE 'tenant=% toplam bolum=%', t, toplam;
END $$;

ANALYZE bagimsiz_bolum; ANALYZE malik; ANALYZE kisi;

SELECT set_config('app.tenant_id',(SELECT id::text FROM tenant WHERE kod='perf-parti'),false);
SELECT set_config('app.kapsam_kisi_id','',false);
SELECT set_config('app.kapsam_bolumler','',false);
SELECT set_config('app.kapsam_mulk_bolumler','',false);
SELECT k.ad AS blok, count(b.id) AS bolum FROM blok k
  LEFT JOIN bagimsiz_bolum b ON b.blok_id=k.id GROUP BY k.ad ORDER BY 2;
