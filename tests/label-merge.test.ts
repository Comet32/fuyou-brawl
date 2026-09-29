import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { mergeQualityLabels, validateLabels } from '../src/lib/label-merge';

const known = new Set(['10010', '10145', '10091', '10001']);

describe('validateLabels', () => {
  it('splits valid, unknown and invalid entries', () => {
    const r = validateLabels({ '10010': 'sr', '99999': 'r', '10145': 'gold', '10091': 3 }, known);
    expect(r.labels).toEqual({ '10010': 'sr' });
    expect(r.unknown).toEqual(['99999']);
    expect(r.invalid.sort()).toEqual(['10091', '10145']); // integer-like keys iterate numerically
  });
  it('rejects a non-object', () => {
    expect(() => validateLabels([1, 2], known)).toThrow();
    expect(() => validateLabels(null, known)).toThrow();
  });
});

const SOURCE = `# Manual data merged onto blessings.generated.yaml. Keys are blessing ids.
'10010':
  quality: ssr
  numbers: { gold: 3500 }
  sources: [https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696]
'10145':
  numbers: { count: 3, pct: 8, self_pct: 3 }
`;

describe('mergeQualityLabels', () => {
  it('adds, changes and keeps entries while preserving other fields and comments', () => {
    const { text, added, changed, unchanged } = mergeQualityLabels(SOURCE, {
      '10010': 'ssr',
      '10145': 'sr',
      '10001': 'r',
    });
    expect({ added, changed, unchanged }).toEqual({ added: 1, changed: 1, unchanged: 1 });
    expect(text.startsWith('# Manual data merged')).toBe(true);
    expect(text).toContain('numbers: { gold: 3500 }');
    expect(text).toContain("'10001':");
    expect(text).not.toMatch(/^10001:/m);
    const data = parse(text);
    expect(data['10010']).toEqual({
      quality: 'ssr',
      numbers: { gold: 3500 },
      sources: ['https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696'],
    });
    expect(data['10145']).toEqual({ numbers: { count: 3, pct: 8, self_pct: 3 }, quality: 'sr' });
    expect(data['10001']).toEqual({ quality: 'r' });
  });
  it('counts a changed quality', () => {
    const r = mergeQualityLabels(SOURCE, { '10010': 'r' });
    expect(r.changed).toBe(1);
    expect(parse(r.text)['10010'].quality).toBe('r');
  });
  it('works on an empty file', () => {
    const r = mergeQualityLabels('', { '10091': 'sr' });
    expect(r.added).toBe(1);
    expect(parse(r.text)).toEqual({ '10091': { quality: 'sr' } });
    expect(r.text).toContain("'10091':");
  });
  it('replaces an empty entry with a map', () => {
    const r = mergeQualityLabels("'10091':\n", { '10091': 'r' });
    expect(parse(r.text)).toEqual({ '10091': { quality: 'r' } });
    expect(r.added).toBe(1);
  });
});
