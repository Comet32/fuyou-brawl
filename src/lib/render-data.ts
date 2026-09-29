// Data for page rendering, bundled by Vite (`?raw`) instead of read with node:fs, so pages prerender
// in any runtime — Node for GitHub Pages, workerd when Cloudflare builds with its adapter.
// Scripts keep using load.ts, which reads the same files from disk.
import { parse } from 'yaml';
import { z } from 'astro/zod';
import generatedRaw from '../data/blessings.generated.yaml?raw';
import overridesRaw from '../data/blessings.overrides.yaml?raw';
import communityRaw from '../data/blessings.community.yaml?raw';
import heroesRaw from '../data/heroes.yaml?raw';
import heroAbilitiesRaw from '../data/hero-abilities.yaml?raw';
import heroColorsRaw from '../data/hero-colors.yaml?raw';
import blessingColorsRaw from '../data/blessing-colors.yaml?raw';
import sourcesRaw from '../data/sources.yaml?raw';
import { parseBlessingDocs } from './blessings';
import { parseWith } from './parse';
import { sourceEntrySchema, type SourceEntry } from './sources';
import {
  blessingColorsSchema,
  heroAbilitiesSchema,
  heroColorsSchema,
  heroSchema,
  type Blessing,
  type Hero,
} from './schema';

type HeroAbilities = z.infer<typeof heroAbilitiesSchema>;

const once = <T>(make: () => T): (() => T) => {
  let value: T | undefined;
  return () => (value ??= make());
};

export const renderBlessings = once((): Blessing[] => parseBlessingDocs(parse(generatedRaw), parse(overridesRaw), parse(communityRaw)));
export const renderHeroes = once((): Hero[] => parseWith(z.array(heroSchema), parse(heroesRaw) ?? [], 'heroes.yaml'));
export const renderHeroAbilities = once((): HeroAbilities[] =>
  parseWith(z.array(heroAbilitiesSchema), parse(heroAbilitiesRaw) ?? [], 'hero-abilities.yaml'),
);
export const renderHeroColors = once((): Record<string, string> =>
  parseWith(heroColorsSchema, parse(heroColorsRaw) ?? {}, 'hero-colors.yaml'),
);
export const renderBlessingColors = once((): Record<string, string> =>
  parseWith(blessingColorsSchema, parse(blessingColorsRaw) ?? {}, 'blessing-colors.yaml'),
);
export const renderSources = once((): SourceEntry[] => parseWith(z.array(sourceEntrySchema), parse(sourcesRaw) ?? [], 'sources.yaml'));
