/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Linear-style dark theme (app shell, windows, hierarchy)
        'linear-bg': '#0D0D0D',
        'linear-canvas': '#111111',
        'linear-surface': '#1A1A1A',
        'linear-surface-hover': '#1E1E1E',
        'linear-surface-active': '#252525',
        'linear-border': '#2C2C2C',
        'linear-border-subtle': 'rgba(255,255,255,0.06)',
        'linear-text': '#FFFFFF',
        'linear-text-secondary': '#A0A0A0',
        'linear-text-muted': '#6B6B6B',
        'linear-accent': '#10B981',
        'linear-accent-dim': 'rgba(16,185,129,0.12)',
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
        'linear': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'linear-xs': ['12px', { lineHeight: '1.4' }],
        'linear-sm': ['13px', { lineHeight: '1.45' }],
        'linear-base': ['14px', { lineHeight: '1.5' }],
        'linear-lg': ['16px', { lineHeight: '1.4' }],
        'linear-xl': ['18px', { lineHeight: '1.35' }],
      },
      boxShadow: {
        'linear-window': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.35)',
        'linear-panel': '0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4)',
      },
      transitionDuration: {
        'linear': '150ms',
        'linear-slow': '200ms',
      },
    },
  },
  plugins: [],
}
