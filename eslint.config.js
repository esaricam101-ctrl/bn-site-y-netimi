// BNOS Apartman — lint yapılandırması
// Kaynak: BFS v1 §7.1 (önbellek anahtarı) · §11 (para float yasağı)

import tseslint from 'typescript-eslint';
import bnos from './tools/eslint-rules/index.js';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/node_modules/**', '**/.next/**',
      'docs/reference/**', '**/*.mjs', 'scripts/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { bnos },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // ADR v1.1 §37 — tenantId içermeyen önbellek anahtarı veri sızıntısıdır
      'bnos/require-tenant-cache-key': 'error',

      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',

      'no-restricted-syntax': [
        'error',
        {
          // BFS v1 §11 — para asla float
          selector:
            "PropertyDefinition[key.name=/tutar|bakiye|borc|alacak|meblag/i] > TSTypeAnnotation > TSNumberKeyword",
          message: 'Para değeri number olamaz. @bnos/kernel Money kullanın — BFS v1 §11.',
        },
      ],
    },
  },
);
