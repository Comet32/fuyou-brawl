// Human-readable stat sheet labels derived from a description template ("攻击距离" for {range}).
import { parseTemplate } from './template';

const MAX_LABEL = 8;
// Sentence and clause boundaries; 、 is handled separately because it also joins list items.
const BOUNDARY_RE = /[。；;，,：:！？!?（()）]/;
// Inside a clause, the value's own subject follows the last of these.
const CONJ_RE = /[并使令让的在]/;
const LEADING_RE = /^(?:获得|造成|拥有|[若对在当且、]|[%％\s+\-＋－])+/;
const TRAILING_RE =
  /(?:永久|额外|固定为|提升至|提高至|增加至|降低至|减少至|变为|改为|提升|提高|增加|降低|减少|缩短|延长|为|至|[+\-＋－%％x×\s(（[【])+$/;
// A clause ending in one of these names its value after it ("获得 {gold} 金币").
const VERB_RE = /(?:获得|造成|拥有|生成|释放|回复|恢复|提供)$/;
const FOLLOW_CUT_RE = /[。；;，,：:！？!?、（()）并]/;
const FOLLOW_LEADING_RE = /^(?:[%％\s+\-＋－]|[次个点层](?=[一-鿿]))+/;

type Token = { kind: 'text'; text: string } | { kind: 'value'; key: string } | { kind: 'break' };

function tokens(tpl: string): Token[] {
  const out: Token[] = [];
  for (const seg of parseTemplate(tpl)) {
    const last = out[out.length - 1];
    if (seg.type === 'text') {
      if (last?.kind === 'text') last.text += seg.text;
      else out.push({ kind: 'text', text: seg.text });
    } else if (seg.type === 'value') out.push({ kind: 'value', key: seg.key });
    else out.push({ kind: 'break' });
  }
  return out;
}

// Brackets, symbols and numbers never belong in a label ("（持续" -> "持续", "[肉钩]" -> "肉钩").
const NOISE_RE = /[（）()[\]【】×*/<>≥≤≧≦①-⑩~～%％\d.]/g;

function clean(label: string): string {
  return label.replace(NOISE_RE, '').replace(/\s+/g, '').replace(LEADING_RE, '').replace(TRAILING_RE, '');
}

function shorten(label: string, from: 'before' | 'after'): string {
  if (label.length <= MAX_LABEL) return label;
  // A long list of stats: name the first one.
  if (label.includes('、')) return `${label.split('、')[0].slice(0, MAX_LABEL - 1)}等`;
  // Otherwise keep the words nearest the value.
  return from === 'before' ? label.slice(-4) : label.slice(0, 4);
}

// "（CD: {cd} 秒）": a short name right before a colon labels the value after it.
const COLON_LABEL_RE = /(?:^|[\s。；;，,（()）])([^\s。；;，,（()）：:]{1,4})\s*[：:]\s*$/;

function before(text: string): { label: string; listItem: boolean } {
  const parts = text.split(BOUNDARY_RE);
  const clause = parts[parts.length - 1];
  if (!clause.trim()) {
    const m = COLON_LABEL_RE.exec(text);
    if (m) return { label: m[1], listItem: false };
  }
  // "伤害输出、 {gold}": the value starts a new list item.
  if (/、\s*$/.test(clause)) return { label: '', listItem: true };
  const subParts = clause.split(CONJ_RE);
  const label = subParts[subParts.length - 1].replace(LEADING_RE, '').replace(TRAILING_RE, '').trim();
  return { label, listItem: false };
}

function after(text: string): string {
  const words = text.replace(FOLLOW_LEADING_RE, '').split(FOLLOW_CUT_RE)[0];
  // "{x}% 几率获得其他两个福佑": the value's noun ends where the next verb starts.
  return words.split(/获得|造成|拥有/)[0].replace(TRAILING_RE, '').trim();
}

/**
 * Label each placeholder of a template by the words around it: usually the words right before it
 * ("吸血 +{xx}%"), or the ones after it when only a verb or nothing precedes it ("获得 {gold} 金币").
 * Keys without a sensible label are left out. Labels are at most 8 characters.
 */
export function placeholderLabels(tpl: string): Record<string, string> {
  const list = tokens(tpl);
  const labels: Record<string, string> = {};
  list.forEach((t, i) => {
    if (t.kind !== 'value' || Object.hasOwn(labels, t.key)) return;
    const prev = list[i - 1];
    const next = list[i + 1];
    const b = prev?.kind === 'text' ? before(prev.text) : { label: '', listItem: false };
    const bl = clean(b.label);
    const a = next?.kind === 'text' ? clean(after(next.text)) : '';
    let label = bl;
    let from: 'before' | 'after' = 'before';
    // A bare verb or a single character ("有 {x}% 几率") says less than the words after the value.
    if (!label || b.listItem || ((VERB_RE.test(label) || label.length < 2) && a)) {
      label = a;
      from = 'after';
    }
    if (label.length >= 2 || /^[A-Za-z]+$/.test(label)) labels[t.key] = shorten(label, from);
  });
  return labels;
}
