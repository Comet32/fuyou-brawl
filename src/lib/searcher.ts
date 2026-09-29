import Fuse from 'fuse.js';
import type { QualityId } from './quality';
import type { SearchRecord } from './search-record';

const normalize = (q: string) => q.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

// Lower is better: how closely a record matches the (normalized) query. Undefined = not an exact hit.
function exactRank(r: SearchRecord, name: string, nameEn: string, q: string): number | undefined {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (r.pyInitials === q || r.py === q) return 2;
  if (r.pyInitials.startsWith(q)) return 3;
  if (r.py.startsWith(q)) return 4;
  if (nameEn.startsWith(q)) return 5;
  if (name.includes(q)) return 6;
  return undefined;
}

export function createSearcher(records: SearchRecord[]) {
  const fuse = new Fuse(records, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'name_en', weight: 1.5 },
      { name: 'pyInitials', weight: 2 },
      { name: 'py', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'text', weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });

  // Normalize each name once instead of on every keystroke.
  const names = records.map((r) => normalize(r.name));
  const namesEn = records.map((r) => normalize(r.name_en));

  return function search(query: string): SearchRecord[] {
    const q = normalize(query);
    if (!q) return [...records];
    // Exact name / pinyin prefix hits always rank above fuzzy hits, ordered by match quality (stable).
    const exact = records
      .map((r, i) => ({ r, rank: exactRank(r, names[i], namesEn[i], q) }))
      .filter((x): x is { r: SearchRecord; rank: number } => x.rank !== undefined)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.r);
    const seen = new Set(exact.map((r) => r.id));
    const fuzzy = fuse
      .search(q)
      .map((res) => res.item)
      .filter((r) => !seen.has(r.id));
    return [...exact, ...fuzzy];
  };
}

export interface Filters {
  /** '' = any quality, 'none' = not labeled yet. */
  quality?: QualityId | 'none' | '';
  /** '' = any tag. */
  tag?: string;
}

/** Keep records matching every active filter, preserving their (relevance) order. */
export function applyFilters(records: SearchRecord[], { quality = '', tag = '' }: Filters): SearchRecord[] {
  return records.filter(
    (r) =>
      (quality === '' || (quality === 'none' ? r.quality === null : r.quality === quality)) &&
      (tag === '' || r.tags.includes(tag)),
  );
}
