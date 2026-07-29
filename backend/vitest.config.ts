import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';

/**
 * `new URL(...).pathname` Windows'ta `/C:/...` döndürür ve alias çözümlemesi
 * kırılır. `fileURLToPath` her iki platformda da doğru mutlak yolu verir.
 */
const paket = (yol: string): string => fileURLToPath(new URL(yol, import.meta.url));

/**
 * SWC ZORUNLUDUR — esbuild değil.
 *
 * Vitest varsayılan olarak esbuild ile derler; esbuild `emitDecoratorMetadata`
 * DESTEKLEMEZ. NestJS bağımlılık enjeksiyonu bu metaveriye dayanır: metaveri
 * yoksa `constructor(private reflector: Reflector)` çözülemez ve guard
 * çalışma anında `this.reflector` = undefined görür.
 *
 * Belirtisi yanıltıcıdır: uygulama `nest build` (tsc) ile SORUNSUZ çalışır,
 * yalnızca testlerde her istek 500 döner. Testin kırıldığı yer sınadığı
 * davranışla ilgisizdir, bu yüzden hata "testler bozuk" diye atlanabilir.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: false,
    environment: 'node',
    // Sözleşme testleri paylaşılan bir veritabanı kullanır; sıralı çalışır.
    fileParallelism: false,
    testTimeout: 30_000,
    // Kök `.env` yüklenir; olmadan her test yapılandırma hatasıyla düşer.
    setupFiles: [paket('./test/setup.ts')],
  },
  resolve: {
    alias: {
      '@bnos/kernel': paket('../shared/kernel/src/index.ts'),
      '@bnos/core-domain': paket('../shared/core-domain/src/index.ts'),
      '@bnos/apartman-domain': paket('../shared/apartman-domain/src/index.ts'),
      '@bnos/bnos-client': paket('../shared/bnos-client/src/index.ts'),
      '@bnos/module-sdk': paket('../shared/module-sdk/src/index.ts'),
    },
  },
});
