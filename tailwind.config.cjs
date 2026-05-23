/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Urbanist', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        midnight: '#020617',
        panel: '#09090b',
        panelAlt: '#18181b',
        accent: {
          cyan: '#22d3ee',
          indigo: '#6366f1',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 18px 48px rgba(15, 23, 42, 0.48)',
        cyanGlow: '0 0 0 1px rgba(34,211,238,0.12), 0 0 36px rgba(34,211,238,0.18)',
        indigoGlow: '0 0 0 1px rgba(99,102,241,0.12), 0 0 36px rgba(99,102,241,0.18)',
      },
    },
  },
  plugins: [],
};
