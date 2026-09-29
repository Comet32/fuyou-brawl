import { describe, expect, it } from 'vitest';
import { heroImageUrl, itemImageUrl, mapAbilityFeed, mapHeroFeed, mapItemFeed } from '../src/lib/dota-feed';

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

const ab = (name: string, name_loc: string, name_english_loc = name) => ({ id: 1, name, name_loc, name_english_loc });

const abilityFeed = {
  result: {
    data: {
      itemabilities: [
        ab('nevermore_shadowraze2', '毁灭阴影', 'Shadowraze'),
        ab('nevermore_shadowraze1', '毁灭阴影', 'Shadowraze'),
        ab('nevermore_necromastery', '死亡窃取', 'Necromastery'),
        ab('nevermore_shadowraze3', '毁灭阴影', 'Shadowraze'),
        ab('antimage_mana_break', '法力损毁', 'Mana Break'),
        ab('shadow_shaman_ether_shock', '以太震击', 'Ether Shock'),
        ab('shadow_shaman_shackles', '束缚之术', 'Shackles'),
        ab('shadow_demon_disruption', '崩裂禁锢', 'Disruption'),
        ab('shadow_cloak', '不属于英雄', 'Not a hero ability'),
        ab('antimage_empty1', '空技能位', 'Empty'),
        ab('antimage_hidden_blink', '隐藏技能', 'Hidden'),
        ab('antimage_unnamed', '', ''),
        ab('special_bonus_attack_speed_20', '+20 攻击速度'),
        ab('generic_hidden', '隐藏'),
        ab('ability_capture', '占领'),
        ab('plus_high_five', '击掌'),
        ab('item_blink', '闪烁匕首', 'Blink Dagger'),
      ],
    },
  },
};

describe('mapAbilityFeed', () => {
  const heroIds = ['nevermore', 'antimage', 'shadow_shaman', 'shadow_demon', 'shadow', 'axe'];
  const out = mapAbilityFeed(abilityFeed, heroIds);
  const of = (hero: string) => out.find((h) => h.hero === hero)?.abilities;

  it('assigns each ability to the hero with the longest matching id prefix', () => {
    expect(of('shadow_shaman')).toEqual([
      { id: 'shadow_shaman_ether_shock', name: '以太震击', name_en: 'Ether Shock' },
      { id: 'shadow_shaman_shackles', name: '束缚之术', name_en: 'Shackles' },
    ]);
    expect(of('shadow_demon')?.map((a) => a.id)).toEqual(['shadow_demon_disruption']);
    // "shadow_cloak" only matches the bare "shadow" prefix when followed by "_": it does, so it belongs to "shadow".
    expect(of('shadow')?.map((a) => a.id)).toEqual(['shadow_cloak']);
  });

  it('dedupes abilities by localized name per hero, keeping the first in feed order', () => {
    expect(of('nevermore')).toEqual([
      { id: 'nevermore_shadowraze2', name: '毁灭阴影', name_en: 'Shadowraze' },
      { id: 'nevermore_necromastery', name: '死亡窃取', name_en: 'Necromastery' },
    ]);
  });

  it('drops unnamed, empty, hidden, special_bonus, generic and non-hero abilities', () => {
    expect(of('antimage')).toEqual([{ id: 'antimage_mana_break', name: '法力损毁', name_en: 'Mana Break' }]);
    const all = out.flatMap((h) => h.abilities.map((a) => a.id));
    for (const bad of ['special_bonus_attack_speed_20', 'generic_hidden', 'ability_capture', 'plus_high_five', 'item_blink'])
      expect(all).not.toContain(bad);
  });

  it('omits heroes without abilities and sorts heroes by id', () => {
    expect(of('axe')).toBeUndefined();
    expect(out.map((h) => h.hero)).toEqual(['antimage', 'nevermore', 'shadow', 'shadow_demon', 'shadow_shaman']);
  });

  it('falls back to the localized name when the English name is missing', () => {
    const feed = { result: { data: { itemabilities: [ab('axe_berserkers_call', '狂战士之吼', '')] } } };
    expect(mapAbilityFeed(feed, ['axe'])[0].abilities[0].name_en).toBe('狂战士之吼');
  });
});
