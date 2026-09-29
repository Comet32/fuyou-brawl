// Files under public/img, injected at build time by astro.config.mjs (Vite `define`). No node:fs here:
// Cloudflare's adapter prerenders pages in workerd, where existsSync always reports false.
declare const __PUBLIC_IMAGES__: readonly string[];

const images = new Set(__PUBLIC_IMAGES__);

// Build-time check so pages can fall back when an image has not been fetched yet.
export const publicFileExists = (rel: string): boolean => images.has(rel.replace(/^\/+/, ''));
