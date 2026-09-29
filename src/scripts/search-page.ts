import { applyFilters, createSearcher, type Filters } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';
import { replaceSearch } from './history';

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
  list.querySelectorAll<HTMLElement>('li[data-id]').forEach((li) => items.set(li.dataset.id!, li));

  // Each chip row drives one filter; the value lives in data-quality / data-tag.
  const groups: Record<FilterKey, HTMLButtonElement[]> = {
    quality: [...document.querySelectorAll<HTMLButtonElement>('.chip[data-quality]')],
    tag: [...document.querySelectorAll<HTMLButtonElement>('.chip[data-tag]')],
  };
  const filters: Required<Filters> = { quality: '', tag: '' };
  const chipValue = (key: FilterKey, chip: HTMLButtonElement) => chip.dataset[key] ?? '';

  const select = (key: FilterKey, value: string) => {
    const chip = groups[key].find((c) => chipValue(key, c) === value);
    if (!chip) return; // unknown value from the URL: keep "all"
    (filters as Record<FilterKey, string>)[key] = value;
    groups[key].forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  };

  const render = () => {
    const results = applyFilters(search(input.value), filters);
    const shown = new Set(results.map((r) => r.id));
    for (const r of results) {
      const li = items.get(r.id);
      if (li) list.appendChild(li); // re-order by relevance
    }
    items.forEach((li, id) => (li.hidden = !shown.has(id)));
    const filtered = input.value.trim() !== '' || filters.quality !== '' || filters.tag !== '';
    count.textContent = filtered ? `找到 ${results.length} 个` : `共 ${records.length} 个`;
    empty.hidden = results.length > 0;
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

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return; // IME candidate confirmation, not a submit
    if (e.key === 'Enter') {
      input.blur(); // dismiss the phone keyboard
    } else if (e.key === 'Escape') {
      input.value = '';
      render();
    }
  });
  for (const key of Object.keys(groups) as FilterKey[]) {
    for (const chip of groups[key]) {
      chip.addEventListener('click', () => {
        select(key, chipValue(key, chip));
        render();
      });
    }
  }
  if (input.value || filters.quality || filters.tag) render();
}
