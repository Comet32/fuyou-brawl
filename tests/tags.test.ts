import { describe, expect, it } from 'vitest';
import { autoTags, TAG_COLORS, TAG_RULES, TAGS } from '../src/lib/tags';

describe('autoTags', () => {
  it('matches keywords', () => {
    expect(autoTags('获得 3500 金币')).toEqual(['经济']);
  });
  it('returns tags in TAGS order regardless of text order', () => {
    expect(autoTags('每次施法后获得金币，并提升攻击力')).toEqual(['攻击', '法术', '经济']);
  });
  it('returns [] when nothing matches', () => {
    expect(autoTags('随便一句话')).toEqual([]);
    expect(autoTags('')).toEqual([]);
  });
  it('does not duplicate a tag matched by several keywords', () => {
    expect(autoTags('攻击力和攻击速度')).toEqual(['攻击']);
  });
});

describe('tag tables', () => {
  it('has rules and colors for every tag', () => {
    for (const t of TAGS) {
      expect(TAG_RULES[t].length).toBeGreaterThan(0);
      expect(TAG_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
