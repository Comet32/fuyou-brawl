import { parseCompareIds, serializeCompareIds } from '../lib/compare';
import { qualityOf } from '../lib/quality';
import { createSearcher } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';
import { replaceSearch } from './history';

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
    replaceSearch(serializeCompareIds(selected));
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
          const quality = qualityOf(r.quality)?.label;
          btn.textContent = quality ? `${r.name} · ${quality}` : r.name;
          btn.addEventListener('click', () => choose(i, r.id));
          li.appendChild(btn);
          return li;
        }),
      );
      box.hidden = hits.length === 0;
    });
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // IME candidate confirmation, not a submit
      if (e.key === 'Escape') {
        box.hidden = true;
        return;
      }
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const first = search(input.value)[0];
      if (!first) return;
      choose(i, first.id);
      const next = slots[i + 1]?.querySelector('input');
      if (next) next.focus();
      else input.blur(); // last slot: dismiss the phone keyboard
    });
    // Keep the pointer press from blurring the input, so the suggestion click still lands.
    box.addEventListener('mousedown', (e) => e.preventDefault());
    slot.addEventListener('focusout', (e) => {
      if (!slot.contains(e.relatedTarget as Node | null)) box.hidden = true;
    });
  });

  parseCompareIds(location.search, new Set(byId.keys())).forEach((id, i) => choose(i, id));
  if (!selected.some(Boolean)) slots[0]?.querySelector('input')?.focus();
}
