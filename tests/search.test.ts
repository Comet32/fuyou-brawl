import { describe, expect, it } from 'vitest';
import { toSearchRecord } from '../src/lib/search-record';
import { applyCategory, createSearcher } from '../src/lib/searcher';
import { safeJson } from '../src/lib/json';
import { blessings } from './fixtures';

const records = blessings.map(toSearchRecord);
const search = createSearcher(records);
const ids = (q: string) => search(q).map((r) => r.id);

describe('toSearchRecord', () => {
  it('builds full pinyin and initials without tones or punctuation', () => {
    const r = toSearchRecord(blessings[1]);
    expect(r.py).toBe('dianchuisiwei');
    expect(r.pyInitials).toBe('dcsw');
  });
});

describe('createSearcher', () => {
  it('returns all records for an empty query', () => {
    expect(ids('  ')).toEqual(['wolf-core', 'electric-hammer', 'rescue']);
  });
  it('matches Chinese name substring first', () => {
    expect(ids('电锤')[0]).toBe('electric-hammer');
  });
  it('matches pinyin initials', () => {
    expect(ids('dc')[0]).toBe('electric-hammer');
    expect(ids('LWHX')[0]).toBe('wolf-core');
  });
  it('matches full pinyin with spaces', () => {
    expect(ids('dian chui')[0]).toBe('electric-hammer');
  });
  it('matches effect keywords', () => {
    expect(ids('冷却')).toContain('wolf-core');
    expect(ids('墓碑')).toContain('rescue');
  });
  it('returns nothing for garbage', () => {
    expect(ids('zzzzqqq')).toEqual([]);
  });
});

describe('applyCategory', () => {
  it('keeps everything when category is empty', () => {
    expect(applyCategory(records, '')).toHaveLength(3);
  });
  it('filters by category', () => {
    expect(applyCategory(records, '装备类').map((r) => r.id)).toEqual(['electric-hammer']);
  });
});

describe('safeJson', () => {
  it('escapes < so data cannot close a script tag', () => {
    expect(safeJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
  });
});
