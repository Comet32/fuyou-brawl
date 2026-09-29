import type { HeroAbilities } from './schema';
import { toPlainText } from './template';

/** A hero a blessing relates to. `ability` is '' when only the hero's name matched. */
export interface HeroLink {
  hero: string;
  ability: string;
}

// Shorter names ("冰", "刃") are far too common in blessing text to be meaningful.
const MIN_NAME_LENGTH = 2;
// English names shorter than this ("Axe", "Hex") are too likely to appear as ordinary words.
const MIN_EN_LENGTH = 4;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Case-insensitive whole-word test (hyphens and apostrophes count as part of a word). */
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^A-Za-z0-9'-])${escapeRe(word)}(?![A-Za-z0-9'-])`, 'i').test(text);
const BRACKET_RE = /\[([^[\]]+)\]/g;

interface Candidate extends HeroLink {
  /** Whether the ability name was found in the blessing name or in a bracket of its effect. */
  via: 'name' | 'bracket';
}

/** Contents of every `[...]` in the effect's plain text. */
function bracketed(effect: string): Set<string> {
  return new Set([...toPlainText(effect).matchAll(BRACKET_RE)].map((m) => m[1].trim()));
}

/**
 * Link each blessing to the heroes it is about, by matching hero ability names (in the blessing name,
 * or as a `[bracketed]` mention in its effect) and hero names (in the blessing name).
 * When one matched ability name contains another ("天神下凡强化" vs "天神下凡"), only the longer one is kept.
 * An ability name shared by several heroes ("闪烁") only links the heroes whose name also appears in the
 * blessing's name or effect, and nothing when none does. Blessings without a match are absent.
 */
export function linkBlessingHeroes(
  blessings: { id: string; name: string; effect: string; name_en?: string }[],
  heroAbilities: HeroAbilities[],
  heroes: { id: string; name: string; name_en?: string }[],
): Map<string, HeroLink[]> {
  const abilities = heroAbilities.flatMap((h) =>
    h.abilities.filter((a) => a.name.length >= MIN_NAME_LENGTH).map((a) => ({ hero: h.hero, name: a.name })),
  );
  const heroNames = heroes.filter((h) => h.name.length >= MIN_NAME_LENGTH);
  const heroesOfAbility = new Map<string, Set<string>>();
  for (const a of abilities) heroesOfAbility.set(a.name, (heroesOfAbility.get(a.name) ?? new Set()).add(a.hero));
  const nameOf = new Map(heroes.map((h) => [h.id, h.name]));
  const enNameOf = new Map(heroes.map((h) => [h.id, h.name_en ?? '']));
  const abilitiesEn = heroAbilities.flatMap((h) =>
    h.abilities
      .filter((a) => a.name_en.length >= MIN_EN_LENGTH)
      .map((a) => ({ hero: h.hero, name: a.name, en: a.name_en })),
  );
  const heroesOfAbilityEn = new Map<string, Set<string>>();
  for (const a of abilitiesEn) {
    const key = a.en.toLowerCase();
    heroesOfAbilityEn.set(key, (heroesOfAbilityEn.get(key) ?? new Set()).add(a.hero));
  }

  const out = new Map<string, HeroLink[]>();
  for (const b of blessings) {
    const brackets = bracketed(b.effect);
    const text = `${b.name} ${toPlainText(b.effect)}`;
    const mentioned = (hero: string) => {
      const name = nameOf.get(hero);
      return name !== undefined && name.length >= MIN_NAME_LENGTH && text.includes(name);
    };
    const found: Candidate[] = [];
    for (const a of abilities) {
      if (b.name.includes(a.name)) found.push({ hero: a.hero, ability: a.name, via: 'name' });
      else if (brackets.has(a.name)) found.push({ hero: a.hero, ability: a.name, via: 'bracket' });
    }

    // Longest match wins: drop an ability whose name is inside another matched ability's name.
    const links: HeroLink[] = found
      .filter((c) => !found.some((o) => o.ability.length > c.ability.length && o.ability.includes(c.ability)))
      .filter((c) => (heroesOfAbility.get(c.ability)?.size ?? 0) <= 1 || mentioned(c.hero))
      .map(({ hero, ability }) => ({ hero, ability }));

    const linked = new Set(links.map((l) => l.hero));
    for (const h of heroNames) {
      if (b.name.includes(h.name) && !linked.has(h.id)) links.push({ hero: h.id, ability: '' });
    }

    // English pass, only when nothing matched in Chinese: ability or hero English names in name_en.
    const en = b.name_en ?? '';
    if (links.length === 0 && en) {
      const namedEn = (hero: string) => {
        const n = enNameOf.get(hero) ?? '';
        return n.length >= MIN_EN_LENGTH && hasWord(en, n);
      };
      const foundEn = abilitiesEn.filter((a) => hasWord(en, a.en));
      for (const a of foundEn) {
        if (foundEn.some((o) => o.en.length > a.en.length && o.en.toLowerCase().includes(a.en.toLowerCase()))) continue;
        if ((heroesOfAbilityEn.get(a.en.toLowerCase())?.size ?? 0) > 1 && !namedEn(a.hero)) continue;
        links.push({ hero: a.hero, ability: a.name });
      }
      const linkedEn = new Set(links.map((l) => l.hero));
      for (const h of heroes) {
        if (!linkedEn.has(h.id) && namedEn(h.id)) links.push({ hero: h.id, ability: '' });
      }
    }

    const unique = links.filter((l, i) => links.findIndex((o) => o.hero === l.hero && o.ability === l.ability) === i);
    if (unique.length > 0) out.set(b.id, unique);
  }
  return out;
}

/** Inverse of linkBlessingHeroes: hero id -> its blessings (in the order they were linked). */
export function blessingsByHero(links: Map<string, HeroLink[]>): Map<string, { blessing: string; ability: string }[]> {
  const out = new Map<string, { blessing: string; ability: string }[]>();
  for (const [blessing, list] of links) {
    for (const { hero, ability } of list) {
      const entries = out.get(hero) ?? [];
      entries.push({ blessing, ability });
      out.set(hero, entries);
    }
  }
  return out;
}

/**
 * Apply manual `heroes:` lists from blessings.overrides.yaml: a list REPLACES the automatic links of
 * that blessing (an empty list removes them). Ability names found automatically are kept for heroes
 * that stay linked.
 */
export function withManualHeroes(
  links: Map<string, HeroLink[]>,
  blessings: { id: string; heroes?: string[] }[],
): Map<string, HeroLink[]> {
  const out = new Map(links);
  for (const b of blessings) {
    if (!b.heroes) continue;
    const auto = links.get(b.id) ?? [];
    const manual = b.heroes.map((hero) => auto.find((l) => l.hero === hero) ?? { hero, ability: '' });
    if (manual.length > 0) out.set(b.id, manual);
    else out.delete(b.id);
  }
  return out;
}
