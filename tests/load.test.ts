import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDataSet, readFrontmatter } from '../src/lib/load';

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function makeRepo(generatedYaml: string, overridesYaml = ''): string {
  const root = mkdtempSync(join(tmpdir(), 'fuyou-'));
  tempDirs.push(root);
  mkdirSync(join(root, 'src/data'), { recursive: true });
  mkdirSync(join(root, 'src/content/builds'), { recursive: true });
  writeFileSync(join(root, 'src/data/blessings.generated.yaml'), generatedYaml);
  writeFileSync(join(root, 'src/data/blessings.overrides.yaml'), overridesYaml);
  writeFileSync(join(root, 'src/data/heroes.yaml'), '- { id: axe, name: 斧王, name_en: Axe, attr: str }\n');
  writeFileSync(join(root, 'src/data/items.yaml'), '[]\n');
  writeFileSync(join(root, 'src/data/versions.yaml'), '[]\n');
  writeFileSync(
    join(root, 'src/content/builds/axe.md'),
    '---\nhero: axe\nsummary: 跳吼\nupdated: 2026-09-20\n---\n正文\n',
  );
  return root;
}

describe('readFrontmatter', () => {
  it('parses YAML between --- fences', () => {
    expect(readFrontmatter('---\na: 1\n---\nbody')).toEqual({ a: 1 });
  });
  it('returns empty object when absent', () => {
    expect(readFrontmatter('no fm')).toEqual({});
  });
});

describe('loadDataSet', () => {
  it('loads merged blessings and applies schema defaults', () => {
    const root = makeRepo("- { id: '10010', name: 甲, summary: 短, effect: 效果 }\n", "'10010': { quality: sr }\n");
    const d = loadDataSet(root);
    expect(d.blessings[0]).toMatchObject({ id: '10010', quality: 'sr', tags: [], numbers: {} });
    expect(d.builds).toEqual([expect.objectContaining({ file: 'axe.md' })]);
    expect(d.builds[0].data.blessings).toEqual([]);
  });
  it('treats a missing hero-abilities.yaml as empty and loads it when present', () => {
    const root = makeRepo("- { id: '10010', name: 甲, summary: 短, effect: 效果 }\n");
    expect(loadDataSet(root).heroAbilities).toEqual([]);
    writeFileSync(
      join(root, 'src/data/hero-abilities.yaml'),
      '# header\n- hero: axe\n  abilities:\n    - { id: axe_berserkers_call, name: 狂战士之吼, name_en: "Berserker\'s Call" }\n',
    );
    expect(loadDataSet(root).heroAbilities).toEqual([
      { hero: 'axe', abilities: [{ id: 'axe_berserkers_call', name: '狂战士之吼', name_en: "Berserker's Call" }] },
    ]);
  });
  it('rejects a malformed hero-abilities.yaml', () => {
    const root = makeRepo("- { id: '10010', name: 甲, summary: 短, effect: 效果 }\n");
    writeFileSync(join(root, 'src/data/hero-abilities.yaml'), '- { hero: axe, abilities: [{ id: x }] }\n');
    expect(() => loadDataSet(root)).toThrow(/hero-abilities\.yaml/);
  });
  it('names the file when schema validation fails', () => {
    const root = makeRepo("- { id: '10010', name: '', summary: 短, effect: 效果 }\n");
    expect(() => loadDataSet(root)).toThrow(/blessings\.generated\.yaml/);
  });
});
