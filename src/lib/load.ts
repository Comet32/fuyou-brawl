import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { blessingSchema, buildSchema, heroSchema, itemSchema, versionSchema } from './schema';
import type { DataSet } from './integrity';

function parseWith<T extends z.ZodType>(schema: T, raw: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${label} 校验失败：\n${z.prettifyError(result.error)}`);
  return result.data;
}

function readYamlArray<T extends z.ZodType>(root: string, rel: string, schema: T): z.infer<T>[] {
  const raw = parse(readFileSync(join(root, rel), 'utf8')) ?? [];
  return parseWith(z.array(schema), raw, rel);
}

export function readFrontmatter(src: string): unknown {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  return m ? (parse(m[1]) ?? {}) : {};
}

export function loadDataSet(root: string): DataSet {
  const buildsDir = join(root, 'src/content/builds');
  const buildFiles = existsSync(buildsDir) ? readdirSync(buildsDir).filter((f) => f.endsWith('.md')) : [];
  return {
    blessings: readYamlArray(root, 'src/data/blessings.yaml', blessingSchema),
    heroes: readYamlArray(root, 'src/data/heroes.yaml', heroSchema),
    items: readYamlArray(root, 'src/data/items.yaml', itemSchema),
    versions: readYamlArray(root, 'src/data/versions.yaml', versionSchema),
    builds: buildFiles.map((file) => ({
      file,
      data: parseWith(buildSchema, readFrontmatter(readFileSync(join(buildsDir, file), 'utf8')), `builds/${file}`),
    })),
  };
}
