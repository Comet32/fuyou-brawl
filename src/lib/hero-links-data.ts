// Build-time: blessing <-> hero links for pages, computed once per build from the data files.
import { blessingsByHero, linkBlessingHeroes, withManualHeroes, type HeroLink } from './blessing-heroes';
import { loadDataSet } from './load';

let cache: { byBlessing: Map<string, HeroLink[]>; byHero: Map<string, { blessing: string; ability: string }[]> } | undefined;

export function heroLinks() {
  if (!cache) {
    const d = loadDataSet(process.cwd());
    const auto = linkBlessingHeroes(d.blessings, d.heroAbilities, d.heroes);
    const byBlessing = withManualHeroes(auto, d.blessings);
    cache = { byBlessing, byHero: blessingsByHero(byBlessing) };
  }
  return cache;
}
