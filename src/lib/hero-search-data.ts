// Build-time side of hero-search.ts (pinyin-pro; never import on the client).
import type { HeroSearchRecord } from './hero-search';
import type { Hero } from './schema';
import { pinyinKeys } from './search-record';

export function toHeroSearchRecord(h: Pick<Hero, 'id' | 'name' | 'name_en' | 'attr'>, abilities: string[]): HeroSearchRecord {
  return { id: h.id, name: h.name, name_en: h.name_en, attr: h.attr, ...pinyinKeys(h.name), abilities };
}
