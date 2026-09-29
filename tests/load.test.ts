import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataSet, readFrontmatter } from '../src/lib/load';

function makeRepo(blessingsYaml: string): string {
  const root = mkdtempSync(join(tmpdir(), 'fuyou-'));
  mkdirSync(join(root, 'src/data'), { recursive: true });
  mkdirSync(join(root, 'src/content/builds'), { recursive: true });
  writeFileSync(join(root, 'src/data/blessings.yaml'), blessingsYaml);
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
  it('loads and applies schema defaults', () => {
    const root = makeRepo('- { id: x, name: 甲, category: 其他, effect: 效果 }\n');
    const d = loadDataSet(root);
    expect(d.blessings[0].tags).toEqual([]);
    expect(d.builds).toEqual([expect.objectContaining({ file: 'axe.md' })]);
    expect(d.builds[0].data.blessings).toEqual([]);
  });
  it('names the file when schema validation fails', () => {
    const root = makeRepo('- { id: x, name: 甲, category: 不存在的分类, effect: 效果 }\n');
    expect(() => loadDataSet(root)).toThrow(/blessings\.yaml/);
  });
});
