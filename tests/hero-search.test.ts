import { describe, expect, it } from 'vitest';
import { toHeroSearchRecord } from '../src/lib/hero-search-data';
import { createHeroSearcher, filterByAttr } from '../src/lib/hero-search';

const heroes = [
  { id: 'antimage', name: '敌法师', name_en: 'Anti-Mage', attr: 'agi' as const },
  { id: 'nevermore', name: '影魔', name_en: 'Shadow Fiend', attr: 'agi' as const },
  { id: 'axe', name: '斧王', name_en: 'Axe', attr: 'str' as const },
  { id: 'lina', name: '莉娜', name_en: 'Lina', attr: 'int' as const },
  { id: 'lion', name: '莱恩', name_en: 'Lion', attr: 'int' as const },
  { id: 'faceless_void', name: '虚空假面', name_en: 'Faceless Void', attr: 'agi' as const },
];
const abilities = new Map([
  ['antimage', ['法力损毁', '闪烁', '法力虚空']],
  ['faceless_void', ['时间漫游', '时间结界']],
  ['lina', ['神灭斩']],
]);
const records = heroes.map((h) => toHeroSearchRecord(h, abilities.get(h.id) ?? []));
const search = createHeroSearcher(records);
const ids = (q: string) => search(q).map((r) => r.record.id);

describe('toHeroSearchRecord', () => {
  it('builds pinyin and initials at build time', () => {
    expect(records[0]).toMatchObject({ id: 'antimage', py: 'difashi', pyInitials: 'dfs' });
  });
});

describe('createHeroSearcher', () => {
  it('finds 敌法师 by initials, full pinyin, English prefix and ability name', () => {
    expect(ids('dfs')[0]).toBe('antimage');
    expect(ids('difashi')[0]).toBe('antimage');
    expect(ids('anti')[0]).toBe('antimage');
    expect(ids('Anti-Mage')[0]).toBe('antimage');
    expect(ids('法力虚空')[0]).toBe('antimage');
  });
  it('reports the matched ability name', () => {
    expect(search('法力虚空')[0].ability).toBe('法力虚空');
    expect(search('dfs')[0].ability).toBeUndefined();
  });
  it('finds 影魔 by initials', () => {
    expect(ids('ym')[0]).toBe('nevermore');
  });
  it('ranks exact name > name prefix > initials > pinyin prefix > English prefix > ability', () => {
    // "虚空" is a name substring of 虚空假面 (prefix) and an ability substring of 敌法师 (法力虚空).
    expect(ids('虚空')).toEqual(['faceless_void', 'antimage']);
    // "li": pinyin prefix of 莉娜 (lina) and 莱恩? (laien: no), English prefix of Lina / Lion.
    const li = ids('li');
    expect(li.indexOf('lina')).toBeLessThan(li.indexOf('lion'));
    expect(ids('莉娜')[0]).toBe('lina');
  });
  it('returns everything in order for an empty query', () => {
    expect(ids('  ')).toEqual(heroes.map((h) => h.id));
  });
});

describe('filterByAttr', () => {
  it('keeps heroes of one attribute, or all for an empty filter', () => {
    const hits = search('');
    expect(filterByAttr(hits, 'int').map((h) => h.record.id)).toEqual(['lina', 'lion']);
    expect(filterByAttr(hits, '')).toHaveLength(heroes.length);
  });
});
