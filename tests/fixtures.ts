import { blessingSchema, buildSchema, heroSchema, itemSchema, versionSchema } from '../src/lib/schema';
import type { DataSet } from '../src/lib/integrity';

const hl = (s: string) => `<font color='#83d18a'>${s}</font>`;

export const blessings = [
  blessingSchema.parse({
    id: '10145',
    name: '狼王内丹',
    name_en: 'Arcana Pill',
    summary: `在双方泉水生成 ${hl('{count}')} 次狼王内丹，拾取后冷却时间减少 ${hl('+{pct}%')}`,
    effect: `${hl('{cd_min} - {cd_max}')} 秒后，在双方泉水生成 ${hl('{count}')} 次狼王内丹。`,
    numbers: { count: 3, pct: 8 },
    tags: ['法术'],
    since_version: '2026-09-01',
  }),
  blessingSchema.parse({
    id: '10010',
    name: '电锤思维',
    name_en: 'Maelstrom Mind',
    quality: 'ssr',
    summary: `获得 ${hl('{gold}')} 金币。首次携带黯灭时，将其升级为 ${hl('雷神之锤(真)')} 。`,
    effect: `获得 ${hl('{gold}')} 金币。首次携带黯灭时，将其升级为 ${hl('雷神之锤(真)')} ，可以和雷神之锤叠加。`,
    numbers: { gold: 3500 },
    tags: ['经济', '装备'],
    history: [{ version: '2026-09-01', change: '金币 3000→3500' }],
  }),
  blessingSchema.parse({
    id: '10091',
    name: '救救救救救',
    name_en: 'Help!',
    quality: 'r',
    summary: `阵亡后召唤墓碑，${hl('{time}')} 秒后复活，墓碑期间可以使用商店。`,
    effect: `阵亡后召唤墓碑，若墓碑附近 ${hl('{radius}')} 码内只有友军， ${hl('{time}')} 秒后原地复活。`,
    numbers: { time: 3 },
    tags: ['生存', '经济'],
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
    changes: [{ blessing: '10010', text: '金币 3000→3500' }],
  }),
];

export const builds = [
  {
    file: 'axe.md',
    data: buildSchema.parse({
      hero: 'axe',
      summary: '跳吼开团',
      blessings: [{ id: '10010', note: '前期经济' }, { id: '10145' }],
      items: ['blink'],
      updated: '2026-09-20',
    }),
  },
];

export function validSet(): DataSet {
  return structuredClone({ blessings, heroes, items, versions, builds, heroAbilities: [] });
}
