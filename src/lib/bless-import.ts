import { z } from 'astro/zod';
import { generatedBlessingSchema, type GeneratedBlessing, type Version } from './schema';
import { autoTags } from './tags';
import { toPlainText } from './template';

/** parseCsv output of one game localization file: header row first (Tokens,Schinese,English,Russian). */
type CsvTable = string[][];

export interface ImportInput {
  names: CsvTable; // bless_<id>
  desc: CsvTable; // bless_<id>_desc
  short: CsvTable; // bless_<id>_desc_short
  /** Ids that have an icon png in the VPK. */
  iconIds: Set<string>;
}

const TOKEN_PREFIX = 'bless_';
// Dev placeholder rows in the game data have a bare "x"-style description or one that just repeats the name.
const MIN_EFFECT_LENGTH = 3;
const isBlessingId = (id: string) => generatedBlessingSchema.shape.id.safeParse(id).success;

interface Row {
  zh: string;
  en: string;
}

/** Map token -> { zh, en } using the header to locate columns. */
function indexTable(table: CsvTable, label: string): Map<string, Row> {
  const [header = [], ...rows] = table;
  const col = (name: string, required: boolean) => {
    const i = header.findIndex((h) => h.trim() === name);
    if (i < 0 && required) throw new Error(`${label}: missing column "${name}"`);
    return i;
  };
  const tokenCol = col('Tokens', true);
  const zhCol = col('Schinese', true);
  const enCol = col('English', false);

  const out = new Map<string, Row>();
  for (const r of rows) {
    const token = r[tokenCol]?.trim();
    // First occurrence wins, like the game's own localization loader.
    if (!token || out.has(token)) continue;
    out.set(token, { zh: r[zhCol]?.trim() ?? '', en: enCol >= 0 ? (r[enCol]?.trim() ?? '') : '' });
  }
  return out;
}

const ID_PARTS_RE = /^(\d+)(.*)$/;

/** Natural order for blessing ids: numeric part first, then suffix ("10004" < "10004a" < "10005" < "100043"). */
export function compareBlessingIds(a: string, b: string): number {
  // Ids without a leading number sort after all numeric ones.
  const [, an, as = a] = ID_PARTS_RE.exec(a) ?? [];
  const [, bn, bs = b] = ID_PARTS_RE.exec(b) ?? [];
  const na = an ? Number(an) : Infinity;
  const nb = bn ? Number(bn) : Infinity;
  if (na !== nb) return na < nb ? -1 : 1;
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/** Id with its SP-variant letter suffix removed ("10004a" -> "10004"). */
export const baseBlessingId = (id: string) => id.replace(/[a-z]+$/, '');

/** Build blessings.generated.yaml entries from the game's localization CSVs. */
export function buildGenerated(input: ImportInput): { blessings: GeneratedBlessing[]; skipped: string[] } {
  const names = indexTable(input.names, 'bless_name.csv');
  const desc = indexTable(input.desc, 'bless_desc.csv');
  const short = indexTable(input.short, 'bless_desc_short.csv');

  const raw: unknown[] = [];
  const skipped: string[] = [];
  for (const [token, row] of names) {
    if (!token.startsWith(TOKEN_PREFIX)) continue;
    const id = token.slice(TOKEN_PREFIX.length);
    if (!row.zh || !isBlessingId(id)) {
      skipped.push(id);
      continue;
    }
    const full = desc.get(`${token}_desc`)?.zh ?? '';
    const brief = short.get(`${token}_desc_short`)?.zh ?? '';
    const effect = full || brief;
    const plainEffect = toPlainText(effect);
    if (plainEffect.length < MIN_EFFECT_LENGTH || plainEffect === row.zh) {
      skipped.push(id);
      continue;
    }
    const base = baseBlessingId(id);
    const icon = input.iconIds.has(id) ? `${id}.webp` : input.iconIds.has(base) ? `${base}.webp` : undefined;
    raw.push({
      id,
      name: row.zh,
      name_en: row.en,
      summary: brief || full,
      effect,
      tags: autoTags(plainEffect),
      ...(icon ? { icon } : {}),
    });
  }

  const blessings = z.array(generatedBlessingSchema).parse(raw);
  blessings.sort((a, b) => compareBlessingIds(a.id, b.id));
  skipped.sort(compareBlessingIds);
  return { blessings, skipped };
}

/** Fields compared by diffGenerated, with the label used in version notes. */
export const DIFF_FIELDS = {
  name: '名称',
  name_en: '英文名',
  summary: '简述',
  effect: '效果',
} as const satisfies Partial<Record<keyof GeneratedBlessing, string>>;
type DiffField = keyof typeof DIFF_FIELDS;

export interface GeneratedDiff {
  added: GeneratedBlessing[];
  removed: GeneratedBlessing[];
  changed: { id: string; name: string; fields: DiffField[] }[];
}

/** Compare two imports. Tags and icons are derived data and are ignored. */
export function diffGenerated(prev: GeneratedBlessing[], next: GeneratedBlessing[]): GeneratedDiff {
  const prevById = new Map(prev.map((b) => [b.id, b]));
  const nextIds = new Set(next.map((b) => b.id));
  const diff: GeneratedDiff = { added: [], removed: [], changed: [] };

  for (const b of next) {
    const old = prevById.get(b.id);
    if (!old) {
      diff.added.push(b);
      continue;
    }
    const fields = (Object.keys(DIFF_FIELDS) as DiffField[]).filter((f) => old[f] !== b[f]);
    if (fields.length > 0) diff.changed.push({ id: b.id, name: b.name, fields });
  }
  for (const b of prev) if (!nextIds.has(b.id)) diff.removed.push(b);
  return diff;
}

export const isEmptyDiff = (d: GeneratedDiff) => d.added.length + d.removed.length + d.changed.length === 0;

/** A versions.yaml entry describing `diff`. */
export function versionEntryFromDiff(diff: GeneratedDiff, id: string, title: string): Version {
  return {
    id,
    title,
    changes: [
      ...diff.added.map((b) => ({ blessing: b.id, text: '新增' })),
      ...diff.changed.map((c) => ({
        blessing: c.id,
        text: `${c.fields.map((f) => DIFF_FIELDS[f]).join('、')}变更`,
      })),
      ...diff.removed.map((b) => ({ blessing: null, text: `移除：${b.name}（${b.id}）` })),
    ],
  };
}
