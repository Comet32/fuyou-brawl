import { applyCategory, createSearcher } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';
import { replaceSearch } from './history';

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
  const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip[data-cat]')];
  let category = '';

  const render = () => {
    const results = applyCategory(search(input.value), category);
    const shown = new Set(results.map((r) => r.id));
    for (const r of results) {
      const li = items.get(r.id);
      if (li) list.appendChild(li); // re-order by relevance
    }
    items.forEach((li, id) => (li.hidden = !shown.has(id)));
    const filtered = input.value.trim() !== '' || category !== '';
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
      if (input.value.trim()) params.set('q', input.value.trim());
      else params.delete('q');
      const qs = params.toString();
      replaceSearch(qs ? `?${qs}` : '');
    }, 250);
  };

  input.value = new URLSearchParams(location.search).get('q') ?? '';
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
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      category = chip.dataset.cat ?? '';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      render();
    });
  }
  if (input.value) render();
}
