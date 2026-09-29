import { describe, expect, it } from 'vitest';
import { placeholderLabels } from '../src/lib/stat-labels';

const hl = (s: string) => `<font color='#83d18a'>${s}</font>`;

describe('placeholderLabels', () => {
  it('uses the words before the value, without operators or 固定为', () => {
    // 10001 铁剑在必得
    const tpl = `攻击距离固定为 ${hl('{range}')}，吸血 ${hl('+{xx}%')}，移动速度、总攻击力、生命值、攻击速度 ${hl('+{ysI}%')}。`;
    expect(placeholderLabels(tpl)).toEqual({ range: '攻击距离', xx: '吸血', ysI: '移动速度等' });
  });

  it('uses the words after the value when only a verb precedes it', () => {
    // 10010 电锤思维
    expect(placeholderLabels(`获得 ${hl('{gold}')} 金币。首次携带黯灭时，将其升级为 ${hl('雷神之锤(真)')} 。`)).toEqual({
      gold: '金币',
    });
    // 10071 断头台
    const tpl = `参与击杀后重置基础技能冷却，对生命值低于 ${hl('{hp_pct}%')} 的敌人额外造成 ${hl('{dmg_pct}%')} 伤害。`;
    expect(placeholderLabels(tpl)).toEqual({ hp_pct: '生命值低于', dmg_pct: '额外伤害' });
  });

  it('handles clauses, conjunctions and trailing verbs of change', () => {
    // 10091 救救救救救
    const tpl =
      `阵亡后召唤墓碑，若墓碑附近 ${hl('{radius}')} 码内只有友军， ${hl('{time}')} 秒后原地复活并拥有 ${hl('{hp_pct}%')} 生命值。` +
      ` ${hl('{life_time}')} 秒后墓碑消失，复活时间缩短 ${hl('{respawn_reduce}')} 秒，墓碑期间可以使用商店和选择福佑。`;
    expect(placeholderLabels(tpl)).toEqual({
      radius: '墓碑附近',
      time: '秒后原地复活',
      hp_pct: '生命值',
      life_time: '秒后墓碑消失',
      respawn_reduce: '复活时间',
    });
  });

  it('treats list items after 、 as new items and shortens long labels', () => {
    // 10186 抽血麻将
    const tpl = `最大生命值 ${hl('-{hp_pct}%')} ，随机获得以下四种奖励之一： ${hl('{dmg_pct}%')} 伤害输出、 ${hl('{gold}')} 金币、 ${hl('{hp_pct_bonus}%')} 最大生命值`;
    // Two keys would both read 最大生命值: the one with a sign gets it as a qualifier.
    expect(placeholderLabels(tpl)).toEqual({
      hp_pct: '最大生命值降低',
      dmg_pct: '伤害输出',
      gold: '金币',
      hp_pct_bonus: '最大生命值',
    });
    // 10145 狼王内丹
    const wolf = `每有一个狼王内丹被拾取，福佑持有者冷却时间减少 ${hl('+{self_pct}%')} 。`;
    expect(placeholderLabels(wolf)).toEqual({ self_pct: '冷却时间' });
  });

  it('cuts at 的 and 使, and keeps labels at most 8 characters', () => {
    // 10017 一拳超人
    const tpl = `每秒获得 1 层强化，每层使下一次攻击的基础攻击力提高 ${hl('{atk}%')}，最多 ${hl('{max_stack}')} 层；任意攻击出手时消耗全部层数。`;
    expect(placeholderLabels(tpl)).toEqual({ atk: '基础攻击力', max_stack: '最多' });
    // 10003 让子弹飞
    const arrow = `攻击命中敌方英雄时，向其方向释放蓄力箭矢，造成 ${hl('{atk_dmg_pct}%')} 物理伤害（继承攻击特效），箭矢飞行 ${hl('{distance}')} 码，每飞行 ${hl('{dmg_add_distance}')} 码，伤害提升 ${hl('{dmg_add}%')}。`;
    expect(placeholderLabels(arrow)).toEqual({
      atk_dmg_pct: '物理伤害',
      distance: '箭矢飞行',
      dmg_add_distance: '每飞行',
      dmg_add: '伤害提升',
    });
    for (const label of Object.values(placeholderLabels(arrow))) expect(label.length).toBeLessThanOrEqual(8);
  });

  it('reads short labels before a colon and cuts at brackets, 在 and adverbs', () => {
    // 21001 灵魂痛击
    const tpl =
      `下次普通攻击拥有 ${hl('{atk_range}')} 额外攻击距离，并且会额外造成 ${hl('{base_dmg}')} 点物理伤害。` +
      `如果敌方单位死于灵魂痛击，则灵魂痛击的伤害永久增加 ${hl('{dmg_per_kill}')} 点，这个加成会在击杀英雄时提升 ${hl('{kill_hero}')} 倍。` +
      ` <font color='#8e8e8e'>（CD: {cd} 秒）</font>`;
    expect(placeholderLabels(tpl)).toEqual({
      atk_range: '额外攻击距离',
      base_dmg: '物理伤害',
      // Generic 伤害 keeps its qualifier.
      dmg_per_kill: '伤害永久增加',
      kill_hero: '击杀英雄时',
      cd: 'CD',
    });
  });

  it('drops brackets, symbols and stray numbers, and prefers the next words over a one-character label', () => {
    // 10148 手快选两个
    expect(placeholderLabels(`有 ${hl('{pct}%')} 几率获得其他两个福佑，否则获得其中一个。`)).toEqual({ pct: '几率' });
    expect(placeholderLabels(`持续时间内（持续 ${hl('{dur}')} 秒）`)).toEqual({ dur: '持续时间' });
    expect(placeholderLabels(`获得 [肉钩] ${hl('{n}')} 层`)).toEqual({ n: '肉钩' });
  });

  it('qualifies duplicate labels with the words that change them', () => {
    const tpl = `冷却时间减少 ${hl('{a}%')}，阵亡后，冷却时间延长 ${hl('{b}')} 秒`;
    expect(placeholderLabels(tpl)).toEqual({ a: '冷却时间减少', b: '冷却时间延长' });
  });

  it('qualifies generic labels by the unit or noun after the value', () => {
    const tpl = `技能增强 ${hl('+{pct}%')} （持续 ${hl('{duration}')} 秒，上限 ${hl('{max_stack}')} 层）`;
    expect(placeholderLabels(tpl)).toEqual({ pct: '技能增强', duration: '持续时间', max_stack: '层数上限' });
    // 10002 超级分裂箭
    expect(placeholderLabels(`分裂箭继承攻击特效，造成 ${hl('{dmg_pct}%')} 伤害。`)).toEqual({ dmg_pct: '伤害比例' });
  });

  it('does not name an ability placeholder after the stat glued to it', () => {
    // Hero blessing: "{k1}伤害 +{v1}%", k1 is the ability name.
    expect(placeholderLabels(`${hl('{k1}')}伤害 ${hl('+{v1}%')}`)).toEqual({ v1: '伤害提升' });
  });

  it('leaves a key out when no sensible label exists', () => {
    expect(placeholderLabels(`${hl('{a} - {b}')}`)).toEqual({});
  });
});
