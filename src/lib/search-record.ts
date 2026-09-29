import { pinyin } from 'pinyin-pro';
import type { Blessing } from './schema';

export interface SearchRecord {
  id: string;
  name: string;
  category: string;
  effect: string;
  tags: string[];
  py: string;
  pyInitials: string;
}

const toKey = (parts: string[]) => parts.join('').toLowerCase().replace(/[^a-z0-9]/g, '');

export function toSearchRecord(b: Blessing): SearchRecord {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    effect: b.effect,
    tags: b.tags,
    py: toKey(pinyin(b.name, { toneType: 'none', type: 'array' })),
    pyInitials: toKey(pinyin(b.name, { pattern: 'first', toneType: 'none', type: 'array' })),
  };
}
