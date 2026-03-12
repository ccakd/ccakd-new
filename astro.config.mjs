import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import keystatic from '@keystatic/astro';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ccakd.ca',
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), tailwind(), keystatic(), sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'zh-tw'],
    routing: 'manual',
  },
});
