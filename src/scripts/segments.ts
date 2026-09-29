// Client twin of Template.astro and BlessingIcon.astro: builds the same markup with DOM APIs.
// Text only ever enters the page through textContent, never innerHTML.
import type { CardRecord } from '../lib/card-record';
import { qualityOf } from '../lib/quality';
import { parseTemplate, type Tone } from '../lib/template';

const TONE_CLASS: Record<Tone, string | undefined> = { normal: undefined, highlight: 'h', muted: 'm', accent: 'a' };

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderTemplate(tpl: string, numbers?: Record<string, number | string>): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const seg of parseTemplate(tpl, numbers)) {
    if (seg.type === 'break') {
      frag.appendChild(document.createElement('br'));
    } else if (seg.type === 'text') {
      const cls = TONE_CLASS[seg.tone];
      frag.appendChild(cls ? el('span', cls, seg.text) : document.createTextNode(seg.text));
    } else if (seg.value !== undefined) {
      frag.appendChild(el('b', 'v', seg.value));
    } else {
      const u = el('i', 'u', '?');
      u.title = `${seg.key}：数值待补充`;
      frag.appendChild(u);
    }
  }
  return frag;
}

/** Icon box; `base` is the site base URL (import.meta.env.BASE_URL). */
export function renderIcon(r: Pick<CardRecord, 'icon' | 'name'>, base: string, size: number): HTMLElement {
  const box = el('span', 'ic');
  if (r.icon) {
    const img = el('img');
    img.src = base.replace(/\/?$/, '/') + r.icon;
    img.alt = '';
    img.width = size;
    img.height = size;
    img.decoding = 'async';
    box.appendChild(img);
  } else {
    const fb = el('span', 'fb', r.name.slice(0, 1));
    fb.setAttribute('aria-hidden', 'true');
    box.appendChild(fb);
  }
  return box;
}

/** Quality label, or '' while unlabeled (the hatched bar carries that state). */
export function qualityLabel(q: CardRecord['quality']): string {
  return qualityOf(q)?.label ?? '';
}

export function setQuality(node: HTMLElement, q: CardRecord['quality']): void {
  if (q) node.dataset.q = q;
  else delete node.dataset.q;
}
