import { describe, expect, it } from 'vitest';
import { parseCompareIds, serializeCompareIds } from '../src/lib/compare';

const valid = new Set(['a', 'b', 'c', 'd']);

describe('parseCompareIds', () => {
  it('reads ids in order', () => {
    expect(parseCompareIds('?ids=b,a', valid)).toEqual(['b', 'a']);
  });
  it('drops unknown and duplicate ids and caps at 3', () => {
    expect(parseCompareIds('?ids=a,x,a,b,c,d', valid)).toEqual(['a', 'b', 'c']);
  });
  it('handles missing param', () => {
    expect(parseCompareIds('', valid)).toEqual([]);
  });
});

describe('serializeCompareIds', () => {
  it('skips empty slots', () => {
    expect(serializeCompareIds(['a', null, 'c'])).toBe('?ids=a,c');
  });
  it('returns empty string when nothing selected', () => {
    expect(serializeCompareIds([null, null, null])).toBe('');
  });
});
