/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Google Finance Dark Theme
        'gf-bg': '#202124',
        'gf-surface': '#303134',
        'gf-surface-hover': '#3c4043',
        'gf-border': '#5f6368',
        'gf-green': '#00C853',
        'gf-green-dim': 'rgba(0, 200, 83, 0.1)',
        'gf-red': '#F44336',
        'gf-red-dim': 'rgba(244, 67, 54, 0.1)',
        'gf-blue': '#8AB4F8',
        'gf-text': '#E8EAED',
        'gf-text-secondary': '#9AA0A6',
        'gf-text-muted': '#5f6368',
      },
      fontFamily: {
        'google-sans': ['"Google Sans"', 'Roboto', 'Arial', 'sans-serif'],
        'roboto': ['Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
