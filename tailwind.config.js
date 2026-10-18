import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
const ch = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'print': { 'raw': 'print' },
        'coarse': { 'raw': '(pointer: coarse)' },
      },
      fontFamily: {
        ui: ['"Instrument Sans Variable"', ...defaultTheme.fontFamily.sans],
        display: ['"Bricolage Grotesque Variable"', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        meta: ['12px', { lineHeight: '16px' }],
        body: ['14px', { lineHeight: '20px' }],
        lead: ['16px', { lineHeight: '24px' }],
        title: ['20px', { lineHeight: '28px' }],
        headline: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
        score: ['48px', { lineHeight: '52px' }],
      },
      borderRadius: {
        card: '14px',
        sheet: '20px',
      },
      boxShadow: {
        '2xs': '0 1px 0 rgb(var(--slate-900) / .04)',
        xs: '0 1px 2px rgb(var(--slate-900) / .06)',
        raised: '0 1px 2px rgb(var(--slate-900) / .06), 0 6px 16px -6px rgb(var(--accent-700) / .18)',
        overlay: '0 24px 60px -20px rgb(var(--slate-950) / .45)',
      },
      colors: {
        white: ch('c-white'),                       // superfície (cartões, modais, campos)
        page: ch('c-page'),                         // fundo da página
        'on-accent': '#ffffff',                     // texto sobre botões coloridos (nunca muda)
        slate: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, ch(`slate-${n}`)])
        ),
        indigo: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, ch(`accent-${n}`)])
        ),
      },
    },
  },
  plugins: [
    plugin(function({ addBase }) {
      addBase({
        '.paper, .a4-sheet': {
          fontFamily: defaultTheme.fontFamily.sans.join(', '),
          fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
        },
      });
    }),
  ],
};
