import { describe, expect, it } from 'vitest';
import { QUALITIES, QUALITY_IDS, qualityOf } from '../src/lib/quality';

describe('quality', () => {
  it('lists orange, purple, blue in order', () => {
    expect(QUALITIES.map((q) => q.id)).toEqual(['ssr', 'sr', 'r']);
    expect(QUALITY_IDS).toEqual(['ssr', 'sr', 'r']);
  });
  it('looks up a quality', () => {
    expect(qualityOf('sr')?.color).toBe('#b518ff');
    expect(qualityOf('ssr')?.label).toBe('橙色');
  });
  it('returns undefined for unknown or empty ids', () => {
    expect(qualityOf('x')).toBeUndefined();
    expect(qualityOf(null)).toBeUndefined();
    expect(qualityOf(undefined)).toBeUndefined();
  });
});
