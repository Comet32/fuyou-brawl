import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';

/** Validate `raw` against `schema`, naming `label` (usually the file) in the error. */
export function parseWith<T extends z.ZodType>(schema: T, raw: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${label} 校验失败：\n${z.prettifyError(result.error)}`);
  return result.data;
}

/** Parse a YAML file relative to `root`. Empty or comment-only files yield `fallback`, as do missing ones when allowed. */
export function readYaml(root: string, rel: string, fallback: unknown, { optional = false } = {}): unknown {
  const path = join(root, rel);
  if (optional && !existsSync(path)) return fallback;
  return parse(readFileSync(path, 'utf8')) ?? fallback;
}
