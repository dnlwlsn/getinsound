/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html'],
  safelist: [
    // Dynamic gradient classes used in JS template strings (discography, library, explore)
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
    extend: {},
  },
  plugins: [],
}
