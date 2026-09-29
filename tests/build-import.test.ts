import { describe, expect, it } from 'vitest';
import {
  BUILD_ORIGIN,
  buildBlessings,
  guideNames,
  matchGuide,
  mayOverwrite,
  normalizeName,
  renderBuild,
  type GuideEntry,
} from '../src/lib/build-import';
import { buildSchema, blessingSchema, type Blessing } from '../src/lib/schema';
import { readFrontmatter } from '../src/lib/load';

const b = (id: string, name: string, quality?: 'ssr' | 'sr' | 'r'): Blessing =>
  blessingSchema.parse({ id, name, quality, summary: 's', effect: 'e', tags: [] });

const pool = [
  b('10087', '我要做赵高', 'sr'),
  b('10043', '技能增强', 'r'),
  b('10047', '技能增强', 'sr'),
  b('10042', '生命值（伤害）', 'r'),
  b('10042a', '生命值（SP：移速）'),
  b('10151', '肉身成圣 - 血', 'ssr'),
  b('10182', '乾坤一掷\u200c', 'r'),
  b('10177', '复活吧我的爱人', 'ssr'),
  b('100155', '死亡一指增伤', 'sr'),
  b('100156', '死亡一指冷却', 'ssr'),
  b('10010', '电锤思维', 'ssr'),
  b('20001', '同名', undefined),
  b('20001a', '同名', undefined),
];

const guide = (over: Partial<GuideEntry>): GuideEntry => ({
  hero: '莱恩',
  file: 'x.png',
  date: '2026-05-06',
  gold: '',
  purple: '',
  blue: '',
  ...over,
});

describe('guideNames / normalizeName', () => {
  it('splits on spaces but keeps "A - B" names together', () => {
    expect(guideNames('电锤思维  肉身成圣 - 血 铁头娃')).toEqual(['电锤思维', '肉身成圣-血', '铁头娃']);
  });
  it('drops zero-width characters and spaces around dashes', () => {
    expect(normalizeName('乾坤一掷\u200c')).toBe('乾坤一掷');
    expect(normalizeName('肉身成圣 - 血')).toBe('肉身成圣-血');
  });
});

describe('matchGuide', () => {
  it('matches exact names, including normalized ones', () => {
    const m = matchGuide(guide({ gold: '电锤思维 肉身成圣 - 血', blue: '乾坤一掷' }), pool, new Set());
    expect(m.map((x) => [x.name, x.id, x.how])).toEqual([
      ['电锤思维', '10010', 'exact'],
      ['肉身成圣-血', '10151', 'exact'],
      ['乾坤一掷', '10182', 'exact'],
    ]);
  });

  it('picks the same-name blessing whose quality equals the tier', () => {
    const m = matchGuide(guide({ purple: '技能增强', blue: '技能增强' }), pool, new Set());
    expect(m.map((x) => [x.tier, x.id, x.how])).toEqual([
      ['purple', '10047', 'quality'],
      ['blue', '10043', 'quality'],
    ]);
  });

  it('falls back to the non-SP base id when quality cannot decide, and lists candidates', () => {
    const [m] = matchGuide(guide({ gold: '同名' }), pool, new Set());
    expect(m).toMatchObject({ id: '20001', how: 'base', candidates: ['20001', '20001a'] });
  });

  it('resolves short names only through the research picks for this guide', () => {
    const picks = new Set(['10087', '10177', '100155']);
    const m = matchGuide(guide({ gold: '复活', purple: '赵高 死亡一指强化' }), pool, picks);
    expect(m.map((x) => [x.name, x.id, x.how])).toEqual([
      ['复活', '10177', 'guide-pick'],
      ['赵高', '10087', 'guide-pick'],
      ['死亡一指强化', '100155', 'guide-pick'],
    ]);
    // Without research evidence nothing is guessed.
    expect(matchGuide(guide({ purple: '赵高' }), pool, new Set())[0]).toMatchObject({ id: undefined, how: 'unmapped' });
  });

  it('does not reuse a pick already matched exactly elsewhere in the guide', () => {
    const picks = new Set(['100156', '100155']);
    const m = matchGuide(guide({ gold: '死亡一指冷却', purple: '死亡一指强化' }), pool, picks);
    expect(m.map((x) => x.id)).toEqual(['100156', '100155']);
  });

  it('follows a reviewed alias to the official name, but only onto a research pick', () => {
    const aliases = { 死亡一指加伤: '死亡一指增伤' };
    expect(matchGuide(guide({ purple: '死亡一指加伤' }), pool, new Set(['100155']), aliases)[0]).toMatchObject({
      id: '100155',
      how: 'alias',
    });
    expect(matchGuide(guide({ purple: '死亡一指加伤' }), pool, new Set(), aliases)[0]).toMatchObject({
      id: undefined,
      how: 'unmapped',
    });
  });

  it('lets an alias target one section when the same name is printed in several', () => {
    const aliases = { 'gold:一指': '死亡一指冷却', 'purple:一指': '死亡一指增伤' };
    const m = matchGuide(guide({ gold: '一指', purple: '一指' }), pool, new Set(['100155', '100156']), aliases);
    expect(m.map((x) => x.id)).toEqual(['100156', '100155']);
  });

  it('leaves a short name unmapped when several picks fit and quality cannot decide', () => {
    const picks = new Set(['10042', '10042a']);
    const [m] = matchGuide(guide({ purple: '生命值' }), pool, picks);
    expect(m).toMatchObject({ id: undefined, how: 'unmapped', candidates: ['10042', '10042a'] });
  });
});

describe('buildBlessings', () => {
  it('puts core picks first in their section', () => {
    const m = matchGuide(guide({ gold: '电锤思维 死亡一指冷却 复活吧我的爱人' }), pool, new Set());
    expect(buildBlessings(m, { 复活吧我的爱人: '保命' }).map((x) => x.id)).toEqual(['10177', '100156', '10010']);
  });

  it('orders gold → purple → blue, hero blessings first in each tier, dedupes, and tags notes', () => {
    const m = matchGuide(
      guide({ gold: '电锤思维 死亡一指冷却', purple: '死亡一指强化 技能增强', blue: '技能增强 电锤思维 不存在' }),
      pool,
      new Set(['100155']),
    );
    expect(buildBlessings(m, { 死亡一指强化: '拿到即 T0' })).toEqual([
      { id: '100156', note: '橙色推荐' },
      { id: '10010', note: '橙色推荐' },
      { id: '100155', note: '紫色推荐 · 核心 · 拿到即 T0' },
      { id: '10047', note: '紫色推荐' },
      { id: '10043', note: '蓝色推荐' },
    ]);
  });
});

describe('renderBuild / mayOverwrite', () => {
  const fm = {
    hero: 'lion',
    origin: BUILD_ORIGIN,
    summary: '控制型',
    blessings: [{ id: '100155', note: '紫色推荐' }],
    items: [],
    updated: '2026-05-06',
    sources: ['http://122.51.0.76:8081/icons/guides/x.png', 'http://122.51.0.76:8081'],
  };

  it('writes frontmatter the build schema accepts, then the body', () => {
    const md = renderBuild(fm, '第一段。\n\n第二段。');
    expect(buildSchema.parse(readFrontmatter(md))).toEqual(fm);
    expect(md.endsWith('\n---\n\n第一段。\n\n第二段。\n')).toBe(true);
  });

  it('only overwrites missing files and files the importer generated', () => {
    expect(mayOverwrite(undefined)).toBe(true);
    expect(mayOverwrite(renderBuild(fm, 'x'))).toBe(true);
    expect(mayOverwrite('---\nhero: lion\nsummary: 手写\nupdated: 2026-09-01\n---\n手写正文\n')).toBe(false);
    expect(mayOverwrite(renderBuild({ ...fm, origin: 'manual' }, 'x'))).toBe(false);
  });
});
