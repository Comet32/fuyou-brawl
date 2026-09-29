import type { Blessing, Build, Hero, HeroAbilities, Item, Version } from './schema';

export interface DataSet {
  blessings: Blessing[];
  heroes: Hero[];
  heroAbilities: HeroAbilities[];
  /** Placeholder colors of hero portraits (hero id -> #rrggbb). */
  heroColors?: Record<string, string>;
  items: Item[];
  versions: Version[];
  builds: { file: string; data: Build }[];
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

export function findBrokenRefs(d: DataSet): string[] {
  const errors: string[] = [];
  const blessingIds = new Set(d.blessings.map((b) => b.id));
  const heroIds = new Set(d.heroes.map((h) => h.id));
  const itemIds = new Set(d.items.map((i) => i.id));
  const versionIds = new Set(d.versions.map((v) => v.id));

  for (const id of duplicates(d.blessings.map((b) => b.id))) errors.push(`福佑 id 重复：${id}`);
  for (const id of duplicates(d.heroes.map((h) => h.id))) errors.push(`英雄 id 重复：${id}`);
  for (const id of duplicates(d.items.map((i) => i.id))) errors.push(`装备 id 重复：${id}`);
  for (const id of duplicates(d.versions.map((v) => v.id))) errors.push(`版本 id 重复：${id}`);

  for (const b of d.blessings) {
    if (b.exclusive_hero && !heroIds.has(b.exclusive_hero)) {
      errors.push(`福佑 ${b.id}：exclusive_hero "${b.exclusive_hero}" 不存在`);
    }
    for (const hero of b.heroes ?? []) {
      if (!heroIds.has(hero)) errors.push(`福佑 ${b.id}：heroes 中的英雄 "${hero}" 不存在`);
    }
    for (const { hero } of b.recommended_heroes) {
      if (!heroIds.has(hero)) errors.push(`福佑 ${b.id}：社区推荐英雄 "${hero}" 不存在`);
    }
    if (b.since_version && !versionIds.has(b.since_version)) {
      errors.push(`福佑 ${b.id}：since_version "${b.since_version}" 不在 versions.yaml 中`);
    }
    for (const h of b.history) {
      if (!versionIds.has(h.version)) {
        errors.push(`福佑 ${b.id}：history 版本 "${h.version}" 不在 versions.yaml 中`);
      }
    }
  }

  for (const { hero } of d.heroAbilities) {
    if (!heroIds.has(hero)) errors.push(`hero-abilities：英雄 "${hero}" 不存在`);
  }
  for (const hero of duplicates(d.heroAbilities.map((h) => h.hero))) errors.push(`hero-abilities：英雄 ${hero} 重复`);
  for (const hero of Object.keys(d.heroColors ?? {})) {
    if (!heroIds.has(hero)) errors.push(`hero-colors：英雄 "${hero}" 不存在`);
  }

  for (const v of d.versions) {
    for (const c of v.changes) {
      if (c.blessing && !blessingIds.has(c.blessing)) {
        errors.push(`版本 ${v.id}：引用了不存在的福佑 "${c.blessing}"`);
      }
    }
  }

  for (const { file, data } of d.builds) {
    if (file !== `${data.hero}.md`) errors.push(`搭配 ${file}：文件名应为 ${data.hero}.md`);
    if (!heroIds.has(data.hero)) errors.push(`搭配 ${file}：英雄 "${data.hero}" 不存在`);
    for (const ref of data.blessings) {
      if (!blessingIds.has(ref.id)) errors.push(`搭配 ${file}：福佑 "${ref.id}" 不存在`);
    }
    for (const item of data.items) {
      if (!itemIds.has(item)) errors.push(`搭配 ${file}：装备 "${item}" 不存在`);
    }
  }
  for (const hero of duplicates(d.builds.map((b) => b.data.hero))) {
    errors.push(`英雄 ${hero} 有多个搭配文件`);
  }

  return errors;
}
