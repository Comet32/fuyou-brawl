import { ATTRS, type Hero, type Item } from './schema';

interface HeroFeed {
  result: { data: { heroes: { name: string; name_loc: string; name_english_loc: string; primary_attr: number }[] } };
}
interface ItemFeed {
  result: { data: { itemabilities: { name: string; name_loc: string; name_english_loc: string }[] } };
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

export const heroImageUrl = (id: string) => `${CDN}/heroes/${id}.png`;
export const itemImageUrl = (id: string) => `${CDN}/items/${id}.png`;
