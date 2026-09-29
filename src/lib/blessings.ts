import { z } from 'astro/zod';
import { parseWith, readYaml } from './data-file';
import {
  blessingOverrideSchema,
  generatedBlessingSchema,
  type Blessing,
  type BlessingOverride,
  type GeneratedBlessing,
} from './schema';

export const GENERATED_FILE = 'src/data/blessings.generated.yaml';
export const OVERRIDES_FILE = 'src/data/blessings.overrides.yaml';

/**
 * Merge manual overrides onto generated blessings. Keeps the generated order;
 * tags are the automatic ones followed by any new manual ones.
 */
export function mergeBlessings(
  generated: GeneratedBlessing[],
  overrides: Record<string, BlessingOverride>,
): Blessing[] {
  const known = new Set(generated.map((g) => g.id));
  for (const id of Object.keys(overrides)) {
    if (!known.has(id)) throw new Error(`blessings.overrides.yaml: 未知的福佑 id "${id}"`);
  }
  return generated.map((g) => {
    const o = overrides[g.id] ?? {};
    return {
      id: g.id,
      name: g.name,
      name_en: g.name_en,
      quality: o.quality ?? null,
      summary: g.summary,
      effect: g.effect,
      tags: [...new Set([...g.tags, ...(o.tags ?? [])])],
      numbers: { ...o.numbers },
      icon: g.icon,
      exclusive_hero: o.exclusive_hero ?? null,
      since_version: o.since_version,
      sources: [...(o.sources ?? [])],
      history: (o.history ?? []).map((h) => ({ ...h })),
    };
  });
}

/** Read, validate and merge both blessing data files under `root`. The overrides file may be missing or empty. */
export function loadBlessingFiles(root: string): Blessing[] {
  const generated = parseWith(
    z.array(generatedBlessingSchema),
    readYaml(root, GENERATED_FILE, []),
    'blessings.generated.yaml',
  );
  const overrides = parseWith(
    z.record(z.string(), blessingOverrideSchema),
    readYaml(root, OVERRIDES_FILE, {}, { optional: true }),
    'blessings.overrides.yaml',
  );
  return mergeBlessings(generated, overrides);
}
