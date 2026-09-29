import { defineConfig } from 'astro/config';

// GitHub Pages serves under /fuyou-brawl/; Cloudflare Pages serves at root.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://fuyou-brawl.pages.dev',
  base: process.env.SITE_BASE ?? '/',
  trailingSlash: 'always',
});
