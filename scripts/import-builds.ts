// Generate hero builds (src/content/builds/<hero>.md) from the community one-image guides (一图流).
// Usage: npm run builds -- [guides.json] [build-notes.json]
//   guides.json       transcription of the guides: { base, site, guides: GuideEntry[] } (docs/research/data/guides.json)
//   build-notes.json  our own words per hero (CN name): { summary, idea, core?: { printed name: reason },
//                     aliases?: { printed name: official name } } — aliases only land on research picks
// Only files with `origin: community-guide` (or missing files) are written; hand-written builds are kept.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUILD_ORIGIN,
  buildBlessings,
  matchGuide,
  mayOverwrite,
  renderBuild,
  stripInvisible,
  TIER_NOTE,
  TIERS,
  type GuideEntry,
  type NameMatch,
} from '../src/lib/build-import';
import { HERO_NAME_ALIASES } from '../src/lib/community';
import { buildSchema, type Blessing } from '../src/lib/schema';
import { loadDataSet, readFrontmatter } from '../src/lib/load';

const SUMMARY_MAX = 40;
const BODY_MIN = 150;
const BODY_MAX = 300;
const TIER_LEAD: Record<(typeof TIERS)[number], string> = { gold: '橙色先看', purple: '紫色优先', blue: '蓝色补' };

interface GuideExport {
  base: string;
  site: string;
  guides: GuideEntry[];
}
interface HeroNotes {
  summary: string;
  idea: string;
  core?: Record<string, string>;
  /** Printed name (or "gold:name" for one section) -> official name; must land on a research pick. */
  aliases?: Record<string, string>;
}

const [guidesFile = 'docs/research/data/guides.json', notesFile = 'docs/research/data/build-notes.json'] = process.argv.slice(2);
const root = process.cwd();

function readJson<T>(file: string): T {
  if (!existsSync(file)) throw new Error(`${file} 不存在`);
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/** "橙色先看「A」「B」「C」；紫色优先 …；蓝色补 …。" from the first picks of each section, each blessing once. */
function priorities(matches: NameMatch[], byId: Map<string, Blessing>, core: Record<string, string>): string {
  const seen = new Set<string>();
  const parts = TIERS.flatMap((tier) => {
    const ids = buildBlessings(matches.filter((m) => m.tier === tier), core)
      .map((b) => b.id)
      .filter((id) => !seen.has(id))
      .slice(0, 3);
    for (const id of buildBlessings(matches.filter((m) => m.tier === tier))) seen.add(id.id);
    return ids.length ? [`${TIER_LEAD[tier]}${ids.map((id) => `「${stripInvisible(byId.get(id)!.name)}」`).join('')}`] : [];
  });
  return `${parts.join('；')}。`;
}

function body(notes: HeroNotes, guide: GuideEntry, matches: NameMatch[], byId: Map<string, Blessing>) {
  return [
    notes.idea.trim(),
    priorities(matches, byId, notes.core ?? {}),
    `以上整理自社区图鉴站 ${guide.date} 的${guide.hero}一图流，之后的平衡性调整未必反映在内，实战以游戏内描述为准。`,
  ].join('\n\n');
}

try {
  const data = readJson<GuideExport>(guidesFile);
  const notesByHero = existsSync(notesFile) ? readJson<Record<string, HeroNotes>>(notesFile) : {};
  const ds = loadDataSet(root);
  const byId = new Map(ds.blessings.map((b) => [b.id, b]));
  const heroIdByName = new Map([...ds.heroes.map((h) => [h.name, h.id] as const), ...Object.entries(HERO_NAME_ALIASES)]);
  const dir = join(root, 'src/content/builds');
  mkdirSync(dir, { recursive: true });

  let written = 0;
  const problems: string[] = [];
  for (const guide of data.guides) {
    const heroId = heroIdByName.get(guide.hero);
    if (!heroId) {
      problems.push(`${guide.hero}：英雄名对不上 heroes.yaml，跳过`);
      continue;
    }
    const url = new URL(guide.file, data.base).href;
    const picks = new Set(
      ds.blessings.filter((b) => b.recommended_heroes.some((r) => r.hero === heroId && r.source === url)).map((b) => b.id),
    );
    const notes = notesByHero[guide.hero];
    const matches = matchGuide(guide, ds.blessings, picks, notes?.aliases ?? {});
    const blessings = buildBlessings(matches, notes?.core ?? {});

    // Report: mapped / total, then what needs a human look.
    const mapped = matches.filter((m) => m.id).length;
    const unmapped = matches.filter((m) => !m.id);
    const tag = (m: NameMatch) => `${m.name}(${TIER_NOTE[m.tier].slice(0, 1)})`;
    console.log(`${heroId.padEnd(18)} ${guide.hero}  ${mapped}/${matches.length} 个名字对上，写入 ${blessings.length} 个福佑`);
    if (unmapped.length) {
      console.log(`  未对上：${unmapped.map((m) => tag(m) + (m.candidates.length ? `[候选 ${m.candidates.join('/')}]` : '')).join(' ')}`);
    }
    const base = matches.filter((m) => m.how === 'base');
    if (base.length) console.log(`  同名取基础版：${base.map((m) => `${tag(m)}→${m.id} [${m.candidates.join('/')}]`).join(' ')}`);
    const viaAlias = matches.filter((m) => m.how === 'alias');
    if (viaAlias.length) console.log(`  按别名对应：${viaAlias.map((m) => `${tag(m)}→${byId.get(m.id!)!.name}`).join(' ')}`);
    for (const key of Object.keys(notes?.aliases ?? {})) {
      const name = key.replace(/^(gold|purple|blue):/, '');
      if (!viaAlias.some((m) => m.name === name)) problems.push(`${guide.hero}：别名「${key}」没有用上（目标不在研究记录里？）`);
    }
    const viaPick = matches.filter((m) => m.how === 'guide-pick');
    if (viaPick.length) console.log(`  按研究记录对应：${viaPick.map((m) => `${tag(m)}→${byId.get(m.id!)!.name}`).join(' ')}`);
    for (const name of Object.keys(notes?.core ?? {})) {
      if (!matches.some((m) => m.name === name && m.id)) problems.push(`${guide.hero}：core「${name}」没有对上福佑`);
    }

    if (!notes) {
      problems.push(`${guide.hero}：${notesFile} 里没有这个英雄的概述，跳过`);
      continue;
    }
    if ([...notes.summary].length > SUMMARY_MAX) problems.push(`${guide.hero}：summary 超过 ${SUMMARY_MAX} 字`);
    const text = body(notes, guide, matches, byId);
    const length = [...text.replace(/\s/g, '')].length;
    if (length < BODY_MIN || length > BODY_MAX) problems.push(`${guide.hero}：正文 ${length} 字，应在 ${BODY_MIN}–${BODY_MAX} 之间`);

    const file = join(dir, `${heroId}.md`);
    const existing = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
    if (!mayOverwrite(existing)) {
      problems.push(`${heroId}.md 是手写的（origin 不是 ${BUILD_ORIGIN}），不覆盖`);
      continue;
    }
    const md = renderBuild(
      {
        hero: heroId,
        origin: BUILD_ORIGIN,
        summary: notes.summary,
        blessings,
        items: [],
        updated: guide.date,
        sources: [url, data.site],
      },
      text,
    );
    buildSchema.parse(readFrontmatter(md)); // fail here, not in the Astro build
    writeFileSync(file, md);
    written++;
  }

  console.log(`\n✓ 写入 ${written} 个搭配（共 ${data.guides.length} 张一图流）`);
  if (problems.length) {
    console.log('需要处理：');
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
