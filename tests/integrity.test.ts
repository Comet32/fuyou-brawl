import { describe, expect, it } from 'vitest';
import { findBrokenRefs } from '../src/lib/integrity';
import { blessingSchema, buildSchema } from '../src/lib/schema';
import { validSet } from './fixtures';

describe('isoDate fields', () => {
  it('accept Date objects produced by frontmatter parsers', () => {
    const b = buildSchema.parse({ hero: 'axe', summary: 's', updated: new Date('2026-09-28') });
    expect(b.updated).toBe('2026-09-28');
  });
});

describe('source URLs', () => {
  const base = { id: '10010', name: 'X', summary: 's', effect: 'e' };
  it('rejects non-http(s) protocols', () => {
    expect(blessingSchema.safeParse({ ...base, sources: ['javascript:alert(1)'] }).success).toBe(false);
  });
  it('accepts https urls', () => {
    expect(blessingSchema.safeParse({ ...base, sources: ['https://example.com'] }).success).toBe(true);
  });
});

describe('findBrokenRefs', () => {
  it('returns no errors for a consistent data set', () => {
    expect(findBrokenRefs(validSet())).toEqual([]);
  });

  it('reports duplicate blessing ids', () => {
    const d = validSet();
    d.blessings.push({ ...d.blessings[0] });
    expect(findBrokenRefs(d)).toEqual(['福佑 id 重复：10145']);
  });

  it('allows duplicate blessing names (the game has some)', () => {
    const d = validSet();
    d.blessings.push({ ...d.blessings[0], id: '10146' });
    expect(findBrokenRefs(d)).toEqual([]);
  });

  it('reports duplicate hero, item and version ids', () => {
    const d = validSet();
    d.heroes.push({ ...d.heroes[0] });
    d.items.push({ ...d.items[1] });
    d.versions.push({ ...d.versions[0] });
    const errors = findBrokenRefs(d);
    expect(errors).toContain('英雄 id 重复：axe');
    expect(errors).toContain('装备 id 重复：blink');
    expect(errors).toContain('版本 id 重复：2026-09-01');
  });

  it('reports unknown exclusive hero', () => {
    const d = validSet();
    d.blessings[2].exclusive_hero = 'nobody';
    expect(findBrokenRefs(d)).toContain('福佑 10091：exclusive_hero "nobody" 不存在');
  });

  it('reports unknown versions in since_version and history', () => {
    const d = validSet();
    d.blessings[0].since_version = '2020-01-01';
    d.blessings[1].history[0].version = '2020-01-02';
    const errors = findBrokenRefs(d);
    expect(errors).toContain('福佑 10145：since_version "2020-01-01" 不在 versions.yaml 中');
    expect(errors).toContain('福佑 10010：history 版本 "2020-01-02" 不在 versions.yaml 中');
  });

  it('reports unknown blessing in version changes', () => {
    const d = validSet();
    d.versions[0].changes[0].blessing = '99999';
    expect(findBrokenRefs(d)).toContain('版本 2026-09-01：引用了不存在的福佑 "99999"');
  });

  it('reports build file / hero mismatch and bad refs', () => {
    const d = validSet();
    d.builds[0].file = 'antimage.md';
    d.builds[0].data.blessings.push({ id: '99999' });
    d.builds[0].data.items.push('nothing');
    const errors = findBrokenRefs(d);
    expect(errors).toContain('搭配 antimage.md：文件名应为 axe.md');
    expect(errors).toContain('搭配 antimage.md：福佑 "99999" 不存在');
    expect(errors).toContain('搭配 antimage.md：装备 "nothing" 不存在');
  });

  it('reports build for unknown hero and duplicate builds', () => {
    const d = validSet();
    d.builds.push({ file: 'zeus.md', data: { ...d.builds[0].data, hero: 'zeus' } });
    d.builds.push({ ...d.builds[0] });
    const errors = findBrokenRefs(d);
    expect(errors).toContain('搭配 zeus.md：英雄 "zeus" 不存在');
    expect(errors).toContain('英雄 axe 有多个搭配文件');
  });
});

describe('hero abilities', () => {
  it('accepts abilities of known heroes', () => {
    const d = validSet();
    d.heroAbilities = [{ hero: 'axe', abilities: [{ id: 'axe_berserkers_call', name: '狂战士之吼', name_en: "Berserker's Call" }] }];
    expect(findBrokenRefs(d)).toEqual([]);
  });

  it('reports unknown and duplicated hero entries', () => {
    const d = validSet();
    const entry = { hero: 'axe', abilities: [{ id: 'axe_a', name: '甲', name_en: 'A' }] };
    d.heroAbilities = [entry, entry, { ...entry, hero: 'nobody' }];
    const errors = findBrokenRefs(d);
    expect(errors).toContain('hero-abilities：英雄 "nobody" 不存在');
    expect(errors).toContain('hero-abilities：英雄 axe 重复');
  });
});

