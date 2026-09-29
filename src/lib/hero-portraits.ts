// Build-time paths and placeholder colors for hero portraits.
import { publicFileExists } from './assets';
import { parseWith, readYaml } from './data-file';
import { heroColorsSchema } from './schema';

let colors: Record<string, string> | undefined;

/** Average portrait color from src/data/hero-colors.yaml (tools/hero-thumbs.ts). */
export function heroColor(id: string): string | undefined {
  colors ??= parseWith(heroColorsSchema, readYaml(process.cwd(), 'src/data/hero-colors.yaml', {}, { optional: true }), 'hero-colors.yaml');
  return colors[id];
}

/** Site-relative portrait paths; `thumb` is the 128px grid/chip version (falls back to full). */
export function heroPortrait(id: string): { full?: string; thumb?: string } {
  const full = `img/heroes/${id}.webp`;
  const thumb = `img/heroes/thumb/${id}.webp`;
  const hasFull = publicFileExists(full);
  return { full: hasFull ? full : undefined, thumb: publicFileExists(thumb) ? thumb : hasFull ? full : undefined };
}
