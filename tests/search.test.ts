import { describe, expect, it } from 'vitest';
import { toSearchRecord } from '../src/lib/search-record';
import { applyCategory, createSearcher } from '../src/lib/searcher';
import { safeJson } from '../src/lib/json';
import { blessingSchema } from '../src/lib/schema';
import { blessings } from './fixtures';

const records = blessings.map(toSearchRecord);
const search = createSearcher(records);
const ids = (q: string) => search(q).map((r) => r.id);

const make = (id: string, name: string) =>
  blessingSchema.parse({ id, name, category: '其他', effect: '测试效果' });
const searchOver = (names: [string, string][]) => {
  const s = createSearcher(names.map(([id, name]) => toSearchRecord(make(id, name))));
  return (q: string) => s(q).map((r) => r.id);
};

describe('toSearchRecord', () => {
  it('builds full pinyin and initials without tones or punctuation', () => {
    const r = toSearchRecord(blessings[1]);
    expect(r.py).toBe('dianchuisiwei');
    expect(r.pyInitials).toBe('dcsw');
  });
  it('indexes ü as v', () => {
    const r = toSearchRecord(make('green-staff', '绿杖'));
    expect(r.py).toBe('lvzhang');
    expect(r.pyInitials).toBe('lz');
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
  it('finds a ü name by typing v', () => {
    const s = searchOver([['other', '狼王核心'], ['green-staff', '绿杖']]);
    expect(s('lv')[0]).toBe('green-staff');
  });
  it('ranks exact name above prefix above substring within the exact tier', () => {
    const s = searchOver([['a', '电锤思维'], ['b', '超级电锤'], ['c', '电锤']]);
    expect(s('电锤')).toEqual(['c', 'a', 'b']);
  });
  it('ranks exact initials above initials prefix', () => {
    const s = searchOver([['a', '电锤思维'], ['b', '电锤']]);
    expect(s('dc')[0]).toBe('b');
  });
  it('normalizes fullwidth queries (NFKC)', () => {
    expect(ids('ｄｃｓｗ')[0]).toBe('electric-hammer');
  });
  it('matches names containing whitespace in the exact tier', () => {
    const s = searchOver([['other', '狼王核心之力'], ['spaced', '狼王 核心']]);
    expect(s('狼王核心')[0]).toBe('spaced');
  });
  it('returns a copy for an empty query', () => {
    const s = createSearcher(records);
    const first = s('');
    first.pop();
    expect(s('')).toHaveLength(3);
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
