import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { blessingSchema, buildSchema, guideSchema, heroSchema, itemSchema, versionSchema } from './lib/schema';

export const collections = {
  blessings: defineCollection({ loader: file('src/data/blessings.yaml'), schema: blessingSchema }),
  heroes: defineCollection({ loader: file('src/data/heroes.yaml'), schema: heroSchema }),
  items: defineCollection({ loader: file('src/data/items.yaml'), schema: itemSchema }),
  versions: defineCollection({ loader: file('src/data/versions.yaml'), schema: versionSchema }),
  builds: defineCollection({ loader: glob({ base: './src/content/builds', pattern: '*.md' }), schema: buildSchema }),
  guides: defineCollection({ loader: glob({ base: './src/content/guides', pattern: '*.md' }), schema: guideSchema }),
};
