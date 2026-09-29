export function joinBase(base: string, path: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return b + path.replace(/^\/+/, '');
}

// Prefix a site-absolute path with the configured Astro base.
export const url = (path: string): string => joinBase(import.meta.env.BASE_URL, path);
