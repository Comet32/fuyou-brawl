import { describe, expect, it } from 'vitest';
import { findBrokenRefs } from '../src/lib/integrity';
import { buildSchema } from '../src/lib/schema';
import { validSet } from './fixtures';

describe('isoDate fields', () => {
  it('accept Date objects produced by frontmatter parsers', () => {
    const b = buildSchema.parse({ hero: 'axe', summary: 's', updated: new Date('2026-09-28') });
    expect(b.updated).toBe('2026-09-28');
  });
});

describe('findBrokenRefs', () => {
  it('returns no errors for a consistent data set', () => {
    expect(findBrokenRefs(validSet())).toEqual([]);
  });

  it('reports duplicate blessing ids and names', () => {
    const d = validSet();
    d.blessings.push({ ...d.blessings[0] });
    const errors = findBrokenRefs(d);
    expect(errors).toContain('福佑 id 重复：wolf-core');
    expect(errors).toContain('福佑名称重复：狼王核心');
  });

  it('reports unknown exclusive hero', () => {
    const d = validSet();
    d.blessings[2].exclusive_hero = 'nobody';
    expect(findBrokenRefs(d)).toContain('福佑 rescue：exclusive_hero "nobody" 不存在');
  });

  it('reports unknown versions in since_version and history', () => {
    const d = validSet();
    d.blessings[0].since_version = '2020-01-01';
    d.blessings[1].history[0].version = '2020-01-02';
    const errors = findBrokenRefs(d);
    expect(errors).toContain('福佑 wolf-core：since_version "2020-01-01" 不在 versions.yaml 中');
    expect(errors).toContain('福佑 electric-hammer：history 版本 "2020-01-02" 不在 versions.yaml 中');
  });

  it('reports unknown blessing in version changes', () => {
    const d = validSet();
    d.versions[0].changes[0].blessing = 'ghost';
    expect(findBrokenRefs(d)).toContain('版本 2026-09-01：引用了不存在的福佑 "ghost"');
  });

  it('reports build file / hero mismatch and bad refs', () => {
    const d = validSet();
    d.builds[0].file = 'antimage.md';
    d.builds[0].data.blessings.push({ id: 'ghost' });
    d.builds[0].data.items.push('nothing');
    const errors = findBrokenRefs(d);
    expect(errors).toContain('搭配 antimage.md：文件名应为 axe.md');
    expect(errors).toContain('搭配 antimage.md：福佑 "ghost" 不存在');
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
