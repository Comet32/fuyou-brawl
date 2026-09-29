import { describe, expect, it } from 'vitest';
import { mergeBlessings } from '../src/lib/blessings';
import { findBrokenRefs } from '../src/lib/integrity';
import { blessingOverrideSchema } from '../src/lib/schema';
import { validSet } from './fixtures';

const gen = { id: '100001', name: '甲', name_en: '', summary: 's', effect: 'e', tags: [] };

describe('manual hero links in overrides', () => {
  it('accepts a list of hero slugs, including an empty one', () => {
    expect(blessingOverrideSchema.parse({ heroes: ['axe'] }).heroes).toEqual(['axe']);
    expect(blessingOverrideSchema.parse({ heroes: [] }).heroes).toEqual([]);
    expect(() => blessingOverrideSchema.parse({ heroes: ['Not A Slug'] })).toThrow();
  });
  it('merges heroes onto the blessing, undefined when absent', () => {
    expect(mergeBlessings([gen], { '100001': { heroes: ['axe'] } })[0].heroes).toEqual(['axe']);
    expect(mergeBlessings([gen], {})[0].heroes).toBeUndefined();
  });
  it('reports unknown heroes', () => {
    const d = validSet();
    d.blessings[0].heroes = ['nobody'];
    expect(findBrokenRefs(d)).toContain(`福佑 ${d.blessings[0].id}：heroes 中的英雄 "nobody" 不存在`);
  });
});
