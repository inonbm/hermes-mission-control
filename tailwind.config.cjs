/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 12px 30px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
};
