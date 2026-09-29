// Build-time paths and placeholder colors for hero portraits.
import { publicFileExists } from './assets';
import { renderHeroColors } from './render-data';

/** Average portrait color from src/data/hero-colors.yaml (tools/hero-thumbs.ts). */
export function heroColor(id: string): string | undefined {
  return renderHeroColors()[id];
}

/** Site-relative portrait paths; `thumb` is the 128px grid/chip version (falls back to full). */
export function heroPortrait(id: string): { full?: string; thumb?: string } {
  const full = `img/heroes/${id}.webp`;
  const thumb = `img/heroes/thumb/${id}.webp`;
  const hasFull = publicFileExists(full);
  return { full: hasFull ? full : undefined, thumb: publicFileExists(thumb) ? thumb : hasFull ? full : undefined };
}
