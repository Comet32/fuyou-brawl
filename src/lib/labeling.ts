// Pure state logic for the quality labeling page (src/pages/label.astro).
import { QUALITY_IDS, type QualityId } from './quality';

export type Answer = QualityId | 'unsure';
export interface LabelState {
  /** Position in the queue; equal to the queue length when every item has been seen. */
  index: number;
  answers: Record<string, Answer>;
}

export const STORAGE_KEY = 'fuyou-label-v1';
const ANSWERS: readonly Answer[] = [...QUALITY_IDS, 'unsure'];
const isAnswer = (v: unknown): v is Answer => typeof v === 'string' && (ANSWERS as readonly string[]).includes(v);

/** Ids still waiting for a quality label, in the given order. */
export function buildQueue(records: { id: string; quality: QualityId | null }[]): string[] {
  return records.filter((r) => r.quality === null).map((r) => r.id);
}

export const nextIndex = (i: number, length: number): number => Math.min(i + 1, length);
export const prevIndex = (i: number): number => Math.max(i - 1, 0);

/** Record `answer` for the current item and move to the next one. */
export function applyAnswer(state: LabelState, queue: string[], answer: Answer): LabelState {
  const id = queue[state.index];
  if (id === undefined) return state;
  return { index: nextIndex(state.index, queue.length), answers: { ...state.answers, [id]: answer } };
}

const KEYS: Record<string, Answer | 'prev'> = { '1': 'ssr', '2': 'sr', '3': 'r', '0': 'unsure', Backspace: 'prev' };

/** Keyboard shortcut -> action; null when the key is not a shortcut. */
export function answerForKey(key: string): Answer | 'prev' | null {
  return Object.hasOwn(KEYS, key) ? KEYS[key] : null;
}

export function answerCounts(queue: string[], answers: Record<string, Answer>): Record<Answer | 'done', number> {
  const counts = { ssr: 0, sr: 0, r: 0, unsure: 0, done: 0 };
  for (const id of queue) {
    const a = answers[id];
    if (!a) continue;
    counts[a] += 1;
    counts.done += 1;
  }
  return counts;
}

/** JSON for scripts/apply-labels.ts: `{"<id>": "ssr" | "sr" | "r"}`, unsure answers skipped, ids sorted. */
export function serializeExport(answers: Record<string, Answer>): string {
  const out: Record<string, QualityId> = {};
  for (const id of Object.keys(answers).sort()) {
    const a = answers[id];
    if (a !== 'unsure') out[id] = a;
  }
  return JSON.stringify(out, null, 2);
}

/** Read a stored state defensively: anything malformed falls back to a fresh start. */
export function parseState(raw: string | null, length: number): LabelState {
  const fresh: LabelState = { index: 0, answers: {} };
  if (!raw) return fresh;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fresh;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fresh;
  const { index, answers } = data as { index?: unknown; answers?: unknown };
  const clean: Record<string, Answer> = {};
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    for (const [id, a] of Object.entries(answers)) if (isAnswer(a)) clean[id] = a;
  }
  const i = typeof index === 'number' && Number.isInteger(index) && index >= 0 ? Math.min(index, length) : 0;
  return { index: i, answers: clean };
}
