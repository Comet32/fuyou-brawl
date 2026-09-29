import { pinyin } from 'pinyin-pro';
import type { QualityId } from './quality';
import type { Blessing } from './schema';
import { toPlainText } from './template';

export interface SearchRecord {
  id: string;
  name: string;
  name_en: string;
  quality: QualityId | null;
  tags: string[];
  /** Plain-text summary; unknown values show as "?" (numbers are not needed for search). */
  text: string;
  py: string;
  pyInitials: string;
}

const toKey = (parts: string[]) => parts.join('').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Full pinyin and initials of a Chinese name (no tones, ü as v, ASCII letters and digits only). */
export function pinyinKeys(name: string): { py: string; pyInitials: string } {
  return {
    py: toKey(pinyin(name, { toneType: 'none', type: 'array', v: true })),
    pyInitials: toKey(pinyin(name, { pattern: 'first', toneType: 'none', type: 'array', v: true })),
  };
}

export function toSearchRecord(b: Blessing): SearchRecord {
  return {
    id: b.id,
    name: b.name,
    name_en: b.name_en,
    quality: b.quality,
    tags: b.tags,
    text: toPlainText(b.summary),
    ...pinyinKeys(b.name),
  };
}
