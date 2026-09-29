// Runs in Node at config time: list public/img/**/*.webp so pages can check image existence without node:fs
// (Cloudflare's adapter prerenders in workerd, where the repository's files are not readable).
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function listPublicImages(root = process.cwd()) {
  const base = join(root, 'public');
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.webp')) out.push(relative(base, p).split(sep).join('/'));
    }
  };
  walk(join(base, 'img'));
  return out.sort();
}
