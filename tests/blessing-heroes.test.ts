import { describe, expect, it } from 'vitest';
import { blessingsByHero, linkBlessingHeroes } from '../src/lib/blessing-heroes';

const hl = (s: string) => `<font color='#83d18a'>${s}</font>`;
const ability = (id: string, name: string) => ({ id, name, name_en: name });

const heroes = [
  { id: 'antimage', name: '敌法师' },
  { id: 'nevermore', name: '影魔' },
  { id: 'naga_siren', name: '娜迦海妖' },
  { id: 'night_stalker', name: '暗夜魔王' },
  { id: 'axe', name: '斧王' },
  { id: 'sven', name: '斯温' },
];
const heroAbilities = [
  { hero: 'antimage', abilities: [ability('antimage_mana_break', '法力损毁'), ability('antimage_blink', '闪烁')] },
  { hero: 'nevermore', abilities: [ability('nevermore_shadowraze1', '毁灭阴影'), ability('nevermore_necromastery', '魂之挽歌')] },
  { hero: 'naga_siren', abilities: [ability('naga_siren_mirror_image', '镜像'), ability('naga_siren_song', '海妖之歌'), ability('naga_siren_carapace', '海妖外壳')] },
  { hero: 'axe', abilities: [ability('axe_culling_blade', '淘汰之刃'), ability('axe_call', '吼'), ability('axe_blade', '刃')] },
  { hero: 'sven', abilities: [ability('sven_gods_strength', '天神下凡'), ability('sven_blink', '闪烁')] },
];

const b = (id: string, name: string, effect = '获得一些属性。') => ({ id, name, effect });
const link = (blessings: ReturnType<typeof b>[]) => linkBlessingHeroes(blessings, heroAbilities, heroes);

describe('linkBlessingHeroes', () => {
  it('links a blessing whose name contains an ability name', () => {
    const links = link([b('10001', '法力损毁强化')]);
    expect(links.get('10001')).toEqual([{ hero: 'antimage', ability: '法力损毁' }]);
  });

  it('links via a bracketed ability name in the plain-text effect', () => {
    const links = link([b('10002', '贝壳', `获得 ${hl('[海妖外壳]')} 的效果。`)]);
    expect(links.get('10002')).toEqual([{ hero: 'naga_siren', ability: '海妖外壳' }]);
  });

  it('ignores bracketed text that is not an exact ability name', () => {
    expect(link([b('10003', '甲', '获得 [风] 和 [海妖外壳强化] 的效果。')]).has('10003')).toBe(false);
  });

  it('prefers the longest matching ability name over a contained shorter one', () => {
    // Both "天神下凡" and the longer "天神下凡强化" match the name; only the longer is kept.
    const longer = [
      ...heroAbilities,
      { hero: 'sven', abilities: [ability('sven_x', '天神下凡强化')] },
    ];
    const links = linkBlessingHeroes([b('10004', '天神下凡强化')], longer, heroes);
    expect(links.get('10004')).toEqual([{ hero: 'sven', ability: '天神下凡强化' }]);
  });

  it('links several heroes when distinct abilities match', () => {
    const links = link([b('10005', '毁灭阴影与法力损毁')]);
    expect(links.get('10005')).toEqual([
      { hero: 'antimage', ability: '法力损毁' },
      { hero: 'nevermore', ability: '毁灭阴影' },
    ]);
  });

  it('links by exact hero name in the blessing name', () => {
    const links = link([b('10006', '暗夜魔王强化')]);
    expect(links.get('10006')).toEqual([{ hero: 'night_stalker', ability: '' }]);
  });

  it('does not add a hero-name link when the hero is already linked by an ability', () => {
    const links = link([b('10007', '敌法师的法力损毁')]);
    expect(links.get('10007')).toEqual([{ hero: 'antimage', ability: '法力损毁' }]);
  });

  it('never matches 1-character ability names', () => {
    // axe has abilities "吼" and "刃"
    expect(link([b('10008', '吼叫之刃', '刃 [吼]')]).has('10008')).toBe(false);
  });

  it('drops an ability name shared by several heroes unless a hero name disambiguates it', () => {
    // antimage and sven both have "闪烁"
    expect(link([b('10009', '闪烁强化')]).has('10009')).toBe(false);
    const links = link([b('10011', '闪烁强化', '斯温的技能距离增加。')]);
    expect(links.get('10011')).toEqual([{ hero: 'sven', ability: '闪烁' }]);
  });

  it('omits blessings without any match', () => {
    const links = link([b('10010', '普通福佑', '获得 {gold} 金币。')]);
    expect(links.size).toBe(0);
  });
});

describe('blessingsByHero', () => {
  it('inverts the links, keeping blessing order', () => {
    const links = link([b('10001', '法力损毁强化'), b('10002', '强化的法力损毁'), b('10003', '暗夜魔王')]);
    const byHero = blessingsByHero(links);
    expect(byHero.get('antimage')).toEqual([
      { blessing: '10001', ability: '法力损毁' },
      { blessing: '10002', ability: '法力损毁' },
    ]);
    expect(byHero.get('night_stalker')).toEqual([{ blessing: '10003', ability: '' }]);
    expect(byHero.has('axe')).toBe(false);
  });
});
