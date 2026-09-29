import { describe, expect, it } from 'vitest';
import { buildGenerated, diffGenerated, versionEntryFromDiff } from '../src/lib/bless-import';
import { generatedBlessingSchema, type GeneratedBlessing } from '../src/lib/schema';

const HEADER = ['Tokens', 'Schinese', 'English', 'Russian'];
const hl = (s: string) => `<font color='#83d18a'>${s}</font>`;

const table = (rows: [string, string, string?][]) => [HEADER, ...rows.map(([t, zh, en = '']) => [t, zh, en, ''])];

const gen = (id: string, extra: Partial<GeneratedBlessing> = {}): GeneratedBlessing =>
  generatedBlessingSchema.parse({ id, name: `福佑${id}`, summary: `短${id}`, effect: `长${id}`, ...extra });

describe('buildGenerated', () => {
  const names = table([
    ['bless_10010', '电锤思维', ' Maelstrom Mind '],
    ['bless_10004a', '战术目镜已启动（SP：输出）', 'Tactical Visor (SP)'],
    ['bless_10004', '战术目镜已启动', 'Long Long Long'],
    ['bless_10099', '', 'Placeholder'],
    ['bless_10005', '三寸长三寸强', 'Long (Melee)'],
    ['bless_100043', '六位数', 'Six'],
    ['bless_abc', '坏 id', 'Bad'],
  ]);
  const desc = table([
    ['bless_10010_desc', `获得 ${hl('{gold}')} 金币。首次携带黯灭时，将其升级为雷神之锤。`],
    ['bless_10004_desc', '攻击距离增加 {range}。'],
    ['bless_10004a_desc', '攻击距离增加 {range}，攻击力增加。'],
    ['bless_100043_desc', '移动速度增加。'],
  ]);
  const short = table([
    ['bless_10010_desc_short', `获得 ${hl('{gold}')} 金币。`],
    ['bless_10004_desc_short', '攻击距离增加。'],
    ['bless_10005_desc_short', '近战攻击距离增加。'],
  ]);
  const iconIds = new Set(['10010', '10004', '10005']);
  const { blessings, skipped } = buildGenerated({ names, desc, short, iconIds });
  const byId = new Map(blessings.map((b) => [b.id, b]));

  it('sorts ids naturally (numeric part, then suffix)', () => {
    expect(blessings.map((b) => b.id)).toEqual(['10004', '10004a', '10005', '10010', '100043']);
  });

  it('skips empty names and malformed ids, reporting them', () => {
    expect(skipped).toEqual(['10099', 'abc']);
  });

  it('uses the short description as summary and the full one as effect, with fallbacks', () => {
    expect(byId.get('10010')).toMatchObject({
      name: '电锤思维',
      name_en: 'Maelstrom Mind',
      summary: `获得 ${hl('{gold}')} 金币。`,
      effect: `获得 ${hl('{gold}')} 金币。首次携带黯灭时，将其升级为雷神之锤。`,
    });
    // No short description -> summary falls back to the full one.
    expect(byId.get('10004a')!.summary).toBe('攻击距离增加 {range}，攻击力增加。');
    // No full description -> effect falls back to the short one.
    expect(byId.get('10005')!.effect).toBe('近战攻击距离增加。');
  });

  it('derives tags from the plain-text effect', () => {
    expect(byId.get('10010')!.tags).toEqual(['经济', '装备']);
    expect(byId.get('100043')!.tags).toEqual(['移动']);
  });

  it('picks the own icon, then the base-id icon for SP variants, else none', () => {
    expect(byId.get('10010')!.icon).toBe('10010.webp');
    expect(byId.get('10004a')!.icon).toBe('10004.webp');
    expect(byId.get('100043')!.icon).toBeUndefined();
    expect('icon' in byId.get('100043')!).toBe(false);
  });

  it('finds columns by header name', () => {
    const swapped = [
      ['English', 'Tokens', 'Schinese'],
      ['Axe', 'bless_10001', '斧头'],
    ];
    const out = buildGenerated({ names: swapped, desc: [HEADER], short: [HEADER], iconIds: new Set() });
    expect(out.blessings[0]).toMatchObject({ id: '10001', name: '斧头', name_en: 'Axe' });
  });

  it('throws when a required column is missing', () => {
    expect(() =>
      buildGenerated({ names: [['Tokens', 'English']], desc: [HEADER], short: [HEADER], iconIds: new Set() }),
    ).toThrow(/Schinese/);
  });
});

describe('diffGenerated', () => {
  it('reports added, removed and changed blessings', () => {
    const prev = [gen('10001'), gen('10002'), gen('10003', { tags: ['攻击'] })];
    const next = [
      gen('10001', { name: '新名', effect: '新效果' }),
      gen('10003', { tags: ['法术'], icon: '10003.webp' }),
      gen('10004'),
    ];
    const diff = diffGenerated(prev, next);
    expect(diff.added.map((b) => b.id)).toEqual(['10004']);
    expect(diff.removed.map((b) => b.id)).toEqual(['10002']);
    // Tag / icon differences are not reported.
    expect(diff.changed).toEqual([{ id: '10001', name: '新名', fields: ['name', 'effect'] }]);
  });

  it('is empty for identical input', () => {
    const list = [gen('10001'), gen('10002')];
    expect(diffGenerated(list, list)).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe('versionEntryFromDiff', () => {
  it('writes one change per added, changed and removed blessing', () => {
    const diff = diffGenerated(
      [gen('10001'), gen('10002', { name: '旧福佑' })],
      [gen('10001', { summary: '改', name_en: 'X' }), gen('10003')],
    );
    expect(versionEntryFromDiff(diff, '2026-09-21', '9 月更新')).toEqual({
      id: '2026-09-21',
      title: '9 月更新',
      changes: [
        { blessing: '10003', text: '新增' },
        { blessing: '10001', text: '英文名、简述变更' },
        { blessing: null, text: '移除：旧福佑（10002）' },
      ],
    });
  });
});
