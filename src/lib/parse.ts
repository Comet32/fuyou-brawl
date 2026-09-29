import { z } from 'astro/zod';

/** Validate `raw` against `schema`, naming `label` (usually the file) in the error. */
export function parseWith<T extends z.ZodType>(schema: T, raw: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`${label} 校验失败：\n${z.prettifyError(result.error)}`);
  return result.data;
}
