// Community one-image guides (一图流) -> hero builds (src/content/builds/<hero>.md). Pure helpers for
// scripts/import-builds.ts: name matching, blessing order and notes, file rendering.
import { Document, isMap, isSeq, parse, visit } from 'yaml';
import { isHeroBlessing } from './hero-blessing';
import type { QualityId } from './quality';
import type { Blessing, Build } from './schema';

/** `origin` of builds this importer writes; it only ever regenerates files carrying it. */
export const BUILD_ORIGIN = 'community-guide';

export type Tier = 'gold' | 'purple' | 'blue';
export const TIERS: readonly Tier[] = ['gold', 'purple', 'blue'];
/** A guide's colored section implies the blessing quality it lists. */
export const TIER_QUALITY: Record<Tier, QualityId> = { gold: 'ssr', purple: 'sr', blue: 'r' };
export const TIER_NOTE: Record<Tier, string> = { gold: '橙色推荐', purple: '紫色推荐', blue: '蓝色推荐' };

/** One transcribed guide: blessing names per colored section, as printed, space-separated. */
export interface GuideEntry {
  hero: string;
  file: string;
  date: string;
  gold: string;
  purple: string;
  blue: string;
}

export type MatchKind = 'exact' | 'quality' | 'base' | 'alias' | 'guide-pick' | 'unmapped';

export interface NameMatch {
  name: string;
  tier: Tier;
  id: string | undefined;
  how: MatchKind;
  /** Every id that fit, when more than one did (ambiguous picks and skipped names). */
  candidates: string[];
}

/** Drop zero-width characters some game strings carry (乾坤一掷 ends in U+200C). */
export const stripInvisible = (s: string): string => s.replace(/[\u200b-\u200d\u2060\ufeff]/g, '');

/** Comparable form of a blessing name: no zero-width characters, no spaces around dashes. */
export function normalizeName(name: string): string {
  return stripInvisible(name).replace(/\s*-\s*/g, '-').trim();
}

/** Names of one guide section. "肉身成圣 - 血" is printed with spaces but is one name. */
export function guideNames(section: string): string[] {
  return normalizeName(section).split(/\s+/).filter(Boolean);
}

const isSpVariant = (id: string) => /[a-z]$/.test(id);
const stem = (name: string) => name.replace(/(强化|增强)$/, '');

/** A printed short name fits a research pick: one contains the other, or "X强化" names a blessing starting with X. */
function fits(printed: string, blessingName: string): boolean {
  const s = stem(printed);
  return blessingName.includes(printed) || printed.includes(blessingName) || (s.length >= 2 && blessingName.startsWith(s));
}

/**
 * Map every printed name of a guide to a blessing id. Exact names come first; same-name blessings are split
 * by the section's quality, else the non-SP base id is taken (and reported). Names with no exact match
 * are only resolved through `guidePicks` (ids the research already linked to this guide), never guessed:
 * a reviewed alias (printed name -> official name) landing on a pick, or a pick the printed name fits.
 */
export function matchGuide(
  guide: GuideEntry,
  blessings: Blessing[],
  guidePicks: ReadonlySet<string>,
  aliases: Record<string, string> = {},
): NameMatch[] {
  const byName = new Map<string, Blessing[]>();
  for (const b of blessings) {
    const key = normalizeName(b.name);
    byName.set(key, [...(byName.get(key) ?? []), b]);
  }
  const matches: NameMatch[] = TIERS.flatMap((tier) =>
    guideNames(guide[tier]).map((name): NameMatch => {
      const exact = byName.get(name) ?? [];
      const candidates = exact.length > 1 ? exact.map((b) => b.id) : [];
      if (exact.length === 1) return { name, tier, id: exact[0].id, how: 'exact', candidates };
      if (exact.length > 1) {
        const byQuality = exact.filter((b) => b.quality === TIER_QUALITY[tier]);
        if (byQuality.length === 1) return { name, tier, id: byQuality[0].id, how: 'quality', candidates };
        const base = exact.find((b) => !isSpVariant(b.id)) ?? exact[0];
        return { name, tier, id: base.id, how: 'base', candidates };
      }
      return { name, tier, id: undefined, how: 'unmapped', candidates };
    }),
  );

  const used = new Set(matches.flatMap((m) => (m.id ? [m.id] : [])));
  const pool = blessings.filter((b) => guidePicks.has(b.id));
  for (const m of matches) {
    // "gold:栗子强化" pins a name printed in several sections; a bare name applies to every section.
    const alias = aliases[`${m.tier}:${m.name}`] ?? aliases[m.name];
    if (m.id || alias === undefined) continue;
    const target = pool.filter((b) => !used.has(b.id)).filter((b) => normalizeName(b.name) === normalizeName(alias));
    if (target.length === 1) {
      m.id = target[0].id;
      m.how = 'alias';
      used.add(m.id);
    }
  }
  for (const m of matches) {
    if (m.id) continue;
    const fit = pool.filter((b) => !used.has(b.id) && fits(m.name, normalizeName(b.name)));
    const chosen = fit.length === 1 ? fit : fit.filter((b) => b.quality === TIER_QUALITY[m.tier]);
    if (chosen.length === 1) {
      m.id = chosen[0].id;
      m.how = 'guide-pick';
      used.add(m.id);
    }
    m.candidates = fit.length > 1 ? fit.map((b) => b.id) : [];
  }
  return matches;
}

/**
 * Build entries in guide order (gold → purple → blue), each id once. Within a section, core picks lead,
 * then hero blessings, then the rest as printed. `core` maps a printed name to a short reason.
 */
export function buildBlessings(matches: NameMatch[], core: Record<string, string> = {}): Build['blessings'] {
  const seen = new Set<string>();
  const out: Build['blessings'] = [];
  for (const tier of TIERS) {
    const inTier = matches.filter((m) => m.tier === tier && m.id);
    const rank = (m: NameMatch) => (core[m.name] ? 0 : isHeroBlessing(m.id!) ? 1 : 2);
    const ordered = [...inTier].sort((x, y) => rank(x) - rank(y));
    for (const m of ordered) {
      if (seen.has(m.id!)) continue;
      seen.add(m.id!);
      const reason = core[m.name];
      out.push({ id: m.id!, note: reason ? `${TIER_NOTE[tier]} · 核心 · ${reason}` : TIER_NOTE[tier] });
    }
  }
  return out;
}

export interface BuildFrontmatter {
  hero: string;
  origin: string;
  summary: string;
  blessings: Build['blessings'];
  items: string[];
  updated: string;
  sources: string[];
}

/** Markdown file: YAML frontmatter (one flow map per blessing) and the body. */
export function renderBuild(fm: BuildFrontmatter, body: string): string {
  const doc = new Document(fm);
  visit(doc, {
    Pair(_, pair) {
      const key = String((pair.key as { value?: unknown })?.value ?? '');
      if (key === 'blessings' && isSeq(pair.value)) {
        for (const item of pair.value.items) if (isMap(item)) item.flow = true;
      }
    },
  });
  return `---\n${doc.toString({ lineWidth: 0 })}---\n\n${body.trim()}\n`;
}

/** The importer may write a build only when none exists or it generated the existing one. */
export function mayOverwrite(existing: string | undefined): boolean {
  if (existing === undefined) return true;
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(existing);
  const data = m ? (parse(m[1]) as { origin?: unknown } | null) : null;
  return data?.origin === BUILD_ORIGIN;
}
