import { describe, expect, it } from 'vitest';
import {
  blessingOverrideSchema,
  blessingSchema,
  buildSchema,
  generatedBlessingSchema,
  versionSchema,
} from '../src/lib/schema';

const base = { id: '10010', name: '甲', summary: '短', effect: '效果' };
const withIcon = (icon: string) => generatedBlessingSchema.safeParse({ ...base, icon }).success;

describe('generatedBlessingSchema', () => {
  it('applies defaults', () => {
    expect(generatedBlessingSchema.parse(base)).toEqual({ ...base, name_en: '', tags: [] });
  });
  it('accepts numeric ids with an optional letter suffix', () => {
    for (const id of ['10010', '100043', '10004a']) {
      expect(generatedBlessingSchema.safeParse({ ...base, id }).success).toBe(true);
    }
  });
  it('rejects slugs and malformed ids', () => {
    for (const id of ['wolf-core', '1001', '1234567', '10010AB', '10010A']) {
      expect(generatedBlessingSchema.safeParse({ ...base, id }).success).toBe(false);
    }
  });
  it('requires a non-empty name', () => {
    expect(generatedBlessingSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });
  it('only allows known auto tags', () => {
    expect(generatedBlessingSchema.safeParse({ ...base, tags: ['经济'] }).success).toBe(true);
    expect(generatedBlessingSchema.safeParse({ ...base, tags: ['随便'] }).success).toBe(false);
  });
});

describe('icon', () => {
  it('accepts a plain webp/png file name', () => {
    expect(withIcon('a-b.webp')).toBe(true);
    expect(withIcon('a_b.1.png')).toBe(true);
  });
  it('rejects path traversal and other extensions', () => {
    expect(withIcon('../x.webp')).toBe(false);
    expect(withIcon('dir/x.webp')).toBe(false);
    expect(withIcon('x.svg')).toBe(false);
  });
  it('is optional', () => {
    expect(generatedBlessingSchema.safeParse(base).success).toBe(true);
  });
});

describe('blessingOverrideSchema', () => {
  it('accepts an empty override', () => {
    expect(blessingOverrideSchema.parse({})).toEqual({});
  });
  it('accepts all known fields', () => {
    const o = {
      quality: 'sr',
      numbers: { gold: 3500, pct: '8%' },
      tags: ['前期'],
      sources: ['https://example.com'],
      history: [{ version: '2026-09-01', change: '改了' }],
      since_version: '2026-09-01',
      exclusive_hero: 'axe',
    };
    expect(blessingOverrideSchema.parse(o)).toEqual(o);
  });
  it('rejects unknown quality and unknown fields', () => {
    expect(blessingOverrideSchema.safeParse({ quality: 'ur' }).success).toBe(false);
    expect(blessingOverrideSchema.safeParse({ quailty: 'sr' }).success).toBe(false);
  });
  it('rejects non-http(s) sources', () => {
    expect(blessingOverrideSchema.safeParse({ sources: ['javascript:alert(1)'] }).success).toBe(false);
  });
});

describe('blessingSchema (merged)', () => {
  it('applies defaults', () => {
    expect(blessingSchema.parse(base)).toEqual({
      ...base,
      name_en: '',
      quality: null,
      quality_source: null,
      tags: [],
      numbers: {},
      number_sources: {},
      exclusive_hero: null,
      sources: [],
      history: [],
      tips: [],
      wiki_notes: [],
      changes: [],
      quality_conflict: [],
      recommended_heroes: [],
    });
  });
  it('allows free-form tags', () => {
    expect(blessingSchema.parse({ ...base, tags: ['前期'] }).tags).toEqual(['前期']);
  });
});

describe('blessing references', () => {
  it('coerce unquoted YAML numbers to string ids', () => {
    const v = versionSchema.parse({ id: '2026-09-01', title: 't', changes: [{ blessing: 10010, text: 'x' }] });
    expect(v.changes[0].blessing).toBe('10010');
    const b = buildSchema.parse({ hero: 'axe', summary: 's', updated: '2026-09-01', blessings: [{ id: 10145 }] });
    expect(b.blessings[0].id).toBe('10145');
  });
  it('reject non-blessing ids', () => {
    expect(
      versionSchema.safeParse({ id: '2026-09-01', title: 't', changes: [{ blessing: 'wolf-core', text: 'x' }] })
        .success,
    ).toBe(false);
  });
});
