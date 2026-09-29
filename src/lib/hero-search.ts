// Client-safe hero lookup for /heroes/: Chinese name, pinyin, initials, English name and ability names.
import Fuse from 'fuse.js';

export interface HeroSearchRecord {
  id: string;
  name: string;
  name_en: string;
  attr: 'str' | 'agi' | 'int' | 'all';
  py: string;
  pyInitials: string;
  /** Chinese ability names from hero-abilities.yaml. */
  abilities: string[];
}

export interface HeroHit {
  record: HeroSearchRecord;
  /** The ability name that matched, when the hit came from an ability. */
  ability?: string;
}

// Same normalization as the blessing searcher.
const normalize = (q: string) => q.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

/** Lower is better; undefined = no exact-tier hit. */
function rank(r: HeroSearchRecord, name: string, en: string, q: string): { rank: number; ability?: string } | undefined {
  if (name === q) return { rank: 0 };
  if (name.startsWith(q)) return { rank: 1 };
  if (r.pyInitials === q) return { rank: 2 };
  if (r.py.startsWith(q) || r.pyInitials.startsWith(q)) return { rank: 3 };
  if (en.startsWith(q) || en.replace(/[^a-z0-9]/g, '').startsWith(q)) return { rank: 4 };
  if (name.includes(q)) return { rank: 5 };
  const ability = r.abilities.find((a) => normalize(a).includes(q));
  if (ability) return { rank: 6, ability };
  return undefined;
}

export function createHeroSearcher(records: HeroSearchRecord[]) {
  const fuse = new Fuse(records, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'name_en', weight: 2 },
      { name: 'py', weight: 2 },
      { name: 'abilities', weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });
  const names = records.map((r) => normalize(r.name));
  const namesEn = records.map((r) => normalize(r.name_en));

  return function search(query: string): HeroHit[] {
    const q = normalize(query);
    if (!q) return records.map((record) => ({ record }));
    const exact = records
      .map((record, i) => ({ record, hit: rank(record, names[i], namesEn[i], q) }))
      .filter((x): x is { record: HeroSearchRecord; hit: { rank: number; ability?: string } } => x.hit !== undefined)
      .sort((a, b) => a.hit.rank - b.hit.rank)
      .map(({ record, hit }) => (hit.ability ? { record, ability: hit.ability } : { record }));
    const seen = new Set(exact.map((h) => h.record.id));
    const fuzzy = fuse
      .search(q)
      .map((res) => res.item)
      .filter((r) => !seen.has(r.id))
      .map((record) => ({ record }));
    return [...exact, ...fuzzy];
  };
}

/** Keep hits of one attribute ('' = all), preserving order. */
export function filterByAttr(hits: HeroHit[], attr: HeroSearchRecord['attr'] | ''): HeroHit[] {
  return attr ? hits.filter((h) => h.record.attr === attr) : hits;
}
