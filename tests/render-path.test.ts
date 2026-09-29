// Guards the page render path against filesystem access. Cloudflare's Astro adapter prerenders pages
// inside workerd, where repository files cannot be read: node:fs calls throw or report "missing", so a
// single page reaching for the disk breaks every Cloudflare build (see commit 8d9a700). Pages must get
// data through Vite imports (src/lib/render-data.ts `?raw`, src/lib/assets.ts define'd manifest).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOT_DIRS = ['src/pages', 'src/components', 'src/layouts'];
const CODE_EXT = /\.(astro|ts|mts|js|mjs)$/;

// Content-layer / script-only modules. blessings.ts and sources.ts also export pure helpers that render
// code may import (they reach the disk only through data-file.ts, never called by render code), so
// they are neither scanned nor followed.
const EXEMPT = new Set(['src/content.config.ts', 'src/lib/load.ts', 'src/lib/data-file.ts', 'src/lib/blessings.ts', 'src/lib/sources.ts']);
// Disk readers: importing them from render code at all is the regression.
const FORBIDDEN_IMPORTS = new Set(['src/lib/load.ts', 'src/lib/data-file.ts']);

const FORBIDDEN_CODE: [RegExp, string][] = [
  [/['"]node:fs(\/promises)?['"]/, "imports 'node:fs'"],
  [/from\s*['"]fs(\/promises)?['"]/, "imports 'fs'"],
  [/\breadFileSync\b/, 'calls readFileSync'],
  [/\bexistsSync\b/, 'calls existsSync'],
  [/\bprocess\.cwd\(/, 'calls process.cwd()'],
];

/** Drop comments so explanatory notes ("no node:fs here") do not trip the check. */
function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\\w])\/\/.*$/gm, '$1');
}

function importSpecifiers(src: string): string[] {
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  return [...src.matchAll(re)].map((m) => m[1]);
}

function violations(src: string): string[] {
  const code = stripComments(src);
  return FORBIDDEN_CODE.filter(([re]) => re.test(code)).map(([, why]) => why);
}

const rel = (abs: string) => relative(ROOT, abs).split('\\').join('/');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? walk(abs) : CODE_EXT.test(name) ? [abs] : [];
  });
}

function resolveImport(from: string, spec: string): string | undefined {
  if (!spec.startsWith('.')) return undefined; // packages and virtual modules (astro:content)
  const base = resolve(dirname(from), spec.replace(/\?.*$/, ''));
  if (/\.[a-z]+$/.test(base) && !CODE_EXT.test(base)) return undefined; // bundled data (`?raw` yaml, css)
  const candidates = [base, `${base}.ts`, `${base}.astro`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
}

/** Every file a page can pull in at render time, with the edge that brought it in. */
function renderPath(): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = ROOT_DIRS.flatMap((d) => walk(join(ROOT, d)));
  for (const file of queue) seen.set(rel(file), 'page/component/layout');
  while (queue.length) {
    const file = queue.shift()!;
    for (const spec of importSpecifiers(stripComments(readFileSync(file, 'utf8')))) {
      const target = resolveImport(file, spec);
      if (!target || seen.has(rel(target))) continue;
      seen.set(rel(target), `imported by ${rel(file)}`);
      if (!EXEMPT.has(rel(target))) queue.push(target);
    }
  }
  return seen;
}

describe('render-path scanner', () => {
  it('flags fs access but ignores comments', () => {
    expect(violations("import { readFileSync } from 'node:fs';")).toContain("imports 'node:fs'");
    expect(violations("import fs from 'fs';\nfs.existsSync(p)")).toEqual(["imports 'fs'", 'calls existsSync']);
    expect(violations('const r = process.cwd();')).toEqual(['calls process.cwd()']);
    expect(violations('// No node:fs here: existsSync reports false\nconst u = "http://x";')).toEqual([]);
  });

  it('collects static, dynamic and re-export specifiers', () => {
    expect(importSpecifiers("import a from './a';\nexport { b } from '../b';\nawait import('./c');\nimport './d.css';")).toEqual([
      './a',
      '../b',
      './c',
      './d.css',
    ]);
  });
});

describe('page render path (Cloudflare workerd has no filesystem)', () => {
  const files = renderPath();

  it('reaches pages, shared lib modules and the bundled data layer', () => {
    expect(files.has('src/pages/heroes/[id].astro')).toBe(true);
    expect(files.has('src/lib/render-data.ts')).toBe(true);
    expect(files.has('src/lib/assets.ts')).toBe(true);
  });

  it('never imports the disk loaders load.ts / data-file.ts', () => {
    const bad = [...files].filter(([file]) => FORBIDDEN_IMPORTS.has(file));
    const message = bad
      .map(([file, via]) => `${file} (${via}) reads the repository with node:fs — Cloudflare prerenders pages in workerd, where that fails; use src/lib/render-data.ts instead`)
      .join('\n');
    expect(bad.map(([file]) => file), message).toEqual([]);
  });

  it('contains no node:fs / readFileSync / existsSync / process.cwd()', () => {
    const problems: string[] = [];
    for (const [file, via] of files) {
      if (EXEMPT.has(file)) continue;
      const found = violations(readFileSync(join(ROOT, file), 'utf8'));
      if (found.length) problems.push(`${file} (${via}) ${found.join(', ')}`);
    }
    const message =
      'Page render path touches the filesystem. Cloudflare\'s Astro adapter prerenders pages in workerd, where repository files ' +
      'cannot be read, so this silently breaks every Cloudflare build. Bundle data with a Vite `?raw` import (src/lib/render-data.ts) ' +
      'or the define\'d image manifest (src/lib/assets.ts) instead:\n' +
      problems.join('\n');
    expect(problems, message).toEqual([]);
  });
});
