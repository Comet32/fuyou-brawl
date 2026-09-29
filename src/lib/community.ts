// Community research -> blessings.community.yaml entries, plus small display helpers for tips and sources.
import { qualityOf, QUALITY_IDS, type QualityId } from './quality';
import { TIP_MAX_LENGTH, type BlessingCommunity } from './schema';
import { COMMUNITY_WIKI_URL } from './site';

/** One entry of tmp/research/blessing-notes.json (shape of the research export). */
export interface ResearchNote {
  id: string;
  name: string;
  numbers?: Record<
    string,
    { value?: number; range?: [number, number]; sample?: number; source: string; unit_mismatch?: boolean }
  >;
  tips?: { text: string; source: string; date: string | null; possibly_outdated?: boolean }[];
  quality?: { value: string; source: string; date?: string | null; note?: string } | null;
  quality_conflicts?: { value: string; source: string; note?: string }[] | null;
  quality_note?: string | null;
  heroes?: { hero: string; source: string; note?: string; date?: string | null }[];
  /** The wiki's own prose: used by the researcher to cross-check, never imported. */
  wiki_text?: unknown;
}

export interface ConvertContext {
  /** Chinese hero name -> hero id (from heroes.yaml). */
  heroIdByName: Map<string, string>;
  /** Placeholder keys of the blessing's templates; values for other keys are skipped. */
  placeholders: Set<string>;
}

export type SkipReason = 'quality_conflict' | 'unit_mismatch' | 'not_placeholder' | 'tip_too_long' | 'hero_unmapped';
export interface Skip {
  id: string;
  what: string;
  reason: SkipReason;
}

/**
 * Common short names that differ from heroes.yaml. Explicit and reviewed; names are never matched fuzzily.
 * 先知 is the everyday name of 自然先知 (Nature's Prophet).
 */
export const HERO_NAME_ALIASES: Record<string, string> = { 先知: 'furion' };

// "图鉴标注的专属英雄" marks the owner of a hero blessing, which the site already links; not a recommendation.
const EXCLUSIVE_MARKER = '图鉴标注的专属英雄';

const WIKI_URL = COMMUNITY_WIKI_URL;
const WIKI_HOST = new URL(WIKI_URL).host;

/** Keep YYYY-MM and YYYY-MM-DD (trimming any time part); anything else is dropped. */
export function normalizeTipDate(date: string | null | undefined): string | undefined {
  if (!date) return undefined;
  const m = /^(\d{4}-\d{2})(-\d{2})?(?:$|T)/.exec(date);
  return m ? m[1] + (m[2] ?? '') : undefined;
}

/**
 * Where a research tip belongs: the Steam changelog is official history, the wiki's own annotations are
 * 图鉴备注, and one-image guides, videos and comments are player tips.
 */
function tipKind(source: string): 'change' | 'wiki' | 'tip' {
  let u: URL;
  try {
    u = new URL(source);
  } catch {
    return 'tip';
  }
  if (u.hostname === 'steamcommunity.com' && u.pathname.includes('/changelog/')) return 'change';
  if (u.host === WIKI_HOST && !isGuidePath(u.pathname)) return 'wiki';
  return 'tip';
}

const isGuidePath = (path: string) => path.startsWith('/icons/guides/') || path.startsWith('/api/hero-guides');

/** Convert one research note into a community entry (undefined when nothing usable is left). */
export function convertNote(
  note: ResearchNote,
  ctx: ConvertContext,
): { entry: BlessingCommunity | undefined; skipped: Skip[]; unmapped: string[] } {
  const skipped: Skip[] = [];
  const unmapped: string[] = [];
  const skip = (what: string, reason: SkipReason) => skipped.push({ id: note.id, what, reason });
  const entry: BlessingCommunity = {};
  const tips: NonNullable<BlessingCommunity['tips']> = [];
  const wikiNotes: NonNullable<BlessingCommunity['wiki_notes']> = [];
  const changes: NonNullable<BlessingCommunity['changes']> = [];

  const q = note.quality;
  if (q && QUALITY_IDS.includes(q.value as QualityId)) {
    const conflicts = (note.quality_conflicts ?? []).filter((c) => QUALITY_IDS.includes(c.value as QualityId));
    if (conflicts.length > 0) {
      skip('quality', 'quality_conflict');
      entry.quality_conflict = [q, ...conflicts].map((c) => ({ quality: c.value as QualityId, source: c.source }));
    } else {
      entry.quality = q.value as QualityId;
      entry.quality_source = q.source;
    }
  }
  if (note.quality_note) entry.notes = note.quality_note;

  const numbers: NonNullable<BlessingCommunity['numbers']> = {};
  const numberSources: Record<string, string> = {};
  for (const [key, n] of Object.entries(note.numbers ?? {})) {
    if (n.unit_mismatch) {
      skip(`numbers.${key}`, 'unit_mismatch');
      continue;
    }
    if (!ctx.placeholders.has(key)) {
      skip(`numbers.${key}`, 'not_placeholder');
      continue;
    }
    const value = n.range ? `${n.range[0]}~${n.range[1]}` : n.value;
    if (value === undefined) continue;
    numbers[key] = value;
    numberSources[key] = n.source;
  }
  if (Object.keys(numbers).length > 0) {
    entry.numbers = numbers;
    entry.number_sources = numberSources;
  }

  for (const t of note.tips ?? []) {
    const text = t.text.trim();
    if (text.length > TIP_MAX_LENGTH) {
      skip(`tip: ${text.slice(0, 20)}…`, 'tip_too_long');
      continue;
    }
    const date = normalizeTipDate(t.date);
    const kind = tipKind(t.source);
    if (kind === 'change' && date) changes.push({ date, text, source: t.source });
    // An undated changelog line cannot go into the dated history; keep it as a note.
    else if (kind === 'change' || kind === 'wiki') wikiNotes.push({ text, source: t.source, ...(date && { date }) });
    else tips.push({ text, source: t.source, ...(date && { date }) });
  }
  if (tips.length > 0) entry.tips = tips;
  if (wikiNotes.length > 0) entry.wiki_notes = wikiNotes;
  if (changes.length > 0) entry.changes = changes;

  const heroes: NonNullable<BlessingCommunity['recommended_heroes']> = [];
  for (const h of note.heroes ?? []) {
    if (h.note === EXCLUSIVE_MARKER) continue;
    const id = ctx.heroIdByName.get(h.hero) ?? HERO_NAME_ALIASES[h.hero];
    if (!id) {
      if (!unmapped.includes(h.hero)) {
        unmapped.push(h.hero);
        skip(`hero: ${h.hero}`, 'hero_unmapped');
      }
      continue;
    }
    if (!heroes.some((r) => r.hero === id)) heroes.push({ hero: id, source: h.source });
  }
  if (heroes.length > 0) entry.recommended_heroes = heroes;

  return { entry: Object.keys(entry).length > 0 ? entry : undefined, skipped, unmapped };
}

/**
 * Whether a tip dated `date` is more than `months` months older than `reference` (the current game version).
 * A month-only date counts as the end of that month, so it is only flagged when surely old.
 */
export function isPossiblyOutdated(date: string | undefined, reference: string, months = 6): boolean {
  if (!date) return false;
  const [y, m, d] = date.split('-').map(Number);
  // Day 0 of the next month is the last day of this one.
  const at = d ? Date.UTC(y, m - 1, d) : Date.UTC(y, m, 0);
  const [ry, rm, rd] = reference.split('-').map(Number);
  const cutoff = Date.UTC(ry, rm - 1 - months, rd);
  return at < cutoff;
}

export interface SourceLink {
  href: string;
  /** Chinese label, e.g. 社区图鉴 / Steam 改动记录 / B站. */
  label: string;
  /** Compact label for superscript markers. */
  short: string;
}

/** Display link for a source url: a short Chinese label, and the wiki's front page instead of its JSON API. */
export function sourceLink(source: string): SourceLink {
  const link = (href: string, label: string, short = label): SourceLink => ({ href, label, short });
  let u: URL;
  try {
    u = new URL(source);
  } catch {
    return link(source, source);
  }
  if (u.host === WIKI_HOST) {
    // Hero "一图流" guide images and the API listing them.
    if (u.pathname.startsWith('/icons/guides/')) return link(source, '社区一图流', '一图流');
    if (u.pathname.startsWith('/api/hero-guides')) return link(WIKI_URL, '社区一图流', '一图流');
    return link(u.pathname.startsWith('/api/') ? WIKI_URL : source, '社区图鉴', '图鉴');
  }
  if (u.hostname === 'steamcommunity.com') {
    return link(source, u.pathname.includes('/changelog/') ? 'Steam 改动记录' : 'Steam 创意工坊', 'Steam');
  }
  if (u.hostname.endsWith('bilibili.com')) return link(source, 'B站');
  return link(source, u.hostname);
}

const RANGE_RE = /^(-?\d+(?:\.\d+)?)~(-?\d+(?:\.\d+)?)$/;

/** Split a community range value ("200~400") into its two ends; undefined for anything else. */
export function parseRange(value: number | string): [string, string] | undefined {
  if (typeof value !== 'string') return undefined;
  const m = RANGE_RE.exec(value);
  return m ? [m[1], m[2]] : undefined;
}

/** Band caption for disagreeing sources, e.g. "品质说法不一 · 图鉴紫 / 一图流蓝". */
export function conflictCaption(claims: { quality: string; source: string }[]): string {
  const parts = claims.map((c) => `${sourceLink(c.source).short}${qualityOf(c.quality)?.label.slice(0, 1) ?? c.quality}`);
  return parts.length > 0 ? `品质说法不一 · ${parts.join(' / ')}` : '品质说法不一';
}

export interface HistoryEntry {
  date: string;
  text: string;
  /** Set for manual entries: the versions.yaml id to link to. */
  version?: string;
  /** Set for community entries: where the change was recorded. */
  source?: string;
}

/** Manual history and community changes in one list, newest first (month-only dates sort by their month). */
export function historyEntries(
  history: { version: string; change: string }[],
  changes: { date: string; text: string; source: string }[],
): HistoryEntry[] {
  const all: HistoryEntry[] = [
    ...history.map((h) => ({ date: h.version, text: h.change, version: h.version })),
    ...changes.map((c) => ({ date: c.date, text: c.text, source: c.source })),
  ];
  return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
