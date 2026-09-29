import { describe, expect, it } from 'vitest';
import { blessingsForHero, heroesForBlessing } from '../src/lib/hero-blessings';
import { blessings, builds } from './fixtures';

describe('blessingsForHero', () => {
  it('lists build blessings in order with notes, then exclusive ones', () => {
    const out = blessingsForHero('axe', blessings, builds[0].data);
    expect(out.map((r) => [r.blessing.id, r.reason, r.note])).toEqual([
      ['electric-hammer', 'build', '前期经济'],
      ['wolf-core', 'build', undefined],
      ['rescue', 'exclusive', undefined],
    ]);
  });
  it('works without a build', () => {
    expect(blessingsForHero('antimage', blessings, undefined)).toEqual([]);
  });
});

describe('heroesForBlessing', () => {
  it('finds heroes whose build recommends the blessing', () => {
    expect(heroesForBlessing('wolf-core', builds.map((b) => b.data))).toEqual(['axe']);
    expect(heroesForBlessing('rescue', builds.map((b) => b.data))).toEqual([]);
  });
});
