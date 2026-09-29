import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DISPLAY_STRINGS, displayGlyphs } from '../src/lib/display-glyphs';

describe('display glyph subset', () => {
  it('lists unique non-ASCII glyphs in code point order', () => {
    const g = displayGlyphs();
    expect(new Set(g).size).toBe(g.length);
    expect(g).toContain('福');
    expect(g.every((ch) => ch.codePointAt(0)! > 0x7f)).toBe(true);
  });
  it('matches the committed subset (run `npm run fonts` after changing DISPLAY_STRINGS)', () => {
    const committed = readFileSync('public/fonts/fuyou-display-900.glyphs.txt', 'utf8').trim();
    expect(committed).toBe(displayGlyphs().join(''));
    expect(DISPLAY_STRINGS.length).toBeGreaterThan(0);
  });
});
