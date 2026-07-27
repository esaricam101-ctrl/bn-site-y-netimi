/**
 * Tasarim token lari — tek kaynak (backlog O-2).
 *
 * Kaynak: BN Yonetim V22 dondurulmus token seti (docs/reference/prototypes/).
 * Buradan uretilir:
 *   - Web  : CSS ozel degiskenleri + Tailwind tema uzantisi
 *   - Mobil: React Native tema nesnesi
 *
 * Prototiplerdeki degerler KORUNMUSTUR; yeni renk uretilmemistir.
 */

export const renkler = {
  primary: '#0E7490',
  secondary: '#2563EB',
  dark: '#0F172A',
  darker: '#060B14',
  text: '#E2E8F0',
  success: '#10B981',
  warn: '#F59E0B',
  crit: '#EF4444',
  info: '#38BDF8',
  muted: 'rgba(226,232,240,.68)',
  muted2: 'rgba(226,232,240,.52)',
  line: 'rgba(255,255,255,.06)',
  glassBg: 'rgba(15,23,42,.6)',
  glassBorder: 'rgba(255,255,255,.06)',
} as const;

/** Uyari siddet renkleri — 1 en kritik. */
export const siddet = {
  1: renkler.crit,
  2: renkler.warn,
  3: renkler.info,
} as const;

/** 4px olcegi — V22'den dondurulmus. */
export const aralik = {
  d1: '4px', d2: '8px', d3: '12px', d4: '16px', d6: '24px', d8: '32px',
} as const;

export const yaricap = { r: '14px', rs: '10px' } as const;

export const tipografi = {
  aile: "'DM Sans', system-ui, sans-serif",
  temelBoyut: '14px',
  satirYuksekligi: 1.55,
  agirliklar: { normal: 400, orta: 500, yari: 600, kalin: 700, cokKalin: 800 },
} as const;

/** Yogunluk anahtari — tek aralik-token degisimiyle uygulanir. */
export const yogunluk = {
  rahat:  { pad: '20px', cardPad: '20px', satirYuksekligi: '44px', fontBoyutu: '14px' },
  sikisik:{ pad: '12px', cardPad: '14px', satirYuksekligi: '34px', fontBoyutu: '13px' },
} as const;

export type YogunlukModu = keyof typeof yogunluk;

export const gradyan = `linear-gradient(135deg, ${renkler.primary}, ${renkler.secondary})`;
export const parlama = `0 0 60px rgba(14,116,144,.15)`;

/** Web icin CSS ozel degiskenleri uretir. */
export function cssDegiskenleri(mod: YogunlukModu = 'rahat'): string {
  const y = yogunluk[mod];
  const satirlar = [
    ...Object.entries(renkler).map(([k, v]) => `  --${kebap(k)}: ${v};`),
    ...Object.entries(aralik).map(([k, v]) => `  --${k}: ${v};`),
    `  --r: ${yaricap.r};`,
    `  --rs: ${yaricap.rs};`,
    `  --grad: ${gradyan};`,
    `  --glow: ${parlama};`,
    `  --pad: ${y.pad};`,
    `  --cardpad: ${y.cardPad};`,
    `  --rowh: ${y.satirYuksekligi};`,
    `  --fz: ${y.fontBoyutu};`,
  ];
  return `:root {\n${satirlar.join('\n')}\n}`;
}

/** Tailwind tema uzantisi. */
export const tailwindTema = {
  colors: {
    primary: renkler.primary,
    secondary: renkler.secondary,
    dark: renkler.dark,
    darker: renkler.darker,
    surface: renkler.glassBg,
    line: renkler.line,
    ok: renkler.success,
    warn: renkler.warn,
    crit: renkler.crit,
    info: renkler.info,
  },
  // Tailwind'in Config tipi degistirilebilir string[] bekler; `as const`in
  // uretecegi readonly tuple kabul edilmez. Degerler degismez, tip gevser.
  fontFamily: { sans: ['DM Sans', 'system-ui', 'sans-serif'] as string[] },
  borderRadius: { card: yaricap.r, control: yaricap.rs },
  backgroundImage: { brand: gradyan },
  boxShadow: { glow: parlama },
} as const;

/** React Native tema nesnesi — web ile AYNI kaynaktan. */
export const rnTema = {
  colors: {
    primary: renkler.primary,
    secondary: renkler.secondary,
    background: renkler.dark,
    surface: renkler.darker,
    text: renkler.text,
    textMuted: 'rgba(226,232,240,0.68)',
    success: renkler.success,
    warning: renkler.warn,
    critical: renkler.crit,
    info: renkler.info,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { card: 14, control: 10 },
  typography: { family: 'DM Sans', size: 14, lineHeight: 22 },
} as const;

function kebap(s: string): string {
  return s.replace(/[A-Z0-9]/g, (m) => `-${m.toLowerCase()}`);
}
