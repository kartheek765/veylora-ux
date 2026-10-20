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
        background: '#0B0F17',
        surface: {
          DEFAULT: '#111722',
          primary: '#0B0F17',
          secondary: '#111722',
          tertiary: '#18212F',
          subtle: '#0E141D',
          hover: '#18212F',
          active: '#1E293B',
          sidebar: '#070A0F',
          card: '#121926',
        },
        border: {
          DEFAULT: '#1E293B',
          light: '#2E3D52',
          focus: '#6366F1',
        },
        accent: {
          DEFAULT: '#6366F1', // Indigo electric
          hover: '#4F46E5',
          light: '#818CF8',
          glow: 'rgba(99, 102, 241, 0.15)',
        },
        teal: {
          DEFAULT: '#14B8A6',
          dark: '#0F766E',
          light: '#2DD4BF',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
          inverted: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
        'elevated': '0 4px 12px -2px rgba(0, 0, 0, 0.6), 0 2px 6px -2px rgba(0, 0, 0, 0.5)',
        'glow-accent': '0 0 20px -3px rgba(99, 102, 241, 0.25)',
      },
    },
  },
  plugins: [],
}
