import Fuse from 'fuse.js';
import type { SearchRecord } from './search-record';

const normalize = (q: string) => q.trim().toLowerCase().replace(/\s+/g, '');

export function createSearcher(records: SearchRecord[]) {
  const fuse = new Fuse(records, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'pyInitials', weight: 2 },
      { name: 'py', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'effect', weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });

  return function search(query: string): SearchRecord[] {
    const q = normalize(query);
    if (!q) return records;
    // Exact name / pinyin prefix hits always rank above fuzzy hits.
    const exact = records.filter(
      (r) => r.name.toLowerCase().includes(q) || r.py.startsWith(q) || r.pyInitials.startsWith(q),
    );
    const seen = new Set(exact.map((r) => r.id));
    const fuzzy = fuse
      .search(q)
      .map((res) => res.item)
      .filter((r) => !seen.has(r.id));
    return [...exact, ...fuzzy];
  };
}

export function applyCategory(records: SearchRecord[], category: string): SearchRecord[] {
  return category ? records.filter((r) => r.category === category) : records;
}
