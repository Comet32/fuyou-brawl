import { z } from 'astro/zod';
import { QUALITY_IDS, type QualityId } from './quality';
import { TAGS } from './tags';

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

// Game ids: 5-6 digits, optionally one lowercase letter for SP variants (10010, 100043, 10004a).
const blessingId = z.string().regex(/^\d{5,6}[a-z]?$/, '福佑 id 应为 5-6 位数字，可带一个小写字母后缀');
// References written by hand in YAML may be unquoted numbers; keep them as strings.
const blessingRef = z.preprocess((v) => (typeof v === 'number' ? String(v) : v), blessingId);
// Plain file name (no path segments) under public/img/blessings/
const iconFile = z.string().regex(/^[\w.-]+\.(webp|png)$/, 'icon 必须是 .webp/.png 文件名，不含路径');
const quality = z.enum(QUALITY_IDS as [QualityId, ...QualityId[]]);
// Placeholder name in the description template -> value, e.g. { gold: 3500 }
const numbers = z.record(z.string(), z.union([z.number(), z.string()]));
const history = z.array(z.object({ version: isoDate, change: z.string().min(1) }));
// Tip dates may be month-only (2026-05); unquoted YAML dates become Date objects.
const tipDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, '日期格式应为 YYYY-MM 或 YYYY-MM-DD'),
);
/** Tip text limit: longer text is likely copied from a source rather than paraphrased. */
export const TIP_MAX_LENGTH = 80;
const tipText = z.string().min(1).max(TIP_MAX_LENGTH, `心得不超过 ${TIP_MAX_LENGTH} 字，请用自己的话概括`);
// A player tip. Manual tips may omit the source; community ones always carry it.
const tip = z.strictObject({ text: tipText, source: httpUrl.optional(), date: tipDate.optional() });
const communityTip = z.strictObject({ text: tipText, source: httpUrl, date: tipDate.optional() });
const recommendedHero = z.strictObject({ hero: slug, source: httpUrl });
// A dated official change, e.g. from the Steam workshop changelog.
const communityChange = z.strictObject({ date: tipDate, text: tipText, source: httpUrl });
const changeSummary = z.strictObject({ text: tipText, source: httpUrl });
// One source's claim about a quality, kept when sources disagree.
const qualityClaim = z.strictObject({ quality, source: httpUrl });

/** One entry of blessings.generated.yaml (written by scripts/import-vpk.ts). */
export const generatedBlessingSchema = z.object({
  id: blessingId,
  name: z.string().min(1),
  name_en: z.string().default(''),
  // Description templates: {key} placeholders, <font color> and <br> markup.
  summary: z.string(),
  effect: z.string(),
  tags: z.array(z.enum(TAGS)).default([]),
  icon: iconFile.optional(),
});

/** One value of blessings.overrides.yaml. Strict, so a misspelled field is an error instead of silently ignored. */
export const blessingOverrideSchema = z.strictObject({
  quality: quality.optional(),
  numbers: numbers.optional(),
  // Free-form manual tags, merged with the automatic ones.
  tags: z.array(z.string().min(1)).optional(),
  sources: z.array(httpUrl).optional(),
  history: history.optional(),
  since_version: isoDate.optional(),
  exclusive_hero: slug.optional(),
  // Hero ids this blessing belongs to; replaces the automatic ability-name links ([] = none).
  heroes: z.array(slug).optional(),
  // Player tips, shown before the community ones.
  tips: z.array(tip).optional(),
});

/**
 * One value of blessings.community.yaml (written by scripts/import-community.ts from community research).
 * Strict, so fields that must never be published (like the wiki's own prose) are rejected.
 */
export const blessingCommunitySchema = z.strictObject({
  quality: quality.optional(),
  quality_source: httpUrl.optional(),
  numbers: numbers.optional(),
  // Placeholder name -> where its value came from.
  number_sources: z.record(z.string(), httpUrl).optional(),
  // Player tips (one-image guides, Bilibili and Steam comments).
  tips: z.array(communityTip).optional(),
  // The wiki's own annotations (restrictions, its change notes), paraphrased.
  wiki_notes: z.array(communityTip).optional(),
  // Official changes from the Steam changelog.
  changes: z.array(communityChange).optional(),
  // One-line statistics of the official balance changes (count of buffs / nerfs).
  change_summary: changeSummary.optional(),
  recommended_heroes: z.array(recommendedHero).optional(),
  // Every claim when sources disagree on the quality (quality is then left unset).
  quality_conflict: z.array(qualityClaim).optional(),
  // Caveat about the quality, e.g. why it is left unknown.
  notes: z.string().min(1).optional(),
});

/** A blessing after merging generated data with community data and its override (override wins). */
export const blessingSchema = z.object({
  id: blessingId,
  name: z.string().min(1),
  name_en: z.string().default(''),
  quality: quality.nullable().default(null),
  /** Where `quality` came from: blessings.overrides.yaml, blessings.community.yaml, or nowhere. */
  quality_source: z.enum(['manual', 'community']).nullable().default(null),
  /** Source link of a community quality. */
  quality_url: httpUrl.optional(),
  /** Community caveat about an unknown quality. */
  quality_note: z.string().optional(),
  summary: z.string(),
  effect: z.string(),
  tags: z.array(z.string()).default([]),
  numbers: numbers.default({}),
  /** Source links of the values that came from community data (manual values have none). */
  number_sources: z.record(z.string(), httpUrl).default({}),
  icon: iconFile.optional(),
  exclusive_hero: slug.nullable().default(null),
  /** Manual hero links; undefined = use the automatic ones. */
  heroes: z.array(slug).optional(),
  since_version: isoDate.optional(),
  sources: z.array(httpUrl).default([]),
  history: history.default([]),
  /** Manual tips first, then community ones. */
  tips: z.array(tip).default([]),
  /** Community wiki annotations (图鉴备注). */
  wiki_notes: z.array(communityTip).default([]),
  /** Official changes from the community research, shown in 改动历史 next to `history`. */
  changes: z.array(communityChange).default([]),
  /** Lead line above 改动历史: how often it was buffed / nerfed. */
  change_summary: changeSummary.optional(),
  /** Conflicting quality claims; only kept while the quality is unknown. */
  quality_conflict: z.array(qualityClaim).default([]),
  /** Heroes the community recommends this blessing for (separate from the automatic hero links). */
  recommended_heroes: z.array(recommendedHero).default([]),
});

export const heroSchema = z.object({
  id: slug,
  name: z.string().min(1),
  name_en: z.string().min(1),
  attr: z.enum(ATTRS),
});

/** One entry of hero-abilities.yaml (written by scripts/fetch-dota-assets.ts). */
export const heroAbilitiesSchema = z.object({
  hero: slug,
  abilities: z
    .array(z.object({ id: slug, name: z.string().min(1), name_en: z.string().min(1) }))
    .min(1),
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
    .array(z.object({ blessing: blessingRef.nullable().default(null), text: z.string().min(1) }))
    .default([]),
});

export const buildSchema = z.object({
  hero: slug,
  summary: z.string().min(1),
  blessings: z.array(z.object({ id: blessingRef, note: z.string().optional() })).default([]),
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

export type GeneratedBlessing = z.infer<typeof generatedBlessingSchema>;
export type BlessingOverride = z.infer<typeof blessingOverrideSchema>;
export type BlessingCommunity = z.infer<typeof blessingCommunitySchema>;
export type Tip = z.infer<typeof tip>;
export type CommunityChange = z.infer<typeof communityChange>;
export type QualityClaim = z.infer<typeof qualityClaim>;
export type Blessing = z.infer<typeof blessingSchema>;
export type Hero = z.infer<typeof heroSchema>;
export type HeroAbilities = z.infer<typeof heroAbilitiesSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Version = z.infer<typeof versionSchema>;
export type Build = z.infer<typeof buildSchema>;
export type Guide = z.infer<typeof guideSchema>;
