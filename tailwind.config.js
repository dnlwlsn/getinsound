/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  safelist: [
    'from-orange-600', 'to-teal-700',
    'from-blue-500', 'to-indigo-700',
    'from-purple-600', 'to-zinc-800',
    'from-orange-500', 'to-red-700',
    'from-amber-500', 'to-orange-700',
    'from-pink-500', 'to-rose-700',
    'from-violet-500', 'to-purple-700',
    'bg-gradient-to-br',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        display: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
      colors: {
        insound: {
          bg: '#09090b',
          orange: '#F56D00',
        },
        orange: {
          600: '#F56D00',
        },
      },
    },
  },
  plugins: [],
}
