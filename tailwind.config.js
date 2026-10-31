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
        zen: {
          950: '#07090e',
          900: '#0c1017',
          850: '#111722',
          800: '#161f2e',
          700: '#222f44',
          600: '#324461',
          500: '#48628a',
          400: '#6d8cb8',
          300: '#9db4d4',
          200: '#c8d6e9',
          100: '#e7eef7',
        },
        verdict: {
          ac: '#10b981',
          wa: '#ef4444',
          tle: '#f59e0b',
          mle: '#8b5cf6',
          rte: '#ec4899',
          ce: '#f97316',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
