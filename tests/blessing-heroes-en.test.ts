import { describe, expect, it } from 'vitest';
import { linkBlessingHeroes, withManualHeroes } from '../src/lib/blessing-heroes';

const heroes = [
  { id: 'bristleback', name: '钢背兽', name_en: 'Bristleback' },
  { id: 'lion', name: '莱恩', name_en: 'Lion' },
  { id: 'lina', name: '莉娜', name_en: 'Lina' },
  { id: 'antimage', name: '敌法师', name_en: 'Anti-Mage' },
  { id: 'queenofpain', name: '痛苦女王', name_en: 'Queen of Pain' },
];
const heroAbilities = [
  { hero: 'bristleback', abilities: [{ id: 'bristleback_bristleback', name: '刚毛后背', name_en: 'Bristleback' }] },
  { hero: 'lion', abilities: [{ id: 'lion_finger_of_death', name: '死亡一指', name_en: 'Finger of Death' }] },
  { hero: 'lina', abilities: [{ id: 'lina_laguna_blade', name: '神灭斩', name_en: 'Laguna Blade' }] },
  { hero: 'antimage', abilities: [{ id: 'antimage_blink', name: '闪烁', name_en: 'Blink' }] },
  { hero: 'queenofpain', abilities: [{ id: 'queenofpain_blink', name: '闪烁', name_en: 'Blink' }] },
];
const b = (id: string, name: string, name_en: string, effect = '获得一些属性。') => ({ id, name, name_en, effect });
const link = (list: ReturnType<typeof b>[]) => linkBlessingHeroes(list, heroAbilities, heroes);

describe('linkBlessingHeroes: English pass', () => {
  it('links by an English ability name when no Chinese name matched', () => {
    expect(link([b('100040', '刚毛强化', 'Bristle Up: Bristleback')]).get('100040')).toEqual([
      { hero: 'bristleback', ability: '刚毛后背' },
    ]);
    expect(link([b('100155', '一指强化', 'Finger of Death Upgrade')]).get('100155')).toEqual([
      { hero: 'lion', ability: '死亡一指' },
    ]);
  });
  it('matches case-insensitively on word boundaries only', () => {
    expect(link([b('100001', '甲', 'finger of death+')]).get('100001')).toEqual([{ hero: 'lion', ability: '死亡一指' }]);
    expect(link([b('100002', '乙', 'Blinking Lights')]).has('100002')).toBe(false);
  });
  it('links by a hero English name', () => {
    expect(link([b('100003', '丙', 'Lina Fire')]).get('100003')).toEqual([{ hero: 'lina', ability: '' }]);
  });
  it('keeps Chinese matches first and skips the English pass', () => {
    expect(link([b('100004', '神灭斩强化', 'Finger of Death')]).get('100004')).toEqual([
      { hero: 'lina', ability: '神灭斩' },
    ]);
  });
  it('drops a shared English ability name unless the hero is named', () => {
    expect(link([b('100005', '丁', 'Blink Upgrade')]).has('100005')).toBe(false);
    expect(link([b('100006', '戊', 'Queen of Pain Blink')]).get('100006')).toEqual([
      { hero: 'queenofpain', ability: '闪烁' },
    ]);
  });
});

describe('withManualHeroes', () => {
  it('replaces auto links with the manual list, keeping known ability names', () => {
    const auto = new Map([
      ['1', [{ hero: 'lion', ability: '死亡一指' }, { hero: 'lina', ability: '' }]],
      ['2', [{ hero: 'lina', ability: '神灭斩' }]],
    ]);
    const out = withManualHeroes(auto, [
      { id: '1', heroes: ['lion'] },
      { id: '2', heroes: [] },
      { id: '3', heroes: ['antimage'] },
      { id: '4' },
    ]);
    expect(out.get('1')).toEqual([{ hero: 'lion', ability: '死亡一指' }]);
    expect(out.has('2')).toBe(false);
    expect(out.get('3')).toEqual([{ hero: 'antimage', ability: '' }]);
    expect(auto.get('2')).toHaveLength(1); // input untouched
  });
});
