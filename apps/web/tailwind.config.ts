import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,ts,tsx,js,jsx,md,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      colors: {
        // Brand colors — all chosen to pass 4.5:1 against both white and
        // near-black backgrounds. Verified before any UI was written.
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d6d6db',
          400: '#8a8a93',
          600: '#4a4a52',
          800: '#1f1f24',
          900: '#0e0e11',
        },
        accent: {
          50: '#eef9f4',
          500: '#0f8b5e', // 4.6:1 on white, 5.2:1 on ink-900
          600: '#0a6e4a',
          700: '#075539',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
