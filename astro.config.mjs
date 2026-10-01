import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Tailwind is wired via postcss.config.mjs, not @astrojs/tailwind — that package never
  // went past Astro 5 support and blocked this project's Astro 7 upgrade.
  integrations: [sitemap()],
  site: 'https://shop.faithfuljourneysolar.com',
  // 'hybrid' was merged into 'static' as of Astro 5 — same behavior (prerendered by
  // default, per-page `export const prerender = false` opts a page into SSR).
  output: 'static',
  adapter: vercel(),
});
