import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#EBEDE3',
        paper: '#F6F7EF',
        ink: '#2B3328',
        'ink-muted': '#767E70',
        line: '#CBC6AC',
        personal: '#A8492F',
        work: '#2F4858',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
