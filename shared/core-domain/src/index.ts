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
