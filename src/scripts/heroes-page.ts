import { createHeroSearcher, filterByAttr, type HeroSearchRecord } from '../lib/hero-search';
import { replaceSearch } from './history';
import { flip } from './motion';

type Attr = HeroSearchRecord['attr'] | '';

export function initHeroesPage(): void {
  const data = document.getElementById('hero-data');
  const input = document.getElementById('hq') as HTMLInputElement | null;
  const groupsBox = document.getElementById('hero-groups');
  const flat = document.getElementById('hero-results');
  const count = document.getElementById('hero-count');
  const empty = document.getElementById('hero-empty');
  if (!data || !input || !groupsBox || !flat || !count || !empty) return;

  const records: HeroSearchRecord[] = JSON.parse(data.textContent ?? '[]');
  const search = createHeroSearcher(records);
  const tiles = new Map<string, HTMLElement>();
  groupsBox.querySelectorAll<HTMLElement>('li[data-hero]').forEach((li) => tiles.set(li.dataset.hero!, li));
  const sections = [...groupsBox.querySelectorAll<HTMLElement>('section[data-attr-group]')].map((section) => ({
    attr: section.dataset.attrGroup as Attr,
    section,
    list: section.querySelector<HTMLElement>('.hero-grid')!,
    order: [...section.querySelectorAll<HTMLElement>('li[data-hero]')],
  }));
  const chips = [...document.querySelectorAll<HTMLButtonElement>('button[data-attr-filter]')];
  const countNum = count.querySelector('b')!;
  const countLabel = count.querySelector('small')!;
  let attr: Attr = '';
  let mode: 'groups' | 'flat' = 'groups';

  const selectAttr = (value: string) => {
    if (value && !chips.some((c) => c.dataset.attrFilter === value)) return;
    attr = value as Attr;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.attrFilter === value)));
  };

  // The matched ability shows as a small line on the tile; textContent only.
  const setAbility = (li: HTMLElement, ability?: string) => {
    const tile = li.querySelector('.hero-tile')!;
    let line = tile.querySelector<HTMLElement>('.ability-strap');
    if (!ability) {
      line?.remove();
      return;
    }
    if (!line) {
      line = document.createElement('span');
      line.className = 'ability-strap';
      tile.appendChild(line);
    }
    line.textContent = `技能：${ability}`;
  };

  const render = (animate = true) => {
    const query = input.value.trim() !== '';
    const hits = filterByAttr(search(input.value), attr);
    if (!query) {
      // No query: the attribute-grouped grid (only the chosen attribute when one is pressed).
      for (const s of sections) {
        s.order.forEach((li) => {
          s.list.appendChild(li);
          li.hidden = false;
          setAbility(li);
        });
        s.section.hidden = attr !== '' && s.attr !== attr;
      }
    } else {
      const shown = new Set(hits.map((h) => h.record.id));
      const apply = () => {
        for (const h of hits) {
          const li = tiles.get(h.record.id);
          if (!li) continue;
          setAbility(li, h.ability);
          flat.appendChild(li);
        }
        tiles.forEach((li, id) => (li.hidden = !shown.has(id)));
      };
      if (animate && mode === 'flat') flip(flat, apply);
      else apply();
    }
    mode = query ? 'flat' : 'groups';
    groupsBox.hidden = query;
    flat.hidden = !query;
    empty.hidden = hits.length > 0;
    countNum.textContent = String(hits.length);
    countLabel.textContent = query || attr ? `/ ${records.length}` : '英雄';
    scheduleUrlUpdate();
  };

  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleUrlUpdate = () => {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const set = (name: string, value: string) => (value ? params.set(name, value) : params.delete(name));
      set('q', input.value.trim());
      set('attr', attr);
      const qs = params.toString();
      replaceSearch(qs ? `?${qs}` : ''); // keeps the hash
    }, 250);
  };

  const initial = new URLSearchParams(location.search);
  input.value = initial.get('q') ?? '';
  selectAttr(initial.get('attr') ?? '');

  input.addEventListener('input', () => render());
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return; // IME candidate confirmation, not a submit
    if (e.key === 'Enter') input.blur();
    else if (e.key === 'Escape') {
      input.value = '';
      render();
    }
  });
  document.querySelector('.field-clear')?.addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });
  for (const c of chips) {
    c.addEventListener('click', () => {
      selectAttr(attr === c.dataset.attrFilter ? '' : (c.dataset.attrFilter ?? ''));
      render();
    });
  }
  document.querySelectorAll<HTMLButtonElement>('[data-try]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.try ?? '';
      render();
      input.focus();
    }),
  );
  if (input.value || attr) render(false);
  // Desktop only: on phones auto-focus would pop the keyboard over the grid.
  if (matchMedia('(min-width: 721px)').matches) input.focus();
}
