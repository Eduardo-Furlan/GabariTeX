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
      },
      colors: {
        white: ch('c-white'),                       // superfície (cartões, modais, campos)
        page: ch('c-page'),                         // fundo da página
        'on-accent': '#ffffff',                     // texto sobre botões coloridos (nunca muda)
        slate: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, ch(`slate-${n}`)])
        ),
      },
    },
  },
  plugins: [],
};
