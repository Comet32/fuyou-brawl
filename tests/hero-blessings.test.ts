import { describe, expect, it } from 'vitest';
import { blessingsForHero, heroesForBlessing } from '../src/lib/hero-blessings';
import { blessings, builds } from './fixtures';

describe('blessingsForHero', () => {
  it('lists build blessings in order with notes, then exclusive ones', () => {
    const out = blessingsForHero('axe', blessings, builds[0].data);
    expect(out.map((r) => [r.blessing.id, r.reason, r.note])).toEqual([
      ['10010', 'build', '前期经济'],
      ['10145', 'build', undefined],
      ['10091', 'exclusive', undefined],
    ]);
  });
  it('works without a build', () => {
    expect(blessingsForHero('antimage', blessings, undefined)).toEqual([]);
  });
});

describe('heroesForBlessing', () => {
  it('finds heroes whose build recommends the blessing', () => {
    expect(heroesForBlessing('10145', builds.map((b) => b.data))).toEqual(['axe']);
    expect(heroesForBlessing('10091', builds.map((b) => b.data))).toEqual([]);
  });
});
