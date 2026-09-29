import { z } from 'astro/zod';

export const CATEGORIES = ['装备类', '属性类', '技能类', '召唤类', '经济类', '团队类', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

export const ATTRS = ['str', 'agi', 'int', 'all'] as const;
export const ATTR_LABELS: Record<(typeof ATTRS)[number], string> = {
  str: '力量',
  agi: '敏捷',
  int: '智力',
  all: '全才',
};

const slug = z.string().regex(/^[a-z0-9_-]+$/, 'id 只能包含小写字母、数字、- 和 _');
// Only http(s) links are allowed in source fields (rejects javascript: etc.).
const httpUrl = z.url({ protocol: /^https?$/ });
// Astro's YAML/frontmatter parser turns unquoted 2026-09-28 into a Date; normalize back to a string.
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD'),
);

export const blessingSchema = z.object({
  id: slug,
  name: z.string().min(1),
  category: z.enum(CATEGORIES),
  exclusive_hero: slug.nullable().default(null),
  effect: z.string().min(1),
  // Keys are human-readable Chinese labels, e.g. { 金币: 3500 }
  numbers: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  tags: z.array(z.string()).default([]),
  // File name under public/img/blessings/
  icon: z.string().optional(),
  since_version: isoDate.optional(),
  sources: z.array(httpUrl).default([]),
  history: z.array(z.object({ version: isoDate, change: z.string().min(1) })).default([]),
});

export const heroSchema = z.object({
  id: slug,
  name: z.string().min(1),
  name_en: z.string().min(1),
  attr: z.enum(ATTRS),
});

export const itemSchema = z.object({
  id: slug,
  name: z.string().min(1),
  name_en: z.string().min(1),
});

export const versionSchema = z.object({
  id: isoDate,
  title: z.string().min(1),
  source_url: httpUrl.optional(),
  changes: z
    .array(z.object({ blessing: slug.nullable().default(null), text: z.string().min(1) }))
    .default([]),
});

export const buildSchema = z.object({
  hero: slug,
  summary: z.string().min(1),
  blessings: z.array(z.object({ id: slug, note: z.string().optional() })).default([]),
  items: z.array(slug).default([]),
  updated: isoDate,
  sources: z.array(httpUrl).default([]),
});

export const guideSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().default(100),
  updated: isoDate,
  sources: z.array(httpUrl).default([]),
});

export type Blessing = z.infer<typeof blessingSchema>;
export type Hero = z.infer<typeof heroSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Version = z.infer<typeof versionSchema>;
export type Build = z.infer<typeof buildSchema>;
export type Guide = z.infer<typeof guideSchema>;
