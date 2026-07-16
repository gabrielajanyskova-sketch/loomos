/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './obchod.html', './produkty/*.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: '#121212',
        gold: '#C5A059',
        bronze: '#B8860B',
        ink: '#EAEAEA',
        muted: '#2C2C2C',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        display: ['"Cormorant Garamond"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 30px -5px rgba(197,160,89,0.35)',
      },
    },
  },
  plugins: [],
};
