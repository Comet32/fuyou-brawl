import type { CardRecord } from '../lib/card-record';
import {
  STORAGE_KEY,
  answerCounts,
  answerForKey,
  applyAnswer,
  buildQueue,
  parseState,
  prevIndex,
  serializeExport,
  type Answer,
  type LabelState,
} from '../lib/labeling';
import { renderIcon, renderTemplate } from './segments';

type LabelRecord = Pick<CardRecord, 'id' | 'name' | 'name_en' | 'quality' | 'summary' | 'numbers' | 'icon'>;
const BASE = import.meta.env.BASE_URL;

function load(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function save(state: LabelState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // private mode or blocked storage: the page still works for this visit
  }
}

export function initLabelPage(): void {
  const data = document.getElementById('label-data');
  if (!data) return;
  const records: LabelRecord[] = JSON.parse(data.textContent ?? '[]');
  const byId = new Map(records.map((r) => [r.id, r]));
  const queue = buildQueue(records);
  let state = parseState(load(), queue.length);

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const card = $('label-card');
  const name = $('label-name');
  const pos = $('label-pos');
  const summary = $('label-summary');
  const finished = $('label-finished');
  const track = $('label-track');
  const fill = track.querySelector<HTMLElement>('.timeline-fill')!;
  const done = $('label-done');
  const prev = $<HTMLButtonElement>('label-prev');
  const status = $('label-status');
  const json = $<HTMLTextAreaElement>('label-json');
  const copy = $<HTMLButtonElement>('label-copy');
  const answerButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-answer]')];
  const counters = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => counters.set(el.dataset.count!, el));

  const say = (text: string, error = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', error);
  };

  const commit = (next: LabelState) => {
    state = next;
    if (!save(state)) say('浏览器存储不可用：刷新后进度会丢失，记得先导出。', true);
    render();
  };

  const render = () => {
    const id = queue[state.index];
    const r = id ? byId.get(id) : undefined;
    card.hidden = !r;
    finished.hidden = Boolean(r) || queue.length === 0;
    if (r) {
      // renderIcon builds a new node each time; swap it in place of the previous one.
      const fresh = renderIcon(r, BASE, 128);
      fresh.id = 'label-icon';
      $('label-icon').replaceWith(fresh);
      name.textContent = r.name;
      pos.textContent = `#${state.index + 1} · ${r.id}${r.name_en ? ` · ${r.name_en}` : ''}`;
      summary.replaceChildren(renderTemplate(r.summary, r.numbers));
    }
    const current = r ? state.answers[r.id] : undefined;
    for (const b of answerButtons) {
      b.disabled = !r;
      b.setAttribute('aria-pressed', String(current === b.dataset.answer));
    }
    prev.disabled = state.index === 0;
    const counts = answerCounts(queue, state.answers);
    counters.forEach((el, k) => (el.textContent = String(counts[k as Answer])));
    done.textContent = String(counts.done);
    track.setAttribute('aria-valuenow', String(counts.done));
    fill.style.transform = `scaleX(${queue.length ? counts.done / queue.length : 0})`;
  };

  const answer = (a: Answer) => {
    if (state.index >= queue.length) return;
    commit(applyAnswer(state, queue, a));
  };
  const back = () => commit({ ...state, index: prevIndex(state.index) });

  for (const b of answerButtons) b.addEventListener('click', () => answer(b.dataset.answer as Answer));
  prev.addEventListener('click', back);
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea')) return;
    const action = answerForKey(e.key);
    if (!action) return;
    e.preventDefault();
    if (action === 'prev') back();
    else answer(action);
  });

  $('label-export').addEventListener('click', () => {
    json.value = serializeExport(state.answers);
    json.hidden = false;
    copy.hidden = false;
    const n = Object.keys(JSON.parse(json.value)).length;
    say(`已导出 ${n} 条（不确定的已跳过）。`);
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json.value);
      say('已复制到剪贴板。');
    } catch {
      json.focus();
      json.select();
      say('无法直接复制：已选中文本框里的内容，请按 Ctrl/⌘ + C 手动复制。', true);
    }
  });
  $('label-clear').addEventListener('click', () => {
    const n = Object.keys(state.answers).length;
    if (!confirm(`清空这个浏览器里的全部 ${n} 条标注？此操作无法撤销。`)) return;
    json.value = '';
    json.hidden = true;
    copy.hidden = true;
    commit({ index: 0, answers: {} });
    say('已清空。');
  });

  render();
}
