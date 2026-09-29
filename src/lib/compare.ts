export const MAX_COMPARE = 3;

export function parseCompareIds(search: string, validIds: Set<string>): string[] {
  const raw = new URLSearchParams(search).get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((id) => validIds.has(id));
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function serializeCompareIds(slots: (string | null)[]): string {
  const ids = slots.filter((id): id is string => Boolean(id));
  return ids.length ? `?ids=${ids.join(',')}` : '';
}
