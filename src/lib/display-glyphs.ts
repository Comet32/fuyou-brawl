// Fixed chrome strings drawn in the self-hosted CJK display face (public/fonts/).
// tools/subset-display-font.ts subsets the font to exactly these glyphs; after adding a
// string here, run `npm run fonts` (tests/display-glyphs.test.ts fails until you do).
// Dynamic text (blessing and hero names, descriptions) stays on the system stack.
import { QUALITIES } from './quality';
import { TAGS } from './tags';
import { ATTR_LABELS } from './schema';

export const DISPLAY_STRINGS: readonly string[] = [
  // Mark and navigation
  '福佑图鉴',
  '图鉴对比英雄版本攻略更多',
  '版本变动攻略文章品质标注',
  // Page titles
  '三选一对比',
  '品质标注',
  '英雄搭配',
  '版本变动',
  '攻略文章',
  '更多',
  '这一格是空的',
  // Draft board
  '待选已锁定',
  // Section straps
  '完整效果选取时的简介数值表推荐搭配的英雄改动历史参考来源推荐福佑推荐出装思路',
  // Filters, quality bands, label desk
  ...QUALITIES.map((q) => `${q.label}${q.label}品质`),
  '未标注品质未标注',
  '不确定上一个',
  ...TAGS,
  ...Object.values(ATTR_LABELS),
  '已有搭配',
  '含英雄福佑英雄福佑相关通用福佑相关英雄',
];

/** Unique non-ASCII characters of DISPLAY_STRINGS, sorted by code point. */
export function displayGlyphs(): string[] {
  const set = new Set<string>();
  for (const s of DISPLAY_STRINGS) for (const ch of s) if (ch.codePointAt(0)! > 0x7f) set.add(ch);
  return [...set].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}
