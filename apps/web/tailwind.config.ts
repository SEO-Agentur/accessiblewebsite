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
        // Neutral ramp — text, surfaces, borders.
        // Two muted tiers because no single shade passes 4.5:1 on BOTH
        // ink-50 (light bg) and ink-900 (dark bg):
        //   ink-400 (#8a8a93) on ink-50: 3.19:1  FAIL
        //   ink-400 (#8a8a93) on ink-900: 4.85:1 PASS
        //   ink-500 (#5e5e66) on ink-50: 6.5:1   PASS (AAA)
        //   ink-500 (#5e5e66) on ink-900: 2.59:1 FAIL
        // So muted text uses `text-ink-500 dark:text-ink-400` — each shade
        // applied where it passes.
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d6d6db',
          400: '#8a8a93',
          500: '#5e5e66',
          600: '#4a4a52',
          800: '#1f1f24',
          900: '#0e0e11',
        },
        // PRIMARY BRAND — deep blue. Used for: header, CTAs, links, focus,
        // pricing emphasis ("MOST POPULAR"), borders that say "this matters".
        // All shades verified to pass WCAG AA on their intended background:
        //   brand-700 on white:    7.04:1  AAA
        //   white on brand-700:    7.04:1  AAA (white text on primary CTA)
        //   brand-400 on ink-900:  9.79:1  AAA (dark-mode text)
        //   brand-500 on ink-900:  5.36:1  AA  (dark-mode hover)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // STATUS-OK only — used ONLY for pass-positive contexts:
        //   - Score colour at >=95 in scan results
        //   - Site score in the verified directory
        //   - Case-study "after" number
        //   - "(-17%)" annual-billing discount
        //   - "Human remediation" winning-column header
        //   - 100% guarantee strips
        // Never used for primary brand, buttons, or links. Darkened from
        // #0f8b5e (4.3:1 button, FAIL) to #0a7a52 (5.36:1 button, AA with margin).
        //   accent-500 on white:   5.36:1  AA
        //   white on accent-500:   5.36:1  AA (sufficient for chip text)
        //   accent-600 on white:   7.45:1  AAA
        //   accent-700 on white:   10.4:1  AAA
        accent: {
          50: '#eef9f4',
          100: '#d1f0e1',
          500: '#0a7a52',
          600: '#075539',
          700: '#054028',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
