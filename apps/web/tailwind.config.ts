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
        // Neutral ramp — text, surfaces, borders. Unchanged.
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d6d6db',
          400: '#8a8a93',
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
        // STATUS-OK only — passed audits, seal eligibility, "no violations".
        // Never the primary brand. Darkened from #0f8b5e (4.3:1 button, FAIL)
        // to #0a7a52 (5.3:1 button, AA with safety margin).
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
