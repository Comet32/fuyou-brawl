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
      summary: '短10010',
      effect: '长10010',
      tags: [],
      numbers: {},
      icon: '10010.webp',
      exclusive_hero: null,
      sources: [],
      history: [],
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

  it('does not mutate its inputs', () => {
    const g = [gen('10010', { tags: ['经济'] })];
    const o = { '10010': { tags: ['前期'] } };
    mergeBlessings(g, o);
    expect(g[0].tags).toEqual(['经济']);
    expect(o['10010'].tags).toEqual(['前期']);
  });
});

describe('loadBlessingFiles', () => {
  const tempDirs: string[] = [];
  afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  function makeRepo(generated: string, overrides?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'fuyou-bless-'));
    tempDirs.push(root);
    mkdirSync(join(root, 'src/data'), { recursive: true });
    writeFileSync(join(root, 'src/data/blessings.generated.yaml'), generated);
    if (overrides !== undefined) writeFileSync(join(root, 'src/data/blessings.overrides.yaml'), overrides);
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

  it('reports unknown override ids', () => {
    expect(() => loadBlessingFiles(makeRepo(generated, "'12345': { quality: r }\n"))).toThrow(
      '未知的福佑 id "12345"',
    );
  });
});
