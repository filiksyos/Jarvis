/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js}',
    './*.html'
  ],
  theme: {
    extend: {
      colors: {
        'jarvis-blue': '#3b82f6',
        'jarvis-teal': '#14b8a6',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
