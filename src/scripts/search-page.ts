import { applyFilters, createSearcher, type Filters } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';
import { replaceSearch } from './history';
import { flip } from './motion';

type FilterKey = keyof Filters;

export function initSearchPage(): void {
  const data = document.getElementById('search-data');
  const input = document.getElementById('q') as HTMLInputElement | null;
  const list = document.getElementById('results');
  const count = document.getElementById('count');
  const empty = document.getElementById('no-result');
  if (!data || !input || !list || !count || !empty) return;

  const records: SearchRecord[] = JSON.parse(data.textContent ?? '[]');
  const search = createSearcher(records);
  const items = new Map<string, HTMLElement>();
  list.querySelectorAll<HTMLElement>(':scope > li[data-id]').forEach((li) => items.set(li.dataset.id!, li));
  const total = records.length;
  const countNum = count.querySelector('b')!;
  const countLabel = count.querySelector('small')!;
  const tallies = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-tally]').forEach((el) => tallies.set(el.dataset.tally!, el));
  const reset = document.getElementById('reset-filters');

  // Team-bars drive quality, the tag strip drives tag. Each is a toggle: pressing the active one clears it.
  const groups: Record<FilterKey, HTMLButtonElement[]> = {
    quality: [...document.querySelectorAll<HTMLButtonElement>('button[data-quality]')],
    tag: [...document.querySelectorAll<HTMLButtonElement>('button[data-tag]')],
  };
  const filters: Required<Filters> = { quality: '', tag: '' };
  const valueOf = (key: FilterKey, b: HTMLButtonElement) => b.dataset[key] ?? '';

  const select = (key: FilterKey, value: string) => {
    const known = value === '' || groups[key].some((b) => valueOf(key, b) === value);
    if (!known) return; // unknown value from the URL: keep "all"
    (filters as Record<FilterKey, string>)[key] = value;
    groups[key].forEach((b) => b.setAttribute('aria-pressed', String(valueOf(key, b) === value)));
  };

  const render = (animate = true) => {
    const hits = search(input.value);
    // Tallies count the current query and tag, so each team-bar previews what pressing it would show.
    const byTag = applyFilters(hits, { tag: filters.tag });
    const tally: Record<string, number> = { ssr: 0, sr: 0, r: 0, none: 0 };
    for (const r of byTag) tally[r.quality ?? 'none'] += 1;
    tallies.forEach((el, q) => (el.textContent = String(tally[q] ?? 0)));

    const results = applyFilters(byTag, { quality: filters.quality });
    const shown = new Set(results.map((r) => r.id));
    const apply = () => {
      for (const r of results) {
        const li = items.get(r.id);
        if (li) list.appendChild(li); // re-order by relevance
      }
      items.forEach((li, id) => (li.hidden = !shown.has(id)));
    };
    if (animate) flip(list, apply);
    else apply();

    const filtered = input.value.trim() !== '' || filters.quality !== '' || filters.tag !== '';
    countNum.textContent = String(results.length);
    countLabel.textContent = filtered ? `/ ${total}` : '福佑';
    empty.hidden = results.length > 0;
    if (reset) reset.hidden = filters.quality === '' && filters.tag === '';
    scheduleUrlUpdate();
  };

  // Results render immediately; the URL is updated after typing pauses.
  let urlTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleUrlUpdate = () => {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const params = new URLSearchParams(location.search);
      const set = (name: string, value: string) => (value ? params.set(name, value) : params.delete(name));
      set('q', input.value.trim());
      set('quality', filters.quality);
      set('tag', filters.tag);
      const qs = params.toString();
      replaceSearch(qs ? `?${qs}` : '');
    }, 250);
  };

  const initial = new URLSearchParams(location.search);
  input.value = initial.get('q') ?? '';
  select('quality', initial.get('quality') ?? '');
  select('tag', initial.get('tag') ?? '');

  input.addEventListener('input', () => render());
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return; // IME candidate confirmation, not a submit
    if (e.key === 'Enter') {
      input.blur(); // dismiss the phone keyboard
    } else if (e.key === 'Escape') {
      input.value = '';
      render();
    }
  });
  document.querySelector('.field-clear')?.addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });
  for (const key of Object.keys(groups) as FilterKey[]) {
    for (const b of groups[key]) {
      b.addEventListener('click', () => {
        const value = valueOf(key, b);
        select(key, filters[key] === value ? '' : value);
        render();
      });
    }
  }
  document.querySelectorAll<HTMLButtonElement>('[data-try]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.try ?? '';
      render();
      input.focus();
    }),
  );
  reset?.addEventListener('click', () => {
    select('quality', '');
    select('tag', '');
    render();
  });
  if (input.value || filters.quality || filters.tag) render(false);
}
