import { describe, expect, it } from 'vitest';
import { isHeroBlessing } from '../src/lib/hero-blessing';

describe('isHeroBlessing', () => {
  it('treats 6-digit ids (with an optional letter) as hero blessings', () => {
    expect(isHeroBlessing('100001')).toBe(true);
    expect(isHeroBlessing('100132a')).toBe(true);
  });
  it('treats 5-digit ids as general blessings, including the 200xx ability series', () => {
    expect(isHeroBlessing('10010')).toBe(false);
    expect(isHeroBlessing('20001')).toBe(false);
    expect(isHeroBlessing('10004a')).toBe(false);
  });
});
