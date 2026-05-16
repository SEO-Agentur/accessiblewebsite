import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';

// Host header determines locale at runtime, so we can't hard-code `site`.
// We use the EN domain as canonical default; per-page hreflang tags are
// generated in the Base layout from the routes table.
// Astro 5: `output: 'static'` is the default and supports per-page SSR via
// `export const prerender = false`. Marketing/directory pages stay static;
// the catch-all routes (scan results, dashboard, API) opt into SSR.
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [preact({ compat: false }), tailwind({ applyBaseStyles: false })],
  server: { host: '127.0.0.1', port: 4100 },
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    ssr: {
      noExternal: ['@accessiblewebsite/db', '@accessiblewebsite/shared'],
    },
    server: {
      // Dev-only: allow the two real domains as Host headers so we can test
      // locale routing by sending Host: accessiblewebsite.net / .de from curl
      // or via /etc/hosts. Production traffic enters via Caddy, which sets
      // the real Host header anyway.
      allowedHosts: [
        'accessiblewebsite.net',
        'www.accessiblewebsite.net',
        'barrierefreiewebseite.net',
        'www.barrierefreiewebseite.net',
      ],
    },
  },
});
