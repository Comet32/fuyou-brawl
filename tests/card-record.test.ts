import { describe, expect, it } from 'vitest';
import { toCardRecord } from '../src/lib/card-data';
import { hydrateCardRecord } from '../src/lib/card-record';
import { toSearchRecord } from '../src/lib/search-record';
import { blessings } from './fixtures';

describe('toCardRecord', () => {
  it('carries what a card needs and omits the derivable plain text', () => {
    const r = toCardRecord({ ...blessings[1], icon: '10010.webp' }, true);
    expect(r).toMatchObject({
      id: '10010',
      name: '电锤思维',
      quality: 'ssr',
      tags: ['经济', '装备'],
      icon: 'img/blessings/10010.webp',
      summary: blessings[1].summary,
      numbers: { gold: 3500 },
      pyInitials: 'dcsw',
    });
    expect(r).not.toHaveProperty('text');
  });
  it('drops the icon when the file is missing and numbers when empty', () => {
    const b = { ...blessings[0], icon: undefined, numbers: {} };
    const r = toCardRecord(b, false);
    expect(r.icon).toBeUndefined();
    expect(r.numbers).toBeUndefined();
  });

  it('carries the hero of a hero blessing', () => {
    const hero = { id: 'axe', name: '斧王', img: 'img/heroes/axe.webp' };
    expect(toCardRecord(blessings[2], false, hero).hero).toEqual(hero);
    expect(toCardRecord(blessings[2], false)).not.toHaveProperty('hero');
  });
});

describe('hydrateCardRecord', () => {
  it('restores a full search record identical to toSearchRecord', () => {
    for (const b of blessings) {
      const card = hydrateCardRecord(JSON.parse(JSON.stringify(toCardRecord(b, true))));
      const { summary, numbers, icon, hero, ...rest } = card;
      void summary;
      void numbers;
      void icon;
      void hero;
      expect(rest).toEqual(toSearchRecord(b));
    }
  });
});
