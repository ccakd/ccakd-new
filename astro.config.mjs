import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ccakd.ca',
  // Astro 5 removed 'hybrid' mode. Use 'static' (default prerender) with
  // per-page `export const prerender = false` for SSR routes (Keystatic admin, /api/translate).
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), tailwind(), keystatic(), sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'zh-tw'],
    routing: 'manual',
  },
});
