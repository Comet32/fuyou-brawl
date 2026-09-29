import { isHeroBlessing } from '../lib/hero-blessing';
import { applyFilters, createSearcher, type Filters } from '../lib/searcher';
import type { SearchRecord } from '../lib/search-record';
import { replaceSearch } from './history';
import { flip } from './motion';

type FilterKey = keyof Filters;
/** 未标注 shows this many cards on phones until 展开全部. */
const FOLD_AT = 30;

export function initSearchPage(): void {
  const data = document.getElementById('search-data');
  const input = document.getElementById('q') as HTMLInputElement | null;
  const list = document.getElementById('results');
  const groupsBox = document.getElementById('groups');
  const count = document.getElementById('count');
  const empty = document.getElementById('no-result');
  if (!data || !input || !list || !groupsBox || !count || !empty) return;

  const records: SearchRecord[] = JSON.parse(data.textContent ?? '[]');
  const search = createSearcher(records);
  const items = new Map<string, HTMLElement>();
  groupsBox.querySelectorAll<HTMLElement>('li[data-id]').forEach((li) => items.set(li.dataset.id!, li));
  const generalTotal = records.filter((r) => !isHeroBlessing(r.id)).length;
  const countNum = count.querySelector('b')!;
  const countLabel = count.querySelector('small')!;
  const tallies = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-tally]').forEach((el) => tallies.set(el.dataset.tally!, el));
  const reset = document.getElementById('reset-filters');
  const heroToggle = document.getElementById('hero-toggle');
  const hint = document.getElementById('hero-hint');
  const hintNum = hint?.querySelector('b');
  const phone = matchMedia('(max-width: 720px)');

  // Groups keep their server order so leaving search mode restores them exactly.
  const groups = [...groupsBox.querySelectorAll<HTMLElement>('.group')].map((section) => ({
    id: section.dataset.group!,
    section,
    list: section.querySelector<HTMLElement>('.slots')!,
    order: [...section.querySelectorAll<HTMLElement>('li[data-id]')],
    tally: section.querySelector<HTMLElement>('[data-group-tally]')!,
    empty: section.querySelector<HTMLElement>('.group-empty')!,
    more: section.querySelector<HTMLButtonElement>('.group-more'),
  }));
  const unfolded = new Set<string>();

  // Team-bars drive quality, the tag strip drives tag. Each is a toggle: pressing the active one clears it.
  const buttons: Record<FilterKey, HTMLButtonElement[]> = {
    quality: [...document.querySelectorAll<HTMLButtonElement>('button[data-quality]')],
    tag: [...document.querySelectorAll<HTMLButtonElement>('button[data-tag]')],
  };
  const filters: Required<Filters> = { quality: '', tag: '' };
  let includeHero = false;
  let mode: 'groups' | 'flat' = 'groups';
  const valueOf = (key: FilterKey, b: HTMLButtonElement) => b.dataset[key] ?? '';

  const select = (key: FilterKey, value: string) => {
    const known = value === '' || buttons[key].some((b) => valueOf(key, b) === value);
    if (!known) return; // unknown value from the URL: keep "all"
    (filters as Record<FilterKey, string>)[key] = value;
    buttons[key].forEach((b) => b.setAttribute('aria-pressed', String(valueOf(key, b) === value)));
  };
  const setHero = (on: boolean) => {
    includeHero = on;
    heroToggle?.setAttribute('aria-checked', String(on));
  };

  const renderGroups = () => {
    for (const g of groups) {
      g.order.forEach((li) => g.list.appendChild(li));
      let shown = 0;
      for (const li of g.order) {
        const visible = includeHero || !isHeroBlessing(li.dataset.id!);
        li.hidden = !visible;
        if (visible) shown += 1;
        // Fold the huge 未标注 family on phones so the labeled families stay reachable.
        const fold = g.more && visible && shown > FOLD_AT && phone.matches && !unfolded.has(g.id);
        li.toggleAttribute('data-fold', Boolean(fold));
      }
      g.tally.textContent = String(shown);
      g.empty.hidden = shown > 0;
      if (g.more) {
        g.more.hidden = !(phone.matches && shown > FOLD_AT && !unfolded.has(g.id));
        g.more.querySelector('span')!.textContent = String(shown);
      }
    }
  };

  const render = (animate = true) => {
    const hits = search(input.value);
    const pool = includeHero ? hits : hits.filter((r) => !isHeroBlessing(r.id));
    // Tallies count the current query and tag, so each team-bar previews what pressing it would show.
    const byTag = applyFilters(pool, { tag: filters.tag });
    const tally: Record<string, number> = { ssr: 0, sr: 0, r: 0, none: 0 };
    for (const r of byTag) tally[r.quality ?? 'none'] += 1;
    tallies.forEach((el, q) => (el.textContent = String(tally[q] ?? 0)));
    const results = applyFilters(byTag, { quality: filters.quality });

    const query = input.value.trim() !== '';
    const filtered = query || filters.quality !== '' || filters.tag !== '';
    const next = filtered ? 'flat' : 'groups';
    if (next === 'groups') {
      renderGroups();
    } else {
      // Search mode: one flat list ranked by relevance; every card still wears its color.
      const shown = new Set(results.map((r) => r.id));
      const apply = () => {
        for (const r of results) {
          const li = items.get(r.id);
          if (li) list.appendChild(li);
        }
        items.forEach((li, id) => {
          li.hidden = !shown.has(id);
          li.removeAttribute('data-fold');
        });
      };
      if (animate && mode === 'flat') flip(list, apply);
      else apply();
    }
    groupsBox.hidden = next === 'flat';
    list.hidden = next === 'groups';
    mode = next;

    // Hero blessings hidden by the toggle that would match: offer to show them.
    const heroMatches = includeHero || !query ? 0 : applyFilters(hits.filter((r) => isHeroBlessing(r.id)), filters).length;
    if (hint && hintNum) {
      hint.hidden = heroMatches === 0;
      hintNum.textContent = String(heroMatches);
    }

    countNum.textContent = String(results.length);
    countLabel.textContent = filtered ? `/ ${includeHero ? records.length : generalTotal}` : '福佑';
    empty.hidden = results.length > 0 || heroMatches > 0;
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
      set('hero', includeHero ? '1' : '');
      const qs = params.toString();
      replaceSearch(qs ? `?${qs}` : '');
    }, 250);
  };

  const initial = new URLSearchParams(location.search);
  input.value = initial.get('q') ?? '';
  select('quality', initial.get('quality') ?? '');
  select('tag', initial.get('tag') ?? '');
  setHero(initial.get('hero') === '1');

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
  for (const key of Object.keys(buttons) as FilterKey[]) {
    for (const b of buttons[key]) {
      b.addEventListener('click', () => {
        const value = valueOf(key, b);
        select(key, filters[key] === value ? '' : value);
        render();
      });
    }
  }
  const flipHero = () => {
    setHero(!includeHero);
    render(false);
  };
  heroToggle?.addEventListener('click', flipHero);
  hint?.querySelector('button')?.addEventListener('click', flipHero);
  for (const g of groups) {
    g.more?.addEventListener('click', () => {
      unfolded.add(g.id);
      renderGroups();
    });
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
  render(false);
}
