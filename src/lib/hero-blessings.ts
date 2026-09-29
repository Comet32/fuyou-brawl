import { QUALITY_IDS } from './quality';
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

// Exclusive heroes are intentionally not included; the detail page shows exclusive_hero separately.
export function heroesForBlessing(blessingId: string, builds: Build[]): string[] {
  return builds.filter((b) => b.blessings.some((ref) => ref.id === blessingId)).map((b) => b.hero);
}

export interface RecommendedBlessing {
  blessing: Blessing;
  /** Where the community recommended it for this hero (guide image, video...). */
  sources: string[];
}

const qualityRank = (q: Blessing['quality']) => (q ? QUALITY_IDS.indexOf(q) : QUALITY_IDS.length);

/** Blessings whose community `recommended_heroes` include `heroId`, best quality first, then by name. */
export function blessingsRecommendedForHero(heroId: string, blessings: Blessing[]): RecommendedBlessing[] {
  return blessings
    .map((blessing) => ({
      blessing,
      sources: [...new Set(blessing.recommended_heroes.filter((r) => r.hero === heroId).map((r) => r.source))],
    }))
    .filter((r) => r.sources.length > 0)
    .sort(
      (a, b) =>
        qualityRank(a.blessing.quality) - qualityRank(b.blessing.quality) ||
        a.blessing.name.localeCompare(b.blessing.name, 'zh-CN'),
    );
}
