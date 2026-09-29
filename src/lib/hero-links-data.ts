// Build-time: blessing <-> hero links for pages, computed once per build from the bundled data.
import { blessingsByHero, linkBlessingHeroes, withManualHeroes, type HeroLink } from './blessing-heroes';
import { renderBlessings, renderHeroAbilities, renderHeroes } from './render-data';

let cache: { byBlessing: Map<string, HeroLink[]>; byHero: Map<string, { blessing: string; ability: string }[]> } | undefined;

export function heroLinks() {
  if (!cache) {
    const blessings = renderBlessings();
    const auto = linkBlessingHeroes(blessings, renderHeroAbilities(), renderHeroes());
    const byBlessing = withManualHeroes(auto, blessings);
    cache = { byBlessing, byHero: blessingsByHero(byBlessing) };
  }
  return cache;
}
