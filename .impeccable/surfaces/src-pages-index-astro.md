---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/compare.astro","src/pages/blessings/[id].astro"]
---

## Scope

Whole site, led by the blessing catalog home (`src/pages/index.astro`). Mode: **Operate** for catalog, compare, detail, heroes, label; **Read** for guides and versions (same world, prose measure).

## Audience & task

福佑大乱斗 players, phone in hand in a dark room mid-match, seconds to identify three offered blessings by name / pinyin / initials / effect words; between matches: browse by quality and tag, check hero builds. Constraint: mainland mobile network to GitHub Pages — every byte on the first viewport is paid for in seconds.

## Direction contract

THESIS: The site is a Captain's-Mode draft desk, the broadcast booth graphics shown while picks lock in. Every blessing is a pick slot and the three-choice moment is a live draft. It refuses the category default of a wiki table or a neon-glow "gamer" dashboard.

OWN-WORLD: The ground is stage black-blue (#0a0d14) with slate panel bars. The game's quality colors act as team colors: orange #ff910a, purple #b518ff, blue #3d8bff, painted as solid bars and never glowing. One broadcast gold carries focus, selection and "locked". Panels are hard-edged bars cut on a 12° slant at their leading end. Latin and numerals use a condensed grotesk (Barlow Condensed, tabular, self-hosted); CJK uses the heavy system sans (PingFang/YaHei 600–800), a performance-bound choice. There are no gradients, glass or glow; depth comes from overlapping bars.

STORY: The visitor types two letters and sees the right blessing rise to the top slot, its quality readable from across the room. Tapping a card shows the full card as a broadcast lower-third. Picking three places them on the draft board.

FIRST VIEWPORT (375×812): a slim slanted top bar holds the site mark and the live count, set like a scoreboard. Directly below sits the full-width lookup bar at 56px, auto-focused, with a slant cap and a gold caret. Next comes one row of three quality team-bars, each showing its tally, plus a 未标注 chip, then a scrollable tag strip. Result slots start by 230px, with the icon at 56px and a quality bar under the icon. A bottom dock holds 图鉴 / 对比 / 英雄 / 更多 within thumb reach. On desktop the dock becomes top broadcast tabs and results fill 3 columns.

FORM: Captain's Mode draft broadcast overlay, position 3 of the ordered list. Seed key ad3b6470.
- RAISE (from depot blind): unknown values have one honest material state, a hatched hollow slot, and are never faked.
- RAISE (from oscilloscope): all numbers are tabular and align on one baseline grid.
- RAISE (from console menu): empty compare slots read as dark hollows, and a filled slot lifts.
- RAISE (from zoo map): flat unmodulated color commitment, with no gradients anywhere.
- Signature interaction: LOCK-IN. Choosing a blessing into a compare slot wipes the slot in its quality color (clip-path, 220ms, expo-out) and stamps 已锁定 with pick order 1/2/3. Result reorders during typing FLIP-slide in 160ms. Both are disabled under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
