import type { Config } from 'tailwindcss';
import { tailwindTema } from '@bnos/ui-tokens';

/**
 * Tasarim token'lari TEK KAYNAKTAN gelir (@bnos/ui-tokens).
 * Burada yeni renk veya olcu TANIMLANMAZ — mobil ile ayrilma boyle onlenir.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { ...tailwindTema } },
  plugins: [],
} satisfies Config;
