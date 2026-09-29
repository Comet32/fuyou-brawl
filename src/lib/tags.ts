export const TAGS = ['攻击', '法术', '生存', '经济', '移动', '召唤', '装备'] as const;
export type Tag = (typeof TAGS)[number];

/** Keyword table: a tag applies when any of its keywords occurs in the plain-text description. */
export const TAG_RULES: Record<Tag, string[]> = {
  攻击: ['攻击力', '攻击速度', '普通攻击', '暴击', '攻击距离', '分裂'],
  法术: ['技能', '法术', '冷却', '魔法', '施法'],
  生存: ['生命值', '护甲', '魔抗', '吸血', '护盾', '复活', '减伤', '承受'],
  经济: ['金币', '经验', '商店', '购买'],
  移动: ['移动速度', '位移', '传送'],
  召唤: ['召唤', '单位'],
  装备: ['携带', '升级为', '物品', '装备'],
};

export function autoTags(plainText: string): Tag[] {
  return TAGS.filter((t) => TAG_RULES[t].some((k) => plainText.includes(k)));
}

/** Mid-saturation colors, used for chip dots only. */
export const TAG_COLORS: Record<Tag, string> = {
  攻击: '#e5654f',
  法术: '#8b7bea',
  生存: '#4fb286',
  经济: '#d9a441',
  移动: '#4fa8d9',
  召唤: '#c66ab5',
  装备: '#8d99a6',
};
