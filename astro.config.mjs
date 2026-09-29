import { defineConfig } from 'astro/config';
import { listPublicImages } from './config/public-images.mjs';

// GitHub Pages serves under /fuyou-brawl/; Cloudflare serves at root.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://fuyou-brawl.pages.dev',
  base: process.env.SITE_BASE ?? '/',
  trailingSlash: 'always',
  vite: {
    // Image manifest for build-time existence checks in any prerender runtime (see src/lib/assets.ts).
    define: { __PUBLIC_IMAGES__: JSON.stringify(listPublicImages()) },
  },
});
