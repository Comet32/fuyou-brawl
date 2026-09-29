import { describe, expect, it } from 'vitest';
import { toSearchRecord } from '../src/lib/search-record';
import { applyFilters, createSearcher } from '../src/lib/searcher';
import { safeJson } from '../src/lib/json';
import { blessingSchema } from '../src/lib/schema';
import { blessings } from './fixtures';

const records = blessings.map(toSearchRecord);
const search = createSearcher(records);
const ids = (q: string) => search(q).map((r) => r.id);

// Ids are overridden after parsing so tests can use short readable labels.
const make = (id: string, name: string, name_en = '') => ({
  ...blessingSchema.parse({ id: '10000', name, name_en, summary: '测试效果', effect: '测试效果' }),
  id,
});
const searchOver = (names: [string, string, string?][]) => {
  const s = createSearcher(names.map(([id, name, en]) => toSearchRecord(make(id, name, en))));
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
    expect(ids('  ')).toEqual(['10145', '10010', '10091']);
  });
  it('matches Chinese name substring first', () => {
    expect(ids('电锤')[0]).toBe('10010');
  });
  it('matches pinyin initials', () => {
    expect(ids('dc')[0]).toBe('10010');
    expect(ids('LWND')[0]).toBe('10145');
  });
  it('matches full pinyin with spaces', () => {
    expect(ids('dian chui')[0]).toBe('10010');
  });
  it('matches effect keywords', () => {
    expect(ids('冷却')).toContain('10145');
    expect(ids('墓碑')).toContain('10091');
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
    expect(ids('ｄｃｓｗ')[0]).toBe('10010');
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

describe('English names', () => {
  it('indexes name_en in the record', () => {
    expect(toSearchRecord(blessings[1]).name_en).toBe('Maelstrom Mind');
  });
  it('matches an English name prefix case-insensitively', () => {
    expect(ids('maelstrom')[0]).toBe('10010');
    expect(ids('Arcana P')[0]).toBe('10145');
  });
  it('ranks English prefix after pinyin hits but before Chinese substring hits', () => {
    const s = searchOver([['sub', '大lan', ''], ['en', '其他', 'Lance'], ['py', '蓝色', '']]);
    expect(s('lan')).toEqual(['py', 'en', 'sub']);
  });
  it('fuzzy-matches English names', () => {
    expect(ids('maelstorm')).toContain('10010');
  });
});

describe('search record text', () => {
  it('is the plain-text summary with unknown values as ?', () => {
    const r = toSearchRecord(blessings[1]);
    expect(r.text).toBe('获得 ? 金币。首次携带黯灭时，将其升级为 雷神之锤(真) 。');
    expect(r.text).not.toContain('<');
  });
  it('carries quality and tags', () => {
    expect(toSearchRecord(blessings[1])).toMatchObject({ quality: 'ssr', tags: ['经济', '装备'] });
    expect(toSearchRecord(blessings[0]).quality).toBeNull();
  });
});

describe('applyFilters', () => {
  const filtered = (f: Parameters<typeof applyFilters>[1]) => applyFilters(records, f).map((r) => r.id);
  it('keeps everything without filters', () => {
    expect(filtered({})).toEqual(['10145', '10010', '10091']);
    expect(filtered({ quality: '', tag: '' })).toEqual(['10145', '10010', '10091']);
  });
  it('filters by quality', () => {
    expect(filtered({ quality: 'ssr' })).toEqual(['10010']);
    expect(filtered({ quality: 'sr' })).toEqual([]);
  });
  it("treats 'none' as unlabeled", () => {
    expect(filtered({ quality: 'none' })).toEqual(['10145']);
  });
  it('filters by tag', () => {
    expect(filtered({ tag: '经济' })).toEqual(['10010', '10091']);
  });
  it('combines quality and tag', () => {
    expect(filtered({ quality: 'r', tag: '经济' })).toEqual(['10091']);
    expect(filtered({ quality: 'none', tag: '经济' })).toEqual([]);
  });
  it('preserves input (relevance) order', () => {
    const reversed = [...records].reverse();
    expect(applyFilters(reversed, { tag: '经济' }).map((r) => r.id)).toEqual(['10091', '10010']);
  });
});

describe('safeJson', () => {
  it('escapes < so data cannot close a script tag', () => {
    expect(safeJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
  });
});
