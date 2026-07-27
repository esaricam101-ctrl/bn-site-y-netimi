import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Sözleşme testleri paylaşılan bir veritabanı kullanır; sıralı çalışır.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@bnos/kernel': new URL('../shared/kernel/src/index.ts', import.meta.url).pathname,
      '@bnos/core-domain': new URL('../shared/core-domain/src/index.ts', import.meta.url).pathname,
      '@bnos/apartman-domain': new URL('../shared/apartman-domain/src/index.ts', import.meta.url).pathname,
      '@bnos/bnos-client': new URL('../shared/bnos-client/src/index.ts', import.meta.url).pathname,
      '@bnos/module-sdk': new URL('../shared/module-sdk/src/index.ts', import.meta.url).pathname,
    },
  },
});
