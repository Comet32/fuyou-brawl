// Build-time side of card-record.ts (uses pinyin-pro through toSearchRecord; never import on the client).
import type { CardRecord } from './card-record';
import type { Blessing } from './schema';
import { toSearchRecord } from './search-record';

export function toCardRecord(b: Blessing, iconExists: boolean): CardRecord {
  const { text: _text, ...search } = toSearchRecord(b);
  const record: CardRecord = { ...search, summary: b.summary };
  if (b.icon && iconExists) record.icon = `img/blessings/${b.icon}`;
  if (Object.keys(b.numbers).length > 0) record.numbers = b.numbers;
  return record;
}
