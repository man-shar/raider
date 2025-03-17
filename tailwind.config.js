/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
    './node_modules/@defogdotai/agents-ui-components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'primary-text': '#2B2B2B',
        'primary-highlight': '#2B59FF',
        'secondary-highlight-1': '#6E00A2',
        'secondary-highlight-2': '#7891EE',
        'secondary-highlight-3': 'rgba(112, 0, 163, 0.2)',
        'secondary-highlight-4': 'hsla(37, 100%, 53%, 0.2)',
        dark: {
          'bg-primary': '#1a1a1a',
          'bg-secondary': '#2d2d2d',
          'text-primary': '#ffffff',
          'text-secondary': '#e0e0e0',
          border: '#404040',
          hover: '#404040'
        }
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
