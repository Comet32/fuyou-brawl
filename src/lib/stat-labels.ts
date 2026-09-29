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

interface Before {
  label: string;
  listItem: boolean;
  /** Words of change cut off the label's end ("永久增加"), or a sign turned into words. */
  suffix: string;
  /** The clause's last words once its verb is removed ("额外" in "的敌人额外造成"). */
  context: string;
}

const CJK_ONLY_RE = /[^\u4e00-\u9fff]/g;

function before(text: string): Before {
  const none: Before = { label: '', listItem: false, suffix: '', context: '' };
  const parts = text.split(BOUNDARY_RE);
  const clause = parts[parts.length - 1];
  if (!clause.trim()) {
    const m = COLON_LABEL_RE.exec(text);
    return m ? { ...none, label: m[1] } : none;
  }
  // "伤害输出、 {gold}": the value starts a new list item.
  if (/、\s*$/.test(clause)) return { ...none, listItem: true };
  const subParts = clause.split(CONJ_RE);
  const lead = subParts[subParts.length - 1].replace(LEADING_RE, '');
  const label = lead.replace(TRAILING_RE, '').trim();
  const tail = lead.slice(label.length);
  let suffix = tail.replace(CJK_ONLY_RE, '');
  if (!suffix && /[-－]/.test(tail)) suffix = '降低';
  else if (!suffix && /[+＋]/.test(tail)) suffix = '提升';
  const context = clean(clause).replace(VERB_RE, '').replace(CJK_ONLY_RE, '').slice(-2);
  return { label, listItem: false, suffix, context };
}

function after(text: string): string {
  const words = text.replace(FOLLOW_LEADING_RE, '').split(FOLLOW_CUT_RE)[0];
  // "{x}% 几率获得其他两个福佑": the value's noun ends where the next verb starts.
  return words.split(/获得|造成|拥有/)[0].replace(TRAILING_RE, '').trim();
}

// A unit right after a value, as the noun it measures.
const UNIT_NOUN: Record<string, string> = { 秒: '时间', 层: '层数', 次: '次数', 码: '距离' };

/** The noun a value measures, from the words after it: "{x} 秒" -> 时间, "{x} 护盾值" -> 护盾值. */
function nounAfter(text: string): string {
  const unit = /^\s*([秒层次码])/.exec(text);
  if (unit) return UNIT_NOUN[unit[1]];
  return clean(text.split(FOLLOW_CUT_RE)[0]).replace(CJK_ONLY_RE, '');
}

// Labels that say too little on their own ("伤害" of what?).
const GENERIC = new Set(['伤害', '时间', '数值', '持续', '冷却', '范围', '距离', '次数', '几率', '概率', '效果', '上限', '数量']);

/**
 * Label each placeholder of a template by the words around it: usually the words right before it
 * ("吸血 +{xx}%"), or the ones after it when only a verb or nothing precedes it ("获得 {gold} 金币").
 * A generic or duplicated label keeps its qualifier ("伤害永久增加", "额外伤害", "最大生命值降低").
 * Keys without a sensible label are left out. Labels are at most 8 characters.
 */
export function placeholderLabels(tpl: string): Record<string, string> {
  const list = tokens(tpl);
  const found: { key: string; label: string; qualified: string }[] = [];
  list.forEach((t, i) => {
    if (t.kind !== 'value' || found.some((f) => f.key === t.key)) return;
    const prev = list[i - 1];
    const next = list[i + 1];
    const b = prev?.kind === 'text' ? before(prev.text) : { label: '', listItem: false, suffix: '', context: '' };
    const bl = clean(b.label);
    const a = next?.kind === 'text' ? clean(after(next.text)) : '';
    let label = bl;
    let from: 'before' | 'after' = 'before';
    // A bare verb or a single character ("有 {x}% 几率") says less than the words after the value.
    if (!label || b.listItem || ((VERB_RE.test(label) || label.length < 2) && a)) {
      label = a;
      from = 'after';
    }
    if (label.length < 2 && !/^[A-Za-z]+$/.test(label)) return;
    // "{k1}伤害": a value glued to a generic noun names something (an ability), it is not that stat.
    if (from === 'after' && GENERIC.has(label) && next?.kind === 'text' && /^[\u4e00-\u9fff]/.test(next.text)) return;
    label = shorten(label, from);
    const nextText = next?.kind === 'text' ? next.text : '';
    let qualified = '';
    if (from === 'before') {
      const noun = nounAfter(nextText);
      if (b.suffix) qualified = label + b.suffix;
      else if (label === '持续' && noun === '时间') qualified = '持续时间';
      else if (noun && noun !== label) qualified = noun + label;
    } else if (b.context.length === 2 && !b.listItem) qualified = b.context + label;
    // "造成 {x}% 伤害": a percentage of damage.
    else if (label === '伤害' && !b.listItem && /^\s*[%％]/.test(nextText)) qualified = '伤害比例';
    found.push({ key: t.key, label, qualified: qualified.slice(0, MAX_LABEL) });
  });
  const count = (l: string) => found.filter((f) => f.label === l).length;
  const labels: Record<string, string> = {};
  for (const f of found) {
    const vague = GENERIC.has(f.label) || count(f.label) > 1;
    labels[f.key] = vague && f.qualified ? f.qualified : f.label;
  }
  return labels;
}
