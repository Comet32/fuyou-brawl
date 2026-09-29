import { z } from 'astro/zod';
import { parseWith, readYaml } from './data-file';
import {
  blessingCommunitySchema,
  blessingOverrideSchema,
  generatedBlessingSchema,
  type Blessing,
  type BlessingCommunity,
  type BlessingOverride,
  type GeneratedBlessing,
} from './schema';

export const GENERATED_FILE = 'src/data/blessings.generated.yaml';
export const OVERRIDES_FILE = 'src/data/blessings.overrides.yaml';
export const COMMUNITY_FILE = 'src/data/blessings.community.yaml';

function assertKnown(ids: string[], known: Set<string>, file: string): void {
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`${file}: 未知的福佑 id "${id}"`);
  }
}

/**
 * Merge community data and manual overrides onto generated blessings, with precedence
 * overrides (manual) > community > generated. Keeps the generated order; tags are the automatic
 * ones followed by any new manual ones; numbers merge key by key; manual tips come first.
 */
export function mergeBlessings(
  generated: GeneratedBlessing[],
  overrides: Record<string, BlessingOverride>,
  community: Record<string, BlessingCommunity> = {},
): Blessing[] {
  const known = new Set(generated.map((g) => g.id));
  assertKnown(Object.keys(overrides), known, 'blessings.overrides.yaml');
  assertKnown(Object.keys(community), known, 'blessings.community.yaml');
  return generated.map((g) => {
    const o = overrides[g.id] ?? {};
    const c = community[g.id] ?? {};
    const manualNumbers = o.numbers ?? {};
    // Only community values that survived the merge keep their source link.
    const numberSources = Object.fromEntries(
      Object.entries(c.number_sources ?? {}).filter(([k]) => !Object.hasOwn(manualNumbers, k)),
    );
    const quality = o.quality ?? c.quality ?? null;
    const qualitySource = o.quality ? 'manual' : c.quality ? 'community' : null;
    return {
      id: g.id,
      name: g.name,
      name_en: g.name_en,
      quality,
      quality_source: qualitySource,
      quality_url: qualitySource === 'community' ? c.quality_source : undefined,
      quality_note: quality === null ? c.notes : undefined,
      summary: g.summary,
      effect: g.effect,
      tags: [...new Set([...g.tags, ...(o.tags ?? [])])],
      numbers: { ...c.numbers, ...manualNumbers },
      number_sources: numberSources,
      icon: g.icon,
      exclusive_hero: o.exclusive_hero ?? null,
      heroes: o.heroes ? [...o.heroes] : undefined,
      since_version: o.since_version,
      sources: [...(o.sources ?? [])],
      history: (o.history ?? []).map((h) => ({ ...h })),
      tips: [...(o.tips ?? []), ...(c.tips ?? [])].map((t) => ({ ...t })),
      wiki_notes: (c.wiki_notes ?? []).map((t) => ({ ...t })),
      changes: (c.changes ?? []).map((ch) => ({ ...ch })),
      quality_conflict: quality === null ? (c.quality_conflict ?? []).map((q) => ({ ...q })) : [],
      recommended_heroes: (c.recommended_heroes ?? []).map((r) => ({ ...r })),
    };
  });
}

/**
 * Read, validate and merge the blessing data files under `root`.
 * The overrides and community files may be missing or empty.
 */
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
  const community = parseWith(
    z.record(z.string(), blessingCommunitySchema),
    readYaml(root, COMMUNITY_FILE, {}, { optional: true }),
    'blessings.community.yaml',
  );
  return mergeBlessings(generated, overrides, community);
}
