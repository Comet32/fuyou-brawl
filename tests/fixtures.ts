import { blessingSchema, buildSchema, heroSchema, itemSchema, versionSchema } from '../src/lib/schema';
import type { DataSet } from '../src/lib/integrity';

export const blessings = [
  blessingSchema.parse({
    id: 'wolf-core',
    name: '狼王核心',
    category: '团队类',
    effect: '在双方泉水生成 3 个狼王核心，拾取者冷却缩减 8%',
    numbers: { 冷却缩减: '8%' },
    tags: ['冷却'],
    since_version: '2026-09-01',
  }),
  blessingSchema.parse({
    id: 'electric-hammer',
    name: '电锤思维',
    category: '装备类',
    effect: '获得 3500 金币，携带的第一把深渊之刃升级为雷神之锤（真）',
    numbers: { 金币: 3500 },
    tags: ['经济', '前期'],
    history: [{ version: '2026-09-01', change: '金币 3000→3500' }],
  }),
  blessingSchema.parse({
    id: 'rescue',
    name: '救援',
    category: '其他',
    effect: '死亡后留下墓碑，3 秒后可在队友附近复活，期间可以购物',
    exclusive_hero: 'axe',
  }),
];

export const heroes = [
  heroSchema.parse({ id: 'axe', name: '斧王', name_en: 'Axe', attr: 'str' }),
  heroSchema.parse({ id: 'antimage', name: '敌法师', name_en: 'Anti-Mage', attr: 'agi' }),
];

export const items = [
  itemSchema.parse({ id: 'abyssal_blade', name: '深渊之刃', name_en: 'Abyssal Blade' }),
  itemSchema.parse({ id: 'blink', name: '闪烁匕首', name_en: 'Blink Dagger' }),
];

export const versions = [
  versionSchema.parse({
    id: '2026-09-01',
    title: '秋季更新',
    changes: [{ blessing: 'electric-hammer', text: '金币 3000→3500' }],
  }),
];

export const builds = [
  {
    file: 'axe.md',
    data: buildSchema.parse({
      hero: 'axe',
      summary: '跳吼开团',
      blessings: [{ id: 'electric-hammer', note: '前期经济' }, { id: 'wolf-core' }],
      items: ['blink'],
      updated: '2026-09-20',
    }),
  },
];

export function validSet(): DataSet {
  return structuredClone({ blessings, heroes, items, versions, builds });
}
