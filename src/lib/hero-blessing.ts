// Client-safe: a hero blessing (英雄福佑) has a 6-digit id (100000+), optionally with a letter suffix
// (100132a). 5-digit ids are general blessings, including the 200xx/210xx series that grant a
// hero's ability to anyone.
const HERO_BLESSING_RE = /^\d{6}[a-z]?$/;

export const isHeroBlessing = (id: string): boolean => HERO_BLESSING_RE.test(id);
