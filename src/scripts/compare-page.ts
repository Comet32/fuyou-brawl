import { parseCompareIds, serializeCompareIds } from '../lib/compare';
import { createSearcher } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';

export function initComparePage(): void {
  const data = document.getElementById('search-data');
  if (!data) return;
  const records: SearchRecord[] = JSON.parse(data.textContent ?? '[]');
  const search = createSearcher(records);
  const byId = new Map(records.map((r) => [r.id, r]));
  const pool = new Map<string, Element>();
  document.querySelectorAll<HTMLElement>('#card-pool > [data-id]').forEach((el) => pool.set(el.dataset.id!, el));
  const slots = [...document.querySelectorAll<HTMLElement>('.compare-slot')];
  const selected: (string | null)[] = slots.map(() => null);

  const choose = (i: number, id: string | null) => {
    selected[i] = id;
    const slot = slots[i];
    const input = slot.querySelector('input')!;
    const card = slot.querySelector('.slot-card')!;
    card.replaceChildren();
    if (id) {
      const src = pool.get(id);
      if (src) card.appendChild(src.cloneNode(true));
      input.value = byId.get(id)?.name ?? '';
    }
    slot.querySelector<HTMLElement>('.suggestions')!.hidden = true;
    history.replaceState(null, '', location.pathname + serializeCompareIds(selected));
  };

  slots.forEach((slot, i) => {
    const input = slot.querySelector('input')!;
    const box = slot.querySelector<HTMLUListElement>('.suggestions')!;
    input.addEventListener('input', () => {
      if (!input.value.trim()) {
        choose(i, null);
        return;
      }
      const hits = search(input.value).slice(0, 6);
      box.replaceChildren(
        ...hits.map((r) => {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = `${r.name} · ${r.category}`;
          btn.addEventListener('click', () => choose(i, r.id));
          li.appendChild(btn);
          return li;
        }),
      );
      box.hidden = hits.length === 0;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const first = search(input.value)[0];
      if (!first) return;
      choose(i, first.id);
      slots[i + 1]?.querySelector('input')?.focus();
    });
  });

  parseCompareIds(location.search, new Set(byId.keys())).forEach((id, i) => choose(i, id));
  if (!selected.some(Boolean)) slots[0]?.querySelector('input')?.focus();
}
