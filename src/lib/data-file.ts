import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
export { parseWith } from './parse';


/** Parse a YAML file relative to `root`. Empty or comment-only files yield `fallback`, as do missing ones when allowed. */
export function readYaml(root: string, rel: string, fallback: unknown, { optional = false } = {}): unknown {
  const path = join(root, rel);
  if (optional && !existsSync(path)) return fallback;
  return parse(readFileSync(path, 'utf8')) ?? fallback;
}
