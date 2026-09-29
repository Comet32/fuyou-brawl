// Merge exported quality labels (from the labeling page) into blessings.overrides.yaml.
import { isMap, isScalar, parseDocument, Scalar, YAMLMap } from 'yaml';
import { QUALITY_IDS, type QualityId } from './quality';

export interface LabelCheck {
  labels: Record<string, QualityId>;
  /** Ids that do not exist in the generated data. */
  unknown: string[];
  /** Ids whose value is not r / sr / ssr. */
  invalid: string[];
}

export function validateLabels(raw: unknown, knownIds: Set<string>): LabelCheck {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('标注文件应为 JSON 对象：{"<id>": "ssr" | "sr" | "r"}');
  }
  const out: LabelCheck = { labels: {}, unknown: [], invalid: [] };
  for (const [id, value] of Object.entries(raw)) {
    if (!knownIds.has(id)) out.unknown.push(id);
    else if (typeof value !== 'string' || !(QUALITY_IDS as readonly string[]).includes(value)) out.invalid.push(id);
    else out.labels[id] = value as QualityId;
  }
  return out;
}

export interface MergeResult {
  text: string;
  added: number;
  changed: number;
  unchanged: number;
}

const quotedKey = (id: string) => {
  const key = new Scalar(id);
  key.type = Scalar.QUOTE_SINGLE; // ids like 10010 must stay strings
  return key;
};

/** Set only `quality` for each id, keeping every other field, entry and comment of the source. */
export function mergeQualityLabels(source: string, labels: Record<string, QualityId>): MergeResult {
  const doc = parseDocument(source);
  // Empty or comment-only file: start a root map (Parsed typing does not admit a fresh node).
  if (!isMap(doc.contents)) doc.contents = new YAMLMap() as unknown as typeof doc.contents;
  const root = doc.contents as YAMLMap;
  const result = { added: 0, changed: 0, unchanged: 0 };

  for (const [id, quality] of Object.entries(labels)) {
    const pair = root.items.find((p) => (isScalar(p.key) ? String(p.key.value) : String(p.key)) === id);
    if (!pair || !isMap(pair.value)) {
      const entry = new YAMLMap();
      entry.set('quality', quality);
      if (pair) pair.value = entry;
      else root.add({ key: quotedKey(id), value: entry });
      result.added += 1;
      continue;
    }
    const entry = pair.value;
    if (!entry.has('quality')) {
      entry.items.unshift(doc.createPair('quality', quality)); // quality reads first, as in hand-written entries
      result.changed += 1;
    } else if (entry.get('quality') === quality) {
      result.unchanged += 1;
    } else {
      entry.set('quality', quality);
      result.changed += 1;
    }
  }
  return { text: doc.toString(), ...result };
}
