// @bnos/core-domain — dikeyden bagimsiz domain.
// ADR v1.1 §40: bu paket @bnos/apartman-domain'e BAGIMLI OLAMAZ. CI'da zorlanir.

export * from './errors/domain-error.js';
export * from './tenant/tenant.js';
export * from './tenant/yonetim-devri.js';
export * from './audit/audit-entry.js';
export * from './outbox/domain-event.js';
export * from './numbering/numara-serisi.js';
export * from './yetki/izinler.js';
export * from './yetki/roller.js';
// GENEL GERİ AL (0018). Kural katmanı core-domain'dedir çünkü geri alma tek
// bir modüle ait değildir; her modüle ayrı yazılsaydı biri unutulur ve o
// modülde finansal bir kayıt SESSİZCE silinebilirdi.
export * from './geri-alma/geri-alma.js';
