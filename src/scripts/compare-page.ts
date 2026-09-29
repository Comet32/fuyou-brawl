import { hydrateCardRecord, type CardRecord, type HydratedCard } from '../lib/card-record';
import { parseCompareIds, serializeCompareIds } from '../lib/compare';
import { createSearcher } from '../lib/searcher';
import { replaceSearch } from './history';
import { reducedMotion } from './motion';
import { el, qualityLabel, renderIcon, renderTemplate, setQuality } from './segments';

const BASE = import.meta.env.BASE_URL;
const SUGGESTIONS = 6;
const ARROW = 'M14 5l7 7-7 7M21 12H3';

function arrowIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({
    class: 'icon',
    width: '16',
    height: '16',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'square',
    'aria-hidden': 'true',
  }))
    svg.setAttribute(k, v);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ARROW);
  svg.appendChild(path);
  return svg;
}

/** Small portrait + name of the hero a hero blessing belongs to. */
function heroMark(hero: NonNullable<HydratedCard['hero']>): HTMLElement {
  const mark = el('span', 'hero-strap');
  if (hero.img) {
    const img = el('img');
    img.src = BASE.replace(/\/?$/, '/') + hero.img;
    img.alt = '';
    img.width = 32;
    img.height = 18;
    img.decoding = 'async';
    mark.appendChild(img);
  }
  mark.appendChild(document.createTextNode(hero.name));
  return mark;
}

function renderCard(r: HydratedCard): HTMLElement {
  const card = el('article', 'pc');
  setQuality(card, r.quality);
  const top = el('div', 'pc-top');
  top.appendChild(renderIcon(r, BASE, 64, true)); // locked cards are the whole screen: load now
  const head = el('div');
  const h = el('h2');
  const link = el('a', undefined, r.name);
  link.href = `${BASE.replace(/\/?$/, '/')}blessings/${r.id}/`;
  h.appendChild(link);
  head.appendChild(h);
  const label = qualityLabel(r.quality);
  if (label || r.tags.length || r.hero) {
    const meta = el('p', 'mt');
    if (label) meta.appendChild(el('b', undefined, label));
    meta.appendChild(document.createTextNode(r.tags.join(' · ')));
    if (r.hero) meta.appendChild(heroMark(r.hero));
    head.appendChild(meta);
  }
  top.appendChild(head);
  const summary = el('p', 'sm');
  summary.appendChild(renderTemplate(r.summary, r.numbers));
  const more = el('a', 'pc-more', '完整效果与数值');
  more.href = link.href;
  more.appendChild(arrowIcon());
  card.append(top, summary, more);
  return card;
}

export function initComparePage(): void {
  const data = document.getElementById('card-data');
  if (!data) return;
  const records = (JSON.parse(data.textContent ?? '[]') as CardRecord[]).map(hydrateCardRecord);
  const search = createSearcher(records);
  const byId = new Map(records.map((r) => [r.id, r]));
  const picks = [...document.querySelectorAll<HTMLElement>('.pick')];
  const selected: (string | null)[] = picks.map(() => null);

  const parts = picks.map((pick) => ({
    pick,
    input: pick.querySelector('input')!,
    box: pick.querySelector<HTMLUListElement>('.suggest')!,
    card: pick.querySelector<HTMLElement>('.pick-card')!,
    idle: pick.querySelector<HTMLElement>('.pick-idle')!,
    stamp: pick.querySelector<HTMLElement>('.pick-stamp')!,
    clear: pick.querySelector<HTMLButtonElement>('.pick-clear')!,
    toggle: pick.querySelector<HTMLButtonElement>('.pick-toggle')!,
    repick: pick.querySelector<HTMLElement>('.pick-repick')!,
    qword: pick.querySelector<HTMLElement>('.pick-quality')!,
  }));

  const close = (i: number) => {
    parts[i].box.hidden = true;
  };

  // LOCK-IN: the head wipes in the quality color and stamps 已锁定 with the pick number.
  const choose = (i: number, id: string | null, animate = true) => {
    const { pick, input, card, idle, stamp, clear, toggle, repick, qword } = parts[i];
    const r = id ? byId.get(id) : undefined;
    selected[i] = r ? r.id : null;
    card.replaceChildren();
    pick.classList.remove('is-locking');
    if (r) {
      card.appendChild(renderCard(r));
      input.value = r.name;
      setQuality(pick, r.quality);
      pick.classList.add('is-locked');
      if (animate && !reducedMotion()) {
        void pick.offsetWidth; // restart the animation when re-locking the same slot
        pick.classList.add('is-locking');
      }
    } else {
      setQuality(pick, null);
      pick.classList.remove('is-locked');
    }
    idle.hidden = Boolean(r);
    stamp.hidden = !r;
    clear.hidden = !r;
    repick.hidden = !r;
    // Quality is spelled out on the band, never inferred from the lock color alone.
    qword.hidden = !r;
    qword.textContent = r ? qualityLabel(r.quality) || '品质未标注' : '';
    toggle.disabled = !r;
    pick.classList.remove('is-editing');
    close(i);
    replaceSearch(serializeCompareIds(selected));
  };

  const suggest = (i: number) => {
    const { input, box } = parts[i];
    const taken = new Set(selected.filter((id, j) => id && j !== i));
    const hits = search(input.value)
      .filter((r) => !taken.has(r.id))
      .slice(0, SUGGESTIONS);
    box.replaceChildren(
      ...hits.map((r) => {
        const li = el('li');
        const btn = el('button');
        btn.type = 'button';
        setQuality(btn, r.quality);
        btn.appendChild(renderIcon(r, BASE, 36).firstChild!);
        btn.appendChild(el('span', undefined, r.name));
        const label = qualityLabel(r.quality);
        const side = el('span', 'q', label);
        const hero = byId.get(r.id)?.hero; // the searcher returns plain search records
        if (hero) side.appendChild(heroMark(hero));
        btn.appendChild(side);
        btn.addEventListener('click', () => {
          choose(i, r.id);
          focusNext(i);
        });
        li.appendChild(btn);
        return li;
      }),
    );
    box.hidden = hits.length === 0;
    return hits;
  };

  const focusNext = (i: number) => {
    const next = parts[i + 1]?.input;
    if (next && !selected[i + 1]) next.focus();
    else parts[i].input.blur(); // last slot: dismiss the phone keyboard
  };

  // Tapping a locked head unfolds its search field to pick again.
  const edit = (i: number) => {
    const { pick, input } = parts[i];
    pick.classList.add('is-editing');
    input.focus();
    input.select();
  };

  parts.forEach(({ pick, input, box, clear, toggle }, i) => {
    toggle.addEventListener('click', () => edit(i));
    input.addEventListener('input', () => {
      if (!input.value.trim()) {
        choose(i, null);
        return;
      }
      suggest(i);
    });
    input.addEventListener('focus', () => {
      if (input.value.trim() && !selected[i]) suggest(i);
    });
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // IME candidate confirmation, not a submit
      if (e.key === 'Escape') {
        close(i);
        if (selected[i]) {
          input.value = byId.get(selected[i]!)?.name ?? '';
          pick.classList.remove('is-editing');
        }
        return;
      }
      if (e.key === 'ArrowDown' && !box.hidden) {
        e.preventDefault();
        box.querySelector('button')?.focus();
        return;
      }
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const first = search(input.value).find((r) => !selected.some((id, j) => id === r.id && j !== i));
      if (!first) return;
      choose(i, first.id);
      focusNext(i);
    });
    box.addEventListener('keydown', (e) => {
      const buttons = [...box.querySelectorAll('button')];
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const to = e.key === 'ArrowDown' ? at + 1 : at - 1;
        if (to < 0) input.focus();
        else buttons[Math.min(to, buttons.length - 1)]?.focus();
      } else if (e.key === 'Escape') {
        close(i);
        input.focus();
      }
    });
    // Keep the pointer press from blurring the input, so the suggestion click still lands.
    box.addEventListener('mousedown', (e) => e.preventDefault());
    pick.addEventListener('focusout', (e) => {
      if (pick.contains(e.relatedTarget as Node | null)) return;
      close(i);
      // Leaving a re-pick without choosing folds the field back over the locked card.
      if (selected[i]) {
        input.value = byId.get(selected[i]!)?.name ?? '';
        pick.classList.remove('is-editing');
      }
    });
    clear.addEventListener('click', () => {
      input.value = '';
      choose(i, null);
      input.focus();
    });
  });
  picks.forEach((pick) =>
    pick.addEventListener('animationend', (e) => {
      // The stamp is the longest of the two lock-in animations.
      if ((e.target as Element).classList.contains('pick-stamp')) pick.classList.remove('is-locking');
    }),
  );

  // Restoring from ?ids= is instant: no page-load choreography.
  parseCompareIds(location.search, new Set(byId.keys())).forEach((id, i) => choose(i, id, false));
  const firstEmpty = parts.find((_, i) => !selected[i]);
  if (!selected.some(Boolean)) firstEmpty?.input.focus();
}
