export type Tone = 'normal' | 'highlight' | 'muted' | 'accent';
export type Segment =
  | { type: 'text'; text: string; tone: Tone }
  | { type: 'value'; key: string; value?: string; tone: Tone }
  | { type: 'break' };

type Numbers = Record<string, number | string>;

const HIGHLIGHT = '#83d18a';
const MUTED = '#8e8e8e';

// Only well-formed tags (letter right after "<" or "</") are treated as markup; a lone "<" stays text.
const TOKEN_RE = /<\/?[A-Za-z][^>]*>|\{[A-Za-z0-9_]+\}/g;
const FONT_COLOR_RE = /^<font\b[^>]*?\bcolor\s*=\s*(['"])(.*?)\1/i;
const ENTITY_RE = /&(?:amp|lt|gt|quot|#39);/g;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decode(s: string): string {
  // Single pass, so "&amp;lt;" becomes "&lt;" and not "<".
  return s.replace(ENTITY_RE, (m) => ENTITIES[m]);
}

function toneOf(color: string): Tone {
  const c = color.trim().toLowerCase();
  if (c === HIGHLIGHT) return 'highlight';
  if (c === MUTED) return 'muted';
  return 'accent';
}

/**
 * Parse a game description template into safe segments.
 * Only <font color> and <br> are understood; every other tag is dropped and its text kept.
 * Text segments are plain text (entities decoded) and must be escaped by the renderer.
 */
export function parseTemplate(tpl: string, numbers?: Numbers): Segment[] {
  const out: Segment[] = [];
  const tones: Tone[] = [];
  const current = (): Tone => tones[tones.length - 1] ?? 'normal';

  const pushText = (raw: string) => {
    const text = decode(raw);
    if (!text) return;
    const tone = current();
    const last = out[out.length - 1];
    if (last && last.type === 'text' && last.tone === tone) last.text += text;
    else out.push({ type: 'text', text, tone });
  };

  let pos = 0;
  for (const m of tpl.matchAll(TOKEN_RE)) {
    const token = m[0];
    pushText(tpl.slice(pos, m.index));
    pos = m.index + token.length;

    if (token[0] === '{') {
      const key = token.slice(1, -1);
      const seg: Segment = { type: 'value', key, tone: current() };
      if (numbers && Object.hasOwn(numbers, key) && numbers[key] !== undefined) {
        seg.value = String(numbers[key]);
      }
      out.push(seg);
      continue;
    }

    const name = /^<\/?([A-Za-z][A-Za-z0-9]*)/.exec(token)![1].toLowerCase();
    if (name === 'br') {
      out.push({ type: 'break' });
    } else if (name === 'font') {
      if (token[1] === '/') {
        tones.pop();
      } else {
        const color = FONT_COLOR_RE.exec(token);
        tones.push(color ? toneOf(color[2]) : current());
      }
    }
    // Any other tag is dropped.
  }
  pushText(tpl.slice(pos));
  return out;
}

export function toPlainText(tpl: string, numbers?: Numbers): string {
  let s = '';
  for (const seg of parseTemplate(tpl, numbers)) {
    if (seg.type === 'text') s += seg.text;
    else if (seg.type === 'value') s += seg.value ?? '?';
    else s += ' ';
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Unique placeholder keys in order of first appearance. */
export function placeholderKeys(tpl: string): string[] {
  const keys: string[] = [];
  for (const seg of parseTemplate(tpl)) {
    if (seg.type === 'value' && !keys.includes(seg.key)) keys.push(seg.key);
  }
  return keys;
}
