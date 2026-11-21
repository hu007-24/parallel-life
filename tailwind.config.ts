import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F5F3',
        ink: '#111111',
        muted: '#777777',
        silver: '#BFC3C7',
        dark: '#17191C',
        line: '#DDDDDA',
      },
      fontFamily: {
        sans: [
          'Inter',
          'SF Pro Display',
          '-apple-system',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['SF Mono', 'JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(17, 17, 17, 0.04)',
        card: '0 1px 3px rgba(17, 17, 17, 0.05), 0 8px 24px rgba(17, 17, 17, 0.04)',
        modal: '0 24px 64px rgba(17, 17, 17, 0.16)',
      },
      letterSpacing: {
        widest2: '0.2em',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config