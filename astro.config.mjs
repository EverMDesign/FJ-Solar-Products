import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [tailwind(), sitemap()],
  site: 'https://shop.faithfuljourneysolar.com',
  output: 'hybrid',
  adapter: vercel(),
});
