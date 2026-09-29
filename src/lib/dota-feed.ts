import { ATTRS, type Hero, type Item } from './schema';

interface HeroFeed {
  result: { data: { heroes: { name: string; name_loc: string; name_english_loc: string; primary_attr: number }[] } };
}
interface AbilityRow {
  name: string;
  name_loc: string;
  name_english_loc: string;
}
// The itemlist and abilitylist endpoints share this shape.
interface ItemFeed {
  result: { data: { itemabilities: AbilityRow[] } };
}

export interface HeroAbility {
  id: string;
  name: string;
  name_en: string;
}
export interface HeroAbilities {
  hero: string;
  abilities: HeroAbility[];
}

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react';
const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

export function mapHeroFeed(feed: HeroFeed): Hero[] {
  return feed.result.data.heroes
    .map((h) => {
      const attr = ATTRS[h.primary_attr];
      if (!attr) throw new Error(`unknown primary_attr ${h.primary_attr} for ${h.name}`);
      return { id: h.name.replace(/^npc_dota_hero_/, ''), name: h.name_loc, name_en: h.name_english_loc, attr };
    })
    .sort(byId);
}

export function mapItemFeed(feed: ItemFeed): Item[] {
  return feed.result.data.itemabilities
    .filter((i) => i.name.startsWith('item_') && !i.name.startsWith('item_recipe_') && i.name_loc.trim() !== '')
    .map((i) => ({ id: i.name.replace(/^item_/, ''), name: i.name_loc, name_en: i.name_english_loc || i.name_loc }))
    .sort(byId);
}

// Talents, generic/shared abilities and placeholder or hidden slots are not real hero abilities.
const NON_ABILITY_RE = /^(special_bonus_|generic_)|_empty|hidden/;

/**
 * Group the ability list by hero. An ability belongs to the hero whose id is the longest prefix of its
 * internal name followed by "_" (so "shadow_shaman_shackles" never goes to a hero called "shadow").
 * Abilities with the same localized name (e.g. the three shadowrazes) are kept once, first in feed order.
 * Heroes without abilities are omitted; the result is sorted by hero id.
 */
export function mapAbilityFeed(feed: ItemFeed, heroIds: string[]): HeroAbilities[] {
  const byLength = [...heroIds].sort((a, b) => b.length - a.length);
  const groups = new Map<string, { abilities: HeroAbility[]; names: Set<string> }>();

  for (const a of feed.result.data.itemabilities) {
    const name = a.name_loc.trim();
    if (!name || NON_ABILITY_RE.test(a.name)) continue;
    const hero = byLength.find((id) => a.name.startsWith(`${id}_`));
    if (!hero) continue;
    let group = groups.get(hero);
    if (!group) groups.set(hero, (group = { abilities: [], names: new Set() }));
    if (group.names.has(name)) continue;
    group.names.add(name);
    group.abilities.push({ id: a.name, name, name_en: a.name_english_loc.trim() || name });
  }

  return [...groups]
    .map(([hero, { abilities }]) => ({ hero, abilities }))
    .sort((a, b) => a.hero.localeCompare(b.hero));
}

export const heroImageUrl = (id: string) => `${CDN}/heroes/${id}.png`;
export const itemImageUrl = (id: string) => `${CDN}/items/${id}.png`;
