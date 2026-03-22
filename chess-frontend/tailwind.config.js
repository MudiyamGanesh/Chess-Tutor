/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bgLight: '#f1f5f9',
        bgDark: '#0f172a',
        surfaceLight: '#f8fafc',
        surfaceDark: '#1e293b',
        textLight: '#0f172a',
        textDark: '#f1f5f9',
        accentLight1: '#00d2ff',
        accentLight2: '#3a7bd5',
        accentDark1: '#2b0f4c',
        accentDark2: '#b53cff',
      },
      backgroundImage: {
         'gradient-light': 'linear-gradient(to right, #00d2ff, #3a7bd5)',
         'gradient-dark': 'linear-gradient(to right, #2b0f4c, #b53cff)',
      }
    },
  },
  plugins: [],
}
