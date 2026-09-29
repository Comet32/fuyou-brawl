import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  answerCounts,
  answerForKey,
  applyAnswer,
  buildQueue,
  nextIndex,
  parseState,
  prevIndex,
  serializeExport,
  type LabelState,
} from '../src/lib/labeling';

const records = [
  { id: 'a', quality: null },
  { id: 'b', quality: 'ssr' as const },
  { id: 'c', quality: null },
  { id: 'd', quality: null },
];

describe('buildQueue', () => {
  it('keeps unlabeled ids in their given order', () => {
    expect(buildQueue(records)).toEqual(['a', 'c', 'd']);
  });
  it('is empty when everything is labeled', () => {
    expect(buildQueue([{ id: 'x', quality: 'r' }])).toEqual([]);
  });
});

describe('nextIndex / prevIndex', () => {
  it('advances up to the end marker (length) and no further', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(3);
    expect(nextIndex(3, 3)).toBe(3);
  });
  it('steps back to 0 and no further', () => {
    expect(prevIndex(2)).toBe(1);
    expect(prevIndex(0)).toBe(0);
  });
});

describe('applyAnswer', () => {
  const queue = ['a', 'c', 'd'];
  it('records the answer for the current id and advances', () => {
    const s = applyAnswer({ index: 0, answers: {} }, queue, 'sr');
    expect(s).toEqual({ index: 1, answers: { a: 'sr' } });
  });
  it('overwrites a previous answer and does not mutate the input', () => {
    const before: LabelState = { index: 1, answers: { a: 'sr', c: 'r' } };
    const after = applyAnswer(before, queue, 'unsure');
    expect(after.answers).toEqual({ a: 'sr', c: 'unsure' });
    expect(before.answers.c).toBe('r');
  });
  it('does nothing at the end of the queue', () => {
    const s: LabelState = { index: 3, answers: {} };
    expect(applyAnswer(s, queue, 'r')).toBe(s);
  });
});

describe('answerForKey', () => {
  it('maps number keys to answers and Backspace to prev', () => {
    expect(answerForKey('1')).toBe('ssr');
    expect(answerForKey('2')).toBe('sr');
    expect(answerForKey('3')).toBe('r');
    expect(answerForKey('0')).toBe('unsure');
    expect(answerForKey('Backspace')).toBe('prev');
    expect(answerForKey('a')).toBeNull();
  });
});

describe('answerCounts', () => {
  it('counts answers of ids in the queue only', () => {
    const c = answerCounts(['a', 'c'], { a: 'ssr', c: 'unsure', zz: 'r' });
    expect(c).toEqual({ ssr: 1, sr: 0, r: 0, unsure: 1, done: 2 });
  });
});

describe('serializeExport', () => {
  it('skips unsure answers and sorts ids', () => {
    expect(serializeExport({ c: 'r', a: 'ssr', b: 'unsure' })).toBe('{\n  "a": "ssr",\n  "c": "r"\n}');
  });
  it('produces an empty object when nothing is exportable', () => {
    expect(serializeExport({ a: 'unsure' })).toBe('{}');
  });
});

describe('parseState', () => {
  it('returns a fresh state for missing or broken input', () => {
    expect(parseState(null, 3)).toEqual({ index: 0, answers: {} });
    expect(parseState('{nope', 3)).toEqual({ index: 0, answers: {} });
    expect(parseState('[1,2]', 3)).toEqual({ index: 0, answers: {} });
  });
  it('keeps valid answers, drops invalid ones and clamps the index', () => {
    const raw = JSON.stringify({ index: 9, answers: { a: 'ssr', b: 'gold', c: 'unsure', d: 3 } });
    expect(parseState(raw, 3)).toEqual({ index: 3, answers: { a: 'ssr', c: 'unsure' } });
  });
  it('rejects a negative or fractional index', () => {
    expect(parseState(JSON.stringify({ index: -2, answers: {} }), 3).index).toBe(0);
    expect(parseState(JSON.stringify({ index: 1.5, answers: {} }), 3).index).toBe(0);
  });
  it('uses a versioned storage key', () => {
    expect(STORAGE_KEY).toBe('fuyou-label-v1');
  });
});
