import type { Category } from './schema';

// Mid-saturation colors for fills and borders (icon block, card edge) only, not for text:
// several of them fail 4.5:1 contrast against the light surface.
export const CATEGORY_COLORS: Record<Category, string> = {
  装备类: '#d9a441',
  属性类: '#e0625a',
  技能类: '#5b8def',
  召唤类: '#9b6cd8',
  经济类: '#e8c547',
  团队类: '#3fb68b',
  其他: '#8a94a6',
};
