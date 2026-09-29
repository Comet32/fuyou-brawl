// Display metadata for cited source URLs (src/data/sources.yaml), so guides show titles instead of bare links.
import { z } from 'astro/zod';
import { readYaml } from './data-file';
import { parseWith } from './parse';

export const SOURCES_FILE = 'src/data/sources.yaml';

export const sourceEntrySchema = z.strictObject({
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().min(1),
  site: z.string().min(1),
  // Free text: a day, a month or a span ("2026-02 至 2026-09").
  date: z.string().min(1).optional(),
});
export type SourceEntry = z.infer<typeof sourceEntrySchema>;

const normalize = (u: string) => u.replace(/\/+$/, '');

/** Title · site · date for a URL, or just its hostname when the registry does not know it. */
export function describeSource(url: string, entries: SourceEntry[]): { href: string; parts: string[] } {
  const e = entries.find((x) => normalize(x.url) === normalize(url));
  if (e) return { href: url, parts: [e.title, e.site, ...(e.date ? [e.date] : [])] };
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // Not a URL; show it as is.
  }
  return { href: url, parts: [host] };
}

export function loadSources(root: string): SourceEntry[] {
  return parseWith(z.array(sourceEntrySchema), readYaml(root, SOURCES_FILE, [], { optional: true }), 'sources.yaml');
}
