import { describe, expect, it } from 'vitest';
import { blessingsForHero, blessingsRecommendedForHero, heroesForBlessing } from '../src/lib/hero-blessings';
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

describe('blessingsRecommendedForHero', () => {
  const G1 = 'http://122.51.0.76:8081/icons/guides/1.png';
  const BILI = 'https://www.bilibili.com/video/BV1feAHzJEGH/';
  const withRecs = () => {
    const list = structuredClone(blessings);
    list[0].recommended_heroes = [{ hero: 'axe', source: BILI }];
    list[1].recommended_heroes = [
      { hero: 'antimage', source: G1 },
      { hero: 'axe', source: G1 },
    ];
    list[2].recommended_heroes = [{ hero: 'axe', source: G1 }];
    return list;
  };

  it('inverts community recommendations, best quality first, with each source', () => {
    const out = blessingsRecommendedForHero('axe', withRecs());
    // 10010 is ssr, 10091 is r, 10145 has no quality.
    expect(out.map((r) => [r.blessing.id, r.sources])).toEqual([
      ['10010', [G1]],
      ['10091', [G1]],
      ['10145', [BILI]],
    ]);
  });

  it('returns nothing for a hero without recommendations', () => {
    expect(blessingsRecommendedForHero('pudge', withRecs())).toEqual([]);
  });
});
