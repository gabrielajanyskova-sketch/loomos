/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './obchod.html', './kosik.html', './produkty/*.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        'gold-hover': 'rgb(var(--c-gold-hover) / <alpha-value>)',
        'on-gold': 'rgb(var(--c-on-gold) / <alpha-value>)',
        // Legacy alias kept so existing bg-muted usages keep working.
        muted: 'rgb(var(--c-surface) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        display: ['"Cormorant Garamond"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 30px -5px rgb(var(--c-gold) / 0.35)',
      },
    },
  },
  plugins: [],
};
