// Shared motion helpers. Every animation here is skipped under prefers-reduced-motion.
export const EASE_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const reducedMotion = (): boolean => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const inView = (r: DOMRect, vh: number) => r.bottom > 0 && r.top < vh && r.height > 0;

/**
 * FLIP-slide the visible children of `list` across a DOM change made by `mutate`.
 * Only items on screen are measured: children are in document order, so measuring
 * stops at the first one below the fold.
 */
export function flip(list: HTMLElement, mutate: () => void, duration = 160): void {
  if (reducedMotion() || typeof list.animate !== 'function') {
    mutate();
    return;
  }
  const vh = innerHeight;
  const first = new Map<Element, DOMRect>();
  for (const el of list.children as HTMLCollectionOf<HTMLElement>) {
    if (el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.top >= vh) break;
    if (inView(r, vh)) first.set(el, r);
  }
  mutate();
  for (const el of list.children as HTMLCollectionOf<HTMLElement>) {
    if (el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.top >= vh) break;
    if (!inView(r, vh)) continue;
    const f = first.get(el);
    if (f) {
      const dx = f.left - r.left;
      const dy = f.top - r.top;
      if (dx || dy) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing: EASE_EXPO });
      }
    } else {
      // Newly revealed slot: slides up from just below its place, already mostly visible.
      el.animate([{ transform: 'translateY(14px)', opacity: 0.35 }, { transform: 'none', opacity: 1 }], {
        duration,
        easing: EASE_EXPO,
      });
    }
  }
}
