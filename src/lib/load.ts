import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';
import { loadBlessingFiles } from './blessings';
import { parseWith, readYaml } from './data-file';
import { buildSchema, heroSchema, itemSchema, versionSchema } from './schema';
import type { DataSet } from './integrity';

function readYamlArray<T extends z.ZodType>(root: string, rel: string, schema: T): z.infer<T>[] {
  return parseWith(z.array(schema), readYaml(root, rel, []), rel);
}

export function readFrontmatter(src: string): unknown {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  return m ? (parse(m[1]) ?? {}) : {};
}

export function loadDataSet(root: string): DataSet {
  const buildsDir = join(root, 'src/content/builds');
  const buildFiles = existsSync(buildsDir) ? readdirSync(buildsDir).filter((f) => f.endsWith('.md')) : [];
  return {
    blessings: loadBlessingFiles(root),
    heroes: readYamlArray(root, 'src/data/heroes.yaml', heroSchema),
    items: readYamlArray(root, 'src/data/items.yaml', itemSchema),
    versions: readYamlArray(root, 'src/data/versions.yaml', versionSchema),
    builds: buildFiles.map((file) => ({
      file,
      data: parseWith(buildSchema, readFrontmatter(readFileSync(join(buildsDir, file), 'utf8')), `builds/${file}`),
    })),
  };
}
