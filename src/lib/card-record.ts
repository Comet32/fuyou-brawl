// Client-safe card data: what the compare board and label page need to draw a blessing
// without server-rendered markup. Kept free of pinyin-pro so it can ship to the browser.
import type { SearchRecord } from './search-record';
import { toPlainText } from './template';

export interface CardRecord extends Omit<SearchRecord, 'text'> {
  /** Site-relative icon path (prefix with the base URL), absent when the image is missing. */
  icon?: string;
  /** Description template of the summary; parse with parseTemplate. */
  summary: string;
  numbers?: Record<string, number | string>;
}

export type HydratedCard = SearchRecord & Pick<CardRecord, 'icon' | 'summary' | 'numbers'>;

/** Restore the search text that toCardRecord leaves out (it equals toPlainText of the summary). */
export function hydrateCardRecord(r: CardRecord): HydratedCard {
  return { ...r, text: toPlainText(r.summary) };
}
