import { describe, expect, it } from 'vitest';
import { heroImageUrl, itemImageUrl, mapHeroFeed, mapItemFeed } from '../src/lib/dota-feed';

const heroFeed = {
  result: {
    data: {
      heroes: [
        { id: 2, name: 'npc_dota_hero_axe', name_loc: '斧王', name_english_loc: 'Axe', primary_attr: 0 },
        { id: 1, name: 'npc_dota_hero_antimage', name_loc: '敌法师', name_english_loc: 'Anti-Mage', primary_attr: 1 },
        { id: 5, name: 'npc_dota_hero_crystal_maiden', name_loc: '水晶室女', name_english_loc: 'Crystal Maiden', primary_attr: 2 },
        { id: 3, name: 'npc_dota_hero_bane', name_loc: '祸乱之源', name_english_loc: 'Bane', primary_attr: 3 },
      ],
    },
  },
};

const itemFeed = {
  result: {
    data: {
      itemabilities: [
        { id: 1, name: 'item_blink', name_loc: '闪烁匕首', name_english_loc: 'Blink Dagger' },
        { id: 2, name: 'item_recipe_blink', name_loc: '卷轴', name_english_loc: 'Recipe' },
        { id: 3, name: 'item_unused', name_loc: '', name_english_loc: '' },
      ],
    },
  },
};

describe('mapHeroFeed', () => {
  it('strips prefix, maps attributes, sorts by id', () => {
    expect(mapHeroFeed(heroFeed)).toEqual([
      { id: 'antimage', name: '敌法师', name_en: 'Anti-Mage', attr: 'agi' },
      { id: 'axe', name: '斧王', name_en: 'Axe', attr: 'str' },
      { id: 'bane', name: '祸乱之源', name_en: 'Bane', attr: 'all' },
      { id: 'crystal_maiden', name: '水晶室女', name_en: 'Crystal Maiden', attr: 'int' },
    ]);
  });
  it('throws on unknown attribute', () => {
    const bad = structuredClone(heroFeed);
    bad.result.data.heroes[0].primary_attr = 9;
    expect(() => mapHeroFeed(bad)).toThrow(/primary_attr 9/);
  });
});

describe('mapItemFeed', () => {
  it('drops recipes and unnamed items', () => {
    expect(mapItemFeed(itemFeed)).toEqual([{ id: 'blink', name: '闪烁匕首', name_en: 'Blink Dagger' }]);
  });
});

describe('image urls', () => {
  it('points at the dota_react CDN paths', () => {
    expect(heroImageUrl('axe')).toBe('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png');
    expect(itemImageUrl('blink')).toBe('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/blink.png');
  });
});
