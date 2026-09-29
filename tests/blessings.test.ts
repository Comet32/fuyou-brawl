import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadBlessingFiles, mergeBlessings } from '../src/lib/blessings';
import { generatedBlessingSchema, type GeneratedBlessing } from '../src/lib/schema';

const gen = (id: string, extra: Partial<GeneratedBlessing> = {}): GeneratedBlessing =>
  generatedBlessingSchema.parse({ id, name: `福佑${id}`, summary: `短${id}`, effect: `长${id}`, ...extra });

describe('mergeBlessings', () => {
  it('keeps generated order and applies defaults when there is no override', () => {
    const out = mergeBlessings([gen('10091'), gen('10010', { icon: '10010.webp' })], {});
    expect(out.map((b) => b.id)).toEqual(['10091', '10010']);
    expect(out[1]).toEqual({
      id: '10010',
      name: '福佑10010',
      name_en: '',
      quality: null,
      quality_source: null,
      summary: '短10010',
      effect: '长10010',
      tags: [],
      numbers: {},
      number_sources: {},
      icon: '10010.webp',
      exclusive_hero: null,
      sources: [],
      history: [],
      tips: [],
      recommended_heroes: [],
    });
  });

  it('applies override fields', () => {
    const [b] = mergeBlessings([gen('10010')], {
      '10010': {
        quality: 'ssr',
        numbers: { gold: 3500 },
        sources: ['https://example.com'],
        history: [{ version: '2026-09-01', change: '改' }],
        since_version: '2026-08-01',
        exclusive_hero: 'axe',
      },
    });
    expect(b).toMatchObject({
      quality: 'ssr',
      numbers: { gold: 3500 },
      sources: ['https://example.com'],
      history: [{ version: '2026-09-01', change: '改' }],
      since_version: '2026-08-01',
      exclusive_hero: 'axe',
    });
  });

  it('unions auto and manual tags without duplicates, auto first', () => {
    const [b] = mergeBlessings([gen('10010', { tags: ['经济', '装备'] })], {
      '10010': { tags: ['前期', '经济'] },
    });
    expect(b.tags).toEqual(['经济', '装备', '前期']);
  });

  it('throws on an override for an unknown id', () => {
    expect(() => mergeBlessings([gen('10010')], { '99999': { quality: 'r' } })).toThrow(
      'blessings.overrides.yaml: 未知的福佑 id "99999"',
    );
  });

  it('marks manual quality as manual', () => {
    const [b] = mergeBlessings([gen('10010')], { '10010': { quality: 'sr' } });
    expect(b.quality_source).toBe('manual');
  });

  it('does not mutate its inputs', () => {
    const g = [gen('10010', { tags: ['经济'] })];
    const o = { '10010': { tags: ['前期'] } };
    mergeBlessings(g, o);
    expect(g[0].tags).toEqual(['经济']);
    expect(o['10010'].tags).toEqual(['前期']);
  });
});

describe('mergeBlessings with community data', () => {
  const WIKI = 'http://122.51.0.76:8081/api/universal';
  const STEAM = 'https://steamcommunity.com/sharedfiles/filedetails/?id=2841152696';

  it('uses community quality, numbers, tips and recommended heroes when there is no override', () => {
    const [b] = mergeBlessings([gen('10001')], {}, {
      '10001': {
        quality: 'ssr',
        quality_source: WIKI,
        numbers: { range: '200~400', xx: 15 },
        number_sources: { range: WIKI, xx: WIKI },
        tips: [{ text: '仅远程英雄可获得', source: WIKI }],
        recommended_heroes: [{ hero: 'axe', source: WIKI }],
      },
    });
    expect(b).toMatchObject({
      quality: 'ssr',
      quality_source: 'community',
      quality_url: WIKI,
      numbers: { range: '200~400', xx: 15 },
      number_sources: { range: WIKI, xx: WIKI },
      tips: [{ text: '仅远程英雄可获得', source: WIKI }],
      recommended_heroes: [{ hero: 'axe', source: WIKI }],
    });
  });

  it('lets manual overrides win over community data, key by key for numbers', () => {
    const [b] = mergeBlessings(
      [gen('10145')],
      { '10145': { quality: 'sr', numbers: { pct: 8 }, tips: [{ text: '手动心得' }] } },
      {
        '10145': {
          quality: 'r',
          quality_source: WIKI,
          numbers: { pct: '5~10', count: 3 },
          number_sources: { pct: WIKI, count: WIKI },
          tips: [{ text: '社区心得', source: WIKI, date: '2026-05' }],
          notes: '品质待核实',
        },
      },
    );
    expect(b.quality).toBe('sr');
    expect(b.quality_source).toBe('manual');
    expect(b.quality_url).toBeUndefined();
    // A manual quality settles the question; the community caveat no longer applies.
    expect(b.quality_note).toBeUndefined();
    expect(b.numbers).toEqual({ pct: 8, count: 3 });
    expect(b.number_sources).toEqual({ count: WIKI });
    expect(b.tips).toEqual([{ text: '手动心得' }, { text: '社区心得', source: WIKI, date: '2026-05' }]);
  });

  it('keeps the community quality note when quality is unknown', () => {
    const [b] = mergeBlessings([gen('10148')], {}, { '10148': { notes: '同名条目多种颜色' } });
    expect(b).toMatchObject({ quality: null, quality_source: null, quality_note: '同名条目多种颜色' });
  });

  it('keeps manual sources separate from community ones', () => {
    const [b] = mergeBlessings([gen('10010')], { '10010': { sources: [STEAM] } }, { '10010': { quality: 'r', quality_source: WIKI } });
    expect(b.sources).toEqual([STEAM]);
  });

  it('throws on community data for an unknown id', () => {
    expect(() => mergeBlessings([gen('10010')], {}, { '99999': { quality: 'r' } })).toThrow(
      'blessings.community.yaml: 未知的福佑 id "99999"',
    );
  });
});

describe('loadBlessingFiles', () => {
  const tempDirs: string[] = [];
  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  function makeRepo(generated: string, overrides?: string, community?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'fuyou-bless-'));
    tempDirs.push(root);
    mkdirSync(join(root, 'src/data'), { recursive: true });
    writeFileSync(join(root, 'src/data/blessings.generated.yaml'), generated);
    if (overrides !== undefined) writeFileSync(join(root, 'src/data/blessings.overrides.yaml'), overrides);
    if (community !== undefined) writeFileSync(join(root, 'src/data/blessings.community.yaml'), community);
    return root;
  }

  const generated = [
    "- { id: '10010', name: 电锤思维, summary: '获得 {gold} 金币', effect: '获得 {gold} 金币', tags: [经济] }",
    "- { id: '10091', name: 救救救救救, summary: 墓碑, effect: 墓碑 }",
    '',
  ].join('\n');

  it('merges both files', () => {
    const root = makeRepo(generated, "'10010':\n  quality: ssr\n  numbers: { gold: 3500 }\n  tags: [前期]\n");
    const out = loadBlessingFiles(root);
    expect(out.map((b) => b.id)).toEqual(['10010', '10091']);
    expect(out[0]).toMatchObject({ quality: 'ssr', numbers: { gold: 3500 }, tags: ['经济', '前期'] });
    expect(out[1].quality).toBeNull();
  });

  it('accepts an empty, comment-only or {} overrides file', () => {
    for (const overrides of ['', '# nothing yet\n', '{}\n']) {
      expect(loadBlessingFiles(makeRepo(generated, overrides))).toHaveLength(2);
    }
  });

  it('treats a missing overrides file as empty', () => {
    expect(loadBlessingFiles(makeRepo(generated))).toHaveLength(2);
  });

  it('names the file when validation fails', () => {
    expect(() => loadBlessingFiles(makeRepo("- { id: wolf, name: 甲, summary: s, effect: e }\n"))).toThrow(
      /blessings\.generated\.yaml/,
    );
    expect(() => loadBlessingFiles(makeRepo(generated, "'10010': { quality: ur }\n"))).toThrow(
      /blessings\.overrides\.yaml/,
    );
  });

  it('merges the community file with overrides taking precedence', () => {
    const community = [
      '# generated',
      "'10010':",
      '  quality: r',
      '  quality_source: http://122.51.0.76:8081/api/universal',
      "  numbers: { gold: 3000, pct: '10~20' }",
      "'10091':",
      '  quality: sr',
      '  tips:',
      '    - { text: 墓碑期间可以买东西, source: https://www.bilibili.com/video/BV1feAHzJEGH/, date: 2026-05-02 }',
      '',
    ].join('\n');
    const out = loadBlessingFiles(makeRepo(generated, "'10010':\n  quality: ssr\n  numbers: { gold: 3500 }\n", community));
    expect(out[0]).toMatchObject({ quality: 'ssr', quality_source: 'manual', numbers: { gold: 3500, pct: '10~20' } });
    expect(out[1]).toMatchObject({ quality: 'sr', quality_source: 'community' });
    // Unquoted YAML dates come back as strings.
    expect(out[1].tips[0].date).toBe('2026-05-02');
  });

  it('names the community file when it fails validation', () => {
    expect(() => loadBlessingFiles(makeRepo(generated, '', "'10010': { wiki_text: 原文 }\n"))).toThrow(
      /blessings\.community\.yaml/,
    );
  });

  it('reports unknown override ids', () => {
    expect(() => loadBlessingFiles(makeRepo(generated, "'12345': { quality: r }\n"))).toThrow(
      '未知的福佑 id "12345"',
    );
  });
});
