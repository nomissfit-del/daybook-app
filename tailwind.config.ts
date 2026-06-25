import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FDF6E9',
        border: '#E8DCC8',
        ink: '#2A2118',
        muted: '#8C7B6A',
        personal: {
          DEFAULT: '#B85C38',
          light: '#F5E6DF',
          dark: '#8C3E1F',
        },
        work: {
          DEFAULT: '#1B3A6B',
          light: '#DDE6F2',
          dark: '#112548',
        },
        heatmap: {
          empty: '#EDE4D3',
          complete: '#4A7C59',
          missed: '#C0392B',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        sm: '3px',
      },
    },
  },
  plugins: [],
}

export default config
