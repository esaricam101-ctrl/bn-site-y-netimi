// @bnos/apartman-domain — yalnizca Apartman dikeyi.
// KMK kurallari, arsa payi, bagimsiz bolum, malik/kiraci, genel kurul, yonetim plani.
export * from './kesir.js';
export * from './bolum/bagimsiz-bolum.js';
export * from './gider/gider-turu.js';
export * from './gider/paylastir.js';
export * from './borc/borc-sorumlusu.js';
export * from './malik/malik.js';
// Operasyonel varliklar. Domain kurallari hazirdir; KALICILIK migration bekler
// (DEVLOG Oturum 11 TODO) — bu moduller henuz veritabani tablosu tasimaz.
export * from './sayac/sayac.js';
export * from './arac/arac.js';
export * from './evcil/evcil-hayvan.js';
export * from './belge/belge.js';
// Muhasebe cekirdegi: cift kayit denkligi · donem kilidi · mizan · kapanis.
// `hesap` · `yevmiye_fisi` · `yevmiye_satiri` tablolari 0001'de vardi ama
// kural katmani yoktu; 0015 ile donem · fis turu · hesap ozelligi eklendi.
export * from './muhasebe/muhasebe.js';
// Banka cekirdegi (0016): IBAN mod-97 · hareket yonu · mutabakat eslestirme ·
// cek/senet durum makinesi. Havale/EFT/FAST/Virman AYRI KAVRAM DEGILDIR;
// hepsi `BankaIslemTipi` degerleridir.
export * from './banka/banka.js';
