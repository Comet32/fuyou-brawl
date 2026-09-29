import type { Blessing, Build } from './schema';

export interface HeroBlessing {
  blessing: Blessing;
  note?: string;
  reason: 'build' | 'exclusive';
}

export function blessingsForHero(heroId: string, blessings: Blessing[], build: Build | undefined): HeroBlessing[] {
  const byId = new Map(blessings.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const out: HeroBlessing[] = [];
  for (const ref of build?.blessings ?? []) {
    const b = byId.get(ref.id);
    if (!b || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({ blessing: b, note: ref.note, reason: 'build' });
  }
  for (const b of blessings) {
    if (b.exclusive_hero !== heroId || seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({ blessing: b, reason: 'exclusive' });
  }
  return out;
}

export function heroesForBlessing(blessingId: string, builds: Build[]): string[] {
  return builds.filter((b) => b.blessings.some((ref) => ref.id === blessingId)).map((b) => b.hero);
}
