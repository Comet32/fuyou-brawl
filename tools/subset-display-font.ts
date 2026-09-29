// Subset the CJK display face to the glyphs of src/lib/display-glyphs.ts.
// Source: Noto Sans SC (variable, wght 100–900) from github.com/google/fonts, ofl/notosanssc,
// SIL Open Font License 1.1. The wght axis is pinned to 900 (Black).
// Usage: npm run fonts   (downloads the source into tmp/fonts/ on first run)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import subsetFont from 'subset-font';
import { displayGlyphs } from '../src/lib/display-glyphs';

const SOURCE_URL = 'https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf';
const LICENSE_URL = 'https://github.com/google/fonts/raw/main/ofl/notosanssc/OFL.txt';
const CACHE = 'tmp/fonts/NotoSansSC-wght.ttf';
const OUT = 'public/fonts/fuyou-display-900.woff2';
const GLYPHS = 'public/fonts/fuyou-display-900.glyphs.txt';

async function download(url: string, to: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`);
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

mkdirSync('tmp/fonts', { recursive: true });
if (!existsSync(CACHE)) await download(SOURCE_URL, CACHE);
if (!existsSync('public/fonts/OFL.txt')) await download(LICENSE_URL, 'public/fonts/OFL.txt');

const glyphs = displayGlyphs().join('');
const woff2 = await subsetFont(readFileSync(CACHE), glyphs, { targetFormat: 'woff2', variationAxes: { wght: 900 } });
writeFileSync(OUT, woff2);
writeFileSync(GLYPHS, `${glyphs}\n`);
console.log(`✓ ${OUT}：${[...glyphs].length} 个字形，${woff2.length} 字节`);
