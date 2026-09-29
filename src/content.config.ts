import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { loadBlessingFiles } from './lib/blessings';
import { blessingSchema, buildSchema, guideSchema, heroSchema, itemSchema, versionSchema } from './lib/schema';

export const collections = {
  // Generated data merged with manual overrides; same logic as scripts/validate-data.ts.
  blessings: defineCollection({ loader: async () => loadBlessingFiles(process.cwd()), schema: blessingSchema }),
  heroes: defineCollection({ loader: file('src/data/heroes.yaml'), schema: heroSchema }),
  items: defineCollection({ loader: file('src/data/items.yaml'), schema: itemSchema }),
  versions: defineCollection({ loader: file('src/data/versions.yaml'), schema: versionSchema }),
  builds: defineCollection({ loader: glob({ base: './src/content/builds', pattern: '*.md' }), schema: buildSchema }),
  guides: defineCollection({ loader: glob({ base: './src/content/guides', pattern: '*.md' }), schema: guideSchema }),
};
