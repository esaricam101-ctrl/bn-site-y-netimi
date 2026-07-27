/**
 * BNOS Apartman — paket sınırı zorlaması (AST tabanlı)
 * Kaynak: ADR v1.1 §40 · BFS v1 §1.2
 *
 * scripts/boundary.mjs aynı kuralı bağımlılıksız uygular.
 * İkisi birlikte çalışır; biri diğerinin yerine geçmez.
 */
module.exports = {
  forbidden: [
    {
      name: 'core-domain-apartman-domaine-bagimli-olamaz',
      severity: 'error',
      comment:
        'ADR v1.1 §40 — core-domain dikeyden bagimsizdir. Apartmana ozgu bir kavrama ' +
        'ihtiyac duyuyorsa ya kavram core-domaine ait degildir ya da bir port arkasina alinmalidir.',
      from: { path: '^shared/core-domain' },
      to: { path: '^shared/apartman-domain' },
    },
    {
      name: 'kernel-yaprak-pakettir',
      severity: 'error',
      comment: 'BFS v1 §1.2 — kernel hicbir domain paketine bagimli olamaz.',
      from: { path: '^shared/kernel' },
      to: { path: '^shared/(core-domain|apartman-domain|bnos-client|module-sdk)' },
    },
    {
      name: 'domain-katmani-framework-bilmez',
      severity: 'error',
      comment: 'BFS v1 §1.3 — domain katmani framework ve kalicilik bagimsizdir.',
      from: { path: '(^shared/(core|apartman)-domain|/domain/)' },
      to: { path: 'node_modules/(@prisma/client|prisma|@nestjs)' },
    },
    {
      name: 'dairesel-bagimlilik-yok',
      severity: 'error',
      comment: 'Dairesel bagimlilik, katman ihlalinin en yaygin belirtisidir.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
